/**
 * Ce qu'on vérifie ici : l'appareil obtient un compte sans que personne saisisse
 * rien, il le garde, et **rien de tout cela ne fait attendre le démarrage**.
 *
 * Le dernier point est le seul qui ne se rattrape pas : une application qui
 * attend une réponse avant d'afficher ses cadrans est inutilisable là où la
 * voiture roule.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ensureIdentity, startIdentity } from './client'
import { forgetIdentity, loadIdentity, saveIdentity, type LocalIdentity } from './store'

function fauxStockage(options: { echoueEnEcriture?: boolean } = {}) {
  const entrees = new Map<string, string>()
  return {
    getItem: (cle: string): string | null => entrees.get(cle) ?? null,
    setItem: (cle: string, valeur: string): void => {
      if (options.echoueEnEcriture) throw new Error('quota dépassé')
      entrees.set(cle, valeur)
    },
    removeItem: (cle: string): void => void entrees.delete(cle),
    clear: (): void => entrees.clear(),
    key: () => null,
    length: 0,
    entrees,
  }
}

function installer(stockage: ReturnType<typeof fauxStockage>): void {
  Object.defineProperty(globalThis, 'localStorage', {
    value: stockage,
    configurable: true,
    writable: true,
  })
}

/**
 * Un serveur d'essai.
 *
 * `sessionOuverte` dit ce que `/get-session` répond : `null` pour un navigateur
 * qui n'ouvre aucune session — la réponse est alors `null` en JSON, comme celle
 * du vrai serveur.
 */
function serveurQuiDonneUnCompte(
  options: { compte?: Record<string, unknown>; sessionOuverte?: boolean } = {},
) {
  const { compte = {}, sessionOuverte = false } = options
  const appels: string[] = []
  const demandes: RequestInit[] = []
  const utilisateur = { id: 'c-42', name: 'Cet appareil', isAnonymous: true, ...compte }

  const fetchImpl = vi.fn(async (adresse: string | URL | Request, init?: RequestInit) => {
    const chemin = String(adresse)
    appels.push(chemin)
    demandes.push(init ?? {})
    const charge =
      chemin.includes('get-session') && !sessionOuverte ? null : { user: utilisateur }
    return new Response(JSON.stringify(charge), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }) as unknown as typeof fetch

  return { fetchImpl, appels, demandes }
}

const GARDEE: LocalIdentity = {
  id: 'c-7',
  name: 'Déjà là',
  anonymous: true,
  obtainedAt: 1_700_000_000_000,
}

let stockage: ReturnType<typeof fauxStockage>

beforeEach(() => {
  stockage = fauxStockage()
  installer(stockage)
})

describe('obtenir un compte', () => {
  it('en demande un quand l’appareil n’en a pas, et le garde', async () => {
    const { fetchImpl, appels } = serveurQuiDonneUnCompte()

    const rendu = await ensureIdentity({ fetchImpl, now: () => 1_800_000_000_000 })

    expect(rendu.state).toBe('obtenue')
    // Le serveur est interrogé d'abord : c'est lui qui sait ce que ce navigateur
    // porte déjà.
    expect(appels[0]).toContain('/api/auth/get-session')
    expect(appels[1]).toContain('/api/auth/sign-in/anonymous')
    expect(loadIdentity()).toEqual({
      id: 'c-42',
      name: 'Cet appareil',
      anonymous: true,
      obtainedAt: 1_800_000_000_000,
    })
  })

  it('demande dans la forme que le serveur accepte', async () => {
    // Un POST qui annonce une longueur sans annoncer un type reçoit 415, et
    // c'est exactement ce que le navigateur envoie quand on ne lui donne pas de
    // corps. Un test qui construisait sa requête à la main passait en vert ; la
    // page, elle, n'obtenait aucun compte.
    const { fetchImpl, appels, demandes } = serveurQuiDonneUnCompte()

    await ensureIdentity({ fetchImpl })

    const rang = appels.findIndex((appel) => appel.includes('sign-in/anonymous'))
    const entetes = demandes[rang]?.headers as Record<string, string> | undefined
    expect(entetes?.['Content-Type']).toBe('application/json')
    expect(demandes[rang]?.body).toBe('{}')
  })

  it('n’en redemande pas un quand le serveur en ouvre déjà un', async () => {
    // Sans cela, un appareil se referait un compte à chaque ouverture et
    // perdrait à chaque fois ce que le précédent portait.
    saveIdentity(GARDEE)
    const { fetchImpl, appels } = serveurQuiDonneUnCompte({ sessionOuverte: true })

    const rendu = await ensureIdentity({ fetchImpl })

    expect(rendu.state).toBe('gardee')
    expect(appels.some((appel) => appel.includes('sign-in/anonymous'))).toBe(false)
  })

  it('demande au serveur avant tout, même avec une identité gardée', async () => {
    // Ce passage prolonge la session — un compte anonyme dont le témoin expire
    // ne se reprend pas — et c'est lui qui dit la vérité : le témoin est fermé au
    // code de la page, seul le serveur sait ce que ce navigateur porte.
    saveIdentity(GARDEE)
    const { fetchImpl, appels } = serveurQuiDonneUnCompte({ sessionOuverte: true })

    await ensureIdentity({ fetchImpl })

    expect(appels[0]).toContain('/api/auth/get-session')
  })

  it('adopte la session du serveur quand le stockage local a été vidé', async () => {
    // Le cas mesuré dans un navigateur : le stockage vidé, le témoin resté. En
    // demandant un compte sans regarder, la bibliothèque répondait « un compte
    // anonyme ne peut pas se reconnecter », et l'application n'obtenait plus
    // jamais d'identité.
    const { fetchImpl, appels } = serveurQuiDonneUnCompte({ sessionOuverte: true })

    const rendu = await ensureIdentity({ fetchImpl })

    expect(rendu.state).toBe('gardee')
    expect(appels.some((appel) => appel.includes('sign-in/anonymous'))).toBe(false)
    expect(loadIdentity()?.id).toBe('c-42')
  })

  it('reprend un compte neuf quand le serveur ne connaît plus l’ancien', async () => {
    // Un compte anonyme n'a pas de mot de passe : ce que l'appareil portait ne
    // se reprend pas. Le seul geste utile est d'en recommencer un, et l'écran
    // doit pouvoir le dire — d'où un état à part.
    saveIdentity(GARDEE)
    const { fetchImpl } = serveurQuiDonneUnCompte()

    const rendu = await ensureIdentity({ fetchImpl })

    expect(rendu.state).toBe('reprise')
    expect(loadIdentity()?.id).toBe('c-42')
  })
})

describe('hors réseau', () => {
  it('ne garde rien et ne casse rien quand le serveur est injoignable', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }) as unknown as typeof fetch

    const rendu = await ensureIdentity({ fetchImpl })

    expect(rendu.state).toBe('sans-reseau')
    expect(loadIdentity()).toBeNull()
  })

  it('laisse intacte l’identité déjà gardée', async () => {
    saveIdentity(GARDEE)
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }) as unknown as typeof fetch

    const rendu = await ensureIdentity({ fetchImpl })

    expect(rendu.state).toBe('gardee')
    expect(loadIdentity()).toEqual(GARDEE)
  })

  it('dit ce qui s’est passé quand le serveur refuse', async () => {
    const fetchImpl = vi.fn(async () => new Response('non', { status: 500 })) as unknown as typeof fetch

    const rendu = await ensureIdentity({ fetchImpl })

    expect(rendu).toEqual({ state: 'refusee', detail: 'Le serveur a répondu 500.' })
  })
})

