/**
 * Le plafond de volume : combien un compte peut déposer.
 *
 * **Il refuse un envoi. Il n'efface jamais rien.** C'est ce qui le rend
 * rattrapable : un seuil inventé qui efface fait disparaître des données sans
 * que rien ne rougisse, un seuil inventé qui refuse se corrige en changeant une
 * valeur dans la pile.
 *
 * **La valeur par défaut est 250 Mio, posée par David le 15 septembre 2026.**
 * Elle remplace un nombre rond de 10 Gio, quarante fois plus grand, qui n'avait
 * été ni mesuré ni choisi. Celle-ci ne l'est pas davantage : elle est décidée.
 * Ce qu'elle vaut en trajets se lira quand le relevé de dépense quotidien aura
 * dit ce qu'un compte dépose vraiment.
 *
 * La borne par requête, à 16 Mio, ne change pas : celle-ci porte sur le **total**
 * déposé par le compte.
 */

import { and, eq, sql } from 'drizzle-orm'

import type { Base } from './base/base'
import { deposits, storageQuotas } from './base/schema'

/** Deux cent cinquante mébioctets. */
export const PLAFOND_PAR_DEFAUT = 250 * 1024 * 1024

/**
 * Ce que `SPEED_PLAFOND_MIO` désigne, en octets.
 *
 * **En mébioctets, et non en gibioctets** : c'est l'ordre de grandeur dans lequel
 * on décide ici, et un plafond de 250 Mio s'écrirait `0.244` dans l'autre unité.
 *
 * Absente, vide ou illisible : le défaut. Une valeur de travers vaut mieux
 * ignorée que prise pour zéro — zéro refuserait tout dépôt dès le premier.
 */
export function plafondDeLEnvironnement(brut: string | undefined): number {
  if (brut === undefined) return PLAFOND_PAR_DEFAUT
  const mio = Number(brut.trim())
  if (!Number.isFinite(mio) || mio <= 0) return PLAFOND_PAR_DEFAUT
  return Math.round(mio * 1024 * 1024)
}

/** Le plafond de ce compte : le sien s'il en a un, sinon le commun. */
export async function plafondDuCompte(
  base: Base,
  compte: string,
  commun: number = PLAFOND_PAR_DEFAUT,
): Promise<{ octets: number; particulier: boolean }> {
  const [ligne] = await base
    .select({ bytes: storageQuotas.bytes })
    .from(storageQuotas)
    .where(eq(storageQuotas.accountId, compte))
    .limit(1)

  if (ligne === undefined) return { octets: commun, particulier: false }
  return { octets: ligne.bytes, particulier: true }
}

/**
 * Ce dépôt ferait-il dépasser le plafond ?
 *
 * **Un dépôt qui en remplace un autre ne compte qu'une fois** : la voiture rejoue
 * un envoi au même nom, et compter les deux refuserait un dépôt qui ne fait rien
 * grossir du tout.
 *
 * **Deux lectures d'index, et aucun parcours de table.** C'est le point délicat :
 * ce contrôle court à chaque dépôt, donc toutes les cinq minutes en roulant. Une
 * somme écrite avec une condition sur le nom du fichier oblige SQLite à lire
 * chaque ligne — donc chaque blob : mesuré à **36,9 ms** sur une table de 1 200
 * dépôts pesant 60 Mio, soit les trois quarts du temps d'un dépôt. Séparée en
 * deux lectures qui tiennent dans leurs index, elle tombe à **0,44 ms**, pour un
 * dépôt complet à 8,6 ms — 5 %.
 */
export async function depasseraitLePlafond(
  base: Base,
  compte: string,
  dossier: string,
  nom: string,
  octets: number,
  plafond: number,
): Promise<boolean> {
  const [somme] = await base
    .select({ total: sql<number>`coalesce(sum(${deposits.bytes}), 0)` })
    .from(deposits)
    .where(eq(deposits.accountId, compte))

  // Ce que ce dépôt-ci remplacerait : la place qu'il rend en même temps qu'il la
  // prend. Lu par son index unique, donc en une recherche.
  const [remplace] = await base
    .select({ octets: deposits.bytes })
    .from(deposits)
    .where(
      and(
        eq(deposits.accountId, compte),
        eq(deposits.folder, dossier),
        eq(deposits.name, nom),
      ),
    )
    .limit(1)

  return (somme?.total ?? 0) - (remplace?.octets ?? 0) + octets > plafond
}
