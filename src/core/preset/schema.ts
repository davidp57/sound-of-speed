/**
 * Schéma d'un profil.
 *
 * Un profil est l'unité complète de configuration : tout ce qui influence le son
 * y est déclaré, rien n'est codé en dur ailleurs. Il est sérialisable en JSON,
 * donc sauvegardable, exportable et rechargeable tel quel.
 */

import type { SynthRendering } from '../synth/rendering'

/** Rôle d'une couche dans le mixage. */
export type LayerRole = 'idle' | 'on' | 'off' | 'limiter'

/**
 * D'où vient le son d'un profil.
 *
 * - `recorded` : la banque d'échantillons, jouée en changeant sa vitesse de
 *   lecture. C'est ce que fait l'application depuis le début.
 * - `live` : le moteur est simulé pendant la conduite, sans aucun échantillon.
 * - `prerendered` : la simulation a tourné au bureau et produit une banque, que
 *   la voiture rejoue comme les autres.
 *
 * Trois et non deux : le rendu à l'avance n'est pas un repli du direct. Il
 * corrige un défaut que ni l'un ni l'autre des deux autres ne corrige — une
 * prise par plage de régime, donc une lecture proche de un, où le timbre ne se
 * déplace plus avec le régime. Et le direct garde ce que la génération perd : un
 * son continu, sans domaine ni bascule. Le choix est par profil parce qu'il
 * dépend du moteur imité : un bicylindre tient en direct là où un V8 ne tient
 * peut-être pas.
 */
export type SoundSource = 'recorded' | 'live' | 'prerendered'

/** Les trois origines, dans l'ordre où l'écran de configuration les propose. */
export const SOUND_SOURCES: readonly SoundSource[] = ['recorded', 'live', 'prerendered']

export function isSoundSource(value: unknown): value is SoundSource {
  return SOUND_SOURCES.includes(value as SoundSource)
}

/**
 * Origine déclarée par un profil, avec le repli des profils d'avant.
 *
 * Un profil enregistré ou partagé avant l'arrivée du champ n'en porte pas : il
 * sonne par échantillons, c'est donc `recorded` qu'il faut lui rendre. La
 * reprise du stockage l'écrit une fois pour toutes, mais un profil reçu par lien
 * ne repasse pas par elle — d'où cette lecture tolérante, à employer partout où
 * l'on interroge l'origine.
 */
export function soundSourceOf(profile: { soundSource?: unknown }): SoundSource {
  return isSoundSource(profile.soundSource) ? profile.soundSource : 'recorded'
}

/**
 * Cette origine demande-t-elle de quoi simuler un moteur ?
 *
 * Enregistré et généré à l'avance jouent tous deux une banque d'échantillons, par
 * le même moteur de lecture : ils marchent partout où le son marche. Généré en
 * direct, lui, fait tourner le moteur simulé dans la page, ce qui demande un
 * `AudioWorklet` et du WebAssembly. La question est posée ici parce qu'elle tient
 * à l'origine ; c'est à l'appelant de savoir ce que son navigateur sait faire.
 */
export function needsSimulatedEngine(source: SoundSource): boolean {
  return source === 'live'
}

/**
 * Cette origine décrit-elle un moteur simulé, qu'il tourne maintenant ou non ?
 *
 * Généré à l'avance rejoue une banque que la simulation a produite au bureau :
 * le moteur décrit dans le profil est celui dont cette banque est sortie, et le
 * choisir garde un sens même si le son joué ne change pas avant le prochain
 * rendu. Enregistré, lui, ne doit rien à un moteur simulé.
 */
export function describesSimulatedEngine(source: SoundSource): boolean {
  return source === 'live' || source === 'prerendered'
}

