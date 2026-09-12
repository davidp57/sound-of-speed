import { fromFile } from './store'
import type { Profile } from './schema'
import { authHeader, hasCredentials, type DepositCredentials } from '../upload/put'

/**
 * Profils déposés à côté des échantillons, sur le serveur.
 *
 * Le NAS sert déjà un dossier monté depuis ses disques. Y déposer ses exports
 * avec le gestionnaire de fichiers suffit à les retrouver sur tous les
 * appareils : ni compte, ni base, ni service à maintenir — et la protection est
 * celle qui garde déjà l'accès au site.
 *
 * La liste est obtenue de nginx lui-même, qui sait rendre le contenu d'un
 * dossier en JSON.
 *
 * **La lecture demande le compte de dépôt.** Elle ne le demandait pas, et le
 * dossier se listait donc depuis n'importe où — ce qui n'a rien de grave pour
 * des réglages de son, mais le serveur ferme désormais la lecture de ses quatre
 * dossiers d'un bloc : le journal, lui, porte des positions, et une règle qui
 * s'applique à tout se vérifie d'un coup d'œil là où quatre règles différentes
 * se contredisent un jour. Sans compte saisi, la bibliothèque est simplement
 * vide.
 */

/** Emplacement, servi par le même hôte que l'application. */
const LIBRARY_PATH = '/profiles/'

export interface LibraryEntry {
  file: string
  profile: Profile
}

/** Entrée du listage JSON produit par nginx. */
interface AutoIndexEntry {
  name?: string
  type?: string
}

/**
 * Profils disponibles sur le serveur.
 *
 * Retourne une liste vide plutôt qu'une erreur quand le dossier n'existe pas :
 * il est facultatif, et son absence n'a rien d'anormal.
 */
export async function fetchLibrary(
  credentials: DepositCredentials,
  fetchImpl: typeof fetch = fetch,
): Promise<LibraryEntry[]> {
  // Sans compte, la question ne se pose même pas : le serveur répondrait 401, et
  // l'appel coûterait un aller-retour pour une liste vide.
  if (!hasCredentials(credentials)) return []
  const headers = { Accept: 'application/json', Authorization: authHeader(credentials) }

  let names: string[]
  try {
    const response = await fetchImpl(LIBRARY_PATH, { headers })
    if (!response.ok) return []
    const listing: unknown = await response.json()
    if (!Array.isArray(listing)) return []
    names = (listing as AutoIndexEntry[])
      .filter((entry) => entry.type !== 'directory')
      .map((entry) => entry.name ?? '')
      .filter((name) => name.toLowerCase().endsWith('.json'))
  } catch {
    return []
  }

  const loaded = await Promise.all(
    names.map(async (file) => {
      try {
        const response = await fetchImpl(LIBRARY_PATH + encodeURIComponent(file), { headers })
        if (!response.ok) return null
        return { file, profile: fromFile(await response.text()) }
      } catch {
        // Un fichier illisible ne doit pas emporter toute la liste.
        return null
      }
    }),
  )

  return loaded.filter((entry): entry is LibraryEntry => entry !== null)
}
