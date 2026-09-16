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
import { accounts, assistanceGrants } from './base/schema'
import { creerIdentite, type Identite } from './identite'
import { PLAFOND_PAR_DEFAUT } from './plafond'
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
    // Les trois viennent de la pile tant que rien n'est encaissé : la régie ne
    // les reprend pas, et l'écran doit pouvoir le dire avant le clic.
    expect(fiche.roles.every((droit) => droit.source === 'pile')).toBe(true)
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
    const fiche = (await reponse.json()) as { banques: { banque: string; source: string }[] }

    expect(fiche.banques).toEqual([{ banque: 'ferrari', source: 'pile' }])
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
    ).json()) as { roles: { role: string; source: string }[] }
    expect(fiche.roles).toEqual([{ role: 'synthese', expireLe: null, source: 'compte' }])

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

describe('accorder une banque réservée', () => {
  const RESERVEE = 'banque-a-part'

  /** Un serveur qui déclare une banque réservée, et personne dans la variable. */
  function avecBanque(accordees = new Map<string, ReadonlySet<string>>()) {
    return creerServeur({
      application,
      base,
      identite,
      admins: administrateursDeLEnvironnement(ADRESSE_ADMIN),
      banques: { restreintes: new Set([RESERVEE]), accordees },
    })
  }

  it('la rend écoutable tout de suite, et le retrait la referme', async () => {
    mkdirSync(join(application, 'audio', RESERVEE), { recursive: true })
    writeFileSync(join(application, 'audio', RESERVEE, 'on-750.flac'), 'des octets')
    const echantillon = `/audio/${RESERVEE}/on-750.flac`

    expect((await avecBanque().request(echantillon, { headers: conducteur.annonce })).status).toBe(
      404,
    )

    const accord = await avecBanque().request(
      `/api/regie/comptes/${conducteur.compte}/banques/${RESERVEE}`,
      { method: 'PUT', headers: patronne.annonce },
    )
    expect(accord.status).toBe(200)
    expect((await avecBanque().request(echantillon, { headers: conducteur.annonce })).status).toBe(
      200,
    )

    const retrait = await avecBanque().request(
      `/api/regie/comptes/${conducteur.compte}/banques/${RESERVEE}`,
      { method: 'DELETE', headers: patronne.annonce },
    )
    expect(retrait.status).toBe(200)
    expect(((await retrait.json()) as { peutEncore: boolean }).peutEncore).toBe(false)
    expect((await avecBanque().request(echantillon, { headers: conducteur.annonce })).status).toBe(
      404,
    )
  })

  it('dit qu’un accord de la pile tient encore après le retrait', async () => {
    const app = avecBanque(new Map([[ADRESSE_CONDUCTEUR, new Set([RESERVEE])]]))
    const retrait = await app.request(
      `/api/regie/comptes/${conducteur.compte}/banques/${RESERVEE}`,
      { method: 'DELETE', headers: patronne.annonce },
    )

    expect(((await retrait.json()) as { peutEncore: boolean }).peutEncore).toBe(true)
  })

  it('refuse d’accorder ce que la pile ne déclare pas réservé', async () => {
    const reponse = await avecBanque().request(
      `/api/regie/comptes/${conducteur.compte}/banques/une-banque-ordinaire`,
      { method: 'PUT', headers: patronne.annonce },
    )

    expect(reponse.status).toBe(404)
  })

  it('dit d’où vient chaque accord : de la pile, ou de la table', async () => {
    // **Ce que l'écran a besoin de savoir avant le clic.** Un accord venu de la
    // configuration ne se retire pas depuis la régie : un bouton qui prétendrait
    // le faire resterait pressé, ce qui s'est vu le 16 septembre 2026.
    const parLaPile = avecBanque(new Map([[ADRESSE_CONDUCTEUR, new Set([RESERVEE])]]))

    const duConducteur = (await (
      await parLaPile.request(`/api/regie/comptes/${conducteur.compte}`, {
        headers: patronne.annonce,
      })
    ).json()) as { banques: { banque: string; source: string }[] }
    expect(duConducteur.banques).toEqual([{ banque: RESERVEE, source: 'pile' }])

    // La patronne, elle, n'est pas nommée dans la variable : rien ne lui est
    // accordé tant que la régie ne l'a pas fait.
    const avant = (await (
      await parLaPile.request(`/api/regie/comptes/${patronne.compte}`, { headers: patronne.annonce })
    ).json()) as { banques: unknown[] }
    expect(avant.banques).toEqual([])

    await parLaPile.request(`/api/regie/comptes/${patronne.compte}/banques/${RESERVEE}`, {
      method: 'PUT',
      headers: patronne.annonce,
    })
    const apres = (await (
      await parLaPile.request(`/api/regie/comptes/${patronne.compte}`, { headers: patronne.annonce })
    ).json()) as { banques: { banque: string; source: string }[] }
    expect(apres.banques).toEqual([{ banque: RESERVEE, source: 'compte' }])
  })

  it('montre sur la fiche ce qui est accordé et ce qui peut l’être', async () => {
    await avecBanque().request(`/api/regie/comptes/${conducteur.compte}/banques/${RESERVEE}`, {
      method: 'PUT',
      headers: patronne.annonce,
    })

    const fiche = (await (
      await avecBanque().request(`/api/regie/comptes/${conducteur.compte}`, {
        headers: patronne.annonce,
      })
    ).json()) as { banques: { banque: string; source: string }[]; banquesReservees: string[] }

    expect(fiche.banques).toEqual([{ banque: RESERVEE, source: 'compte' }])
    expect(fiche.banquesReservees).toEqual([RESERVEE])
  })

  it('inscrit l’accord et le retrait dans la trace', async () => {
    await avecBanque().request(`/api/regie/comptes/${conducteur.compte}/banques/${RESERVEE}`, {
      method: 'PUT',
      headers: patronne.annonce,
    })
    await avecBanque().request(`/api/regie/comptes/${conducteur.compte}/banques/${RESERVEE}`, {
      method: 'DELETE',
      headers: patronne.annonce,
    })

    const lignes = (await (
      await serveur().request('/api/regie/trace', { headers: patronne.annonce })
    ).json()) as LigneDeTrace[]

    expect(lignes.map((ligne) => ligne.geste)).toEqual(['banque-retiree', 'banque-accordee'])
    expect(lignes[0]?.detail).toBe(RESERVEE)
  })

  it('refuse l’accord à qui n’administre pas', async () => {
    const reponse = await avecBanque().request(
      `/api/regie/comptes/${patronne.compte}/banques/${RESERVEE}`,
      { method: 'PUT', headers: conducteur.annonce },
    )

    expect(reponse.status).toBe(404)
  })
})

