import { describe, expect, it } from 'vitest'

import { authHeader, byteLength, hasCredentials } from './put'

/**
 * L'en-tête d'authentification était vérifié depuis le module de dépôt d'une
 * trace, qui a disparu avec le panneau des traces. Il vit ici, avec la
 * fonction : une erreur d'encodage donnerait un refus qu'on mettrait sur le
 * compte d'un mot de passe faux.
 */
describe('authHeader', () => {
  it('encode le couple nom et mot de passe', () => {
    expect(authHeader({ user: 'depot', password: 'secret' })).toBe(`Basic ${btoa('depot:secret')}`)
  })

  it('accepte un mot de passe accentué', () => {
    // `btoa` seul échouerait, et l'échec ressemblerait à un refus du serveur.
    expect(() => authHeader({ user: 'dépôt', password: 'clé-é' })).not.toThrow()
  })
})

describe('hasCredentials', () => {
  it('refuse un nom vide ou fait d’espaces', () => {
    expect(hasCredentials({ user: '', password: 'x' })).toBe(false)
    expect(hasCredentials({ user: '   ', password: 'x' })).toBe(false)
  })

  it('refuse un mot de passe vide', () => {
    expect(hasCredentials({ user: 'depot', password: '' })).toBe(false)
  })

  it('accepte un couple complet', () => {
    expect(hasCredentials({ user: 'depot', password: 'x' })).toBe(true)
  })
})

describe('byteLength', () => {
  it('compte les octets et non les caractères — un accent en vaut deux', () => {
    expect(byteLength('eee')).toBe(3)
    expect(byteLength('ééé')).toBe(6)
  })
})
