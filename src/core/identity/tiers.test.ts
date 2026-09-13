/**
 * Ce qu'on vérifie ici : ce qui doit survivre à l'aller-retour y survit.
 *
 * Un compte tenu ailleurs fait quitter le site, et c'est ce qui distingue ce
 * chemin de tous les autres : entre le départ et le retour, la page est
 * détruite. Deux choses doivent traverser — l'adresse de retour, qu'on donne au
 * fournisseur, et l'identifiant du compte qu'on abandonne, qu'on range de côté.
 * Les perdre laisserait un compte orphelin sur le serveur, ou renverrait
 * l'appareil sur une page d'erreur hors de l'application.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  lireLeRetourDuTiers,
  rattacherUnTiers,
  reglerLAncienCompte,
  reprendreLAncien,
  seConnecterAvecUnTiers,
} from './tiers'
import { saveIdentity, type LocalIdentity } from './store'

const ICI: LocalIdentity = {
  id: 'compte-d-ici',
  name: 'Appareil du 13/09/2026',
  anonymous: true,
  obtainedAt: 1_700_000_000_000,
}

function fauxStockage() {
  const entrees = new Map<string, string>()
  return {
    getItem: (cle: string): string | null => entrees.get(cle) ?? null,
    setItem: (cle: string, valeur: string): void => void entrees.set(cle, valeur),
    removeItem: (cle: string): void => void entrees.delete(cle),
    clear: (): void => entrees.clear(),
    key: () => null,
    length: 0,
    entrees,
  }
}

/** Le navigateur, réduit à ce dont ce module se sert. */
function navigateur(search = ''): { assign: ReturnType<typeof vi.fn>; adresses: string[] } {
  const assign = vi.fn()
  Object.defineProperty(globalThis, 'window', {
    value: {
      location: { origin: 'https://speed.exemple.fr', pathname: '/', search, hash: '', assign },
      // `location.assign` est appelé sur l'objet `location`, pas sur `window`.
    },
    configurable: true,
    writable: true,
  })
  Object.defineProperty(globalThis, 'history', {
    value: { replaceState: vi.fn() },
    configurable: true,
    writable: true,
  })
  return { assign, adresses: [] }
}

/** Un serveur qui rend l'adresse où aller, et note ce qu'on lui a demandé. */
function serveur(charge: unknown, statut = 200) {
  const corps: string[] = []
  const chemins: string[] = []
  const fetchImpl = vi.fn(async (adresse: string | URL | Request, options?: RequestInit) => {
    chemins.push(String(adresse))
    corps.push(String(options?.body ?? ''))
    return new Response(JSON.stringify(charge), {
      status: statut,
      headers: { 'Content-Type': 'application/json' },
    })
  }) as unknown as typeof fetch
  return { fetchImpl, corps, chemins }
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    value: fauxStockage(),
    configurable: true,
    writable: true,
  })
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: fauxStockage(),
    configurable: true,
    writable: true,
  })
  navigateur()
})

describe('partir chez un fournisseur', () => {
  it('donne une adresse de retour dans l’application, et une en cas de refus', async () => {
    // Sans la seconde, un refus laisse le navigateur sur une page d'erreur de la
    // bibliothèque — dans une voiture, sans clavier ni bouton de retour commode.
    const { fetchImpl, corps, chemins } = serveur({ url: 'https://tesla.exemple/oauth' })

    await rattacherUnTiers('tesla', { fetchImpl })

    expect(chemins[0]).toContain('/api/auth/link-social')
    const demande = JSON.parse(corps[0] ?? '{}') as Record<string, string>
    expect(demande['provider']).toBe('tesla')
    expect(demande['callbackURL']).toBe('https://speed.exemple.fr/?compte=rattache')
    expect(demande['errorCallbackURL']).toBe('https://speed.exemple.fr/?compte=refuse')
  })

  it('emmène le navigateur là où le serveur dit', async () => {
    const { fetchImpl } = serveur({ url: 'https://accounts.google.com/o/oauth2/v2/auth?x=1' })

    const rendu = await rattacherUnTiers('google', { fetchImpl })

    expect(rendu).toEqual({ state: 'part' })
    expect(window.location.assign).toHaveBeenCalledWith(
      'https://accounts.google.com/o/oauth2/v2/auth?x=1',
    )
  })

  it('ne bouge pas quand le serveur ne rend pas d’adresse', async () => {
    const { fetchImpl } = serveur({ redirect: false })

    const rendu = await rattacherUnTiers('google', { fetchImpl })

    expect(rendu.state).toBe('refusee')
    expect(window.location.assign).not.toHaveBeenCalled()
  })

  it('dit « sans réseau » quand l’appel ne part pas', async () => {
    // La situation ordinaire dans une voiture, et il faut la distinguer d'un
    // refus : l'une se réessaie plus tard, l'autre non.
    const fetchImpl = vi.fn(async () => {
      throw new Error('pas de réseau')
    }) as unknown as typeof fetch

    expect(await rattacherUnTiers('tesla', { fetchImpl })).toEqual({ state: 'sans-reseau' })
  })
})

