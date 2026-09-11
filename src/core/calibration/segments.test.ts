import { describe, expect, it } from 'vitest'

import { regimeOf, segmentsOf } from './segments'
import type { Trace } from '../speed/replay'
import type { SpeedSample } from '../speed/source'

/**
 * Tests du découpage d'un trajet ordinaire.
 *
 * Le protocole fait garantir le contexte par le conducteur ; ici il faut le
 * reconnaître dans le signal. Ces tests fabriquent des trajets dont on connaît
 * la réponse, et vérifient qu'on la retrouve — et surtout qu'on ne trouve pas
 * ce qui n'y est pas.
 */

const CADENCE_MS = 100

/** Fabrique une trace à partir d'une vitesse décrite seconde par seconde. */
function trace(kmhAt: (t: number) => number, seconds: number): Trace {
  const samples: SpeedSample[] = []
  for (let ms = 0; ms <= seconds * 1000; ms += CADENCE_MS) {
    samples.push({ kmh: Math.max(0, kmhAt(ms / 1000)), at: ms, accuracyM: 5, derived: false })
  }
  return { name: 'essai', startedAt: 0, samples }
}

describe('regimeOf', () => {
  it('range une vitesse tenue dans le régime du protocole', () => {
    expect(regimeOf(18)).toBe('city')
    expect(regimeOf(70)).toBe('road')
    expect(regimeOf(95)).toBe('highway')
  })

  /**
   * Les bornes sont les **planchers** que le protocole exige d'une étape pour
   * l'accepter : cinquante pour la route, quatre-vingt-dix pour l'autoroute. Un
   * palier à quarante-cinq n'est donc pas de la route — c'est une ville rapide,
   * et l'appeler route ferait accepter une étape qui aurait été refusée.
   */
  it('classe au plancher du régime, pas au plus proche', () => {
    expect(regimeOf(45)).toBe('city')
    expect(regimeOf(50)).toBe('road')
    expect(regimeOf(89.9)).toBe('road')
    expect(regimeOf(90)).toBe('highway')
  })
})

describe('segmentsOf — les accélérations franches', () => {
  it('trouve une reprise qui part de l’arrêt et gagne plus de trente', () => {
    // 0 → 90 km/h en 10 s : 2,5 m/s², bien au-dessus du seuil.
    const segments = segmentsOf(trace((t) => Math.min(90, t * 9), 30))

    expect(segments.launches).toHaveLength(1)
    const launch = segments.launches[0]!
    expect(launch.fromKmh).toBeLessThanOrEqual(3)
    expect(launch.toKmh).toBeGreaterThan(80)
    expect(launch.peakAccelMs2).toBeGreaterThan(2)
  })

  /**
   * Le critère le plus important est celui qui **refuse**. Sans lui, chaque
   * sortie de feu rouge compterait pour une reprise, et la charge pleine
   * arriverait bien trop tôt — c'est la raison d'être du seuil d'accélération
   * dans le protocole.
   */
  it('écarte un démarrage mou, qui n’est pas une reprise', () => {
    // 0 → 40 km/h en 40 s : 0,28 m/s². Le gain suffit, l'accélération non.
    const segments = segmentsOf(trace((t) => Math.min(40, t), 60))

    expect(segments.launches).toEqual([])
  })

  it('écarte une reprise qui ne part pas de l’arrêt', () => {
    // De 60 à 120 km/h : une relance sur autoroute, pas un départ.
    const segments = segmentsOf(trace((t) => Math.min(120, 60 + t * 9), 30))

    expect(segments.launches).toEqual([])
  })

  it('écarte un démarrage qui ne va pas assez loin', () => {
    // 0 → 20 km/h, franchement, mais on s'arrête au carrefour suivant.
    const segments = segmentsOf(trace((t) => (t < 3 ? t * 7 : Math.max(0, 21 - (t - 3) * 7)), 20))

    expect(segments.launches).toEqual([])
  })

  it('trouve les deux reprises d’un trajet qui s’arrête entre les deux', () => {
    const segments = segmentsOf(
      trace((t) => {
        if (t < 12) return Math.min(90, t * 9)
        if (t < 20) return Math.max(0, 90 - (t - 12) * 15)
        return Math.min(90, (t - 20) * 9)
      }, 45),
    )

    expect(segments.launches).toHaveLength(2)
    expect(segments.launches[0]!.startS).toBeLessThan(segments.launches[1]!.startS)
  })
})

