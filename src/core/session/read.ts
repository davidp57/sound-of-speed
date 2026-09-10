import { authHeader, hasCredentials, type DepositCredentials } from '../upload/put'
import { gunzip } from '../upload/compress'
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
  const files: SessionFile[] = []
  let done = 0

  for (const file of entry.files) {
    const folder = file.kind === 'journal' ? '/journal/' : '/traces/'
    try {
      const response = await fetchImpl(folder + encodeURIComponent(file.name), { headers })
      if (!response.ok) {
        failures.push(`${file.name} (${response.status})`)
        continue
      }
      files.push({ name: file.name, kind: file.kind, text: await readBody(response, file.name) })
    } catch {
      failures.push(`${file.name} (injoignable)`)
    } finally {
      done += 1
      onProgress?.(done, entry.files.length)
    }
  }

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
