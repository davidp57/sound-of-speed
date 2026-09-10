import { describe, expect, it } from 'vitest'

import { depositName, durationS } from './deposit'
import type { Trace } from '../speed/replay'

function trace(name: string, startedAt = 1_700_000_000_000, durationMs = 12_000): Trace {
  const samples = []
  for (let ms = 0; ms <= durationMs; ms += 1000) {
    samples.push({ kmh: 50, at: startedAt + ms, accuracyM: 5, derived: false })
  }
  return { name, startedAt, samples }
}

describe('depositName', () => {
  it('dit la date, le nom et la durée', () => {
    // On doit retrouver une trace sans l'ouvrir.
    const nom = depositName(trace('Retour du boulot'))

    expect(nom).toContain('2023-11-14')
    expect(nom).toContain('retour-du-boulot')
    expect(nom).toContain('12s')
    expect(nom.endsWith('.json')).toBe(true)
  })

  it('ne garde que des caractères sûrs', () => {
    // Le nom voyage dans une adresse et atterrit sur un système de fichiers.
    const nom = depositName(trace('Été : A7 / 130 km/h *test*'))

    expect(nom).toMatch(/^[a-zA-Z0-9._-]+$/)
  })

  it('tient sur une trace sans nom ni échantillon', () => {
    const nom = depositName({ name: '', startedAt: 1_700_000_000_000, samples: [] })

    expect(nom).toContain('trace')
    expect(nom).toContain('0s')
  })

  it('mesure la durée sur les horodatages, non sur le nombre de mesures', () => {
    // Une trace enregistrée à trente millisecondes et une à une seconde n'ont
    // pas le même nombre d'échantillons pour la même durée.
    expect(durationS(trace('x', 1_700_000_000_000, 90_000))).toBeCloseTo(90, 1)
  })
})
