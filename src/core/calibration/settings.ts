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

export type SettingPath = 'mix.fullLoadAccelMs2'

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
}

export function readSetting(profile: Profile, path: SettingPath): number | number[] {
  switch (path) {
    case 'mix.fullLoadAccelMs2':
      return profile.mix.fullLoadAccelMs2
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
    default:
      return profile
  }
}
