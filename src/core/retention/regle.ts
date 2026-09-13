/**
 * La règle de rétention : ce qui part, ce qui reste, et pourquoi.
 *
 * Elle ne touche à rien. Elle prend l'état des trajets et rend un verdict — les
 * trajets qui partiraient, ceux qui restent avec la raison qui les retient. Ce
 * qui efface l'applique ; il ne la recalcule pas autrement, sinon la règle qu'on
 * a relue ne serait pas celle qui efface.
 *
 * **Pourquoi elle vit dans le cœur.** Aucun contrôle ne dira qu'un délai est
 * mauvais : un seuil trop court efface des données et rien ne rougit. La seule
 * façon de le savoir est de regarder le verdict avant, à l'écran, sur les vraies
 * données — donc le même calcul doit être lisible des deux côtés.
 */

/** Ce qui exempte un trajet de l'effacement. */
export type Exemption = 'epingle' | 'archive'

/** Un trajet, réduit à ce dont la règle a besoin pour décider. */
export interface TrajetJuge {
  cle: string
  /** Un dépôt seul, au nom libre d'avant la convention. */
  isole: boolean
  /** Quand le trajet a été enregistré, en millisecondes. */
  enregistreLe: number
  octets: number
  tranches: number
  /** Tranches de trace, et tranches de journal. */
  traces: number
  journal: number
  /** Tranches de trace que le profileur n'a pas encore regardées. */
  aVoir: number
  exemption: Exemption | null
}

/** Pourquoi un trajet reste. */
export type Retenue = 'épinglé' | 'archivé' | 'pas encore analysé' | 'trop récent'

export interface TrajetRetenu extends TrajetJuge {
  raison: Retenue
}

export interface Verdict {
  /** Ce qui partirait, du plus ancien au plus récent. */
  aEffacer: TrajetJuge[]
  /** Ce qui resterait, et ce qui le retient. */
  retenus: TrajetRetenu[]
  /** Ce que l'effacement rendrait, en octets. */
  octets: number
}

/**
 * Les délais, en jours.
 *
 * **Ces chiffres sont proposés, pas mesurés.** Ils sont réglables pour être
 * corrigés sans livrer, et écrits ici pour être discutés.
 *
 * Trente jours pour une trace : le relecteur sert à revoir un trajet qu'on a
 * encore en tête, et un mois laisse le temps de télécharger ce qu'on garde.
 * Quatorze pour un journal seul : le délai entre « ça a fait quelque chose de
 * bizarre » et le moment où on va voir.
 */
export interface Delais {
  traces: number
  journal: number
}

export const DELAIS_PAR_DEFAUT: Delais = { traces: 30, journal: 14 }

const UN_JOUR = 24 * 60 * 60 * 1000

/**
 * Le verdict, sans rien effacer.
 *
 * Un trajet part quand **toutes** ces conditions tiennent : sa date
 * d'enregistrement est plus vieille que son délai, le profileur l'a traité, et
 * il n'est ni épinglé ni archivé.
 *
 * **Le journal d'un trajet qui a une trace suit sa trace**, et part avec elle.
 * Deux délais stricts couperaient un trajet en deux : à vingt jours on relirait
 * un trajet ayant perdu ses faits marquants. C'est le journal **seul** qui prend
 * le délai court.
 */
export function verdictDeRetention(
  trajets: readonly TrajetJuge[],
  maintenant: number,
  delais: Delais = DELAIS_PAR_DEFAUT,
): Verdict {
  const aEffacer: TrajetJuge[] = []
  const retenus: TrajetRetenu[] = []

  for (const trajet of trajets) {
    const raison = raisonDeRetenir(trajet, maintenant, delais)
    if (raison === null) aEffacer.push(trajet)
    else retenus.push({ ...trajet, raison })
  }

  aEffacer.sort((a, b) => a.enregistreLe - b.enregistreLe)
  retenus.sort((a, b) => b.enregistreLe - a.enregistreLe)

  return {
    aEffacer,
    retenus,
    octets: aEffacer.reduce((somme, trajet) => somme + trajet.octets, 0),
  }
}

/** Ce qui retient ce trajet, ou rien s'il peut partir. */
function raisonDeRetenir(trajet: TrajetJuge, maintenant: number, delais: Delais): Retenue | null {
  if (trajet.exemption === 'archive') return 'archivé'
  if (trajet.exemption === 'epingle') return 'épinglé'

  // On n'efface pas ce qu'on n'a pas encore lu : garder ce que les trajets
  // montrent suppose de les avoir regardés. Sans cette condition, une trace
  // arrivée pendant un arrêt du serveur serait effacée sans avoir rien appris.
  if (trajet.aVoir > 0) return 'pas encore analysé'

  const delai = (trajet.traces > 0 ? delais.traces : delais.journal) * UN_JOUR
  if (maintenant - trajet.enregistreLe < delai) return 'trop récent'

  return null
}