describe('l’accord d’assistance', () => {
  async function etat(qui: Appareil): Promise<{ ouverte: boolean; jusquau: string | null }> {
    const reponse = await serveur().request('/mon-compte/assistance', { headers: qui.annonce })
    expect(reponse.status).toBe(200)
    return (await reponse.json()) as { ouverte: boolean; jusquau: string | null }
  }

  async function basculer(qui: Appareil, methode: 'PUT' | 'DELETE'): Promise<Response> {
    return serveur().request('/mon-compte/assistance', { method: methode, headers: qui.annonce })
  }

  it('est fermé par défaut, sans qu’on ait rien écrit chez lui', async () => {
    expect(await etat(conducteur)).toEqual({ ouverte: false, jusquau: null })
    expect(await base.select().from(assistanceGrants)).toEqual([])
  })

  it('s’ouvre pour vingt-quatre heures, et dit jusqu’à quand', async () => {
    const avant = Date.now()
    const reponse = await basculer(conducteur, 'PUT')
    const accord = (await reponse.json()) as { ouverte: boolean; jusquau: string }

    expect(reponse.status).toBe(200)
    expect(accord.ouverte).toBe(true)
    const restant = new Date(accord.jusquau).getTime() - avant
    expect(restant).toBeGreaterThan(23.9 * 60 * 60 * 1000)
    expect(restant).toBeLessThanOrEqual(24 * 60 * 60 * 1000)
  })

  it('se referme avant l’échéance', async () => {
    await basculer(conducteur, 'PUT')
    expect((await etat(conducteur)).ouverte).toBe(true)

    await basculer(conducteur, 'DELETE')

    expect(await etat(conducteur)).toEqual({ ouverte: false, jusquau: null })
  })

  it('vaut fermé dès que l’heure passe, sans qu’aucune tâche n’ait tourné', async () => {
    await basculer(conducteur, 'PUT')
    // On recule l'échéance dans la base, comme le ferait le temps qui passe.
    await base
      .update(assistanceGrants)
      .set({ expiresAt: Math.floor(Date.now() / 1000) - 1 })
      .where(eq(assistanceGrants.accountId, conducteur.compte))

    expect(await etat(conducteur)).toEqual({ ouverte: false, jusquau: null })
    // La ligne est toujours là : c'est la lecture qui écarte, pas un ménage.
    expect(await base.select().from(assistanceGrants)).toHaveLength(1)
  })

  it('n’appartient qu’à son titulaire : la régie n’a aucune route pour l’ouvrir', async () => {
    // Vérifié sur les routes elles-mêmes : aucune de la régie ne touche à
    // l'assistance, et c'est la séparation qui le garantit, pas une discipline.
    const deLaRegie = serveur()
      .routes.filter((route) => route.path.startsWith('/api/regie'))
      .map((route) => route.path)

    expect(deLaRegie.filter((chemin) => chemin.includes('assistance'))).toEqual([])

    // Et la route du conducteur n'accepte pas qu'on désigne quelqu'un d'autre :
    // elle n'agit que sur le compte de la session.
    await basculer(patronne, 'PUT')
    expect((await etat(conducteur)).ouverte).toBe(false)
  })

  it('exige un compte, et le dit en 401 comme partout ailleurs', async () => {
    expect((await serveur().request('/mon-compte/assistance')).status).toBe(401)
  })

  it('montre son état sur la fiche de la régie', async () => {
    await basculer(conducteur, 'PUT')

    const fiche = (await (
      await serveur().request(`/api/regie/comptes/${conducteur.compte}`, {
        headers: patronne.annonce,
      })
    ).json()) as { assistance: { ouverte: boolean; jusquau: string | null } }

    expect(fiche.assistance.ouverte).toBe(true)
    expect(fiche.assistance.jusquau).not.toBeNull()
  })

  it('inscrit l’ouverture et la fermeture dans la trace', async () => {
    await basculer(conducteur, 'PUT')
    await basculer(conducteur, 'DELETE')

    const lignes = (await (
      await serveur().request('/api/regie/trace', { headers: patronne.annonce })
    ).json()) as LigneDeTrace[]

    expect(lignes.map((ligne) => ligne.geste)).toEqual([
      'assistance-fermee',
      'assistance-ouverte',
    ])
    // C'est le conducteur qui a agi : la trace le nomme des deux côtés.
    expect(lignes[0]?.admin.id).toBe(conducteur.compte)
    expect(lignes[0]?.cible.id).toBe(conducteur.compte)
  })
})

