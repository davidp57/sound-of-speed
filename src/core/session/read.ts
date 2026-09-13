import { gunzip } from '../upload/compress'
import { SLICE_AFTER_MS } from '../upload/slicing'
import { buildSession, type Session, type SessionFile } from './model'

/**
 * Retrouver les sessions déposées sur le serveur.
 *
 * **C'est le serveur qui regroupe.** Il range des tranches et sait les réunir en
 * trajets, avec ce qu'il est seul à connaître : le poids, ce que le profileur a
 * regardé, ce qui est retenu et à quel titre. Le relecteur lisait les deux
 * dossiers et regroupait lui-même ; deux règles de regroupement auraient fini
 * par ne plus dire la même chose, et rien ne l'aurait signalé.
 *
 * **La lecture s'annonce.** Les dossiers ne se lisent plus sans mot de passe
 * depuis le 10 septembre 2026 ; sans compte, la liste est vide plutôt qu'en
 * erreur, ce qui est le cas normal d'un appareil qui n'en a pas.
 *
 * `fetch` est injecté pour que tout ceci se vérifie sans réseau ni serveur.
 */

/** Ce que rend `/sessions/`, tel que le serveur l'écrit. */
interface SessionDistante {
  cle?: string
  isole?: boolean
  enregistreLe?: number
  tranches?: { dossier?: string; nom?: string; octets?: number }[]
  octets?: number
  aVoir?: number
  exemption?: string | null
}

/** Ce qui retient un trajet : un choix, ou un déménagement. */
export type Exemption = 'epingle' | 'archive'

/** Une session repérée sur le serveur, sans son contenu. */
export interface SessionEntry {
  key: string
  id: string
  startedAt: number
  files: { name: string; kind: 'journal' | 'capture' }[]
  /** Poids de ses tranches, en octets : ce que l'effacement rendrait. */
  bytes: number
  /**
   * Ce « trajet » n'est qu'un dépôt seul, au nom libre d'avant la convention.
   *
   * Le regroupement ne le voit pas, le profileur non plus. Il figure dans la
   * liste pour une seule raison : sans lui, rien ne pourrait jamais l'enlever.
   */
  isolated: boolean
  /** Tranches de trace que le profileur n'a pas encore regardées. */
  pending: number
  /** Ce qui exempte ce trajet de l'effacement, ou rien. */
  exemption: Exemption | null
}

/**
 * Les sessions du serveur, la plus récente en tête.
 *
 * Vide plutôt qu'en erreur : sans compte, hors réseau, ou devant un serveur qui
 * ne connaît pas encore les trajets, il n'y a simplement rien à montrer.
 */
export async function listSessions(
  fetchImpl: typeof fetch = fetch,
): Promise<SessionEntry[]> {
  const headers = { Accept: 'application/json' }

  let listing: unknown
  try {
    const response = await fetchImpl('/sessions/', { headers })
    if (!response.ok) return []
    listing = await response.json()
  } catch {
    return []
  }
  if (!Array.isArray(listing)) return []

  return (listing as SessionDistante[]).flatMap((brute) => {
    const entry = sessionEntryOf(brute)
    return entry === null ? [] : [entry]
  })
}

function sessionEntryOf(brute: SessionDistante): SessionEntry | null {
  const key = brute.cle
  if (typeof key !== 'string' || key === '') return null

  const files = (brute.tranches ?? []).flatMap((tranche) =>
    typeof tranche.nom === 'string' && tranche.nom !== ''
      ? [{ name: tranche.nom, kind: tranche.dossier === 'journal' ? ('journal' as const) : ('capture' as const) }]
      : [],
  )
  if (files.length === 0) return null

  const isolated = brute.isole === true
  return {
    key,
    // L'identifiant de session pour un trajet, le nom du fichier pour un dépôt
    // seul : dans les deux cas, ce qui le désigne pour un humain.
    id: isolated ? (files[0]?.name ?? key) : key.slice(key.lastIndexOf('_') + 1),
    startedAt: typeof brute.enregistreLe === 'number' ? brute.enregistreLe : 0,
    files,
    bytes: typeof brute.octets === 'number' ? brute.octets : 0,
    isolated,
    pending: typeof brute.aVoir === 'number' ? brute.aVoir : 0,
    exemption:
      brute.exemption === 'epingle' || brute.exemption === 'archive' ? brute.exemption : null,
  }
}

/**
 * Durée minimale d'une session, lue sur le seul nombre de ses tranches.
 *
 * Choisir quel trajet relire demande sa durée, et elle n'était connue qu'une
 * fois la session chargée — trop tard pour choisir. La capture découpe au temps,
 * une tranche toutes les cinq minutes : `n` tranches veulent donc dire que le
 * trajet a duré au moins `(n - 1)` fois cinq minutes, la dernière pouvant être
 * partielle. C'est une **borne basse**, jamais une estimation : elle se lit sans
 * ouvrir un fichier, et elle ne ment pas.
 *
 * Rend `null` pour une session sans capture — celles des 8, 9 et 10 septembre
 * 2026 n'ont que leur journal, qui découpe à la taille et non au temps.
 */
export function atLeastDurationMs(entry: SessionEntry): number | null {
  const tranches = entry.files.filter((file) => file.kind === 'capture').length
  if (tranches === 0) return null
  return (tranches - 1) * SLICE_AFTER_MS
}

/**
 * Charge une session : tire ses fichiers et les assemble.
 *
 * Un fichier illisible est laissé de côté plutôt que d'emporter la session : on
 * relit un trajet pour comprendre ce qui s'y est passé, et une moitié de trajet
 * répond souvent à la question.
 */
export async function loadSession(
  entry: SessionEntry,
  fetchImpl: typeof fetch = fetch,
  onProgress?: (done: number, total: number) => void,
): Promise<{ session: Session; failures: string[] }> {
  const failures: string[] = []
  let done = 0

  // Ensemble, et non l'un après l'autre : une session du 9 septembre porte
  // seize tranches, et seize allers-retours en série sur un partage lent se
  // comptent en secondes. L'ordre est rendu par le rang, à l'assemblage.
  const lus = await Promise.all(
    entry.files.map(async (file): Promise<SessionFile | null> => {
      const folder = file.kind === 'journal' ? '/journal/' : '/traces/'
      try {
        const response = await fetchImpl(folder + encodeURIComponent(file.name))
        if (!response.ok) {
          failures.push(`${file.name} (${response.status})`)
          return null
        }
        return { name: file.name, kind: file.kind, text: await readBody(response, file.name) }
      } catch {
        failures.push(`${file.name} (injoignable)`)
        return null
      } finally {
        done += 1
        onProgress?.(done, entry.files.length)
      }
    }),
  )

  const files = lus.filter((file): file is SessionFile => file !== null)

  return { session: buildSession(entry.id, entry.startedAt, files), failures }
}

/**
 * Le contenu d'un fichier, décompressé s'il l'était.
 *
 * Le serveur ne dit pas toujours qu'un `.gz` en est un : nginx sert ce qu'il a,
 * et le type qu'il annonce dépend de sa configuration. Le nom, lui, est sûr —
 * c'est l'application qui l'a écrit.
 */
async function readBody(response: Response, name: string): Promise<string> {
  if (!name.endsWith('.gz')) return await response.text()
  return await gunzip(await response.blob())
}
