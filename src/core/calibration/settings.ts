import type { Profile } from '../preset/schema'

/**
 * Les réglages qu'un étalonnage peut informer, et la lecture-écriture qui va
 * avec.
 *
 * Un chemin plutôt qu'un accès direct, pour une raison précise : la recopie se
 * fait **réglage par réglage, sur un geste explicite**, jamais en bloc. Une
 * liste fermée de chemins rend cette règle vérifiable — rien d'autre du profil
 * ne peut être touché par l'étalonnage.
 */

export type SettingPath =
  | 'mix.fullLoadAccelMs2'
  | 'drivetrain.brakeDownshiftAccelMs2'
  | 'speed.minAccelMs2'
  | 'speed.maxAccelMs2'
  | 'speed.maxPlausibleKmh'
  | 'speed.accelWindowMs'
  | 'drivetrain.launchUpshiftKmh'
  | 'drivetrain.cruiseUpshiftAfterS'
  | 'drivetrain.upshiftRpm'

/**
 * Libellé, unité et précision de chaque réglage.
 *
 * La précision n'est pas cosmétique : c'est celle à laquelle la mesure a un
 * sens. Un dixième de m/s² est déjà la résolution que le bruit d'un GPS permet
 * d'atteindre ; en afficher deux ferait croire à une exactitude qu'on n'a pas,
 * et ferait diverger le chiffre annoncé de celui qu'on recopie.
 */
export const SETTING_LABELS: Record<
  SettingPath,
  { label: string; unit: string; decimals: number }
> = {
  'mix.fullLoadAccelMs2': {
    label: 'Accélération à charge pleine',
    unit: 'm/s²',
    decimals: 1,
  },
  'drivetrain.brakeDownshiftAccelMs2': {
    label: 'Rétrogradage au freinage',
    unit: 'm/s²',
    decimals: 1,
  },
  'speed.minAccelMs2': { label: 'Borne basse de l’accélération', unit: 'm/s²', decimals: 1 },
  'speed.maxAccelMs2': { label: 'Borne haute de l’accélération', unit: 'm/s²', decimals: 1 },
  'speed.maxPlausibleKmh': { label: 'Vitesse plausible maximale', unit: 'km/h', decimals: 0 },
  'speed.accelWindowMs': { label: 'Fenêtre d’accélération', unit: 'ms', decimals: 0 },
  'drivetrain.launchUpshiftKmh': {
    label: 'Vitesse de fin de première',
    unit: 'km/h',
    decimals: 0,
  },
  'drivetrain.cruiseUpshiftAfterS': {
    label: 'Délai de montée en croisière',
    unit: 's',
    decimals: 1,
  },
  // Le réglage est en tours par minute, la proposition en kilomètres-heure : la
  // voiture mesurée n'a pas de rapports, et l'étalonnage ne formule donc rien en
  // régime. La conversion se fait avec le pont et les démultiplications du
  // profil, qui sont, eux, un choix déjà fait.
  'drivetrain.upshiftRpm': { label: 'Seuils de passage', unit: 'km/h', decimals: 0 },
}

export function readSetting(profile: Profile, path: SettingPath): number | number[] {
  switch (path) {
    case 'mix.fullLoadAccelMs2':
      return profile.mix.fullLoadAccelMs2
    case 'drivetrain.brakeDownshiftAccelMs2':
      return profile.drivetrain.brakeDownshiftAccelMs2
    case 'speed.minAccelMs2':
      return profile.speed.minAccelMs2
    case 'speed.maxAccelMs2':
      return profile.speed.maxAccelMs2
    case 'speed.maxPlausibleKmh':
      return profile.speed.maxPlausibleKmh
    case 'speed.accelWindowMs':
      return profile.speed.accelWindowMs
    case 'drivetrain.launchUpshiftKmh':
      return profile.drivetrain.launchUpshiftKmh
    case 'drivetrain.cruiseUpshiftAfterS':
      return profile.drivetrain.cruiseUpshiftAfterS
    case 'drivetrain.upshiftRpm':
      return [...profile.drivetrain.upshiftRpm]
    default:
      return 0
  }
}

