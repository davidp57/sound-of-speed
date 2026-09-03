import { describe, expect, it } from 'vitest'

import { analyzeStep } from './analyze'
import { LAUNCH_MIN_ACCEL_MS2 } from './protocol'
import { ReplaySource } from '../speed/replay'
import type { Trace } from '../speed/replay'
import type { SpeedSample } from '../speed/source'

/**
 * Tests du jugement d'une étape.
 *
 * Ce qui est vérifié ici n'est pas la mesure — c'est le **refus**. Une reprise
 * molle acceptée donnerait un `fullLoadAccelMs2` faux, donc une charge fausse,
 * donc un fondu faux : le défaut même que l'étalonnage prétend corriger. Chaque
 * cas limite a donc son test, et le motif du refus est vérifié avec.
 */

interface Shape {
  durationS: number
  cadenceMs?: number
  kmhAt: (t: number) => number
}

function buildTrace(shape: Shape, name = 'étape'): Trace {
  const cadenceMs = shape.cadenceMs ?? 100
  const startedAt = 1_700_000_000_000
  const samples: SpeedSample[] = []
  for (let ms = 0; ms <= shape.durationS * 1000; ms += cadenceMs) {
    samples.push({
      kmh: Math.max(0, shape.kmhAt(ms / 1000)),
      at: startedAt + ms,
      accuracyM: 5,
      derived: false,
    })
  }
  return { name, startedAt, samples }
}

/** Rampe d'accélération constante depuis l'arrêt. */
const ramp = (accelMs2: number) => (t: number) => accelMs2 * 3.6 * t

/** Reprise depuis l'arrêt, à accélération constante puis vitesse tenue. */
function launchTrace(accelMs2: number, durationS = 8): Trace {
  const topKmh = accelMs2 * 3.6 * durationS
  return buildTrace({
    durationS: durationS + 4,
    kmhAt: (t) => Math.min(topKmh, accelMs2 * 3.6 * t),
  })
}

describe('analyzeStep — accélération franche', () => {
  it('accepte une reprise franche et rend l’accélération obtenue', () => {
    const analysis = analyzeStep('launch', launchTrace(3.5))

    expect(analysis.valid).toBe(true)
    expect(analysis.reason).toBe('')
    // 3,5 m/s² injectés, 3,5 mesurés : la trace est propre, l'ajustement est
    // exact. Sur un enregistrement réel, le bruit du GPS ajoute quelques
    // centièmes — voir `measure.test.ts`.
    expect(analysis.measure.peakAccelMs2).toBeCloseTo(3.5, 2)
  })

  it('refuse une reprise à 1 m/s², et dit pourquoi', () => {
    // Le cas nommé dans la spécification : « une accélération franche qui
    // n'atteint que 1 m/s² n'en est pas une ».
    const analysis = analyzeStep('launch', launchTrace(1, 20))

    expect(analysis.valid).toBe(false)
    expect(analysis.reason).toContain('1.00 m/s²')
    expect(analysis.reason).toContain('reprise franche')
    expect(analysis.measure.peakAccelMs2 ?? 0).toBeLessThan(LAUNCH_MIN_ACCEL_MS2)
  })

  it('refuse un enregistrement qui ne part pas de l’arrêt', () => {
    const rolling = buildTrace({ durationS: 12, kmhAt: (t) => 40 + 3.5 * 3.6 * t })

    const analysis = analyzeStep('launch', rolling)

    expect(analysis.valid).toBe(false)
    expect(analysis.reason).toContain('partir de l’arrêt')
  })

  it('refuse un enregistrement trop court pour porter une mesure', () => {
    // Deux secondes : la reprise est franche et gagne 29 km/h, mais il n'y a
    // pas de quoi voir si elle se soutient.
    const analysis = analyzeStep('launch', buildTrace({ durationS: 2, kmhAt: ramp(4) }))

    expect(analysis.valid).toBe(false)
    expect(analysis.reason).toContain('ne dure que')
  })

  it('refuse une reprise franche mais écourtée', () => {
    // Quatre mètres par seconde carré pendant une seconde et demie : franche,
    // mais elle ne gagne que 22 km/h. Trop peu pour que la crête soit sûre.
    const analysis = analyzeStep(
      'launch',
      buildTrace({ durationS: 5, kmhAt: (t) => Math.min(4 * 3.6 * 1.5, 4 * 3.6 * t) }),
    )

    expect(analysis.valid).toBe(false)
    expect(analysis.reason).toContain('km/h gagnés')
  })

  it('refuse une trace vide', () => {
    const analysis = analyzeStep('launch', { name: 'vide', startedAt: 0, samples: [] })

    expect(analysis.valid).toBe(false)
    expect(analysis.reason).toContain('trop courte')
  })
})

