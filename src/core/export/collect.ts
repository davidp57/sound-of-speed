/**
 * Ramasser sur le serveur tout ce que la voiture y a déposé.
 *
 * Le navigateur de la voiture ne télécharge rien : ce qu'elle produit ne
 * ressort que par le dépôt sur le serveur, où il s'accumule sans qu'on puisse
 * le reprendre autrement qu'en ouvrant le gestionnaire de fichiers du NAS. Un
 * téléphone, lui, télécharge. Cette page-ci liste les quatre dossiers, tire les
 * fichiers et les rend en un paquet unique — le geste que David voulait faire
 * depuis son téléphone pour rapatrier un essai.
 *
 * Rien de neuf côté serveur : nginx sait déjà rendre le contenu d'un dossier en
 * JSON, ce dont la bibliothèque de profils se sert depuis le lot BANQUES, et la
 * lecture des quatre dossiers est fermée par le même compte de dépôt.
 *
 * Ce module ne connaît ni Vue ni le format ZIP : il rend des noms et des
 * octets. L'assemblage est dans `zip.ts`, l'enregistrement du fichier dans
 * l'écran qui l'appelle.
 */

import type { ZipEntry } from './zip'

/**
 * Les quatre dossiers que la voiture alimente.
 *
 * `profiles/` en fait partie bien qu'il ne vienne pas de la voiture : un
 * paquet censé tout emporter qui laisserait les profils derrière lui obligerait
 * à un second geste, et c'est le geste qu'on cherche à éviter.
 */
export const ARCHIVE_FOLDERS = ['/journal/', '/traces/', '/mesures/', '/profiles/'] as const

/** Entrée du listage JSON produit par nginx. */
interface AutoIndexEntry {
  name?: string
  type?: string
}

/** Ce que le ramassage a obtenu, et ce qu'il a manqué. */
export interface ArchiveResult {
  entries: ZipEntry[]
  /**
   * Ce qui n'a pas pu être lu, dossier ou fichier.
   *
   * Rendu plutôt que jeté : un paquet incomplet reste utile, mais il ne doit
   * pas se faire passer pour complet. L'écran le dit, et David sait alors si
   * son essai est dedans.
   */
  failures: string[]
  /** Taille totale des entrées, en octets. */
  bytes: number
}

/** Avancement, pour que seize fichiers ne ressemblent pas à un écran figé. */
export type ArchiveProgress = (done: number, total: number, current: string) => void

/**
 * Ramasse les quatre dossiers.
 *
 * Les fichiers d'un même dossier sont tirés en parallèle, les dossiers en
 * série : sur un téléphone en réseau mobile, lancer cinquante requêtes d'un coup
 * ralentit tout au lieu d'accélérer.
 */
export async function collectArchive(
  fetchImpl: typeof fetch = fetch,
  onProgress?: ArchiveProgress,
): Promise<ArchiveResult> {
  const listes: { folder: string; names: string[] }[] = []
  const failures: string[] = []

  for (const folder of ARCHIVE_FOLDERS) {
    try {
      const response = await fetchImpl(folder, {
        headers: { Accept: 'application/json' },
      })
      // Un dossier absent n'est pas une anomalie : ils naissent au premier
      // dépôt, et personne n'a forcément déposé de trace.
      if (!response.ok) {
        if (response.status !== 404) failures.push(`${folder} (${response.status})`)
        continue
      }
      // Le décodage a son propre filet : sans lui, un dossier qui répond du
      // charabia se signalait comme « injoignable », alors qu'il a répondu.
      // Un message de diagnostic faux envoie chercher la panne au mauvais
      // endroit.
      let listing: unknown
      try {
        listing = await response.json()
      } catch {
        failures.push(`${folder} (listage illisible)`)
        continue
      }
      if (!Array.isArray(listing)) {
        failures.push(`${folder} (listage illisible)`)
        continue
      }
      listes.push({
        folder,
        names: (listing as AutoIndexEntry[])
          .filter((entry) => entry.type !== 'directory')
          .map((entry) => entry.name ?? '')
          .filter((name) => name !== ''),
      })
    } catch {
      failures.push(`${folder} (injoignable)`)
    }
  }

  const total = listes.reduce((somme, liste) => somme + liste.names.length, 0)
  const entries: ZipEntry[] = []
  let done = 0

  for (const { folder, names } of listes) {
    const lus = await Promise.all(
      names.map(async (name) => {
        try {
          const response = await fetchImpl(folder + encodeURIComponent(name))
          if (!response.ok) {
            failures.push(`${folder}${name} (${response.status})`)
            return null
          }
          const bytes = new Uint8Array(await response.arrayBuffer())
          return { path: folder + name, bytes }
        } catch {
          // Un fichier illisible ne doit pas emporter tout le paquet.
          failures.push(`${folder}${name} (injoignable)`)
          return null
        } finally {
          done += 1
          onProgress?.(done, total, folder + name)
        }
      }),
    )
    for (const entree of lus) if (entree !== null) entries.push(entree)
  }

  return { entries, failures, bytes: entries.reduce((somme, e) => somme + e.bytes.length, 0) }
}

/**
 * Nom du fichier proposé au téléchargement.
 *
 * Horodaté à la seconde : on en récupère plusieurs au fil des essais, et deux
 * paquets du même jour ne doivent pas se recouvrir dans le dossier de
 * téléchargement du téléphone.
 */
export function archiveName(now = new Date()): string {
  const deux = (n: number) => String(n).padStart(2, '0')
  const horodatage = [
    now.getFullYear(),
    deux(now.getMonth() + 1),
    deux(now.getDate()),
    deux(now.getHours()),
    deux(now.getMinutes()),
    deux(now.getSeconds()),
  ].join('')
  return `speed-donnees-${horodatage}.zip`
}
