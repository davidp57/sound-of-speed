import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { fromFile } from '../../src/core/preset/store.ts'

import { resoudreMoteur } from './moteur.mjs'
import { buildProfile } from './profil.mjs'

const PROFIL = process.env['PROFIL_GENERE']

/** Une définition de banque et deux couches : de quoi bâtir un profil, sans banque. */
const DEFINITION = {
  name: 'Essai',
  sampleDir: 'essai-genere',
  engine: 'gm-ls-long-header',
  idleRpm: 780,
}

const COUCHES = [
  { key: 'on_780', file: 'on-780.wav', role: 'on', anchorRpm: 780, gain: 0.6, minRate: 0.74, maxRate: 1.36, enabled: true },
  { key: 'on_6500', file: 'on-6500.wav', role: 'on', anchorRpm: 6500, gain: 1, minRate: 0.74, maxRate: 1.36, enabled: true },
]

describe('le profil que produit une banque générée', () => {
  it('emporte le moteur qui a fait le son, et le garde à l’import', async () => {
    const moteur = await resoudreMoteur(DEFINITION)
    const profil = buildProfile({
      definition: DEFINITION,
      moteur,
      layers: COUCHES,
      anchorList: [780, 6500],
    })

    const repris = fromFile(JSON.stringify(profil))

    expect(repris.soundSource).toBe('prerendered')
    expect(repris.sampleDir).toBe('essai-genere')

    // Les quatre valeurs d'échappement du collecteur long, celles que David a
    // trouvées à l'oreille le 8 septembre 2026. C'est ce que le champ portait
    // avant : la **définition de banque**, que `clampEngineDefinition` bornait
    // au contrat et vidait de son dossier comme de sa recette. Le moteur, lui,
    // passe entier.
    expect(repris.engineDefinition).toMatchObject({
      cylinders: 8,
      primaryTubeLength: 30,
      primaryFlowRate: 1000,
      outletFlowRate: 2000,
      headerLength: 30,
    })
  })

  it('porte le rupteur du moteur choisi, sauf si la banque en déclare un autre', async () => {
    const moteur = await resoudreMoteur(DEFINITION)
    expect(moteur.redlineRpm).toBe(6500)

    const impose = await resoudreMoteur({ ...DEFINITION, redlineRpm: 6300 })
    expect(impose.redlineRpm).toBe(6300)
    expect(impose.nommees.revLimit).toBe(6300)
  })

  it('refuse un moteur que la bibliothèque ne connaît pas', async () => {
    await expect(resoudreMoteur({ engine: 'trois-cylindres-imaginaire' })).rejects.toThrow(
      /moteur inconnu/,
    )
  })
})

describe.skipIf(!PROFIL)('une banque produite pour de vrai', () => {
  it('est acceptée par l’import de l’application', () => {
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

  it('se déclare générée à l’avance et garde de quoi se refaire', () => {
    const profile = fromFile(readFileSync(PROFIL, 'utf8'))

    // Sans ces deux-là, la banque serait une boîte noire : on ne saurait plus ni
    // d'où vient son son, ni comment la refaire. Le dossier mène à
    // `mesures.json`, où la recette complète est écrite à côté des fichiers.
    expect(profile.soundSource).toBe('prerendered')
    expect(profile.sampleDir).toBeTruthy()
    expect(profile.engineDefinition.cylinders).toBe(profile.engine.cylinders)
  })
})