/** Ralentissement depuis une vitesse donnée, à décélération constante. */
function slowTrace(fromKmh: number, decelMs2: number, durationS: number): Trace {
  return buildTrace({
    durationS,
    kmhAt: (t) => Math.max(0, fromKmh - Math.abs(decelMs2) * 3.6 * t),
  })
}

describe('analyzeStep — décélération pied levé', () => {
  it('accepte un lever de pied et rend la décélération obtenue', () => {
    // 70 km/h, 0,8 m/s² pendant dix secondes : 28 km/h perdus.
    const analysis = analyzeStep('coast', slowTrace(70, 0.8, 10))

    expect(analysis.valid).toBe(true)
    expect(analysis.measure.peakDecelMs2).toBeCloseTo(-0.8, 2)
  })

  it('accepte un lever de pied fort, sans plafond', () => {
    // Une électrique récupère au lever de pied : 2,5 m/s² sans toucher au frein
    // est parfaitement possible, et refuser cela reviendrait à refuser la
    // voiture qu'on mesure. C'est la proposition de frontière, plus loin, qui
    // dit si les deux étapes se distinguent.
    const analysis = analyzeStep('coast', slowTrace(90, 2.5, 8))

    expect(analysis.valid).toBe(true)
    expect(analysis.measure.peakDecelMs2).toBeCloseTo(-2.5, 2)
  })

  it('refuse un lever de pied entamé trop bas', () => {
    const analysis = analyzeStep('coast', slowTrace(40, 1, 8))

    expect(analysis.valid).toBe(false)
    expect(analysis.reason).toContain('de quoi ralentir')
  })

  it('refuse un lever de pied qui ne perd presque rien', () => {
    const analysis = analyzeStep('coast', slowTrace(80, 0.2, 8))

    expect(analysis.valid).toBe(false)
    expect(analysis.reason).toContain('km/h perdus')
  })

  it('refuse une décote qui n’est pas un ralentissement', () => {
    // Vingt km/h perdus, mais sur cent secondes : 0,06 m/s². La vitesse a
    // dérivé, elle n'a pas ralenti — et l'enregistrement couvre autre chose que
    // la manœuvre demandée.
    const analysis = analyzeStep('coast', slowTrace(80, 0.056, 100))

    expect(analysis.valid).toBe(false)
    expect(analysis.reason).toContain('restée tenue')
  })
})

describe('analyzeStep — freinage franc', () => {
  it('accepte un freinage franc et rend la décélération obtenue', () => {
    const analysis = analyzeStep('brake', slowTrace(90, 4.5, 5))

    expect(analysis.valid).toBe(true)
    expect(analysis.measure.peakDecelMs2).toBeCloseTo(-4.5, 2)
  })

  it('refuse un ralentissement mou, et dit pourquoi', () => {
    const analysis = analyzeStep('brake', slowTrace(90, 1.2, 8))

    expect(analysis.valid).toBe(false)
    expect(analysis.reason).toContain('1.20 m/s²')
    expect(analysis.reason).toContain('freinage franc')
  })

  it('refuse un freinage entamé trop bas', () => {
    const analysis = analyzeStep('brake', slowTrace(30, 4, 5))

    expect(analysis.valid).toBe(false)
    expect(analysis.reason).toContain('30 km/h')
  })
})

describe('analyzeStep — reproductibilité', () => {
  it('rend la même valeur sur la trace rejouée', () => {
    const trace = launchTrace(3.2)
    const direct = analyzeStep('launch', trace)

    // La trace repasse par la source de rejeu, exactement comme quand on la
    // relit dans l'application, et l'on remesure ce qu'elle émet. C'est la
    // garantie que la mesure ne dépend pas du chemin par lequel les mesures
    // arrivent : la même trace rend le même chiffre.
    const replay = new ReplaySource(trace)
    const captured: SpeedSample[] = []
    replay.onSample((sample) => captured.push(sample))
    replay.start()
    let guard = 0
    while (!replay.isFinished && guard < 100_000) {
      replay.tick(1 / 60)
      guard += 1
    }

    const replayed = analyzeStep('launch', {
      name: trace.name,
      startedAt: trace.startedAt,
      samples: captured,
    })

    expect(captured.length).toBe(trace.samples.length)
    expect(replayed.valid).toBe(direct.valid)
    expect(replayed.measure.peakAccelMs2).toBe(direct.measure.peakAccelMs2)
  })
})
