/**
 * Ce qu'on vérifie ici : **le service worker ne garde rien qui appartienne à un
 * compte**.
 *
 * Le défaut qu'il a porté jusqu'au 13 septembre 2026 est celui que le ticket
 * annonçait : son dernier cas attrapait tout ce qui répondait 200, donc la
 * session, les droits, les profils et la liste des trajets. Une session
 * resservie depuis un cache ferait croire à un compte qui n'existe plus, et une
 * liste périmée se lirait comme une perte de données.
 *
 * **Ce test vit ici**, chez le serveur, parce que c'est lui qui sert ce fichier
 * et qu'il tient la même liste de chemins. Un fichier statique ne peut pas
 * importer du TypeScript : les deux listes sont recopiées, et c'est justement ce
 * qu'on vérifie.
 */

import { readFileSync } from 'node:fs'

import { describe, expect, it, vi } from 'vitest'

import { DONNEES } from './serveur'

const SOURCE = readFileSync('public/sw.js', 'utf8')
const ORIGINE = 'https://speed.exemple'

/** Le service worker, chargé dans un faux contexte, et ses écouteurs. */
function chargerLeServiceWorker(options: { horsReseau?: boolean; garde?: Map<string, unknown> } = {}): Map<string, (event: unknown) => void> {
  const ecouteurs = new Map<string, (event: unknown) => void>()

  const faux = {
    addEventListener: (type: string, handler: (event: unknown) => void) =>
      ecouteurs.set(type, handler),
    location: { origin: ORIGINE },
    skipWaiting: () => undefined,
    clients: { claim: () => undefined, get: () => undefined, matchAll: () => [] },
    registration: {},
  }

  const garde = options.garde ?? new Map<string, unknown>()
  const faussesCaches = {
    open: async () => ({
      match: async (requete: { url?: string } | string) => {
        const url = typeof requete === 'string' ? requete : (requete.url ?? '')
        return garde.get(url.replace(ORIGINE, '')) ?? garde.get(url)
      },
      put: async () => undefined,
      addAll: async () => undefined,
      keys: async () => [],
      delete: async () => true,
    }),
    keys: async () => [],
    delete: async () => true,
  }

  const executer = new Function('self', 'caches', 'fetch', SOURCE) as (
    self: unknown,
    caches: unknown,
    fetchImpl: unknown,
  ) => void
  // Une réponse plausible : sans `ok` ni `status`, le service worker lève dans
  // une promesse que personne n'attend, et le test se couvre d'erreurs qui ne
  // disent rien de ce qu'il vérifie.
  const fausseReponse = { ok: true, status: 200, clone: () => fausseReponse }
  const fauxFetch = options.horsReseau
    ? async () => {
        throw new TypeError('Failed to fetch')
      }
    : async () => fausseReponse
  executer(faux, faussesCaches, fauxFetch)

  return ecouteurs
}

/** Ce que le service worker fait d'une adresse : il répond, ou il laisse passer. */
function interception(chemin: string, mode = 'cors'): 'repond' | 'laisse passer' {
  const ecouteurs = chargerLeServiceWorker()
  const surFetch = ecouteurs.get('fetch')
  if (surFetch === undefined) throw new Error('le service worker n’écoute pas les requêtes')

  const respondWith = vi.fn()
  surFetch({ request: { method: 'GET', url: `${ORIGINE}${chemin}`, mode }, respondWith })
  return respondWith.mock.calls.length > 0 ? 'repond' : 'laisse passer'
}

/** Ce que le service worker rend pour une adresse, réseau coupé. */
async function horsReseau(chemin: string, garde: Map<string, unknown>, mode = 'navigate') {
  const ecouteurs = chargerLeServiceWorker({ horsReseau: true, garde })
  const surFetch = ecouteurs.get('fetch')
  if (surFetch === undefined) throw new Error('le service worker n’écoute pas les requêtes')

  let rendu: unknown
  surFetch({
    request: { method: 'GET', url: `${ORIGINE}${chemin}`, mode },
    respondWith: (promesse: unknown) => {
      rendu = promesse
    },
  })
  return rendu === undefined ? undefined : await (rendu as Promise<unknown>)
}

describe('ce que le service worker garde', () => {
  it('laisse passer tout ce qui appartient à un compte', () => {
    const chemins = [
      '/api/auth/get-session',
      '/api/droits',
      '/profiles/',
      '/engines/V8.json',
      '/gearboxes/',
      '/traces/2026-09-13-06-24-01_da2m_001.jsonl.gz',
      '/journal/',
      '/mesures/',
      '/mesure-voiture/profil-voiture.json',
      '/mon-compte/archive.zip',
      '/sessions/',
      '/retention',
    ]

    for (const chemin of chemins) {
      expect(`${chemin} : ${interception(chemin)}`).toBe(`${chemin} : laisse passer`)
    }
  })

  it('garde en revanche ce qui fait tourner l’application hors réseau', () => {
    // Ce sont les fichiers construits, les échantillons et la page elle-même :
    // sans eux, une voiture dans un tunnel ne démarre pas.
    expect(interception('/assets/index-abcd1234.js')).toBe('repond')
    expect(interception('/audio/demo/on-800.flac')).toBe('repond')
    expect(interception('/icons/icon-192.png')).toBe('repond')
    expect(interception('/', 'navigate')).toBe('repond')
    expect(interception('/relecteur.html', 'navigate')).toBe('repond')
  })

  it('sert la page depuis le cache quand le réseau est coupé', async () => {
    // C'est ce qui fait démarrer une voiture dans un tunnel, et rien ne le
    // vérifiait. Le repli est nommé : sans lui, une adresse profonde ne
    // retomberait sur rien.
    const garde = new Map<string, unknown>([['/index.html', { page: 'conduite' }]])

    expect(await horsReseau('/', garde)).toEqual({ page: 'conduite' })
    expect(await horsReseau('/une-adresse-profonde', garde)).toEqual({ page: 'conduite' })
  })

  it('replie le relecteur sur le relecteur, et non sur la conduite', async () => {
    // Deux pages, deux replis : ouvrir le relecteur hors réseau et tomber sur
    // l'écran de conduite se lirait comme un bug.
    const garde = new Map<string, unknown>([
      ['/index.html', { page: 'conduite' }],
      ['/relecteur.html', { page: 'relecteur' }],
    ])

    expect(await horsReseau('/relecteur.html', garde)).toEqual({ page: 'relecteur' })
    expect(await horsReseau('/relecteur/quelque-chose', garde)).toEqual({ page: 'relecteur' })
  })

  it('ne sert aucune donnée de compte depuis le cache, même hors réseau', async () => {
    // Le cas que le ticket 07 annonçait : une session resservie ferait croire à
    // un compte qui n'existe plus. Ici, le service worker ne répond pas du tout,
    // la requête échoue, et le client sait déjà traiter « sans réseau ».
    const garde = new Map<string, unknown>([['/api/auth/get-session', { user: { id: 'fantome' } }]])

    expect(await horsReseau('/api/auth/get-session', garde, 'cors')).toBeUndefined()
  })

  it('dit la même chose que le serveur des chemins de données', () => {
    // Les deux listes sont recopiées — un fichier statique ne peut pas importer
    // d'ici. Elles dérivent au premier dossier ajouté si rien ne les tient.
    const dansLeServiceWorker = /const DONNEES = \[([^\]]*)\]/.exec(SOURCE)?.[1] ?? ''
    const chemins = [...dansLeServiceWorker.matchAll(/'([^']+)'/g)].map((trouve) => trouve[1])

    expect(chemins).toEqual([...DONNEES])
  })
})
