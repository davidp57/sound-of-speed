import { beforeEach, describe, expect, it } from 'vitest'

import {
  accordePour,
  loadReprise,
  planDeReprise,
  prochains,
  resteAFaire,
  sansCeuxLa,
  saveReprise,
  type ARemonter,
} from './reprise-locale'

/**
 * Ce qui se vérifie : la reprise se fait une fois, par poignées, respecte
 * l'accord donné, et ne perd pas ce qu'un accord trop bas laisse en attente.
 */

const SOURCES = {
  profiles: [{ id: 'p1' }, { id: 'p2' }],
  engines: [{ id: 'e1' }],
  gearboxes: [{ id: 'g1' }],
  traces: [{ startedAt: 1000 }, { startedAt: 2000 }],
}

/** Le même stockage feint que les autres tests du stockage local. */
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
  }
}

function installer(stockage: ReturnType<typeof fauxStockage>): void {
  Object.defineProperty(globalThis, 'localStorage', {
    value: stockage,
    configurable: true,
    writable: true,
  })
}

beforeEach(() => {
  installer(fauxStockage())
})

describe('le plan de reprise', () => {
  it('met les réglages avant les traces', () => {
    // Les réglages sont petits et se perdraient le plus bêtement ; les traces
    // pèsent mille fois plus et peuvent attendre le trajet suivant.
    expect(planDeReprise(SOURCES).map((e) => e.sorte)).toEqual([
      'profile',
      'profile',
      'engine',
      'gearbox',
      'trace',
      'trace',
    ])
  })
})

describe('l’accord', () => {
  it('laisse partir les réglages au cran minimal, pas les traces', () => {
    expect(accordePour('profile', 'minimal')).toBe(true)
    expect(accordePour('engine', 'minimal')).toBe(true)
    expect(accordePour('gearbox', 'minimal')).toBe(true)
    expect(accordePour('trace', 'minimal')).toBe(false)
    expect(accordePour('trace', 'extended')).toBe(true)
  })

  it('ne laisse rien partir sans accord', () => {
    for (const sorte of ['profile', 'engine', 'gearbox', 'trace'] as const) {
      expect(accordePour(sorte, 'none')).toBe(false)
    }
  })
})

describe('ce qui part maintenant', () => {
  it('en prend au plus le nombre demandé', () => {
    expect(prochains(planDeReprise(SOURCES), 'extended', 2)).toHaveLength(2)
  })

  it('ne prend rien quand la file est pleine', () => {
    expect(prochains(planDeReprise(SOURCES), 'extended', 0)).toEqual([])
  })

  it('saute ce que l’accord ne couvre pas, sans le jeter', () => {
    const plan = planDeReprise(SOURCES)
    const partants = prochains(plan, 'minimal', 10)

    expect(partants.map((e) => e.sorte)).toEqual(['profile', 'profile', 'engine', 'gearbox'])
    // Les traces restent dans la liste : elles partiront le jour où le cran
    // étendu sera donné. Les jeter reviendrait à décider qu'il ne le sera pas.
    expect(sansCeuxLa(plan, partants).map((e) => e.sorte)).toEqual(['trace', 'trace'])
  })

  it('ne reste plus rien à faire quand l’accord ne couvre que ce qui est parti', () => {
    const restant: ARemonter[] = [{ sorte: 'trace', id: '1000' }]

    expect(resteAFaire(restant, 'minimal')).toBe(false)
    expect(resteAFaire(restant, 'extended')).toBe(true)
    expect(resteAFaire([], 'extended')).toBe(false)
  })
})

describe('ce qui est gardé d’un démarrage à l’autre', () => {
  it('distingue « jamais commencée » de « tout est parti »', () => {
    // La confusion relancerait la reprise à chaque démarrage, sur un stockage
    // qui a peut-être changé entre-temps.
    expect(loadReprise()).toBeNull()

    saveReprise([])
    expect(loadReprise()).toEqual([])
  })

  it('reprend là où elle en était', () => {
    const plan = planDeReprise(SOURCES)
    saveReprise(sansCeuxLa(plan, prochains(plan, 'extended', 3)))

    expect(loadReprise()).toHaveLength(3)
  })

  it('ne perd rien quand le stockage refuse d’écrire', () => {
    // Le stockage local d'un navigateur de voiture peut refuser : ce qui compte
    // est que la reprise le dise, et non qu'elle croie avoir gardé sa liste.
    installer(fauxStockage({ echoueEnEcriture: true }))
    expect(saveReprise([{ sorte: 'profile', id: 'p1' }])).toBe(false)
  })

  it('ne se laisse pas casser par un stockage abîmé', () => {
    localStorage.setItem('speed.reprise.v1', 'ceci n’est pas du JSON')
    expect(loadReprise()).toBeNull()

    localStorage.setItem('speed.reprise.v1', '[{"sorte":"inconnue","id":"x"},{"sorte":"engine"}]')
    expect(loadReprise()).toEqual([])
  })
})
