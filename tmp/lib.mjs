// src/core/synth/rendering.ts
var MUFFLER_OUTSIDE_HZ = 22e3;
var DEFAULT_RENDERING = {
  throttleIdle: 0.06,
  throttleFull: 1,
  leveler: true,
  levelerGain: 1,
  // Nettement sous les 30 000 d'engine-sim : c'est la marge qui manquait.
  // Douze mille : la valeur mesurée propre sur un V8, 0,4 % d'échantillons
  // écrêtés contre 17,5 % à la cible d'origine d'engine-sim.
  levelerTarget: 12e3,
  convolver: true,
  // Cinquante millisecondes : la valeur trouvée à l'oreille. Deux cent vingt
  // étaient une salle, pas un échappement — à 800 tr/min un V8 explose toutes
  // les 19 ms, et douze explosions se superposaient dans la queue.
  convolverMs: 50,
  // Quarante-cinq pour cent, et pour tous les moteurs : la valeur que David
  // tenait sur le GM LS depuis le 6 septembre 2026, étendue à la bibliothèque le
  // 8 à sa demande. À cent pour cent, tout le son passait par la réponse
  // d'échappement — celle d'un V8 Chevrolet, y compris sous un quatre cylindres.
  convolverMix: 0.45,
  // La réponse du V8 Chevrolet 454, telle qu'engine-sim la livre. Une captation
  // réelle plutôt qu'un modèle : c'est la différence entre un échappement et
  // l'idée qu'on s'en fait.
  exhaustResponse: "smooth_39",
  // Trois mètres de tube, en gros. Ne sert qu'à la réponse fabriquée.
  exhaustHz: 57,
  // Coupé, c'est-à-dire dehors. Il avait été mis à 1 kHz pour masquer un
  // parasite dont on a depuis trouvé la cause : les deux bruits d'engine-sim.
  // Une fois ceux-ci réglés, le spectre décroît tout seul.
  mufflerHz: MUFFLER_OUTSIDE_HZ
};

// src/core/preset/defaults.ts
var GM_LS_RENDERING = {
  ...DEFAULT_RENDERING,
  /**
   * Seize mille, et non trente-deux mille.
   *
   * La crête visée était réglée tout contre le plafond des entiers 16 bits, et
   * cela s'entendait : David, le 8 septembre 2026, « de petits moments où tout
   * d'un coup le bruit part en écrêtage, 2-3 %, mais c'est très audible ».
   *
   * Mesuré au ralenti, V8 à 780 tr/min, part d'échantillons butés sur le
   * plafond — moyenne, puis pointe sur une fenêtre de vingt millisecondes :
   *
   * | volume | cible  | moyenne | pointe |
   * |--------|--------|---------|--------|
   * | 0,7    | 32 000 | 0,51 %  | 1,17 % |
   * | 1      | 32 000 | 1,26 %  | 2,73 % |
   * | 1      | 24 000 | 0,92 %  | 1,95 % |
   * | 1      | 16 000 | 0,02 %  | 0,39 % |
   * | 1      | 12 000 | 0,00 %  | 0,00 % |
   *
   * Le volume de la synthèse valant désormais un pour tout le monde, trente-deux
   * mille donnait la ligne du milieu — les 2-3 % entendus. Seize mille les
   * ramène à deux centièmes de pour cent. Le niveau perdu se rattrape avec le
   * volume de l'appareil, en flottant, où rien ne plafonne.
   */
  levelerTarget: 16e3
};
var GM_LS_V8 = {
  cylinders: 8,
  bore: 3.78,
  stroke: 3.622,
  rodLength: 6.299,
  // Avec l'alésage réel de 3,78 pouces, 90 cc donne 8,4:1. Le GM LS livré avec
  // engine-sim est un 5,7 litres, pas un LS3 — je l'avais pris pour tel.
  chamberVolume: 90,
  intakeRunnerVolume: 149.6,
  // 2,2 × 2,2 pouces.
  intakeRunnerArea: 4.84,
  exhaustRunnerVolume: 50,
  // 1,75 × 1,75 pouces.
  exhaustRunnerArea: 3.0625,
  lobeSeparation: 114,
  // Relevé dans le fichier : le nœud de came le passe explicitement, là où la
  // première version avait pris le défaut de la structure.
  intakeLobeCenter: 116,
  exhaustLobeCenter: 116,
  intakeLift: 0.551,
  exhaustLift: 0.551,
  intakeDuration: 234,
  exhaustDuration: 235,
  plenumVolume: 1.325,
  intakeFlowRate: 700,
  // 0,9985, jugé à l'oreille et non relevé : le GM LS déclare 0,996, et à cette
  // valeur le ralenti craque et sort des fréquences parasites. 0,9975 et 0,9985
  // sont équivalents et nettement meilleurs. C'est la valeur que le code portait
  // avant que je la remplace par le défaut de la structure C++.
  idleThrottlePlate: 0.9985,
  // Vingt-neuf pouces de primaire : c'est ce qui fait la résonance grave d'un V8
  // américain, là où l'EJ25 n'en a que dix.
  primaryTubeLength: 29,
  primaryFlowRate: 500,
  outletFlowRate: 1e3,
  collectorVolume: 100,
  exhaustAudioVolume: 4,
  limiterDuration: 0.2,
  airNoise: 0.15,
  inputSampleNoise: 0.05,
  headerLength: 6.8
};
var SUBARU_EJ25 = {
  cylinders: 4,
  bore: 3.917,
  stroke: 3.11,
  rodLength: 5.142,
  chamberVolume: 67,
  intakeRunnerVolume: 149.6,
  // 1,35 × 1,35 pouces.
  intakeRunnerArea: 1.8225,
  exhaustRunnerVolume: 50,
  // 1,25 × 1,25 pouces.
  exhaustRunnerArea: 1.5625,
  lobeSeparation: 114,
  // Relevé dans le fichier : le nœud de came le passe explicitement, là où la
  // première version avait pris le défaut de la structure.
  intakeLobeCenter: 117,
  exhaustLobeCenter: 112,
  intakeLift: 0.385,
  exhaustLift: 0.378,
  intakeDuration: 232,
  exhaustDuration: 236,
  plenumVolume: 1.325,
  intakeFlowRate: 800,
  // La valeur du fichier, et celle que l'oreille confirme.
  idleThrottlePlate: 0.9985,
  primaryTubeLength: 10,
  primaryFlowRate: 200,
  outletFlowRate: 1e3,
  collectorVolume: 100,
  exhaustAudioVolume: 4,
  limiterDuration: 0.08,
  airNoise: 0.15,
  inputSampleNoise: 0.05,
  headerLength: 10
};

