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
export function createDefaultProfile(): Profile {
  return {
    id: 'procar',
    name: 'Procar V8',
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
      upshiftAtRedlineRatio: 0.94,
      upshiftAtLowLoadRatio: 0.34,
      downshiftAtRedlineRatio: 0.32,
      // Volontairement irrégulier : des temporisations égales donnent une boîte
      // qui sonne comme un métronome.
      shiftDelaysS: [0.6, 1.4, 0.9, 1.5, 0.8, 1.3],
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
