import { describe, expect, it } from 'vitest'

import {
  PROCEDURE_VERSION,
  RECENT_TRIPS,
  digestOf,
  emptyAggregate,
  needsRebuild,
  recentDepartures,
  recentPlateaus,
  withTrip,
  type TripDigest,
} from './aggregate'
import type { Trace } from '../speed/replay'
import type { SpeedSample } from '../speed/source'

/**
 * Tests du cumul.
 *
 * Ce qu'il faut prouver tient en une phrase : **ajouter les trajets un à un
 * doit donner le même résultat que tout relire d'un coup**. C'est la seule
 * chose qui rende l'incrémental légitime, et c'est ce que ces tests vérifient
 * avant toute autre considération.
 */

function trace(kmhAt: (t: number) => number, seconds: number, startedAt = 0): Trace {
  const samples: SpeedSample[] = []
  for (let ms = 0; ms <= seconds * 1000; ms += 100) {
    samples.push({ kmh: Math.max(0, kmhAt(ms / 1000)), at: ms, accuracyM: 5, derived: false })
  }
  return { name: 'essai', startedAt, samples }
}

/** Un trajet qui part de l'arrêt, accélère franchement, tient, puis freine. */
function trajet(at: number, pointe = 110): Trace {
  return trace((t) => {
    if (t < 12) return Math.min(pointe, t * 9)
    if (t < 60) return pointe
    return Math.max(0, pointe - (t - 60) * 12)
  }, 70, at)
}

function digest(over: Partial<TripDigest> = {}): TripDigest {
  return {
    tripId: 'a',
    at: 0,
    durationS: 60,
    peakAccelMs2: 2.5,
    peakDecelMs2: -3,
    practicedMaxKmh: 110,
    noiseKmh: 0.3,
    cadenceMs: 100,
    plateaus: { city: [], road: [], highway: [] },
    departureKmh: [],
    slowdownPeaks: [],
    ...over,
  }
}

describe('le cumul des capacités', () => {
  it('garde la meilleure accélération jamais vue', () => {
    let a = emptyAggregate()
    a = withTrip(a, digest({ tripId: 'a', at: 1, peakAccelMs2: 2.5 }))
    a = withTrip(a, digest({ tripId: 'b', at: 2, peakAccelMs2: 3.4 }))
    a = withTrip(a, digest({ tripId: 'c', at: 3, peakAccelMs2: 1.1 }))

    expect(a.capabilities.peakAccelMs2).toBe(3.4)
  })

  /**
   * Une capacité démontrée une fois reste vraie. Trois mois de conduite calme
   * ne doivent pas faire « oublier » à la voiture ce qu'elle sait faire, sans
   * quoi la charge pleine arriverait trop tôt.
   */
  it('ne perd pas une capacité quand les trajets récents sont calmes', () => {
    let a = withTrip(emptyAggregate(), digest({ tripId: 'fort', at: 0, peakAccelMs2: 3.4 }))
    for (let i = 1; i <= RECENT_TRIPS + 5; i += 1) {
      a = withTrip(a, digest({ tripId: `calme${i}`, at: i, peakAccelMs2: 0.9 }))
    }

    expect(a.recent.some((trip) => trip.tripId === 'fort')).toBe(false)
    expect(a.capabilities.peakAccelMs2).toBe(3.4)
  })

  it('garde le freinage le plus fort, qui est le plus négatif', () => {
    let a = withTrip(emptyAggregate(), digest({ tripId: 'a', at: 1, peakDecelMs2: -2 }))
    a = withTrip(a, digest({ tripId: 'b', at: 2, peakDecelMs2: -4.1 }))
    a = withTrip(a, digest({ tripId: 'c', at: 3, peakDecelMs2: -1 }))

    expect(a.capabilities.peakDecelMs2).toBe(-4.1)
  })

  /**
   * La cadence et le bruit sont des contraintes, pas des performances : on les
   * prend au pire cas rencontré, sans quoi on dimensionnerait la fenêtre
   * d'accélération sur le meilleur trajet et elle serait trop courte partout
   * ailleurs.
   */
  it('prend la cadence la plus lente et le bruit le plus fort', () => {
    let a = withTrip(emptyAggregate(), digest({ tripId: 'a', at: 1, cadenceMs: 100, noiseKmh: 0.3 }))
    a = withTrip(a, digest({ tripId: 'b', at: 2, cadenceMs: 1000, noiseKmh: 0.1 }))

    expect(a.capabilities.cadenceMs).toBe(1000)
    expect(a.capabilities.noiseKmh).toBe(0.3)
  })

  it('ignore une mesure absente plutôt que de la compter pour zéro', () => {
    let a = withTrip(emptyAggregate(), digest({ tripId: 'a', at: 1, noiseKmh: 0.3 }))
    a = withTrip(a, digest({ tripId: 'b', at: 2, noiseKmh: null }))

    expect(a.capabilities.noiseKmh).toBe(0.3)
  })
})

