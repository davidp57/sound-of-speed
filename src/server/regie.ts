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

import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { Hono } from 'hono'

import { estUnRole, type Role } from '../core/identity/roles'

import { estAdministrateur } from './administration'
import { assistanceDuCompte, type Assistance } from './assistance'
import { accordsDuCompte, peutJouer, type DroitsSurLesBanques } from './banques'
import type { Base } from './base/base'
import { accounts, authIdentities, authSessions, bankGrants, deposits, rights } from './base/schema'
import { ceQuePorte } from './heritage'
import { droitsDuCompte, ROLES_OFFERTS_PAR_DEFAUT, rolesDe } from './roles'
import { nomDuFournisseur } from './tiers'
import { inscrire, lireLaTrace } from './trace'

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
  /** Les banques restreintes que ce compte peut écouter, des deux sources. */
  banques: string[]
  /**
   * Toutes les banques que la pile déclare réservées.
   *
   * L'écran a besoin de savoir ce qu'il peut accorder ; sans cette liste il ne
   * pourrait proposer que ce qui est déjà accordé.
   */
  banquesReservees: string[]
  /** L'assistance qu'il a autorisée, et jusqu'à quand. Rien ne se lit encore ici. */
  assistance: Assistance
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
    banques: banquesDuCompte(
      options.banques,
      adresse,
      await accordsDuCompte(base, compte),
    ),
    banquesReservees: [...(options.banques?.restreintes ?? [])].sort(),
    assistance: await assistanceDuCompte(base, compte, options.maintenant ?? Date.now()),
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
 * Les banques restreintes que ce compte peut écouter, **des deux sources**.
 *
 * Celles que la table accorde, et celles que la pile accorde à son adresse — un
 * compte sans adresse n'a que les premières, et `*` accorde toutes les secondes.
 * Les cumuler ici évite que la fiche dise le contraire de ce que le serveur fait.
 */
function banquesDuCompte(
  droits: DroitsSurLesBanques | undefined,
  adresse: string | null,
  enBase: ReadonlySet<string>,
): string[] {
  if (droits === undefined) return []
  const siennes = adresse === null ? undefined : droits.accordees.get(adresse.toLowerCase())
  if (siennes?.has('*') === true) return [...droits.restreintes].sort()
  return [...droits.restreintes]
    .filter((banque) => enBase.has(banque) || siennes?.has(banque) === true)
    .sort()
}

/**
 * Le nom de banque que ce morceau d'adresse désigne.
 *
 * Il voyage encodé, comme partout où une banque se nomme dans ce serveur. Une
 * suite d'octets qui n'en est pas une ne désigne rien.
 */
function nomDeBanque(brut: string): string | null {
  try {
    return decodeURIComponent(brut)
  } catch {
    return null
  }
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
  const droitsSurLesBanques: DroitsSurLesBanques = options.banques ?? {
    restreintes: new Set<string>(),
    accordees: new Map<string, ReadonlySet<string>>(),
  }
  const banquesReservees = droitsSurLesBanques.restreintes

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

  /**
   * Donner un rôle, et le reprendre.
   *
   * **Sans échéance** : ce que la régie ouvre, elle le referme à la main. Une
   * date de fin appartient à ce qui s'encaisse, et rien ne s'encaisse.
   */
  regie.put('/comptes/:compte/roles/:role', async (c) => {
    const compte = c.req.param('compte')
    const role = c.req.param('role')
    if (!estUnRole(role)) return c.notFound()
    if (!(await compteExiste(options.base, compte))) return c.notFound()

    await options.base
      .insert(rights)
      .values({ id: crypto.randomUUID(), accountId: compte, scope: role })
      // Donner deux fois ne fait rien de plus, et surtout ne pose pas d'échéance
      // là où il n'y en avait pas.
      .onConflictDoUpdate({
        target: [rights.accountId, rights.scope],
        set: { expiresAt: null },
      })

    await inscrire(options.base, 'role-donne', c.get('admin'), compte, role)
    return c.json({ role, donne: true })
  })

  regie.delete('/comptes/:compte/roles/:role', async (c) => {
    const compte = c.req.param('compte')
    const role = c.req.param('role')
    if (!estUnRole(role)) return c.notFound()
    if (!(await compteExiste(options.base, compte))) return c.notFound()

    await options.base
      .delete(rights)
      .where(and(eq(rights.accountId, compte), eq(rights.scope, role)))

    await inscrire(options.base, 'role-repris', c.get('admin'), compte, role)
    // Reprendre un rôle **offert à tout le monde** ne le referme pas : ce qui est
    // offert vient de la configuration de la pile, pas de la table des droits. La
    // réponse le dit plutôt que de laisser croire à un geste sans effet.
    return c.json({ role, repris: true, offertAtous: offerts.includes(role) })
  })

  /**
   * Accorder une banque réservée, et retirer l'accord.
   *
   * **Seulement une banque que la pile déclare réservée** : accorder ce qui n'est
   * pas réservé n'ouvrirait rien et laisserait une ligne qui ment. Le nom voyage
   * encodé, comme partout où une banque se nomme.
   */
  regie.put('/comptes/:compte/banques/:banque', async (c) => {
    const compte = c.req.param('compte')
    const banque = nomDeBanque(c.req.param('banque'))
    if (banque === null || !banquesReservees.has(banque)) return c.notFound()
    if (!(await compteExiste(options.base, compte))) return c.notFound()

    await options.base
      .insert(bankGrants)
      .values({ id: crypto.randomUUID(), accountId: compte, bank: banque })
      .onConflictDoNothing()

    await inscrire(options.base, 'banque-accordee', c.get('admin'), compte, banque)
    return c.json({ banque, accordee: true })
  })

  regie.delete('/comptes/:compte/banques/:banque', async (c) => {
    const compte = c.req.param('compte')
    const banque = nomDeBanque(c.req.param('banque'))
    if (banque === null || !banquesReservees.has(banque)) return c.notFound()
    if (!(await compteExiste(options.base, compte))) return c.notFound()

    await options.base
      .delete(bankGrants)
      .where(and(eq(bankGrants.accountId, compte), eq(bankGrants.bank, banque)))

    await inscrire(options.base, 'banque-retiree', c.get('admin'), compte, banque)
    // Un accord posé par la variable d'environnement ne se retire pas d'ici : il
    // vient de la pile. On relit donc ce que le compte peut vraiment, plutôt que
    // de laisser croire à un retrait qui n'a pas eu lieu.
    const peutEncore = await peutJouer(options.base, droitsSurLesBanques, compte, banque)
    return c.json({ banque, retiree: true, peutEncore })
  })

  /** Tout ce que la régie a fait, la plus récente en haut. */
  regie.get('/trace', async (c) =>
    c.json(await lireLaTrace(options.base), 200, { 'Cache-Control': 'no-store' }),
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
