import { DEFAULT_RENDERING, type SynthRendering } from '../synth/rendering'
// Le profil de la banque de démonstration, repris tel quel du fichier que le
// générateur produit : ses gains et ses ancrages sont mesurés prise par prise.
import GM_LS_BANK from './gm-ls-profile.json'
import GM_LS_LONG_BANK from './gm-ls-long-header-profile.json'
import BMW_I6_BANK from './bmw-i6-3l-profile.json'
import SUBARU_EJ25_BANK from './subaru-ej25-profile.json'
import { clampEngineDefinition } from './engine-definition'
import type { EngineDefinition, Profile } from './schema'

/**
 * Comment le GM LS se rend, relevé par David au banc le 6 septembre 2026.
 *
 * La résonance à 0,45 est le cœur du réglage : à 1,00 — l'ancien défaut — plus
 * rien du son direct n'atteignait la sortie, et « on n'a plus du tout le son
 * rauque ». À 0,00, « le rauque revient franchement ». Il s'est arrêté entre
 * les deux.
 *
 * La crête visée au maximum avec un volume de 0,70 fait écrêter la sortie.
 * C'est assumé : passer de « n'écrête pas du tout » à « écrête sec » a été
 * essayé deux fois sans qu'aucune différence s'entende.
 *
 * Il vit ici et non dans la bibliothèque de moteurs parce que le profil d'usine
 * s'en sert aussi, et que la bibliothèque lit déjà ce fichier.
 */
export const GM_LS_RENDERING: SynthRendering = {
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
  levelerTarget: 16000,
}

/**
 * Le V8 américain d'engine-sim, un GM LS.
 *
 * Les valeurs viennent de la définition livrée avec engine-sim, relevées dans
 * `native/CONTRAT-MOTEUR.md`. Elles servent de repère autant que de départ :
 * s'en écarter est un choix, pas un accident, et l'écran de synthèse affiche la
 * valeur de référence à côté de celle qu'on a réglée.
 *
 * C'est ce moteur-là que portent les deux profils livrés — leur banque
 * d'échantillons est celle d'un V8.
 */
export const GM_LS_V8: EngineDefinition = {
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
  outletFlowRate: 1000,
  collectorVolume: 100,
  exhaustAudioVolume: 4,
  limiterDuration: 0.2,
  airNoise: 0.15,
  // Zéro, et c'est mesuré. La gigue d'engine-sim est une ligne à retard dont la
  // position de lecture est tirée au sort à chaque échantillon : elle ne fait pas
  // vibrer le moteur, elle crépite. Mesuré sur le GM LS au ralenti, ce qu'elle
  // ajoute rien qu'à 0,05 — la valeur que le projet portait, jugée à l'oreille
  // sans être mesurée : 8,7 dB à 5 600 Hz et 25,5 dB à 8 000 Hz. C'est le
  // cliquetis que David a traqué toute la journée du 8 septembre 2026, décrit
  // comme « des frt frt frt à plus haute fréquence que le moteur ». À zéro,
  // « le claquement est supprimé ».
  //
  // Le curseur reste : la gigue est un caractère de moteur, et les fichiers
  // d'engine-sim en déclarent jusqu'à 0,5. Mais elle ne s'allume plus toute
  // seule.
  inputSampleNoise: 0,
  headerLength: 6.8,
}

/**
 * Le quatre cylindres à plat de Subaru, un EJ25.
 *
 * Même origine que le V8 : la définition livrée avec engine-sim. Il n'est porté
 * par aucun profil livré — la banque d'échantillons de l'application est celle
 * d'un V8 — mais il sert de second point de départ sur le banc de réglage.
 */
export const SUBARU_EJ25: EngineDefinition = {
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
  outletFlowRate: 1000,
  collectorVolume: 100,
  exhaustAudioVolume: 4,
  limiterDuration: 0.08,
  airNoise: 0.15,
  inputSampleNoise: 0,
  headerLength: 10,
}

