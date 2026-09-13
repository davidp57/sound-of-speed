/**
 * Ce qu'on vérifie ici : un compte anonyme devient un vrai compte **sans
 * changer d'identifiant**, et se rouvre depuis un appareil neuf.
 *
 * Le premier point est celui qui compte. La façon ordinaire de se faire un
 * compte — une inscription — en créerait un neuf et laisserait les profils, les
 * moteurs et les trajets sur l'ancien. Ce qu'on veut est l'inverse : la même
 * ligne, une adresse de plus.
 */

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ouvrirBase, type Base } from './base/base'
import { accounts, authIdentities, deposits, profiles } from './base/schema'
import { creerIdentite, type Identite } from './identite'
import { creerServeur } from './serveur'

const MIGRATIONS = 'src/server/base/migrations'
const SECRET = 'Zk7pQ2vX9mL4tR8wY1nB6jH3sD5gF0aC-essai-compte'
const MOT_DE_PASSE = 'un-mot-de-passe-assez-long'

let dossier: string
let base: Base
let identite: Identite
let aFermer: () => void

beforeEach(async () => {
  dossier = mkdtempSync(join(tmpdir(), 'compte-'))
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

async function rattacher(
  temoin: string,
  email: string,
  motDePasse = MOT_DE_PASSE,
): Promise<{ statut: number; message?: string | undefined }> {
  const reponse = await serveur().request('/api/auth/compte/rattacher', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: temoin },
    body: JSON.stringify({ email, motDePasse }),
  })
  if (reponse.ok) return { statut: reponse.status }
  const charge = (await reponse.json()) as { message?: string }
  return { statut: reponse.status, message: charge.message }
}

async function seConnecter(email: string, motDePasse = MOT_DE_PASSE, temoinDIci = '') {
  const reponse = await serveur().request('/api/auth/compte/connexion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(temoinDIci ? { Cookie: temoinDIci } : {}) },
    body: JSON.stringify({ email, motDePasse }),
  })
  if (!reponse.ok) return { statut: reponse.status, temoin: '', ancien: '' }
  const charge = (await reponse.json()) as { ancien: string }
  return {
    statut: reponse.status,
    temoin: (reponse.headers.get('set-cookie') ?? '').split(';')[0] ?? '',
    ancien: charge.ancien,
  }
}

describe('rattacher une adresse', () => {
  it('garde le compte, son identifiant et tout ce qu’il porte', async () => {
    // Le point du ticket. Une inscription ordinaire créerait un compte neuf et
    // laisserait les réglages sur l'ancien.
    const appareil = await appareilNeuf()
    const avant = (await compteDe(appareil)) ?? ''
    await base
      .insert(profiles)
      .values({ id: 'p1', accountId: avant, name: 'Réglé au volant', content: '{}' })

    expect((await rattacher(appareil, 'David@Exemple.fr')).statut).toBe(200)

    expect(await compteDe(appareil)).toBe(avant)
    const lignes = await base.select().from(accounts).where(eq(accounts.id, avant))
    // L'adresse est rangée en minuscules : c'est ce que fait la bibliothèque, et
    // s'y fier évite deux comptes pour la même personne.
    expect(lignes[0]?.email).toBe('david@exemple.fr')
    expect(lignes[0]?.isAnonymous).toBe(false)
    expect(await base.select().from(profiles).where(eq(profiles.accountId, avant))).toHaveLength(1)
  })

  it('n’envoie aucun courriel et ne prétend pas que l’adresse est vérifiée', async () => {
    const appareil = await appareilNeuf()
    await rattacher(appareil, 'sans.relais@exemple.fr')

    const lignes = await base
      .select()
      .from(accounts)
      .where(eq(accounts.email, 'sans.relais@exemple.fr'))
    expect(lignes[0]?.emailVerified).toBe(false)
  })

  it('range l’empreinte du mot de passe, jamais le mot de passe', async () => {
    const appareil = await appareilNeuf()
    const compte = (await compteDe(appareil)) ?? ''
    await rattacher(appareil, 'empreinte@exemple.fr')

    const preuves = await base
      .select()
      .from(authIdentities)
      .where(eq(authIdentities.accountId, compte))
    expect(preuves).toHaveLength(1)
    expect(preuves[0]?.providerId).toBe('credential')
    expect(preuves[0]?.password).not.toContain(MOT_DE_PASSE)
  })

  it('refuse une adresse qui n’en est pas une, et le domaine réservé', async () => {
    const appareil = await appareilNeuf()

    expect((await rattacher(appareil, 'pas une adresse')).statut).toBe(400)
    // `.invalid` ne désigne aucune boîte : s'en donner une reviendrait à se
    // croire joignable en ne l'étant pas.
    expect((await rattacher(appareil, 'moi@anonymous.placeholder.invalid')).statut).toBe(400)
  })

  it('refuse un mot de passe trop court, et le dit', async () => {
    const appareil = await appareilNeuf()

    const rendu = await rattacher(appareil, 'court@exemple.fr', 'court')

    expect(rendu.statut).toBe(400)
    expect(rendu.message).toContain('caractères')
  })

  it('refuse une adresse déjà prise, sans laisser croire à une faute de frappe', async () => {
    await rattacher(await appareilNeuf(), 'occupee@exemple.fr')

    const rendu = await rattacher(await appareilNeuf(), 'occupee@exemple.fr')

    expect(rendu.statut).toBe(409)
    expect(rendu.message).toContain('déjà')
  })

  it('refuse de changer l’adresse d’un compte qui en a une', async () => {
    // Changer d'adresse est un autre geste, et il demande de prouver qu'on est
    // bien là : c'est le ticket 13.
    const appareil = await appareilNeuf()
    await rattacher(appareil, 'premiere@exemple.fr')

    expect((await rattacher(appareil, 'seconde@exemple.fr')).statut).toBe(400)
  })

  it('n’est pas donné à qui n’a pas de compte', async () => {
    expect((await rattacher('', 'personne@exemple.fr')).statut).toBe(401)
  })
})

