import { describe, expect, it } from 'vitest'

import { DETAIL_DUREE_MS, detailActif, eteintA, resteMs } from './detail'

/**
 * Ce que ces tests tiennent : le réglage vit vingt-quatre heures glissantes, et
 * le cas qui a fixé cette règle — activé tard le soir, encore actif après
 * minuit — est vérifié sans attendre un jour.
 *
 * L'instant est reçu, jamais lu : c'est ce qui rend l'épreuve possible.
 */

/** Un instant lisible dans les messages d'échec. */
function le(jour: number, heure: number, minute = 0): number {
  return Date.UTC(2026, 8, jour, heure, minute)
}

describe('le journal détaillé', () => {
  it('est éteint tant qu on ne l a pas allumé', () => {
    expect(detailActif(null, le(15, 12))).toBe(false)
    expect(resteMs(null, le(15, 12))).toBe(0)
    expect(eteintA(null, le(15, 12))).toBeNull()
  })

  it('est actif dès qu on l allume', () => {
    const allume = le(15, 12)
    expect(detailActif(allume, allume)).toBe(true)
  })

  it('survit à minuit', () => {
    // Le cas qui a fixé la règle. David : « si je mets l'option le soir à 11h30
    // et que je roule jusque 0h30, ça va se désactiver en plein run ».
    const allume = le(15, 23, 30)
    expect(detailActif(allume, le(16, 0, 30))).toBe(true)
    expect(detailActif(allume, le(16, 12))).toBe(true)
  })

  it('s éteint vingt-quatre heures après, à l heure près', () => {
    const allume = le(15, 23, 30)
    expect(detailActif(allume, le(16, 23, 29))).toBe(true)
    expect(detailActif(allume, le(16, 23, 30))).toBe(false)
    expect(detailActif(allume, le(16, 23, 31))).toBe(false)
  })

  it('dit ce qu il lui reste', () => {
    const allume = le(15, 12)
    expect(resteMs(allume, le(15, 12))).toBe(DETAIL_DUREE_MS)
    expect(resteMs(allume, le(15, 18))).toBe(18 * 60 * 60 * 1000)
    expect(resteMs(allume, le(17, 0))).toBe(0)
  })

  it('dit à quelle heure il s éteindra', () => {
    const allume = le(15, 23, 30)
    expect(eteintA(allume, le(16, 0, 30))).toBe(le(16, 23, 30))
  })

  it('ne se rend pas permanent par une horloge déréglée', () => {
    // L'horloge d'un navigateur se règle, parfois de plusieurs heures. Une date
    // d'activation dans le futur éteint le réglage plutôt que de le prolonger.
    const futur = le(20, 12)
    expect(detailActif(futur, le(15, 12))).toBe(false)
  })

  it('ne croit pas une date absurde', () => {
    expect(detailActif(Number.NaN, le(15, 12))).toBe(false)
    expect(detailActif(Number.POSITIVE_INFINITY, le(15, 12))).toBe(false)
  })
})
