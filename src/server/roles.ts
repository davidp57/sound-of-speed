/**
 * Ce qu'un compte porte, lu dans la table des droits.
 *
 * **C'est ici que le refus se décide.** Cacher un écran est un confort
 * d'interface ; ce qui protège est ce module, parce qu'un navigateur peut
 * afficher ce qu'il veut. Le cœur (`core/identity/roles.ts`) dit ce qu'est un
 * rôle et comment une échéance se lit ; ce fichier-ci va le chercher en base.
 *
 * **Tout le monde a tout, et ce n'est pas une règle mais une valeur.** Les rôles
 * offerts à n'importe quel compte se donnent par l'environnement et valent les
 * trois par défaut. Le jour de l'ouverture, il restera à changer cette valeur et
 * à brancher un encaissement — la mécanique, elle, est déjà là.
 */

import { and, eq, gt, isNull, or } from 'drizzle-orm'

import { estUnRole, ROLES, type Droit, type Role } from '../core/identity/roles'

import type { Base } from './base/base'
import { rights } from './base/schema'

/** Ce que porte tout compte tant que rien n'est encaissé : les trois rôles. */
export const ROLES_OFFERTS_PAR_DEFAUT: readonly Role[] = ROLES

/**
 * Ce que `SPEED_ROLES_OFFERTS` désigne.
 *
 * Absente **ou vide**, les trois rôles. Une variable déclarée dans la
 * composition d'une pile et non saisie arrive vide, et non absente : c'est ce
 * qu'on obtient le plus souvent dans l'écran de Portainer, et l'idiome du dépôt
 * est déjà de traiter les deux pareil — voir `SPEED_URL`. Faire de la valeur
 * vide un « aucun rôle » fermerait tous les écrans de tout le monde le jour où
 * la variable est déclarée sans être saisie.
 *
 * Pour tout fermer — et c'est la façon de vérifier sur un serveur qui tourne
 * qu'un écran se referme et qu'une route refuse —, il faut donc une valeur qui
 * ne nomme aucun rôle : `aucun` fait l'affaire, et n'importe quel autre mot
 * aussi.
 */
export function offertsDeLEnvironnement(brut: string | undefined): readonly Role[] {
  if (brut === undefined || brut.trim() === '') return ROLES_OFFERTS_PAR_DEFAUT
  const nommes = brut
    .split(',')
    .map((nom) => nom.trim())
    .filter((nom) => nom !== '')
  return ROLES.filter((role) => nommes.includes(role))
}

/**
 * Les droits d'un compte : ce qui lui est offert, plus ce qu'il a en propre.
 *
 * Un rôle offert n'a pas d'échéance, et prime donc sur la même ligne achetée :
 * garder les deux ferait se refermer, le jour dit, quelque chose qui reste
 * gratuit.
 */
export async function droitsDuCompte(
  base: Base,
  compte: string,
  maintenant: number,
  offerts: readonly Role[] = ROLES_OFFERTS_PAR_DEFAUT,
): Promise<Droit[]> {
  const secondes = Math.floor(maintenant / 1000)

  const lignes = await base
    .select({ scope: rights.scope, expiresAt: rights.expiresAt })
    .from(rights)
    .where(
      and(
        eq(rights.accountId, compte),
        // Un droit sans échéance ne se périme pas ; les autres sortent d'eux-mêmes
        // dès que l'heure passe, sans que rien n'ait à les effacer.
        or(isNull(rights.expiresAt), gt(rights.expiresAt, secondes)),
      ),
    )

  const achetes = new Map<Role, number | null>()
  for (const ligne of lignes) {
    if (!estUnRole(ligne.scope)) continue
    achetes.set(ligne.scope, ligne.expiresAt === null ? null : ligne.expiresAt * 1000)
  }

  return ROLES.filter((role) => offerts.includes(role) || achetes.has(role)).map((role) => ({
    role,
    expireLe: offerts.includes(role) ? null : (achetes.get(role) ?? null),
  }))
}

/** Les seuls rôles, sans leurs échéances — ce qu'un refus a besoin de savoir. */
export function rolesDe(droits: readonly Droit[]): Role[] {
  return droits.map((droit) => droit.role)
}
