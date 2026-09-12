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
  /**
   * Ce que la voiture a montré pouvoir faire, sur ce trajet.
   *
   * Ce ne sont **pas** les centiles de `TraceMeasure`, et les noms le disent :
   * ce sont les crêtes des moments reconnus — la plus forte mise de gaz, le plus
   * fort ralentissement. Le centile d'ensemble décrirait une voiture bien plus
   * molle, noyée dans la croisière : mesuré sur le trajet du 11 septembre 2026,
   * 1,15 m/s² contre 3,38.
   *
   * La contrepartie est assumée : une crête retient un accident de mesure là où
   * un centile l'écarte. C'est le découpage en moments qui l'évite — une mise de
   * gaz demande une seconde au-dessus du seuil, un relevé isolé n'en fait pas
   * une.
   */
  pushPeakMs2: number | null
  slowdownPeakMs2: number | null
  practicedMaxKmh: number
  noiseKmh: number | null
  cadenceMs: number
  /** Ce qu'on a fait de la voiture, sur ce trajet. */
  plateaus: Record<Regime, Plateau[]>
  departureKmh: number[]
  /** Combien de mises de gaz franches ce trajet porte. */
  pushCount: number
  /** Crêtes des ralentissements retenus, pour la distribution. */
  slowdownPeaks: number[]
}

/**
 * Les capacités, telles qu'elles se cumulent sans historique.
 *
 * **Ce qui est ici ne peut que croître avec la matière.** C'est ce qui rend le
 * cumul par extrêmes légitime : une crête démontrée reste vraie. Un centile, à
 * l'inverse, **baisse** quand le trajet s'allonge — mesuré le 11 septembre 2026
 * sur un trajet de vingt-cinq secondes à 150 km/h suivi d'une heure à 40 : le
 * cumul de ses tranches rendait 150, le recalcul complet 40.
 *
 * La vitesse pratiquée est donc recalculée depuis les trajets plutôt que
 * cumulée, et la cadence et le bruit n'y sont plus du tout : ce sont des
 * propriétés de l'appareil et de la couverture du jour, pas de la voiture, et
 * les garder à vie épinglerait la mesure sur son pire trajet.
 */
export interface Capabilities {
  pushPeakMs2: number | null
  slowdownPeakMs2: number | null
  practicedMaxKmh: number
}

export interface CarAggregate {
  procedure: number
  /** Nombre de trajets vus depuis le début, y compris ceux qu'on ne garde plus. */
  tripCount: number
  /**
   * Ce que les trajets **sortis de la fenêtre** ont montré.
   *
   * Séparé de ce que montrent les trajets gardés, et c'est ce qui corrige les
   * deux défauts trouvés le 11 septembre. Le garde de remplacement cherchait le
   * trajet dans la fenêtre : un trajet qui n'y était plus était recompté à
   * chaque tranche. Et le cumul par extrêmes gardait d'un trajet une valeur que
   * sa version révisée ne rendait plus.
   *
   * Les trajets gardés, eux, se recalculent entièrement à chaque tour : ils sont
   * vingt, cela ne coûte rien, et cela rend le remplacement exact.
   */
  retired: Capabilities
  /** Identifiants des trajets sortis de la fenêtre, pour ne pas les recompter. */
  retiredIds: string[]
  capabilities: Capabilities
  /** Les derniers trajets, gardés entiers pour les habitudes. */
  recent: TripDigest[]
}

const NO_CAPABILITIES: Capabilities = {
  pushPeakMs2: null,
  slowdownPeakMs2: null,
  practicedMaxKmh: 0,
}

export function emptyAggregate(): CarAggregate {
  return {
    procedure: PROCEDURE_VERSION,
    tripCount: 0,
    retired: { ...NO_CAPABILITIES },
    retiredIds: [],
    capabilities: { ...NO_CAPABILITIES },
    recent: [],
  }
}

