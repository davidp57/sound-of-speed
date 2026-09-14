import { DEFAULT_RENDERING, type SynthRendering } from '../synth/rendering'
import { GM_LS_RENDERING, GM_LS_V8, SUBARU_EJ25 } from './defaults'
import type { EngineDefinition } from './schema'

/**
 * Les moteurs qu'on sait charger.
 *
 * Vingt-huit curseurs ne se règlent pas un par un : David l'a dit après avoir
 * essayé — « c'est vraiment difficile de trouver des réglages qui sont bien, ils
 * ont tous des effets les uns sur les autres et y'en a beaucoup ». Un moteur
 * n'est pas vingt-huit valeurs indépendantes, c'est un ensemble où elles
 * s'accordent. On en charge un entier, puis on affine deux ou trois choses.
 *
 * C'est aussi ce qu'il demandait au tout début du lot, en découvrant
 * engine-sim : « l'exemple que je t'ai trouvé propose de *charger un moteur* ».
 *
 * **Ce qui limite la liste**, ce n'est pas le nombre de définitions disponibles
 * — le dépôt d'engine-sim en contient vingt-cinq — mais les trois architectures
 * que `native/engines.h` sait construire : quatre cylindres en ligne, six
 * cylindres en ligne, et V8 à quatre-vingt-dix degrés à vilebrequin croisé. Un
 * V12, un radial ou un V6 à calage inégal demanderaient chacun leur
 * constructeur — le six en ligne a demandé le sien le 14 septembre 2026.
 */
export interface LibraryEngine {
  id: string
  /** Ce qui s'affiche à l'écran. */
  label: string
  /**
   * Le même nom, en court, pour les boutons de section.
   *
   * Une section porte huit boutons ; avec les noms entiers la page devient
   * illisible, et à cet endroit le contexte suffit à lever l'ambiguïté.
   */
  short: string
  /** D'où vient la définition, pour qu'on puisse y retourner. */
  /**
   * Le fichier d'engine-sim dont la définition est relevée.
   *
   * Facultatif depuis le 14 septembre 2026 : le six en ligne n'est relevé de
   * nulle part, il est construit de mémoire. Son absence de source **est**
   * l'information — un moteur sans source n'a pas la même valeur de preuve que
   * les autres, et un test le vérifie.
   */
  source?: string
  /** Le rupteur du moteur d'origine, en tours par minute. */
  redlineRpm: number
  definition: EngineDefinition
  /**
   * Comment ce moteur se rend : échappement, volume, crête visée, papillon.
   *
   * Il voyage avec la définition parce qu'essayer plusieurs moteurs au volant
   * n'a de sens que si chacun arrive avec son réglage — sinon on écoute un
   * moteur à travers l'échappement du précédent, et l'on ne sait plus lequel
   * des deux on entend.
   *
   * **Un seul est réglé à ce jour** : le GM LS, aux valeurs relevées par David
   * le 6 septembre 2026. Les autres portent le rendu par défaut, c'est-à-dire
   * qu'ils ne sont pas réglés — c'est écrit plutôt que masqué, pour qu'on sache
   * ce qu'on écoute.
   */
  rendering: SynthRendering
}

/**
 * Chevrolet 454, gros bloc, came d'origine.
 *
 * Relevé dans `assets/engines/chevrolet/chev_truck_454.mr`, complété par les
 * nœuds de `es/part-library/parts/` qu'il appelle : `chevy_bbc_stock_intake`
 * pour l'admission, `chevy_bbc_peanut_port_head` pour la culasse,
 * `chevy_454_stock_camshaft` et ses deux profils de lobe pour les cames. Rien
 * n'est déduit : ce que le fichier ne déclare pas est allé se lire dans le nœud
 * qui porte la valeur par défaut, et le commentaire dit lequel.
 */
