import type { Profile } from '../preset/schema'
import { toFile } from '../preset/store'
import { entityFileName } from './entity'

/**
 * Un profil qui remonte dans la bibliothèque partagée.
 *
 * La bibliothèque est le dossier que l'application lit déjà au démarrage : un
 * profil déposé là se retrouve sur les autres appareils sans lien à transmettre
 * ni fichier à manipuler. C'est tout l'intérêt de le déposer là plutôt qu'à
 * côté.
 *
 * **Le nom est stable**, tiré de l'identifiant du profil : redéposer un profil
 * remplace sa version précédente au lieu d'accumuler des copies datées. C'est
 * une synchronisation, pas un archivage — et un dossier de bibliothèque qui
 * enflerait à chaque curseur déplacé deviendrait illisible.
 */

/** Dossier de la bibliothèque, servi en écriture. Voir `docker/nginx.conf`. */
export const PROFILE_FOLDER = '/profiles/'

/**
 * Nom du fichier d'un profil.
 *
 * Lisible d'abord — on doit reconnaître un profil dans le gestionnaire de
 * fichiers sans l'ouvrir — et stable ensuite, par la fin de l'identifiant. Deux
 * profils portant le même nom ne se recouvrent donc pas.
 */
export function profileFileName(profile: Profile): string {
  // La règle est partagée avec les moteurs et les boîtes, qui remontent de la
  // même façon : la recopier ici la ferait diverger un jour.
  return entityFileName(profile, 'profil')
}

/**
 * Corps du fichier.
 *
 * Le statut de favori est retiré : c'est une préférence de l'appareil qui l'a
 * épinglé, et elle n'a pas à s'imposer à celui qui récupérera le profil. Les
 * valeurs d'origine, elles, suivent — comme dans un fichier exporté, où la
 * taille n'importe pas.
 */
export function profileBody(profile: Profile): string {
  return toFile({ ...profile, favorite: false })
}

/**
 * Identifiant du dépôt.
 *
 * Il porte l'identifiant du profil et rien d'autre : une modification de plus
 * pendant que la précédente attend son tour remplace ce qui attend, au lieu
 * d'ajouter un fichier de plus à envoyer.
 */
export function profileUploadId(profile: Profile): string {
  return `profile:${profile.id}`
}