/**
 * Le moteur simulé, décrit en nombres.
 *
 * Les moteurs d'engine-sim étaient écrits en dur dans le C++ : changer un volume
 * de chambre demandait de recompiler le WebAssembly, et personne ne pouvait donc
 * régler à l'oreille. Ces vingt-sept valeurs vivent maintenant dans le profil,
 * comme les autres réglages, et voyagent avec lui — fichier, lien, stockage.
 *
 * La source de vérité de ces paramètres, de leurs unités et de leurs valeurs de
 * référence est `native/CONTRAT-MOTEUR.md`. Le C++ les lit dans **l'ordre** de
 * `ENGINE_FIELDS`, sans analyseur JSON : cet ordre est le contrat.
 *
 * Le rupteur n'est pas ici. Il est bien passé au moteur simulé — le C++ l'attend
 * à la place 24 — mais il se règle déjà dans `engine.redlineRpm`, et deux
 * réglages pour un seul chiffre finiraient par se contredire.
 *
 * Ce qui reste en dur dans `probe.cpp` : les courbes de débit des soupapes, qui
 * sont des relevés de banc et non des réglages, l'ordre d'allumage et les angles
 * de manetons, qui *définissent* le moteur et suivent le nombre de cylindres.
 */
export interface EngineDefinition {
  /** Nombre de cylindres. Rebâtit tout : l'ordre d'allumage en découle. */
  cylinders: number
  /** Alésage, en pouces. */
  bore: number
  /** Course, en pouces. */
  stroke: number
  /** Longueur de bielle, en pouces. */
  rodLength: number
  /**
   * Volume de la chambre de combustion, en centimètres cubes — donc le **taux
   * de compression**.
   *
   * À 90 cc le LS3 est à 9,6:1 ; à 68, à 12,3:1, soit un moteur de compétition.
   * C'est la violence de la combustion, et donc celle de l'impulsion
   * d'échappement.
   */
  chamberVolume: number
  /** Volume du conduit d'admission, en centimètres cubes. */
  intakeRunnerVolume: number
  /** Section du conduit d'admission, en pouces carrés. */
  intakeRunnerArea: number
  /** Volume du conduit d'échappement, en centimètres cubes. */
  exhaustRunnerVolume: number
  /** Section du conduit d'échappement, en pouces carrés. */
  exhaustRunnerArea: number
  /** Écartement des lobes de came, en degrés. */
  lobeSeparation: number
  /** Centre du lobe d'admission, en degrés. */
  intakeLobeCenter: number
  /** Centre du lobe d'échappement, en degrés. */
  exhaustLobeCenter: number
  /** Levée d'admission, en pouces. */
  intakeLift: number
  /** Levée d'échappement, en pouces. */
  exhaustLift: number
  /** Durée d'ouverture d'admission, en degrés. */
  intakeDuration: number
  /** Durée d'ouverture d'échappement, en degrés. */
  exhaustDuration: number
  /** Volume de la boîte à air, en litres. */
  plenumVolume: number
  /** Débit d'admission, en k_carb. */
  intakeFlowRate: number
  /**
   * Ouverture du papillon au ralenti, de 0 à 1.
   *
   * Le débit passe en cosinus : 0,9985 laisse dix-sept fois moins d'air que
   * 0,975, et le moteur s'asphyxie. D'où un pas de curseur très fin.
   */
  idleThrottlePlate: number
  /** Longueur du tube primaire, en pouces. Elle fixe la résonance d'échappement. */
  primaryTubeLength: number
  /** Débit du tube primaire, en k_carb. */
  primaryFlowRate: number
  /** Débit en sortie, en k_carb. */
  outletFlowRate: number
  /** Volume du collecteur, en litres. */
  collectorVolume: number
  /** Poids de cette ligne d'échappement dans le son. */
  exhaustAudioVolume: number
  /** Durée d'une coupure au rupteur, en secondes. */
  limiterDuration: number
  /**
   * Bruit d'air d'engine-sim, de 0 à 1.
   *
   * Il ne s'ajoute pas au signal : il le **multiplie**. À un, le moteur
   * disparaît derrière sa modulation.
   */
  airNoise: number
  /** Gigue d'échantillonnage, de 0 à 1. Filtrée à 10 kHz par engine-sim. */
  inputSampleNoise: number
  /**
   * Longueur du collecteur du premier cylindre, en pouces.
   *
   * Sur un V8, les suivants s'en déduisent par quarts — la règle du 454, qui
   * écrit ses quatre longueurs `distance * 4, 3, 2, 1`. Sur un quatre cylindres,
   * tous portent la même : l'EJ25 n'en déclare aucune, et c'est pourquoi il n'a
   * pas les résonances multiples du V8.
   *
   * **Ce réglage arbitre.** Long, il donne le côté rugueux et vivant en charge,
   * et des fréquences parasites au ralenti ; court, il enlève les deux. C'est
   * David qui l'a constaté en écoutant les deux extrêmes, et c'est pour cela que
   * c'est un curseur.
   */
  headerLength: number
}

