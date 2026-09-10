import { describe, expect, it } from 'vitest'

import { detectTimeScale, timeScaleOfSamples } from './timescale'

/**
 * Tests de la détection d'unité.
 *
 * Les valeurs des cas viennent des relevés de l'essai du 9 septembre 2026 :
 * cadence de dix positions par seconde dans la voiture, écarts nuls entre
 * certaines positions consécutives, et un arrêt qui espace les mesures à deux
 * secondes sur le banc.
 */
describe('detectTimeScale', () => {
  it('laisse les millisecondes telles quelles', () => {
    expect(detectTimeScale([100, 100, 100])).toBe(1)
  })

  it('reconnaît les microsecondes', () => {
    expect(detectTimeScale([100_000, 100_000, 99_000])).toBe(1000)
  })

  it('juge sur le plus petit écart, non sur la moyenne', () => {
    // Un arrêt long au milieu d'un trajet en millisecondes : la moyenne
    // basculerait à tort, le minimum non.
    expect(detectTimeScale([100, 30_000, 100])).toBe(1)
  })

  it('écarte les écarts nuls, qui ne disent rien', () => {
    expect(detectTimeScale([0, 0, 100_000])).toBe(1000)
    expect(detectTimeScale([0, 0, 100])).toBe(1)
  })

  it('écarte les écarts négatifs', () => {
    expect(detectTimeScale([-500, 100])).toBe(1)
  })

  it("suppose la milliseconde quand aucun écart n'est exploitable", () => {
    expect(detectTimeScale([])).toBe(1)
    expect(detectTimeScale([0])).toBe(1)
  })

  it('tient la cadence du banc à l\'arrêt, deux secondes, sans basculer', () => {
    expect(detectTimeScale([2000, 2000])).toBe(1)
  })
})

describe('timeScaleOfSamples', () => {
  it('lit l\'unité d\'une suite de mesures', () => {
    const ms = [{ at: 1000 }, { at: 1100 }, { at: 1200 }]
    const us = [{ at: 84_328_431_000 }, { at: 84_328_531_000 }, { at: 84_328_631_000 }]
    expect(timeScaleOfSamples(ms)).toBe(1)
    expect(timeScaleOfSamples(us)).toBe(1000)
  })

  it('suppose la milliseconde sur une trace trop courte pour trancher', () => {
    expect(timeScaleOfSamples([])).toBe(1)
    expect(timeScaleOfSamples([{ at: 84_328_431_000 }])).toBe(1)
  })
})
