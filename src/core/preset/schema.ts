/**
 * Schéma d'un profil.
 *
 * Un profil est l'unité complète de configuration : tout ce qui influence le son
 * y est déclaré, rien n'est codé en dur ailleurs. Il est sérialisable en JSON,
 * donc sauvegardable, exportable et rechargeable tel quel.
 */

/** Rôle d'une couche dans le mixage. */
export type LayerRole = 'idle' | 'on' | 'off' | 'limiter'

export interface LayerPreset {
  /** Identifiant stable, sert de clé dans l'éditeur. */
  key: string
  /** Chemin du fichier, relatif au dossier d'échantillons. Remplaçable. */
  file: string
  role: LayerRole
  /** Régime auquel l'échantillon a été enregistré. Détermine le repitch. */
  anchorRpm: number
  /** Gain propre à la couche, avant le mixage. */
  gain: number
  /**
   * Bornes du facteur de lecture. Au-delà d'environ une octave l'étirement
   * devient audible (voix de canard vers le haut, grondement pâteux vers le bas).
   */
  minRate: number
  maxRate: number
  /** Une couche désactivée reste dans le profil mais ne joue pas. */
  enabled: boolean
}

export interface EnginePreset {
  /** Nombre de cylindres : fixe la fréquence d'allumage (rpm / 120 × cylindres). */
  cylinders: number
  idleRpm: number
  /** Régime où la coupure commence à mordre. */
  softLimitRpm: number
  /** Rupteur dur : le régime n'ira jamais au-delà. */
  redlineRpm: number
  /** Durée d'une coupure d'allumage au rupteur, en millisecondes. */
  limiterHoldMs: number
  /**
   * Inertie du volant moteur. Plus la valeur est haute, plus le régime met de
   * temps à monter quand la roue ne l'entraîne pas (point mort, débrayé).
   */
  inertia: number
  /** Vitesse de montée en régime à pleine charge, hors prise (tr/min par seconde). */
  freeRevRate: number
  /** Vitesse de retombée pied levé, hors prise (tr/min par seconde). */
  engineBraking: number
}

export interface DrivetrainPreset {
  /** Du plus court au plus long. Une seule entrée = prise directe, pas de boîte. */
  gearRatios: number[]
  finalDrive: number
  wheelRadiusM: number
  /** Coupure de couple pendant le passage, en millisecondes. */
  shiftTimeMs: number
  /** Fraction du rupteur à laquelle la boîte auto monte, pied au plancher. */
  upshiftAtRedlineRatio: number
  /**
   * Fraction du rupteur à laquelle elle monte à charge nulle.
   *
   * Sans ce second seuil, la boîte ne monterait qu'au rupteur en toute
   * circonstance et les derniers rapports ne seraient jamais engagés. Or c'est
   * l'inverse qui domine en conduite ordinaire : on roule presque toujours en
   * charge partielle, donc sur un rapport long et à bas régime.
   */
  upshiftAtLowLoadRatio: number
  /** Fraction du rupteur sous laquelle elle redescend. */
  downshiftAtRedlineRatio: number
  /**
   * Temporisation avant montée, en secondes, indexée par rapport engagé.
   * Des valeurs irrégulières évitent la sensation de métronome.
   */
  shiftDelaysS: number[]
}

export interface SpeedPreset {
  /**
   * Raideur du ressort qui lisse la vitesse. Plus c'est haut, plus le suivi est
   * réactif et plus les sauts du GPS s'entendent.
   */
  springOmega: number
  /** Fenêtre de calcul de la pente d'accélération, en millisecondes. */
  accelWindowMs: number
  /** En deçà de cet écart, la variation est considérée comme du bruit GPS. */
  accelDeadbandKmh: number
  /** Toute mesure au-delà est rejetée comme aberrante. */
  maxPlausibleKmh: number
  /** Bornes de l'accélération retenue, en m/s². */
  minAccelMs2: number
  maxAccelMs2: number
}

export interface MixPreset {
  masterGain: number
  /** Régime en dessous duquel seule la couche basse joue. */
  crossfadeLowRpm: number
  /** Régime au-dessus duquel seule la couche haute joue. */
  crossfadeHighRpm: number
  /**
   * Accélération, en m/s², à laquelle la charge est considérée pleine.
   * C'est elle qui arbitre le fondu entre les couches « en charge » et « pied levé ».
   */
  fullLoadAccelMs2: number
  /** Constante de lissage de la charge, en secondes. */
  loadSmoothingS: number
  /** Régime au-dessus duquel le ralenti s'efface complètement. */
  idleFadeOutRpm: number
  /** Coupe-bas de sortie, en hertz. */
  highpassHz: number
  /** Saturation douce de sortie, de 0 (aucune) à 1. */
  drive: number
  /** Seuil du limiteur de sortie, en décibels. */
  limiterThresholdDb: number
}

export interface Profile {
  /** Identifiant stable, généré à la création. */
  id: string
  name: string
  /** Dossier d'échantillons, relatif à la racine des assets. */
  sampleDir: string
  engine: EnginePreset
  drivetrain: DrivetrainPreset
  speed: SpeedPreset
  mix: MixPreset
  layers: LayerPreset[]
}

/** Version du format, pour pouvoir migrer un profil exporté plus tard. */
export const PROFILE_FORMAT_VERSION = 1

export interface ProfileFile {
  version: number
  profile: Profile
}
