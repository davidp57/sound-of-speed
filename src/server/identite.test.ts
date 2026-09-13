/**
 * Ce qu'on vérifie ici : la bibliothèque d'identité est montée sur la base qui
 * existe, elle rend une session, et elle n'a pas créé de seconde table de
 * comptes au passage.
 */

import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { sql } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ouvrirBase, type Base } from './base/base'
import { ANCIEN_COMPTE_UNIQUE as COMPTE, semerLAncienCompte } from './heritage'
import { accounts, authIdentities, authSessions } from './base/schema'
import { creerIdentite, secretPersistant, type Identite } from './identite'
import { creerServeur } from './serveur'

const MIGRATIONS = 'src/server/base/migrations'
/**
 * Un secret fixe : ce qu'on vérifie n'est pas son tirage au sort.
 *
 * Assez long et assez varié pour que la bibliothèque ne le signale pas comme
 * faible — un avertissement à chaque test rendrait la sortie illisible.
 */
const SECRET = 'Zk7pQ2vX9mL4tR8wY1nB6jH3sD5gF0aC-essai-identite'

let dossier: string
let base: Base
let identite: Identite
let aFermer: () => void

beforeEach(async () => {
  dossier = mkdtempSync(join(tmpdir(), 'identite-'))
  const ouverte = await ouvrirBase({ fichier: join(dossier, 'speed.db'), migrations: MIGRATIONS })
  base = ouverte.base
  aFermer = ouverte.fermer
  // Le compte d'avant l'identité, celui qui n'a pas d'adresse. Il est semé ici
  // parce que ces vérifications portent justement sur ce que la bibliothèque
  // fait d'un compte sans courriel.
  await semerLAncienCompte(base)
  identite = creerIdentite({ base, secret: SECRET, adresse: 'http://essai' })
})

afterEach(() => {
  aFermer()
  try {
    rmSync(dossier, { recursive: true, force: true })
  } catch {
    // Le ménage n'est pas ce qu'on vérifie : sous Windows, le système garde un
    // instant la main sur le fichier après la fermeture.
  }
})

/** Le serveur complet, avec l'identité montée dessus. */
function serveur() {
  return creerServeur({ application: dossier, base, identite })
}

/**
 * Crée un compte avec une adresse, et rend le témoin de connexion.
 *
 * Passe par le serveur, et non par l'interface programmatique : c'est le chemin
 * que prendra un navigateur, et c'est donc lui qu'il faut éprouver.
 */
async function inscrire(email: string): Promise<string> {
  const reponse = await serveur().request('/api/auth/sign-up/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Essai', email, password: 'un-mot-de-passe-assez-long' }),
  })

  expect(reponse.status).toBe(200)
  const temoin = reponse.headers.get('set-cookie')
  expect(temoin).not.toBeNull()
  return (temoin ?? '').split(';')[0] ?? ''
}

describe('la bibliothèque d’identité, montée sur la base', () => {
  it('crée une session, et la relit', async () => {
    const temoin = await inscrire('essai@exemple.fr')

    const relue = await serveur().request('/api/auth/get-session', { headers: { Cookie: temoin } })
    const session = (await relue.json()) as { user?: { email?: string } } | null

    expect(relue.status).toBe(200)
    expect(session?.user?.email).toBe('essai@exemple.fr')
  })

  it('range le compte dans `accounts`, et nulle part ailleurs', async () => {
    // Le point du ticket : une seule table d'identité. Si la bibliothèque avait
    // créé la sienne, le compte serait là-bas et celle-ci resterait à un seul
    // enregistrement — celui qu'on sème au démarrage.
    await inscrire('range@exemple.fr')

    const comptes = await base.select().from(accounts)
    // Le compte d'avant l'identité n'est plus là : le premier compte réel en a
    // hérité, et il s'efface — voir `heritage.ts`.
    expect(comptes.map((compte) => compte.email)).toEqual(['range@exemple.fr'])

    const tables = await base.all<{ name: string }>(
      sql`select name from sqlite_master where type = 'table'`,
    )
    expect(tables.map((table) => table.name)).not.toContain('user')
  })

  it('accroche la preuve et la session au compte', async () => {
    await inscrire('accroche@exemple.fr')

    const compte = (await base.select().from(accounts)).find(
      (ligne) => ligne.email === 'accroche@exemple.fr',
    )
    const preuves = await base.select().from(authIdentities)
    const sessions = await base.select().from(authSessions)

    expect(compte).toBeDefined()
    expect(preuves.map((preuve) => preuve.accountId)).toEqual([compte?.id])
    // L'empreinte, jamais le mot de passe.
    expect(preuves[0]?.password).not.toContain('un-mot-de-passe-assez-long')
    expect(sessions.map((session) => session.accountId)).toEqual([compte?.id])
  })

  it('accepte un compte sans adresse', async () => {
    // Le compte semé au premier démarrage n'en a pas, et n'en aura pas tant que
    // personne ne la rattache. La bibliothèque doit savoir le lire et lui ouvrir
    // une session — sans quoi on ne pourrait pas monter dans la voiture sans
    // rien saisir, ce qui est tout le propos du lot.
    const contexte = await identite.$context
    const compte = await contexte.internalAdapter.findUserById(COMPTE)
    expect(compte?.email ?? null).toBeNull()

    const session = await contexte.internalAdapter.createSession(COMPTE, false)
    const relue = await contexte.internalAdapter.findSession(session.token)

    expect(relue?.session.userId).toBe(COMPTE)
  })

  it('ne répond pas la page d’application sous son chemin', async () => {
    // Sans cette vérification, un appel d'identité mal formé recevrait un 200 et
    // du HTML. Le client ne pourrait plus distinguer « ce chemin n'existe pas »
    // d'une réponse valide.
    const reponse = await serveur().request('/api/auth/rien-du-tout', {
      headers: { Accept: 'text/html' },
    })

    expect(reponse.status).not.toBe(200)
  })
})

