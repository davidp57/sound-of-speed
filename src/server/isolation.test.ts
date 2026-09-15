/**
 * Ce qu'un compte peut atteindre de ce qu'un autre a déposé.
 *
 * **C'est le seul point du serveur qui ferait perdre des données à quelqu'un**,
 * et il n'avait aucun filet : le reste des tests du serveur ne manipule qu'un
 * seul compte, donc une requête qui oublierait de filtrer passerait au vert.
 *
 * Deux comptes réels, un garni et l'autre vide, et toutes les routes qui
 * touchent aux données d'un compte. Le compte vide s'annonce correctement — ce
 * n'est pas un intrus sans session, c'est un voisin — et il ne doit **rien**
 * voir, lire, écrire ni effacer de ce qui appartient à l'autre.
 *
 * L'inventaire des routes en fin de fichier est ce qui fait durer la
 * vérification : une route ajoutée plus tard sans son contrôle fait rougir ce
 * test au lieu de passer inaperçue.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ouvrirBase, type Base } from './base/base'
import { measuredCars } from './base/schema'
import { creerIdentite, type Identite } from './identite'
import { creerServeur } from './serveur'

const SECRET = 'Qw3rT7yU1iO5pA9sD2fG6hJ0kL4zX8cV-essai-isolation'

/** Une trace d'Anne, dont la clé de trajet se lit dans le nom. */
const TRACE = '2026-09-11-06-24-01_da2m_001.jsonl.gz'
const TRAJET = '2026-09-11-06-24-01_da2m'

let racine: string
let application: string
let base: Base
let fermer: () => void
let identite: Identite

/** Un compte : son identifiant, et le témoin qu'un navigateur renverrait. */
interface Appareil {
  compte: string
  annonce: Record<string, string>
}

/** Le compte garni. */
let anne: Appareil
/** Le voisin : un compte réel, correctement annoncé, et qui n'a rien déposé. */
let boris: Appareil

function serveur() {
  return creerServeur({ application, base, identite })
}

/** Ouvre un compte anonyme, comme le fait un appareil neuf au démarrage. */
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

/** Dépose quelque chose dans chaque dossier, par l'adresse et non par le module. */
async function garnir(qui: Appareil): Promise<void> {
  const ecrire = async (chemin: string, corps: string) => {
    const reponse = await serveur().request(chemin, {
      method: 'PUT',
      headers: { ...qui.annonce, 'Content-Type': 'application/json' },
      body: corps,
    })
    expect(reponse.status, `dépôt de ${chemin}`).toBe(201)
  }

  await ecrire('/profiles/Sport.json', '{"id":"sport","name":"Sport"}')
  await ecrire('/engines/V8.json', '{"id":"v8","name":"V8"}')
  await ecrire('/gearboxes/Auto.json', '{"id":"auto","name":"Auto"}')
  await ecrire(`/traces/${TRACE}`, 'la trace d’Anne')
  await ecrire('/journal/2026-09-11-06-24-01_da2m_001.jsonl.gz', 'le journal d’Anne')
  await ecrire('/mesures/releve.json', '{"mesure":1}')

  // Le profil mesuré n'a pas de route d'écriture : c'est le serveur qui le
  // cumule, et le dépôt de la trace ci-dessus vient de le faire. On écrase donc
  // plutôt que d'insérer — sans quoi la ligne est déjà là et le dépôt échoue.
  await base
    .insert(measuredCars)
    .values({ accountId: qui.compte, content: { aggregate: {} } })
    .onConflictDoUpdate({ target: measuredCars.accountId, set: { content: { aggregate: {} } } })
}

beforeEach(async () => {
  racine = mkdtempSync(join(tmpdir(), 'isolation-'))
  application = join(racine, 'dist')
  mkdirSync(application, { recursive: true })
  writeFileSync(join(application, 'index.html'), '<!DOCTYPE html><title>Conduite</title>')

  const ouverte = await ouvrirBase({
    fichier: join(racine, 'speed.db'),
    migrations: 'src/server/base/migrations',
  })
  base = ouverte.base
  fermer = ouverte.fermer
  identite = creerIdentite({ base, secret: SECRET, adresse: 'http://essai' })

  anne = await ouvrirUnCompte()
  boris = await ouvrirUnCompte()
  await garnir(anne)
})