describe('les habitudes', () => {
  it('ne garde que les derniers trajets', () => {
    let a = emptyAggregate()
    for (let i = 1; i <= RECENT_TRIPS + 7; i += 1) {
      a = withTrip(a, digest({ tripId: `t${i}`, at: i }))
    }

    expect(a.recent).toHaveLength(RECENT_TRIPS)
    expect(a.recent[0]!.tripId).toBe('t8')
    expect(a.tripCount).toBe(RECENT_TRIPS + 7)
  })

  it('réunit les vitesses tenues des trajets gardés', () => {
    let a = withTrip(
      emptyAggregate(),
      digest({
        tripId: 'a',
        at: 1,
        plateaus: { city: [{ startS: 0, durationS: 10, kmh: 30 }], road: [], highway: [] },
      }),
    )
    a = withTrip(
      a,
      digest({
        tripId: 'b',
        at: 2,
        plateaus: { city: [], road: [], highway: [{ startS: 0, durationS: 40, kmh: 120 }] },
      }),
    )

    expect(recentPlateaus(a).city).toHaveLength(1)
    expect(recentPlateaus(a).highway).toHaveLength(1)
    expect(recentPlateaus(a).road).toEqual([])
  })

  it('réunit les départs des trajets gardés', () => {
    let a = withTrip(emptyAggregate(), digest({ tripId: 'a', at: 1, departureKmh: [8, 9] }))
    a = withTrip(a, digest({ tripId: 'b', at: 2, departureKmh: [11] }))

    expect(recentDepartures(a)).toEqual([8, 9, 11])
  })
})

describe('un trajet qui revient', () => {
  /**
   * C'est le cas courant, pas l'exception : le serveur recalcule à chaque
   * tranche déposée, donc le même trajet revient une douzaine de fois, un peu
   * plus long à chaque fois. Un ajout en ferait douze trajets.
   */
  it('remplace sa version précédente au lieu de s’ajouter', () => {
    let a = withTrip(emptyAggregate(), digest({ tripId: 'a', at: 1, practicedMaxKmh: 60 }))
    a = withTrip(a, digest({ tripId: 'a', at: 1, practicedMaxKmh: 130 }))

    expect(a.recent).toHaveLength(1)
    expect(a.tripCount).toBe(1)
    expect(a.recent[0]!.practicedMaxKmh).toBe(130)
  })

  it('ne retire pas une capacité que sa version précédente avait montrée', () => {
    let a = withTrip(emptyAggregate(), digest({ tripId: 'a', at: 1, peakAccelMs2: 3.4 }))
    a = withTrip(a, digest({ tripId: 'a', at: 1, peakAccelMs2: 1.2 }))

    expect(a.capabilities.peakAccelMs2).toBe(3.4)
  })
})

describe('l’équivalence avec un calcul d’un bloc', () => {
  /**
   * La seule chose qui rende l'incrémental légitime. Sans elle, on aurait deux
   * façons de mesurer la même voiture, et rien ne dirait laquelle croire.
   */
  it('donne le même résultat que les trajets ajoutés dans l’autre ordre', () => {
    const digests = [
      digestOf('a', trajet(1000, 90)),
      digestOf('b', trajet(2000, 130)),
      digestOf('c', trajet(3000, 110)),
    ]

    const droit = digests.reduce(withTrip, emptyAggregate())
    const inverse = [...digests].reverse().reduce(withTrip, emptyAggregate())

    expect(inverse.capabilities).toEqual(droit.capabilities)
    expect(inverse.tripCount).toBe(droit.tripCount)
    expect(inverse.recent.map((t) => t.tripId)).toEqual(droit.recent.map((t) => t.tripId))
  })

  it('mesure un trajet réel de bout en bout', () => {
    const d = digestOf('a', trajet(1000))

    expect(d.peakAccelMs2).toBeGreaterThan(2)
    expect(d.peakDecelMs2).toBeLessThan(-2)
    expect(d.practicedMaxKmh).toBeGreaterThan(100)
    expect(d.plateaus.highway.length).toBeGreaterThan(0)
    expect(d.departureKmh).toHaveLength(1)
  })
})

describe('le recalcul complet', () => {
  it('se déclenche quand le procédé a changé', () => {
    expect(needsRebuild(emptyAggregate())).toBe(false)
    expect(needsRebuild({ ...emptyAggregate(), procedure: PROCEDURE_VERSION - 1 })).toBe(true)
  })
})