/** Les définitions de référence, dans l'ordre où le banc les propose. */
export const ENGINE_REFERENCES = [
  { id: 'gm-ls', label: 'GM LS — V8', definition: GM_LS_V8 },
  { id: 'subaru-ej25', label: 'Subaru EJ25 — 4 cylindres', definition: SUBARU_EJ25 },
] as const

export type EngineReferenceId = (typeof ENGINE_REFERENCES)[number]['id']

/**
 * Régime moteur atteint dans le dernier rapport à une vitesse donnée.
 * Sert à afficher, dans l'écran de configuration, un chiffre parlant
 * (« rupteur atteint à X km/h ») plutôt que le rapport de pont brut.
 */
export function rpmAtSpeed(
  kmh: number,
  gearRatio: number,
  finalDrive: number,
  wheelRadiusM: number,
): number {
  const wheelRps = kmh / 3.6 / (2 * Math.PI * wheelRadiusM)
  return wheelRps * 60 * gearRatio * finalDrive
}

/** Réciproque : le pont qu'il faut pour atteindre `rpm` à `kmh` dans ce rapport. */
export function finalDriveFor(
  rpm: number,
  kmh: number,
  gearRatio: number,
  wheelRadiusM: number,
): number {
  const wheelRps = kmh / 3.6 / (2 * Math.PI * wheelRadiusM)
  return rpm / (wheelRps * 60 * gearRatio)
}

/**
 * Profil de départ, calé sur le jeu d'échantillons présent dans `audio/v8-musclecar/`.
 *
 * Les régimes d'ancrage viennent d'une mesure du pic d'allumage de chaque
 * fichier (V8 quatre temps, f = rpm / 120 × 8). Celui de `off-high` est le moins
 * sûr : les prises en décélération sont des rampes, le régime y dérive sur la
 * durée de la boucle. À ajuster à l'oreille dans l'éditeur.
 */
/**
 * Profil calibré pour la conduite ordinaire.
 *
 * Le profil sportif exploite une plage que l'on n'atteint jamais : à 130 km/h en
 * dernier rapport il ne tourne qu'à un tiers de son rupteur, si bien que la
 * moitié haute de la boîte ne sert à rien et que les rapports courts, eux,
 * hurlent en ville. Le son se joue alors toujours dans le même registre.
 *
 * Ici tout est resserré sur les vitesses réellement pratiquées. Le pont est plus
 * long, le rupteur plus bas — celui d'un moteur de série, non d'un moteur de
 * course — et les régimes de passage placent chaque rapport là où on l'utilise :
 * la première jusqu'à trente-cinq, la sixième au-delà de cent quinze. Les six
 * rapports servent donc entre zéro et cent trente, et chacun tourne autour de
 * deux mille huit cents tours à sa vitesse de croisière.
 *
 * Pied au plancher, l'écart de charge fait monter les passages jusqu'aux trois
 * quarts du rupteur : il reste de quoi s'amuser, sans que ce soit le régime
 * ordinaire.
 */