/** Mesure un trajet et le réduit à ce que l'agrégat en gardera. */
export function digestOf(tripId: string, trace: Trace): TripDigest {
  // Une seule passe de mesure, partagée : sans cela le trajet est relu deux
  // fois par tranche — pentes, centiles, paliers et départs — dans le module
  // dont la raison d'être est justement de ne pas tout relire.
  const measure = measureTrace(trace)
  const segments = segmentsOf(trace, measure)
  const braking = splitBraking(measure.points)

  const pushes = segments.pushes.map((p) => p.peakAccelMs2)
  const slowdowns = braking.slowdowns.map((s) => s.peakDecelMs2)

  return {
    tripId,
    at: trace.startedAt,
    durationS: measure.durationS,
    pushPeakMs2: pushes.length > 0 ? Math.max(...pushes) : null,
    slowdownPeakMs2: slowdowns.length > 0 ? Math.min(...slowdowns) : null,
    practicedMaxKmh: measure.practicedMaxKmh,
    noiseKmh: measure.noiseKmh,
    cadenceMs: measure.cadenceMs,
    plateaus: segments.plateaus,
    departureKmh: segments.departureKmh,
    pushCount: segments.pushes.length,
    slowdownPeaks: slowdowns,
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
  const kept = [...aggregate.recent.filter((trip) => trip.tripId !== digest.tripId), digest].sort(
    (a, b) => a.at - b.at,
  )
  const recent = kept.slice(-RECENT_TRIPS)
  const evicted = kept.slice(0, -RECENT_TRIPS)

  // Un trajet ne compte qu'une fois, qu'il soit encore dans la fenêtre ou déjà
  // sorti : c'est en cherchant seulement dans la fenêtre que l'agrégat
  // recomptait douze fois un trajet arrivé en retard.
  const known =
    aggregate.recent.some((trip) => trip.tripId === digest.tripId) ||
    aggregate.retiredIds.includes(digest.tripId)

  // Ce qui sort de la fenêtre y laisse ses capacités, définitivement : on ne
  // garde plus de quoi les recalculer.
  let retired = aggregate.retired
  const retiredIds = [...aggregate.retiredIds]
  for (const trip of evicted) {
    retired = withDigest(retired, trip)
    if (!retiredIds.includes(trip.tripId)) retiredIds.push(trip.tripId)
  }

  // Les trajets gardés, eux, se recalculent entièrement. Ils sont vingt : cela
  // ne coûte rien, et c'est ce qui rend un remplacement exact — un trajet révisé
  // à la baisse ne laisse plus derrière lui la valeur de sa version précédente.
  const capabilities = recent.reduce(withDigest, retired)

  return {
    procedure: aggregate.procedure,
    tripCount: known ? aggregate.tripCount : aggregate.tripCount + 1,
    retired,
    retiredIds,
    capabilities,
    recent,
  }
}

/** Les capacités, une fois ce trajet pris en compte. */
function withDigest(capabilities: Capabilities, digest: TripDigest): Capabilities {
  return {
    pushPeakMs2: strongest(capabilities.pushPeakMs2, digest.pushPeakMs2, Math.max),
    slowdownPeakMs2: strongest(capabilities.slowdownPeakMs2, digest.slowdownPeakMs2, Math.min),
    practicedMaxKmh: Math.max(capabilities.practicedMaxKmh, digest.practicedMaxKmh),
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

/**
 * La cadence et le bruit du dernier trajet mesurable.
 *
 * Ce ne sont pas des capacités de la voiture mais des propriétés de l'appareil
 * et de la couverture du jour : les garder sur tout l'historique épinglerait la
 * mesure sur son plus mauvais trajet, sans retour possible.
 *
 * Les deux se prennent **ensemble**, sur le même trajet, parce qu'ils entrent
 * ensemble dans le calcul de la fenêtre d'accélération. Les apparier de deux
 * trajets différents donnerait une fenêtre qui ne vaut pour aucun des deux.
 */
export function recentSignal(aggregate: CarAggregate): { cadenceMs: number; noiseKmh: number } | null {
  for (let i = aggregate.recent.length - 1; i >= 0; i -= 1) {
    const trip = aggregate.recent[i]!
    if (trip.noiseKmh !== null) return { cadenceMs: trip.cadenceMs, noiseKmh: trip.noiseKmh }
  }
  return null
}

/** Combien de mises de gaz franches les derniers trajets portent. */
export function recentPushCount(aggregate: CarAggregate): number {
  return aggregate.recent.reduce((total, trip) => total + trip.pushCount, 0)
}

/** Les crêtes de ralentissement des derniers trajets. */
export function recentSlowdowns(aggregate: CarAggregate): number[] {
  return aggregate.recent.flatMap((trip) => trip.slowdownPeaks)
}
