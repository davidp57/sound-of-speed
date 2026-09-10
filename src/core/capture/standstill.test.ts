import { describe, expect, it } from 'vitest'
import { StandstillFlush } from './standstill'

describe('le dépôt à l’arrêt', () => {
  it('ne déclenche pas tant qu’on roule', () => {
    const f = new StandstillFlush(15_000)
    for (let t = 0; t < 60_000; t += 1000) expect(f.tick(t, false)).toBe(false)
  })

  it('déclenche après quinze secondes d’arrêt', () => {
    const f = new StandstillFlush(15_000)
    expect(f.tick(0, true)).toBe(false)
    expect(f.tick(14_900, true)).toBe(false)
    expect(f.tick(15_000, true)).toBe(true)
  })

  it('ne déclenche qu’une fois par arrêt', () => {
    // Sans cela, un embouteillage produirait un fichier par quart de minute.
    const f = new StandstillFlush(15_000)
    f.tick(0, true)
    expect(f.tick(15_000, true)).toBe(true)
    expect(f.tick(30_000, true)).toBe(false)
    expect(f.tick(120_000, true)).toBe(false)
  })

  it('se réarme quand la voiture repart', () => {
    const f = new StandstillFlush(15_000)
    f.tick(0, true)
    expect(f.tick(15_000, true)).toBe(true)
    expect(f.tick(20_000, false)).toBe(false)
    f.tick(30_000, true)
    expect(f.tick(45_000, true)).toBe(true)
  })

  it('laisse passer un feu rouge court sans déposer', () => {
    const f = new StandstillFlush(15_000)
    f.tick(0, true)
    expect(f.tick(8_000, true)).toBe(false)
    expect(f.tick(9_000, false)).toBe(false)
    expect(f.tick(12_000, false)).toBe(false)
  })
})
