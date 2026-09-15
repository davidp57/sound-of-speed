import { describe, expect, it } from 'vitest'

import {
  adresseARetenir,
  estUneAdresseDeRemplacement,
  lireLeJeton,
} from './jeton-tiers'

/** Un jeton d'identité, fabriqué comme un fournisseur le signerait. */
function jeton(charge: Record<string, unknown>): string {
  const partie = (valeur: unknown): string =>
    Buffer.from(JSON.stringify(valeur), 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
  return `${partie({ alg: 'RS256' })}.${partie(charge)}.signature-non-verifiee`
}

describe('lire le jeton du fournisseur', () => {
  it('rend l’adresse et le portrait', () => {
    const lu = lireLeJeton(
      jeton({ email: 'David@Example.com', picture: 'https://exemple/photo.jpg' }),
    )

    expect(lu.email).toBe('david@example.com')
    expect(lu.image).toBe('https://exemple/photo.jpg')
  })

  it('n’invente rien quand le jeton manque ou ne tient pas debout', () => {
    for (const cas of [null, undefined, '', 'pas-un-jeton', 'deux.morceaux']) {
      expect(lireLeJeton(cas), String(cas)).toEqual({ email: null, image: null })
    }
  })

  it('n’invente rien quand la charge n’est pas un objet', () => {
    expect(lireLeJeton(jeton([] as unknown as Record<string, unknown>)).email).toBe(null)
  })

  it('écarte une adresse qui n’en est pas une', () => {
    expect(lireLeJeton(jeton({ email: 'david' })).email).toBe(null)
    expect(lireLeJeton(jeton({ email: 42 })).email).toBe(null)
  })

  it('écarte une adresse de remplacement rendue par le fournisseur', () => {
    // La retenir remplacerait un faux par un autre.
    expect(lireLeJeton(jeton({ email: 'x@anonymous.placeholder.invalid' })).email).toBe(null)
  })

  it('n’accepte un portrait qu’en https', () => {
    expect(lireLeJeton(jeton({ picture: 'http://exemple/p.jpg' })).image).toBe(null)
    expect(lireLeJeton(jeton({ picture: '/p.jpg' })).image).toBe(null)
  })

  it('lit une charge dont la longueur ne tombe pas juste en base64', () => {
    // Le remplissage `=` est retiré des jetons : sans le remettre, une charge
    // sur deux se décode de travers.
    const lu = lireLeJeton(jeton({ email: 'a@b.co' }))

    expect(lu.email).toBe('a@b.co')
  })
})

describe('l’adresse à retenir après un rattachement', () => {
  it('remplace une adresse de remplacement par celle du fournisseur', () => {
    expect(
      adresseARetenir('tksw8@anonymous.placeholder.invalid', {
        email: 'david@example.com',
        image: null,
      }),
    ).toBe('david@example.com')
  })

  it('ne touche jamais à une adresse choisie', () => {
    // Le tiers est une preuve de plus, jamais un remplacement : quelqu'un qui
    // s'est enregistré avec son adresse garde la sienne.
    expect(
      adresseARetenir('moi@chez-moi.fr', { email: 'autre@example.com', image: null }),
    ).toBe(null)
  })

  it('ne change rien quand le fournisseur ne donne pas d’adresse', () => {
    expect(
      adresseARetenir('tksw8@anonymous.placeholder.invalid', { email: null, image: null }),
    ).toBe(null)
  })

  it('ne change rien quand le compte n’a pas d’adresse du tout', () => {
    // Pas d'adresse n'est pas une adresse de remplacement : on ne sait pas ce
    // qui l'a mise à null, et l'écraser en aveugle n'est pas notre affaire.
    expect(adresseARetenir(null, { email: 'david@example.com', image: null })).toBe(null)
  })
})

describe('reconnaître une adresse de remplacement', () => {
  it('reconnaît le domaine réservé, quelle que soit la casse', () => {
    expect(estUneAdresseDeRemplacement('x@anonymous.placeholder.invalid')).toBe(true)
    expect(estUneAdresseDeRemplacement('X@ANONYMOUS.PLACEHOLDER.INVALID')).toBe(true)
  })

  it('laisse passer une vraie adresse', () => {
    expect(estUneAdresseDeRemplacement('david@example.com')).toBe(false)
    expect(estUneAdresseDeRemplacement(null)).toBe(false)
  })
})
