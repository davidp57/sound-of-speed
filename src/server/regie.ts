/**
 * La régie : administrer les comptes depuis un écran.
 *
 * **Tout ce qui est ici répond 404 à qui n'administre pas**, y compris à une
 * requête sans compte. Le dépôt a deux façons de refuser : une route gardée par
 * un rôle rend 403 avec le motif, une banque restreinte rend 404 parce que
 * « l'existence d'une banque ne doit pas fuir plus que son contenu ». La régie
 * suit la seconde — c'est le cas le plus proche, quelque chose auquel presque
 * personne n'a droit. Ce n'est pas une protection, l'adresse se trouve : c'est le
 * contrôle serveur qui garde, et ceci retire seulement une carte à qui cherche.
 *
 * Qui administre se lit dans la configuration de la pile, jamais en base — voir
 * `administration.ts`.
 */

import { desc, eq, inArray, sql } from 'drizzle-orm'
import { Hono } from 'hono'

import type { Role } from '../core/identity/roles'

import { estAdministrateur } from './administration'
import type { DroitsSurLesBanques } from './banques'
import type { Base } from './base/base'
import { accounts, authIdentities, authSessions, deposits } from './base/schema'
import { ceQuePorte } from './heritage'
import { droitsDuCompte, ROLES_OFFERTS_PAR_DEFAUT, rolesDe } from './roles'
import { nomDuFournisseur } from './tiers'

/** Ce que la garde d'entrée range pour les routes qui suivent. */
export interface VariablesDeLaRegie {
  /** L'administrateur qui appelle : c'est lui que la trace nommera. */
  admin: string
}

export type RegieHono = Hono<{ Variables: VariablesDeLaRegie }>

export interface OptionsDeLaRegie {
  base: Base
  /** Les adresses qui administrent, telles que la pile les déclare. */
  admins: ReadonlySet<string>
  /** À qui appartient cette requête, ou `null`. */
  compteDe: (entetes: Headers) => Promise<string | null>
  /** Les rôles offerts à tout le monde, pour dire ce qu'un compte porte vraiment. */
  offerts?: readonly Role[]
  /**
   * Les banques restreintes et ce que la configuration accorde.
   *
   * La fiche dit ce qu'un compte peut écouter ; tant que les accords vivent dans
   * l'environnement, c'est là qu'elle les lit.
   */
  banques?: DroitsSurLesBanques
}

/** Une ligne de la liste des comptes. */
export interface LigneDeCompte {
  id: string
  nom: string
  /** L'adresse enregistrée, ou `null` — voir `adresseVisible`. */
  adresse: string | null
  anonyme: boolean
  creeLe: string
  roles: Role[]
  /** Ce que ses dépôts pèsent, en octets. */
  octets: number
}

/**
 * L'adresse d'un compte, ou rien quand il n'en a pas de vraie.
 *
 * La bibliothèque d'identité fabrique une adresse aux comptes anonymes — elle en
 * exige une — sous le domaine réservé `.invalid`, qui par construction ne désigne
 * aucune boîte. L'afficher donnerait à lire une adresse là où il n'y en a pas.
 */
export function adresseVisible(adresse: string | null, anonyme: boolean): string | null {
  if (adresse === null || adresse === '') return null
  if (anonyme || adresse.toLowerCase().endsWith('.invalid')) return null
  return adresse
}

/**
 * Tous les comptes, les derniers créés en haut.
 *
 * Les rôles se relisent compte par compte, avec la fonction qui décide des refus :
 * une seconde lecture des échéances finirait par ne plus dire la même chose. C'est
 * une requête par compte, sur un écran d'administration qui en montre quelques
 * dizaines — pas le chemin chaud du serveur.
 */
