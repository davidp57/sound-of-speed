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
  /**
   * Amplitude du tremblement de régime, en tours par minute, prise au ralenti et
   * pied levé. Elle décroît ensuite avec le régime et avec la charge.
   *
   * Zéro donne un régime parfaitement lisse, ce qu'aucun moteur thermique n'est :
   * un moteur au ralenti oscille de quelques dizaines de tours, et sous charge
   * partielle il tremble encore.
   *
   * Le tremblement ne s'ajoute qu'au **régime entendu**, celui qui fixe les
   * vitesses de lecture. La boîte, ses seuils et la télémétrie continuent de voir
   * le régime net : les seuils de passage travaillent sur le régime, et quelques
   * dizaines de tours de tremblement les feraient osciller — le défaut que la
   * boîte a déjà corrigé trois fois.
   */
  flutterRpm: number
  /**
   * Fréquence de la composante rapide du tremblement, en hertz.
   *
   * Une composante lente en est déduite, à un peu plus d'un dixième de cette
   * valeur : un tremblement à une seule fréquence s'entend comme un vibrato.
   */
  flutterHz: number
}

export interface DrivetrainPreset {
  /** Du plus court au plus long. Une seule entrée = prise directe, pas de boîte. */
  gearRatios: number[]
  finalDrive: number
  wheelRadiusM: number
  /** Coupure de couple pendant le passage, en millisecondes. */
  shiftTimeMs: number
  /**
   * Régime au-dessous duquel la boîte ne monte pas en croisière.
   *
   * La montée à vitesse tenue n'a pas de seuil de régime à franchir — c'est
   * tout son intérêt — donc il lui faut une limite basse, sans quoi 50 km/h
   * tenus finiraient sur le dernier rapport à mille tours, ce qui broute.
   *
   * En tours par minute et non en fraction du rupteur : c'est une limite
   * mécanique, pas un rapport. Distinct de `minUpshiftRpm`, qui est le plancher
   * des seuils de passage **ordinaires**.
   */
  cruiseMinRpm: number
  /**
   * Durée de vitesse stable avant de tenter un rapport de plus, en secondes.
   *
   * Court, la boîte monte dès qu'on lève le pied ; long, elle garde ses
   * rapports. C'est l'un des trois réglages qui font le caractère de la boîte.
   */
  cruiseUpshiftAfterS: number
  /**
   * Décélération à partir de laquelle la boîte descend pour aider à ralentir,
   * en m/s². Négative.
   *
   * Sans elle, le rétrogradage ne connaissait qu'un seuil de régime : la boîte
   * descendait aux mêmes vitesses qu'on lève le pied doucement ou qu'on freine
   * fort, et ne servait donc jamais à ralentir.
   */
  brakeDownshiftAccelMs2: number
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
  /**
   * Fenêtre de calcul de la pente d'accélération, en millisecondes.
   *
   * Toutes les mesures qu'elle contient servent à l'ajustement, quel qu'en soit
   * le nombre : deux à la cadence d'un hertz, une trentaine à celle du GPS d'une
   * Tesla en mouvement.
   */
  accelWindowMs: number
  /** Toute mesure au-delà est rejetée comme aberrante. */
  maxPlausibleKmh: number
  /**
   * Précision annoncée au-delà de laquelle une position est écartée, en mètres.
   *
   * Une position à trois cents mètres près entrait dans le calcul comme une
   * position à cinq mètres : la vitesse déduite de deux points aussi flous n'a
   * aucun sens, et le lissage l'étale ensuite sur plusieurs secondes.
   *
   * **Le seuil est large tant que les valeurs réelles ne sont pas relevées.**
   * Un seuil trop serré rejette des mesures saines et fait taire la source,
   * c'est-à-dire exactement le défaut qui vient d'immobiliser l'application
   * deux fois sur autoroute. La précision courante est affichée en télémétrie
   * pour qu'on resserre sur des chiffres et non sur une intuition.
   */
  maxAccuracyM: number
  /** Bornes de l'accélération retenue, en m/s². */
  minAccelMs2: number
  maxAccelMs2: number
}