describe('le compte qu’on abandonne', () => {
  it('est mis de côté avant de partir se connecter', async () => {
    saveIdentity(ICI)
    const { fetchImpl } = serveur({ url: 'https://tesla.exemple/oauth' })

    await seConnecterAvecUnTiers('tesla', { fetchImpl })

    // Au retour, l'identité rangée sera déjà celle de l'autre compte : c'est
    // maintenant ou jamais.
    expect(reprendreLAncien()).toBe('compte-d-ici')
  })

  it('n’est pas mis de côté pour un simple rattachement', async () => {
    // Rattacher ne change pas de compte : il n'y a rien à abandonner, et ranger
    // l'identifiant ferait croire le contraire au retour.
    saveIdentity(ICI)
    const { fetchImpl } = serveur({ url: 'https://tesla.exemple/oauth' })

    await rattacherUnTiers('tesla', { fetchImpl })

    expect(reprendreLAncien()).toBeNull()
  })

  it('ne se reprend qu’une fois', async () => {
    saveIdentity(ICI)
    const { fetchImpl } = serveur({ url: 'https://tesla.exemple/oauth' })
    await seConnecterAvecUnTiers('tesla', { fetchImpl })

    expect(reprendreLAncien()).toBe('compte-d-ici')
    // Un rechargement de la page ne doit pas rejouer le règlement d'un compte
    // déjà réglé.
    expect(reprendreLAncien()).toBeNull()
  })
})

describe('le retour', () => {
  it('se lit dans l’adresse, et en disparaît', () => {
    navigateur('?compte=connecte')

    expect(lireLeRetourDuTiers()).toBe('connecte')
    // Sinon, recharger la page rejouerait le retour indéfiniment.
    expect(history.replaceState).toHaveBeenCalledWith(null, '', '/')
  })

  it('garde les autres paramètres de l’adresse', () => {
    navigateur('?compte=rattache&profil=sport')

    expect(lireLeRetourDuTiers()).toBe('rattache')
    expect(history.replaceState).toHaveBeenCalledWith(null, '', '/?profil=sport')
  })

  it('rend rien quand il n’y a pas eu de départ', () => {
    navigateur('?profil=sport')

    expect(lireLeRetourDuTiers()).toBeNull()
    expect(history.replaceState).not.toHaveBeenCalled()
  })

  it('écarte une valeur qu’on ne connaît pas', () => {
    navigateur('?compte=nimporte-quoi')

    expect(lireLeRetourDuTiers()).toBeNull()
  })
})

describe('régler le compte abandonné', () => {
  it('rend ce que le serveur en a fait', async () => {
    const { fetchImpl, corps } = serveur({ ancien: 'garde' })

    expect(await reglerLAncienCompte('compte-d-ici', { fetchImpl })).toBe('garde')
    expect(JSON.parse(corps[0] ?? '{}')).toEqual({ ancien: 'compte-d-ici' })
  })

  it('n’annonce rien quand le serveur refuse', async () => {
    // Un compte qu'on n'a pas pu régler reste, vide, sur le serveur : c'est sans
    // conséquence, et surtout ce n'est pas une nouvelle à donner au conducteur.
    const { fetchImpl } = serveur({ message: 'non' }, 401)

    expect(await reglerLAncienCompte('compte-d-ici', { fetchImpl })).toBe('aucun')
  })
})
