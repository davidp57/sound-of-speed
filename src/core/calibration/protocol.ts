/**
 * Le protocole d'étalonnage : ce qu'on demande de faire, et à quoi on reconnaît
 * que ça a été fait.
 *
 * Le critère de validité est la pièce importante, et il est annoncé **avant**
 * l'étape. Une « accélération franche » qui n'atteint que 1 m/s² n'en est pas
 * une : l'accepter donnerait une charge pleine à 1 m/s², donc un fondu qui
 * basculerait sur un simple filet de gaz — exactement le défaut que
 * l'étalonnage doit corriger. Un critère qui refuse est donc plus utile qu'une
 * mesure complaisante.
 */

export type CalibrationStepId = 'launch'

export interface CalibrationStep {
  id: CalibrationStepId
  /** Titre court, pour la liste des étapes. */
  label: string
  /** La consigne, à lire avant de démarrer. */
  instruction: string
  /** Le critère de validité, dit avant l'étape et vérifié après. */
  criterion: string
  /** Les réglages que l'étape informe, en clair. */
  informs: string
}

/**
 * Accélération soutenue minimale d'une reprise franche, en m/s².
 *
 * Deux mètres par seconde carré, c'est zéro à cinquante en sept secondes : à la
 * portée de n'importe quelle voiture, et très en dessous de ce qu'une électrique
 * fait sans effort. Le seuil est là pour écarter une reprise molle, pas pour
 * exiger un départ arrêté sur circuit.
 */
export const LAUNCH_MIN_ACCEL_MS2 = 2
/** Vitesse au-delà de laquelle l'étape ne part plus de l'arrêt, en km/h. */
export const LAUNCH_START_KMH = 3
/** Gain de vitesse minimal de l'étape, en km/h. */
export const LAUNCH_GAIN_KMH = 30
/** Durée minimale de l'étape, en secondes. */
export const LAUNCH_MIN_S = 3

export const CALIBRATION_STEPS: CalibrationStep[] = [
  {
    id: 'launch',
    label: 'Accélération franche',
    instruction:
      'À l’arrêt, lancez l’enregistrement, puis accélérez franchement jusqu’à ' +
      '50 km/h au moins. Arrêtez l’enregistrement une fois la vitesse atteinte.',
    criterion:
      `Départ à l’arrêt, ${LAUNCH_GAIN_KMH} km/h gagnés au minimum, et une ` +
      `accélération soutenue d’au moins ${LAUNCH_MIN_ACCEL_MS2.toFixed(1)} m/s². ` +
      'Une reprise plus molle n’est pas une reprise franche : elle serait refusée.',
    informs: 'La charge pleine, donc le volume, le timbre et les seuils de passage.',
  },
]

export function findStep(id: CalibrationStepId): CalibrationStep | undefined {
  return CALIBRATION_STEPS.find((step) => step.id === id)
}
