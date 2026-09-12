/**
 * Une boîte, comme entité qu'on nomme et qu'on partage.
 *
 * Le pendant du moteur — voir `engine-entity.ts` —, et le deuxième des cinq
 * groupes de réglages que David a demandés le 10 septembre 2026 : « je penche
 * pour une séparation nette des groupes de paramètres, moteur / boîte / mode de
 * conduite / fonctions de l'app ».
 *
 * **Ce qu'une boîte porte**, et pourquoi ce découpage-là :
 *
 * - les **rapports** et le **pont**, qui sont sa mécanique ;
 * - le **rayon de roue**, qui décide du régime à une vitesse donnée ;
 * - la **durée d'un passage** et ses **temporisations**, qui sont sa façon de
 *   travailler ;
 * - le **rétrogradage forcé** et l'**à-coup de passage** : ce sont des gestes de
 *   boîte, pas des propriétés de moteur.
 *
 * Ce qu'elle ne porte pas : les **régimes de passage**, qui se déduisent
 * désormais du rupteur du moteur et du mode de conduite — c'est le ticket 02, et
 * c'est ce qui fait qu'un moteur de moto ne conduit plus comme un V8. Ni les
 * **pétarades**, qui sont le caractère du moteur et suivent celui-ci.
 *
 * Un profil désigne une boîte, comme il désigne un moteur. C'est ce qui permet
 * d'essayer le même V8 avec deux boîtes — le geste que David cherchait en
 * demandant la séparation.
 */

import type {
  DrivetrainPreset,
  FeelPreset,
  Profile,
} from './schema'

export interface GearboxEntity {
  id: string
  /** Ce qui s'affiche, et ce que David lit dans une liste. */
  name: string
  /** D'où elle vient, quand on le sait. */
  source?: string
  drivetrain: DrivetrainPreset
  /**
   * Le rétrogradage forcé : descendre chercher le couple quand on enfonce.
   *
   * Un geste de boîte, et non un caractère de moteur : c'est la boîte qui
   * décide d'aller chercher le couple là où il est.
   */
  kickdown: FeelPreset['kickdown']
  /**
   * L'à-coup de passage : la coupure, la plongée, le coup de gaz, le clac.
   *
   * Même raison. Un moteur ne fait pas de clac ; une boîte, oui.
   */
  shiftJolt: FeelPreset['shiftJolt']
}

/** La boîte que porte un profil, extraite telle quelle. */
export function gearboxFromProfile(profile: Profile, name = profile.name): GearboxEntity {
  return {
    id: profile.id,
    name,
    source: `profil « ${profile.name} »`,
    drivetrain: { ...profile.drivetrain },
    kickdown: { ...profile.feel.kickdown },
    shiftJolt: { ...profile.feel.shiftJolt },
  }
}

/**
 * Applique une boîte à un profil, et note laquelle.
 *
 * Ce qui n'est pas touché compte autant : le moteur, les pétarades, le signal de
 * vitesse. Changer de boîte ne change pas la voix.
 */
export function applyGearbox(profile: Profile, gearbox: GearboxEntity): Profile {
  return {
    ...profile,
    gearboxId: gearbox.id,
    drivetrain: { ...gearbox.drivetrain },
    feel: {
      ...profile.feel,
      kickdown: { ...gearbox.kickdown },
      shiftJolt: { ...gearbox.shiftJolt },
    },
  }
}

/**
 * Vrai si le profil joue cette boîte-là, aux valeurs près.
 *
 * Les régimes de passage sont **exclus** de la comparaison : ils ne viennent
 * plus de la boîte mais du rupteur et du mode, et un profil dont la table
 * traîne encore une vieille valeur ne joue pas pour autant une autre boîte.
 */
export function matchesGearbox(profile: Profile, gearbox: GearboxEntity): boolean {
  const memeNombre = <T extends object>(a: T, b: T, ignorer: string[] = []): boolean => {
    for (const cle of Object.keys(a) as (keyof T)[]) {
      if (ignorer.includes(String(cle))) continue
      const gauche = a[cle]
      const droite = b[cle]
      if (typeof gauche === 'number' && typeof droite === 'number') {
        if (Math.abs(gauche - droite) > 1e-9) return false
      } else if (Array.isArray(gauche) && Array.isArray(droite)) {
        if (gauche.length !== droite.length) return false
        if (gauche.some((v, i) => Math.abs(Number(v) - Number(droite[i])) > 1e-9)) return false
      } else if (gauche !== droite) return false
    }
    return true
  }
  if (!memeNombre(profile.drivetrain, gearbox.drivetrain, ['upshiftRpm'])) return false
  if (!memeNombre(profile.feel.kickdown, gearbox.kickdown)) return false
  return memeNombre(profile.feel.shiftJolt, gearbox.shiftJolt)
}

/** Les profils qui désignent cette boîte. */
export function profilesUsingGearbox(
  profiles: readonly Profile[],
  gearboxId: string,
): Profile[] {
  return profiles.filter((profile) => profile.gearboxId === gearboxId)
}

/** Répercute la correction d'une boîte sur les profils qui la désignent. */
export function refreshProfilesGearbox(
  profiles: readonly Profile[],
  gearbox: GearboxEntity,
): Profile[] {
  return profiles.map((profile) =>
    profile.gearboxId === gearbox.id ? applyGearbox(profile, gearbox) : profile,
  )
}
