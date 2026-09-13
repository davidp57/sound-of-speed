import { describe, expect, it } from 'vitest'

import { DELAIS_PAR_DEFAUT, verdictDeRetention, type TrajetJuge } from './regle'

const MAINTENANT = Date.UTC(2026, 9, 15, 12, 0, 0)
const JOUR = 24 * 60 * 60 * 1000

function trajet(jours: number, reste: Partial<TrajetJuge> = {}): TrajetJuge {
  return {
    cle: `il-y-a-${jours}-jours`,
    isole: false,
    enregistreLe: MAINTENANT - jours * JOUR,
    octets: 1000,
    tranches: 1,
    traces: 1,
    journal: 0,
    aVoir: 0,
    exemption: null,
    ...reste,
  }
}

describe('ce que la règle emporterait', () => {
  it('emporte une trace plus vieille que son délai', () => {
    const verdict = verdictDeRetention([trajet(31)], MAINTENANT)

    expect(verdict.aEffacer.map((t) => t.cle)).toEqual(['il-y-a-31-jours'])
    expect(verdict.octets).toBe(1000)
  })

  it('retient une trace du mois, et dit qu’elle est trop récente', () => {
    const verdict = verdictDeRetention([trajet(29)], MAINTENANT)

    expect(verdict.aEffacer).toEqual([])
    expect(verdict.retenus[0]!.raison).toBe('trop récent')
  })

  it('retient ce que le profileur n’a pas encore regardé, quelle que soit son ancienneté', () => {
    // Sans cette condition, une trace arrivée pendant un arrêt du serveur
    // serait effacée sans qu'on en ait rien appris.
    const verdict = verdictDeRetention([trajet(400, { aVoir: 2 })], MAINTENANT)

    expect(verdict.aEffacer).toEqual([])
    expect(verdict.retenus[0]!.raison).toBe('pas encore analysé')
  })

  it('retient l’épinglé et l’archivé, et les distingue', () => {
    const verdict = verdictDeRetention(
      [
        trajet(400, { cle: 'gardé', exemption: 'epingle' }),
        trajet(400, { cle: 'déménagé', exemption: 'archive' }),
      ],
      MAINTENANT,
    )

    expect(verdict.aEffacer).toEqual([])
    expect(verdict.retenus.map((t) => t.raison).sort()).toEqual(['archivé', 'épinglé'])
  })

  it('nomme les dépôts seuls plutôt que de les taire', () => {
    // Deux traces anciennes ne se rangent nulle part : le regroupement ne les
    // voit pas, le profileur non plus. Elles sont archivées, donc retenues.
    const verdict = verdictDeRetention(
      [trajet(400, { cle: 'depot:traces:traces.json', isole: true, exemption: 'archive' })],
      MAINTENANT,
    )

    expect(verdict.retenus[0]!.isole).toBe(true)
    expect(verdict.retenus[0]!.raison).toBe('archivé')
  })
})

describe('le journal a sa propre règle', () => {
  it('un journal seul part au bout de quatorze jours', () => {
    const seul = trajet(15, { traces: 0, journal: 3 })

    expect(verdictDeRetention([seul], MAINTENANT).aEffacer).toHaveLength(1)
  })

  it('un journal seul de dix jours reste', () => {
    const seul = trajet(10, { traces: 0, journal: 3 })

    expect(verdictDeRetention([seul], MAINTENANT).aEffacer).toEqual([])
  })

  it('le journal d’un trajet à trace suit sa trace, et reste avec elle', () => {
    // Deux délais stricts couperaient un trajet en deux : à vingt jours on
    // relirait un trajet ayant perdu ses faits marquants.
    const ensemble = trajet(20, { traces: 4, journal: 4 })

    const verdict = verdictDeRetention([ensemble], MAINTENANT)

    expect(verdict.aEffacer).toEqual([])
    expect(verdict.retenus[0]!.raison).toBe('trop récent')
  })
})

describe('les délais se règlent', () => {
  it('un délai plus court emporte davantage', () => {
    const verdict = verdictDeRetention([trajet(10)], MAINTENANT, { traces: 7, journal: 3 })

    expect(verdict.aEffacer).toHaveLength(1)
  })

  it('les valeurs par défaut sont trente et quatorze jours', () => {
    expect(DELAIS_PAR_DEFAUT).toEqual({ traces: 30, journal: 14 })
  })
})

describe('l’ordre du verdict', () => {
  it('range ce qui part du plus ancien, ce qui reste du plus récent', () => {
    const verdict = verdictDeRetention(
      [trajet(40, { cle: 'a' }), trajet(60, { cle: 'b' }), trajet(2, { cle: 'c' }), trajet(1, { cle: 'd' })],
      MAINTENANT,
    )

    expect(verdict.aEffacer.map((t) => t.cle)).toEqual(['b', 'a'])
    expect(verdict.retenus.map((t) => t.cle)).toEqual(['d', 'c'])
  })

  it('additionne ce que l’effacement rendrait', () => {
    const verdict = verdictDeRetention(
      [trajet(40, { octets: 1500 }), trajet(50, { octets: 2500 }), trajet(1, { octets: 9000 })],
      MAINTENANT,
    )

    expect(verdict.octets).toBe(4000)
  })
})
