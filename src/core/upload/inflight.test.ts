import { describe, expect, it } from 'vitest'
import { InFlight } from './inflight'

describe('InFlight', () => {
  it('n’est occupé qu’entre le début et la fin', () => {
    const f = new InFlight(30_000)
    expect(f.busy).toBe(false)
    f.begin(0)
    expect(f.busy).toBe(true)
    f.end()
    expect(f.busy).toBe(false)
  })

  it('laisse passer un envoi qui n’a pas atteint l’échéance', () => {
    const f = new InFlight(30_000)
    const signal = f.begin(1000)
    expect(f.sweep(30_999)).toBe(false)
    expect(signal.aborted).toBe(false)
  })

  it('abandonne l’envoi à l’échéance, et une seule fois', () => {
    const f = new InFlight(30_000)
    const signal = f.begin(1000)
    expect(f.sweep(31_000)).toBe(true)
    expect(signal.aborted).toBe(true)

    // Tant que l'envoi n'a pas rendu la main, le balayage ne relance rien de
    // neuf : c'est `end` qui ferme, appelé quand la promesse se résout.
    f.end()
    expect(f.sweep(99_999)).toBe(false)
  })

  it('ne balaie rien quand aucun envoi ne court', () => {
    expect(new InFlight(30_000).sweep(1e9)).toBe(false)
  })

  it('compte les quatre cent quarante-quatre secondes du 11 septembre 2026', () => {
    // La capture y était restée pendue sur une seule requête. Avec l'échéance,
    // elle rend la main à trente secondes.
    const f = new InFlight(30_000)
    f.begin(0)
    expect(f.sweep(29_999)).toBe(false)
    expect(f.sweep(30_000)).toBe(true)
  })
})
