import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Role } from '../core/identity/roles'

import { ouvrirBase, type Base } from './base/base'
import { creerIdentite, type Identite } from './identite'
import { ecrireDepot } from './depots'
import { creerServeur } from './serveur'

let racine: string
let application: string
let echantillons: string

beforeEach(() => {
  racine = mkdtempSync(join(tmpdir(), 'serveur-'))
  application = join(racine, 'dist')
  echantillons = join(racine, 'deposes')

  // Une application construite, réduite à ce qui compte pour ces vérifications.
  mkdirSync(join(application, 'audio', 'gm-ls'), { recursive: true })
  writeFileSync(join(application, 'index.html'), '<!DOCTYPE html><title>Conduite</title>')
  writeFileSync(join(application, 'relecteur.html'), '<!DOCTYPE html><title>Relecteur</title>')
  writeFileSync(join(application, 'audio', 'gm-ls', 'on-750.flac'), OCTETS_LIVRES)

  // Et un volume d'échantillons déposés, comme sur un serveur en service.
  mkdirSync(join(echantillons, 'v8-musclecar'), { recursive: true })
  writeFileSync(join(echantillons, 'v8-musclecar', 'on-low.wav'), 'des octets déposés')
})

afterEach(() => {
  try {
    rmSync(racine, { recursive: true, force: true })
  } catch {
    // Le ménage n'est pas ce qu'on vérifie.
  }
})

function serveur() {
  return creerServeur({ application, echantillons })
}

/** Le contenu de l'échantillon livré, dont on mesure la taille plutôt que de l'écrire. */
const OCTETS_LIVRES = 'des octets livres avec l application'

/** Une navigation, telle qu'un navigateur la formule. */
const NAVIGATION = { headers: { Accept: 'text/html,application/xhtml+xml' } }

describe('les deux sources d’échantillons', () => {
  it('réunit les banques déposées et celle qui vient avec l’application', async () => {
    // C'est ce que le serveur de fichiers d'avant ne savait pas faire : le
    // volume se montait **par-dessus** le dossier des échantillons et masquait
    // les banques livrées, qui n'apparaissaient donc dans aucune liste.
    const reponse = await serveur().request('/audio/')
    const entrees = (await reponse.json()) as { name: string; type: string }[]

    expect(reponse.status).toBe(200)
    expect(entrees).toEqual(
      expect.arrayContaining([
        { name: 'gm-ls', type: 'directory' },
        { name: 'v8-musclecar', type: 'directory' },
      ]),
    )
  })

  it('sert un échantillon de chacune', async () => {
    expect((await serveur().request('/audio/gm-ls/on-750.flac')).status).toBe(200)
    expect((await serveur().request('/audio/v8-musclecar/on-low.wav')).status).toBe(200)
  })

  it('rend le listage au format que le cœur attend', async () => {
    // Un tableau d'entrées `{ name, type }`, et rien d'autre : quatre modules du
    // cœur le lisent, et le service worker distingue un listage d'un échantillon
    // à la seule barre oblique finale.
    const entrees = (await (await serveur().request('/audio/gm-ls/')).json()) as unknown[]

    expect(entrees).toEqual([{ name: 'on-750.flac', type: 'file' }])
  })

  it('rend 404 sur une banque qui n’existe nulle part', async () => {
    expect((await serveur().request('/audio/jamais-vue/')).status).toBe(404)
  })
})

describe('le repli de l’application à page unique', () => {
  it('rend la page pour une navigation profonde', async () => {
    const reponse = await serveur().request('/configuration', NAVIGATION)

    expect(reponse.status).toBe(200)
    expect(await reponse.text()).toContain('Conduite')
  })

  it('rend le relecteur pour le relecteur, et non l’application de conduite', async () => {
    // Ouvrir le relecteur hors réseau devait déjà donner le relecteur : servir
    // l'autre page se lit comme un bug, alors que c'est un repli.
    const reponse = await serveur().request('/relecteur/trajet', NAVIGATION)

    expect(await reponse.text()).toContain('Relecteur')
  })

  it('rend la racine même à qui n’annonce rien', async () => {
    // Une sonde de santé, un outil en ligne de commande : ils n'envoient pas
    // d'en-tête « Accept », et doivent obtenir la page.
    expect((await serveur().request('/')).status).toBe(200)
  })

  it('ne répond pas à la place d’une ressource absente', async () => {
    // Servir la page à la place d'une image rend 200 là où il fallait 404, et le
    // client ne peut plus distinguer l'absent du cassé.
    expect((await serveur().request('/icons/pas-la.png')).status).toBe(404)
  })

  it('ne répond jamais sur un chemin de données', async () => {
    // Le piège le plus coûteux : le client demande du JSON, reçoit une page HTML
    // avec un code 200, et classe la réponse « illisible » faute de pouvoir
    // faire la différence avec un fichier simplement absent.
    for (const chemin of [
      '/mesure-voiture/profil-voiture.json',
      '/traces/rien.jsonl',
      '/profiles/rien.json',
      '/engines/rien.json',
      '/gearboxes/rien.json',
      '/journal/rien.jsonl',
      '/mesures/rien.json',
    ]) {
      const reponse = await serveur().request(chemin, NAVIGATION)
      expect(reponse.status, chemin).toBe(404)
    }
  })
})

