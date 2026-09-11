import { describe, expect, it } from 'vitest'

import {
  fetchMeasuredCar,
  largestShift,
  shouldPropose,
  type CarDecision,
  type MeasuredCar,
} from './measured-car'
import { PROCEDURE_VERSION, emptyAggregate, type CarAggregate } from './aggregate'
import type { Coverage } from './coverage'

const COMPLET: Coverage = { items: [], complete: true, missing: [] }
const INCOMPLET: Coverage = {
  items: [],
  complete: false,
  missing: ['de la conduite sur autoroute'],
}

function mesure(over: Partial<MeasuredCar> = {}): MeasuredCar {
  return {
    procedure: PROCEDURE_VERSION,
    updatedAt: 1000,
    aggregate: emptyAggregate(),
    coverage: COMPLET,
    ...over,
  }
}

function reseau(body: unknown, ok = true): typeof fetch {
  return (() =>
    Promise.resolve({
      ok,
      json: () => Promise.resolve(body),
    } as Response)) as typeof fetch
}

describe('fetchMeasuredCar', () => {
  it('lit ce que le serveur a déposé', async () => {
    const found = await fetchMeasuredCar(reseau(mesure()))

    expect(found).not.toBeNull()
    expect(found!.updatedAt).toBe(1000)
  })

  /**
   * Les cas ordinaires d'une application qui a roulé avant que le serveur n'ait
   * eu de quoi conclure. Aucun n'est une erreur.
   */
  it('rend null quand il n’y a rien', async () => {
    expect(await fetchMeasuredCar(reseau(null, false))).toBeNull()
    expect(await fetchMeasuredCar(reseau('pas du json'))).toBeNull()
    expect(await fetchMeasuredCar(reseau({}))).toBeNull()
  })

  it('rend null quand le réseau ne répond pas', async () => {
    const casse = (() => Promise.reject(new Error('hors réseau'))) as typeof fetch

    expect(await fetchMeasuredCar(casse)).toBeNull()
  })

  /**
   * Un fichier d'un procédé antérieur a été cumulé par des règles qu'on a
   * corrigées : rien ne permet de le rattraper, et le profileur le refera.
   */
  it('écarte une mesure produite par un procédé plus ancien', async () => {
    const vieux = await fetchMeasuredCar(reseau(mesure({ procedure: PROCEDURE_VERSION - 1 })))

    expect(vieux).toBeNull()
  })
})

describe('shouldPropose', () => {
  it('propose une mesure complète jamais vue', () => {
    expect(shouldPropose(mesure(), null)).toBe(true)
  })

  it('ne propose rien d’incomplet', () => {
    expect(shouldPropose(mesure({ coverage: INCOMPLET }), null)).toBe(false)
  })

  it('ne redemande rien après un oui', () => {
    const dit: CarDecision = { answer: 'accepted', forUpdatedAt: 1000 }

    expect(shouldPropose(mesure({ updatedAt: 2000 }), dit)).toBe(false)
  })

  /**
   * Un « plus tard » ne vaut que pour la mesure qu'on avait sous les yeux. Le
   * profil s'affine trajet après trajet : refuser une fois n'est pas refuser le
   * principe.
   */
  it('ne redemande pas la même mesure après un plus tard', () => {
    const dit: CarDecision = { answer: 'later', forUpdatedAt: 1000 }

    expect(shouldPropose(mesure({ updatedAt: 1000 }), dit)).toBe(false)
  })

  it('repropose la mesure suivante après un plus tard', () => {
    const dit: CarDecision = { answer: 'later', forUpdatedAt: 1000 }

    expect(shouldPropose(mesure({ updatedAt: 2000 }), dit)).toBe(true)
  })
})

describe('largestShift', () => {
  function avec(over: Partial<CarAggregate['capabilities']>): CarAggregate {
    const a = emptyAggregate()
    return { ...a, capabilities: { ...a.capabilities, ...over } }
  }

  it('ne voit aucun écart entre deux mesures identiques', () => {
    const a = avec({ pushPeakMs2: 3, slowdownPeakMs2: -3, practicedMaxKmh: 130 })

    expect(largestShift(a, a)).toBe(0)
  })

  it('rend le plus fort écart relatif', () => {
    const avant = avec({ pushPeakMs2: 3, slowdownPeakMs2: -4.8, practicedMaxKmh: 130 })
    const apres = avec({ pushPeakMs2: 3, slowdownPeakMs2: -3.1, practicedMaxKmh: 135 })

    // Le freinage bouge de 35 %, la vitesse de 4 % : c'est 35 % qu'on retient.
    expect(largestShift(avant, apres)).toBeCloseTo(0.354, 2)
  })

  it('ignore une mesure qui n’existait pas encore', () => {
    const avant = avec({ pushPeakMs2: null, practicedMaxKmh: 130 })
    const apres = avec({ pushPeakMs2: 3.4, practicedMaxKmh: 130 })

    expect(largestShift(avant, apres)).toBe(0)
  })
})
