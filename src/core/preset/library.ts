import { fromFile } from './store'
import type { Profile } from './schema'

/**
 * Profils déposés à côté des échantillons, sur le serveur.
 *
 * Le NAS sert déjà un dossier monté depuis ses disques. Y déposer ses exports
 * avec le gestionnaire de fichiers suffit à les retrouver sur tous les
 * appareils : ni compte, ni base, ni service à maintenir — et la protection est
 * celle qui garde déjà l'accès au site.
 *
 * La liste est obtenue de nginx lui-même, qui sait rendre le contenu d'un
 * dossier en JSON. L'écriture reste manuelle : c'est le prix d'un hébergement
 * qui ne fait que servir des fichiers, et cela n'a rien de pénible pour des
 * réglages qu'on ne change pas tous les jours.
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
export async function fetchLibrary(): Promise<LibraryEntry[]> {
  let names: string[]
  try {
    const response = await fetch(LIBRARY_PATH, { headers: { Accept: 'application/json' } })
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
        const response = await fetch(LIBRARY_PATH + encodeURIComponent(file))
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
