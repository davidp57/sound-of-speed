/**
 * Où en est la place du compte, telle que le serveur la dit.
 *
 * **Elle voyage sur la réponse de chaque dépôt**, et c'est ce qui rend l'écran
 * possible sans rien demander : la voiture dépose une tranche toutes les cinq
 * minutes, donc l'information arrive toute seule. Pas de sondage, pas de route à
 * interroger, rien qui coûte du réseau à une application qui en manque.
 *
 * Un serveur qui ne les envoie pas — une version d'avant — rend `null`, et
 * l'écran n'affiche alors rien plutôt que d'inventer.
 */

/** Ce que le serveur annonce, plus l'état que le client seul connaît. */
export type EtatDeLaPlace =
  /** Loin du plafond. */
  | 'libre'
  /** Les trois quarts sont pris. */
  | 'bientot'
  /** Le serveur efface les plus anciens trajets pour faire de la place. */
  | 'rotation'
  /**
   * Le dépôt a été refusé : il ne reste que des trajets épinglés.
   *
   * **Celui-ci ne vient pas d'un en-tête** : le serveur dit la place, et le code
   * de la réponse dit le refus. C'est le client qui les réunit.
   */
  | 'plein'

export interface Place {
  etat: EtatDeLaPlace
  octets: number
  plafond: number
}

/** Les en-têtes, tels que le serveur les pose. */
const ETAT = 'Speed-Place'
const OCTETS = 'Speed-Place-Octets'
const PLAFOND = 'Speed-Place-Plafond'

/**
 * Lit la place dans une réponse, ou rend `null`.
 *
 * `refuse` dit que la réponse portait le refus : l'état devient alors `plein`,
 * quels que soient les chiffres — un compte au-dessus du plafond dont tout est
 * épinglé annonce `rotation`, puisque c'est ce que sa place vaut, mais ce que
 * l'écran doit dire est qu'on ne dépose plus.
 */
export function lirePlace(reponse: Response, refuse = false): Place | null {
  const etat = reponse.headers.get(ETAT)
  const octets = Number(reponse.headers.get(OCTETS))
  const plafond = Number(reponse.headers.get(PLAFOND))

  if (etat === null || !Number.isFinite(octets) || !Number.isFinite(plafond) || plafond <= 0) {
    // Un refus sans en-têtes reste un refus : on le dit sans les chiffres.
    return refuse ? { etat: 'plein', octets: 0, plafond: 0 } : null
  }
  if (refuse) return { etat: 'plein', octets, plafond }
  if (etat !== 'libre' && etat !== 'bientot' && etat !== 'rotation') return null

  return { etat, octets, plafond }
}

/** La part du plafond déjà prise, entre 0 et 1 — pour l'écrire, pas pour décider. */
export function partPrise(place: Place): number {
  if (place.plafond <= 0) return 1
  return Math.min(place.octets / place.plafond, 1)
}
