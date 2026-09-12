import { beforeEach, describe, expect, it } from 'vitest'

import {
  aRapatrier,
  cle,
  listerDistant,
  lireDistant,
  loadDejaVu,
  saveDejaVu,
  type DejaVu,
  type EntreeDistante,
} from './rapatriement'

/**
 * Ce qui se vérifie : on ne redescend que ce qu'on n'a pas encore vu, jamais
 * par-dessus un réglage qui attend de partir, et une base muette ne fait rien
 * perdre.
 */

const DOSSIER = '/profiles/'
const HIER = 'Thu, 11 Sep 2026 10:00:00 GMT'
const AUJOURD_HUI = 'Fri, 12 Sep 2026 10:00:00 GMT'

function fauxStockage() {
  const entrees = new Map<string, string>()
  return {
    getItem: (k: string): string | null => entrees.get(k) ?? null,
    setItem: (k: string, v: string): void => void entrees.set(k, v),
    removeItem: (k: string): void => void entrees.delete(k),
    clear: (): void => entrees.clear(),
    key: () => null,
    length: 0,
  }
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    value: fauxStockage(),
    configurable: true,
    writable: true,
  })
})

function entree(name: string, mtime = AUJOURD_HUI): EntreeDistante {
  return { name, type: 'file', mtime }
}

describe('ce qu’il y a à redescendre', () => {
  it('prend ce qu’on n’a jamais vu', () => {
    expect(aRapatrier(DOSSIER, [entree('route.json')], {}, [])).toEqual([
      { name: 'route.json', quand: Date.parse(AUJOURD_HUI) },
    ])
  })

  it('laisse ce qu’on a déjà vu à cette date', () => {
    const vu: DejaVu = { [cle(DOSSIER, 'route.json')]: Date.parse(AUJOURD_HUI) }

    expect(aRapatrier(DOSSIER, [entree('route.json')], vu, [])).toEqual([])
  })

  it('reprend ce qui a changé depuis', () => {
    const vu: DejaVu = { [cle(DOSSIER, 'route.json')]: Date.parse(HIER) }

    expect(aRapatrier(DOSSIER, [entree('route.json')], vu, [])).toHaveLength(1)
  })

  it('ne redescend pas par-dessus un réglage qui attend de partir', () => {
    // C'est le cas du tunnel : la modification faite hors réseau dort dans la
    // file. La remplacer par la version d'avant, c'est perdre exactement ce que
    // la file servait à garder.
    const enAttente = [cle(DOSSIER, 'route.json')]

    expect(aRapatrier(DOSSIER, [entree('route.json')], {}, enAttente)).toEqual([])
  })

  it('ignore ce qui n’est pas un fichier', () => {
    expect(aRapatrier(DOSSIER, [{ name: 'sous-dossier', type: 'directory' }], {}, [])).toEqual([])
  })

  it('prend une fois ce qui n’a pas de date, puis s’en souvient', () => {
    const sansDate: EntreeDistante[] = [{ name: 'route.json', type: 'file' }]

    const premier = aRapatrier(DOSSIER, sansDate, {}, [])
    expect(premier).toHaveLength(1)

    const vu: DejaVu = { [cle(DOSSIER, 'route.json')]: premier[0]?.quand ?? 0 }
    expect(aRapatrier(DOSSIER, sansDate, vu, [])).toEqual([])
  })

  it('écarte une date que personne ne sait lire', () => {
    expect(aRapatrier(DOSSIER, [entree('route.json', 'la semaine dernière')], {}, [])).toEqual([])
  })
})

describe('ce dont on se souvient', () => {
  it('se relit d’un démarrage à l’autre', () => {
    saveDejaVu({ [cle(DOSSIER, 'route.json')]: 42 })

    expect(loadDejaVu()).toEqual({ '/profiles/route.json': 42 })
  })

  it('rend un souvenir vide quand le stockage est abîmé', () => {
    localStorage.setItem('speed.vu.v1', 'ceci n’est pas du JSON')
    expect(loadDejaVu()).toEqual({})

    localStorage.setItem('speed.vu.v1', '{"a":"pas un nombre","b":7}')
    expect(loadDejaVu()).toEqual({ b: 7 })
  })
})

describe('ce que le serveur rend', () => {
  const compte = { user: 'moi', password: 'secret' }

  it('rend une liste vide sans compte, sans même demander', async () => {
    let appele = false
    const feint = (): Promise<Response> => {
      appele = true
      return Promise.resolve(new Response('[]'))
    }

    expect(await listerDistant(DOSSIER, { user: '', password: '' }, feint)).toEqual([])
    expect(appele).toBe(false)
  })

  it('rend une liste vide quand le réseau ne répond pas', async () => {
    // Hors réseau, il n'y a pas de nouvelle à prendre : ce n'est pas une panne,
    // et le lancement ne doit ni attendre ni se plaindre.
    const feint = (): Promise<Response> => Promise.reject(new Error('hors réseau'))

    expect(await listerDistant(DOSSIER, compte, feint)).toEqual([])
    expect(await lireDistant(DOSSIER, 'route.json', compte, feint)).toBeNull()
  })

  it('rend une liste vide sur un dossier qui n’existe pas', async () => {
    const feint = (): Promise<Response> =>
      Promise.resolve(new Response('rien', { status: 404 }))

    expect(await listerDistant(DOSSIER, compte, feint)).toEqual([])
  })

  it('échappe le nom du fichier qu’il va lire', async () => {
    let vue = ''
    const feint = (adresse: string | URL | Request): Promise<Response> => {
      vue = String(adresse)
      return Promise.resolve(new Response('{}'))
    }

    await lireDistant(DOSSIER, 'route été.json', compte, feint)
    expect(vue).toBe('/profiles/route%20%C3%A9t%C3%A9.json')
  })
})
