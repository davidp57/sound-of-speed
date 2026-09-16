/**
 * La rotation : faire de la place quand elle manque.
 *
 * **Ce n'est pas la rétention, et il faut savoir pourquoi.** La rétention juge
 * sur l'âge : passé le délai, un trajet part. Elle ne libère donc rien quand tout
 * est récent, ce qui est exactement le cas d'une voiture qui roule beaucoup — et
 * c'est là que le plafond mord. La rotation, elle, juge sur la place : le plus
 * ancien part, jusqu'à ce qu'il y en ait assez.
 *
 * **Mais ce qui est protégé se lit au même endroit.** Une épingle veut dire « ce
 * trajet, je le garde », et c'est la seule chose qu'on ne prend à personne pour
 * faire de la place. Les dépôts repris de l'ancien serveur de fichiers, eux,
 * retiennent la rétention — qui juge sur l'âge — mais pas la rotation, qui manque
 * de place : tranché le 15 septembre 2026.
 *
 * Elle ne touche à rien : elle rend ce qui partirait, et ce qui efface l'applique.
 */

import type { TrajetJuge } from './regle'

/**
 * Les trois repères, en part du plafond.
 *
 * **À partir d'où l'on prévient (75 %)**, à partir d'où l'on fait le ménage
 * (95 %), et **jusqu'où l'on descend** (90 %).
 *
 * Le dernier est celui qui demande une explication. Descendre à peine sous le
 * seuil ferait tourner la rotation à chaque dépôt ; descendre très bas
 * emporterait beaucoup d'un coup. À 90 %, sur un plafond de 250 Mio et le débit
 * observé d'une voiture — une tranche de quelques dizaines de kilo-octets toutes
 * les cinq minutes —, un passage libère de quoi tenir une dizaine d'heures de
 * route, et n'emporte que les trajets les plus anciens.
 */
export const SEUIL_D_ALERTE = 0.75
export const SEUIL_DE_ROTATION = 0.95
export const CIBLE_APRES_ROTATION = 0.9

/** Ce que la rotation emporterait, et ce qu'elle laisse. */
export interface Rotation {
  /** Ce qui partirait, du plus ancien au plus récent. */
  aEffacer: TrajetJuge[]
  /** Ce que cela rendrait, en octets. */
  octets: number
  /**
   * Reste-t-il au-delà du plafond une fois tout l'effaçable parti ?
   *
   * **Ce n'est pas la même chose que « tout est épinglé »**, et l'écrire ainsi
   * serait faux : le plafond pèse **tous** les dépôts d'un compte, alors que la
   * rotation ne range que ce qui forme un trajet — les traces et le journal. Un
   * compte alourdi par ses relevés de mesure est donc bloqué sans avoir une seule
   * épingle. Le refus doit dire ce qui est vrai : rien ne peut être libéré
   * automatiquement.
   *
   * Quand c'est vrai, **rien n'est effacé** : perdre des trajets sans repasser
   * sous le plafond serait payer sans rien obtenir.
   */
  bloque: boolean
}

/**
 * Ce qu'il faut effacer pour redescendre, et dans quel ordre.
 *
 * Le plus ancien d'abord. Un trajet épinglé n'est jamais pris, à aucun seuil :
 * il compte dans la place occupée, et un compte qui n'a plus qu'eux reste plein.
 */
export function rotationDeRetention(
  trajets: readonly TrajetJuge[],
  occupe: number,
  plafond: number,
): Rotation {
  const cible = plafond * CIBLE_APRES_ROTATION
  // **Strictement en dessous du seuil, on ne fait rien** — et la comparaison est
  // la même que celle qui annonce l'état, sans quoi le serveur dirait « rotation »
  // sur un dépôt où rien ne tourne.
  if (occupe < plafond * SEUIL_DE_ROTATION) {
    return { aEffacer: [], octets: 0, bloque: false }
  }

  const candidats = [...trajets]
    // Un trajet qui ne pèse rien ne rend rien : le prendre serait l'effacer pour
    // le principe.
    .filter((trajet) => trajet.exemption !== 'epingle' && trajet.octets > 0)
    .sort((a, b) => a.enregistreLe - b.enregistreLe)

  const aEffacer: TrajetJuge[] = []
  let restant = occupe

  for (const trajet of candidats) {
    if (restant <= cible) break
    aEffacer.push(trajet)
    restant -= trajet.octets
  }

  // Ce qui compte pour refuser n'est pas d'avoir atteint la cible — on peut s'en
  // approcher sans l'atteindre et continuer de servir — mais de rester au-dessus
  // du plafond une fois tout l'effaçable parti.
  const bloque = restant > plafond

  // **Bloqué, on n'efface rien.** Emporter tous les trajets non épinglés d'un
  // compte pour rester quand même au-dessus du plafond, c'est payer sans rien
  // obtenir : le dépôt sera refusé de toute façon.
  if (bloque) return { aEffacer: [], octets: 0, bloque: true }

  return {
    aEffacer,
    octets: aEffacer.reduce((somme, trajet) => somme + trajet.octets, 0),
    bloque: false,
  }
}

/** L'état qu'on annonce, pour une place donnée. */
export function etatDeLaPlace(occupe: number, plafond: number): 'libre' | 'bientot' | 'rotation' {
  if (occupe >= plafond * SEUIL_DE_ROTATION) return 'rotation'
  if (occupe >= plafond * SEUIL_D_ALERTE) return 'bientot'
  return 'libre'
}
