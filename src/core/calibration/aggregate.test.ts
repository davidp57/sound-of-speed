import { describe, expect, it } from 'vitest'

import {
  PROCEDURE_VERSION,
  RECENT_TRIPS,
  digestOf,
  emptyAggregate,
  needsRebuild,
  recentDepartures,
  recentPlateaus,
  recentSignal,
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
    pushPeakMs2: 2.5,
    slowdownPeakMs2: -3,
    practicedMaxKmh: 110,
    noiseKmh: 0.3,
    cadenceMs: 100,
    plateaus: { city: [], road: [], highway: [] },
    departureKmh: [],
    pushCount: 3,
    slowdownPeaks: [],
    ...over,
  }
}

describe('le cumul des capacités', () => {
  it('garde la meilleure accélération jamais vue', () => {
    let a = emptyAggregate()
    a = withTrip(a, digest({ tripId: 'a', at: 1, pushPeakMs2: 2.5 }))
    a = withTrip(a, digest({ tripId: 'b', at: 2, pushPeakMs2: 3.4 }))
    a = withTrip(a, digest({ tripId: 'c', at: 3, pushPeakMs2: 1.1 }))

    expect(a.capabilities.pushPeakMs2).toBe(3.4)
  })

  /**
   * Une capacité démontrée une fois reste vraie. Trois mois de conduite calme
   * ne doivent pas faire « oublier » à la voiture ce qu'elle sait faire, sans
   * quoi la charge pleine arriverait trop tôt.
   */
  it('ne perd pas une capacité quand les trajets récents sont calmes', () => {
    let a = withTrip(emptyAggregate(), digest({ tripId: 'fort', at: 0, pushPeakMs2: 3.4 }))
    for (let i = 1; i <= RECENT_TRIPS + 5; i += 1) {
      a = withTrip(a, digest({ tripId: `calme${i}`, at: i, pushPeakMs2: 0.9 }))
    }

    expect(a.recent.some((trip) => trip.tripId === 'fort')).toBe(false)
    expect(a.capabilities.pushPeakMs2).toBe(3.4)
  })

  it('garde le freinage le plus fort, qui est le plus négatif', () => {
    let a = withTrip(emptyAggregate(), digest({ tripId: 'a', at: 1, slowdownPeakMs2: -2 }))
    a = withTrip(a, digest({ tripId: 'b', at: 2, slowdownPeakMs2: -4.1 }))
    a = withTrip(a, digest({ tripId: 'c', at: 3, slowdownPeakMs2: -1 }))

    expect(a.capabilities.slowdownPeakMs2).toBe(-4.1)
  })

  it('ignore une capacité absente plutôt que de la compter pour zéro', () => {
    let a = withTrip(emptyAggregate(), digest({ tripId: 'a', at: 1, pushPeakMs2: 3.4 }))
    a = withTrip(a, digest({ tripId: 'b', at: 2, pushPeakMs2: null }))

    expect(a.capabilities.pushPeakMs2).toBe(3.4)
  })
})

/**
 * La cadence et le bruit ne sont pas des capacités de la voiture : ce sont des
 * propriétés de l'appareil et de la couverture du jour. Ils se prennent sur le
 * dernier trajet qui les a mesurés, et **ensemble** — ils entrent ensemble dans
 * le calcul de la fenêtre d'accélération.
 */