describe('segmentsOf — les mises de gaz', () => {
  /**
   * Relevé sur le trajet du 11 septembre 2026 : aucune accélération n'y partait
   * de l'arrêt au-dessus du seuil — les trois départs montaient à 3 ou 4 km/h en
   * une seconde — alors que 285 relevés dépassaient 2 m/s², jusqu'à 3,38. Le
   * critère du protocole, qui exige un départ arrêté, ne trouvait donc rien sur
   * une voiture qui accélère pourtant franchement.
   */
  it('trouve une relance franche qui ne part pas de l’arrêt', () => {
    // De 60 à 130 km/h en 8 s : 2,4 m/s², sur autoroute.
    const segments = segmentsOf(trace((t) => Math.min(130, 60 + t * 8.7), 20))

    expect(segments.launches).toEqual([])
    expect(segments.pushes.length).toBeGreaterThan(0)
    expect(segments.pushes[0]!.peakAccelMs2).toBeGreaterThan(2)
  })

  it('ne retient pas une accélération molle', () => {
    const segments = segmentsOf(trace((t) => Math.min(100, 40 + t), 60))

    expect(segments.pushes).toEqual([])
  })

  /**
   * Un soubresaut de la mesure peut franchir le seuil sur un relevé isolé. La
   * durée minimale est ce qui l'écarte — sans elle, le bruit du GPS suffirait à
   * faire croire à une reprise.
   */
  it('ne retient pas un franchissement isolé', () => {
    const segments = segmentsOf(
      trace((t) => (t > 5 && t < 5.3 ? 50 + (t - 5) * 40 : 50), 20),
    )

    expect(segments.pushes).toEqual([])
  })

  it('compte deux relances séparées par une croisière', () => {
    const segments = segmentsOf(
      trace((t) => {
        if (t < 6) return 50 + t * 9
        if (t < 16) return 104
        if (t < 22) return 104 + (t - 16) * 9
        return 158
      }, 30),
    )

    expect(segments.pushes).toHaveLength(2)
  })
})

describe('segmentsOf — les vitesses tenues', () => {
  it('range les paliers par régime', () => {
    const segments = segmentsOf(
      trace((t) => {
        if (t < 30) return 30 // ville
        if (t < 60) return 70 // route
        return 120 // autoroute
      }, 90),
    )

    expect(segments.plateaus.city.length).toBeGreaterThan(0)
    expect(segments.plateaus.road.length).toBeGreaterThan(0)
    expect(segments.plateaus.highway.length).toBeGreaterThan(0)
  })

  /**
   * Un trajet d'autoroute ne dit rien de la ville, et c'est tout le propos du
   * découpage par régime : c'est lui qui permettra de dire qu'il manque quelque
   * chose plutôt que de proposer des seuils calés sur une seule allure.
   */
  it('laisse vides les régimes qu’on n’a pas pratiqués', () => {
    const segments = segmentsOf(trace(() => 120, 120))

    expect(segments.plateaus.highway.length).toBeGreaterThan(0)
    expect(segments.plateaus.city).toEqual([])
    expect(segments.plateaus.road).toEqual([])
  })
})

describe('segmentsOf — les départs', () => {
  it('relève la vitesse atteinte une seconde après le départ', () => {
    const segments = segmentsOf(trace((t) => Math.min(90, t * 9), 30))

    expect(segments.departureKmh).toHaveLength(1)
    expect(segments.departureKmh[0]!).toBeGreaterThan(5)
  })

  it('ne relève rien sur un trajet qui ne s’arrête jamais', () => {
    const segments = segmentsOf(trace(() => 80, 120))

    expect(segments.departureKmh).toEqual([])
  })
})