export function createRoadProfile(): Profile {
  const base = createDefaultProfile()
  return {
    ...base,
    id: 'route',
    name: 'Route',
    favorite: true,
    engine: {
      ...base.engine,
      idleRpm: 800,
      // Un peu plus de la moitié au-dessus du ralenti : c'est à ce régime qu'on
      // lâche l'embrayage sans forcer.
      launchRpm: 1300,
      softLimitRpm: 6300,
      redlineRpm: 6500,
      inertia: 1.2,
      freeRevRate: 6000,
      engineBraking: 4000,
      // Un moteur de série tremble moins qu'un moteur de sport : vingt-cinq
      // tours au ralenti contre trente-cinq. Mesuré, 24 tr/min d'excursion au
      // ralenti et ±11 à 3000 tr/min pied levé. La fréquence, elle, reste celle
      // du profil de base : c'est l'amplitude qui sépare les deux.
      flutterRpm: 25,
    },
    drivetrain: {
      ...base.drivetrain,
      // Pont allongé : la sixième tourne à 2780 tr/min à 130 km/h, une croisière
      // tenable, au lieu de 3390.
      finalDrive: 3.7,
      shiftTimeMs: 600,
      /*
       * Sept rapports, et le haut réétagé — sortie du 11 septembre 2026.
       *
       * Les trois premiers ne bougent pas : le départ mesuré ce soir-là est
       * celui que David a jugé « parfait », et il tient à eux. Les quatre
       * autres sont redessinés depuis les vitesses qu'il a nommées, avec une
       * septième pour l'autoroute :
       *
       *   50 km/h en quatrième   1 487 tr/min
       *   80 km/h en cinquième   1 737 tr/min
       *  110 km/h en sixième     1 734 tr/min
       *  130 km/h en septième    1 508 tr/min
       *
       * L'ancienne boîte tournait à 2 046 à 80 et 2 355 à 110 — « trop haut »,
       * et les sauts s'écrasaient en haut (1,32 · 1,20 · 1,19) au lieu de
       * s'étaler. Ils valent maintenant 1,36 · 1,37 · 1,38 · 1,36.
       */
      gearRatios: [3.55, 2.04, 1.36, 1.0, 0.73, 0.53, 0.39],
      // Un seuil par rapport sauf le dernier. Depuis le lot PLANCHER, le
      // moment du passage se décide sur le régime du rapport visé ; cette table
      // ne sert plus qu'à reconnaître le tempérament de la boîte.
      upshiftRpm: [3700, 3350, 3050, 2950, 2950, 2950],
      upshiftLoadSpreadRpm: 1600,
      upshiftJitterRpm: 120,
      minUpshiftRpm: 2300,
      firstGearLaunchOnly: true,
      launchUpshiftKmh: 5,
      downshiftAtRedlineRatio: 0.28,
      // Croisière basse, mais pas au point de brouter ni de jouer les
      // échantillons trop grave. Passé de 1500 à 1400 avec les sept rapports :
      // la croisière se tient maintenant entre 1487 et 1954 tr/min de 50 à
      // 130 km/h, contre 1532 à 2355 avant. C'est la moitié basse de la prise
      // bas régime, ancrée à 3128 tr/min — et ce que ça donne à l'oreille reste
      // à écouter.
      cruiseMinRpm: 1400,
      // Il monte volontiers : deux secondes et deux dixièmes de vitesse stable
      // suffisent.
      cruiseUpshiftAfterS: 2.2,
      // Et il ne descend que sur un freinage franc, pas sur un lever de pied.
      brakeDownshiftAccelMs2: -1,
      shiftDelaysS: [0.3, 0.55, 0.4, 0.6, 0.35, 0.5, 0.45],
    },
    feel: {
      ...base.feel,
      kickdown: { ...base.feel.kickdown, targetRpmFraction: 0.55, maxGears: 2 },
      // Une voiture de série pétarade peu, et pas à n'importe quel régime.
      backfire: { ...base.feel.backfire, minRpm: 3200, intensity: 0.25, count: 3 },
      shiftJolt: { ...base.feel.shiftJolt, depth: 0.1 },
    },
    mix: {
      ...base.mix,
      // La bascule suit la plage réellement parcourue, bien plus basse.
      crossfadeLowRpm: 2600,
      crossfadeHighRpm: 5200,
      fullLoadAccelMs2: 2,
      // Tenir 130 consomme la moitié de la charge disponible : une berline de
      // série y est déjà à un vrai effort, sans être à sa limite.
      dragRefKmh: 130,
      loadSmoothingS: 0.22,
      offLoadGain: 1,
      loadContrast: 0.65,
      drive: 0.12,
      // Plus mesuré que Sport : 8 dB entre lever le pied et écraser, et 3 dB de
      // rugissement qui s'ajoutent aux 4 dB que la banque donne déjà.
      loadReliefDb: 4,
      rpmReliefDb: 3,
      // Recalé de −5 à −1 avec l'arrivée de l'effort : à l'arrêt, l'effort vaut
      // zéro là où la charge valait un demi sans raison, et le relief de charge
      // retire donc ses 4 dB pleins. Le ralenti retrouve le niveau qu'il avait.
      idleLevelDb: -1,
      // Plus mesuré aussi sur le désaccord : huit centièmes de demi-ton, soit un
      // battement à 1,2 Hz au milieu de la bascule (3900 tr/min).
      layerDetuneCents: 8,
      // La boucle la plus courte, étirée par la vitesse de lecture, se referme
      // en quatre secondes. Six secondes de moyenne la laissent se répéter une
      // à deux fois, jamais le même nombre de fois : le motif ne s'installe pas.
      layerRefreshS: 6,
    },
  }
}