afterEach(() => {
  fermer()
  try {
    rmSync(racine, { recursive: true, force: true })
  } catch {
    // Le ménage n'est pas ce qu'on vérifie.
  }
})

describe('le voisin ne voit rien', () => {
  it('ne trouve les affaires d’Anne dans aucun listage', async () => {
    const chemins = ['/profiles/', '/engines/', '/gearboxes/', '/traces/', '/journal/', '/mesures/']

    for (const chemin of chemins) {
      const reponse = await serveur().request(chemin, { headers: boris.annonce })
      expect(reponse.status, chemin).toBe(200)
      expect(await reponse.json(), chemin).toEqual([])
    }
  })

  it('ne trouve aucun trajet d’Anne', async () => {
    const reponse = await serveur().request('/sessions/', { headers: boris.annonce })

    expect(reponse.status).toBe(200)
    expect(await reponse.json()).toEqual([])
  })

  it('n’ouvre pas la régie, qui dirait tout de tout le monde', async () => {
    // Ce serveur ne déclare aucun administrateur : personne n'administre, et la
    // régie répond 404 — le même que reçoit un visiteur sans session.
    expect((await serveur().request('/api/regie/comptes', { headers: boris.annonce })).status).toBe(
      404,
    )
    expect((await serveur().request('/api/regie/comptes', { headers: anne.annonce })).status).toBe(
      404,
    )
    expect(
      (
        await serveur().request(`/api/regie/comptes/${anne.compte}`, { headers: boris.annonce })
      ).status,
    ).toBe(404)
  })

  it('ne lit pas le profil mesuré d’Anne', async () => {
    // Anne en a un, et c'est ce qui donne du sens au refus opposé à Boris.
    const chemin = '/mesure-voiture/profil-voiture.json'

    expect((await serveur().request(chemin, { headers: anne.annonce })).status).toBe(200)
    expect((await serveur().request(chemin, { headers: boris.annonce })).status).toBe(404)
  })
})

describe('le voisin ne lit rien', () => {
  it('reçoit 404 sur chaque affaire d’Anne, désignée par son nom', async () => {
    const chemins = [
      '/profiles/Sport.json',
      '/engines/V8.json',
      '/gearboxes/Auto.json',
      `/traces/${TRACE}`,
      '/journal/2026-09-11-06-24-01_da2m_001.jsonl.gz',
      '/mesures/releve.json',
    ]

    for (const chemin of chemins) {
      // Anne la lit : sans ça, un 404 ne prouverait que l'absence.
      expect((await serveur().request(chemin, { headers: anne.annonce })).status, chemin).toBe(200)
      expect((await serveur().request(chemin, { headers: boris.annonce })).status, chemin).toBe(404)
    }
  })

  it('n’emporte pas l’archive d’un trajet d’Anne', async () => {
    const chemin = `/sessions/${TRAJET}/archive.zip`

    expect((await serveur().request(chemin, { headers: anne.annonce })).status).toBe(200)
    expect((await serveur().request(chemin, { headers: boris.annonce })).status).toBe(404)
  })

  it('n’emporte rien d’Anne dans sa propre archive de compte', async () => {
    // Les noms d'entrée d'une archive voyagent en clair dans les octets : les y
    // chercher suffit à dire si quelque chose d'Anne s'y est glissé.
    const reponse = await serveur().request('/mon-compte/archive.zip', { headers: boris.annonce })
    const octets = Buffer.from(await reponse.arrayBuffer()).toString('latin1')

    expect(reponse.status).toBe(200)
    for (const nom of ['Sport.json', 'V8.json', 'Auto.json', TRACE, 'releve.json']) {
      expect(octets, nom).not.toContain(nom)
    }
  })

  it('ne compte pas les dépôts d’Anne dans son verdict de rétention', async () => {
    const reponse = await serveur().request('/retention', { headers: boris.annonce })
    const verdict = (await reponse.json()) as Record<string, unknown>

    expect(reponse.status).toBe(200)
    // Ce qui serait emporté chez Boris ne doit nommer aucune trace d'Anne.
    expect(JSON.stringify(verdict)).not.toContain(TRAJET)
  })
})

