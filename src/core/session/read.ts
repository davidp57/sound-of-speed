import { authHeader, hasCredentials, type DepositCredentials } from '../upload/put'
import { gunzip } from '../upload/compress'
import { SLICE_AFTER_MS } from '../upload/slicing'
import { buildSession, sessionKeyOf, type Session, type SessionFile } from './model'

/**
 * Retrouver les sessions déposées sur le serveur.
 *
 * Les deux dossiers sont lus : `journal/` raconte, `traces/` rejoue, et une
 * session peut n'avoir que l'un des deux — celles d'avant la capture continue
 * n'ont que leur journal.
 *
 * **La lecture s'annonce.** Les dossiers ne se lisent plus sans mot de passe
 * depuis le 10 septembre 2026 ; sans compte, la liste est vide plutôt qu'en
 * erreur, ce qui est le cas normal d'un appareil qui n'en a pas.
 *
 * `fetch` est injecté pour que tout ceci se vérifie sans réseau ni serveur.
 */

const FOLDERS = [
  { path: '/journal/', kind: 'journal' as const },
  { path: '/traces/', kind: 'capture' as const },
]

/** Entrée du listage JSON produit par nginx. */
interface AutoIndexEntry {
  name?: string
  type?: string
}

/** Une session repérée sur le serveur, sans son contenu. */
export interface SessionEntry {
  key: string
  id: string
  startedAt: number
  files: { name: string; kind: 'journal' | 'capture' }[]
}

/**
 * Les sessions du serveur, la plus récente en tête.
 *
 * Les fichiers qui ne suivent pas la convention de nommage sont ignorés : le
 * dossier des traces contient encore les enregistrements manuels d'avant, qui
 * portent un nom libre et ne se recollent pas en tranches.
 */
export async function listSessions(
  credentials: DepositCredentials,
  fetchImpl: typeof fetch = fetch,
): Promise<SessionEntry[]> {
  if (!hasCredentials(credentials)) return []
  const headers = { Accept: 'application/json', Authorization: authHeader(credentials) }

  const sessions = new Map<string, SessionEntry>()

  for (const folder of FOLDERS) {
    let listing: unknown
    try {
      const response = await fetchImpl(folder.path, { headers })
      // Un dossier absent n'est pas une anomalie : ils naissent au premier dépôt.
      if (!response.ok) continue
      listing = await response.json()
    } catch {
      continue
    }
    if (!Array.isArray(listing)) continue

    for (const entry of listing as AutoIndexEntry[]) {
      const name = entry.name ?? ''
      if (entry.type === 'directory' || name === '') continue
      const clé = sessionKeyOf(name)
      if (clé === null) continue

      const trouvée = sessions.get(clé.key) ?? {
        key: clé.key,
        id: clé.key.slice(clé.key.lastIndexOf('_') + 1),
        startedAt: clé.startedAt,
        files: [],
      }
      trouvée.files.push({ name, kind: folder.kind })
      sessions.set(clé.key, trouvée)
    }
  }

  return [...sessions.values()].sort((a, b) => b.startedAt - a.startedAt)
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
  credentials: DepositCredentials,
  fetchImpl: typeof fetch = fetch,
  onProgress?: (done: number, total: number) => void,
): Promise<{ session: Session; failures: string[] }> {
  const headers = { Authorization: authHeader(credentials) }
  const failures: string[] = []
  let done = 0

  // Ensemble, et non l'un après l'autre : une session du 9 septembre porte
  // seize tranches, et seize allers-retours en série sur un partage lent se
  // comptent en secondes. L'ordre est rendu par le rang, à l'assemblage.
  const lus = await Promise.all(
    entry.files.map(async (file): Promise<SessionFile | null> => {
      const folder = file.kind === 'journal' ? '/journal/' : '/traces/'
      try {
        const response = await fetchImpl(folder + encodeURIComponent(file.name), { headers })
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