describe('ce qui sort avec un fichier', () => {
  it('annonce qu’il accepte les demandes de plage', async () => {
    const reponse = await serveur().request('/audio/gm-ls/on-750.flac')

    expect(reponse.headers.get('accept-ranges')).toBe('bytes')
  })

  it('honore une plage, et dit laquelle', async () => {
    const reponse = await serveur().request('/audio/gm-ls/on-750.flac', {
      headers: { Range: 'bytes=0-3' },
    })

    expect(reponse.status).toBe(206)
    expect(await reponse.text()).toBe('des ')
    expect(reponse.headers.get('content-range')).toBe(`bytes 0-3/${OCTETS_LIVRES.length}`)
  })

  it('refuse une plage hors du fichier', async () => {
    const reponse = await serveur().request('/audio/gm-ls/on-750.flac', {
      headers: { Range: 'bytes=9999-' },
    })

    expect(reponse.status).toBe(416)
  })

  it('ne met pas en cache ce qui décide des versions', async () => {
    // La page d'entrée et le service worker sont ce qui fait basculer
    // l'application sur une nouvelle version : les figer figerait tout.
    const page = await serveur().request('/', NAVIGATION)
    expect(page.headers.get('cache-control')).toBe('no-cache')
  })
})

/**
 * Les trajets par l'adresse, et non par le module.
 *
 * C'est ce contrat-là que le relecteur appelle : une clé mal échappée ou un
 * refus mal codé ne se voient qu'ici.
 */