export const CHEVROLET_454: EngineDefinition = {
  cylinders: 8,
  bore: 4.25,
  // Le vilebrequin déclare `throw: 2.0 inch`, et la course vaut deux fois le
  // maneton — c'est la relation qu'applique aussi `probe.cpp`.
  stroke: 4,
  rodLength: 6.135,
  // Les cinq valeurs de culasse viennent de `chevy_bbc_peanut_port_head`
  // (es/part-library/parts/heads.mr) : le fichier du moteur ne les redonne pas.
  chamberVolume: 118,
  intakeRunnerVolume: 189,
  // 37,8 cm², soit 5,859 po².
  intakeRunnerArea: 5.859,
  // La culasse ne déclare ni volume ni section d'échappement : elles retombent
  // sur `cylinder_head_parameters` (es/objects/objects.mr), qui donne 300 cc et
  // un cercle de 0,85 pouce de rayon.
  exhaustRunnerVolume: 300,
  // π × 0,85², soit 2,2698 po².
  exhaustRunnerArea: 2.2698,
  // Défaut de `chevy_bbc_camshaft_builder`, que la came d'origine ne change pas.
  lobeSeparation: 114,
  intakeLobeCenter: 108,
  exhaustLobeCenter: 113,
  // Les levées et les durées viennent des deux profils de lobe
  // `stock_454_*_lobe_profile` (es/part-library/parts/cam_lobes.mr).
  intakeLift: 0.39,
  exhaustLift: 0.409,
  intakeDuration: 194,
  exhaustDuration: 202,
  // Défaut de `chevy_bbc_stock_intake`, que le fichier ne change pas.
  plenumVolume: 2,
  // `carburetor_cfm: 650.0`, que le nœud d'admission passe en `k_carb`.
  intakeFlowRate: 650,
  idleThrottlePlate: 0.991,
  primaryTubeLength: 10,
  primaryFlowRate: 100,
  outletFlowRate: 550,
  // Le fichier décrit son collecteur par une longueur — 100 pouces dans
  // `es_params`, puis 252 et 180 pouces sur les deux bancs — là où le contrat
  // ne porte qu'un volume. 100 litres est le défaut d'`exhaust_system_parameters`
  // et la valeur des deux définitions de référence ; le collecteur du 454
  // s'écarte donc du fichier, comme celui du GM LS.
  collectorVolume: 100,
  exhaustAudioVolume: 5.5,
  // Le fichier ne déclare pas de durée de coupure : c'est le défaut
  // d'`ignition_module` (es/objects/objects.mr).
  limiterDuration: 0.5,
  // Les deux bruits ne se lisent dans aucun `.mr` sous une forme utilisable :
  // ceux que les fichiers déclarent sont des valeurs de démonstration. On garde
  // celles que le projet a retenues à l'oreille, comme les deux références.
  airNoise: 0.15,
  inputSampleNoise: 0,
  headerLength: 20,
}

/**
 * Le même gros bloc, avec un arbre à cames Comp Cams et un carburateur plus
 * gros.
 *
 * Relevé dans `assets/engines/chevrolet/engine_03_for_e1.mr`, qui ne diffère du
 * 454 d'origine que par six valeurs : le débit d'admission, le papillon de
 * ralenti, le débit du primaire, le volume du collecteur, le poids dans le son
 * et la came. Tout le reste — bloc, bielle, culasse — est identique, et les
 * commentaires du 454 valent donc ici aussi.
 */
export const CHEVROLET_454_COMP_CAMS: EngineDefinition = {
  ...CHEVROLET_454,
  // `comp_cams_magnum_11_450_8` (es/part-library/parts/camshafts.mr) : un
  // écartement de 110 degrés, qui sert aussi de centre aux deux lobes puisque
  // la came ne les déclare pas séparément.
  lobeSeparation: 110,
  intakeLobeCenter: 110,
  exhaustLobeCenter: 110,
  // Un seul profil pour les deux côtés : 578 millièmes de pouce de levée,
  // 232 degrés de durée (`comp_cams_magnum_11_450_8_lobe_profile`).
  intakeLift: 0.578,
  exhaustLift: 0.578,
  intakeDuration: 232,
  exhaustDuration: 232,
  intakeFlowRate: 950,
  idleThrottlePlate: 0.995,
  primaryFlowRate: 90,
  // Ce fichier-ci déclare bien un volume, pas une longueur : la valeur est
  // relevée telle quelle.
  collectorVolume: 50,
  exhaustAudioVolume: 1,
}

/**
 * Honda B18C5, le quatre cylindres à VTEC de l'Integra Type R.
 *
 * Relevé dans `assets/engines/atg-video-1/05_honda_vtec.mr`. Le VTEC lui-même
 * ne passe pas : `probe.cpp` monte une distribution ordinaire, et les deux
 * profils de lobe retenus sont ceux de la came douce — ceux que le moteur
 * emploie sous le point de bascule. Ce qui reste du B18C5 est sa géométrie, sa
 * culasse et son échappement.
 */
