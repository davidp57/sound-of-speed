import { describe, expect, it } from 'vitest'

import { analyzeStep } from './analyze'
import { readSetting, writeSetting } from './settings'
import { round, suggest } from './suggest'
import { createRoadProfile } from '../preset/defaults'
import type { Trace } from '../speed/replay'
import type { SpeedSample } from '../speed/source'

/**
 * Tests de la proposition.
 *
 * Deux choses s'y vérifient, et la seconde est une règle plus qu'un calcul :
 * la valeur proposée est bien celle mesurée, et **rien n'est appliqué**. Le
 * profil rendu par `suggest` est le profil reçu, à l'identique — seul
 * `writeSetting`, appelé sur un geste, en produit un autre.
 */

function launchTrace(accelMs2: number, durationS = 8): Trace {
  const topKmh = accelMs2 * 3.6 * durationS
  const startedAt = 1_700_000_000_000
  const samples: SpeedSample[] = []
  for (let ms = 0; ms <= (durationS + 4) * 1000; ms += 100) {
    samples.push({
      kmh: Math.min(topKmh, (accelMs2 * 3.6 * ms) / 1000),
      at: startedAt + ms,
      accuracyM: 5,
      derived: false,
    })
  }
  return { name: 'reprise', startedAt, samples }
}

describe('suggest — charge pleine', () => {
  it('propose l’accélération mesurée face à celle du profil', () => {
    const profile = createRoadProfile()
    const analysis = analyzeStep('launch', launchTrace(3.6))

    const [suggestion] = suggest([analysis], profile)

    expect(suggestion?.key).toBe('mix.fullLoadAccelMs2')
    // 3,6 m/s² injectés, 3,6 proposés. Le profil Route est réglé à 2 m/s²,
    // valeur choisie par le calcul : l'écart de 1,6 est précisément ce que le
    // lot cherchait à faire voir.
    expect(suggestion?.measured?.value).toBeCloseTo(3.6, 2)
    expect(suggestion?.setting?.proposed).toBe(3.6)
    expect(suggestion?.setting?.current).toBe(2)
    expect(suggestion?.missing).toBeNull()
  })

  it('dit non mesuré quand l’étape n’a pas été faite', () => {
    const [suggestion] = suggest([], createRoadProfile())

    expect(suggestion?.measured).toBeNull()
    expect(suggestion?.setting).toBeNull()
    expect(suggestion?.missing).toContain('non enregistrée')
  })

  it('dit refusé, et pourquoi, quand l’étape a échoué', () => {
    const analysis = analyzeStep('launch', launchTrace(1, 20))

    const [suggestion] = suggest([analysis], createRoadProfile())

    expect(suggestion?.measured).toBeNull()
    expect(suggestion?.setting).toBeNull()
    expect(suggestion?.missing).toContain('refusée')
    expect(suggestion?.missing).toContain('reprise franche')
  })

  it('ne touche pas au profil', () => {
    const profile = createRoadProfile()
    const before = JSON.stringify(profile)

    suggest([analyzeStep('launch', launchTrace(4))], profile)

    expect(JSON.stringify(profile)).toBe(before)
    expect(profile.mix.fullLoadAccelMs2).toBe(2)
  })
})

describe('writeSetting', () => {
  it('recopie un réglage et laisse le reste intact', () => {
    const profile = createRoadProfile()

    const updated = writeSetting(profile, 'mix.fullLoadAccelMs2', 3.6)

    expect(readSetting(updated, 'mix.fullLoadAccelMs2')).toBe(3.6)
    // Le profil d'origine est inchangé : c'est ce qui permet à
    // « réinitialiser » de revenir à ce qu'il était.
    expect(profile.mix.fullLoadAccelMs2).toBe(2)
    // Et rien d'autre n'a bougé dans le mixage.
    expect({ ...updated.mix, fullLoadAccelMs2: 0 }).toEqual({
      ...profile.mix,
      fullLoadAccelMs2: 0,
    })
  })

  it('refuse une valeur du mauvais genre plutôt que d’écrire n’importe quoi', () => {
    const profile = createRoadProfile()

    const updated = writeSetting(profile, 'mix.fullLoadAccelMs2', [1, 2])

    expect(updated).toBe(profile)
  })
})

describe('round', () => {
  it('arrondit au nombre de décimales demandé', () => {
    expect(round(3.5551, 1)).toBe(3.6)
    expect(round(-1.049, 1)).toBe(-1)
    expect(round(117.4, 0)).toBe(117)
  })
})
