import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { creerServeur } from './serveur'

let racine: string
let application: string
let echantillons: string

beforeEach(() => {
  racine = mkdtempSync(join(tmpdir(), 'serveur-'))
  application = join(racine, 'dist')
  echantillons = join(racine, 'deposes')

  // Une application construite, réduite à ce qui compte pour ces vérifications.
  mkdirSync(join(application, 'audio', 'demo'), { recursive: true })
  writeFileSync(join(application, 'index.html'), '<!DOCTYPE html><title>Conduite</title>')
  writeFileSync(join(application, 'relecteur.html'), '<!DOCTYPE html><title>Relecteur</title>')
  writeFileSync(join(application, 'audio', 'demo', 'on-800.flac'), OCTETS_DEMO)

  // Et un volume d'échantillons déposés, comme sur un serveur en service.
  mkdirSync(join(echantillons, 'procar'), { recursive: true })
  writeFileSync(join(echantillons, 'procar', 'on-low.wav'), 'des octets déposés')
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

/** Le contenu de l'échantillon de démonstration, dont on mesure la taille plutôt que de l'écrire. */
const OCTETS_DEMO = 'des octets de demonstration'

/** Une navigation, telle qu'un navigateur la formule. */
const NAVIGATION = { headers: { Accept: 'text/html,application/xhtml+xml' } }

describe('les deux sources d’échantillons', () => {
  it('réunit les banques déposées et celle qui vient avec l’application', async () => {
    // C'est ce que le serveur de fichiers d'avant ne savait pas faire : le
    // volume se montait **par-dessus** le dossier des échantillons et masquait
    // la banque de démonstration, qui n'apparaissait donc dans aucune liste.
    const reponse = await serveur().request('/audio/')
    const entrees = (await reponse.json()) as { name: string; type: string }[]

    expect(reponse.status).toBe(200)
    expect(entrees).toEqual(
      expect.arrayContaining([
        { name: 'demo', type: 'directory' },
        { name: 'procar', type: 'directory' },
      ]),
    )
  })

  it('sert un échantillon de chacune', async () => {
    expect((await serveur().request('/audio/demo/on-800.flac')).status).toBe(200)
    expect((await serveur().request('/audio/procar/on-low.wav')).status).toBe(200)
  })

  it('rend le listage au format que le cœur attend', async () => {
    // Un tableau d'entrées `{ name, type }`, et rien d'autre : quatre modules du
    // cœur le lisent, et le service worker distingue un listage d'un échantillon
    // à la seule barre oblique finale.
    const entrees = (await (await serveur().request('/audio/demo/')).json()) as unknown[]

    expect(entrees).toEqual([{ name: 'on-800.flac', type: 'file' }])
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
    const reponse = await serveur().request('/audio/demo/on-800.flac')

    expect(reponse.headers.get('accept-ranges')).toBe('bytes')
  })

  it('honore une plage, et dit laquelle', async () => {
    const reponse = await serveur().request('/audio/demo/on-800.flac', {
      headers: { Range: 'bytes=0-3' },
    })

    expect(reponse.status).toBe(206)
    expect(await reponse.text()).toBe('des ')
    expect(reponse.headers.get('content-range')).toBe(`bytes 0-3/${OCTETS_DEMO.length}`)
  })

  it('refuse une plage hors du fichier', async () => {
    const reponse = await serveur().request('/audio/demo/on-800.flac', {
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