export const HONDA_B18C5: EngineDefinition = {
  cylinders: 4,
  // 81 mm.
  bore: 3.189,
  // 87,2 mm.
  stroke: 3.433,
  rodLength: 5.43,
  // Les cinq valeurs de culasse viennent du nœud `honda_vtec_head` du fichier.
  chamberVolume: 41.6,
  intakeRunnerVolume: 149.6,
  // 1,35 × 1,35 pouces.
  intakeRunnerArea: 1.8225,
  exhaustRunnerVolume: 50,
  // 1,25 × 1,25 pouces.
  exhaustRunnerArea: 1.5625,
  // Défaut de `honda_vtec_camshaft`, que le fichier ne change pas.
  lobeSeparation: 114,
  intakeLobeCenter: 116,
  exhaustLobeCenter: 116,
  // 6,9 mm et 6,5 mm : les levées de la came douce, pas celles du VTEC.
  intakeLift: 0.2717,
  exhaustLift: 0.2559,
  intakeDuration: 210,
  exhaustDuration: 190,
  plenumVolume: 1.325,
  intakeFlowRate: 800,
  idleThrottlePlate: 0.9989,
  primaryTubeLength: 10,
  primaryFlowRate: 200,
  outletFlowRate: 1000,
  collectorVolume: 100,
  // `audio_volume: 8 * 0.75` sur le premier des deux échappements, comme
  // l'EJ25 de référence dont le contrat retient la première ligne.
  exhaustAudioVolume: 6,
  limiterDuration: 0.05,
  // Le fichier déclare `noise: 0.253` et `jitter: 0.195`, mais le projet garde
  // les deux valeurs jugées à l'oreille pour toute la bibliothèque : le bruit
  // d'air multiplie le signal, et le laisser varier d'un moteur à l'autre
  // rendrait les comparaisons illisibles. Écart assumé, comme au contrat.
  airNoise: 0.15,
  inputSampleNoise: 0,
  headerLength: 10,
}

/**
 * Suzuki Hayabusa, le quatre cylindres de moto qui monte à 11 000 tr/min.
 *
 * Relevé dans `assets/engines/atg-video-1/04_hayabusa.mr`.
 */
export const SUZUKI_HAYABUSA: EngineDefinition = {
  cylinders: 4,
  // 81 mm.
  bore: 3.189,
  // 65 mm.
  stroke: 2.5591,
  rodLength: 4.705,
  // Dix-neuf virgule deux centimètres cubes : un rapport volumétrique de moteur
  // de course, et la raison pour laquelle la borne basse du réglage a été
  // descendue à quinze.
  chamberVolume: 19.2,
  intakeRunnerVolume: 149.6,
  // 20 cm², soit 3,1 po².
  intakeRunnerArea: 3.1,
  exhaustRunnerVolume: 50,
  // 30 cm², soit 4,65 po².
  exhaustRunnerArea: 4.65,
  // Défaut de `hayabusa_camshaft`, que le fichier ne change pas.
  lobeSeparation: 114,
  intakeLobeCenter: 105,
  exhaustLobeCenter: 100,
  intakeLift: 0.345,
  exhaustLift: 0.294,
  intakeDuration: 240,
  exhaustDuration: 220,
  plenumVolume: 4.5,
  intakeFlowRate: 800,
  idleThrottlePlate: 0.999,
  primaryTubeLength: 40,
  primaryFlowRate: 500,
  outletFlowRate: 1000,
  collectorVolume: 10,
  // `audio_volume: 1.0 * 0.25` sur le premier échappement. Le niveleur du banc
  // rattrape l'écart de niveau avec les autres moteurs.
  exhaustAudioVolume: 0.25,
  limiterDuration: 0.05,
  // Le fichier déclare `noise: 0.292` et `jitter: 0.062` ; même écart assumé
  // que pour le B18C5.
  airNoise: 0.15,
  inputSampleNoise: 0,
  headerLength: 10,
}

/**
 * Subaru EJ25, version à collecteur égal.
 *
 * Relevé dans `assets/engines/atg-video-2/01_subaru_ej25_eh.mr`. Ce n'est pas
 * le même fichier que la référence `SUBARU_EJ25`, qui vient de la première
 * vidéo : la culasse, la came, l'admission et l'échappement y ont été repris.
 *
 * Ce qui distingue les deux versions à collecteur égal et inégal, c'est le
 * boxer : les quatre conduits d'un EJ25 d'origine n'ont pas la même longueur,
 * d'où le battement caractéristique. Notre modèle n'a qu'une longueur de
 * primaire pour les quatre cylindres — il garde la différence de longueur
 * globale (40 pouces contre 24), pas le décalage entre cylindres.
 */
