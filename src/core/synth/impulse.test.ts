import { describe, expect, it } from 'vitest'

import { exhaustImpulse } from './impulse'

describe('exhaustImpulse', () => {
  it('porte la même énergie quelle que soit sa longueur', () => {
    // C'est ce qui rend la longueur de résonance réglable à l'oreille : sans
    // cela, l'allonger montait le volume et la raccourcir le baissait, si bien
    // qu'on ne savait plus lequel des deux on jugeait.
    const energie = (ir: Float32Array) => ir.reduce((somme, v) => somme + v * v, 0)
    expect(energie(exhaustImpulse(512))).toBeCloseTo(1, 5)
    expect(energie(exhaustImpulse(8192))).toBeCloseTo(1, 5)
  })

  it('rend la longueur demandée', () => {
    expect(exhaustImpulse(512).length).toBe(512)
  })

  it('reste dans les bornes du signal', () => {
    for (const value of exhaustImpulse(1024)) {
      expect(Math.abs(value)).toBeLessThanOrEqual(1)
    }
  })

  it('décroît : la fin est bien plus faible que le début', () => {
    const ir = exhaustImpulse(4000)
    const energy = (from: number, to: number): number => {
      let sum = 0
      for (let i = from; i < to; i += 1) sum += (ir[i] ?? 0) ** 2
      return sum / (to - from)
    }
    // Quatre constantes de temps sur la durée : le dernier dixième doit peser
    // beaucoup moins que le premier.
    expect(energy(3600, 4000)).toBeLessThan(energy(0, 400) / 10)
  })

  it('donne le même bruit à chaque appel, pour que deux réglages se comparent', () => {
    expect(Array.from(exhaustImpulse(64))).toEqual(Array.from(exhaustImpulse(64)))
  })

  it('ne rend jamais un tableau vide', () => {
    expect(exhaustImpulse(0).length).toBe(1)
  })
})
