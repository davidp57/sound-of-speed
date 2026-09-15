/**
 * Ce que portait le compte d'avant passe au premier compte réel.
 *
 * Avant l'identité, tout ce que la base gardait appartenait à un compte écrit en
 * dur : `solo`. Les profils, les moteurs, les boîtes, les trajets, le profil
 * mesuré — des mois de conduite pour ce dernier, quarante et une tranches de
 * trace. Ouvrir l'identité sans rien faire montrerait une application vide à
 * quelqu'un dont toutes les données sont là.
 *
 * **Le premier compte qui se présente hérite, une seule fois.** Il n'y a rien à
 * mémoriser pour s'en assurer : l'héritage efface le compte d'avant, donc il ne
 * reste rien à transmettre au suivant. Un serveur qu'on relance ne rejoue rien,
 * et un second appareil part de zéro — ce qui est le comportement voulu, deux
 * appareils faisant deux comptes tant que rien ne les relie.
 */

import { eq, sql } from 'drizzle-orm'

import type { Base } from './base/base'
import {
  accounts,
  deposits,
  engines,
  gearboxes,
  measuredCars,
  profiles,
  rights,
} from './base/schema'

/**
 * Le compte d'avant l'identité.
 *
 * Il n'est plus semé au démarrage : une installation neuve n'en a pas besoin, et
 * le premier appareil qui se présente crée le sien. Il ne réapparaît que comme
 * **réceptacle de reprise** — quand on verse d'anciens dossiers dans une base
 * neuve, il faut bien un propriétaire, et c'est celui-là, absorbé ensuite par le
 * premier vrai compte.
 */
export const ANCIEN_COMPTE_UNIQUE = 'solo'

/** Ce qui a changé de mains, pour pouvoir le dire et le vérifier. */
export interface Heritage {
  profils: number
  moteurs: number
  boites: number
  depots: number
  octets: number
  profilMesure: boolean
  /**
   * Combien de trajets ce profil mesuré a vus.
   *
   * Séparé de sa présence, parce que les deux ne disent pas la même chose : le
   * rattrapage du démarrage écrit une ligne à tout compte, même à celui qui n'a
   * jamais déposé une trace. Ce qui distingue un profil qui vaut d'un profil
   * qui ne vaut rien est ce qu'il a appris.
   */
  trajetsMesures: number
  droits: number
}

/**
 * Sème le compte d'avant, s'il n'y est pas.
 *
 * Appelé seulement quand on s'apprête à verser d'anciens dossiers : sans données
 * à reprendre, il n'y a aucune raison de créer un compte que personne n'utilise.
 */
export async function semerLAncienCompte(base: Base, nom = 'Moi'): Promise<void> {
  await base
    .insert(accounts)
    .values({ id: ANCIEN_COMPTE_UNIQUE, name: nom, updatedAt: new Date() })
    .onConflictDoNothing()
}

/**
 * Fait passer au compte donné tout ce que portait le compte d'avant.
 *
 * Rend `null` quand il n'y a rien à hériter — le cas de toute installation neuve,
 * et de tout démarrage après le premier.
 *
 * **Le décompte est pris avant**, et il est rendu : c'est ce qui permet de dire
 * au journal du conteneur ce qui a changé de mains, et de le vérifier. Un
 * héritage silencieux serait indiscernable d'un héritage qui n'a rien fait.
 */
export async function faireHeriter(base: Base, heritier: string): Promise<Heritage | null> {
  if (heritier === ANCIEN_COMPTE_UNIQUE) return null

  const ancien = await base.select().from(accounts).where(eq(accounts.id, ANCIEN_COMPTE_UNIQUE))
  if (ancien.length === 0) return null

  const avant = await ceQuePorte(base, ANCIEN_COMPTE_UNIQUE)

  // Chaque table à son tour, puis le compte d'avant s'efface. L'ordre compte :
  // effacer le compte d'abord emporterait tout par la cascade, ce qui est
  // exactement ce qu'on veut éviter.
  for (const table of [engines, gearboxes, profiles, deposits, measuredCars, rights]) {
    await base
      .update(table)
      .set({ accountId: heritier })
      .where(eq(table.accountId, ANCIEN_COMPTE_UNIQUE))
  }

  await base.delete(accounts).where(eq(accounts.id, ANCIEN_COMPTE_UNIQUE))

  return avant
}

/**
 * Ce qu'un compte porte, à l'instant.
 *
 * Sert à deux choses qui se ressemblent plus qu'il n'y paraît : dire ce qui a
 * changé de mains lors d'un héritage, et savoir si un compte est **vide** —
 * c'est-à-dire si on peut l'effacer sans rien perdre quand un appareil en
 * rejoint un autre.
 */
export async function ceQuePorte(base: Base, compte: string): Promise<Heritage> {
  const combien = async (table: typeof engines | typeof gearboxes | typeof profiles | typeof rights) =>
    (
      await base
        .select({ n: sql<number>`count(*)` })
        .from(table)
        .where(eq(table.accountId, compte))
    )[0]?.n ?? 0

  const lesDepots = await base
    .select({ n: sql<number>`count(*)`, octets: sql<number>`coalesce(sum(${deposits.bytes}), 0)` })
    .from(deposits)
    .where(eq(deposits.accountId, compte))

  const mesure = await base
    .select({ contenu: measuredCars.content })
    .from(measuredCars)
    .where(eq(measuredCars.accountId, compte))
  const cumul = mesure[0]?.contenu as { aggregate?: { tripCount?: number } } | undefined

  return {
    profils: await combien(profiles),
    moteurs: await combien(engines),
    boites: await combien(gearboxes),
    droits: await combien(rights),
    depots: lesDepots[0]?.n ?? 0,
    octets: lesDepots[0]?.octets ?? 0,
    profilMesure: mesure.length > 0,
    trajetsMesures: cumul?.aggregate?.tripCount ?? 0,
  }
}

/**
 * Une ligne pour le journal du conteneur.
 *
 * C'est le seul endroit où l'on verra que l'héritage a eu lieu : après coup, il
 * n'y a plus de compte d'avant à regarder.
 */
export function formaterHeritage(heritage: Heritage, heritier: string): string {
  const morceaux = [
    `${heritage.profils} profils`,
    `${heritage.moteurs} moteurs`,
    `${heritage.boites} boîtes`,
    `${heritage.depots} dépôts (${heritage.octets} octets)`,
  ]
  if (heritage.profilMesure) morceaux.push('le profil mesuré')
  if (heritage.droits > 0) morceaux.push(`${heritage.droits} droits`)
  return `héritage vers ${heritier} : ${morceaux.join(', ')}`
}