export const SUBARU_EJ25_EQUAL_HEADER: EngineDefinition = {
  cylinders: 4,
  // 99,5 mm.
  bore: 3.917,
  // 79 mm.
  stroke: 3.11,
  rodLength: 5.142,
  // Les cinq valeurs de culasse viennent du nœud `ej25_head` du fichier.
  chamberVolume: 67,
  intakeRunnerVolume: 149.6,
  // 1,75 × 1,75 pouces — plus large que dans la définition de la première
  // vidéo, qui donne 1,35.
  intakeRunnerArea: 3.0625,
  exhaustRunnerVolume: 50,
  // 1,25 × 1,25 pouces.
  exhaustRunnerArea: 1.5625,
  // Défaut de la came du fichier, que celui-ci ne change pas.
  lobeSeparation: 114,
  intakeLobeCenter: 117,
  exhaustLobeCenter: 112,
  // 9,78 mm et 9,60 mm.
  intakeLift: 0.385,
  exhaustLift: 0.378,
  intakeDuration: 232,
  exhaustDuration: 236,
  plenumVolume: 1.325,
  intakeFlowRate: 400,
  idleThrottlePlate: 0.9978,
  primaryTubeLength: 40,
  primaryFlowRate: 400,
  outletFlowRate: 1000,
  // Le fichier donne une longueur de collecteur (500 mm) et non un volume :
  // 100 litres est le défaut d'`exhaust_system_parameters`, comme pour le
  // GM LS et le 454.
  collectorVolume: 100,
  // `audio_volume: 0.5 * 0.02`. Le niveleur du banc rattrape l'écart.
  exhaustAudioVolume: 0.01,
  limiterDuration: 0.16,
  // `noise: 1.0` et `jitter: 0.5` dans le fichier : les valeurs de démonstration
  // que le contrat écarte — à un, le moteur disparaît derrière sa modulation.
  airNoise: 0.15,
  inputSampleNoise: 0,
  headerLength: 10,
}

/**
 * Subaru EJ25, version à collecteur inégal.
 *
 * Relevé dans `assets/engines/atg-video-2/02_subaru_ej25_uh.mr`, qui ne diffère
 * du précédent que par la longueur du tube primaire.
 */
export const SUBARU_EJ25_UNEQUAL_HEADER: EngineDefinition = {
  ...SUBARU_EJ25_EQUAL_HEADER,
  primaryTubeLength: 24,
  headerLength: 10,
}

/**
 * Le GM LS avec l'échappement que David a trouvé à l'oreille.
 *
 * Quatre valeurs s'écartent de la définition d'engine-sim, toutes dans
 * l'échappement, relevées sur son écran le 8 septembre 2026 :
 *
 * - **le collecteur du premier cylindre passe de 6,8 à 30 pouces.** C'est celle
 *   qui s'entend le plus : « quand on l'augmente, fait mieux entendre le bruit
 *   des explosions (poutoum poutoum) — surtout au ralenti ». Le compromis qu'elle
 *   arbitre était déjà connu, mais du mauvais côté : on l'avait noté comme des
 *   parasites au ralenti, David les entend en **décélération** — « une fréquence
 *   parasite en plus du bruit du moteur, comme une pièce métallique qui vibre
 *   vite ». L'accélération, elle, est bonne ;
 * - **le débit du primaire double**, de 500 à 1 000 ;
 * - le tube primaire passe de 29 à 30 pouces, et le débit de sortie de 1 000 à
 *   2 000. Ces deux-là accompagnaient les précédentes sur son écran sans qu'il
 *   les nomme : elles sont reprises telles quelles, et se retirent d'un mot.
 *
 * Le moteur d'origine reste dans la liste, à sa valeur de référence : s'en
 * écarter est un choix, et l'on doit pouvoir y retourner.
 */
export const GM_LS_V8_LONG_HEADER: EngineDefinition = {
  ...GM_LS_V8,
  primaryTubeLength: 30,
  primaryFlowRate: 1000,
  outletFlowRate: 2000,
  headerLength: 30,
}

