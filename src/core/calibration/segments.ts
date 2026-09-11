import {
  LAUNCH_GAIN_KMH,
  LAUNCH_MIN_ACCEL_MS2,
  LAUNCH_MIN_S,
  LAUNCH_START_KMH,
  ORDINARY_MIN_TOP_KMH,
} from './protocol'
import { measureTrace } from './measure'
import type { Plateau, TracePoint } from './measure'
import type { Trace } from '../speed/replay'

/**
 * Retrouver dans un trajet ordinaire les moments que le protocole demande.
 *
 * L'étalonnage fait garantir le contexte par le conducteur : « pars de l'arrêt
 * et accélère franchement », « roule une minute en ville ». Personne ne le
 * garantit sur un trajet ordinaire — il faut le reconnaître dans le signal.
 *
 * Les critères ne sont pas réinventés : ce sont ceux de `protocol.ts`, qui
 * disent déjà ce qu'est une accélération franche ou un régime d'autoroute. Ils
 * s'appliquent ici à des morceaux du trajet plutôt qu'à un enregistrement
 * entier.
 *
 * Les **ralentissements** ne sont pas traités ici : distinguer un pied levé
 * d'un freinage ne se fait pas par un critère mais par la forme d'une
 * distribution, et c'est une autre pièce.
 */

/** Un moment reconnu dans le trajet, avec de quoi le retrouver. */
export interface Burst {
  /** Début, en secondes depuis la première mesure — comme un palier. */
  startS: number
  /** Fin, en secondes depuis la première mesure. */
  endS: number
  /** Vitesse au début et à la fin, en km/h. */
  fromKmh: number
  toKmh: number
  /** Accélération la plus forte du moment, en m/s². */
  peakAccelMs2: number
}

/** Les trois régimes de conduite, tels que le protocole les distingue. */
export type Regime = 'city' | 'road' | 'highway'

export interface TripSegments {
  /**
   * Accélérations franches parties de l'arrêt, comme le protocole les demande.
   *
   * Elles disent comment la voiture s'élance, ce qui n'est pas la même chose
   * que ce qu'elle a sous le pied.
   */
  launches: Burst[]
  /**
   * Mises de gaz franches, d'où qu'elles partent.
   *
   * C'est ce qu'il faut pour savoir ce que la voiture peut, et le trajet du
   * 11 septembre 2026 l'a montré : pas une seule accélération n'y partait de
   * l'arrêt au-dessus du seuil — les trois départs relevés montaient à 3 ou
   * 4 km/h en une seconde —, alors que 285 relevés dépassaient 2 m/s², jusqu'à
   * 3,38. Toutes étaient des relances en roulant.
   *
   * Le protocole exigeait le départ arrêté pour **garantir** qu'on mesurait
   * bien une mise des gaz et non une descente. Sur un trajet ordinaire, la
   * garantie vient d'ailleurs : une accélération soutenue au-dessus du seuil ne
   * s'obtient pas en roue libre.
   */
  pushes: Burst[]
  /** Vitesses tenues, rangées par régime de conduite. */
  plateaus: Record<Regime, Plateau[]>
  /** Vitesse atteinte une seconde après chaque départ arrêté, en km/h. */
  departureKmh: number[]
}

/**
 * Le régime auquel une vitesse tenue appartient.
 *
 * Les bornes sont les **planchers** que le protocole exige d'une étape pour
 * l'accepter — cinquante pour la route, quatre-vingt-dix pour l'autoroute. Un
 * palier se range donc au plancher qu'il atteint, et non au régime le plus
 * proche : à quarante-cinq kilomètres-heure on est en ville rapide, et l'appeler
 * route ferait accepter une étape que le protocole aurait refusée.
 *
 * Elles sont basses à dessein : elles distinguent trois façons de conduire,
 * elles ne dictent pas une vitesse.
 */
export function regimeOf(kmh: number): Regime {
  if (kmh >= ORDINARY_MIN_TOP_KMH.highway) return 'highway'
  if (kmh >= ORDINARY_MIN_TOP_KMH.road) return 'road'
  return 'city'
}

/**
 * Découpe un trajet et rend les moments qu'on sait reconnaître.
 *
 * Une **accélération franche** se cherche comme le protocole la juge : partie
 * de moins de trois kilomètres-heure, elle en gagne plus de trente, dure au
 * moins trois secondes et dépasse deux mètres par seconde carrée. La seule
 * différence est qu'on ne demande à personne de la provoquer : on la trouve.
 *
 * Ce qui reste du trajet n'est pas perdu pour autant — les paliers et les
 * départs viennent de la mesure d'ensemble, qui les relève déjà sur toute la
 * durée.
 */