describe('lire les données sous accord', () => {
  const TRANCHE = '2026-09-11-06-24-01_da2m_001.jsonl.gz'

  async function garnirLeConducteur(): Promise<void> {
    for (const [chemin, corps] of [
      ['/profiles/Sport.json', '{"id":"sport","name":"Sport"}'],
      ['/engines/V8.json', '{"id":"v8","name":"V8"}'],
      ['/gearboxes/Auto.json', '{"id":"auto","name":"Auto"}'],
      [`/journal/${TRANCHE}`, 'le journal du conducteur'],
    ] as const) {
      const depot = await serveur().request(chemin, {
        method: 'PUT',
        headers: { ...conducteur.annonce, 'Content-Type': 'application/json' },
        body: corps,
      })
      expect(depot.status, chemin).toBe(201)
    }
  }

  async function ouvrirLAssistance(): Promise<void> {
    const reponse = await serveur().request('/mon-compte/assistance', {
      method: 'PUT',
      headers: conducteur.annonce,
    })
    expect(reponse.status).toBe(200)
  }

  const chemin = (suite = '') => `/api/regie/comptes/${conducteur.compte}/donnees${suite}`

  it('ne rend rien tant que rien n’est accordé, et pas davantage qu’un compte inconnu', async () => {
    await garnirLeConducteur()

    expect((await serveur().request(chemin(), { headers: patronne.annonce })).status).toBe(404)
    expect(
      (
        await serveur().request('/api/regie/comptes/personne/donnees', {
          headers: patronne.annonce,
        })
      ).status,
    ).toBe(404)
  })

  it('rend l’inventaire quand l’accord est ouvert', async () => {
    await garnirLeConducteur()
    await ouvrirLAssistance()

    const reponse = await serveur().request(chemin(), { headers: patronne.annonce })
    const porte = (await reponse.json()) as Record<string, { name: string }[]>

    expect(reponse.status).toBe(200)
    expect(porte['profils']?.map((entree) => entree.name)).toEqual(['Sport.json'])
    expect(porte['moteurs']).toHaveLength(1)
    expect(porte['boites']).toHaveLength(1)
    expect(porte['journal']?.map((entree) => entree.name)).toEqual([TRANCHE])
  })

  it('rend le contenu d’un profil et les octets d’une tranche', async () => {
    await garnirLeConducteur()
    await ouvrirLAssistance()

    const profil = await serveur().request(chemin('/profils/Sport.json'), {
      headers: patronne.annonce,
    })
    expect(profil.status).toBe(200)
    expect(await profil.text()).toContain('"name":"Sport"')

    const tranche = await serveur().request(chemin(`/journal/${TRANCHE}`), {
      headers: patronne.annonce,
    })
    expect(tranche.status).toBe(200)
    expect(await tranche.text()).toBe('le journal du conducteur')
  })

  it('refuse dès que l’heure est passée, sans qu’aucune tâche n’ait tourné', async () => {
    await garnirLeConducteur()
    await ouvrirLAssistance()
    expect((await serveur().request(chemin(), { headers: patronne.annonce })).status).toBe(200)

    await base
      .update(assistanceGrants)
      .set({ expiresAt: Math.floor(Date.now() / 1000) - 1 })
      .where(eq(assistanceGrants.accountId, conducteur.compte))

    expect((await serveur().request(chemin(), { headers: patronne.annonce })).status).toBe(404)
    expect((await serveur().request(chemin('/profils/Sport.json'), { headers: patronne.annonce })).status).toBe(
      404,
    )
  })

  it('referme aussi quand le conducteur retire son accord', async () => {
    await garnirLeConducteur()
    await ouvrirLAssistance()

    await serveur().request('/mon-compte/assistance', {
      method: 'DELETE',
      headers: conducteur.annonce,
    })

    expect((await serveur().request(chemin(), { headers: patronne.annonce })).status).toBe(404)
  })

  it('ne sait que lire : aucune route de régie n’écrit dans les données', () => {
    // Vérifié route par route, et non affirmé : les routes de données de la
    // régie sont toutes en lecture.
    const ecrivent = serveur()
      .routes.filter((route) => route.path.includes('/donnees') && route.method !== 'GET')
      .map((route) => `${route.method} ${route.path}`)

    expect(ecrivent).toEqual([])
  })

  it('n’emprunte l’identité de personne : aucune réponse ne pose de témoin', async () => {
    await garnirLeConducteur()
    await ouvrirLAssistance()

    for (const adresse of ['/api/regie/comptes', `/api/regie/comptes/${conducteur.compte}`, chemin()]) {
      const reponse = await serveur().request(adresse, { headers: patronne.annonce })
      expect(reponse.headers.get('set-cookie'), adresse).toBeNull()
    }
  })

  it('n’ouvre pas l’archive d’un autre compte : elle ne sert que la sienne', async () => {
    await garnirLeConducteur()
    await ouvrirLAssistance()

    // L'archive n'exige aucun rôle — ce sont ses données — et ne prend aucun
    // compte en paramètre : l'administrateur y obtient la sienne, vide.
    const reponse = await serveur().request('/mon-compte/archive.zip', {
      headers: patronne.annonce,
    })
    const octets = Buffer.from(await reponse.arrayBuffer()).toString('latin1')

    expect(reponse.status).toBe(200)
    expect(octets).not.toContain('Sport.json')
    expect(octets).not.toContain(TRANCHE)
  })

  it('inscrit la consultation, sans noyer la trace sous une ligne par fichier', async () => {
    await garnirLeConducteur()
    await ouvrirLAssistance()

    await serveur().request(chemin(), { headers: patronne.annonce })
    await serveur().request(chemin('/profils/Sport.json'), { headers: patronne.annonce })
    await serveur().request(chemin(`/journal/${TRANCHE}`), { headers: patronne.annonce })

    const lignes = (await (
      await serveur().request('/api/regie/trace', { headers: patronne.annonce })
    ).json()) as LigneDeTrace[]
    const lues = lignes.filter((ligne) => ligne.geste === 'donnees-lues')

    expect(lues).toHaveLength(1)
    expect(lues[0]?.cible.id).toBe(conducteur.compte)
  })

  it('refuse à qui n’administre pas, accord ouvert ou non', async () => {
    await ouvrirLAssistance()

    expect((await serveur().request(chemin(), { headers: conducteur.annonce })).status).toBe(404)
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

describe('les gestes de la fiche', () => {
  async function deposer(qui: Appareil, nom: string, corps: string): Promise<Response> {
    return serveur().request(`/mesures/${nom}`, {
      method: 'PUT',
      headers: { ...qui.annonce, 'Content-Type': 'application/json' },
      body: corps,
    })
  }

  it('efface un compte avec tout ce qu’il portait, et sa ligne survit sans son nom', async () => {
    expect((await deposer(conducteur, 'releve.json', '{"mesure":1}')).status).toBe(201)

    const efface = await serveur().request(`/api/regie/comptes/${conducteur.compte}`, {
      method: 'DELETE',
      headers: patronne.annonce,
    })
    expect(efface.status).toBe(200)

    // Le compte a disparu, et ses dépôts avec lui.
    const comptes = (await (
      await serveur().request('/api/regie/comptes', { headers: patronne.annonce })
    ).json()) as { id: string }[]
    expect(comptes.map((compte) => compte.id)).not.toContain(conducteur.compte)

    // La ligne, elle, est là — et elle a perdu le nom.
    const lignes = (await (
      await serveur().request('/api/regie/trace', { headers: patronne.annonce })
    ).json()) as LigneDeTrace[]
    expect(lignes[0]?.geste).toBe('compte-efface')
    expect(lignes[0]?.cible.id).toBe(conducteur.compte)
    expect(lignes[0]?.cible.nom).toBeNull()
  })

  it('efface aussi le compte de l’administrateur qui le demande', async () => {
    // Aucune exception sur son propre compte : la seule chose qu'il ne peut pas,
    // c'est se retirer l'administration, qui vient de la pile.
    const reponse = await serveur().request(`/api/regie/comptes/${patronne.compte}`, {
      method: 'DELETE',
      headers: patronne.annonce,
    })

    expect(reponse.status).toBe(200)
  })

  it('lit le verdict de rétention avant de forcer, puis efface ce qu’il annonçait', async () => {
    // Une trace d'un trajet ancien : la règle l'emporte, rien ne la retient.
    const vieille = '2020-01-01-06-24-01_da2m_001.jsonl.gz'
    expect(
      (
        await serveur().request(`/traces/${vieille}`, {
          method: 'PUT',
          headers: { ...conducteur.annonce, 'Content-Type': 'application/json' },
          body: 'une vieille trace',
        })
      ).status,
    ).toBe(201)

    const verdict = (await (
      await serveur().request(`/api/regie/comptes/${conducteur.compte}/retention`, {
        headers: patronne.annonce,
      })
    ).json()) as { aEffacer: { cle: string }[]; retenus: unknown[] }
    expect(verdict.aEffacer).toHaveLength(1)
    expect(verdict.retenus).toEqual([])

    const passage = await serveur().request(
      `/api/regie/comptes/${conducteur.compte}/retention`,
      { method: 'POST', headers: patronne.annonce },
    )
    expect(((await passage.json()) as { trajets: number }).trajets).toBe(1)

    // Et il n'en reste rien.
    const apres = (await (
      await serveur().request(`/api/regie/comptes/${conducteur.compte}/retention`, {
        headers: patronne.annonce,
      })
    ).json()) as { aEffacer: unknown[] }
    expect(apres.aEffacer).toEqual([])
  })

  it('efface un compte anonyme vide en réglant l’abandon, et garde les autres', async () => {
    const anonyme = await ouvrirUnCompte()

    const regle = await serveur().request(`/api/regie/comptes/${anonyme.compte}/abandon`, {
      method: 'POST',
      headers: patronne.annonce,
    })
    expect(((await regle.json()) as { sort: string }).sort).toBe('efface')

    // Le conducteur, lui, n'est pas anonyme : il est gardé.
    const garde = await serveur().request(`/api/regie/comptes/${conducteur.compte}/abandon`, {
      method: 'POST',
      headers: patronne.annonce,
    })
    expect(((await garde.json()) as { sort: string }).sort).toBe('garde')
  })

  it('garde un compte anonyme qui porte quelque chose', async () => {
    const anonyme = await ouvrirUnCompte()
    expect((await deposer(anonyme, 'releve.json', '{"mesure":1}')).status).toBe(201)

    const regle = await serveur().request(`/api/regie/comptes/${anonyme.compte}/abandon`, {
      method: 'POST',
      headers: patronne.annonce,
    })

    expect(((await regle.json()) as { sort: string }).sort).toBe('garde')
  })

  it('pose un plafond particulier, qui prime, et le retire', async () => {
    const fiche = async () =>
      (await (
        await serveur().request(`/api/regie/comptes/${conducteur.compte}`, {
          headers: patronne.annonce,
        })
      ).json()) as { plafond: { octets: number; particulier: boolean } }

    expect((await fiche()).plafond).toEqual({ octets: PLAFOND_PAR_DEFAUT, particulier: false })

    await serveur().request(`/api/regie/comptes/${conducteur.compte}/plafond/2`, {
      method: 'PUT',
      headers: patronne.annonce,
    })
    expect(await fiche()).toMatchObject({
      plafond: { octets: 2 * 1024 * 1024, particulier: true },
    })

    await serveur().request(`/api/regie/comptes/${conducteur.compte}/plafond`, {
      method: 'DELETE',
      headers: patronne.annonce,
    })
    expect((await fiche()).plafond).toEqual({ octets: PLAFOND_PAR_DEFAUT, particulier: false })
  })

  it('refuse un dépôt qui dépasserait le plafond, sans rien effacer de déposé', async () => {
    const etroit = creerServeur({
      application,
      base,
      identite,
      admins: administrateursDeLEnvironnement(ADRESSE_ADMIN),
      // Vingt octets : le premier dépôt passe, le second non.
      plafond: 20,
    })
    const depot = async (nom: string, corps: string) =>
      etroit.request(`/mesures/${nom}`, {
        method: 'PUT',
        headers: { ...conducteur.annonce, 'Content-Type': 'application/json' },
        body: corps,
      })

    expect((await depot('un.json', '{"a":1}')).status).toBe(201)

    const refuse = await depot('deux.json', '{"b":222222222222}')
    expect(refuse.status).toBe(507)

    // Rien de déjà déposé n'a bougé : le plafond refuse, il n'efface jamais.
    const liste = (await (
      await etroit.request('/mesures/', { headers: conducteur.annonce })
    ).json()) as { name: string }[]
    expect(liste.map((entree) => entree.name)).toEqual(['un.json'])
  })

  it('laisse passer un dépôt qui en remplace un autre au même nom', async () => {
    const etroit = creerServeur({ application, base, identite, plafond: 20 })
    const depot = async (corps: string) =>
      etroit.request('/mesures/rejeu.json', {
        method: 'PUT',
        headers: { ...conducteur.annonce, 'Content-Type': 'application/json' },
        body: corps,
      })

    expect((await depot('{"a":12345678}')).status).toBe(201)
    // La voiture rejoue son envoi : il ne fait rien grossir, et compter les deux
    // refuserait un dépôt qui prend la place qu'il rend.
    expect((await depot('{"a":12345678}')).status).toBe(201)
  })

  it('applique le plafond particulier plutôt que le commun', async () => {
    await serveur().request(`/api/regie/comptes/${conducteur.compte}/plafond/0.00001`, {
      method: 'PUT',
      headers: patronne.annonce,
    })

    // Une dizaine d'octets : tout dépôt réel dépasse.
    const refuse = await deposer(conducteur, 'releve.json', '{"mesure":1}')

    expect(refuse.status).toBe(507)
  })

  it('inscrit les quatre gestes dans la trace', async () => {
    await serveur().request(`/api/regie/comptes/${conducteur.compte}/plafond/3`, {
      method: 'PUT',
      headers: patronne.annonce,
    })
    await serveur().request(`/api/regie/comptes/${conducteur.compte}/plafond`, {
      method: 'DELETE',
      headers: patronne.annonce,
    })
    await serveur().request(`/api/regie/comptes/${conducteur.compte}/retention`, {
      method: 'POST',
      headers: patronne.annonce,
    })
    await serveur().request(`/api/regie/comptes/${conducteur.compte}/abandon`, {
      method: 'POST',
      headers: patronne.annonce,
    })
    await serveur().request(`/api/regie/comptes/${conducteur.compte}`, {
      method: 'DELETE',
      headers: patronne.annonce,
    })

    const lignes = (await (
      await serveur().request('/api/regie/trace', { headers: patronne.annonce })
    ).json()) as LigneDeTrace[]

    expect(lignes.map((ligne) => ligne.geste)).toEqual([
      'compte-efface',
      'abandon-regle',
      'retention-forcee',
      'plafond-retire',
      'plafond-pose',
    ])
    expect(lignes[4]?.detail).toBe('3 Mio')
  })

  it('refuse les quatre gestes à qui n’administre pas', async () => {
    const gestes: [string, 'DELETE' | 'POST' | 'PUT'][] = [
      [`/api/regie/comptes/${patronne.compte}`, 'DELETE'],
      [`/api/regie/comptes/${patronne.compte}/retention`, 'POST'],
      [`/api/regie/comptes/${patronne.compte}/abandon`, 'POST'],
      [`/api/regie/comptes/${patronne.compte}/plafond/1`, 'PUT'],
      [`/api/regie/comptes/${patronne.compte}/plafond`, 'DELETE'],
    ]

    for (const [chemin, methode] of gestes) {
      const reponse = await serveur().request(chemin, {
        method: methode,
        headers: conducteur.annonce,
      })
      expect(reponse.status, `${methode} ${chemin}`).toBe(404)
    }
  })
})

describe('ce que le conducteur voit de son côté', () => {
  async function saTrace(qui: Appareil): Promise<LigneDeTrace[]> {
    const reponse = await serveur().request('/mon-compte/trace', { headers: qui.annonce })
    expect(reponse.status).toBe(200)
    return (await reponse.json()) as LigneDeTrace[]
  }

  it('voit les rôles qu’on lui a donnés et repris, la plus récente en haut', async () => {
    await serveur().request(`/api/regie/comptes/${conducteur.compte}/roles/conduite`, {
      method: 'PUT',
      headers: patronne.annonce,
    })
    await serveur().request(`/api/regie/comptes/${conducteur.compte}/roles/conduite`, {
      method: 'DELETE',
      headers: patronne.annonce,
    })

    const lignes = await saTrace(conducteur)

    expect(lignes.map((ligne) => ligne.geste)).toEqual(['role-repris', 'role-donne'])
    expect(lignes[0]?.admin.nom).not.toBeNull()
  })

  it('voit la consultation de ses données, avec son instant', async () => {
    await serveur().request('/mon-compte/assistance', {
      method: 'PUT',
      headers: conducteur.annonce,
    })
    await serveur().request(`/api/regie/comptes/${conducteur.compte}/donnees`, {
      headers: patronne.annonce,
    })

    const lues = (await saTrace(conducteur)).filter((ligne) => ligne.geste === 'donnees-lues')

    expect(lues).toHaveLength(1)
    expect(Date.parse(lues[0]?.quand ?? '')).toBeGreaterThan(0)
  })

  it('ne voit jamais une ligne qui concerne un autre compte', async () => {
    const voisin = await ouvrirUnCompte()
    await serveur().request(`/api/regie/comptes/${voisin.compte}/roles/conduite`, {
      method: 'PUT',
      headers: patronne.annonce,
    })

    expect(await saTrace(conducteur)).toEqual([])
    expect(await saTrace(voisin)).toHaveLength(1)
  })

  it('lit sa propre trace sans aucun rôle : ce sont ses données', async () => {
    const ferme = creerServeur({
      application,
      base,
      identite,
      admins: administrateursDeLEnvironnement(ADRESSE_ADMIN),
      roles: [],
    })

    const reponse = await ferme.request('/mon-compte/trace', { headers: conducteur.annonce })

    expect(reponse.status).toBe(200)
  })

  it('exige quand même un compte', async () => {
    expect((await serveur().request('/mon-compte/trace')).status).toBe(401)
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