/**
 * Un six cylindres en ligne de trois litres, l'architecture des BMW.
 *
 * Demandé par David le 14 septembre 2026, après avoir trouvé le quatre
 * cylindres sans caractère : « ajoute un 6 en ligne du type BMW ».
 *
 * **Ces cotes ne sont pas sourcées**, et c'est la différence avec tous les
 * autres moteurs de cette liste : ceux-là sont relevés dans un fichier
 * d'engine-sim, celui-ci est construit de mémoire à partir de ce qu'on sait d'un
 * six BMW de trois litres — 84 mm d'alésage, 89,6 mm de course, un rapport
 * volumétrique de 10,2. Il n'a pas de `source` pour cette raison.
 *
 * Ce qui fait son caractère n'est pas dans ces nombres mais dans son
 * architecture, écrite en dur dans `native/engines.h` : manetons à 0-120-240,
 * ordre d'allumage 1-5-3-6-2-4, donc un allumage tous les 120 degrés.
 * Parfaitement régulier, là où le V8 croisé grogne d'être inégal.
 *
 * Le reste — conduits, cames, admission — reprend les valeurs du Subaru EJ25,
 * faute d'un relevé. C'est une réserve, pas un choix.
 */
export const BMW_I6_3L: EngineDefinition = {
  cylinders: 6,
  // 84 mm.
  bore: 3.307,
  // 89,6 mm : la course dépasse l'alésage, comme sur les six de route.
  stroke: 3.528,
  // 135 mm.
  rodLength: 5.315,
  // 54 cc pour 496,5 cc par cylindre, soit un rapport de 10,2 — celui d'un
  // moteur atmosphérique de route.
  chamberVolume: 54,
  intakeRunnerVolume: 149.6,
  intakeRunnerArea: 4.84,
  exhaustRunnerVolume: 50,
  exhaustRunnerArea: 3.0625,
  lobeSeparation: 114,
  intakeLobeCenter: 114,
  exhaustLobeCenter: 114,
  intakeLift: 0.39,
  exhaustLift: 0.37,
  intakeDuration: 244,
  exhaustDuration: 236,
  plenumVolume: 1.325,
  intakeFlowRate: 800,
  idleThrottlePlate: 0.9985,
  // Un six en ligne a six primaires égales qui se rejoignent, et un tube long :
  // c'est ce qui lui donne sa note tenue.
  primaryTubeLength: 24,
  primaryFlowRate: 400,
  outletFlowRate: 1500,
  collectorVolume: 100,
  exhaustAudioVolume: 4,
  limiterDuration: 0.08,
  airNoise: 0.15,
  inputSampleNoise: 0,
  headerLength: 16,
}