/** Les profils livrés avec l'application. */
/**
 * Le profil livré : un seul, nommé d'après ce qu'on entend.
 *
 * Il y en avait deux, Route et Sport, et leur différence tenait à leurs seuils
 * de passage. Depuis que ceux-ci se déduisent du rupteur et du **tempérament**,
 * cette différence a déménagé : garder deux profils reviendrait à proposer deux
 * fois le même moteur avec deux tempéraments figés, alors que le tempérament se
 * choisit maintenant sur la touche de marche, entre les cadrans.
 *
 * Décidé par David le 10 septembre 2026 : « les profils par défaut s'appelleront
 * autrement (L4, V8, etc.) et pour le moment on a juste le V8 de Procar, donc
 * appelons-le V8 ». Un profil se nomme donc d'après son moteur, et non d'après
 * une façon de conduire — c'était la source de la confusion, deux boutons
 * « Route / Sport » à l'écran ne commandant pas la même chose.
 *
 * **Son calibrage est celui de l'ancien profil Route**, et non de Sport : rupteur
 * à 6 500 tr/min, qui est celui du GM LS livré, et des rapports placés sur les
 * vitesses qu'on pratique vraiment. Le nerf se prend maintenant au tempérament.
 */
export function createV8Profile(): Profile {
  return { ...createRoadProfile(), id: 'v8', name: 'V8 musclecar' }
}

/**
 * Un profil d'usine bâti sur une banque livrée.
 *
 * Les valeurs viennent du fichier produit par le générateur, repris tel quel :
 * les gains, les ancrages et les bornes de lecture y sont **mesurés**, prise par
 * prise, et les réécrire à la main reviendrait à les inventer. Ce qui n'est pas
 * du son — la boîte, la conduite, le tempérament — vient du calibrage commun.
 *
 * Le moteur de chacune est **simulé**, produit au banc par
 * `scripts/generate-bank/`, et l'aide le dit à l'écran. Une prise sur une vraie
 * voiture appartient à qui l'a faite, et le projet ne redistribue que ce qu'il a
 * le droit de redistribuer.
 */
function createBankProfile(id: string, bank: typeof GM_LS_BANK): Profile {
  const base = createRoadProfile()
  return {
    ...base,
    id,
    name: bank.name,
    soundSource: 'prerendered',
    sampleDir: bank.sampleDir,
    engine: { ...base.engine, ...bank.engine },
    mix: { ...base.mix, ...bank.mix },
    layers: bank.layers.map((couche) => ({ ...couche })),
    engineDefinition: clampEngineDefinition({
      ...(base.engineDefinition ?? {}),
      ...bank.engineDefinition,
    }),
  } as Profile
}

/** Le V8 croisé, et c'est lui qu'on entend au premier lancement. */
export function createGmLsProfile(): Profile {
  return { ...createBankProfile('gm-ls', GM_LS_BANK), favorite: true }
}

/** Le même V8 avec l'échappement que David a trouvé à l'oreille. */
export function createGmLsLongHeaderProfile(): Profile {
  return createBankProfile('gm-ls-long-header', GM_LS_LONG_BANK)
}

/**
 * Le six en ligne, l'architecture des BMW.
 *
 * Livré depuis le 14 septembre 2026, à la demande de David. C'est le seul dont
 * les cotes ne sont pas relevées d'un fichier d'engine-sim mais construites de
 * mémoire, et le seul dont l'échappement est un 6-en-2 — deux lignes de trois
 * cylindres, qui lui valent 12 dB de plus entre 4 et 8 kHz.
 */
export function createBmwI6Profile(): Profile {
  return createBankProfile('bmw-i6-3l', BMW_I6_BANK)
}

/** Le quatre cylindres à plat. */
export function createSubaruEj25Profile(): Profile {
  return createBankProfile('subaru-ej25', SUBARU_EJ25_BANK)
}