describe('les trajets, vus du réseau', () => {
  const SECRET = 'Zk7pQ2vX9mL4tR8wY1nB6jH3sD5gF0aC-essai-serveur'

  let base: Base
  let fermer: () => void
  let identite: Identite
  /** Le témoin de connexion de l'appareil d'essai, tel qu'un navigateur le renvoie. */
  let ANNONCE: Record<string, string>
  /** Le compte de cet appareil : c'est la session qui le désigne, plus un réglage. */
  let COMPTE: string

  beforeEach(async () => {
    const ouverte = await ouvrirBase({
      fichier: join(racine, 'speed.db'),
      migrations: 'src/server/base/migrations',
    })
    base = ouverte.base
    fermer = ouverte.fermer
    identite = creerIdentite({ base, secret: SECRET, adresse: 'http://essai' })

    const creation = await avecBase().request('/api/auth/sign-in/anonymous', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    ANNONCE = { Cookie: (creation.headers.get('set-cookie') ?? '').split(';')[0] ?? '' }
    COMPTE = ((await creation.json()) as { user: { id: string } }).user.id
  })

  afterEach(() => fermer())

  function avecBase(roles?: readonly Role[]) {
    return creerServeur({ application, base, identite, ...(roles === undefined ? {} : { roles }) })
  }

  it('rend les trajets à qui s’annonce, et refuse les autres', async () => {
    await ecrireDepot(
      base,
      COMPTE,
      'traces',
      '2026-09-11-06-24-01_da2m_001.jsonl.gz',
      Buffer.from('x'),
    )

    expect((await avecBase().request('/sessions/')).status).toBe(401)

    const reponse = await avecBase().request('/sessions/', { headers: ANNONCE })
    const trajets = (await reponse.json()) as { cle: string; octets: number }[]

    expect(reponse.status).toBe(200)
    expect(trajets.map((trajet) => trajet.cle)).toEqual(['2026-09-11-06-24-01_da2m'])
    expect(trajets[0]!.octets).toBe(1)
  })

  it('efface un trajet désigné, et le second appel n’est pas une panne', async () => {
    await ecrireDepot(
      base,
      COMPTE,
      'traces',
      '2026-09-11-06-24-01_da2m_001.jsonl.gz',
      Buffer.from('x'),
    )

    const premier = await avecBase().request('/sessions/2026-09-11-06-24-01_da2m', {
      method: 'DELETE',
      headers: ANNONCE,
    })
    const second = await avecBase().request('/sessions/2026-09-11-06-24-01_da2m', {
      method: 'DELETE',
      headers: ANNONCE,
    })

    expect(await premier.json()).toEqual({ efface: 1 })
    expect(second.status).toBe(200)
    expect(await second.json()).toEqual({ efface: 0 })
  })

  it('efface un dépôt seul, dont la clé porte des deux-points', async () => {
    // Deux traces anciennes portent un nom libre. Une clé mal échappée efface
    // ailleurs, ou n'efface rien.
    await ecrireDepot(base, COMPTE, 'traces', 'traces.json', Buffer.from('x'))

    const reponse = await avecBase().request(
      `/sessions/${encodeURIComponent('depot:traces:traces.json')}`,
      { method: 'DELETE', headers: ANNONCE },
    )

    expect(await reponse.json()).toEqual({ efface: 1 })
  })

  it('ne replie pas la page d’application sur un trajet absent', async () => {
    // Le client distingue « pas de trajet », qui est normal, de « le serveur est
    // cassé ». Une page HTML en 200 lui retire cette distinction.
    const reponse = await avecBase().request('/sessions/rien', NAVIGATION)

    expect(reponse.status).toBe(404)
  })

  /**
   * Ce que les rôles ouvrent, et ce qu'ils ferment.
   *
   * C'est **le seul contrôle qui protège** : l'écran cache ce qu'un rôle n'ouvre
   * pas, mais un navigateur affiche ce qu'il veut et appelle ce qu'il veut. Ces
   * vérifications-ci passent donc par le réseau, sans rien cacher du tout.
   */
  describe('les rôles', () => {
    it('ouvre tout à un compte neuf, rien n’étant encaissé', async () => {
      const reponse = await avecBase().request('/api/droits', { headers: ANNONCE })

      expect(reponse.status).toBe(200)
      expect(await reponse.json()).toEqual({
        droits: [
          { role: 'conduite', expireLe: null },
          { role: 'atelier', expireLe: null },
          { role: 'synthese', expireLe: null },
        ],
        offerts: ['conduite', 'atelier', 'synthese'],
      })
    })

    it('refuse ses trajets à un compte qui n’a plus le rôle', async () => {
      const ouvert = await avecBase().request('/sessions/', { headers: ANNONCE })
      const ferme = await avecBase([]).request('/sessions/', { headers: ANNONCE })

      expect(ouvert.status).toBe(200)
      // 403 et non 401 : le compte est bien là, se reconnecter n'y changerait
      // rien, et le client ne doit pas rejouer.
      expect(ferme.status).toBe(403)
      expect(await ferme.text()).toContain('conduite')
    })

    it('laisse lire un moteur à la voiture, et refuse qu’elle en dépose un', async () => {
      // Lire n'est pas déposer : la voiture joue les moteurs, l'atelier les
      // fabrique. C'est le seul endroit où la méthode décide du rôle.
      const voiture = avecBase(['conduite'])

      expect((await voiture.request('/engines/', { headers: ANNONCE })).status).toBe(200)

      const depot = await voiture.request('/engines/V8.json', {
        method: 'PUT',
        headers: { ...ANNONCE, 'Content-Type': 'application/json' },
        body: '{"name":"V8"}',
      })
      expect(depot.status).toBe(403)
      expect(await depot.text()).toContain('atelier')
    })

    it('laisse emporter ses données même quand plus aucun rôle n’est ouvert', async () => {
      // Ce sont ses données, pas une fonction : les retenir parce qu'un droit
      // s'est refermé reviendrait à les confisquer.
      const reponse = await avecBase([]).request('/mon-compte/archive.zip', { headers: ANNONCE })

      expect(reponse.status).toBe(200)
    })

    it('ne dit rien des droits à qui ne s’annonce pas', async () => {
      expect((await avecBase().request('/api/droits')).status).toBe(401)
    })
  })
})
