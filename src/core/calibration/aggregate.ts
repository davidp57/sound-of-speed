import { measureTrace } from './measure'
import { segmentsOf, type Regime } from './segments'
import { splitBraking } from './braking'
import type { Plateau } from './measure'
import type { Trace } from '../speed/replay'

/**
 * Ce que la voiture a montré d'elle, cumulé trajet après trajet.
 *
 * Le serveur recalcule à chaque tranche déposée, soit une douzaine de fois par
 * trajet. Relire l'historique entier à chaque fois tient aujourd'hui et ne
 * tiendra pas dans six mois : l'agrégat garde de quoi répondre sans les données
 * brutes, et une tranche neuve s'y ajoute au lieu de le refaire.
 *
 * **Deux familles, deux portées**, et c'est la décision qui structure cette
 * pièce :
 *
 * | Famille | Ce que c'est | Sur quoi |
 * |---|---|---|
 * | capacités | ce que la voiture **peut** | tout l'historique |
 * | habitudes | ce qu'on **fait** | les derniers trajets |
 *
 * Une capacité démontrée une fois reste vraie même si on ne la redemande pas :
 * la prendre sur une fenêtre glissante ferait « oublier » à la voiture ce
 * qu'elle sait faire après trois mois de conduite calme, et la charge pleine
 * arriverait trop tôt. Une habitude, elle, change — un déménagement déplace les
 * seuils de passage.
 *
 * Les capacités se cumulent par leurs extrêmes, donc sans garder d'historique :
 * c'est ce qui rend l'ajout vraiment incrémental. Les habitudes demandent la
 * distribution, donc les trajets récents sont gardés entiers.
 */

/** La version du procédé qui a produit un agrégat. */
export const PROCEDURE_VERSION = 1

/** Combien de trajets font « les derniers », pour les habitudes. */
export const RECENT_TRIPS = 20

/** Ce qu'un trajet apporte, une fois mesuré. */
export interface TripDigest {
  /** Identifiant de la session, tel que la capture le porte. */
  tripId: string
  /** Début du trajet, en millisecondes. Sert à ordonner, pas à mesurer. */
  at: number
  durationS: number
  /** Ce que la voiture a montré pouvoir faire, sur ce trajet. */
  peakAccelMs2: number | null
  peakDecelMs2: number | null
  practicedMaxKmh: number
  noiseKmh: number | null
  cadenceMs: number
  /** Ce qu'on a fait de la voiture, sur ce trajet. */
  plateaus: Record<Regime, Plateau[]>
  departureKmh: number[]
  /** Crêtes des ralentissements retenus, pour la distribution. */
  slowdownPeaks: number[]
}

/** Les capacités, telles qu'elles se cumulent sans historique. */
export interface Capabilities {
  peakAccelMs2: number | null
  peakDecelMs2: number | null
  practicedMaxKmh: number
  /** La plus basse cadence observée : c'est elle qui contraint la mesure. */
  cadenceMs: number | null
  /** Le bruit le plus fort observé : une borne haute, pas une moyenne. */
  noiseKmh: number | null
}

export interface CarAggregate {
  procedure: number
  /** Nombre de trajets vus depuis le début, y compris ceux qu'on ne garde plus. */
  tripCount: number
  capabilities: Capabilities
  /** Les derniers trajets, gardés entiers pour les habitudes. */
  recent: TripDigest[]
}

export function emptyAggregate(): CarAggregate {
  return {
    procedure: PROCEDURE_VERSION,
    tripCount: 0,
    capabilities: {
      peakAccelMs2: null,
      peakDecelMs2: null,
      practicedMaxKmh: 0,
      cadenceMs: null,
      noiseKmh: null,
    },
    recent: [],
  }
}

/** Mesure un trajet et le réduit à ce que l'agrégat en gardera. */
export function digestOf(tripId: string, trace: Trace): TripDigest {
  const measure = measureTrace(trace)
  const segments = segmentsOf(trace)
  const braking = splitBraking(measure.points)

  // La crête d'accélération vient des mises de gaz, pas du trajet entier : sur
  // une conduite ordinaire, le centile d'ensemble est noyé par la croisière et
  // rend une voiture bien plus molle qu'elle n'est.
  const pushes = segments.pushes.map((p) => p.peakAccelMs2)

  return {
    tripId,
    at: trace.startedAt,
    durationS: measure.durationS,
    peakAccelMs2: pushes.length > 0 ? Math.max(...pushes) : measure.peakAccelMs2,
    peakDecelMs2:
      braking.slowdowns.length > 0
        ? Math.min(...braking.slowdowns.map((s) => s.peakDecelMs2))
        : measure.peakDecelMs2,
    practicedMaxKmh: measure.practicedMaxKmh,
    noiseKmh: measure.noiseKmh,
    cadenceMs: measure.cadenceMs,
    plateaus: segments.plateaus,
    departureKmh: segments.departureKmh,
    slowdownPeaks: braking.slowdowns.map((s) => s.peakDecelMs2),
  }
}

