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
import { appliquerLaRegle } from './retention'
import { creerServeur } from './serveur'
import type { LigneDeTrace } from './trace'

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

describe('la fiche d’un compte', () => {
  it('montre l’identité, les rattachements, les sessions et les rôles', async () => {
    const reponse = await serveur().request(`/api/regie/comptes/${conducteur.compte}`, {
      headers: patronne.annonce,
    })
    const fiche = (await reponse.json()) as {
      id: string
      adresse: string | null
      anonyme: boolean
      motDePasse: boolean
      fournisseurs: unknown[]
      sessions: { ouverteLe: string; expireLe: string }[]
      roles: { role: string; expireLe: string | null }[]
      banques: string[]
    }

    expect(reponse.status).toBe(200)
    expect(fiche.id).toBe(conducteur.compte)
    expect(fiche.adresse).toBe(ADRESSE_CONDUCTEUR)
    expect(fiche.anonyme).toBe(false)
    expect(fiche.motDePasse).toBe(true)
    expect(fiche.fournisseurs).toEqual([])
    expect(fiche.sessions).toHaveLength(1)
    expect(fiche.roles.map((droit) => droit.role)).toEqual(['conduite', 'atelier', 'synthese'])
  })

  it('montre ce que le compte porte, en nombres', async () => {
    for (const [chemin, corps] of [
      ['/profiles/Sport.json', '{"id":"sport","name":"Sport"}'],
      ['/engines/V8.json', '{"id":"v8","name":"V8"}'],
      ['/mesures/releve.json', '{"mesure":1}'],
    ] as const) {
      const depot = await serveur().request(chemin, {
        method: 'PUT',
        headers: { ...conducteur.annonce, 'Content-Type': 'application/json' },
        body: corps,
      })
      expect(depot.status).toBe(201)
    }

    const reponse = await serveur().request(`/api/regie/comptes/${conducteur.compte}`, {
      headers: patronne.annonce,
    })
    const fiche = (await reponse.json()) as { porte: Record<string, number> }

    expect(fiche.porte).toEqual({
      profils: 1,
      moteurs: 1,
      boites: 0,
      depots: 1,
      octets: 12,
      trajetsMesures: 0,
    })
  })

  it('ne montre aucun nom de profil, aucun nom de fichier, aucune date de trajet', async () => {
    const depot = await serveur().request('/traces/2026-09-11-06-24-01_da2m_001.jsonl.gz', {
      method: 'PUT',
      headers: { ...conducteur.annonce, 'Content-Type': 'application/json' },
      body: 'la trace du conducteur',
    })
    expect(depot.status).toBe(201)
    const profil = await serveur().request('/profiles/Sport.json', {
      method: 'PUT',
      headers: { ...conducteur.annonce, 'Content-Type': 'application/json' },
      body: '{"id":"sport","name":"Sport"}',
    })
    expect(profil.status).toBe(201)

    const reponse = await serveur().request(`/api/regie/comptes/${conducteur.compte}`, {
      headers: patronne.annonce,
    })
    const texte = await reponse.text()

    expect(texte).not.toContain('Sport')
    expect(texte).not.toContain('2026-09-11-06-24-01')
    expect(texte).not.toContain('.jsonl.gz')
  })

  it('n’invente pas d’adresse à un compte anonyme', async () => {
    const anonyme = await ouvrirUnCompte()
    const reponse = await serveur().request(`/api/regie/comptes/${anonyme.compte}`, {
      headers: patronne.annonce,
    })
    const fiche = (await reponse.json()) as { adresse: string | null; anonyme: boolean }

    expect(reponse.status).toBe(200)
    expect(fiche.anonyme).toBe(true)
    expect(fiche.adresse).toBeNull()
  })

  it('dit les banques restreintes que ce compte peut écouter', async () => {
    const avecBanques = creerServeur({
      application,
      base,
      identite,
      admins: administrateursDeLEnvironnement(ADRESSE_ADMIN),
      banques: {
        restreintes: new Set(['gm-ls', 'ferrari']),
        accordees: new Map([[ADRESSE_CONDUCTEUR, new Set(['ferrari'])]]),
      },
    })

    const reponse = await avecBanques.request(`/api/regie/comptes/${conducteur.compte}`, {
      headers: patronne.annonce,
    })
    const fiche = (await reponse.json()) as { banques: string[] }

    expect(fiche.banques).toEqual(['ferrari'])
  })

  it('refuse la fiche à qui n’administre pas, et le compte inconnu de la même façon', async () => {
    expect(
      (
        await serveur().request(`/api/regie/comptes/${patronne.compte}`, {
          headers: conducteur.annonce,
        })
      ).status,
    ).toBe(404)
    expect(
      (await serveur().request('/api/regie/comptes/personne', { headers: patronne.annonce })).status,
    ).toBe(404)
  })
})