describe('le voisin n’écrit ni n’efface rien', () => {
  it('déposer au même nom crée le sien, et laisse celui d’Anne intact', async () => {
    const chemin = '/profiles/Sport.json'

    const depot = await serveur().request(chemin, {
      method: 'PUT',
      headers: { ...boris.annonce, 'Content-Type': 'application/json' },
      body: '{"id":"sport","name":"Celui de Boris"}',
    })
    expect(depot.status).toBe(201)

    const chezAnne = await serveur().request(chemin, { headers: anne.annonce })
    expect(await chezAnne.text()).toContain('Sport')
    expect(await (await serveur().request(chemin, { headers: boris.annonce })).text()).toContain(
      'Celui de Boris',
    )
  })

  it('n’efface pas un trajet d’Anne, et celui-ci survit', async () => {
    const efface = await serveur().request(`/sessions/${TRAJET}`, {
      method: 'DELETE',
      headers: boris.annonce,
    })

    // Effacer ce qui n'est pas à soi n'efface rien, et ne dit pas que ça existe.
    expect(await efface.json()).toEqual({ efface: 0 })

    const chezAnne = await serveur().request('/sessions/', { headers: anne.annonce })
    expect(((await chezAnne.json()) as { cle: string }[]).map((t) => t.cle)).toEqual([TRAJET])
  })

  it('n’épingle ni ne décroche un trajet d’Anne', async () => {
    for (const methode of ['PUT', 'DELETE'] as const) {
      const reponse = await serveur().request(`/sessions/${TRAJET}/epingle`, {
        method: methode,
        headers: boris.annonce,
      })
      expect(reponse.status, methode).toBe(404)
    }
  })
})

/**
 * Un nom déposé est un nom, et pas un chemin.
 *
 * Les noms arrivent de l'adresse et ressortent concaténés dans les entrées de
 * l'archive du compte. Avant ce contrôle, déposer sous `..%2F..%2Fdehors.txt`
 * était accepté et produisait l'entrée `traces/../../dehors.txt` — mesuré — que
 * tout extracteur ordinaire écrit hors du dossier qu'on lui désigne.
 */
describe('un nom de travers n’entre pas', () => {
  const DE_TRAVERS = ['..%2F..%2Fdehors.txt', '..%5C..%5Cdehors.txt', '%2Fabsolu.txt', '..']

  it('refuse un nom qui compose un chemin, dans les trois familles', async () => {
    for (const dossier of ['/traces/', '/profiles/', '/engines/']) {
      for (const nom of DE_TRAVERS) {
        const depot = await serveur().request(`${dossier}${nom}`, {
          method: 'PUT',
          headers: { ...anne.annonce, 'Content-Type': 'application/json' },
          body: '{}',
        })
        expect(depot.status, `${dossier}${nom}`).toBe(404)
      }
    }
  })

  it('n’en laisse aucun dans l’archive du compte', async () => {
    const reponse = await serveur().request('/mon-compte/archive.zip', { headers: anne.annonce })
    const octets = Buffer.from(await reponse.arrayBuffer()).toString('latin1')

    expect(reponse.status).toBe(200)
    // Les noms d'entrée voyagent en clair dans les octets d'une archive.
    expect(octets).not.toContain('../')
    expect(octets).not.toContain('..\\')
  })
})

/**
 * Les gestes qui font changer un compte de mains, vus du voisin.
 *
 * `compte.test.ts` couvre déjà ces routes du point de vue de celui qui les
 * appelle : l'adresse déjà prise, le mot de passe refusé, le compte abandonné
 * qu'on garde. Ce qui n'était pas regardé, c'est **l'autre** : celui dont
 * l'adresse ou l'identifiant sert de cible, et dont les affaires ne doivent pas
 * bouger d'un pouce.
 */
