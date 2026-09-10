import { describe, expect, it } from 'vitest'

import { archiveName, ARCHIVE_FOLDERS, collectArchive } from './collect'

/**
 * Tests du ramassage.
 *
 * Ce qui se vérifie : que le paquet contienne ce que le serveur porte, qu'il
 * s'annonce sur chaque requête — les quatre dossiers sont fermés par le compte
 * de dépôt —, et surtout qu'un dossier absent ou un fichier illisible n'emporte
 * pas tout le reste. Le paquet sert à rapatrier l'essai d'un jour donné : le
 * rendre vide parce qu'un dossier manque serait le pire des comportements.
 *
 * Le faux `fetch` reprend celui des tests de la bibliothèque du serveur.
 */

const CREDENTIALS = { user: 'depot', password: 'motdepasse' }

/** Un `fetch` de comptoir : retient les appels et répond selon le chemin. */
function reseau(fichiers: Record<string, string | number>) {
  const appels: { url: string; headers: Record<string, string> }[] = []
  const impl = ((url: string, init?: RequestInit) => {
    appels.push({ url, headers: (init?.headers ?? {}) as Record<string, string> })
    const corps = fichiers[url]
    if (corps === undefined) return Promise.resolve(new Response('', { status: 404 }))
    // Un nombre déclare un état d'erreur plutôt qu'un contenu.
    if (typeof corps === 'number') return Promise.resolve(new Response('', { status: corps }))
    return Promise.resolve(new Response(corps, { status: 200 }))
  }) as unknown as typeof fetch
  return { impl, appels }
}

const decodeur = new TextDecoder()

