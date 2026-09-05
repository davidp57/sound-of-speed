import type { Profile } from './schema'

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
 * Profil de départ, calé sur le jeu d'échantillons présent dans `audio/procar/`.
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
      shiftTimeMs: 120,
      // Passages placés en vitesse plutôt qu'en régime : 35, 55, 75, 96 et
      // 115 km/h à charge moyenne.
      upshiftRpm: [3700, 3350, 3050, 2950, 2950],
      upshiftLoadSpreadRpm: 1600,
      upshiftJitterRpm: 120,
      minUpshiftRpm: 2300,
      firstGearLaunchOnly: true,
      launchUpshiftKmh: 5,
      downshiftAtRedlineRatio: 0.28,
      // Croisière basse, mais pas au point de brouter ni de jouer les
      // échantillons trop grave : à 1500, la croisière se tient entre 1500 et
      // 2400 tr/min de 50 à 110 km/h — la moitié utile de la prise bas régime,
      // ancrée à 3128 tr/min.
      cruiseMinRpm: 1500,
      // Il monte volontiers : deux secondes et deux dixièmes de vitesse stable
      // suffisent.
      cruiseUpshiftAfterS: 2.2,
      // Et il ne descend que sur un freinage franc, pas sur un lever de pied.
      brakeDownshiftAccelMs2: -1,
      shiftDelaysS: [0.3, 0.55, 0.4, 0.6, 0.35, 0.5],
    },
    feel: {
      ...base.feel,
      kickdown: { ...base.feel.kickdown, targetRpmFraction: 0.55, maxGears: 2 },
      // Une voiture de série pétarade peu, et pas à n'importe quel régime.
      backfire: { ...base.feel.backfire, minRpm: 3200, intensity: 0.25, count: 3 },
      shiftJolt: { ...base.feel.shiftJolt, depth: 0.35 },
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
    },
  }
}

/** Les profils livrés avec l'application. */
export function createFactoryProfiles(): Profile[] {
  return [createRoadProfile(), createDefaultProfile()]
}

export function createDefaultProfile(): Profile {
  return {
    id: 'procar',
    name: 'Sport',
    favorite: true,
    // Les deux profils livrés sonnent par échantillons : c'est la seule origine
    // gréée, et la banque de `procar/` est ce sur quoi ils sont réglés.
    soundSource: 'recorded',
    sampleDir: 'procar',
    engine: {
      cylinders: 8,
      idleRpm: 780,
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
      shiftTimeMs: 90,
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
      // Volontairement large, et à resserrer sur relevé. Un point satellite
      // s'annonce à quelques mètres ou quelques dizaines de mètres, même mal
      // placé ; une position obtenue sans satellites, par le réseau, s'annonce
      // à plusieurs centaines. Ce seuil passe entre les deux familles sans
      // rejeter ce qu'un vrai point GPS produit. Les valeurs de la voiture, en
      // revanche, ne sont pas encore mesurées : la télémétrie les affiche.
      maxAccuracyM: 250,
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
    },
    feel: {
      kickdown: {
        enabled: true,
        loadThreshold: 0.75,
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
        depth: 0.55,
      },
    },
    layers: [
      {
        key: 'on_low',
        file: 'procar-on-low.wav',
        role: 'on',
        anchorRpm: 3128,
        gain: 1,
        minRate: 0.25,
        maxRate: 2,
        enabled: true,
      },
      {
        key: 'on_high',
        file: 'procar-on-high.wav',
        role: 'on',
        anchorRpm: 8150,
        gain: 1,
        minRate: 0.25,
        maxRate: 2,
        enabled: true,
      },
      {
        key: 'off_low',
        file: 'procar-off-low.wav',
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
        file: 'procar-off-high.wav',
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
        file: 'procar-limiter.wav',
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
