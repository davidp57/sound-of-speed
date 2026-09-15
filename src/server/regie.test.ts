/**
 * La régie, vue par le serveur qui la sert.
 *
 * Trois comptes, et c'est le dispositif de tout ce lot : un administrateur dont
 * l'adresse figure dans la configuration, un conducteur correctement annoncé qui
 * n'administre pas, et un visiteur sans session. Le second et le troisième
 * doivent obtenir exactement la même chose — 404 —, sans qu'aucune réponse
 * n'apprenne qu'il y a quelque chose ici.
 *
 * Le serveur est monté en mémoire sur une base jetable, et reçoit de vraies
 * requêtes : c'est la porte d'entrée d'essai du dépôt, et ce lot n'en ouvre pas
 * de troisième.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { administrateursDeLEnvironnement } from './administration'
import { ouvrirBase, type Base } from './base/base'
import { accounts } from './base/schema'
import { creerIdentite, type Identite } from './identite'
import { creerServeur } from './serveur'

const SECRET = 'Qw3rT7yU1iO5pA9sD2fG6hJ0kL4zX8cV-essai-regie'
const ADRESSE_ADMIN = 'patronne@exemple.test'
const ADRESSE_CONDUCTEUR = 'conducteur@exemple.test'
const MOT_DE_PASSE = 'un mot de passe assez long'

let racine: string
let application: string
let base: Base
let fermer: () => void
let identite: Identite

interface Appareil {
  compte: string
  annonce: Record<string, string>
}

/** Celle dont l'adresse est dans la configuration de la pile. */
let patronne: Appareil
/** Un compte réel, correctement annoncé, qui n'administre pas. */
let conducteur: Appareil

/** Le serveur, avec la liste d'administrateurs que la pile déclarerait. */
function serveur(admins = ADRESSE_ADMIN) {
  return creerServeur({
    application,
    base,
    identite,
    admins: administrateursDeLEnvironnement(admins),
  })
}

async function ouvrirUnCompte(): Promise<Appareil> {
  const creation = await serveur().request('/api/auth/sign-in/anonymous', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  })
  const temoin = (creation.headers.get('set-cookie') ?? '').split(';')[0] ?? ''
  const { user } = (await creation.json()) as { user: { id: string } }
  return { compte: user.id, annonce: { Cookie: temoin } }
}

/** Donne une adresse à un compte, comme l'écran du compte le fait. */
async function rattacher(qui: Appareil, email: string): Promise<void> {
  const reponse = await serveur().request('/api/auth/compte/rattacher', {
    method: 'POST',
    headers: { ...qui.annonce, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, motDePasse: MOT_DE_PASSE }),
  })
  expect(reponse.status, `rattachement de ${email}`).toBe(200)
}

beforeEach(async () => {
  racine = mkdtempSync(join(tmpdir(), 'regie-'))
  application = join(racine, 'dist')
  mkdirSync(application, { recursive: true })
  writeFileSync(join(application, 'index.html'), '<!DOCTYPE html><title>Conduite</title>')
  writeFileSync(join(application, 'regie.html'), '<!DOCTYPE html><title>Régie</title>')

  const ouverte = await ouvrirBase({
    fichier: join(racine, 'speed.db'),
    migrations: 'src/server/base/migrations',
  })
  base = ouverte.base
  fermer = ouverte.fermer
  identite = creerIdentite({ base, secret: SECRET, adresse: 'http://essai' })

  conducteur = await ouvrirUnCompte()
  await rattacher(conducteur, ADRESSE_CONDUCTEUR)
  patronne = await ouvrirUnCompte()
  await rattacher(patronne, ADRESSE_ADMIN)
})

afterEach(() => {
  fermer()
  try {
    rmSync(racine, { recursive: true, force: true })
  } catch {
    // Le ménage n'est pas ce qu'on vérifie.
  }
})