describe('le signal', () => {
  it('prend la cadence et le bruit du dernier trajet mesurable', () => {
    let a = withTrip(emptyAggregate(), digest({ tripId: 'a', at: 1, cadenceMs: 1000, noiseKmh: 0.9 }))
    a = withTrip(a, digest({ tripId: 'b', at: 2, cadenceMs: 100, noiseKmh: 0.3 }))

    expect(recentSignal(a)).toEqual({ cadenceMs: 100, noiseKmh: 0.3 })
  })

  it('remonte au trajet précédent quand le dernier n’a pas pu mesurer', () => {
    let a = withTrip(emptyAggregate(), digest({ tripId: 'a', at: 1, cadenceMs: 100, noiseKmh: 0.3 }))
    a = withTrip(a, digest({ tripId: 'b', at: 2, cadenceMs: 1000, noiseKmh: null }))

    expect(recentSignal(a)).toEqual({ cadenceMs: 100, noiseKmh: 0.3 })
  })

  it('ne rend rien quand aucun trajet n’a pu mesurer', () => {
    const a = withTrip(emptyAggregate(), digest({ tripId: 'a', at: 1, noiseKmh: null }))

    expect(recentSignal(a)).toBeNull()
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

  /**
   * La version la plus récente d'un trajet fait foi sur les précédentes, y
   * compris à la baisse. C'est l'inverse de ce que faisait la première version
   * de ce module, et c'est ce qui rend le cumul équivalent à un recalcul : une
   * valeur qu'une tranche courte a rendue et que le trajet entier ne rend plus
   * était un artefact du découpage, pas une capacité.
   *
   * Ce qu'un **autre** trajet a montré, en revanche, ne bouge pas.
   */
  it('se laisse réviser à la baisse par sa version plus complète', () => {
    let a = withTrip(emptyAggregate(), digest({ tripId: 'a', at: 1, pushPeakMs2: 3.4 }))
    a = withTrip(a, digest({ tripId: 'a', at: 1, pushPeakMs2: 1.2 }))

    expect(a.capabilities.pushPeakMs2).toBe(1.2)
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

    expect(d.pushPeakMs2).toBeGreaterThan(2)
    expect(d.slowdownPeakMs2).toBeLessThan(-2)
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

/**
 * Ce que la relecture du 11 septembre 2026 a mesuré, et que ces tests fixent.
 *
 * Les deux défauts venaient du même endroit : l'agrégat traitait la fenêtre des
 * trajets récents comme s'il s'agissait de l'historique.
 */
describe('les défauts trouvés à la relecture', () => {
  /**
   * Le garde de remplacement cherchait le trajet dans la fenêtre des vingt
   * derniers. Un trajet qui n'y est pas — arrivé en retard, ou daté de zéro
   * faute d'en-tête lisible — était donc recompté à chaque tranche. Mesuré :
   * trente-deux trajets là où il y en avait vingt et un.
   */
  it('ne recompte pas un trajet qui est sorti de la fenêtre', () => {
    let a = emptyAggregate()
    for (let i = 1; i <= RECENT_TRIPS; i += 1) {
      a = withTrip(a, digest({ tripId: `t${i}`, at: 1000 + i }))
    }
    expect(a.tripCount).toBe(RECENT_TRIPS)

    // Les douze tranches d'un trajet plus ancien : il n'entre jamais dans la
    // fenêtre, mais il ne compte qu'une fois.
    for (let tranche = 0; tranche < 12; tranche += 1) {
      a = withTrip(a, digest({ tripId: 'vieux', at: 1 }))
    }

    expect(a.recent.some((trip) => trip.tripId === 'vieux')).toBe(false)
    expect(a.tripCount).toBe(RECENT_TRIPS + 1)
  })

  /**
   * Le cumul par extrêmes suppose que chaque grandeur ne peut que croître avec
   * la matière. C'est vrai d'une crête, pas d'un **centile** : la vitesse
   * pratiquée est le 99ᵉ centile, et elle **baisse** quand le trajet s'allonge.
   *
   * Mesuré : un trajet de vingt-cinq secondes à 150 km/h suivi d'une heure à 40
   * rendait 150 en cumulant ses tranches, 40 en relisant tout — cent dix
   * kilomètres-heure d'écart, sur la grandeur qui fixe la vitesse plausible.
   */
  it('rend la même chose qu’un recalcul quand un trajet s’allonge', () => {
    const tranche = digest({ tripId: 'a', at: 1, practicedMaxKmh: 150 })
    const entier = digest({ tripId: 'a', at: 1, practicedMaxKmh: 40 })

    const cumul = withTrip(withTrip(emptyAggregate(), tranche), entier)
    const relu = withTrip(emptyAggregate(), entier)

    expect(cumul.capabilities.practicedMaxKmh).toBe(relu.capabilities.practicedMaxKmh)
  })

  it('garde la capacité d’un autre trajet quand celui-ci se révise à la baisse', () => {
    let a = withTrip(emptyAggregate(), digest({ tripId: 'fort', at: 1, practicedMaxKmh: 150 }))
    a = withTrip(a, digest({ tripId: 'b', at: 2, practicedMaxKmh: 130 }))
    a = withTrip(a, digest({ tripId: 'b', at: 2, practicedMaxKmh: 40 }))

    expect(a.capabilities.practicedMaxKmh).toBe(150)
  })
})
