import { describe, expect, it } from 'vitest'

import { byteLength } from './put'

describe('byteLength', () => {
  it('compte les octets et non les caractères — un accent en vaut deux', () => {
    expect(byteLength('eee')).toBe(3)
    expect(byteLength('ééé')).toBe(6)
  })
})