describe('le voisin ne prend pas le compte d’Anne', () => {
  /** Ce qu'Anne porte, relu par elle : le témoin que rien n'a bougé. */
  async function affairesDAnne(): Promise<unknown> {
    const reponse = await serveur().request('/profiles/', { headers: anne.annonce })
    return reponse.json()
  }

  async function appeler(chemin: string, qui: Appareil, corps: unknown): Promise<Response> {
    return serveur().request(`/api/auth${chemin}`, {
      method: 'POST',
      headers: { ...qui.annonce, 'Content-Type': 'application/json' },
      body: JSON.stringify(corps),
    })
  }

  beforeEach(async () => {
    // Anne se donne une adresse : sans elle, il n'y a rien à convoiter.
    const rattache = await appeler('/compte/rattacher', anne, {
      email: 'anne@exemple.test',
      motDePasse: 'un mot de passe assez long',
    })
    expect(rattache.status).toBe(200)
  })

  it('ne prend pas son adresse, et ne voit rien de plus après le refus', async () => {
    const avant = await affairesDAnne()

    const refus = await appeler('/compte/rattacher', boris, {
      email: 'anne@exemple.test',
      motDePasse: 'un autre mot de passe long',
    })
    expect(refus.status).toBe(409)

    // Le refus ne doit pas avoir déplacé une ligne, ni ouvert quoi que ce soit.
    expect(await affairesDAnne()).toEqual(avant)
    expect(await (await serveur().request('/profiles/', { headers: boris.annonce })).json()).toEqual(
      [],
    )
  })

  it('n’ouvre pas son compte avec le mauvais mot de passe, et ne l’abîme pas', async () => {
    const avant = await affairesDAnne()

    const refus = await appeler('/compte/connexion', boris, {
      email: 'anne@exemple.test',
      motDePasse: 'ce n’est pas le sien',
    })
    expect(refus.status).toBe(401)

    expect(await affairesDAnne()).toEqual(avant)
    // Boris est toujours chez lui : une connexion refusée ne déplace personne.
    expect(await (await serveur().request('/profiles/', { headers: boris.annonce })).json()).toEqual(
      [],
    )
  })

  it('n’efface pas son compte en le faisant passer pour un ancien', async () => {
    // Le règlement de l'ancien n'efface qu'un compte anonyme **et** vide. Anne
    // n'est ni l'un ni l'autre : deux raisons, et une seule suffirait.
    const reponse = await appeler('/compte/regler-l-ancien', boris, { ancien: anne.compte })

    expect(reponse.status).toBe(200)
    expect(await reponse.json()).toEqual({ ancien: 'garde' })
    expect((await serveur().request('/profiles/Sport.json', { headers: anne.annonce })).status).toBe(
      200,
    )
  })
})

/**
 * L'inventaire : ce qui fait que cette vérification dure.
 *
 * Les routes sont relues dans l'application elle-même. Une route neuve qui
 * touche aux données d'un compte doit être ajoutée ici **et** couverte plus
 * haut ; tant qu'elle ne l'est pas, ce test rougit et dit son nom.
 */
describe('l’inventaire des routes', () => {
  /** Ce qui ne porte les données de personne : l'identité, l'application, le son. */
  const HORS_SUJET = [
    '/api/auth/*',
    '/audio/*',
    '/*',
    '/api/droits', // ne rend que le compte qui demande, et rien d'un autre
  ]

  /** Ce qui touche aux données d'un compte, et que les cas ci-dessus couvrent. */
  const COUVERTES = [
    // La régie touche aux données de **tous** les comptes, et c'est bien pour
    // cela qu'elle est ici : sans administrateur déclaré, aucune de ses routes
    // ne doit rien rendre à personne.
    '/api/regie/*',
    '/api/regie/comptes',
    '/api/regie/comptes/:compte',
    '/api/regie/comptes/:compte/roles/:role',
    '/api/regie/comptes/:compte/banques/:banque',
    '/api/regie/trace',
    '/profiles/*',
    '/:registre{engines|gearboxes}/*',
    '/mesure-voiture/profil-voiture.json',
    '/sessions/',
    '/sessions/:cle/archive.zip',
    '/mon-compte/archive.zip',
    '/mon-compte/assistance',
    '/retention',
    '/sessions/:cle/epingle',
    '/sessions/:cle',
    '/:dossier{traces|journal|mesures}/*',
  ]

  it('ne connaît aucune route que ce fichier ne classe pas', () => {
    const connues = new Set([...HORS_SUJET, ...COUVERTES])
    const inconnues = [...new Set(serveur().routes.map((route) => route.path))].filter(
      (chemin) => !connues.has(chemin),
    )

    expect(inconnues, 'des routes ne sont ni couvertes ni déclarées hors sujet').toEqual([])
  })
})