/**
 * Vitesse à laquelle un rapport atteint un régime donné, en km/h.
 *
 * La réciproque de `rpmAtSpeed`. Elle sert à afficher les seuils de passage
 * **en vitesse** : c'est la seule façon de comparer un seuil mesuré, qui est une
 * vitesse, à un seuil réglé, qui est un régime. La conversion ne suppose rien
 * qui ne soit déjà dans le profil — le pont, la démultiplication et le rayon de
 * roue sont des choix faits, pas des mesures.
 */
export function speedAtRpm(
  rpm: number,
  gearRatio: number,
  finalDrive: number,
  wheelRadiusM: number,
): number {
  const total = gearRatio * finalDrive
  if (!(total > 0)) return 0
  const wheelRps = rpm / 60 / total
  return wheelRps * 2 * Math.PI * wheelRadiusM * 3.6
}

/** Les seuils de passage du profil, exprimés en km/h rapport par rapport. */
export function upshiftSpeeds(profile: Profile): number[] {
  const { upshiftRpm, gearRatios, finalDrive, wheelRadiusM } = profile.drivetrain
  return upshiftRpm.map((rpm, index) =>
    speedAtRpm(rpm, gearRatios[index] ?? 1, finalDrive, wheelRadiusM),
  )
}

/**
 * Écrit une valeur dans un profil, et rend un nouveau profil.
 *
 * Une copie plutôt qu'une mutation : l'appelant contrôle ainsi le moment où le
 * profil actif change, et la valeur d'origine reste intacte pour que
 * « réinitialiser » puisse y revenir.
 */
export function writeSetting(
  profile: Profile,
  path: SettingPath,
  value: number | number[],
): Profile {
  switch (path) {
    case 'mix.fullLoadAccelMs2':
      if (typeof value !== 'number') return profile
      return { ...profile, mix: { ...profile.mix, fullLoadAccelMs2: value } }
    case 'drivetrain.brakeDownshiftAccelMs2':
      if (typeof value !== 'number') return profile
      return {
        ...profile,
        drivetrain: { ...profile.drivetrain, brakeDownshiftAccelMs2: value },
      }
    case 'speed.minAccelMs2':
      if (typeof value !== 'number') return profile
      return { ...profile, speed: { ...profile.speed, minAccelMs2: value } }
    case 'speed.maxAccelMs2':
      if (typeof value !== 'number') return profile
      return { ...profile, speed: { ...profile.speed, maxAccelMs2: value } }
    case 'speed.maxPlausibleKmh':
      if (typeof value !== 'number') return profile
      return { ...profile, speed: { ...profile.speed, maxPlausibleKmh: value } }
    case 'speed.accelWindowMs':
      if (typeof value !== 'number') return profile
      return { ...profile, speed: { ...profile.speed, accelWindowMs: value } }
    case 'drivetrain.launchUpshiftKmh':
      if (typeof value !== 'number') return profile
      return { ...profile, drivetrain: { ...profile.drivetrain, launchUpshiftKmh: value } }
    case 'drivetrain.cruiseUpshiftAfterS':
      if (typeof value !== 'number') return profile
      return { ...profile, drivetrain: { ...profile.drivetrain, cruiseUpshiftAfterS: value } }
    case 'drivetrain.upshiftRpm':
      // La longueur doit correspondre au nombre de passages : une table plus
      // courte laisserait des rapports sans seuil, une plus longue porterait des
      // entrées que rien ne lit.
      if (!Array.isArray(value)) return profile
      if (value.length !== profile.drivetrain.upshiftRpm.length) return profile
      return { ...profile, drivetrain: { ...profile.drivetrain, upshiftRpm: [...value] } }
    default:
      return profile
  }
}
