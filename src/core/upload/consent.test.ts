import { describe, expect, it } from 'vitest'

import { kindsAt, sendsAutomatically } from './consent'

/**
 * Tests de l'accord.
 *
 * Ce qui se vérifie est une promesse faite à l'utilisateur, et non une
 * commodité : rien ne part par défaut, et la trace — qui porte la conduite à la
 * cadence du GPS — ne part qu'au cran qu'on lui a annoncé.
 */

describe('l’accord de remontée', () => {
  it('ne laisse rien partir par défaut', () => {
    expect(kindsAt('none')).toEqual([])
  })

  it('laisse partir le journal, les relevés et les profils au minimum', () => {
    expect(kindsAt('minimal')).toEqual(['journal', 'measurement', 'profile'])
  })

  it('n’envoie la trace qu’au cran de la conduite', () => {
    expect(sendsAutomatically('minimal', 'trace')).toBe(false)
    expect(sendsAutomatically('extended', 'trace')).toBe(true)
  })

  it('n’envoie rien du tout quand l’accord est coupé', () => {
    expect(sendsAutomatically('none', 'journal')).toBe(false)
    expect(sendsAutomatically('none', 'profile')).toBe(false)
  })
})
