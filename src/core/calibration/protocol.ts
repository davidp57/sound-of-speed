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

export type CalibrationStepId = 'launch' | 'coast' | 'brake'

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

/**
 * Le lever de pied ne se juge pas sur sa force, et c'est délibéré.
 *
 * On ne peut pas savoir si le frein a été touché : rien dans une trace GPS ne le
 * dit. Poser un plafond de décélération pour refuser un « lever de pied trop
 * fort » se retournerait contre la voiture qu'on mesure — une électrique récupère
 * au lever de pied, et peut dépasser à elle seule ce qu'on aurait cru être la
 * marque d'un freinage. Le critère porte donc seulement sur l'existence de la
 * manœuvre : de la vitesse au départ, du temps, et de la vitesse perdue.
 *
 * Ce que l'on croyait pouvoir refuser ici est refusé plus loin, et mieux : si les
 * deux étapes rendent la même décélération, aucune frontière n'est proposée, et
 * la raison est dite.
 */
export const COAST_START_KMH = 50
/** Vitesse minimale perdue pendant le lever de pied, en km/h. */
export const COAST_LOSS_KMH = 15
/** Durée minimale du lever de pied, en secondes. */
export const COAST_MIN_S = 5
/** Décélération en deçà de laquelle rien ne s'est passé, en m/s². */
export const COAST_MIN_DECEL_MS2 = -0.3

/** Vitesse minimale au début d'un freinage franc, en km/h. */
export const BRAKE_START_KMH = 40
/**
 * Décélération minimale d'un freinage franc, en m/s².
 *
 * Deux mètres par seconde carré, c'est un cinquième de g : bien en dessous de ce
 * qu'une voiture de série fait sur le sec, et assez haut pour qu'un ralentissement
 * mou ne passe pas pour un freinage.
 */
export const BRAKE_MIN_DECEL_MS2 = -2

/**
 * Écart minimal entre lever de pied et freinage pour qu'une frontière ait un
 * sens, en m/s².
 *
 * Le seuil de rétrogradage au freinage se place **entre** les deux. Si les deux
 * mesures se touchent, il n'y a pas d'entre-deux : proposer une valeur reviendrait
 * à inventer une frontière là où la voiture n'en fait pas.
 */
export const DOWNSHIFT_SEPARATION_MS2 = 0.5

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
  {
    id: 'coast',
    label: 'Décélération pied levé',
    instruction:
      'À vitesse stabilisée, au-dessus de 50 km/h, lancez l’enregistrement puis ' +
      'levez le pied — sans toucher au frein — jusqu’à perdre au moins 15 km/h.',
    criterion:
      `Départ au-dessus de ${COAST_START_KMH} km/h, ${COAST_LOSS_KMH} km/h perdus ` +
      `au minimum, et ${COAST_MIN_S} s d’enregistrement. Aucun plafond de ` +
      'décélération : une électrique récupère au lever de pied, et rien dans une ' +
      'trace ne dit si le frein a servi.',
    informs:
      'Avec le freinage, la frontière au-dessous de laquelle la boîte rétrograde ' +
      'pour ralentir, et la borne basse de l’accélération.',
  },
  {
    id: 'brake',
    label: 'Freinage franc',
    instruction:
      'Au-dessus de 40 km/h, sur une route dégagée, lancez l’enregistrement puis ' +
      'freinez franchement. Arrêtez l’enregistrement une fois ralenti.',
    criterion:
      `Départ au-dessus de ${BRAKE_START_KMH} km/h et une décélération soutenue ` +
      `d’au moins ${Math.abs(BRAKE_MIN_DECEL_MS2).toFixed(1)} m/s². Un ralentissement ` +
      'mou n’est pas un freinage franc.',
    informs:
      'La frontière de rétrogradage au freinage, et la borne basse de l’accélération.',
  },
]

export function findStep(id: CalibrationStepId): CalibrationStep | undefined {
  return CALIBRATION_STEPS.find((step) => step.id === id)
}