/**
 * Les profils livrés, et l'ordre décide du premier son.
 *
 * Au tout premier lancement, le profil actif est le premier de cette liste : le
 * **V8 croisé**, choisi par David le 14 septembre 2026 après avoir écouté les
 * trois — « les V8 sonnent bien mieux que les 4L ».
 *
 * Les trois sonnent à coup sûr : leurs banques sont dans le dépôt et dans
 * l'image. Ce n'était le cas que d'une seule, et le profil V8 livré désignait
 * une banque enregistrée qu'on n'a pas le droit de redistribuer — donc muet chez
 * qui découvrait le projet.
 *
 * Cela ne change rien pour une installation déjà en service : les profils
 * enregistrés sont relus tels quels, et la restauration des profils d'usine ne
 * se déclenche que sur demande.
 */
export function createFactoryProfiles(): Profile[] {
  // Par nombre de cylindres décroissant : les deux huit, puis le six, puis le
  // quatre. Seule la première place décide de quelque chose — c'est le profil
  // actif au premier lancement — et c'est le V8 croisé, choisi à l'oreille.
  return [
    createGmLsProfile(),
    createGmLsLongHeaderProfile(),
    createBmwI6Profile(),
    createSubaruEj25Profile(),
  ]
}

/**
 * Les profils d'usine réglés sur une banque **déposée**, et non livrée.
 *
 * Ils ne peuvent pas partir avec l'application : leurs échantillons sont des
 * prises sur de vraies voitures, que le projet n'a pas le droit de
 * redistribuer. Mais chez qui a la banque, le profil doit exister — sans quoi
 * il faudrait le ressaisir couche par couche.
 *
 * « Profils d'usine » les propose donc quand le serveur liste leur banque, et
 * jamais sinon. C'est la seule liste dont l'affichage dépend de ce qu'il y a en
 * face.
 */
export function depositFactoryProfiles(): Profile[] {
  return [createV8Profile()]
}

/**
 * Les calibrages d'usine connus, y compris ceux qui ne sont plus livrés.
 *
 * La reprise d'un profil enregistré cherche ici sa base par identifiant. Sans
 * les anciens, un profil « Route » enregistré se verrait complété avec les
 * valeurs de Sport — le défaut exact que la reprise par identifiant avait
 * corrigé, et qui avait fait porter les essais sur route sur des valeurs que
 * personne n'avait choisies.
 *
 * `createV8Profile` n'est plus livré depuis le 14 septembre 2026 — sa banque
 * est une prise sur une vraie voiture, qu'on n'a pas le droit de
 * redistribuer — mais il reste ici : c'est le profil que David a enregistré, et
 * il doit continuer d'être repris avec son calibrage à lui.
 */
export function knownFactoryProfiles(): Profile[] {
  return [
    createGmLsProfile(),
    createGmLsLongHeaderProfile(),
    createBmwI6Profile(),
    createSubaruEj25Profile(),
    createV8Profile(),
    createRoadProfile(),
    createDefaultProfile(),
  ]
}

/**
 * L'ancien profil « Sport », gardé pour la reprise.
 *
 * Son identifiant reste `procar`, alors que la banque a été renommée le
 * 14 septembre 2026 : c'est la clé par laquelle un profil enregistré retrouve sa
 * base, et la changer ferait compléter un « Sport » enregistré avec les valeurs
 * d'un autre. Un identifiant ne s'affiche nulle part et ne sort pas du
 * navigateur, sauf dans un profil exporté.
 */
