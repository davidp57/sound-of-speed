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
    default:
      return 0
  }
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
    default:
      return profile
  }
}
