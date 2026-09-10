import { describe, expect, it } from 'vitest'

import { MotionProbe, type MotionSample } from './motion'

/**
 * Ce que la sonde doit tenir : dire la cadence réelle, dire si l'appareil
 * renseigne l'accélération sans gravité, et ne jamais présenter une norme qui
 * inclurait la pesanteur comme si c'était une accélération de conduite.
 */

function sample(at: number, over: Partial<MotionSample> = {}): MotionSample {
  return {
    at,
    linear: { x: 0, y: 0, z: 0 },
    withGravity: { x: 0, y: 0, z: 9.81 },
    intervalMs: 16,
    ...over,
  }
}

describe('la sonde d’accéléromètre', () => {
  it('ne dit rien de la cadence avant deux relevés', () => {
    const probe = new MotionProbe()
    probe.add(sample(0))
    expect(probe.reading).toMatchObject({ count: 1, hz: null })
  })

  it('mesure la cadence sur ce qu’elle a reçu', () => {
    const probe = new MotionProbe()
    for (let i = 0; i <= 10; i += 1) probe.add(sample(i * 20))
    const { hz, announcedMs, count } = probe.reading
    expect(count).toBe(11)
    expect(hz).toBeCloseTo(50, 5)
    expect(announcedMs).toBe(16)
  })

  it('signale un appareil qui ne renseigne pas l’accélération sans gravité', () => {
    const probe = new MotionProbe()
    probe.add(sample(0, { linear: null }))
    probe.add(sample(20, { linear: null }))
    const { linear, peakMs2 } = probe.reading
    expect(linear).toBe(false)
    // Aucune norme : la gravité incluse ne se compare pas à une accélération de
    // conduite, et un 9,81 affiché se lirait comme une mesure.
    expect(peakMs2).toBeNull()
  })

  it('rend la crête et la moyenne de la fenêtre', () => {
    const probe = new MotionProbe()
    probe.add(sample(0, { linear: { x: 3, y: 4, z: 0 } }))
    probe.add(sample(100, { linear: { x: 0, y: 0, z: 1 } }))
    const { peakMs2, meanMs2 } = probe.reading
    expect(peakMs2).toBeCloseTo(5, 5)
    expect(meanMs2).toBeCloseTo(3, 5)
  })

  it('oublie ce qui sort de la fenêtre, mais pas le compte', () => {
    const probe = new MotionProbe()
    probe.add(sample(0, { linear: { x: 9, y: 0, z: 0 } }))
    for (let i = 1; i <= 10; i += 1) probe.add(sample(1000 * i, { linear: { x: 1, y: 0, z: 0 } }))
    const { peakMs2, count } = probe.reading
    expect(count).toBe(11)
    expect(peakMs2).toBeCloseTo(1, 5)
  })
})
