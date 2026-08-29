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
    engine: {
      ...base.engine,
      idleRpm: 800,
      softLimitRpm: 6300,
      redlineRpm: 6500,
      inertia: 1.2,
      freeRevRate: 6000,
      engineBraking: 4000,
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
      upshiftLoadSpreadRpm: 2200,
      upshiftJitterRpm: 120,
      downshiftAtRedlineRatio: 0.28,
      shiftDelaysS: [0.3, 0.55, 0.4, 0.6, 0.35, 0.5],
    },
    mix: {
      ...base.mix,
      // La bascule suit la plage réellement parcourue, bien plus basse.
      crossfadeLowRpm: 2600,
      crossfadeHighRpm: 5200,
      fullLoadAccelMs2: 2,
      loadSmoothingS: 0.22,
      drive: 0.12,
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
      downshiftAtRedlineRatio: 0.32,
      // Volontairement irrégulières : des temporisations égales donnent une
      // boîte qui sonne comme un métronome. Courtes, en revanche — elles
      // confirment une intention, elles ne retiennent pas le passage.
      shiftDelaysS: [0.25, 0.5, 0.35, 0.55, 0.3, 0.45],
    },
    speed: {
      springOmega: 14,
      accelWindowMs: 1000,
      accelDeadbandKmh: 1,
      maxPlausibleKmh: 260,
      minAccelMs2: -14,
      maxAccelMs2: 14,
    },
    mix: {
      masterGain: 0.7,
      crossfadeLowRpm: 3200,
      crossfadeHighRpm: 7000,
      fullLoadAccelMs2: 2.5,
      loadSmoothingS: 0.18,
      idleFadeOutRpm: 1400,
      highpassHz: 45,
      drive: 0.15,
      limiterThresholdDb: -1.5,
    },
    layers: [
      {
        key: 'on_low',
        file: 'procar-on-low.wav',
        role: 'on',
        anchorRpm: 3128,
        gain: 1,
        minRate: 0.5,
        maxRate: 2,
        enabled: true,
      },
      {
        key: 'on_high',
        file: 'procar-on-high.wav',
        role: 'on',
        anchorRpm: 8150,
        gain: 1,
        minRate: 0.5,
        maxRate: 2,
        enabled: true,
      },
      {
        key: 'off_low',
        file: 'procar-off-low.wav',
        role: 'off',
        anchorRpm: 3299,
        gain: 1.3,
        minRate: 0.5,
        maxRate: 2,
        enabled: true,
      },
      {
        key: 'off_high',
        file: 'procar-off-high.wav',
        role: 'off',
        anchorRpm: 7604,
        gain: 1.3,
        minRate: 0.5,
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
