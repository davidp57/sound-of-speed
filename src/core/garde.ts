/**
 * La garde : ce qui s'ouvre à l'arrêt, et reste fermé tant qu'on roule.
 *
 * **C'est le troisième axe**, et il ne ressemble pas aux deux autres. Les rôles
 * (`identity/roles.ts`) disent ce que la personne a le droit d'ouvrir ;
 * l'appareil (`appareil.ts`) dit ce qui a un sens là où l'on est ; celui-ci dit
 * ce qui a un sens **maintenant**. Les trois se croisent par un et.
 *
 * **Il ne repose sur aucune devinette.** L'application sait de source sûre d'où
 * vient son chiffre de vitesse. Reconnaître une voiture à la chaîne d'agent du
 * navigateur est un pari que `appareil.ts` annonce lui-même comme non vérifié
 * sur la vraie Tesla : une détection ratée ouvrirait en roulant l'écran que la
 * garde devait fermer.
 *
 * **Il regarde le GPS, jamais la chaîne.** Une garde qui lirait la vitesse
 * produite se fermerait sur elle-même dès qu'on simule 90 km/h — c'est-à-dire
 * exactement quand on règle. Sous simulateur ou rejeu, il n'y a donc pas de
 * garde du tout.
 *
 * Il reste un trou, et il est assumé : quelqu'un installé en voiture qui
 * déclare un poste **et** passe au simulateur échappe à tout. Il n'entend alors
 * plus sa propre vitesse, donc il ne conduit plus avec.
 */

/** Ce qu'il faut d'immobilité avant qu'un écran gardé s'ouvre. */
export const IMMOBILITE_REQUISE_MS = 30_000

/**
 * Ce que la garde retient d'un tour à l'autre.
 *
 * `rien-recu` et « immobile depuis toujours » sont deux états distincts, et
 * c'est le cœur de cette pièce : un poste qui n'a jamais vu une position n'a
 * rien à prouver, alors qu'une voiture qui vient de s'arrêter doit attendre.
 */
export type EtatDeGarde = 'rien-recu' | 'en-mouvement' | { immobileDepuisMs: number }

export const GARDE_AU_DEPART: EtatDeGarde = 'rien-recu'

export interface Releve {
  /** La vitesse vient-elle du GPS ? Sinon rien n'est mesuré ni retenu. */
  auGps: boolean
  /** L'arrêt tel que le conditionneur le voit — la même notion qu'ailleurs. */
  alArret: boolean
  maintenantMs: number
}

/**
 * Le nouvel état, à chaque tour de boucle.
 *
 * Quitter le GPS remet à `rien-recu` plutôt que de figer ce qu'on avait : sans
 * cela, revenir au GPS après avoir simulé une vitesse laisserait la garde
 * croire qu'on roule, et fermerait trente secondes un écran ouvert à l'instant
 * d'avant.
 */
export function observer(etat: EtatDeGarde, releve: Releve): EtatDeGarde {
  if (!releve.auGps) return 'rien-recu'
  if (!releve.alArret) return 'en-mouvement'
  if (typeof etat === 'object') return etat
  return { immobileDepuisMs: releve.maintenantMs }
}

export interface Situation {
  auGps: boolean
  /** L'application produit-elle du son ? Au repos, elle n'en produit pas. */
  enMarche: boolean
  maintenantMs: number
}

/**
 * L'écran gardé est-il ouvert ?
 *
 * Le repos est exigé en plus de l'immobilité, et les deux ne font pas double
 * emploi : un feu rouge de trente secondes donne l'immobilité sans le repos, et
 * rien n'empêche d'appuyer sur « P » en roulant.
 *
 * `rien-recu` ouvre sans attendre. Sans cela, ouvrir cet écran sur un poste neuf
 * ferait patienter une demi-minute pour une voiture qui n'existe pas.
 */
export function ecranOuvert(etat: EtatDeGarde, situation: Situation): boolean {
  if (!situation.auGps) return true
  if (situation.enMarche) return false
  if (etat === 'rien-recu') return true
  if (etat === 'en-mouvement') return false
  return situation.maintenantMs - etat.immobileDepuisMs >= IMMOBILITE_REQUISE_MS
}

/**
 * Ce qu'il reste à attendre, en millisecondes, ou zéro si l'écran est ouvert.
 *
 * Un écran qui dit « disponible uniquement à l'arrêt » sans dire combien de
 * temps laisse croire qu'il ne s'ouvrira jamais.
 */
export function attenteRestanteMs(etat: EtatDeGarde, situation: Situation): number {
  if (ecranOuvert(etat, situation)) return 0
  if (typeof etat !== 'object') return IMMOBILITE_REQUISE_MS
  const attendu = IMMOBILITE_REQUISE_MS - (situation.maintenantMs - etat.immobileDepuisMs)
  return Math.max(0, attendu)
}
