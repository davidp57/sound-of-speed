import { CALIBRATION_STEPS, type CalibrationStepId } from './protocol'
import type { CarDecision } from './measured-car'

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

/**
 * Ce que le conducteur a répondu à une proposition de profil mesuré.
 *
 * Rangé à part de la session d'étalonnage : ce sont deux choses différentes —
 * l'une est un protocole qu'on déroule, l'autre une proposition qu'on accepte —
 * et les mêler ferait qu'effacer l'un effacerait l'autre.
 */
const DECISION_KEY = 'speed.measuredCar.v1'

export function loadCarDecision(): CarDecision | null {
  try {
    const raw = localStorage.getItem(DECISION_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    const decision = parsed as Partial<CarDecision>
    if (decision.answer !== 'accepted' && decision.answer !== 'later') return null
    if (typeof decision.forUpdatedAt !== 'number') return null
    return { answer: decision.answer, forUpdatedAt: decision.forUpdatedAt }
  } catch {
    return null
  }
}

export function saveCarDecision(decision: CarDecision): boolean {
  try {
    localStorage.setItem(DECISION_KEY, JSON.stringify(decision))
    return true
  } catch {
    // Le stockage local peut être plein ou refusé. Le profil reste appliqué
    // pour cette session ; c'est la mémoire du choix qui manque, pas le choix.
    return false
  }
}
