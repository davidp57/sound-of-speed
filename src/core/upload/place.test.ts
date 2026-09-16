/**
 * Ce que l'application comprend de la place, et ce qu'elle refuse d'inventer.
 *
 * Le cas qui compte est le serveur muet : une version d'avant ne pose pas ces
 * en-têtes, et l'écran ne doit alors rien afficher plutôt qu'annoncer « libre ».
 */

import { describe, expect, it } from 'vitest'

import { lirePlace, partPrise } from './place'

/** Une réponse avec les en-têtes qu'on lui donne. */
function reponse(entetes: Record<string, string>, code = 201): Response {
  return new Response('', { status: code, headers: entetes })
}

describe('lire la place dans une réponse', () => {
  it('rend l’état et les deux chiffres', () => {
    const place = lirePlace(
      reponse({
        'Speed-Place': 'bientot',
        'Speed-Place-Octets': '190840832',
        'Speed-Place-Plafond': '262144000',
      }),
    )

    expect(place).toEqual({ etat: 'bientot', octets: 190840832, plafond: 262144000 })
  })

  it('rend rien quand le serveur ne dit rien', () => {
    // Un serveur d'avant : l'écran n'affiche alors pas de place, au lieu d'en
    // inventer une qui serait fausse.
    expect(lirePlace(reponse({}))).toBeNull()
  })

  it('rend rien sur un état qu’elle ne connaît pas', () => {
    // Un serveur plus récent qui inventerait un quatrième mot : on ne le traduit
    // pas au hasard.
    const place = lirePlace(
      reponse({
        'Speed-Place': 'deborde',
        'Speed-Place-Octets': '10',
        'Speed-Place-Plafond': '100',
      }),
    )

    expect(place).toBeNull()
  })

  it('rend rien quand les chiffres n’en sont pas', () => {
    const place = lirePlace(
      reponse({
        'Speed-Place': 'libre',
        'Speed-Place-Octets': 'beaucoup',
        'Speed-Place-Plafond': '100',
      }),
    )

    expect(place).toBeNull()
  })

  it('dit « plein » sur un refus, quels que soient les chiffres', () => {
    // Le serveur annonce la place — au-delà de 95 %, donc « rotation » —, et le
    // code dit le refus. C'est le client qui les réunit : ce que l'écran doit
    // dire est qu'on ne dépose plus.
    const place = lirePlace(
      reponse(
        {
          'Speed-Place': 'rotation',
          'Speed-Place-Octets': '270000000',
          'Speed-Place-Plafond': '262144000',
        },
        507,
      ),
      true,
    )

    expect(place).toEqual({ etat: 'plein', octets: 270000000, plafond: 262144000 })
  })

  it('dit « plein » même sans en-têtes : un refus reste un refus', () => {
    expect(lirePlace(reponse({}, 507), true)).toEqual({ etat: 'plein', octets: 0, plafond: 0 })
  })
})

describe('la part prise', () => {
  it('se lit en fraction, et ne dépasse jamais un', () => {
    expect(partPrise({ etat: 'bientot', octets: 50, plafond: 100 })).toBe(0.5)
    // Au-delà du plafond — le dépassement est temporaire, mais il existe.
    expect(partPrise({ etat: 'rotation', octets: 120, plafond: 100 })).toBe(1)
  })

  it('vaut un quand le plafond est inconnu, plutôt que de diviser par zéro', () => {
    expect(partPrise({ etat: 'plein', octets: 0, plafond: 0 })).toBe(1)
  })
})