describe('rouvrir son compte ailleurs', () => {
  it('se fait depuis un appareil neuf, sans code de liaison', async () => {
    const voiture = await appareilNeuf()
    const compte = await compteDe(voiture)
    await rattacher(voiture, 'retour@exemple.fr')

    const ailleurs = await seConnecter('retour@exemple.fr')

    expect(ailleurs.statut).toBe(200)
    expect(await compteDe(ailleurs.temoin)).toBe(compte)
  })

  it('ne s’ouvre pas avec le mauvais mot de passe', async () => {
    await rattacher(await appareilNeuf(), 'garde@exemple.fr')

    expect((await seConnecter('garde@exemple.fr', 'ce-n-est-pas-le-bon')).statut).not.toBe(200)
  })
})

describe('le compte que l’appareil abandonne', () => {
  /** Une adresse à rejoindre, posée sur un appareil qui n'est pas celui qu'on éprouve. */
  async function unCompteAilleurs(email: string): Promise<void> {
    await rattacher(await appareilNeuf(), email)
  }

  it('est effacé quand il est anonyme et vide', async () => {
    await unCompteAilleurs('ailleurs@exemple.fr')
    const ici = await appareilNeuf()
    const abandonne = (await compteDe(ici)) ?? ''

    const rendu = await seConnecter('ailleurs@exemple.fr', MOT_DE_PASSE, ici)

    expect(rendu.ancien).toBe('efface')
    expect(await base.select().from(accounts).where(eq(accounts.id, abandonne))).toHaveLength(0)
  })

  it('est gardé quand il porte quelque chose', async () => {
    await unCompteAilleurs('garde@exemple.fr')
    const ici = await appareilNeuf()
    const abandonne = (await compteDe(ici)) ?? ''
    await base
      .insert(profiles)
      .values({ id: 'p2', accountId: abandonne, name: 'À garder', content: '{}' })

    const rendu = await seConnecter('garde@exemple.fr', MOT_DE_PASSE, ici)

    expect(rendu.ancien).toBe('garde')
    expect(await base.select().from(accounts).where(eq(accounts.id, abandonne))).toHaveLength(1)
  })

  it('est gardé quand il a une adresse, même vide', async () => {
    // Il est récupérable : l'effacer perdrait ce que son propriétaire peut
    // encore rouvrir.
    await unCompteAilleurs('cible@exemple.fr')
    const ici = await appareilNeuf()
    const abandonne = (await compteDe(ici)) ?? ''
    await rattacher(ici, 'aussi.reel@exemple.fr')

    const rendu = await seConnecter('cible@exemple.fr', MOT_DE_PASSE, ici)

    expect(rendu.ancien).toBe('garde')
    expect(await base.select().from(accounts).where(eq(accounts.id, abandonne))).toHaveLength(1)
  })

  it('n’est pas touché quand la connexion échoue', async () => {
    // L'ordre le garantit : rien n'est effacé avant que le mot de passe soit
    // reconnu. Une version en deux appels effaçait d'abord, et laissait
    // l'appareil sans rien quand la connexion ratait.
    await unCompteAilleurs('intacte@exemple.fr')
    const ici = await appareilNeuf()
    const abandonne = (await compteDe(ici)) ?? ''

    expect((await seConnecter('intacte@exemple.fr', 'mauvais', ici)).statut).toBe(401)
    expect(await compteDe(ici)).toBe(abandonne)
  })
})

