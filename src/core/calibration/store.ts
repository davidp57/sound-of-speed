import { CALIBRATION_STEPS, type CalibrationStepId } from './protocol'

/**
 * Ce qu'une session d'étalonnage garde d'une fois à l'autre.
 *
 * Uniquement le lien entre une étape et la trace qui l'a enregistrée — pas les
 * mesures. Les traces sont déjà conservées d'une session à l'autre, et
 * réanalyser une trace donne exactement le même chiffre : mémoriser la mesure
 * en plus, c'est se donner deux vérités qui peuvent diverger. La conséquence
 * est que le récapitulatif se relit après un rechargement, et qu'il se
 * recalcule si l'analyse change.
 */

const STORAGE_KEY = 'speed.calibration.v1'

/** Étape → horodatage de la trace qui l'a enregistrée. */
export type CalibrationSession = Partial<Record<CalibrationStepId, number>>

export function loadCalibration(): CalibrationSession {
  let parsed: unknown
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    parsed = JSON.parse(raw)
  } catch {
    return {}
  }
  if (typeof parsed !== 'object' || parsed === null) return {}

  const known = new Set<string>(CALIBRATION_STEPS.map((step) => step.id))
  const session: CalibrationSession = {}
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!known.has(key)) continue
    if (typeof value !== 'number' || !Number.isFinite(value)) continue
    session[key as CalibrationStepId] = value
  }
  return session
}

export function saveCalibration(session: CalibrationSession): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    return true
  } catch {
    // Quota plein ou navigation privée : la session en cours reste utilisable,
    // elle ne survivra simplement pas au rechargement.
    return false
  }
}
