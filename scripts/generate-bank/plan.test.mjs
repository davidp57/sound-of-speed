import { describe, expect, it } from 'vitest'

import { anchors, buildPlan, cycleSeconds, takeSamples } from './plan.mjs'

describe('les ancrages', () => {
  it('couvrent exactement du ralenti au rupteur', () => {
    const { list } = anchors(750, 6500, 0.5)
    expect(list[0]).toBeCloseTo(750, 6)
    expect(list[list.length - 1]).toBeCloseTo(6500, 6)
  })

  it('sont espacés géométriquement, jamais au-delà de l’écart demandé', () => {
    const { list, ratio } = anchors(750, 6500, 0.5)
    expect(Math.log2(ratio)).toBeLessThanOrEqual(0.5)
    for (let i = 1; i < list.length; i += 1) {
      expect(list[i] / list[i - 1]).toBeCloseTo(ratio, 9)
    }
  })

  it('resserrent quand on réduit l’écart demandé', () => {
    expect(anchors(750, 6500, 0.25).list.length).toBeGreaterThan(
      anchors(750, 6500, 0.5).list.length,
    )
  })
})

describe('la longueur d’une prise', () => {
  it('tient un nombre entier de cycles moteur', () => {
    // C'est ce qui met les deux bouts de la boucle en phase sans rien couper :
    // à régime tenu, le motif se répète tous les deux tours de vilebrequin.
    for (const rpm of [750, 1128, 2245, 6500]) {
      const { cycles, samples } = takeSamples(rpm, 3.0, 44100)
      expect(samples / 44100).toBeCloseTo(cycles * cycleSeconds(rpm), 4)
    }
  })

  it('reste proche de la durée visée', () => {
    for (const rpm of [750, 2245, 6500]) {
      const { samples } = takeSamples(rpm, 3.0, 44100)
      expect(samples / 44100).toBeGreaterThan(2.8)
      expect(samples / 44100).toBeLessThan(3.2)
    }
  })
})

describe('le plan', () => {
  const definition = {
    idleRpm: 800,
    redlineRpm: 6400,
    bank: {
      spacingOctaves: 1,
      takeSeconds: 2,
      settleSeconds: 3,
      idleThrottle: 0.08,
      limiterRpm: 6900,
      witnesses: true,
    },
  }

  it('donne une prise en charge et une pied levé par ancrage', () => {
    const plan = buildPlan(definition, 44100)
    const bank = plan.takes.filter((t) => t.purpose === 'bank')
    expect(bank.filter((t) => t.role === 'on')).toHaveLength(plan.anchors.length)
    expect(bank.filter((t) => t.role === 'off')).toHaveLength(plan.anchors.length)
    expect(bank.filter((t) => t.role === 'idle')).toHaveLength(1)
    expect(bank.filter((t) => t.role === 'limiter')).toHaveLength(1)
  })

  it('place un témoin entre deux ancrages voisins, et pas ailleurs', () => {
    const plan = buildPlan(definition, 44100)
    const witnesses = plan.takes.filter((t) => t.purpose === 'witness')
    expect(witnesses).toHaveLength(plan.anchors.length - 1)
    witnesses.forEach((witness, i) => {
      expect(witness.rpm).toBeCloseTo(Math.sqrt(plan.anchors[i] * plan.anchors[i + 1]), 6)
    })
  })

  it('ne fait pas de prise de rupteur quand on n’en veut pas', () => {
    const sans = { ...definition, bank: { ...definition.bank, limiterRpm: 0 } }
    expect(buildPlan(sans, 44100).takes.filter((t) => t.role === 'limiter')).toHaveLength(0)
  })

  it('ouvre les gaz en charge et les ferme pied levé', () => {
    const plan = buildPlan(definition, 44100)
    for (const take of plan.takes) {
      if (take.role === 'on') expect(take.throttle).toBe(1)
      if (take.role === 'off') expect(take.throttle).toBe(0)
    }
  })
})
