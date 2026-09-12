import { describe, expect, it } from 'vitest'

import { fetchLibrary } from './library'
import { toFile } from './store'
import { createRoadProfile } from './defaults'

/**
 * Tests de la bibliothèque du serveur.
 *
 * Ce qui se vérifie : la lecture s'annonce, maintenant que le serveur la refuse
 * à qui ne le fait pas. L'adresse du site est publique — la voiture n'est pas
 * sur le réseau local — et ses dossiers portaient des trajets, positions
 * comprises.
 */

const CREDENTIALS = { user: 'depot', password: 'motdepasse' }

/** Un `fetch` de comptoir : retient les appels et répond selon le chemin. */
function reseau(fichiers: Record<string, string>) {
  const appels: { url: string; headers: Record<string, string> }[] = []
  const impl = ((url: string, init?: RequestInit) => {
    appels.push({ url, headers: (init?.headers ?? {}) as Record<string, string> })
    const corps = fichiers[url]
    if (corps === undefined) return Promise.resolve(new Response('', { status: 404 }))
    return Promise.resolve(new Response(corps, { status: 200 }))
  }) as unknown as typeof fetch
  return { impl, appels }
}

describe('la bibliothèque du serveur', () => {
  it('s’annonce en listant le dossier et en lisant un profil', async () => {
    const profil = toFile({ ...createRoadProfile(), name: 'Déposé' })
    const { impl, appels } = reseau({
      '/profiles/': JSON.stringify([{ name: 'depose.json', type: 'file' }]),
      '/profiles/depose.json': profil,
    })

    const entrees = await fetchLibrary(CREDENTIALS, impl)

    expect(entrees).toHaveLength(1)
    expect(entrees[0]?.profile.name).toBe('Déposé')
    // Les deux requêtes portent l'en-tête : lister sans lire ne servirait à rien.
    expect(appels).toHaveLength(2)
    for (const appel of appels) {
      expect(appel.headers['Authorization']).toMatch(/^Basic /)
    }
  })

  it('ne demande rien au serveur sans compte saisi', async () => {
    const { impl, appels } = reseau({ '/profiles/': '[]' })

    // Le serveur répondrait 401 : l'appel coûterait un aller-retour pour une
    // liste vide.
    expect(await fetchLibrary({ user: '', password: '' }, impl)).toEqual([])
    expect(appels).toHaveLength(0)
  })

  it('rend une liste vide quand le dossier est refusé', async () => {
    const impl = (() => Promise.resolve(new Response('', { status: 401 }))) as unknown as typeof fetch

    expect(await fetchLibrary(CREDENTIALS, impl)).toEqual([])
  })

  it('n’est pas emportée par un fichier illisible', async () => {
    const profil = toFile({ ...createRoadProfile(), name: 'Bon' })
    const { impl } = reseau({
      '/profiles/': JSON.stringify([
        { name: 'casse.json', type: 'file' },
        { name: 'bon.json', type: 'file' },
      ]),
      '/profiles/bon.json': profil,
    })

    const entrees = await fetchLibrary(CREDENTIALS, impl)

    expect(entrees).toHaveLength(1)
    expect(entrees[0]?.file).toBe('bon.json')
  })
})
