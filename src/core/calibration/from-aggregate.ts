import { otsuSplit } from './braking'
import { overridesFor, type Override } from './onboard'
import {
  recentDepartures,
  recentPlateaus,
  recentSignal,
  recentSlowdowns,
  type CarAggregate,
} from './aggregate'
import type { StepAnalysis } from './analyze'
import type { Plateau, TraceMeasure } from './measure'
import type { CalibrationStepId } from './protocol'
import type { Profile } from '../preset/schema'

/**
 * Ce que la voiture mesurée impose au profil, depuis l'agrégat.
 *
 * **Aucune formule n'est réécrite ici.** Les règles de conversion — le milieu
 * entre deux décélérations, le dixième centile des durées de palier, les
 * quantiles pondérés qui donnent les seuils de passage — vivent dans
 * `suggest.ts`, sont éprouvées, et portent chacune la raison de son choix. Deux
 * jeux de formules pour une même grandeur finiraient par diverger, et c'est le
 * défaut que ce dépôt a rencontré le plus souvent.
 *
 * Ce module fait donc une seule chose : présenter ce que l'agrégat sait sous la
 * forme que `suggest` attend. C'est possible parce que `suggest` ne lit d'une
 * mesure que **sept champs** — cadence, bruit, crêtes, vitesse pratiquée,
 * paliers, départs — et jamais le signal lui-même.
 *
 * Ce que cette présentation a d'artificiel est assumé et nommé : le protocole
 * range ses mesures par étape parce qu'un conducteur les a enregistrées une par
 * une ; ici il n'y a pas d'étapes, seulement des moments reconnus dans des
 * trajets ordinaires. On reconstitue donc les étapes que le protocole aurait
 * obtenues, à partir de ce qu'on a vraiment vu.
 */

/** Une mesure réduite à ce que `suggest` en lit. Le reste est inerte. */
function measureOf(over: Partial<TraceMeasure>): TraceMeasure {
  return {
    count: 0,
    durationS: 0,
    cadenceMs: 0,
    noiseKmh: null,
    points: [],
    minKmh: 0,
    maxKmh: 0,
    practicedMaxKmh: 0,
    peakAccelMs2: null,
    peakDecelMs2: null,
    plateaus: [],
    departureKmh: [],
    ...over,
  }
}

function step(id: CalibrationStepId, measure: TraceMeasure): StepAnalysis {
  return {
    step: id,
    traceName: 'profil de la voiture',
    traceStartedAt: 0,
    measure,
    valid: true,
    reason: '',
  }
}

/** La vitesse la plus haute qu'un lot de paliers porte. */
function topOf(plateaus: readonly Plateau[]): number {
  return plateaus.reduce((top, plateau) => Math.max(top, plateau.kmh), 0)
}

/**
 * Reconstitue les six étapes du protocole à partir de l'agrégat.
 *
 * Rend `null` quand la séparation des ralentissements manque : sans elle, deux
 * des six étapes n'existent pas, et un étalonnage ne s'applique qu'entier — une
 * seule mesure absente et les bornes proposées amputeraient le signal.
 */
export function stepsFromAggregate(aggregate: CarAggregate): StepAnalysis[] | null {
  const split = otsuSplit(recentSlowdowns(aggregate))
  if (split === null) return null

  const plateaus = recentPlateaus(aggregate)
  const signal = recentSignal(aggregate)
  const departures = recentDepartures(aggregate)

  // Le bruit et la cadence n'entrent que par une étape, et ils s'y prennent
  // ensemble : c'est la plus rapide que `suggest` retiendra, et c'est celle qui
  // sépare le mieux le bruit du mouvement.
  const highway = measureOf({
    plateaus: plateaus.highway,
    practicedMaxKmh: aggregate.capabilities.practicedMaxKmh,
    ...(signal === null ? {} : { cadenceMs: signal.cadenceMs, noiseKmh: signal.noiseKmh }),
  })

  return [
    // Les départs arrêtés vivent sur l'étape de ville, comme dans le protocole :
    // c'est là qu'on part de l'arrêt.
    step(
      'city',
      measureOf({
        plateaus: plateaus.city,
        practicedMaxKmh: topOf(plateaus.city),
        departureKmh: departures,
      }),
    ),
    step(
      'road',
      measureOf({ plateaus: plateaus.road, practicedMaxKmh: topOf(plateaus.road) }),
    ),
    step('highway', highway),
    // La reprise porte la plus forte mise de gaz vue : c'est ce que le
    // protocole demande d'enregistrer, et ce que les trajets ordinaires
    // donnent sans qu'on le demande.
    step('launch', measureOf({ peakAccelMs2: aggregate.capabilities.pushPeakMs2 })),
    // Les deux façons de ralentir, telles que la distribution les sépare. Ce
    // sont des moyennes de groupe et non des crêtes : c'est ce qui les rend
    // comparables entre elles, et c'est leur milieu que le seuil de
    // rétrogradage retiendra.
    step('coast', measureOf({ peakDecelMs2: split.coastMs2 })),
    step(
      'brake',
      measureOf({
        peakDecelMs2: Math.min(split.brakeMs2, aggregate.capabilities.slowdownPeakMs2 ?? 0),
      }),
    ),
  ]
}

/**
 * Ce que la voiture mesurée impose au profil donné.
 *
 * Vide quand l'agrégat n'a pas de quoi conclure — c'est `overridesFor` qui le
 * décide, sur les mêmes règles que l'étalonnage guidé.
 */
export function overridesFromAggregate(profile: Profile, aggregate: CarAggregate): Override[] {
  const steps = stepsFromAggregate(aggregate)
  return steps === null ? [] : overridesFor(profile, steps)
}