describe('tenir son compte', () => {
  async function supprimer(temoin: string, motDePasse?: string) {
    const reponse = await serveur().request('/api/auth/compte/supprimer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: temoin },
      body: JSON.stringify(motDePasse === undefined ? {} : { motDePasse }),
    })
    return { statut: reponse.status, entetes: reponse.headers.get('set-cookie') ?? '' }
  }

  it('dit ce que ce serveur-ci sait faire, et rien de plus', async () => {
    // Ce qui n'est pas configuré ne doit pas apparaître à l'écran : c'est ici
    // que l'écran l'apprend.
    const reponse = await serveur().request('/api/auth/compte/possibilites')
    const dit = (await reponse.json()) as { relaisCourriel: boolean; fournisseurs: string[] }

    expect(reponse.status).toBe(200)
    expect(dit.relaisCourriel).toBe(false)
    expect(dit.fournisseurs).toEqual([])
  })

  it('supprime le compte et tout ce qu’il portait', async () => {
    const appareil = await appareilNeuf()
    const compte = (await compteDe(appareil)) ?? ''
    await base
      .insert(profiles)
      .values({ id: 'p9', accountId: compte, name: 'À perdre', content: '{}' })
    await base.insert(deposits).values({
      id: 'd9',
      accountId: compte,
      folder: 'traces',
      name: 't.gz',
      bytes: 3,
      content: Buffer.from([1, 2, 3]),
    })

    expect((await supprimer(appareil)).statut).toBe(200)

    expect(await base.select().from(accounts).where(eq(accounts.id, compte))).toHaveLength(0)
    // La cascade fait le travail : ce qui pendait au compte part avec lui.
    expect(await base.select().from(profiles).where(eq(profiles.accountId, compte))).toHaveLength(0)
    expect(await base.select().from(deposits).where(eq(deposits.accountId, compte))).toHaveLength(0)
  })

  it('efface le témoin, pour que l’appareil ne se croie pas connecté', async () => {
    const appareil = await appareilNeuf()

    const rendu = await supprimer(appareil)

    expect(rendu.entetes).not.toBe('')
    expect(await compteDe(appareil)).toBeNull()
  })

  it('exige le mot de passe quand le compte en a un', async () => {
    // Sans cela, un appareil laissé déverrouillé suffirait à tout effacer.
    const appareil = await appareilNeuf()
    const compte = (await compteDe(appareil)) ?? ''
    await rattacher(appareil, 'a-garder@exemple.fr')

    expect((await supprimer(appareil)).statut).toBe(401)
    expect((await supprimer(appareil, 'ce-n-est-pas-le-bon')).statut).toBe(401)
    expect(await base.select().from(accounts).where(eq(accounts.id, compte))).toHaveLength(1)

    expect((await supprimer(appareil, MOT_DE_PASSE)).statut).toBe(200)
    expect(await base.select().from(accounts).where(eq(accounts.id, compte))).toHaveLength(0)
  })

  it('n’exige rien d’un compte anonyme, qui n’a pas de mot de passe', async () => {
    // Le témoin est la seule preuve qui existe, et c'est déjà celle qui ouvre
    // tout le reste.
    const appareil = await appareilNeuf()

    expect((await supprimer(appareil)).statut).toBe(200)
  })

  it('change le mot de passe, l’ancien à l’appui', async () => {
    const appareil = await appareilNeuf()
    await rattacher(appareil, 'change@exemple.fr')

    const refus = await serveur().request('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: appareil },
      body: JSON.stringify({ currentPassword: 'pas-le-bon', newPassword: 'un-autre-assez-long' }),
    })
    expect(refus.status).not.toBe(200)

    const change = await serveur().request('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: appareil },
      body: JSON.stringify({ currentPassword: MOT_DE_PASSE, newPassword: 'un-autre-assez-long' }),
    })
    expect(change.status).toBe(200)

    // Ce qui compte : c'est le nouveau qui ouvre, et l'ancien qui ne fait plus rien.
    expect((await seConnecter('change@exemple.fr', MOT_DE_PASSE)).statut).toBe(401)
    expect((await seConnecter('change@exemple.fr', 'un-autre-assez-long')).statut).toBe(200)
  })

  it('n’est pas donné à qui n’a pas de compte', async () => {
    expect((await supprimer('')).statut).toBe(401)
  })
})