export const ENGINE_LIBRARY: readonly LibraryEngine[] = [
  {
    id: 'gm-ls',
    label: 'GM LS — V8 5,7 L',
    short: 'GM LS',
    source: 'assets/engines/atg-video-2/07_gm_ls.mr',
    redlineRpm: 6500,
    definition: GM_LS_V8,
    // Le seul moteur réglé à ce jour, aux valeurs relevées par David.
    rendering: GM_LS_RENDERING,
  },
  {
    id: 'gm-ls-long-header',
    label: 'GM LS — V8 5,7 L, collecteur long',
    short: 'GM long',
    // Le fichier d'origine : c'est de là que vient la définition, et l'écart
    // qu'on lui fait subir est décrit sur `GM_LS_V8_LONG_HEADER`.
    source: 'assets/engines/atg-video-2/07_gm_ls.mr',
    redlineRpm: 6500,
    definition: GM_LS_V8_LONG_HEADER,
    // Le même rendu que le GM LS : c'est le même moteur, avec un échappement
    // plus long. Changer les deux à la fois empêcherait de savoir ce qu'on
    // entend.
    rendering: GM_LS_RENDERING,
  },
  {
    id: 'bmw-i6-3l',
    label: 'Six en ligne — 3,0 L',
    short: 'L6',
    // Pas de `source` : ce moteur n'est pas relevé d'un fichier d'engine-sim,
    // il est construit de mémoire. La définition le dit.
    redlineRpm: 7000,
    definition: BMW_I6_3L,
    rendering: DEFAULT_RENDERING,
  },
  {
    id: 'subaru-ej25',
    label: 'Subaru EJ25 — 4 cylindres',
    short: 'EJ25',
    source: 'assets/engines/atg-video-1/06_subaru_ej25.mr',
    redlineRpm: 6500,
    definition: SUBARU_EJ25,
    rendering: DEFAULT_RENDERING,
  },
  {
    id: 'chevrolet-454',
    label: 'Chevrolet 454 — V8 gros bloc',
    short: '454',
    source: 'assets/engines/chevrolet/chev_truck_454.mr',
    redlineRpm: 5500,
    definition: CHEVROLET_454,
    rendering: DEFAULT_RENDERING,
  },
  {
    id: 'chevrolet-454-comp-cams',
    label: 'Chevrolet 454 — V8 gros bloc, came Comp Cams',
    short: '454 Comp',
    source: 'assets/engines/chevrolet/engine_03_for_e1.mr',
    redlineRpm: 5500,
    definition: CHEVROLET_454_COMP_CAMS,
    rendering: DEFAULT_RENDERING,
  },
  {
    id: 'honda-b18c5',
    label: 'Honda B18C5 — 4 cylindres VTEC',
    short: 'B18C5',
    source: 'assets/engines/atg-video-1/05_honda_vtec.mr',
    redlineRpm: 8400,
    definition: HONDA_B18C5,
    rendering: DEFAULT_RENDERING,
  },
  {
    id: 'suzuki-hayabusa',
    label: 'Suzuki Hayabusa — 4 cylindres de moto',
    short: 'Hayabusa',
    source: 'assets/engines/atg-video-1/04_hayabusa.mr',
    redlineRpm: 11000,
    definition: SUZUKI_HAYABUSA,
    rendering: DEFAULT_RENDERING,
  },
  {
    id: 'subaru-ej25-equal-header',
    label: 'Subaru EJ25 — collecteur égal',
    short: 'EJ25 égal',
    source: 'assets/engines/atg-video-2/01_subaru_ej25_eh.mr',
    redlineRpm: 6500,
    definition: SUBARU_EJ25_EQUAL_HEADER,
    rendering: DEFAULT_RENDERING,
  },
  {
    id: 'subaru-ej25-unequal-header',
    label: 'Subaru EJ25 — collecteur inégal',
    short: 'EJ25 inégal',
    source: 'assets/engines/atg-video-2/02_subaru_ej25_uh.mr',
    redlineRpm: 6500,
    definition: SUBARU_EJ25_UNEQUAL_HEADER,
    rendering: DEFAULT_RENDERING,
  },
]

export function libraryEngine(id: string): LibraryEngine | undefined {
  return ENGINE_LIBRARY.find((entry) => entry.id === id)
}

/**
 * Les valeurs comparées pour reconnaître un moteur.
 *
 * Prises sur une définition de référence plutôt qu'écrites à la main : la liste
 * suit le contrat sans qu'on ait à la tenir à jour.
 */
const ENGINE_KEYS = Object.keys(GM_LS_V8) as (keyof EngineDefinition)[]

/** Combien de valeurs séparent une définition du moteur `entry`, rupteur compris. */
export function gapsToEngine(
  entry: LibraryEngine,
  definition: EngineDefinition,
  redlineRpm: number,
): number {
  let gaps = entry.redlineRpm === redlineRpm ? 0 : 1
  for (const key of ENGINE_KEYS) {
    if (Math.abs(entry.definition[key] - definition[key]) > 1e-9) gaps += 1
  }
  return gaps
}

/**
 * Au-delà de la moitié des valeurs changées, plus rien ne dit d'où l'on est
 * parti : ce n'est plus un moteur retouché, c'en est un autre. On préfère ne
 * rien affirmer plutôt que désigner un départ au hasard.
 */
export const ORIGIN_MAX_GAPS = Math.ceil((ENGINE_KEYS.length + 1) / 2)

/**
 * De quel moteur de la bibliothèque une définition est la plus proche, et de
 * combien de valeurs elle s'en écarte.
 *
 * Elle mesure et ne juge pas : c'est à l'écran de décider ce qu'il fait d'un
 * écart, en le comparant à `ORIGIN_MAX_GAPS`. Rend `null` seulement si la
 * bibliothèque est vide.
 */
export function closestLibraryEngine(
  definition: EngineDefinition,
  redlineRpm: number,
): { engine: LibraryEngine; gaps: number } | null {
  let best: { engine: LibraryEngine; gaps: number } | null = null
  for (const entry of ENGINE_LIBRARY) {
    const gaps = gapsToEngine(entry, definition, redlineRpm)
    if (best === null || gaps < best.gaps) best = { engine: entry, gaps }
  }
  return best
}