/**
 * Les familles de réglages, dans l'ordre où l'écran les présente.
 *
 * Elles suivent l'ordre du contrat plutôt que de le réarranger : chaque famille
 * est une tranche contiguë de `ENGINE_FIELDS`.
 */
export const ENGINE_GROUPS = [
  { id: 'geometry', label: 'Géométrie' },
  { id: 'head', label: 'Culasse' },
  { id: 'cams', label: 'Cames' },
  { id: 'intake', label: 'Admission' },
  { id: 'exhaust', label: 'Échappement' },
  { id: 'limiter', label: 'Rupteur' },
  { id: 'noise', label: 'Bruits' },
] as const

export type EngineGroup = (typeof ENGINE_GROUPS)[number]['id']

/**
 * Une clé du contrat : les vingt-sept réglables, plus le rupteur.
 *
 * `revLimit` occupe une place dans le tableau envoyé au C++ mais pas dans la
 * définition : sa valeur vient de `engine.redlineRpm`.
 */
export type EngineFieldKey = keyof EngineDefinition | 'revLimit'

export interface EngineField {
  key: EngineFieldKey
  /** Libellé affiché. */
  label: string
  /** Unité affichée à côté de la valeur ; vide quand le nombre est sans unité. */
  unit: string
  min: number
  max: number
  step: number
  group: EngineGroup
  /**
   * La valeur vient d'ailleurs dans le profil : elle ne se règle pas ici.
   *
   * Seul le rupteur est dans ce cas. Il tient sa place dans le tableau, sinon
   * tout ce qui suit se décalerait.
   */
  fromProfile?: true
  /**
   * Le changer ne demande pas de rebâtir le moteur simulé.
   *
   * Les deux bruits s'écrivent à chaud, et c'est ce qui rend leur réglage
   * supportable : on les entend bouger sans coupure d'une seconde à chaque cran.
   */
  hot?: true
}

/**
 * Les paramètres du moteur simulé, **dans l'ordre du contrat**.
 *
 * Cet ordre est ce que le C++ lit : il ne se réarrange pas. Un paramètre neuf
 * s'ajoute à la fin ; un paramètre retiré laisse sa place occupée plutôt que de
 * décaler les suivants.
 *
 * Les bornes ne viennent pas du contrat, qui n'en donne pas : elles encadrent
 * largement les deux définitions de référence. Ce sont des garde-fous de
 * curseur, pas des limites physiques — s'en approcher n'est pas interdit, mais
 * les valeurs de référence restent le repère.
 */