describe('le démarrage n’attend pas', () => {
  it('rend la main tout de suite, même si le serveur ne répond jamais', () => {
    // Le critère central du ticket, et le seul qui ne se rattrape pas. Un
    // serveur qui ne répond jamais est le cas ordinaire dans un tunnel.
    const fetchImpl = vi.fn(() => new Promise<Response>(() => {})) as unknown as typeof fetch

    const debut = performance.now()
    startIdentity({ fetchImpl })
    const ecoule = performance.now() - debut

    expect(ecoule).toBeLessThan(50)
  })

  it('ne laisse pas remonter une panne', async () => {
    // Une identité qu'on n'obtient pas n'est pas une panne de l'application :
    // elle continue de rouler et de faire du son. Un rejet non attrapé ici
    // ressortirait en « unhandled rejection ».
    const fetchImpl = vi.fn(async () => {
      throw new Error('cassé')
    }) as unknown as typeof fetch

    const rendus: string[] = []
    startIdentity({ fetchImpl }, (rendu) => rendus.push(rendu.state))
    await new Promise((resoudre) => setTimeout(resoudre, 10))

    expect(rendus).toEqual(['sans-reseau'])
  })
})

describe('ce qui est gardé', () => {
  it('survit à une fermeture du navigateur', () => {
    saveIdentity(GARDEE)

    // Le stockage local, c'est exactement ça : le contenu reste, l'objet est
    // relu à neuf.
    installer(fauxStockageAvec(stockage.entrees))

    expect(loadIdentity()).toEqual(GARDEE)
  })

  it('ignore un contenu abîmé plutôt que de tomber', () => {
    stockage.entrees.set('speed.identity.v1', '{ ceci n’est pas du JSON')

    expect(loadIdentity()).toBeNull()
  })

  it('ignore un contenu qui n’a pas la bonne forme', () => {
    stockage.entrees.set('speed.identity.v1', JSON.stringify({ id: 42 }))

    expect(loadIdentity()).toBeNull()
  })

  it('dit quand l’écriture a échoué, plutôt que de faire semblant', () => {
    installer(fauxStockage({ echoueEnEcriture: true }))

    expect(saveIdentity(GARDEE)).toBe(false)
  })

  it('s’oublie quand on le demande', () => {
    saveIdentity(GARDEE)

    forgetIdentity()

    expect(loadIdentity()).toBeNull()
  })
})

/** Le même contenu, derrière un objet neuf : une page rouverte. */
function fauxStockageAvec(entrees: Map<string, string>) {
  const neuf = fauxStockage()
  for (const [cle, valeur] of entrees) neuf.entrees.set(cle, valeur)
  return neuf
}
