import { describe, expect, it } from 'vitest'

import {
  DEFAULT_LEVELER_AUTO_PARAMS,
  levelerTargetFor,
  nextLevelerFloor,
  type LevelerAutoParams,
} from './leveler'

const PARAMS: LevelerAutoParams = { ...DEFAULT_LEVELER_AUTO_PARAMS, ceiling: 23000 }

describe('nextLevelerFloor', () => {
  it('descend le plancher tant que la crête reste écrêtée, au ralenti', () => {
    let state = { floor: PARAMS.ceiling }
    for (let i = 0; i < 5; i++) {
      state = nextLevelerFloor(state, 1.0, 0, 0.25, PARAMS)
    }
    expect(state.floor).toBeLessThan(PARAMS.ceiling)
  })

  it('ne descend jamais sous le plancher minimal', () => {
    let state = { floor: PARAMS.ceiling }
    for (let i = 0; i < 200; i++) {
      state = nextLevelerFloor(state, 1.0, 0, 1, PARAMS)
    }
    expect(state.floor).toBe(PARAMS.floorMin)
  })

  it('ne corrige rien à pleine charge, même écrêté', () => {
    // Un peu de saturation en charge est voulue, pas une erreur : la
    // correction s'estompe avec l'effort.
    const state = nextLevelerFloor({ floor: PARAMS.ceiling }, 1.0, 1, 1, PARAMS)
    expect(state.floor).toBe(PARAMS.ceiling)
  })

  it('remonte doucement quand la crête redevient propre', () => {
    const bas = { floor: PARAMS.floorMin }
    const apres = nextLevelerFloor(bas, 0.5, 0, 1, PARAMS)
    expect(apres.floor).toBeGreaterThan(bas.floor)
    expect(apres.floor).toBeLessThanOrEqual(PARAMS.floorMin + PARAMS.risePerSecond)
  })

  it('ne remonte jamais au-dessus du plafond', () => {
    let state = { floor: PARAMS.floorMin }
    for (let i = 0; i < 1000; i++) {
      state = nextLevelerFloor(state, 0, 0, 1, PARAMS)
    }
    expect(state.floor).toBe(PARAMS.ceiling)
  })

  it('ne bouge pas entre les deux seuils', () => {
    // Entre 0,85 et 0,98, la crête est jugée correcte : ni écrêtée ni à
    // corriger vers le haut. Le plancher reste où il est.
    const state = nextLevelerFloor({ floor: 15000 }, 0.9, 0, 1, PARAMS)
    expect(state.floor).toBe(15000)
  })
})

describe('levelerTargetFor', () => {
  it('vise le plancher à effort nul', () => {
    expect(levelerTargetFor(8000, 23000, 0)).toBe(8000)
  })

  it('vise le plafond à pleine charge', () => {
    expect(levelerTargetFor(8000, 23000, 1)).toBe(23000)
  })

  it('interpole entre les deux', () => {
    expect(levelerTargetFor(8000, 23000, 0.5)).toBe(15500)
  })

  it('borne un effort hors de 0 à 1', () => {
    expect(levelerTargetFor(8000, 23000, -1)).toBe(8000)
    expect(levelerTargetFor(8000, 23000, 5)).toBe(23000)
  })
})
