import { describe, expect, it } from 'vitest'
import {
  REFRESH_FADE_S,
  REFRESH_JITTER,
  equalPowerCurves,
  equalPowerGains,
  nextRefreshDelayS,
} from './refresh'

/** Générateur reproductible, pour que deux passes du test donnent le même bruit. */
function makeNoise(seed: number, length: number): Float64Array {
  let state = seed
  const out = new Float64Array(length)
  for (let i = 0; i < length; i += 1) {
    state = (state * 1664525 + 1013904223) >>> 0
    out[i] = (state / 0xffffffff) * 2 - 1
  }
  return out
}

const rms = (values: Float64Array): number => {
  let sum = 0
  for (const value of values) sum += value * value
  return Math.sqrt(sum / values.length)
}
const db = (ratio: number): number => 20 * Math.log10(ratio)

/** Ramène un signal à un niveau efficace de un. */
function normalize(values: Float64Array): Float64Array {
  const level = rms(values)
  const out = new Float64Array(values.length)
  for (let i = 0; i < values.length; i += 1) out[i] = values[i]! / level
  return out
}

describe('fondu croisé à puissance constante', () => {
  it('part de la source sortante et arrive sur l’entrante', () => {
    expect(equalPowerGains(0)).toEqual({ outgoing: 1, incoming: 0 })
    const end = equalPowerGains(1)
    expect(end.outgoing).toBeCloseTo(0, 12)
    expect(end.incoming).toBeCloseTo(1, 12)
  })

  it('conserve l’énergie tout au long du fondu', () => {
    for (let i = 0; i <= 100; i += 1) {
      const { outgoing, incoming } = equalPowerGains(i / 100)
      expect(outgoing * outgoing + incoming * incoming).toBeCloseTo(1, 12)
    }
  })

  it('borne un avancement hors limites', () => {
    expect(equalPowerGains(-1)).toEqual(equalPowerGains(0))
    expect(equalPowerGains(2).incoming).toBeCloseTo(equalPowerGains(1).incoming, 12)
  })

  it('produit des courbes monotones, prêtes à poser sur un gain', () => {
    const { outgoing, incoming } = equalPowerCurves(17)
    expect(outgoing).toHaveLength(17)
    expect(incoming).toHaveLength(17)
    expect(outgoing[0]).toBeCloseTo(1, 6)
    expect(incoming[16]).toBeCloseTo(1, 6)
    for (let i = 1; i < 17; i += 1) {
      expect(outgoing[i]!).toBeLessThan(outgoing[i - 1]!)
      expect(incoming[i]!).toBeGreaterThan(incoming[i - 1]!)
    }
  })

  /**
   * Le test qui compte : ce que la loi fait au niveau, sur deux signaux
   * décorrélés — ce que sont deux positions d'un même enregistrement. Le fondu
   * linéaire sert de témoin : sans lui, un test qui passe ne prouverait pas que
   * la mesure sait voir un creux.
   */
  it('ne creuse pas le niveau, là où le fondu linéaire perd 1,76 dB', () => {
    const length = 4096
    // Deux moitiés d'une même suite : décorrélées, et sans l'écart de niveau
    // que deux tirages indépendants laisseraient — cet écart-là se retrouverait
    // dans le résultat et masquerait ce qu'on mesure.
    const noise = makeNoise(20260907, 2 * length)
    const first = normalize(noise.slice(0, length))
    const second = normalize(noise.slice(length))

    const constantPower = new Float64Array(length)
    const linear = new Float64Array(length)
    for (let i = 0; i < length; i += 1) {
      const progress = i / (length - 1)
      const { outgoing, incoming } = equalPowerGains(progress)
      constantPower[i] = outgoing * first[i]! + incoming * second[i]!
      linear[i] = (1 - progress) * first[i]! + progress * second[i]!
    }

    // Sur toute la durée du fondu, les deux valeurs attendues sont exactes :
    // l'énergie moyenne vaut 1 à puissance constante, 2/3 en linéaire — soit
    // 1,76 dB de moins. C'est la mesure faite sur les vraies couches, où le
    // linéaire creuse de 1,2 à 1,8 dB.
    expect(Math.abs(db(rms(constantPower)))).toBeLessThan(0.15)
    expect(db(rms(linear))).toBeCloseTo(-1.76, 1)
  })
})

describe('cadence des sauts', () => {
  it('reste dans la dispersion annoncée autour de l’intervalle réglé', () => {
    expect(nextRefreshDelayS(6, 0)).toBeCloseTo(6 * (1 - REFRESH_JITTER), 12)
    expect(nextRefreshDelayS(6, 1)).toBeCloseTo(6 * (1 + REFRESH_JITTER), 12)
    expect(nextRefreshDelayS(6, 0.5)).toBeCloseTo(6, 12)
  })

  it('éteint le renouvellement à intervalle nul ou négatif', () => {
    expect(nextRefreshDelayS(0, 0.5)).toBe(0)
    expect(nextRefreshDelayS(-3, 0.5)).toBe(0)
  })

  it('donne un fondu bien plus court que le plus court des intervalles utiles', () => {
    expect(REFRESH_FADE_S).toBeLessThan(nextRefreshDelayS(1, 0) / 10)
  })
})