describe('donner et reprendre un rôle', () => {
  /** Un serveur où rien n'est offert : sans ça, tout le monde a déjà tout. */
  function ferme() {
    return creerServeur({
      application,
      base,
      identite,
      admins: administrateursDeLEnvironnement(ADRESSE_ADMIN),
      roles: [],
    })
  }

  it('ouvre l’écran correspondant, contrôle serveur compris', async () => {
    // Avant : la route de conduite refuse, faute de rôle.
    expect((await ferme().request('/profiles/', { headers: conducteur.annonce })).status).toBe(403)

    const donne = await ferme().request(
      `/api/regie/comptes/${conducteur.compte}/roles/conduite`,
      { method: 'PUT', headers: patronne.annonce },
    )
    expect(donne.status).toBe(200)

    expect((await ferme().request('/profiles/', { headers: conducteur.annonce })).status).toBe(200)
  })

  it('referme ce qu’elle a ouvert', async () => {
    await ferme().request(`/api/regie/comptes/${conducteur.compte}/roles/conduite`, {
      method: 'PUT',
      headers: patronne.annonce,
    })
    const repris = await ferme().request(
      `/api/regie/comptes/${conducteur.compte}/roles/conduite`,
      { method: 'DELETE', headers: patronne.annonce },
    )

    expect(repris.status).toBe(200)
    expect((await ferme().request('/profiles/', { headers: conducteur.annonce })).status).toBe(403)
  })

  it('attribue la synthèse comme les autres, sans lui donner un pouvoir de route', async () => {
    const donne = await ferme().request(
      `/api/regie/comptes/${conducteur.compte}/roles/synthese`,
      { method: 'PUT', headers: patronne.annonce },
    )
    expect(donne.status).toBe(200)

    const fiche = (await (
      await ferme().request(`/api/regie/comptes/${conducteur.compte}`, { headers: patronne.annonce })
    ).json()) as { roles: { role: string }[] }
    expect(fiche.roles.map((droit) => droit.role)).toEqual(['synthese'])

    // Le rôle de synthèse est un verrou d'affichage : il n'ouvre aucune route,
    // et la conduite reste fermée.
    expect((await ferme().request('/profiles/', { headers: conducteur.annonce })).status).toBe(403)
  })

  it('dit qu’un rôle repris reste offert à tout le monde quand il l’est', async () => {
    const repris = await serveur().request(
      `/api/regie/comptes/${conducteur.compte}/roles/conduite`,
      { method: 'DELETE', headers: patronne.annonce },
    )

    expect(((await repris.json()) as { offertAtous: boolean }).offertAtous).toBe(true)
    // Et la route reste ouverte, puisque c'est la pile qui l'offre.
    expect((await serveur().request('/profiles/', { headers: conducteur.annonce })).status).toBe(200)
  })

  it('ignore un rôle qui n’en est pas un, et un compte inconnu', async () => {
    expect(
      (
        await serveur().request(`/api/regie/comptes/${conducteur.compte}/roles/banc`, {
          method: 'PUT',
          headers: patronne.annonce,
        })
      ).status,
    ).toBe(404)
    expect(
      (
        await serveur().request('/api/regie/comptes/personne/roles/conduite', {
          method: 'PUT',
          headers: patronne.annonce,
        })
      ).status,
    ).toBe(404)
  })

  it('refuse l’attribution et la trace à qui n’administre pas', async () => {
    expect(
      (
        await serveur().request(`/api/regie/comptes/${patronne.compte}/roles/conduite`, {
          method: 'PUT',
          headers: conducteur.annonce,
        })
      ).status,
    ).toBe(404)
    expect((await serveur().request('/api/regie/trace', { headers: conducteur.annonce })).status).toBe(
      404,
    )
  })
})

describe('la trace', () => {
  async function tracer(): Promise<LigneDeTrace[]> {
    const reponse = await serveur().request('/api/regie/trace', { headers: patronne.annonce })
    expect(reponse.status).toBe(200)
    return (await reponse.json()) as LigneDeTrace[]
  }

  it('inscrit chaque attribution et chaque reprise, la plus récente en haut', async () => {
    await serveur().request(`/api/regie/comptes/${conducteur.compte}/roles/conduite`, {
      method: 'PUT',
      headers: patronne.annonce,
    })
    await serveur().request(`/api/regie/comptes/${conducteur.compte}/roles/atelier`, {
      method: 'DELETE',
      headers: patronne.annonce,
    })

    const lignes = await tracer()

    expect(lignes).toHaveLength(2)
    expect(lignes[0]?.geste).toBe('role-repris')
    expect(lignes[0]?.detail).toBe('atelier')
    expect(lignes[0]?.admin.id).toBe(patronne.compte)
    expect(lignes[0]?.cible.id).toBe(conducteur.compte)
    expect(lignes[1]?.geste).toBe('role-donne')
  })

  it('survit à l’effacement du compte visé, en perdant son nom', async () => {
    await serveur().request(`/api/regie/comptes/${conducteur.compte}/roles/conduite`, {
      method: 'PUT',
      headers: patronne.annonce,
    })
    expect((await tracer())[0]?.cible.nom).not.toBeNull()

    // La cascade emporte tout ce qui pend au compte ; la trace n'y pend pas.
    await base.delete(accounts).where(eq(accounts.id, conducteur.compte))

    const lignes = await tracer()
    expect(lignes).toHaveLength(1)
    expect(lignes[0]?.cible.id).toBe(conducteur.compte)
    expect(lignes[0]?.cible.nom).toBeNull()
  })

  it('n’est effacée ni par le ménage de rétention ni par rien d’autre', async () => {
    await serveur().request(`/api/regie/comptes/${conducteur.compte}/roles/conduite`, {
      method: 'PUT',
      headers: patronne.annonce,
    })

    await appliquerLaRegle(base, conducteur.compte, Date.now())

    expect(await tracer()).toHaveLength(1)
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
