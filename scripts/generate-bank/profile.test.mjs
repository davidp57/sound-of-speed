import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { fromFile } from '../../src/core/preset/store.ts'

const PROFIL = process.env['PROFIL_GENERE']

describe.skipIf(!PROFIL)('le profil produit', () => {
  it('est accepté par l’import de l’application', () => {
    const profile = fromFile(readFileSync(PROFIL, 'utf8'))
    expect(profile.layers.length).toBeGreaterThan(4)
    for (const layer of profile.layers) {
      expect(['on', 'off', 'idle', 'limiter']).toContain(layer.role)
      expect(layer.anchorRpm).toBeGreaterThan(0)
      expect(layer.minRate).toBeLessThan(1)
      expect(layer.maxRate).toBeGreaterThan(1)
    }
    expect(profile.engine.cylinders).toBeGreaterThan(0)
    expect(profile.drivetrain.gearRatios.length).toBeGreaterThan(0)
  })

  it('se déclare généré à l’avance et garde de quoi se refaire', () => {
    const profile = fromFile(readFileSync(PROFIL, 'utf8'))

    // Sans ces deux champs, la banque serait une boîte noire : on ne saurait
    // plus ni d'où vient son son, ni comment la refaire après avoir changé un
    // réglage du moteur.
    expect(profile.soundSource).toBe('prerendered')
    expect(profile.engineDefinition).toMatchObject({
      sampleDir: profile.sampleDir,
      cylinders: profile.engine.cylinders,
    })
  })
})