/**
 * Demande un compte anonyme **comme le navigateur le fait**.
 *
 * Le type et le corps ne sont pas décoratifs : un POST qui annonce une longueur
 * sans annoncer un type reçoit 415. Une version de ce test qui construisait sa
 * requête à la main passait en vert pendant que la page, elle, n'obtenait rien.
 */
function demanderUnCompteAnonyme(entetes: Record<string, string> = {}) {
  return serveur().request('/api/auth/sign-in/anonymous', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...entetes },
    body: '{}',
  })
}

describe('le compte anonyme', () => {
  it('se crée sans que rien soit saisi, et se relit', async () => {
    const creation = await demanderUnCompteAnonyme()
    expect(creation.status).toBe(200)

    const temoin = (creation.headers.get('set-cookie') ?? '').split(';')[0] ?? ''
    const relue = await serveur().request('/api/auth/get-session', { headers: { Cookie: temoin } })
    const session = (await relue.json()) as { user?: { id?: string; isAnonymous?: boolean } } | null

    expect(session?.user?.isAnonymous).toBe(true)
  })

  it('se reconnaît à sa colonne, pas à la forme de son adresse', async () => {
    await demanderUnCompteAnonyme()

    const anonymes = (await base.select().from(accounts)).filter((compte) => compte.isAnonymous)
    expect(anonymes).toHaveLength(1)
    // L'adresse est fabriquée parce que la bibliothèque en exige une ; elle l'est
    // sous un domaine réservé qui ne désigne aucune boîte. Ce qui fait foi reste
    // la colonne.
    expect(anonymes[0]?.email).toMatch(/@anonymous\.placeholder\.invalid$/)
  })

  it('garde son compte un an, et non une semaine', async () => {
    // Une voiture qui ne roule pas pendant les vacances ne doit pas perdre son
    // compte, et le perdre sans rien dire.
    const creation = await demanderUnCompteAnonyme()
    expect(creation.status).toBe(200)

    const session = (await base.select().from(authSessions))[0]
    const jours = ((session?.expiresAt?.getTime() ?? 0) - Date.now()) / (24 * 60 * 60 * 1000)
    expect(jours).toBeGreaterThan(360)
  })

  it('ne s’efface pas quand une adresse vient s’y rattacher', async () => {
    // Le piège : la bibliothèque supprime le compte anonyme après un
    // rattachement. Huit tables pendent à `accounts` en cascade — cette
    // suppression emporterait tout ce que l'appareil avait déposé.
    const creation = await demanderUnCompteAnonyme()
    const temoin = (creation.headers.get('set-cookie') ?? '').split(';')[0] ?? ''
    const anonyme = (await base.select().from(accounts)).find((compte) => compte.isAnonymous)

    await serveur().request('/api/auth/sign-up/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: temoin },
      body: JSON.stringify({
        name: 'Rattaché',
        email: 'rattache@exemple.fr',
        password: 'un-mot-de-passe-assez-long',
      }),
    })

    const restants = await base.select().from(accounts)
    expect(restants.map((compte) => compte.id)).toContain(anonyme?.id)
  })
})

describe('le secret qui signe les témoins', () => {
  it('se crée au premier démarrage, et ne change plus', () => {
    const fichier = join(dossier, 'speed.db')

    const premier = secretPersistant(fichier)
    const second = secretPersistant(fichier)

    expect(premier).toBe(second)
    expect(premier.length).toBeGreaterThan(20)
    expect(readFileSync(join(dossier, 'identite.secret'), 'utf8').trim()).toBe(premier)
  })

  it('ne se laisse pas lire par n’importe qui', () => {
    secretPersistant(join(dossier, 'speed.db'))

    // Sur un volume partagé, un secret lisible par tous vaut un secret publié.
    // Windows n'a pas ces droits-là : la vérification n'y a pas de sens.
    if (process.platform === 'win32') return
    const droits = statSync(join(dossier, 'identite.secret')).mode & 0o777
    expect(droits).toBe(0o600)
  })
})
