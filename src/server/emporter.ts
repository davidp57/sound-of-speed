/**
 * Emporter tout ce qu'un compte porte, en une archive.
 *
 * **Avant de supprimer, et pas après.** Supprimer emporte tout et ne se défait
 * pas ; l'écran propose donc de prendre ses affaires à ce moment-là. Mais ce
 * geste vaut aussi pour lui-même : ce sont vos réglages, vos trajets et vos
 * mesures, et rien ne doit vous obliger à passer par nous pour les relire.
 *
 * **Un fichier, pas deux cents.** La plus grosse base connue porte quatre-vingt-
 * quatorze dépôts pour un seul compte ; rendre autant de téléchargements ne
 * serait pas une porte de sortie. C'est le même raisonnement que l'archive d'un
 * trajet, et c'est le même outil.
 *
 * **En flux, et lu pièce par pièce** : un compte chargé n'a pas à tenir en
 * mémoire entière.
 *
 * **Le navigateur de la voiture refuse les téléchargements.** C'est un fait
 * constaté, et c'est la raison d'être de la remontée au serveur. Ce module rend
 * donc un flux ; c'est à l'écran de dire, sur un appareil qui ne sait pas le
 * recevoir, qu'il faut faire cela depuis un poste de travail.
 */

import { zipStream, type ZipEntry } from '../core/archive/zip'
import type { Base } from './base/base'
import { DOSSIERS, lireDepot, listerDepots } from './depots'
import { REGISTRES, lireEntite, listerEntites } from './entites'
import { lireProfilMesure } from './profil-mesure'
import { lireProfil, listerProfils } from './profils'

/**
 * Tout ce qu'un compte porte, prêt à descendre.
 *
 * L'arborescence de l'archive est celle du serveur — `profiles/`, `engines/`,
 * `gearboxes/`, `traces/`, `journal/`, `mesures/` —, et c'est délibéré : ce qui
 * en sort se reverse tel quel dans une installation neuve, sans avoir à deviner
 * quel fichier allait où.
 */
export function archiveDuCompte(
  base: Base,
  compte: string,
  maintenant = new Date(),
): { nom: string; flux: ReadableStream<Uint8Array> } {
  async function* entrees(): AsyncGenerator<ZipEntry> {
    for (const entree of await listerProfils(base, compte)) {
      const contenu = await lireProfil(base, compte, entree.name)
      if (contenu === null) continue
      yield { name: `profiles/${entree.name}`, bytes: enOctets(contenu), at: quand(entree.mtime) }
    }

    for (const registre of REGISTRES) {
      for (const entree of await listerEntites(base, registre, compte)) {
        const contenu = await lireEntite(base, registre, compte, entree.name)
        if (contenu === null) continue
        yield {
          name: `${registre}/${entree.name}`,
          bytes: enOctets(contenu),
          at: quand(entree.mtime),
        }
      }
    }

    for (const dossier of DOSSIERS) {
      for (const entree of await listerDepots(base, compte, dossier)) {
        const octets = await lireDepot(base, compte, dossier, entree.name)
        // Un dépôt disparu entre le listage et la lecture : l'archive porte ce
        // qui reste. C'est déjà ce que fait l'archive d'un trajet.
        if (octets === null) continue
        yield {
          // Les octets tels qu'ils ont été déposés : les tranches sont déjà
          // compressées, et ce qui ressort doit être ce qui était monté.
          name: `${dossier}/${entree.name}`,
          bytes: new Uint8Array(octets),
          at: quand(entree.mtime),
        }
      }
    }

    // Le profil mesuré n'a pas de dossier sur le serveur : il est rendu sous
    // `/mesure-voiture/`, au singulier, et il n'y en a qu'un par compte.
    const mesure = await lireProfilMesure(base, compte)
    if (mesure !== null) {
      yield { name: 'mesure-voiture.json', bytes: enOctets(mesure), at: maintenant.getTime() }
    }
  }

  return { nom: nomDArchive(maintenant), flux: zipStream(entrees()) }
}

/**
 * Le nom du fichier qui descend.
 *
 * La date du jour, cette fois, et non celle d'un contenu : ce qu'on emporte est
 * un état, pris à un instant.
 */
function nomDArchive(maintenant: Date): string {
  const quand = maintenant.toISOString().slice(0, 19).replace(/[:T]/g, '-')
  return `sound-of-speed-${quand}.zip`
}

function enOctets(texte: string): Uint8Array {
  return new TextEncoder().encode(texte)
}

/** Une date de listage en millisecondes, ou l'instant présent quand elle manque. */
function quand(mtime: string | undefined): number {
  const lue = mtime === undefined ? Number.NaN : Date.parse(mtime)
  return Number.isFinite(lue) ? lue : Date.now()
}