export const ENGINE_FIELDS: readonly EngineField[] = [
  // Quatre ou huit, et rien entre les deux : l'ordre d'allumage et les angles de
  // manetons sont écrits en dur dans `probe.cpp` pour ces deux moteurs-là.
  { key: 'cylinders', label: 'Cylindres', unit: '', min: 4, max: 8, step: 4, group: 'geometry' },
  { key: 'bore', label: 'Alésage', unit: 'po', min: 2, max: 5, step: 0.001, group: 'geometry' },
  { key: 'stroke', label: 'Course', unit: 'po', min: 2, max: 5, step: 0.001, group: 'geometry' },
  { key: 'rodLength', label: 'Bielle', unit: 'po', min: 3, max: 9, step: 0.001, group: 'geometry' },
  // La Hayabusa déclare 19,2 cc — un rapport volumétrique de moteur de course. La
  // borne était à 30 parce qu'on ne connaissait alors que deux moteurs de route.
  { key: 'chamberVolume', label: 'Chambre', unit: 'cc', min: 15, max: 150, step: 1, group: 'geometry' },
  { key: 'intakeRunnerVolume', label: 'Conduit d’admission', unit: 'cc', min: 20, max: 400, step: 0.1, group: 'head' },
  { key: 'intakeRunnerArea', label: 'Section d’admission', unit: 'po²', min: 1, max: 12, step: 0.01, group: 'head' },
  // Trois cents centimètres cubes est le défaut d'`cylinder_head_parameters`, que
  // le gros bloc Chevrolet ne redresse pas : la borne haute l'écrêtait.
  { key: 'exhaustRunnerVolume', label: 'Conduit d’échappement', unit: 'cc', min: 10, max: 350, step: 0.1, group: 'head' },
  // Un pas plus fin que sa voisine, et c'est voulu : la section du V8 vaut
  // 3,0625 po², qu'un pas au centième ne permettrait pas de retrouver après
  // s'en être écarté.
  { key: 'exhaustRunnerArea', label: 'Section d’échappement', unit: 'po²', min: 0.5, max: 10, step: 0.0025, group: 'head' },
  { key: 'lobeSeparation', label: 'Écartement des lobes', unit: '°', min: 90, max: 130, step: 0.5, group: 'cams' },
  { key: 'intakeLobeCenter', label: 'Centre du lobe d’admission', unit: '°', min: 90, max: 130, step: 0.5, group: 'cams' },
  { key: 'exhaustLobeCenter', label: 'Centre du lobe d’échappement', unit: '°', min: 90, max: 130, step: 0.5, group: 'cams' },
  { key: 'intakeLift', label: 'Levée d’admission', unit: 'po', min: 0.1, max: 0.9, step: 0.001, group: 'cams' },
  { key: 'exhaustLift', label: 'Levée d’échappement', unit: 'po', min: 0.1, max: 0.9, step: 0.001, group: 'cams' },
  { key: 'intakeDuration', label: 'Durée d’admission', unit: '°', min: 160, max: 320, step: 1, group: 'cams' },
  { key: 'exhaustDuration', label: 'Durée d’échappement', unit: '°', min: 160, max: 320, step: 1, group: 'cams' },
  { key: 'plenumVolume', label: 'Boîte à air', unit: 'l', min: 0.2, max: 10, step: 0.025, group: 'intake' },
  { key: 'intakeFlowRate', label: 'Débit d’admission', unit: 'k', min: 50, max: 1500, step: 10, group: 'intake' },
  // Pas très fin, et c'est mesuré : le débit passe en cosinus, dix-sept fois
  // moins d'air entre 0,975 et 0,9985.
  { key: 'idleThrottlePlate', label: 'Papillon au ralenti', unit: '', min: 0.8, max: 1, step: 0.0005, group: 'intake' },
  { key: 'primaryTubeLength', label: 'Tube primaire', unit: 'po', min: 4, max: 60, step: 0.5, group: 'exhaust' },
  { key: 'primaryFlowRate', label: 'Débit du primaire', unit: 'k', min: 50, max: 2000, step: 10, group: 'exhaust' },
  { key: 'outletFlowRate', label: 'Débit de sortie', unit: 'k', min: 100, max: 4000, step: 25, group: 'exhaust' },
  { key: 'collectorVolume', label: 'Collecteur', unit: 'l', min: 1, max: 500, step: 1, group: 'exhaust' },
  { key: 'exhaustAudioVolume', label: 'Poids dans le son', unit: '', min: 0, max: 10, step: 0.1, group: 'exhaust' },
  {
    key: 'revLimit',
    label: 'Rupteur',
    unit: 'tr/min',
    min: 2000,
    max: 12000,
    step: 100,
    group: 'limiter',
    fromProfile: true,
  },
  { key: 'limiterDuration', label: 'Durée de coupure', unit: 's', min: 0.01, max: 1, step: 0.01, group: 'limiter' },
  { key: 'airNoise', label: 'Bruit d’air', unit: '', min: 0, max: 1, step: 0.01, group: 'noise', hot: true },
  {
    key: 'inputSampleNoise',
    label: 'Gigue d’échantillonnage',
    unit: '',
    min: 0,
    max: 1,
    step: 0.01,
    group: 'noise',
    hot: true,
  },
  // En dernier, et c'est la règle du contrat : un paramètre neuf s'ajoute à la
  // fin, jamais au milieu, pour que l'ordre ne se décale pas côté C++.
  {
    key: 'headerLength',
    label: 'Collecteur du 1er cylindre',
    unit: 'po',
    min: 1,
    max: 60,
    step: 0.5,
    group: 'exhaust',
  },
]

