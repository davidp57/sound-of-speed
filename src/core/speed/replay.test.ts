import { afterEach, describe, expect, it, vi } from 'vitest'

import { ReplaySource, TraceRecorder, type Trace } from './replay'
import type { SpeedSample } from './source'

/**
 * Tests du rejeu de trace.
 *
 * C'est l'outil de mise au point le plus utile du projet : un trajet capturé une
 * fois en voiture se rejoue autant de fois qu'on veut sur un poste fixe. Sa
 * fidélité conditionne donc tout réglage fait au bureau — si le rejeu déforme la
 * trace, on règle sur une fiction.
 */

const FRAME_S = 1 / 60

function sample(kmh: number, at: number): SpeedSample {
  return { kmh, at, accuracyM: 5, derived: false }
}

/** Trace synthétique : une mesure par seconde, vitesse croissante. */
function trace(count = 5, stepMs = 1000): Trace {
  const startedAt = 1_700_000_000_000
  return {
    name: 'Essai',
    startedAt,
    samples: Array.from({ length: count }, (_, i) => sample(i * 10, startedAt + i * stepMs)),
  }
}

function collect(source: ReplaySource, seconds: number): SpeedSample[] {
  const recu: SpeedSample[] = []
  source.onSample((s) => recu.push(s))
  for (let f = 0; f * FRAME_S <= seconds; f += 1) source.tick(FRAME_S)
  return recu
}

afterEach(() => {
  vi.useRealTimers()
})

describe('ReplaySource', () => {
  it('rejoue la trace à l’identique, dans l’ordre', () => {
    const t = trace()
    const source = new ReplaySource(t)
    source.start()

    const recu = collect(source, 5)

    expect(recu).toEqual(t.samples)
  })

  it('respecte le rythme de la trace', () => {
    const source = new ReplaySource(trace())
    source.start()

    // Au bout de deux secondes et demie, seules les trois premières mesures
    // sont dues : celles de 0, 1 et 2 secondes.
    const recu = collect(source, 2.5)

    expect(recu).toHaveLength(3)
  })

  it('rejoue plus vite quand on le lui demande', () => {
    const source = new ReplaySource(trace(), 4)
    source.start()

    // Quatre fois plus vite : une seconde et demie de boucle couvre six
    // secondes de trace, donc toute la trace.
    const recu = collect(source, 1.5)

    expect(recu).toHaveLength(5)
  })

  it('émet plusieurs mesures dans la même image en rejeu accéléré', () => {
    const source = new ReplaySource(trace(20, 100), 20)
    source.start()

    const parImage: number[] = []
    source.onSample(() => {
      parImage[parImage.length - 1] = (parImage[parImage.length - 1] ?? 0) + 1
    })
    for (let f = 0; f < 10; f += 1) {
      parImage.push(0)
      source.tick(FRAME_S)
    }

    // C'est voulu : le conditionnement en aval s'en accommode.
    expect(Math.max(...parImage)).toBeGreaterThan(1)
  })

  it('rapporte sa durée et sa progression', () => {
    const source = new ReplaySource(trace())

    // Cinq mesures espacées d'une seconde : quatre secondes de bout en bout.
    expect(source.durationS).toBe(4)
    expect(source.progress).toBe(0)

    source.start()
    collect(source, 2)
    expect(source.progress).toBeGreaterThan(0.4)
    expect(source.progress).toBeLessThan(0.6)
  })

  it('s’arrête de lui-même à la fin de la trace', () => {
    const source = new ReplaySource(trace())
    const statuts: { status: string; detail: string | undefined }[] = []
    source.onStatus((status, detail) => statuts.push({ status, detail }))
    source.start()

    collect(source, 6)

    expect(source.isFinished).toBe(true)
    expect(source.progress).toBe(1)
    expect(statuts.at(-1)).toEqual({ status: 'idle', detail: 'trace terminée' })
  })

  it('se remet au début à la demande', () => {
    const source = new ReplaySource(trace())
    source.start()
    collect(source, 6)

    source.rewind()

    expect(source.isFinished).toBe(false)
    expect(source.progress).toBe(0)
  })

  it('refuse de rejouer une trace vide, et le dit', () => {
    const source = new ReplaySource({ name: 'Vide', startedAt: 0, samples: [] })
    const statuts: { status: string; detail: string | undefined }[] = []
    source.onStatus((status, detail) => statuts.push({ status, detail }))

    source.start()

    expect(statuts).toEqual([{ status: 'unavailable', detail: 'trace vide' }])
    expect(source.durationS).toBe(0)
    expect(source.progress).toBe(0)
  })

  it('change de trace et repart du début', () => {
    const source = new ReplaySource(trace())
    source.start()
    collect(source, 3)

    const autre = trace(3, 500)
    source.setTrace(autre)

    expect(source.getTrace()).toBe(autre)
    expect(source.progress).toBe(0)
    expect(source.durationS).toBe(1)
  })

  it('n’émet rien quand il est arrêté', () => {
    const source = new ReplaySource(trace())
    source.start()
    source.stop()

    expect(collect(source, 3)).toHaveLength(0)
  })
})

describe('TraceRecorder', () => {
  it('n’accumule rien avant qu’on l’enclenche', () => {
    const recorder = new TraceRecorder()

    recorder.push(sample(10, 1))

    expect(recorder.isRecording).toBe(false)
    expect(recorder.count).toBe(0)
  })

  it('accumule ce que la source émet, dans l’ordre', () => {
    const recorder = new TraceRecorder()
    recorder.start()

    recorder.push(sample(10, 1))
    recorder.push(sample(20, 2))

    expect(recorder.count).toBe(2)
    expect(recorder.stop('Tour du lac').samples.map((s) => s.kmh)).toEqual([10, 20])
  })

  it('date la trace de son début', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(1_700_000_000_000)
    const recorder = new TraceRecorder()

    recorder.start()
    vi.setSystemTime(1_700_000_030_000)
    const t = recorder.stop('Datée')

    expect(t.startedAt).toBe(1_700_000_000_000)
    expect(t.name).toBe('Datée')
  })

  it('repart de zéro à chaque enregistrement', () => {
    const recorder = new TraceRecorder()
    recorder.start()
    recorder.push(sample(10, 1))
    recorder.stop('Premier')

    recorder.start()
    recorder.push(sample(50, 2))

    expect(recorder.stop('Second').samples.map((s) => s.kmh)).toEqual([50])
  })

  it('cesse d’accumuler après l’arrêt', () => {
    const recorder = new TraceRecorder()
    recorder.start()
    recorder.stop('Fini')

    recorder.push(sample(99, 3))

    expect(recorder.count).toBe(0)
  })
})
