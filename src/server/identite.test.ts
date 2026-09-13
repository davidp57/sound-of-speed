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

import { SOLO_ACCOUNT_ID, ouvrirBase, type Base } from './base/base'
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
    expect(comptes.map((compte) => compte.email)).toEqual(
      expect.arrayContaining([null, 'range@exemple.fr']),
    )

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
    const compte = await contexte.internalAdapter.findUserById(SOLO_ACCOUNT_ID)
    expect(compte?.email ?? null).toBeNull()

    const session = await contexte.internalAdapter.createSession(SOLO_ACCOUNT_ID, false)
    const relue = await contexte.internalAdapter.findSession(session.token)

    expect(relue?.session.userId).toBe(SOLO_ACCOUNT_ID)
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