/**
 * Ajoute ou remplace ce qu'un trajet apporte.
 *
 * **Remplace**, et c'est le point : le serveur recalcule à chaque tranche, donc
 * le même trajet revient une douzaine de fois, un peu plus long à chaque fois.
 * Un ajout en ferait douze trajets ; un remplacement en fait un, de mieux en
 * mieux connu. Ne sont relues que les tranches du trajet en cours.
 *
 * Les capacités, elles, ne se retirent pas. Si un trajet remplacé avait montré
 * une accélération plus forte que sa version révisée, la capacité reste : la
 * voiture l'a bien démontrée. C'est la contrepartie assumée d'un cumul sans
 * historique, et elle va dans le bon sens — on ne perd pas ce qu'on a vu.
 */
export function withTrip(aggregate: CarAggregate, digest: TripDigest): CarAggregate {
  const known = aggregate.recent.some((trip) => trip.tripId === digest.tripId)
  const recent = [...aggregate.recent.filter((trip) => trip.tripId !== digest.tripId), digest]
    .sort((a, b) => a.at - b.at)
    .slice(-RECENT_TRIPS)

  return {
    procedure: aggregate.procedure,
    tripCount: known ? aggregate.tripCount : aggregate.tripCount + 1,
    capabilities: withDigest(aggregate.capabilities, digest),
    recent,
  }
}

/** Les capacités, une fois ce trajet pris en compte. */
function withDigest(capabilities: Capabilities, digest: TripDigest): Capabilities {
  return {
    peakAccelMs2: strongest(capabilities.peakAccelMs2, digest.peakAccelMs2, Math.max),
    peakDecelMs2: strongest(capabilities.peakDecelMs2, digest.peakDecelMs2, Math.min),
    practicedMaxKmh: Math.max(capabilities.practicedMaxKmh, digest.practicedMaxKmh),
    // La cadence la plus lente et le bruit le plus fort : ce sont des
    // contraintes, et une contrainte se prend au pire cas rencontré.
    cadenceMs: strongest(capabilities.cadenceMs, digest.cadenceMs, Math.max),
    noiseKmh: strongest(capabilities.noiseKmh, digest.noiseKmh, Math.max),
  }
}

function strongest(
  current: number | null,
  candidate: number | null,
  pick: (a: number, b: number) => number,
): number | null {
  if (candidate === null) return current
  if (current === null) return candidate
  return pick(current, candidate)
}

/**
 * Faut-il tout relire ?
 *
 * Un agrégat construit avec un procédé corrigé ne vaut plus rien : ses
 * capacités ont été cumulées sans retour possible. La version le dit, et le
 * recalcul complet se déclenche dessus plutôt qu'à la main.
 */
export function needsRebuild(aggregate: CarAggregate): boolean {
  return aggregate.procedure !== PROCEDURE_VERSION
}

/** Les vitesses tenues des derniers trajets, réunies par régime. */
export function recentPlateaus(aggregate: CarAggregate): Record<Regime, Plateau[]> {
  const merged: Record<Regime, Plateau[]> = { city: [], road: [], highway: [] }
  for (const trip of aggregate.recent) {
    merged.city.push(...trip.plateaus.city)
    merged.road.push(...trip.plateaus.road)
    merged.highway.push(...trip.plateaus.highway)
  }
  return merged
}

/** Les départs arrêtés des derniers trajets. */
export function recentDepartures(aggregate: CarAggregate): number[] {
  return aggregate.recent.flatMap((trip) => trip.departureKmh)
}

/** Les crêtes de ralentissement des derniers trajets. */
export function recentSlowdowns(aggregate: CarAggregate): number[] {
  return aggregate.recent.flatMap((trip) => trip.slowdownPeaks)
}
