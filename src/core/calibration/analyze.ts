import {
  BRAKE_MIN_DECEL_MS2,
  BRAKE_START_KMH,
  COAST_LOSS_KMH,
  COAST_MIN_DECEL_MS2,
  COAST_MIN_S,
  COAST_START_KMH,
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
    case 'coast':
      return judgeCoast(measure)
    case 'brake':
      return judgeBrake(measure)
    default:
      return { valid: false, reason: 'Étape inconnue.' }
  }
}

/** Trop court, trop lent, ou vide : les refus qui valent pour toutes les étapes. */
function judgeCommon(
  measure: TraceMeasure,
  minDurationS: number,
): { valid: boolean; reason: string } | null {
  if (measure.count < 2) {
    return { valid: false, reason: 'Trace vide ou trop courte pour être mesurée.' }
  }
  if (measure.durationS < minDurationS) {
    return {
      valid: false,
      reason:
        `L’enregistrement ne dure que ${measure.durationS.toFixed(1)} s, ` +
        `il en faut ${minDurationS}.`,
    }
  }
  return null
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
  const common = judgeCommon(measure, LAUNCH_MIN_S)
  if (common) return common

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

/**
 * Le lever de pied : on vérifie qu'il a eu lieu, pas qu'il a été doux.
 *
 * Aucun plafond de décélération. Une électrique récupère au lever de pied, ce
 * qui rapproche les deux cas au lieu de les séparer : refuser un lever de pied
 * « trop fort » reviendrait à refuser cette voiture-là. Ce que le plafond aurait
 * dû protéger est protégé au moment de proposer la frontière — si les deux
 * étapes se touchent, aucune frontière n'est proposée.
 */
function judgeCoast(measure: TraceMeasure): { valid: boolean; reason: string } {
  const common = judgeCommon(measure, COAST_MIN_S)
  if (common) return common

  const start = measure.points[0]?.kmh ?? 0
  if (start < COAST_START_KMH) {
    return {
      valid: false,
      reason:
        `L’enregistrement commence à ${start.toFixed(0)} km/h : il faut partir ` +
        `d’au moins ${COAST_START_KMH} km/h pour avoir de quoi ralentir.`,
    }
  }

  const lost = measure.maxKmh - measure.minKmh
  if (lost < COAST_LOSS_KMH) {
    return {
      valid: false,
      reason: `Seulement ${lost.toFixed(0)} km/h perdus, il en faut ${COAST_LOSS_KMH}.`,
    }
  }

  const peak = measure.peakDecelMs2
  if (peak === null || peak > COAST_MIN_DECEL_MS2) {
    return {
      valid: false,
      reason:
        'Aucun ralentissement franc dans la trace : la vitesse est restée tenue ' +
        'ou l’enregistrement couvre autre chose.',
    }
  }

  return { valid: true, reason: '' }
}

/** Le freinage, lui, se juge sur sa force : c'est tout ce qui le distingue. */
function judgeBrake(measure: TraceMeasure): { valid: boolean; reason: string } {
  const common = judgeCommon(measure, LAUNCH_MIN_S)
  if (common) return common

  const start = measure.points[0]?.kmh ?? 0
  if (start < BRAKE_START_KMH) {
    return {
      valid: false,
      reason:
        `L’enregistrement commence à ${start.toFixed(0)} km/h : il faut partir ` +
        `d’au moins ${BRAKE_START_KMH} km/h.`,
    }
  }

  const peak = measure.peakDecelMs2
  if (peak === null) {
    return { valid: false, reason: 'Aucune décélération n’a pu être mesurée.' }
  }
  if (peak > BRAKE_MIN_DECEL_MS2) {
    return {
      valid: false,
      reason:
        `La décélération soutenue n’atteint que ${Math.abs(peak).toFixed(2)} m/s², ` +
        `il en faut ${Math.abs(BRAKE_MIN_DECEL_MS2).toFixed(1)}. Ce n’est pas un ` +
        'freinage franc : la retenir effacerait la frontière avec le lever de pied.',
    }
  }

  return { valid: true, reason: '' }
}
