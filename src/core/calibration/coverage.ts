import { DOWNSHIFT_SEPARATION_MS2 } from './protocol'
import { recentDepartures, recentPlateaus, recentSlowdowns, type CarAggregate } from './aggregate'
import { otsuSplit } from './braking'

/**
 * Savoir si l'on en sait assez, et dire ce qui manque.
 *
 * **Une couverture, pas un volume.** Quatre cents kilomètres d'autoroute ne
 * disent rien de la ville : ce qui compte n'est pas combien on a roulé mais si
 * chaque mesure a sa matière.
 *
 * C'est la leçon déjà payée, le 4 septembre 2026. Une seule étape enregistrée
 * dans un bouchon à moins de 30 km/h avait porté la vitesse plausible maximale
 * à 40 km/h, et au-delà **tout se figeait** — la vitesse, le régime et le son —
 * sans que rien à l'écran n'en dise la cause. C'est pourquoi un étalonnage ne
 * s'applique qu'entier, et pourquoi celui-ci ne se proposera pas incomplet.
 *
 * Ce qui manque se dit dans les termes du conducteur — « il manque de
 * l'autoroute » —, jamais dans ceux du calcul. Le protocole distingue déjà
 * « non enregistrée » de « refusée » : refaire l'étape, ou la refaire mieux.
 */

/** Une chose à savoir avant de proposer, et où elle en est. */
export interface CoverageItem {
  /** Ce qui manque, dit au conducteur. */
  label: string
  /** Combien on en a. */
  count: number
  /** Combien il en faut. */
  needed: number
  covered: boolean
}

export interface Coverage {
  items: CoverageItem[]
  /** Vrai quand chaque mesure a sa matière. */
  complete: boolean
  /** Ce qui manque, prêt à être lu. Vide quand tout est couvert. */
  missing: string[]
}

/**
 * Ce qu'il faut avoir vu de chaque chose.
 *
 * Des comptes petits, et c'est voulu : il ne s'agit pas d'accumuler mais de
 * s'assurer qu'aucune mesure ne repose sur un seul relevé. Un départ unique
 * peut être un départ en côte ; trois disent une habitude.
 *
 * **Trop petits, peut-être.** Éprouvés sur le trajet du 11 septembre 2026 — une
 * heure et demie, cinquante et un kilomètres —, ils sont tous atteints : 3
 * départs, 39 paliers de ville, 28 de route, 83 d'autoroute, 8 accélérations
 * franches, 115 ralentissements qui se séparent. Un seul trajet suffirait donc à
 * proposer un profil, ce qui est fidèle à la règle qu'on s'est donnée — une
 * couverture, pas un volume — mais laisse toute la mesure reposer sur un matin.
 *
 * Ces nombres sont des points de départ, à régler quand plusieurs trajets seront
 * là, comme le sont la fenêtre des habitudes et le seuil d'alerte.
 */
const NEEDED = {
  departures: 3,
  city: 5,
  road: 5,
  highway: 5,
  pushes: 2,
  slowdowns: 20,
} as const

/**
 * Dresse l'état de ce qu'on sait et de ce qui manque.
 *
 * Les ralentissements ont un critère à part : il ne suffit pas d'en avoir
 * beaucoup, il faut qu'ils se **séparent** en deux façons de ralentir. Sans
 * cette séparation, le seuil de rétrogradage ne se déduit pas, et proposer
 * l'étalonnage sans lui reviendrait à l'appliquer incomplet.
 */
export function coverageOf(aggregate: CarAggregate, pushCount: number): Coverage {
  const plateaus = recentPlateaus(aggregate)
  const departures = recentDepartures(aggregate)
  const slowdowns = recentSlowdowns(aggregate)
  const split = otsuSplit(slowdowns)

  const items: CoverageItem[] = [
    item('des départs à l’arrêt', departures.length, NEEDED.departures),
    item('de la conduite en ville', plateaus.city.length, NEEDED.city),
    item('de la conduite sur route', plateaus.road.length, NEEDED.road),
    item('de la conduite sur autoroute', plateaus.highway.length, NEEDED.highway),
    item('des accélérations franches', pushCount, NEEDED.pushes),
    item('des ralentissements', slowdowns.length, NEEDED.slowdowns),
  ]

  // La séparation est une couverture comme une autre, mais elle ne se compte
  // pas : elle se constate. Elle n'entre dans la liste que si le compte est
  // atteint, sans quoi on dirait deux fois la même chose.
  const enough = slowdowns.length >= NEEDED.slowdowns
  const separated =
    split !== null && split.coastMs2 - split.brakeMs2 >= DOWNSHIFT_SEPARATION_MS2
  if (enough) {
    items.push({
      label: 'des freinages nets, distincts des levers de pied',
      count: separated ? 1 : 0,
      needed: 1,
      covered: separated,
    })
  }

  const missing = items.filter((entry) => !entry.covered).map((entry) => entry.label)
  return { items, complete: missing.length === 0, missing }
}

function item(label: string, count: number, needed: number): CoverageItem {
  return { label, count, needed, covered: count >= needed }
}

/**
 * Ce qu'on dit au conducteur quand il manque quelque chose.
 *
 * Une phrase, pas une liste de comptes : il n'a pas à savoir qu'il faut cinq
 * paliers d'autoroute, seulement qu'il lui manque de l'autoroute.
 */
export function missingSentence(coverage: Coverage): string {
  if (coverage.complete) return ''
  const [first, ...rest] = coverage.missing
  if (rest.length === 0) return `Il manque encore ${first}.`
  if (rest.length === 1) return `Il manque encore ${first} et ${rest[0]}.`
  return `Il manque encore ${first}, ${rest.slice(0, -1).join(', ')} et ${rest[rest.length - 1]}.`
}
