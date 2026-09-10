/**
 * La vraie voiture, celle dans laquelle on roule.
 *
 * Les six réglages du signal de vitesse — la raideur du lissage, la fenêtre
 * d'accélération, la vitesse plausible, la précision acceptée et les deux bornes
 * d'accélération — ne décrivent ni un moteur, ni une boîte, ni un goût. Ils
 * décrivent **le récepteur GPS de la voiture et sa façon de bouger**. Ils
 * n'avaient donc rien à faire dans un profil de son : changer de voix faisait
 * changer la mesure, et l'étalonnage d'un trajet n'informait qu'un profil sur
 * les cinq.
 *
 * C'est David qui l'a formulé, en arbitrant le relevé des réglages :
 *
 * > tous les params « signal de vitesse » sont liés au profil de la voiture (la
 * > vraie) — donc valeurs par défaut en atelier, potentiellement adaptées avec
 * > le profil « voiture réelle » quand il est disponible
 *
 * **Il n'y en a qu'une.** C'est ce qui la distingue des quatre autres groupes de
 * réglages : on ne choisit pas sa vraie voiture comme on choisit un V8, c'est
 * celle qu'on a. Elle appartient donc à l'appareil — et plus tard au compte —,
 * jamais à un profil, et un profil reçu de quelqu'un d'autre ne l'écrase pas.
 *
 * Sa forme est celle que le conditionnement attend déjà : un `SpeedPreset`, plus
 * le modèle quand on le connaît. Rien à convertir entre les deux.
 */

import type { SpeedPreset } from './schema'

export interface RealCar extends SpeedPreset {
  /**
   * Modèle de la voiture, quand on le sait.
   *
   * Informatif pour l'instant : il n'entre dans aucun calcul. Il existe parce
   * que ces valeurs se choisiront un jour dans un catalogue de modèles, ou se
   * mesureront en roulant, et qu'il faudra alors savoir de quelle voiture on
   * parle.
   */
  model?: string
}

/**
 * Ce qu'on suppose d'une voiture qu'on n'a pas encore mesurée.
 *
 * Ces valeurs sont celles que les deux profils livrés portaient — elles ont
 * roulé, et rien ne justifie de les changer en les déplaçant. La précision
 * acceptée reste large exprès : aucune valeur n'a été relevée dans la voiture,
 * et un seuil serré écarterait des positions valables.
 */
export const DEFAULT_REAL_CAR: RealCar = {
  springOmega: 14,
  accelWindowMs: 1000,
  maxPlausibleKmh: 260,
  // Deux cent cinquante mètres, la valeur des profils livrés : large exprès,
  // faute d'un relevé dans la voiture. C'est un garde-fou contre une position
  // obtenue sans satellites, pas un réglage de précision.
  maxAccuracyM: 250,
  minAccelMs2: -14,
  maxAccelMs2: 14,
}

/**
 * Ramène chaque valeur dans son domaine.
 *
 * Les bornes sont celles des curseurs de l'écran, et elles servent surtout à
 * refuser ce qui rendrait la mesure inexploitable : une fenêtre d'accélération
 * nulle, une raideur négative, des bornes d'accélération inversées.
 */
export function clampRealCar(car: Partial<RealCar> | undefined): RealCar {
  const lu = { ...DEFAULT_REAL_CAR, ...(car ?? {}) }
  const nombre = (valeur: unknown, defaut: number): number =>
    typeof valeur === 'number' && Number.isFinite(valeur) ? valeur : defaut

  const borne = (valeur: number, min: number, max: number): number =>
    Math.min(max, Math.max(min, valeur))

  const propre: RealCar = {
    springOmega: borne(nombre(lu.springOmega, 14), 1, 60),
    accelWindowMs: borne(nombre(lu.accelWindowMs, 1000), 100, 4000),
    maxPlausibleKmh: borne(nombre(lu.maxPlausibleKmh, 260), 30, 500),
    maxAccuracyM: borne(nombre(lu.maxAccuracyM, 250), 1, 5000),
    // Les deux bornes ne se croisent pas : une décélération maximale positive,
    // ou une accélération maximale négative, arrêterait tout net le signal.
    minAccelMs2: borne(nombre(lu.minAccelMs2, -14), -50, -0.5),
    maxAccelMs2: borne(nombre(lu.maxAccelMs2, 14), 0.5, 50),
  }
  if (typeof lu.model === 'string' && lu.model.trim()) propre.model = lu.model.trim()
  return propre
}

/**
 * La voiture que décrivaient les réglages d'un profil.
 *
 * Sert une fois, à la reprise : les profils enregistrés portent ces six valeurs,
 * et c'est d'eux qu'il faut les tenir plutôt que d'imposer les valeurs d'usine à
 * quelqu'un qui avait réglé les siennes.
 */
export function realCarFromProfile(profile: { speed?: Partial<SpeedPreset> }): RealCar {
  return clampRealCar(profile.speed)
}