export function segmentsOf(trace: Trace): TripSegments {
  const measure = measureTrace(trace)
  const plateaus: Record<Regime, Plateau[]> = { city: [], road: [], highway: [] }
  for (const plateau of measure.plateaus) plateaus[regimeOf(plateau.kmh)].push(plateau)

  return {
    launches: findLaunches(measure.points),
    pushes: findPushes(measure.points),
    plateaus,
    departureKmh: measure.departureKmh,
  }
}

/**
 * Les accélérations franches du trajet.
 *
 * Une reprise commence quand la voiture quitte l'arrêt et se termine quand elle
 * cesse d'accélérer franchement. On ne retient que celles qui passent les
 * critères du protocole : sans eux, la moindre sortie de feu rouge compterait
 * pour une reprise et la charge pleine arriverait bien trop tôt.
 */
function findLaunches(points: readonly TracePoint[]): Burst[] {
  const bursts: Burst[] = []
  let start: TracePoint | null = null
  let peak = 0
  let slack = 0

  for (let i = 0; i < points.length; i += 1) {
    const point = points[i]!
    const accel = point.accelMs2

    if (start === null) {
      // On ne s'accroche qu'à un départ : sous le seuil de lancement, et en
      // train d'accélérer. C'est ce qui distingue une reprise d'une relance.
      if (point.kmh <= LAUNCH_START_KMH && accel !== null && accel > 0) {
        start = point
        peak = accel
      }
      continue
    }

    if (accel !== null) peak = Math.max(peak, accel)

    // La reprise se termine quand la voiture cesse d'accélérer **et le reste**.
    //
    // Un seul relevé sous zéro ne la ferme pas, et c'est décisif : à dix relevés
    // par seconde, une reprise met près d'une seconde à franchir les trois
    // kilomètres-heure du seuil de départ, soit une dizaine de relevés. Un
    // creux du signal dans cette fenêtre fermait la reprise naissante, et comme
    // la voiture avait alors dépassé le seuil, elle ne se rouvrait plus jamais.
    // Le trajet du 11 septembre 2026 rendait ainsi zéro départ franc, ce qui ne
    // prouvait rien sur la voiture — seulement sur le détecteur.
    slack = accel !== null && accel <= 0 ? slack + 1 : 0
    const ends = slack >= BREAK_TOLERANCE_POINTS
    const last = i === points.length - 1
    if (!ends && !last) continue

    const end = point
    const gain = end.kmh - start.kmh
    const durationS = end.t - start.t
    if (gain >= LAUNCH_GAIN_KMH && durationS >= LAUNCH_MIN_S && peak >= LAUNCH_MIN_ACCEL_MS2) {
      bursts.push({
        startS: start.t,
        endS: end.t,
        fromKmh: start.kmh,
        toKmh: end.kmh,
        peakAccelMs2: peak,
      })
    }
    start = null
    peak = 0
    slack = 0
  }

  return bursts
}

/**
 * Les mises de gaz franches du trajet, d'où qu'elles partent.
 *
 * Une plage où l'accélération se tient au-dessus du seuil du protocole, assez
 * longtemps pour ne pas être un soubresaut de la mesure. On ne demande ni
 * départ arrêté ni gain minimal : ce qu'on cherche ici est ce que la voiture
 * sait faire, pas la façon dont on s'en sert.
 *
 * La durée minimale est courte — une seconde — parce que le critère est déjà
 * exigeant par lui-même : la pente est ajustée sur une fenêtre d'une seconde,
 * donc une seconde au-dessus de deux mètres par seconde carrée représente déjà
 * deux secondes de poussée réelle.
 */
const PUSH_MIN_S = 1

/**
 * Combien de relevés sous zéro ferment une reprise.
 *
 * Trois, soit trois dixièmes de seconde à la cadence de l'appareil : assez pour
 * qu'un creux du signal ne compte pas, trop peu pour qu'un vrai lever de pied
 * passe inaperçu.
 */
const BREAK_TOLERANCE_POINTS = 3

function findPushes(points: readonly TracePoint[]): Burst[] {
  const bursts: Burst[] = []
  let start: TracePoint | null = null
  let peak = 0

  const close = (end: TracePoint): void => {
    if (start === null) return
    if (end.t - start.t >= PUSH_MIN_S) {
      bursts.push({
        startS: start.t,
        endS: end.t,
        fromKmh: start.kmh,
        toKmh: end.kmh,
        peakAccelMs2: peak,
      })
    }
    start = null
    peak = 0
  }

  for (let i = 0; i < points.length; i += 1) {
    const point = points[i]!
    const accel = point.accelMs2
    const pushing = accel !== null && accel >= LAUNCH_MIN_ACCEL_MS2

    if (pushing) {
      if (start === null) start = point
      peak = Math.max(peak, accel)
      if (i === points.length - 1) close(point)
      continue
    }
    close(point)
  }

  return bursts
}