export function createDefaultProfile(): Profile {
  return {
    id: 'procar',
    name: 'Sport',
    favorite: true,
    // Les deux profils livrés sonnent par échantillons : c'est la seule origine
    // gréée, et la banque de `v8-musclecar/` est ce sur quoi ils sont réglés.
    soundSource: 'recorded',
    // Le moteur simulé est décrit même sur un profil qui sonne par échantillons :
    // c'est ce qui permet de basculer son origine en direct et d'entendre quelque
    // chose, plutôt que d'avoir à décrire un moteur de zéro avant le premier son.
    engineDefinition: { ...GM_LS_V8 },
    // Et comment il se rend, pour la même raison : basculer l'origine du son en
    // direct doit donner quelque chose d'écoutable, pas un moteur non réglé.
    // Ce sont les valeurs du GM LS en bibliothèque, relevées par David.
    rendering: { ...GM_LS_RENDERING },
    sampleDir: 'v8-musclecar',
    engine: {
      cylinders: 8,
      idleRpm: 780,
      // Plus haut que sur le profil Route : on ne démarre pas une sportive au
      // ralenti.
      launchRpm: 1500,
      softLimitRpm: 8200,
      redlineRpm: 8500,
      limiterHoldMs: 120,
      inertia: 1,
      freeRevRate: 9000,
      engineBraking: 5000,
      // Un moteur de sport a un ralenti franchement instable. Mesuré : 34 tr/min
      // d'excursion au ralenti, ±18 à 3000 tr/min pied levé, ±7 à 3000 tr/min
      // pleine charge.
      flutterRpm: 35,
      flutterHz: 6,
    },
    drivetrain: {
      gearRatios: [3.55, 2.04, 1.36, 1.03, 0.86, 0.72],
      finalDrive: 4.5,
      wheelRadiusM: 0.33,
      shiftTimeMs: 480,
      // Croissants : les rapports courts passent tôt, les longs étirent
      // davantage. C'est l'inverse qu'un seuil unique produisait.
      upshiftRpm: [5200, 5600, 5900, 6200, 6500],
      upshiftLoadSpreadRpm: 1800,
      upshiftJitterRpm: 150,
      minUpshiftRpm: 2600,
      firstGearLaunchOnly: true,
      launchUpshiftKmh: 8,
      downshiftAtRedlineRatio: 0.32,
      // Croisière haute : sur un profil sportif, tenir une vitesse ne doit pas
      // finir sur le dernier rapport au ralenti. À 2000, 70 km/h tenus se
      // stabilisent en cinquième à 2178 tr/min plutôt qu'en sixième à 1823.
      cruiseMinRpm: 2000,
      // Et il garde ses rapports : trois secondes et demie de vitesse stable
      // avant de monter, contre deux et deux dixièmes sur Route.
      cruiseUpshiftAfterS: 3.5,
      // Il descend volontiers pour ralentir, dès une décélération modérée.
      brakeDownshiftAccelMs2: -0.7,
      // Volontairement irrégulières : des temporisations égales donnent une
      // boîte qui sonne comme un métronome. Courtes, en revanche — elles
      // confirment une intention, elles ne retiennent pas le passage.
      shiftDelaysS: [0.25, 0.5, 0.35, 0.55, 0.3, 0.45],
    },
    speed: {
      springOmega: 14,
      accelWindowMs: 1000,
      maxPlausibleKmh: 260,
      // Resserré de 250 à 50 le 17 septembre 2026, sur relevé. Un point
      // satellite s'annonce à quelques mètres ou quelques dizaines de mètres,
      // même mal placé ; une position obtenue sans satellites s'annonce à
      // plusieurs centaines. Ce seuil passe entre les deux familles.
      //
      // Mesuré sur les 56 000 relevés des trois trajets du 16 septembre : la
      // précision annoncée par la Tesla vaut 1,2 à 1,4 m en médiane, en ville
      // comme sur autoroute, avec un p95 sous 3,5 m et un maximum utile de
      // 25,9 m. En face, les positions rejetées portent toutes la même valeur
      // — 9 999,99 m, une sentinelle. Il n'y a rien entre les deux familles, et
      // 50 laisse encore le double du pire cas utile.
      maxAccuracyM: 50,
      minAccelMs2: -14,
      maxAccelMs2: 14,
    },
    mix: {
      crossfadeLowRpm: 3200,
      crossfadeHighRpm: 7000,
      fullLoadAccelMs2: 2.5,
      // Plus haut que Route : un profil sportif a de la réserve, et sa traînée
      // ne doit pas peser aussi tôt.
      dragRefKmh: 150,
      loadSmoothingS: 0.18,
      // Neutre : la compensation des prises plus douces est passée dans le gain
      // de chaque couche, où le déficit se mesure. Ce réglage reste disponible
      // comme curseur de goût sur toute la famille « pied levé ».
      offLoadGain: 1,
      loadContrast: 0.75,
      idleFadeOutRpm: 1400,
      highpassHz: 45,
      drive: 0.15,
      limiterThresholdDb: -1.5,
      // Un profil sportif exagère l'effort : 10 dB entre lever le pied et
      // écraser, et un rugissement franc en haut des tours.
      loadReliefDb: 5,
      rpmReliefDb: 4,
      // Recalé de −5 à 0 : cinq décibels de relief de charge que l'effort nul
      // retire désormais au ralenti.
      idleLevelDb: 0,
      // Douze centièmes de demi-ton entre les deux couches d'une famille.
      // Mesuré : un battement à 2,4 Hz au milieu de la bascule (5100 tr/min),
      // 1,5 Hz au début (3200).
      layerDetuneCents: 12,
      layerRefreshS: 6,
    },
    feel: {
      kickdown: {
        enabled: true,
        // On vise le milieu haut de la plage : assez pour que ça pousse, sans
        // aller chercher le rupteur à chaque sollicitation.
        targetRpmFraction: 0.62,
        maxGears: 3,
      },
      backfire: {
        enabled: true,
        minRpm: 4000,
        intensity: 0.45,
        count: 4,
      },
      shiftJolt: {
        enabled: true,
        // Le creux de niveau était à 0,55, et il masquait ce qu'il devait
        // souligner : l'instant où le timbre bascule vers le pied levé est
        // aussi celui où le son est le plus faible. VNS, dont le passage
        // s'entend bien, n'a aucun équivalent de ce creux.
        depth: 0.15,
        cutDepth: 0.8,
        dipRpm: 450,
        blipRpm: 550,
        // Le clac de la montée a perdu trente pour cent après la sortie du
        // 11 septembre 2026 — David : « diminuer le son du claquement quand on
        // monte d'un rapport, quand on rétrograde c'est bien comme ça ». Puis
        // encore un tiers après celle du 16 : « ça claque encore un peu trop
        // fort à la montée ». Il est donc à la moitié de sa valeur d'origine.
        //
        // L'amplitude vaut `clack` à la montée et `clack × clackDownshift` à la
        // descente : baisser `clack` seul aurait baissé les deux. Le facteur de
        // descente monte donc d'autant, et le rétrogradage reste à 0,275.
        clack: 0.25,
        clackDownshift: 1.1,
        crackle: 0.35,
      },
    },
    layers: [
      {
        key: 'on_low',
        file: 'on-low.wav',
        role: 'on',
        anchorRpm: 3128,
        gain: 1,
        minRate: 0.25,
        maxRate: 2,
        enabled: true,
      },
      {
        key: 'on_high',
        file: 'on-high.wav',
        role: 'on',
        anchorRpm: 8150,
        gain: 1,
        minRate: 0.25,
        maxRate: 2,
        enabled: true,
      },
      {
        key: 'off_low',
        file: 'off-low.wav',
        role: 'off',
        anchorRpm: 3299,
        // Mesuré : cette prise est 9,6 dB plus faible que `on-low`. La
        // compensation vit ici, par couche, là où le déficit est — un facteur
        // commun à toute la famille surcompensait l'une et pas l'autre.
        gain: 3,
        minRate: 0.25,
        maxRate: 2,
        enabled: true,
      },
      {
        key: 'off_high',
        file: 'off-high.wav',
        role: 'off',
        anchorRpm: 7604,
        // Mesuré : 6,5 dB plus faible que `on-high`, et non 9,6 comme sa
        // voisine — d'où deux gains distincts.
        gain: 2.1,
        minRate: 0.25,
        maxRate: 2,
        enabled: true,
      },
      {
        key: 'limiter',
        file: 'limiter.wav',
        role: 'limiter',
        anchorRpm: 8000,
        gain: 0.35,
        minRate: 0.8,
        maxRate: 1.25,
        enabled: true,
      },
    ],
  }
}
