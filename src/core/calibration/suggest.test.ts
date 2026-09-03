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

function slowTrace(fromKmh: number, decelMs2: number, durationS: number): Trace {
  const startedAt = 1_700_000_000_000
  const samples: SpeedSample[] = []
  for (let ms = 0; ms <= durationS * 1000; ms += 100) {
    samples.push({
      kmh: Math.max(0, fromKmh - (Math.abs(decelMs2) * 3.6 * ms) / 1000),
      at: startedAt + ms,
      accuracyM: 5,
      derived: false,
    })
  }
  return { name: 'ralentissement', startedAt, samples }
}

/** Retrouve une ligne du récapitulatif par sa clé. */
function row(suggestions: ReturnType<typeof suggest>, key: string) {
  return suggestions.find((suggestion) => suggestion.key === key)
}

describe('suggest — rétrogradage au freinage', () => {
  it('place le seuil au milieu du lever de pied et du freinage', () => {
    const coast = analyzeStep('coast', slowTrace(80, 1, 12))
    const brake = analyzeStep('brake', slowTrace(90, 4.4, 5))

    const line = row(suggest([coast, brake], createRoadProfile()), 'drivetrain.brakeDownshiftAccelMs2')

    // −1,00 pied levé, −4,40 au freinage : le milieu est à −2,70. Le profil
    // Route est réglé à −1, c'est-à-dire exactement sur la valeur du lever de
    // pied — donc la boîte y rétrograde dès qu'on lève le pied.
    expect(line?.measured?.value).toBeCloseTo(-2.7, 2)
    expect(line?.setting?.proposed).toBe(-2.7)
    expect(line?.setting?.current).toBe(-1)
  })

  it('ne propose rien quand les deux étapes se touchent', () => {
    // Le cas d'une électrique qui récupère fort : lever le pied et freiner
    // donnent la même chose, et il n'y a pas de frontière entre les deux.
    const coast = analyzeStep('coast', slowTrace(80, 2.3, 8))
    const brake = analyzeStep('brake', slowTrace(90, 2.5, 8))

    const line = row(suggest([coast, brake], createRoadProfile()), 'drivetrain.brakeDownshiftAccelMs2')

    expect(line?.setting).toBeNull()
    expect(line?.missing).toContain('la même décélération')
    expect(line?.missing).toContain('récupération')
  })

  it('dit laquelle des deux étapes manque', () => {
    const brake = analyzeStep('brake', slowTrace(90, 4.4, 5))

    const line = row(suggest([brake], createRoadProfile()), 'drivetrain.brakeDownshiftAccelMs2')

    expect(line?.missing).toContain('décélération pied levé')
  })
})

describe('suggest — bornes de l’accélération', () => {
  it('borne sur la valeur relevée, plus la moitié en marge', () => {
    const launch = analyzeStep('launch', launchTrace(3.4))
    const brake = analyzeStep('brake', slowTrace(90, 4.4, 5))

    const suggestions = suggest([launch, brake], createRoadProfile())

    // −4,40 relevé × 1,5 = −6,60, arrondi vers l'extérieur au demi : −7,0.
    // 3,40 relevé × 1,5 = 5,10, arrondi vers l'extérieur : 5,5.
    expect(row(suggestions, 'speed.minAccelMs2')?.setting?.proposed).toBe(-7)
    expect(row(suggestions, 'speed.maxAccelMs2')?.setting?.proposed).toBe(5.5)
    // Les bornes du profil livré, jamais atteintes.
    expect(row(suggestions, 'speed.minAccelMs2')?.setting?.current).toBe(-14)
    expect(row(suggestions, 'speed.maxAccelMs2')?.setting?.current).toBe(14)
  })

  it('ignore une étape refusée dans le calcul des bornes', () => {
    // Un freinage mou est refusé : il ne doit pas servir de borne, sans quoi
    // une étape ratée resserrerait l'écrêtage sur une valeur trop faible.
    const launch = analyzeStep('launch', launchTrace(3.4))
    const soft = analyzeStep('brake', slowTrace(90, 1.2, 8))

    const suggestions = suggest([launch, soft], createRoadProfile())

    expect(soft.valid).toBe(false)
    // Seule la reprise compte : sa propre décélération est nulle, donc la borne
    // basse tombe à zéro plutôt qu'à −1,8.
    expect(row(suggestions, 'speed.minAccelMs2')?.measured?.value).toBeCloseTo(0, 2)
  })

  it('ne borne rien sans aucune étape valide', () => {
    const suggestions = suggest([], createRoadProfile())

    expect(row(suggestions, 'speed.minAccelMs2')?.missing).toContain('rien à borner')
    expect(row(suggestions, 'speed.maxAccelMs2')?.missing).toContain('rien à borner')
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
