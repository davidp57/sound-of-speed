/**
 * Ce que devient le compte qu'un appareil abandonne.
 *
 * Deux gestes y mènent, et c'est pourquoi cela vit à part : rejoindre un compte
 * avec un code de liaison, et se connecter avec une adresse. Dans les deux cas
 * l'appareil portait déjà un compte anonyme — il s'en est créé un au démarrage,
 * comme tout appareil neuf — et il faut décider de son sort.
 *
 * **Un compte vide s'efface, un compte qui porte quelque chose se garde.** Le
 * garder laisserait traîner un compte que personne ne rouvrira jamais ;
 * l'effacer sans regarder perdrait des réglages. Ce qui se passe ensuite est à
 * son propriétaire, pas à ce code : l'écran le dit, et s'arrête là.
 */

import { eq } from 'drizzle-orm'

import type { Base } from './base/base'
import { accounts } from './base/schema'
import { ceQuePorte } from './heritage'

/** Ce qu'est devenu le compte que l'appareil portait avant. */
export type SortDeLAncien =
  /** Il était vide : effacé, et personne ne le regrettera. */
  | 'efface'
  /** Il portait quelque chose : gardé, et l'écran le dit. */
  | 'garde'
  /** Il n'y en avait pas, ou c'était déjà le même compte. */
  | 'aucun'

export async function reglerLAncien(
  base: Base,
  avant: string | undefined,
  desormais: string | undefined,
): Promise<SortDeLAncien> {
  if (avant === undefined || avant === desormais) return 'aucun'

  // Un compte qu'on n'a pas créé tout seul ne s'efface pas au passage : il a une
  // adresse, ou un mot de passe, donc quelqu'un peut y revenir.
  if (!(await estAnonyme(base, avant))) return 'garde'

  const porte = await ceQuePorte(base, avant)
  const vide =
    porte.profils === 0 &&
    porte.moteurs === 0 &&
    porte.boites === 0 &&
    porte.depots === 0 &&
    porte.droits === 0 &&
    // Le profil mesuré se juge sur ce qu'il a appris, pas sur sa présence : le
    // rattrapage du démarrage en écrit un à tout compte, y compris à celui qui
    // n'a jamais déposé une trace. Relevé en production le 13 septembre 2026 —
    // compte né à 20:43, profil mesuré à 20:46, zéro trajet.
    porte.trajetsMesures === 0
  if (!vide) return 'garde'

  // La cascade emporte ses sessions et ses preuves. Rien d'autre ne pend à ce
  // compte, puisqu'on vient de vérifier qu'il ne porte rien.
  await base.delete(accounts).where(eq(accounts.id, avant))
  return 'efface'
}

/**
 * Un compte s'est-il créé tout seul ?
 *
 * Lu **dans la colonne**, et non dans le type que rend la bibliothèque : c'est
 * la colonne qui fait foi — `CONTEXT.md` le dit —, et le type générique de
 * l'adaptateur ne connaît pas les champs qu'un greffon ajoute.
 */
export async function estAnonyme(base: Base, compte: string): Promise<boolean> {
  const lignes = await base
    .select({ anonyme: accounts.isAnonymous })
    .from(accounts)
    .where(eq(accounts.id, compte))
  return lignes[0]?.anonyme === true
}
