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
  /**
   * Régime de passage, en tours par minute, rapport par rapport.
   *
   * Une entrée par passage : la première vaut pour 1 → 2, la deuxième pour
   * 2 → 3, et ainsi de suite. Le dernier rapport n'en a pas besoin.
   *
   * Un seuil unique exprimé en fraction du rupteur, comme il en existait un
   * auparavant, ne peut pas convenir : le baisser assez pour que les premiers
   * rapports ne montent pas jusqu'au rupteur fait passer les rapports longs
   * beaucoup trop bas. Ce sont deux besoins distincts, ils demandent deux
   * réglages distincts.
   *
   * Les valeurs sont données à charge moyenne ; `upshiftLoadSpreadRpm` les
   * décale selon l'effort demandé.
   */
  upshiftRpm: number[]
  /**
   * De combien le régime de passage s'écarte, en tours par minute, entre le pied
   * levé et le pied au plancher.
   *
   * C'est ce qui distingue une conduite tranquille, où l'on monte tôt sur un
   * rapport long, d'une accélération franche qui étire chaque rapport.
   */
  upshiftLoadSpreadRpm: number
  /**
   * Amplitude du tirage au sort appliqué à chaque passage, en tours par minute.
   *
   * Une boîte qui passe exactement au même régime à chaque fois s'entend comme
   * une machine. Quelques dizaines de tours de dispersion suffisent à lever
   * cette impression.
   */
  upshiftJitterRpm: number
  /**
   * Régime au-dessous duquel la boîte ne monte jamais un rapport, quelle que
   * soit la charge.
   *
   * Sans ce plancher, l'écart de charge fait plonger les seuils pied levé — un
   * passage à mille huit cents tours, qu'aucune boîte réelle ne ferait. Et comme
   * le rétrogradage est refusé tant que le rapport inférieur dépasserait son
   * propre seuil de montée, un seuil effondré revient à s'interdire de
   * rétrograder : on restait sur le dernier rapport bien plus longtemps qu'il
   * n'est naturel.
   */
  minUpshiftRpm: number
  /** Fraction du rupteur sous laquelle elle redescend. */
  downshiftAtRedlineRatio: number
  /**
   * La première ne sert qu'à s'élancer.
   *
   * Sur une automatique, elle n'est qu'une amorce : on passe la seconde presque
   * aussitôt et l'on n'y revient pas, l'arrêt se faisant depuis la seconde.
   * Garder la première comme un rapport ordinaire donne un moteur qui monte dans
   * les tours au pas, puis rétrograde à chaque ralentissement.
   */
  firstGearLaunchOnly: boolean
  /** Vitesse au-delà de laquelle la première cède la place, en km/h. */
  launchUpshiftKmh: number
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
  /**
   * Gain propre aux couches « pied levé ».
   *
   * Les prises en décélération sont enregistrées bien plus doucement que celles
   * en charge — trois fois moins fort sur le jeu de test. Sans compensation, le
   * son s'éteint presque dès qu'on lève le pied, alors qu'une voiture reste
   * bruyante en roue libre.
   */
  offLoadGain: number
  /**
   * Contraste entre en charge et pied levé, de 0 à 1.
   *
   * À un, le fondu va d'un extrême à l'autre. Plus bas, les deux familles se
   * mélangent en permanence : l'écart s'entend moins, et le moteur ne disparaît
   * jamais complètement.
   */
  loadContrast: number
  /** Régime au-dessus duquel le ralenti s'efface complètement. */
  idleFadeOutRpm: number
  /** Coupe-bas de sortie, en hertz. */
  highpassHz: number
  /** Saturation douce de sortie, de 0 (aucune) à 1. */
  drive: number
  /** Seuil du limiteur de sortie, en décibels. */
  limiterThresholdDb: number
}

/**
 * Comportements qui tiennent moins de la mécanique que du caractère : ce qu'une
 * voiture fait ressentir, et qu'on remarque surtout par son absence.
 */
export interface FeelPreset {
  /**
   * Rétrogradage forcé quand on enfonce l'accélérateur.
   *
   * Sans lui, écraser la pédale sur un rapport long ne produit qu'une lente
   * montée en régime : la boîte attend son seuil de passage au lieu d'aller
   * chercher du couple là où il est.
   */
  kickdown: {
    enabled: boolean
    /** Charge à partir de laquelle la demande est jugée franche, de 0 à 1. */
    loadThreshold: number
    /** Régime visé après rétrogradage, en fraction du rupteur. */
    targetRpmFraction: number
    /** Nombre maximal de rapports descendus d'un coup. */
    maxGears: number
  }
  /**
   * Pétarade à la décélération : le claquement à l'échappement quand on lève le
   * pied à haut régime.
   */
  backfire: {
    enabled: boolean
    /** Régime en deçà duquel il ne se produit pas. */
    minRpm: number
    /** Volume des claquements, de 0 à 1. */
    intensity: number
    /** Nombre de claquements par salve. */
    count: number
  }
  /**
   * À-coup au passage de rapport : la coupure de couple, puis la reprise.
   * Zéro donne une boîte parfaitement lisse, ce qu'aucune n'est.
   */
  shiftJolt: {
    enabled: boolean
    /** Profondeur du creux de niveau pendant la coupure, de 0 à 1. */
    depth: number
  }
}

export interface Profile {
  /** Identifiant stable, généré à la création. */
  id: string
  name: string
  /**
   * Épinglé sur l'écran de conduite.
   *
   * Changer de voix en roulant ne doit pas obliger à traverser l'écran de
   * configuration : les profils marqués ainsi apparaissent en accès direct.
   */
  favorite: boolean
  /** Dossier d'échantillons, relatif à la racine des assets. */
  sampleDir: string
  engine: EnginePreset
  drivetrain: DrivetrainPreset
  speed: SpeedPreset
  mix: MixPreset
  feel: FeelPreset
  layers: LayerPreset[]
}

/** Version du format, pour pouvoir migrer un profil exporté plus tard. */
export const PROFILE_FORMAT_VERSION = 1

export interface ProfileFile {
  version: number
  profile: Profile
}
