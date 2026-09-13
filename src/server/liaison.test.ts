/**
 * Ce qu'on vérifie ici : un second appareil qui scanne le code de la voiture
 * ouvre **le même compte**, et le compte qu'il portait avant est effacé s'il
 * était vide, gardé sinon.
 *
 * Tout passe par le serveur, avec des témoins de connexion distincts : c'est
 * ainsi que deux navigateurs se présentent, et c'est donc ce qu'il faut
 * éprouver. Un test qui appellerait les fonctions directement passerait à côté
 * du seul endroit où l'affaire se joue — le témoin qu'on remplace.
 */

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ouvrirBase, type Base } from './base/base'
import { accounts, profiles } from './base/schema'
import { creerIdentite, type Identite } from './identite'
import { creerServeur } from './serveur'

const MIGRATIONS = 'src/server/base/migrations'
const SECRET = 'Zk7pQ2vX9mL4tR8wY1nB6jH3sD5gF0aC-essai-liaison'

let dossier: string
let base: Base
let identite: Identite
let aFermer: () => void

beforeEach(async () => {
  dossier = mkdtempSync(join(tmpdir(), 'liaison-'))
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
    // Sous Windows, le système garde un instant la main sur le fichier.
  }
})

function serveur() {
  return creerServeur({ application: dossier, base, identite })
}

/** Le témoin d'un appareil neuf, qui vient de se créer son compte anonyme. */
async function appareilNeuf(): Promise<string> {
  const reponse = await serveur().request('/api/auth/sign-in/anonymous', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  })
  expect(reponse.status).toBe(200)
  return (reponse.headers.get('set-cookie') ?? '').split(';')[0] ?? ''
}

async function compteDe(temoin: string): Promise<string | null> {
  const reponse = await serveur().request('/api/auth/get-session', { headers: { Cookie: temoin } })
  const session = (await reponse.json()) as { user?: { id?: string } } | null
  return session?.user?.id ?? null
}

async function demanderUnCode(temoin: string) {
  return serveur().request('/api/liaison/code', { method: 'POST', headers: { Cookie: temoin } })
}

interface Reliure {
  statut: number
  temoin: string
  compte?: { id: string; name: string; anonymous: boolean }
  ancien?: string
}

async function relier(temoin: string, couple: unknown): Promise<Reliure> {
  const reponse = await serveur().request('/api/liaison/relier', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: temoin },
    body: JSON.stringify(couple),
  })
  if (!reponse.ok) return { statut: reponse.status, temoin }
  const charge = (await reponse.json()) as {
    compte: { id: string; name: string; anonymous: boolean }
    ancien: string
  }
  return {
    statut: reponse.status,
    temoin: (reponse.headers.get('set-cookie') ?? '').split(';')[0] ?? '',
    compte: charge.compte,
    ancien: charge.ancien,
  }
}

describe('le code de liaison', () => {
  it('pose un mot de passe, et le compte cesse d’être anonyme', async () => {
    const voiture = await appareilNeuf()
    const conduite = await compteDe(voiture)

    const reponse = await demanderUnCode(voiture)
    const couple = (await reponse.json()) as { email: string; motDePasse: string }

    expect(reponse.status).toBe(200)
    // L'adresse est celle que la bibliothèque a fabriquée : elle ne désigne
    // aucune boîte, et rien ne part vers elle.
    expect(couple.email).toMatch(/@anonymous\.placeholder\.invalid$/)
    expect(couple.motDePasse.length).toBeGreaterThan(20)

    const relu = await base.select().from(accounts).where(eq(accounts.id, conduite ?? ''))
    // Le drapeau dirait le contraire de la vérité : ce compte est désormais
    // récupérable ailleurs.
    expect(relu[0]?.isAnonymous).toBe(false)
  })

  it('n’est pas donné à qui n’a pas de compte', async () => {
    const reponse = await demanderUnCode('')
    expect(reponse.status).toBe(401)
  })

  it('périme le précédent quand on en demande un autre', async () => {
    // Un écran photographié la semaine dernière ne doit plus rien ouvrir dès
    // qu'un nouveau code est affiché.
    const voiture = await appareilNeuf()
    const premier = (await (await demanderUnCode(voiture)).json()) as {
      email: string
      motDePasse: string
    }
    const second = (await (await demanderUnCode(voiture)).json()) as {
      email: string
      motDePasse: string
    }

    expect(second.motDePasse).not.toBe(premier.motDePasse)
    expect((await relier(await appareilNeuf(), premier)).statut).toBe(401)
    expect((await relier(await appareilNeuf(), second)).statut).toBe(200)
  })
})

describe('l’appareil qui scanne', () => {
  it('ouvre le même compte que la voiture', async () => {
    const voiture = await appareilNeuf()
    const conduite = await compteDe(voiture)
    const couple = (await (await demanderUnCode(voiture)).json()) as {
      email: string
      motDePasse: string
    }

    const telephone = await appareilNeuf()
    const reliure = await relier(telephone, couple)

    expect(reliure.statut).toBe(200)
    expect(reliure.compte?.id).toBe(conduite)
    // Le témoin rendu doit ouvrir ce compte-là : sans lui, l'appareil aurait
    // relié un compte qu'il ne pourrait plus atteindre.
    expect(await compteDe(reliure.temoin)).toBe(conduite)
    expect(reliure.compte?.anonymous).toBe(false)
  })

  it('perd le compte vide qu’il portait', async () => {
    const voiture = await appareilNeuf()
    const couple = (await (await demanderUnCode(voiture)).json()) as {
      email: string
      motDePasse: string
    }

    const telephone = await appareilNeuf()
    const avant = await compteDe(telephone)
    const reliure = await relier(telephone, couple)

    expect(reliure.ancien).toBe('efface')
    expect(await base.select().from(accounts).where(eq(accounts.id, avant ?? ''))).toHaveLength(0)
  })

  it('garde le compte qui portait quelque chose, et le dit', async () => {
    const voiture = await appareilNeuf()
    const couple = (await (await demanderUnCode(voiture)).json()) as {
      email: string
      motDePasse: string
    }

    const telephone = await appareilNeuf()
    const avant = (await compteDe(telephone)) ?? ''
    await base
      .insert(profiles)
      .values({ id: 'p1', accountId: avant, name: 'Réglé au bureau', content: '{}' })

    const reliure = await relier(telephone, couple)

    expect(reliure.ancien).toBe('garde')
    expect(await base.select().from(accounts).where(eq(accounts.id, avant))).toHaveLength(1)
  })

  it('refuse un couple qui ne vaut rien, sans toucher à ce qu’il portait', async () => {
    const telephone = await appareilNeuf()
    const avant = await compteDe(telephone)

    const reliure = await relier(telephone, {
      email: 'personne@anonymous.placeholder.invalid',
      motDePasse: 'ce-mot-de-passe-n-ouvre-rien',
    })

    expect(reliure.statut).toBe(401)
    expect(await compteDe(telephone)).toBe(avant)
  })

  it('refuse un corps qui ne porte pas de couple', async () => {
    const reponse = await serveur().request('/api/liaison/relier', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.invalid' }),
    })
    expect(reponse.status).toBe(400)
  })
})