describe('la porte', () => {
  it('ouvre la liste à qui figure dans la configuration', async () => {
    const reponse = await serveur().request('/api/regie/comptes', { headers: patronne.annonce })

    expect(reponse.status).toBe(200)
    expect((await reponse.json()) as unknown[]).toHaveLength(2)
  })

  it('ignore la casse de l’adresse déclarée', async () => {
    const reponse = await serveur('PaTronne@Exemple.TEST').request('/api/regie/comptes', {
      headers: patronne.annonce,
    })

    expect(reponse.status).toBe(200)
  })

  it('répond 404 à un compte réel qui n’administre pas', async () => {
    const reponse = await serveur().request('/api/regie/comptes', { headers: conducteur.annonce })

    expect(reponse.status).toBe(404)
  })

  it('répond le même 404 à un visiteur sans session, et jamais 401', async () => {
    const reponse = await serveur().request('/api/regie/comptes')

    expect(reponse.status).toBe(404)
  })

  it('n’administre personne quand la configuration est vide', async () => {
    const reponse = await serveur('').request('/api/regie/comptes', { headers: patronne.annonce })

    expect(reponse.status).toBe(404)
  })

  it('n’administre pas un compte sans adresse enregistrée', async () => {
    const anonyme = await ouvrirUnCompte()
    // Son adresse de remplacement est fabriquée sous `.invalid` : la déclarer
    // administratrice ne doit rien ouvrir.
    const reponse = await serveur(`${ADRESSE_ADMIN},${anonyme.compte}@exemple.test`).request(
      '/api/regie/comptes',
      { headers: anonyme.annonce },
    )

    expect(reponse.status).toBe(404)
  })

  it('n’a aucune route qui écrive la liste des administrateurs', () => {
    // Vérifié, et pas seulement affirmé : l'administration vient de la
    // configuration de la pile, et rien ici ne doit pouvoir la toucher.
    const chemins = serveur()
      .routes.filter((route) => route.method !== 'GET')
      .map((route) => route.path)

    expect(chemins.filter((chemin) => chemin.includes('admin'))).toEqual([])
  })
})

describe('la liste des comptes', () => {
  it('met les derniers créés en haut, avec ce qu’il faut pour les reconnaître', async () => {
    // Les deux comptes naissent dans la même seconde, et la date en a la
    // précision : on écarte les dates pour vérifier le tri sur ce qu'il trie.
    await base
      .update(accounts)
      .set({ createdAt: new Date('2026-09-01T10:00:00Z') })
      .where(eq(accounts.id, conducteur.compte))
    await base
      .update(accounts)
      .set({ createdAt: new Date('2026-09-14T10:00:00Z') })
      .where(eq(accounts.id, patronne.compte))

    const reponse = await serveur().request('/api/regie/comptes', { headers: patronne.annonce })
    const comptes = (await reponse.json()) as {
      id: string
      nom: string
      adresse: string | null
      anonyme: boolean
      creeLe: string
      roles: string[]
      octets: number
    }[]

    expect(comptes.map((compte) => compte.id)).toEqual([patronne.compte, conducteur.compte])
    expect(comptes[0]?.adresse).toBe(ADRESSE_ADMIN)
    expect(comptes[0]?.roles).toEqual(['conduite', 'atelier', 'synthese'])
    expect(comptes[0]?.anonyme).toBe(false)
  })

  it('ne montre pas l’adresse fabriquée d’un compte anonyme', async () => {
    const anonyme = await ouvrirUnCompte()
    const reponse = await serveur().request('/api/regie/comptes', { headers: patronne.annonce })
    const comptes = (await reponse.json()) as { id: string; adresse: string | null }[]

    expect(comptes.find((compte) => compte.id === anonyme.compte)?.adresse).toBeNull()
  })

  it('pèse ce que chaque compte a déposé', async () => {
    const depot = await serveur().request('/mesures/releve.json', {
      method: 'PUT',
      headers: { ...conducteur.annonce, 'Content-Type': 'application/json' },
      body: '{"mesure":1}',
    })
    expect(depot.status).toBe(201)

    const reponse = await serveur().request('/api/regie/comptes', { headers: patronne.annonce })
    const comptes = (await reponse.json()) as { id: string; octets: number }[]

    expect(comptes.find((compte) => compte.id === conducteur.compte)?.octets).toBe(12)
    expect(comptes.find((compte) => compte.id === patronne.compte)?.octets).toBe(0)
  })
})

describe('la page', () => {
  it('sert la régie sur son adresse, et non l’application de conduite', async () => {
    const reponse = await serveur().request('/regie', { headers: { Accept: 'text/html' } })

    expect(reponse.status).toBe(200)
    expect(await reponse.text()).toContain('Régie')
  })

  it('sert la même page à qui n’administre pas : elle n’annonce rien', async () => {
    // La page est statique et ne dit rien d'elle-même ; c'est la route de
    // données qui refuse. Lui opposer un 404 ne protégerait rien et ferait
    // croire à une panne.
    const reponse = await serveur().request('/regie', {
      headers: { ...conducteur.annonce, Accept: 'text/html' },
    })

    expect(reponse.status).toBe(200)
  })
})