export async function listerLesComptes(
  base: Base,
  offerts: readonly Role[] = ROLES_OFFERTS_PAR_DEFAUT,
  maintenant: number = Date.now(),
): Promise<LigneDeCompte[]> {
  const lignes = await base
    .select({
      id: accounts.id,
      nom: accounts.name,
      adresse: accounts.email,
      anonyme: accounts.isAnonymous,
      creeLe: accounts.createdAt,
    })
    .from(accounts)
    // La date de création se compte en secondes : deux comptes ouverts dans la
    // même seconde se départagent par leur identifiant, faute de quoi la liste
    // change d'ordre à chaque rafraîchissement sans que rien n'ait bougé.
    .orderBy(desc(accounts.createdAt), desc(accounts.id))

  const poids = await poidsParCompte(
    base,
    lignes.map((ligne) => ligne.id),
  )

  const comptes: LigneDeCompte[] = []
  for (const ligne of lignes) {
    comptes.push({
      id: ligne.id,
      nom: ligne.nom,
      adresse: adresseVisible(ligne.adresse, ligne.anonyme),
      anonyme: ligne.anonyme,
      creeLe: ligne.creeLe.toISOString(),
      roles: rolesDe(await droitsDuCompte(base, ligne.id, maintenant, offerts)),
      octets: poids.get(ligne.id) ?? 0,
    })
  }
  return comptes
}

/** Ce que pèsent les dépôts de chaque compte, en une requête. */
export async function poidsParCompte(
  base: Base,
  comptes: readonly string[],
): Promise<Map<string, number>> {
  if (comptes.length === 0) return new Map()

  const lignes = await base
    .select({
      compte: deposits.accountId,
      octets: sql<number>`coalesce(sum(${deposits.bytes}), 0)`,
    })
    .from(deposits)
    .where(inArray(deposits.accountId, [...comptes]))
    .groupBy(deposits.accountId)

  return new Map(lignes.map((ligne) => [ligne.compte, ligne.octets]))
}

/**
 * Tout ce que le serveur sait d'un compte, sauf ce qu'il a déposé.
 *
 * **Aucun contenu nommé** : ni nom de profil, ni date de trajet, ni nom de
 * fichier. Un nom de profil ou une date de dépôt disent où et quand quelqu'un a
 * roulé ; ça ne s'ouvre qu'avec son accord, et c'est ailleurs.
 */
export interface Fiche {
  id: string
  nom: string
  adresse: string | null
  /** L'image que le fournisseur d'identité a donnée, quand il y en a une. */
  portrait: string | null
  anonyme: boolean
  creeLe: string
  /** Les comptes tenus ailleurs qui mènent ici : leur nom, et rien d'autre. */
  fournisseurs: { id: string; nom: string }[]
  /** Un mot de passe est-il rangé sur ce compte ? Par oui ou par non. */
  motDePasse: boolean
  /** Les sessions encore ouvertes — combien d'appareils, et jusqu'à quand. */
  sessions: { ouverteLe: string; expireLe: string }[]
  roles: { role: Role; expireLe: string | null }[]
  /** Les banques restreintes que ce compte peut écouter. */
  banques: string[]
  /** Ce qu'il porte, en nombres. */
  porte: {
    profils: number
    moteurs: number
    boites: number
    depots: number
    octets: number
    trajetsMesures: number
  }
}