export interface MixPreset {
  /** Régime en dessous duquel seule la couche basse joue. */
  crossfadeLowRpm: number
  /** Régime au-dessus duquel seule la couche haute joue. */
  crossfadeHighRpm: number
  /**
   * Accélération, en m/s², à laquelle la charge est considérée pleine.
   * C'est elle qui arbitre le fondu entre les couches « en charge » et « pied levé ».
   */
  fullLoadAccelMs2: number
  /**
   * Vitesse à laquelle tenir l'allure consomme la moitié de la charge
   * disponible, en km/h.
   *
   * Faute de pédale, la charge se déduit de l'accélération — et tenir une
   * vitesse, quelle qu'elle soit, donne donc toujours le même demi. Or tenir
   * 130 km/h demande beaucoup de couple et tenir 30 presque rien : la traînée
   * croît comme le carré de la vitesse. Ce repère est ce qui rend cet effort-là
   * au son.
   *
   * Ce n'est pas un réglage de physique — `fullLoadAccelMs2` vaut déjà 2 m/s² là
   * où une électrique en fait cinq. C'est un curseur de contraste : bas, tout
   * devient chargé tôt ; haut, la traînée compte peu.
   */
  dragRefKmh: number
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
  /**
   * Relief de charge, en décibels.
   *
   * Le fondu de charge est à puissance constante : `sin² + cos² = 1`. Il change
   * donc le **timbre** et jamais le volume — mesuré, ralenti, croisière, reprise
   * douce et reprise franche tenaient dans 1,3 dB. Accélérer ne s'entendait pas.
   *
   * Ce gain suit la charge : moins ce nombre pied levé, autant en plus pied au
   * plancher, rien en croisière. À 4, il y a donc 8 dB entre lever le pied et
   * écraser.
   */
  loadReliefDb: number
  /**
   * Relief du régime, en décibels, du ralenti au rupteur.
   *
   * Un moteur rugit plus haut dans les tours. La banque le fait déjà en partie —
   * la prise haut régime est enregistrée 4,8 dB plus fort que la basse — mais
   * c'était un accident de l'enregistrement, pas une intention réglable. Ce gain
   * s'y ajoute.
   */
  rpmReliefDb: number
  /**
   * Écart de niveau au ralenti, en décibels. Négatif.
   *
   * Au ralenti, faute de couche dédiée dans la banque livrée, on entend la prise
   * « pied levé » jouée deux octaves plus bas — et, avant ce réglage, aussi fort
   * que tout le reste.
   */
  idleLevelDb: number
  /**
   * Désaccord entre les couches d'une même famille, en centièmes de demi-ton.
   *
   * Deux couches jouées au rapport exact sont parfaitement justes l'une par
   * rapport à l'autre, ce qui n'arrive sur aucun moteur : les inégalités entre
   * cylindres et les deux lignes d'échappement produisent un battement lent.
   * C'est ce battement qui manque.
   *
   * L'écart est réparti symétriquement dans la famille — l'une descend d'autant
   * que l'autre monte — donc la hauteur moyenne ne bouge pas : le désaccord
   * élargit le son sans toucher à la justesse. Il est constant par couche, et ne
   * dépend pas du temps : une même situation donne toujours le même mixage.
   */
  layerDetuneCents: number
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
  /**
   * Valeurs de ce profil au moment de sa création.
   *
   * C'est ce que « réinitialiser » lui rend. Sans elles, un profil sorti du
   * guide de création ne pouvait revenir qu'aux valeurs du profil **Sport** —
   * reconnu à son identifiant, et servant de repli à tous les autres. La
   * fonction ne servait donc à rien précisément là où elle sert le plus : sur un
   * profil qu'on vient de fabriquer et qu'on tâtonne.
   *
   * Facultatif : les deux profils livrés n'en ont pas besoin, leur identifiant
   * suffit à les retrouver, et un profil venu d'une version antérieure n'en a
   * pas. Le repli d'avant reste alors en place.
   *
   * Ne voyage pas dans un lien de partage — il doublerait sa longueur, déjà
   * surveillée — mais suit dans un fichier exporté, où la taille n'importe pas.
   */
  origin?: ProfileOrigin
}

/** Version du format, pour pouvoir migrer un profil exporté plus tard. */
/**
 * Valeurs d'origine d'un profil : ce qu'il était au moment de sa création.
 *
 * Tout sauf son identité — l'identifiant, le nom et le statut de favori ne se
 * réinitialisent pas.
 */
export type ProfileOrigin = Pick<
  Profile,
  'sampleDir' | 'engine' | 'drivetrain' | 'speed' | 'mix' | 'feel' | 'layers'
>

export const PROFILE_FORMAT_VERSION = 2

export interface ProfileFile {
  version: number
  profile: Profile
}