/** Nombre de doubles attendus par le C++. Le contrat, en un chiffre. */
export const ENGINE_VALUE_COUNT = ENGINE_FIELDS.length

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
  /**
   * Régime de décollage : ce que l'embrayage impose dès que la voiture avance.
   *
   * Sans lui, le régime restait collé au ralenti tant que les roues tournaient
   * moins vite — de zéro à six kilomètres à l'heure sur le profil Sport, et le
   * son y était le même qu'à l'arrêt. Une vraie voiture ne connaît pas cet
   * état : on embraye, le moteur monte, et il **tient** ce régime pendant que la
   * voiture prend de la vitesse. Les roues le rejoignent ensuite.
   */
  launchRpm: number
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
  /**
   * Intervalle moyen entre deux renouvellements de position de lecture, en
   * secondes. Zéro éteint le renouvellement.
   *
   * Chaque couche est une boucle de trois à cinq secondes, étirée par la vitesse
   * de lecture : elle se répète toutes les quatre à vingt secondes, toujours à
   * l'identique. Reprendre la lecture ailleurs de temps en temps empêche
   * l'oreille d'apprendre ce motif.
   *
   * L'intervalle réel est tiré autour de cette valeur, à quarante pour cent
   * près : un saut à cadence fixe remplacerait une périodicité par une autre.
   */
  layerRefreshS: number
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
  /**
   * D'où vient le son de ce profil.
   *
   * À la racine, et non dans une section : ce n'est pas un réglage qu'on
   * tâtonne, c'est la déclaration de ce qui produit le son. Elle décide de ce
   * que les autres sections veulent dire — une banque d'échantillons d'un côté,
   * une définition de moteur de l'autre — et elle ne se réinitialise donc pas
   * avec elles.
   */
  soundSource: SoundSource
  /**
   * Définition du moteur simulé, pour les deux origines générées.
   *
   * Elle vit dans le profil parce que tout l'outillage y est déjà : export en
   * fichier, partage par lien, reprise des profils enregistrés. Un profil rendu
   * à l'avance la garde à côté de sa banque — sans quoi la banque deviendrait
   * une boîte noire dont personne ne sait plus d'où elle vient, ni comment la
   * refaire après un changement de réglage.
   *
   * Sa forme est celle du contrat, décrite par `EngineDefinition` : les mêmes
   * nombres que le C++ lit, dans l'ordre de `ENGINE_FIELDS`. Facultative dans le
   * schéma parce qu'un profil reçu par lien depuis une version antérieure n'en a
   * pas — la reprise du stockage lui rend celle de son profil d'usine.
   */
  engineDefinition?: EngineDefinition
  /**
   * Comment le moteur simulé se rend : échappement, volume, crête visée.
   *
   * Le pendant sonore de `engineDefinition`. Elle dit quel moteur tourne, celle
   * -ci dit à quoi il ressemble une fois sorti du haut-parleur — et les deux
   * vont ensemble, parce qu'essayer plusieurs moteurs au volant n'a de sens que
   * si chacun arrive avec son réglage.
   *
   * Le profil en garde une copie modifiable, posée par la bibliothèque au
   * chargement du moteur : c'est ce qui permet d'affiner au banc sans toucher
   * aux valeurs d'usine.
   *
   * Facultative dans le schéma parce qu'un profil enregistré avant la version 6
   * n'en a pas — la reprise du stockage lui rend celle de son profil d'usine.
   */
  rendering?: SynthRendering
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
 * réinitialisent pas. L'origine du son et la définition de moteur non plus :
 * elles disent ce qui produit le son, pas comment il est réglé, et remettre un
 * profil « aux valeurs d'usine » ne doit pas le faire changer de nature.
 */
export type ProfileOrigin = Pick<
  Profile,
  'sampleDir' | 'engine' | 'drivetrain' | 'speed' | 'mix' | 'feel' | 'layers'
>

/**
 * Version 6 : le son du moteur simulé voyage avec le profil.
 *
 * Échappement, volume, crête visée et papillon vivaient dans les réglages du
 * banc, en mémoire, perdus à chaque rechargement de page. Un moteur réglé à
 * l'atelier n'emportait donc rien de son réglage. Un profil qui n'en porte pas
 * reçoit celui de son profil d'usine.
 *
 * Version 5 : la définition de moteur a une forme.
 *
 * Elle traversait le stockage sans être lue depuis la version 4 ; elle porte
 * maintenant les vingt-sept nombres du contrat, et un profil qui n'en avait pas
 * reçoit celle de son profil d'usine.
 */
export const PROFILE_FORMAT_VERSION = 6

export interface ProfileFile {
  version: number
  profile: Profile
}
