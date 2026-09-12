import { describe, expect, it } from 'vitest'

import { exhaustImpulse } from './impulse'

describe('exhaustImpulse', () => {
  it('rend des échos espacés, et non du bruit', () => {
    // C'est toute la différence entre un échappement et un souffle. Convoluer
    // des explosions par du bruit rend du bruit : au ralenti on n'entendait
    // plus le moteur, seulement un chuintement de radio mal réglée. Un tube,
    // lui, renvoie l'onde à intervalle fixe.
    const sampleRate = 48000
    const tubeHz = 100
    const periode = sampleRate / tubeHz // 480 échantillons
    const ir = exhaustImpulse(sampleRate * 0.05, sampleRate, tubeHz)

    // Le creux entre deux échos doit être bien plus calme que les échos.
    const pres = (position: number): number => {
      let max = 0
      for (let i = position - 30; i <= position + 30; i += 1) max = Math.max(max, Math.abs(ir[i] ?? 0))
      return max
    }
    const echo = pres(Math.round(periode))
    const creux = pres(Math.round(periode * 1.5))
    expect(echo).toBeGreaterThan(creux * 5)
  })

  it('alterne le signe des échos', () => {
    // L'extrémité ouverte réfléchit une onde de pression en onde de dépression.
    // Sans ce changement de signe, la fondamentale du tube tomberait une octave
    // trop haut.
    const sampleRate = 48000
    const tubeHz = 100
    const periode = sampleRate / tubeHz
    const ir = exhaustImpulse(sampleRate * 0.05, sampleRate, tubeHz)
    const sommet = (k: number): number => {
      let valeur = 0
      for (let i = Math.round(k * periode) - 20; i <= Math.round(k * periode) + 40; i += 1) {
        if (Math.abs(ir[i] ?? 0) > Math.abs(valeur)) valeur = ir[i] ?? 0
      }
      return valeur
    }
    expect(Math.sign(sommet(0))).toBe(1)
    expect(Math.sign(sommet(1))).toBe(-1)
    expect(Math.sign(sommet(2))).toBe(1)
  })

  it("accorde le tube où on le lui demande", () => {
    // Un tube plus court renvoie plus vite : le premier écho se rapproche.
    const sampleRate = 48000
    const premierEcho = (hz: number): number => {
      const ir = exhaustImpulse(sampleRate * 0.05, sampleRate, hz)
      let position = 0
      let creux = 0
      // On cherche le minimum le plus marqué : c'est la première réflexion.
      for (let i = 1; i < ir.length; i += 1) {
        if ((ir[i] ?? 0) < creux) {
          creux = ir[i] ?? 0
          position = i
        }
      }
      return position
    }
    expect(premierEcho(50)).toBeGreaterThan(premierEcho(150))
  })

  it('porte la même énergie quelle que soit sa longueur', () => {
    // C'est ce qui rend la longueur de résonance réglable à l'oreille : sans
    // cela, l'allonger montait le volume et la raccourcir le baissait, si bien
    // qu'on ne savait plus lequel des deux on jugeait.
    const energie = (ir: Float32Array): number => ir.reduce((somme, v) => somme + v * v, 0)
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

  it('donne la même réponse à chaque appel, pour que deux réglages se comparent', () => {
    expect(Array.from(exhaustImpulse(64))).toEqual(Array.from(exhaustImpulse(64)))
  })

  it('ne rend jamais un tableau vide', () => {
    expect(exhaustImpulse(0).length).toBe(1)
  })
})