// src/core/preset/engine-library.ts
var CHEVROLET_454 = {
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
  inputSampleNoise: 0.05,
  headerLength: 20
};
var CHEVROLET_454_COMP_CAMS = {
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
  exhaustAudioVolume: 1
};
var HONDA_B18C5 = {
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
  outletFlowRate: 1e3,
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
  inputSampleNoise: 0.05,
  headerLength: 10
};
var SUZUKI_HAYABUSA = {
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
  outletFlowRate: 1e3,
  collectorVolume: 10,
  // `audio_volume: 1.0 * 0.25` sur le premier échappement. Le niveleur du banc
  // rattrape l'écart de niveau avec les autres moteurs.
  exhaustAudioVolume: 0.25,
  limiterDuration: 0.05,
  // Le fichier déclare `noise: 0.292` et `jitter: 0.062` ; même écart assumé
  // que pour le B18C5.
  airNoise: 0.15,
  inputSampleNoise: 0.05,
  headerLength: 10
};
var SUBARU_EJ25_EQUAL_HEADER = {
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
  outletFlowRate: 1e3,
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
  inputSampleNoise: 0.05,
  headerLength: 10
};
var SUBARU_EJ25_UNEQUAL_HEADER = {
  ...SUBARU_EJ25_EQUAL_HEADER,
  primaryTubeLength: 24,
  headerLength: 10
};
var GM_LS_V8_LONG_HEADER = {
  ...GM_LS_V8,
  primaryTubeLength: 30,
  primaryFlowRate: 1e3,
  outletFlowRate: 2e3,
  headerLength: 30
};
var ENGINE_LIBRARY = [
  {
    id: "gm-ls",
    label: "GM LS \u2014 V8 5,7 L",
    short: "GM LS",
    source: "assets/engines/atg-video-2/07_gm_ls.mr",
    redlineRpm: 6500,
    definition: GM_LS_V8,
    // Le seul moteur réglé à ce jour, aux valeurs relevées par David.
    rendering: GM_LS_RENDERING
  },
  {
    id: "gm-ls-long-header",
    label: "GM LS \u2014 V8 5,7 L, collecteur long",
    short: "GM long",
    // Le fichier d'origine : c'est de là que vient la définition, et l'écart
    // qu'on lui fait subir est décrit sur `GM_LS_V8_LONG_HEADER`.
    source: "assets/engines/atg-video-2/07_gm_ls.mr",
    redlineRpm: 6500,
    definition: GM_LS_V8_LONG_HEADER,
    // Le même rendu que le GM LS : c'est le même moteur, avec un échappement
    // plus long. Changer les deux à la fois empêcherait de savoir ce qu'on
    // entend.
    rendering: GM_LS_RENDERING
  },
  {
    id: "subaru-ej25",
    label: "Subaru EJ25 \u2014 4 cylindres",
    short: "EJ25",
    source: "assets/engines/atg-video-1/06_subaru_ej25.mr",
    redlineRpm: 6500,
    definition: SUBARU_EJ25,
    rendering: DEFAULT_RENDERING
  },
  {
    id: "chevrolet-454",
    label: "Chevrolet 454 \u2014 V8 gros bloc",
    short: "454",
    source: "assets/engines/chevrolet/chev_truck_454.mr",
    redlineRpm: 5500,
    definition: CHEVROLET_454,
    rendering: DEFAULT_RENDERING
  },
  {
    id: "chevrolet-454-comp-cams",
    label: "Chevrolet 454 \u2014 V8 gros bloc, came Comp Cams",
    short: "454 Comp",
    source: "assets/engines/chevrolet/engine_03_for_e1.mr",
    redlineRpm: 5500,
    definition: CHEVROLET_454_COMP_CAMS,
    rendering: DEFAULT_RENDERING
  },
  {
    id: "honda-b18c5",
    label: "Honda B18C5 \u2014 4 cylindres VTEC",
    short: "B18C5",
    source: "assets/engines/atg-video-1/05_honda_vtec.mr",
    redlineRpm: 8400,
    definition: HONDA_B18C5,
    rendering: DEFAULT_RENDERING
  },
  {
    id: "suzuki-hayabusa",
    label: "Suzuki Hayabusa \u2014 4 cylindres de moto",
    short: "Hayabusa",
    source: "assets/engines/atg-video-1/04_hayabusa.mr",
    redlineRpm: 11e3,
    definition: SUZUKI_HAYABUSA,
    rendering: DEFAULT_RENDERING
  },
  {
    id: "subaru-ej25-equal-header",
    label: "Subaru EJ25 \u2014 collecteur \xE9gal",
    short: "EJ25 \xE9gal",
    source: "assets/engines/atg-video-2/01_subaru_ej25_eh.mr",
    redlineRpm: 6500,
    definition: SUBARU_EJ25_EQUAL_HEADER,
    rendering: DEFAULT_RENDERING
  },
  {
    id: "subaru-ej25-unequal-header",
    label: "Subaru EJ25 \u2014 collecteur in\xE9gal",
    short: "EJ25 in\xE9gal",
    source: "assets/engines/atg-video-2/02_subaru_ej25_uh.mr",
    redlineRpm: 6500,
    definition: SUBARU_EJ25_UNEQUAL_HEADER,
    rendering: DEFAULT_RENDERING
  }
];
function libraryEngine(id) {
  return ENGINE_LIBRARY.find((entry) => entry.id === id);
}
var ENGINE_KEYS = Object.keys(GM_LS_V8);
function gapsToEngine(entry, definition, redlineRpm) {
  let gaps = entry.redlineRpm === redlineRpm ? 0 : 1;
  for (const key of ENGINE_KEYS) {
    if (Math.abs(entry.definition[key] - definition[key]) > 1e-9) gaps += 1;
  }
  return gaps;
}
var ORIGIN_MAX_GAPS = Math.ceil((ENGINE_KEYS.length + 1) / 2);
function closestLibraryEngine(definition, redlineRpm) {
  let best = null;
  for (const entry of ENGINE_LIBRARY) {
    const gaps = gapsToEngine(entry, definition, redlineRpm);
    if (best === null || gaps < best.gaps) best = { engine: entry, gaps };
  }
  return best;
}
export {
  CHEVROLET_454,
  CHEVROLET_454_COMP_CAMS,
  ENGINE_LIBRARY,
  GM_LS_V8_LONG_HEADER,
  HONDA_B18C5,
  ORIGIN_MAX_GAPS,
  SUBARU_EJ25_EQUAL_HEADER,
  SUBARU_EJ25_UNEQUAL_HEADER,
  SUZUKI_HAYABUSA,
  closestLibraryEngine,
  gapsToEngine,
  libraryEngine
};
