import { describe, expect, it } from 'vitest'

import { blocksToRender, EMPTY_TALLY, realtimeFactor, tallyUnderrun } from './reserve'

describe('blocksToRender', () => {
  it('ne rend rien quand la réserve est pleine', () => {
    expect(blocksToRender(12000, 12000, 1024)).toBe(0)
    expect(blocksToRender(13000, 12000, 1024)).toBe(0)
  })

  it('remonte la réserve au bloc supérieur', () => {
    // 12000 - 10000 = 2000 échantillons manquants, soit deux blocs de 1024.
    expect(blocksToRender(10000, 12000, 1024)).toBe(2)
  })

  it('ne rend pas plus que le plafond, réserve vide', () => {
    expect(blocksToRender(0, 1_000_000, 128, 4)).toBe(4)
  })
})

describe('tallyUnderrun', () => {
  it('compte un seul creux pour une suite de tours vides', () => {
    let tally = EMPTY_TALLY
    tally = tallyUnderrun(tally, 128)
    tally = tallyUnderrun(tally, 128)
    tally = tallyUnderrun(tally, 128)
    expect(tally.count).toBe(1)
    expect(tally.frames).toBe(384)
  })

  it('rouvre un creux après un tour servi', () => {
    let tally = tallyUnderrun(EMPTY_TALLY, 128)
    tally = tallyUnderrun(tally, 0)
    tally = tallyUnderrun(tally, 64)
    expect(tally.count).toBe(2)
    expect(tally.frames).toBe(192)
    expect(tally.open).toBe(true)
  })

  it('ne compte rien quand tout est servi', () => {
    expect(tallyUnderrun(EMPTY_TALLY, 0)).toEqual(EMPTY_TALLY)
  })
})

describe('realtimeFactor', () => {
  it('rend le rapport entre le son produit et le temps de calcul', () => {
    expect(realtimeFactor(0.25, 1)).toBe(4)
  })

  it('rend zéro plutôt que l’infini quand rien n’a été rendu', () => {
    expect(realtimeFactor(0, 1)).toBe(0)
    expect(realtimeFactor(1, 0)).toBe(0)
  })
})
