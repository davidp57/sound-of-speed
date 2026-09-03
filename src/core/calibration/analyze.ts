import {
  LAUNCH_GAIN_KMH,
  LAUNCH_MIN_ACCEL_MS2,
  LAUNCH_MIN_S,
  LAUNCH_START_KMH,
  type CalibrationStepId,
} from './protocol'
import { measureTrace, type TraceMeasure } from './measure'
import type { Trace } from '../speed/replay'

/**
 * Jugement d'une étape : la trace enregistrée vaut-elle ce que l'étape
 * demandait ?
 *
 * Le jugement précède la mesure, et il n'est pas décoratif. Le lot existe parce
 * que `fullLoadAccelMs2` valait 2 m/s² sur le profil Route, choisi par le
 * calcul ; le remplacer par une valeur tirée d'une reprise molle ne corrigerait
 * rien, il donnerait le même défaut avec l'assurance d'une mesure. Une étape
 * refusée ne rend donc aucune valeur, et dit pourquoi.
 */

export interface StepAnalysis {
  step: CalibrationStepId
  /** Nom de la trace analysée, pour la retrouver dans la liste. */
  traceName: string
  /** Horodatage de la trace, qui l'identifie. */
  traceStartedAt: number
  measure: TraceMeasure
  valid: boolean
  /** Ce qui manque, en clair. Vide quand l'étape est valide. */
  reason: string
}

export function analyzeStep(step: CalibrationStepId, trace: Trace): StepAnalysis {
  const measure = measureTrace(trace)
  const { valid, reason } = judge(step, measure)
  return {
    step,
    traceName: trace.name,
    traceStartedAt: trace.startedAt,
    measure,
    valid,
    reason,
  }
}

function judge(step: CalibrationStepId, measure: TraceMeasure): {
  valid: boolean
  reason: string
} {
  switch (step) {
    case 'launch':
      return judgeLaunch(measure)
    default:
      return { valid: false, reason: 'Étape inconnue.' }
  }
}

/**
 * Trois conditions, et la troisième est celle qui compte.
 *
 * Partir de l'arrêt et gagner de la vitesse ne font que garantir qu'il y a
 * quelque chose à mesurer. C'est le seuil d'accélération qui décide qu'on a bien
 * appuyé — et c'est lui qui protège la charge d'être calée sur une reprise
 * ordinaire.
 */
function judgeLaunch(measure: TraceMeasure): { valid: boolean; reason: string } {
  if (measure.count < 2) {
    return { valid: false, reason: 'Trace vide ou trop courte pour être mesurée.' }
  }
  if (measure.durationS < LAUNCH_MIN_S) {
    return {
      valid: false,
      reason:
        `L’enregistrement ne dure que ${measure.durationS.toFixed(1)} s, ` +
        `il en faut ${LAUNCH_MIN_S}.`,
    }
  }

  const start = measure.points[0]?.kmh ?? 0
  if (start > LAUNCH_START_KMH) {
    return {
      valid: false,
      reason:
        // Une décimale : arrondi à l'unité, un départ refusé à 3,4 km/h
        // s'afficherait « commence à 3 km/h » alors que la limite est 3.
        `L’enregistrement commence à ${start.toFixed(1)} km/h : l’étape doit ` +
        'partir de l’arrêt.',
    }
  }

  const gain = measure.maxKmh - measure.minKmh
  if (gain < LAUNCH_GAIN_KMH) {
    return {
      valid: false,
      reason:
        `Seulement ${gain.toFixed(0)} km/h gagnés, il en faut ${LAUNCH_GAIN_KMH}.`,
    }
  }

  const peak = measure.peakAccelMs2
  if (peak === null) {
    return { valid: false, reason: 'Aucune accélération n’a pu être mesurée.' }
  }
  if (peak < LAUNCH_MIN_ACCEL_MS2) {
    return {
      valid: false,
      reason:
        `L’accélération soutenue n’atteint que ${peak.toFixed(2)} m/s², il en ` +
        `faut ${LAUNCH_MIN_ACCEL_MS2.toFixed(1)}. Ce n’est pas une reprise franche : ` +
        'la retenir donnerait une charge pleine trop tôt.',
    }
  }

  return { valid: true, reason: '' }
}
