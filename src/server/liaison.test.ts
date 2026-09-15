/**
 * Ce qu'on vérifie ici : un second appareil qui reçoit le code de la voiture
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
import { accounts, authSessions, authVerifications, profiles } from './base/schema'
import { creerIdentite, type Identite } from './identite'
import { normaliser } from './liaison'
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

async function demanderUnCode(temoin: string): Promise<{ statut: number; code: string }> {
  const reponse = await serveur().request('/api/auth/liaison/code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: temoin },
    body: '{}',
  })
  if (!reponse.ok) return { statut: reponse.status, code: '' }
  const charge = (await reponse.json()) as { code: string }
  return { statut: reponse.status, code: charge.code }
}

interface Reliure {
  statut: number
  temoin: string
  compte?: { id: string; name: string; anonymous: boolean }
  ancien?: string
}

async function relier(temoin: string, code: string): Promise<Reliure> {
  const reponse = await serveur().request('/api/auth/liaison/relier', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: temoin },
    body: JSON.stringify({ code }),
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
  it('se lit et se dicte : huit caractères, sans ceux qui se confondent', async () => {
    const voiture = await appareilNeuf()
    const { statut, code } = await demanderUnCode(voiture)

    expect(statut).toBe(200)
    // Ni I, ni L, ni O, ni U, ni 0, ni 1 : ce qui se confond sur un écran de
    // voiture, ou au téléphone.
    expect(code).toMatch(/^[2-9A-HJKMNP-TV-Z]{4}-[2-9A-HJKMNP-TV-Z]{4}$/)
  })

  it('n’en laisse qu’un vivant : demander le suivant tue le précédent', async () => {
    // Sans ça, tous les codes demandés restent ouverts vingt-quatre heures. Un
    // code aperçu par-dessus une épaule survivrait à sa régénération, et l'écran
    // qui en montre un nouveau laisserait croire que l'ancien est mort.
    const voiture = await appareilNeuf()
    const { code: premier } = await demanderUnCode(voiture)
    const { code: second } = await demanderUnCode(voiture)

    expect(premier).not.toBe(second)
    expect((await relier(await appareilNeuf(), premier ?? '')).statut).toBe(401)
    expect((await relier(await appareilNeuf(), second ?? '')).statut).toBe(200)
  })

  it('ne laisse pas de quoi ouvrir un compte dans la base', async () => {
    // Une base qu'on recopie pour la regarder — c'est ce que fait `npm run
    // verdict` — ne doit pas livrer de quoi entrer chez les gens.
    const voiture = await appareilNeuf()
    const { code } = await demanderUnCode(voiture)

    // Deux rangées : le jeton, rangé sous l'empreinte du code, et le renvoi qui
    // dit quel code est celui de ce compte — lui aussi ne porte qu'une
    // empreinte. Ni l'une ni l'autre ne doit livrer le code.
    const rangees = await base.select().from(authVerifications)
    expect(rangees).toHaveLength(2)

    const nu = code.replace('-', '')
    for (const rangee of rangees) {
      for (const champ of [rangee.identifier, rangee.value]) {
        expect(champ).not.toContain(code)
        expect(champ).not.toContain(nu)
      }
    }
  })

  it('n’est pas donné à qui n’a pas de compte', async () => {
    expect((await demanderUnCode('')).statut).toBe(401)
  })

  it('ne touche pas au mot de passe du compte', async () => {
    // Le défaut de la première version, et la raison de celle-ci : la
    // bibliothèque ne garde qu'une preuve « mot de passe » par compte, donc
    // afficher un code aurait écrasé celui qu'on choisira au ticket 11.
    const voiture = await appareilNeuf()
    await demanderUnCode(voiture)

    const compte = await compteDe(voiture)
    const lignes = await base.select().from(accounts).where(eq(accounts.id, compte ?? ''))
    expect(lignes[0]?.isAnonymous).toBe(true)
  })
})

describe('l’appareil qui reçoit le code', () => {
  it('ouvre le même compte que la voiture', async () => {
    const voiture = await appareilNeuf()
    const conduite = await compteDe(voiture)
    const { code } = await demanderUnCode(voiture)

    const telephone = await appareilNeuf()
    const reliure = await relier(telephone, code)

    expect(reliure.statut).toBe(200)
    expect(reliure.compte?.id).toBe(conduite)
    // Le témoin rendu doit ouvrir ce compte-là : sans lui, l'appareil aurait
    // relié un compte qu'il ne pourrait plus atteindre.
    expect(await compteDe(reliure.temoin)).toBe(conduite)
  })

  it('reçoit une session à lui, et non celle de la voiture', async () => {
    // Deux appareils qui partageraient une session se déconnecteraient ensemble.
    const voiture = await appareilNeuf()
    const { code } = await demanderUnCode(voiture)
    const telephone = await appareilNeuf()

    const reliure = await relier(telephone, code)

    expect(reliure.temoin).not.toBe(voiture)
    const compte = await compteDe(voiture)
    const sessions = await base
      .select()
      .from(authSessions)
      .where(eq(authSessions.accountId, compte ?? ''))
    expect(sessions).toHaveLength(2)
  })

  it('accepte le code en minuscules et sans le trait', async () => {
    const voiture = await appareilNeuf()
    const { code } = await demanderUnCode(voiture)

    const telephone = await appareilNeuf()
    const reliure = await relier(telephone, code.replace('-', '').toLowerCase())

    expect(reliure.statut).toBe(200)
  })

  it('perd le compte vide qu’il portait', async () => {
    const voiture = await appareilNeuf()
    const { code } = await demanderUnCode(voiture)

    const telephone = await appareilNeuf()
    const avant = await compteDe(telephone)
    const reliure = await relier(telephone, code)

    expect(reliure.ancien).toBe('efface')
    expect(await base.select().from(accounts).where(eq(accounts.id, avant ?? ''))).toHaveLength(0)
  })

  it('garde le compte qui portait quelque chose, et le dit', async () => {
    const voiture = await appareilNeuf()
    const { code } = await demanderUnCode(voiture)

    const telephone = await appareilNeuf()
    const avant = (await compteDe(telephone)) ?? ''
    await base
      .insert(profiles)
      .values({ id: 'p1', accountId: avant, name: 'Réglé au bureau', content: '{}' })

    const reliure = await relier(telephone, code)

    expect(reliure.ancien).toBe('garde')
    expect(await base.select().from(accounts).where(eq(accounts.id, avant))).toHaveLength(1)
  })
})

describe('un code qui ne vaut plus rien', () => {
  it('ne sert qu’une fois', async () => {
    const voiture = await appareilNeuf()
    const { code } = await demanderUnCode(voiture)

    expect((await relier(await appareilNeuf(), code)).statut).toBe(200)
    expect((await relier(await appareilNeuf(), code)).statut).toBe(401)
  })

  it('expire', async () => {
    // Le temps n'est pas simulé : on avance la date d'échéance dans la base,
    // ce qui éprouve la même chose — c'est la bibliothèque qui compare, et
    // c'est sa comparaison qu'on veut voir refuser.
    const voiture = await appareilNeuf()
    const { code } = await demanderUnCode(voiture)
    await base
      .update(authVerifications)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(authVerifications.value, (await compteDe(voiture)) ?? ''))

    expect((await relier(await appareilNeuf(), code)).statut).toBe(401)
  })

  it('refuse un code inventé, sans toucher à ce que l’appareil portait', async () => {
    const telephone = await appareilNeuf()
    const avant = await compteDe(telephone)

    const reliure = await relier(telephone, 'ABCD-2345')

    expect(reliure.statut).toBe(401)
    expect(await compteDe(telephone)).toBe(avant)
  })

  it('refuse un corps qui ne porte pas de code', async () => {
    const reponse = await serveur().request('/api/auth/liaison/relier', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rien: 'du tout' }),
    })
    expect(reponse.status).toBe(400)
  })
})

describe('ce qu’on accepte à la saisie', () => {
  it('ignore la casse, les traits et les espaces', () => {
    expect(normaliser('k7m4pq2r')).toBe('K7M4-PQ2R')
    expect(normaliser('K7M4-PQ2R')).toBe('K7M4-PQ2R')
    expect(normaliser(' k7m4 pq2r ')).toBe('K7M4-PQ2R')
  })

  it('laisse tel quel ce qui n’a pas la bonne longueur', () => {
    // Sans quoi un code tronqué serait regroupé en un code d'apparence valide,
    // et l'erreur rendue serait la mauvaise.
    expect(normaliser('K7M4')).toBe('K7M4')
  })
})