export async function ficheDuCompte(
  base: Base,
  compte: string,
  options: { offerts?: readonly Role[]; banques?: DroitsSurLesBanques; maintenant?: number } = {},
): Promise<Fiche | null> {
  const [ligne] = await base
    .select({
      id: accounts.id,
      nom: accounts.name,
      adresse: accounts.email,
      portrait: accounts.image,
      anonyme: accounts.isAnonymous,
      creeLe: accounts.createdAt,
    })
    .from(accounts)
    .where(eq(accounts.id, compte))
    .limit(1)
  if (ligne === undefined) return null

  const preuves = await base
    .select({ fournisseur: authIdentities.providerId, motDePasse: authIdentities.password })
    .from(authIdentities)
    .where(eq(authIdentities.accountId, compte))

  const sessions = await base
    .select({ ouverteLe: authSessions.createdAt, expireLe: authSessions.expiresAt })
    .from(authSessions)
    .where(eq(authSessions.accountId, compte))
    .orderBy(desc(authSessions.createdAt))

  const droits = await droitsDuCompte(
    base,
    compte,
    options.maintenant ?? Date.now(),
    options.offerts ?? ROLES_OFFERTS_PAR_DEFAUT,
  )
  const porte = await ceQuePorte(base, compte)
  const adresse = adresseVisible(ligne.adresse, ligne.anonyme)

  return {
    id: ligne.id,
    nom: ligne.nom,
    adresse,
    portrait: ligne.portrait,
    anonyme: ligne.anonyme,
    creeLe: ligne.creeLe.toISOString(),
    // Le mot de passe se dit par oui ou par non, et les comptes tenus ailleurs
    // par le nom de leur fournisseur. Rien d'autre ne sort : ni empreinte, ni
    // jeton, ni identifiant chez le fournisseur.
    fournisseurs: preuves
      .filter((preuve) => preuve.fournisseur !== 'credential')
      .map((preuve) => ({ id: preuve.fournisseur, nom: nomDuFournisseur(preuve.fournisseur) })),
    motDePasse: preuves.some(
      (preuve) =>
        preuve.fournisseur === 'credential' &&
        preuve.motDePasse !== null &&
        preuve.motDePasse !== '',
    ),
    // Ni l'adresse réseau ni la chaîne d'agent : savoir combien d'appareils sont
    // connectés et jusqu'à quand répond à la question, le reste ne fait que
    // ramasser des renseignements sur quelqu'un.
    sessions: sessions.map((session) => ({
      ouverteLe: session.ouverteLe.toISOString(),
      expireLe: session.expireLe.toISOString(),
    })),
    roles: droits.map(({ role, expireLe }) => ({
      role,
      expireLe: expireLe === null ? null : new Date(expireLe).toISOString(),
    })),
    banques: banquesDuCompte(options.banques, adresse),
    porte: {
      profils: porte.profils,
      moteurs: porte.moteurs,
      boites: porte.boites,
      depots: porte.depots,
      octets: porte.octets,
      trajetsMesures: porte.trajetsMesures,
    },
  }
}

/**
 * Les banques restreintes que ce compte peut écouter.
 *
 * Elles se lisent dans la configuration, par adresse, tant que les accords n'ont
 * pas de table. Un compte sans adresse n'en a donc aucune, et `*` les accorde
 * toutes.
 */
function banquesDuCompte(droits: DroitsSurLesBanques | undefined, adresse: string | null): string[] {
  if (droits === undefined || adresse === null) return []
  const siennes = droits.accordees.get(adresse.toLowerCase())
  if (siennes === undefined) return []
  if (siennes.has('*')) return [...droits.restreintes].sort()
  return [...droits.restreintes].filter((banque) => siennes.has(banque)).sort()
}

/** Ce compte existe-t-il ? La fiche d'un compte inconnu se refuse comme le reste. */
export async function compteExiste(base: Base, compte: string): Promise<boolean> {
  const [ligne] = await base
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.id, compte))
    .limit(1)
  return ligne !== undefined
}

/**
 * Les routes de la régie, montées sous `/api/regie`.
 *
 * Un seul contrôle, posé une fois pour toutes en entrée : une route ajoutée plus
 * tard dans ce routeur est gardée par construction, et n'a pas à se souvenir de
 * le demander.
 */
export function creerRegie(options: OptionsDeLaRegie): RegieHono {
  const regie: RegieHono = new Hono<{ Variables: VariablesDeLaRegie }>()
  const offerts = options.offerts ?? ROLES_OFFERTS_PAR_DEFAUT

  regie.use('*', async (c, next) => {
    const compte = await options.compteDe(c.req.raw.headers)
    if (compte === null) return c.notFound()
    if (!(await estAdministrateur(options.base, options.admins, compte))) return c.notFound()
    c.set('admin', compte)
    await next()
  })

  regie.get('/comptes', async (c) =>
    c.json(await listerLesComptes(options.base, offerts), 200, { 'Cache-Control': 'no-store' }),
  )

  regie.get('/comptes/:compte', async (c) => {
    const fiche = await ficheDuCompte(options.base, c.req.param('compte'), {
      offerts,
      ...(options.banques === undefined ? {} : { banques: options.banques }),
    })
    // Un compte inconnu se refuse comme le reste : le même 404, et rien qui
    // distingue « il n'existe pas » de « vous n'administrez pas ».
    if (fiche === null) return c.notFound()
    return c.json(fiche, 200, { 'Cache-Control': 'no-store' })
  })

  return regie
}
