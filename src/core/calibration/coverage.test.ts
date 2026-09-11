import { describe, expect, it } from 'vitest'

import { coverageOf, missingSentence } from './coverage'
import { emptyAggregate, withTrip, type TripDigest } from './aggregate'
import type { Plateau } from './measure'

/**
 * Tests du verdict de couverture.
 *
 * Ce qu'il faut prouver, c'est le **refus** : rien ne doit être proposé tant
 * qu'une mesure n'a pas sa matière. Le 4 septembre 2026, une seule étape
 * enregistrée dans un bouchon avait porté la vitesse plausible à 40 km/h, et
 * tout se figeait au-delà. Un étalonnage ne s'applique qu'entier.
 */

function paliers(count: number, kmh: number): Plateau[] {
  return Array.from({ length: count }, (_, i) => ({ startS: i * 60, durationS: 30, kmh }))
}

function digest(over: Partial<TripDigest> = {}): TripDigest {
  return {
    tripId: 'a',
    at: 0,
    durationS: 600,
    peakAccelMs2: 2.5,
    peakDecelMs2: -3,
    practicedMaxKmh: 130,
    noiseKmh: 0.3,
    cadenceMs: 100,
    plateaus: { city: [], road: [], highway: [] },
    departureKmh: [],
    slowdownPeaks: [],
    ...over,
  }
}

/** Des ralentissements qui se séparent nettement en deux façons de ralentir. */
function deuxFaconsDeRalentir(): number[] {
  return [
    ...Array.from({ length: 25 }, (_, i) => -0.6 - (i % 4) * 0.05),
    ...Array.from({ length: 12 }, (_, i) => -2.8 - (i % 4) * 0.05),
  ]
}

/** Un agrégat complet, dont on retire ensuite ce qu'on veut éprouver. */
function completAgregat(over: Partial<TripDigest> = {}) {
  return withTrip(
    emptyAggregate(),
    digest({
      plateaus: {
        city: paliers(6, 30),
        road: paliers(6, 70),
        highway: paliers(6, 120),
      },
      departureKmh: [8, 9, 11],
      slowdownPeaks: deuxFaconsDeRalentir(),
      ...over,
    }),
  )
}

describe('coverageOf', () => {
  it('déclare complet un historique qui a tout vu', () => {
    const coverage = coverageOf(completAgregat(), 3)

    expect(coverage.complete).toBe(true)
    expect(coverage.missing).toEqual([])
  })

  it('ne déclare rien de complet sur un historique vide', () => {
    const coverage = coverageOf(emptyAggregate(), 0)

    expect(coverage.complete).toBe(false)
    expect(coverage.missing.length).toBeGreaterThan(3)
  })

  /**
   * Le cas du 4 septembre, transposé : un historique qui ne contient qu'une
   * allure. Il ne manque pas « des données », il manque **de l'autoroute**, et
   * c'est ce qu'il faut pouvoir dire.
   */
  it('nomme le régime qui manque plutôt que de compter', () => {
    const coverage = coverageOf(
      completAgregat({ plateaus: { city: paliers(6, 30), road: paliers(6, 70), highway: [] } }),
      3,
    )

    expect(coverage.complete).toBe(false)
    expect(coverage.missing).toEqual(['de la conduite sur autoroute'])
    expect(missingSentence(coverage)).toBe('Il manque encore de la conduite sur autoroute.')
  })

  it('refuse quand on n’a jamais accéléré franchement', () => {
    const coverage = coverageOf(completAgregat(), 0)

    expect(coverage.missing).toEqual(['des accélérations franches'])
  })

  it('refuse quand on n’a pas assez de départs', () => {
    const coverage = coverageOf(completAgregat({ departureKmh: [8] }), 3)

    expect(coverage.missing).toEqual(['des départs à l’arrêt'])
  })

  /**
   * Le critère qui ne se compte pas. Avoir beaucoup de ralentissements ne suffit
   * pas : s'ils ne se séparent pas en deux façons de ralentir, le seuil de
   * rétrogradage ne se déduit pas, et l'étalonnage serait incomplet.
   */
  it('refuse quand les ralentissements ne se séparent pas', () => {
    const tous = Array.from({ length: 40 }, (_, i) => -1.2 - (i % 5) * 0.04)
    const coverage = coverageOf(completAgregat({ slowdownPeaks: tous }), 3)

    expect(coverage.complete).toBe(false)
    expect(coverage.missing).toEqual(['des freinages nets, distincts des levers de pied'])
  })

  it('ne parle pas de séparation tant qu’il n’y a pas de quoi la chercher', () => {
    const coverage = coverageOf(completAgregat({ slowdownPeaks: [-0.6, -2.8] }), 3)

    expect(coverage.missing).toEqual(['des ralentissements'])
  })
})

describe('missingSentence', () => {
  it('ne dit rien quand tout est couvert', () => {
    expect(missingSentence(coverageOf(completAgregat(), 3))).toBe('')
  })

  it('énumère deux manques avec « et »', () => {
    const coverage = coverageOf(
      completAgregat({ plateaus: { city: [], road: paliers(6, 70), highway: [] } }),
      3,
    )

    expect(missingSentence(coverage)).toBe(
      'Il manque encore de la conduite en ville et de la conduite sur autoroute.',
    )
  })
})