describe('le ramassage des données du serveur', () => {
  it('ramasse les quatre dossiers', async () => {
    const { impl } = reseau({
      '/journal/': JSON.stringify([{ name: 'tranche_001.jsonl', type: 'file' }]),
      '/journal/tranche_001.jsonl': '{"kmh":110}',
      '/traces/': JSON.stringify([{ name: 'route.json', type: 'file' }]),
      '/traces/route.json': '[[0,0]]',
      '/mesures/': JSON.stringify([{ name: 'sonde.json', type: 'file' }]),
      '/mesures/sonde.json': '{"realtime":1}',
      '/profiles/': JSON.stringify([{ name: 'sport.json', type: 'file' }]),
      '/profiles/sport.json': '{"name":"Sport"}',
    })

    const resultat = await collectArchive(CREDENTIALS, impl)

    expect(resultat.entries.map((e) => e.path)).toEqual([
      '/journal/tranche_001.jsonl',
      '/traces/route.json',
      '/mesures/sonde.json',
      '/profiles/sport.json',
    ])
    expect(resultat.failures).toEqual([])
    expect(decodeur.decode(resultat.entries[0]?.bytes)).toBe('{"kmh":110}')
    expect(resultat.bytes).toBeGreaterThan(0)
  })

  it("s'annonce sur chaque requête, listage comme lecture", async () => {
    const { impl, appels } = reseau({
      '/journal/': JSON.stringify([{ name: 'a.jsonl', type: 'file' }]),
      '/journal/a.jsonl': 'x',
    })

    await collectArchive(CREDENTIALS, impl)

    expect(appels.length).toBeGreaterThan(0)
    for (const appel of appels) {
      expect(appel.headers['Authorization']).toMatch(/^Basic /)
    }
  })

  it('ne demande rien sans compte, et le dit', async () => {
    const { impl, appels } = reseau({})

    const resultat = await collectArchive({ user: '', password: '' }, impl)

    expect(appels).toEqual([])
    expect(resultat.entries).toEqual([])
    expect(resultat.failures).toHaveLength(1)
  })

  it("passe un dossier absent sans le compter comme un échec", async () => {
    // Les dossiers naissent au premier dépôt : personne n'a forcément déposé
    // de trace, et ce n'est pas une anomalie à signaler.
    const { impl } = reseau({
      '/journal/': JSON.stringify([{ name: 'a.jsonl', type: 'file' }]),
      '/journal/a.jsonl': 'x',
    })

    const resultat = await collectArchive(CREDENTIALS, impl)

    expect(resultat.entries).toHaveLength(1)
    expect(resultat.failures).toEqual([])
  })

  it('signale un dossier refusé, au lieu de rendre un paquet vide sans raison', async () => {
    const { impl } = reseau({
      '/journal/': 403,
      '/traces/': JSON.stringify([{ name: 'route.json', type: 'file' }]),
      '/traces/route.json': '[]',
    })

    const resultat = await collectArchive(CREDENTIALS, impl)

    expect(resultat.entries.map((e) => e.path)).toEqual(['/traces/route.json'])
    expect(resultat.failures).toEqual(['/journal/ (403)'])
  })

  it("garde les autres fichiers quand l'un d'eux est illisible", async () => {
    const { impl } = reseau({
      '/journal/': JSON.stringify([
        { name: 'bon.jsonl', type: 'file' },
        { name: 'casse.jsonl', type: 'file' },
      ]),
      '/journal/bon.jsonl': '{"kmh":1}',
      '/journal/casse.jsonl': 500,
    })

    const resultat = await collectArchive(CREDENTIALS, impl)

    expect(resultat.entries.map((e) => e.path)).toEqual(['/journal/bon.jsonl'])
    expect(resultat.failures).toEqual(['/journal/casse.jsonl (500)'])
  })

  it('écarte les sous-dossiers du listage', async () => {
    const { impl } = reseau({
      '/journal/': JSON.stringify([
        { name: 'vieux', type: 'directory' },
        { name: 'a.jsonl', type: 'file' },
      ]),
      '/journal/a.jsonl': 'x',
    })

    const resultat = await collectArchive(CREDENTIALS, impl)

    expect(resultat.entries.map((e) => e.path)).toEqual(['/journal/a.jsonl'])
  })

  it('rend un listage illisible comme un échec nommé', async () => {
    const { impl } = reseau({ '/journal/': 'ceci n’est pas du JSON' })

    const resultat = await collectArchive(CREDENTIALS, impl)

    expect(resultat.failures).toEqual(['/journal/ (listage illisible)'])
  })

  it('annonce son avancement à chaque fichier', async () => {
    const { impl } = reseau({
      '/journal/': JSON.stringify([
        { name: 'a.jsonl', type: 'file' },
        { name: 'b.jsonl', type: 'file' },
      ]),
      '/journal/a.jsonl': 'x',
      '/journal/b.jsonl': 'y',
      '/traces/': JSON.stringify([{ name: 'c.json', type: 'file' }]),
      '/traces/c.json': 'z',
    })

    const etapes: { done: number; total: number }[] = []
    await collectArchive(CREDENTIALS, impl, (done, total) => etapes.push({ done, total }))

    expect(etapes).toHaveLength(3)
    expect(etapes.at(-1)).toEqual({ done: 3, total: 3 })
  })

  it('échappe un nom de fichier, pour ne pas lire au mauvais endroit', async () => {
    const { impl, appels } = reseau({
      '/journal/': JSON.stringify([{ name: 'trace du 9.jsonl', type: 'file' }]),
      '/journal/trace%20du%209.jsonl': 'x',
    })

    const resultat = await collectArchive(CREDENTIALS, impl)

    expect(appels.map((a) => a.url)).toContain('/journal/trace%20du%209.jsonl')
    // Le chemin dans le paquet reste lisible : c'est un nom de fichier, pas une
    // adresse.
    expect(resultat.entries[0]?.path).toBe('/journal/trace du 9.jsonl')
  })
})

describe('le nom du paquet', () => {
  it('porte la date et la seconde, pour que deux paquets ne se recouvrent pas', () => {
    const nom = archiveName(new Date(2026, 8, 10, 14, 5, 3))
    expect(nom).toBe('speed-donnees-20260910140503.zip')
  })
})

describe('les dossiers ramassés', () => {
  it('sont des chemins absolus : un chemin relatif dépendrait de la page', () => {
    for (const folder of ARCHIVE_FOLDERS) {
      expect(folder.startsWith('/')).toBe(true)
      expect(folder.endsWith('/')).toBe(true)
    }
  })
})
