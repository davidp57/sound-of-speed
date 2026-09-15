/**
 * Ce qu'un compte porte après qu'un fournisseur s'y rattache.
 *
 * Le défaut que ces essais tiennent : le compte cessait d'être anonyme en
 * gardant l'adresse de remplacement que le greffon lui avait fabriquée. David,
 * le 14 septembre 2026, après s'être connecté avec Google : « j'ai mes profils
 * mais pas mon email ni mon gravatar ».
 *
 * La preuve se pose **par la bibliothèque** et non par une écriture directe :
 * c'est elle qui déclenche le crochet, et une insertion Drizzle ne prouverait
 * rien.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ouvrirBase, type Base } from './base/base'
import { accounts } from './base/schema'
import { creerIdentite, type Identite } from './identite'
import { creerServeur } from './serveur'

const MIGRATIONS = 'src/server/base/migrations'
const SECRET = 'Zk7pQ2vX9mL4tR8wY1nB6jH3sD5gF0aC-essai-adresse-du-tiers'

let dossier: string
let base: Base
let identite: Identite
let aFermer: () => void

beforeEach(async () => {
  dossier = mkdtempSync(join(tmpdir(), 'adresse-tiers-'))
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
    // Windows garde un instant la main sur le fichier.
  }
})

/** Un appareil qui se présente, et le compte anonyme qu'il reçoit. */
async function unCompteAnonyme(): Promise<string> {
  const reponse = await creerServeur({ application: dossier, base, identite }).request(
    '/api/auth/sign-in/anonymous',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
  )
  const dit = (await reponse.json()) as { user: { id: string } }
  return dit.user.id
}

/** Le jeton d'identité tel qu'un fournisseur le signe. */
function jeton(charge: Record<string, unknown>): string {
  const partie = (valeur: unknown): string =>
    Buffer.from(JSON.stringify(valeur), 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
  return `${partie({ alg: 'RS256' })}.${partie(charge)}.signature`
}

/** Rattache un fournisseur, comme le retour d'une redirection le fait. */
async function rattacher(compte: string, idToken: string | undefined): Promise<void> {
  const contexte = await identite.$context
  await contexte.internalAdapter.linkAccount({
    userId: compte,
    providerId: 'google',
    accountId: `chez-google-${compte}`,
    ...(idToken === undefined ? {} : { idToken }),
  })
}

async function lireLeCompte(id: string) {
  const [trouve] = await base
    .select({ email: accounts.email, image: accounts.image, anonyme: accounts.isAnonymous })
    .from(accounts)
    .where(eq(accounts.id, id))
    .limit(1)
  return trouve
}

describe('un fournisseur qui se rattache', () => {
  it('donne son adresse au compte qui n’en avait pas de vraie', async () => {
    const compte = await unCompteAnonyme()
    const avant = await lireLeCompte(compte)
    expect(avant?.email).toMatch(/\.invalid$/)

    await rattacher(compte, jeton({ email: 'David@Example.com' }))

    expect((await lireLeCompte(compte))?.email).toBe('david@example.com')
  })

  it('donne aussi son portrait', async () => {
    const compte = await unCompteAnonyme()

    await rattacher(
      compte,
      jeton({ email: 'david@example.com', picture: 'https://exemple/photo.jpg' }),
    )

    expect((await lireLeCompte(compte))?.image).toBe('https://exemple/photo.jpg')
  })

  it('lève l’anonymat, comme avant', async () => {
    const compte = await unCompteAnonyme()

    await rattacher(compte, jeton({ email: 'david@example.com' }))

    expect((await lireLeCompte(compte))?.anonyme).toBe(false)
  })

  it('ne remplace pas une adresse choisie', async () => {
    // Un tiers est une preuve de plus, jamais un remplacement.
    const compte = await unCompteAnonyme()
    await base
      .update(accounts)
      .set({ email: 'moi@chez-moi.fr', isAnonymous: false })
      .where(eq(accounts.id, compte))

    await rattacher(compte, jeton({ email: 'autre@example.com' }))

    expect((await lireLeCompte(compte))?.email).toBe('moi@chez-moi.fr')
  })

  it('lève l’anonymat même sans jeton, et ne casse rien', async () => {
    // Un fournisseur qui n'en donne pas — ou une preuve posée autrement — ne
    // doit pas faire échouer le rattachement.
    const compte = await unCompteAnonyme()

    await rattacher(compte, undefined)

    const apres = await lireLeCompte(compte)
    expect(apres?.anonyme).toBe(false)
    expect(apres?.email).toMatch(/\.invalid$/)
  })
})
