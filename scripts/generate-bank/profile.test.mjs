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
})
