/**
 * Ce qu'on vérifie ici : le portrait ne ment pas, et ne bloque jamais l'écran.
 *
 * Les deux cas qui comptent sont des absences — pas de portrait déposé, pas de
 * `crypto.subtle` — et dans les deux il faut une initiale, pas une image cassée.
 */

import { describe, expect, it } from 'vitest'

import { empreinteDeLAdresse, initialeDe, lienDeGravatar, normaliserPourGravatar } from './avatar'

describe('l’empreinte d’une adresse', () => {
  it('ne dépend ni de la casse ni des espaces', async () => {
    const propre = await empreinteDeLAdresse('david@exemple.fr')
    expect(await empreinteDeLAdresse('  David@Exemple.FR  ')).toBe(propre)
  })

  it('est une empreinte SHA-256 en hexadécimal', async () => {
    // La forme, pas la valeur : ce qui est vérifié ici est qu'on rend bien
    // soixante-quatre chiffres hexadécimaux minuscules, seule écriture que
    // Gravatar accepte dans un chemin.
    expect(await empreinteDeLAdresse('david@exemple.fr')).toMatch(/^[0-9a-f]{64}$/)
  })

  it('ne sait rien quand le navigateur ne sait pas calculer', async () => {
    // Le cas du développement en clair : `crypto.subtle` n'existe pas hors
    // contexte sécurisé. Il ne doit pas y avoir de portrait, et rien de plus.
    expect(await empreinteDeLAdresse('david@exemple.fr', null)).toBeNull()
  })

  it('ne fabrique pas d’empreinte pour une adresse vide', async () => {
    expect(await empreinteDeLAdresse('   ')).toBeNull()
  })
})

describe('le lien du portrait', () => {
  it('demande une erreur plutôt qu’une image inventée', () => {
    // Sans `d=404`, Gravatar rend un motif pour tout le monde, et on ne saurait
    // plus distinguer un portrait déposé d'un portrait fabriqué.
    expect(lienDeGravatar('abc', 64)).toBe('https://www.gravatar.com/avatar/abc?s=64&d=404')
  })
})

describe('l’initiale', () => {
  it('prend la première lettre du nom', () => {
    expect(initialeDe('houle-paisible-47')).toBe('H')
  })

  it('se rabat sur l’adresse quand le nom est vide', () => {
    expect(initialeDe('', 'david@exemple.fr')).toBe('D')
  })

  it('saute ce qui n’est ni lettre ni chiffre', () => {
    expect(initialeDe('  « orage-calme-12 »')).toBe('O')
  })

  it('rend un point d’interrogation plutôt que rien', () => {
    expect(initialeDe('')).toBe('?')
  })
})

describe('la normalisation', () => {
  it('met en minuscules et retire les espaces', () => {
    expect(normaliserPourGravatar('  David@Exemple.FR ')).toBe('david@exemple.fr')
  })
})
