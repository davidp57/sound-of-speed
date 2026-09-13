/**
 * Ce qu'on vérifie ici : une étiquette est du français juste, et le reste quand
 * on enrichit le vocabulaire.
 *
 * Le tirage combine un nom et un adjectif pris séparément. Un seul adjectif qui
 * s'accorde en genre suffirait donc à produire « houle sauvageon » un jour sur
 * mille, sans que personne le voie passer : c'est le genre de faute qu'un test
 * attrape mieux qu'une relecture.
 */

import { describe, expect, it } from 'vitest'

import {
  combienDEtiquettes,
  FORME_DUNE_ETIQUETTE,
  tirerUneEtiquette,
  VOCABULAIRE,
} from './etiquette'

describe('le vocabulaire', () => {
  it('n’a que des adjectifs qui ne s’accordent pas en genre', () => {
    // La marque en français est le `e` final : `calme`, `sauvage`, `mauve`
    // s'écrivent pareil des deux genres. C'est la règle qui tient la liste.
    const accordables = VOCABULAIRE.adjectifs.filter((mot) => !mot.endsWith('e'))
    expect(accordables).toEqual([])
  })

  it('n’a aucun accent, pour que l’étiquette se recopie telle quelle', () => {
    const tous = [...VOCABULAIRE.noms, ...VOCABULAIRE.adjectifs]
    expect(tous.filter((mot) => !/^[a-z]+$/.test(mot))).toEqual([])
  })

  it('ne dit pas deux fois le même mot', () => {
    for (const liste of [VOCABULAIRE.noms, VOCABULAIRE.adjectifs]) {
      expect(liste.length).toBe(new Set(liste).size)
    }
  })

  it('nomme assez de comptes pour qu’une collision reste une curiosité', () => {
    expect(combienDEtiquettes()).toBeGreaterThan(500_000)
  })
})

describe('tirer une étiquette', () => {
  it('rend deux mots et deux chiffres', () => {
    for (let essai = 0; essai < 200; essai += 1) {
      expect(tirerUneEtiquette()).toMatch(FORME_DUNE_ETIQUETTE)
    }
  })

  it('tire dans tout le vocabulaire, des deux bouts', () => {
    // Un tirage qui rate la dernière entrée d'une liste est l'erreur classique
    // du `Math.floor` ; les deux bornes sont donc vérifiées.
    expect(tirerUneEtiquette(() => 0)).toBe(
      `${VOCABULAIRE.noms[0]}-${VOCABULAIRE.adjectifs[0]}-10`,
    )

    const presqueUn = () => 0.999_999
    const dernierNom = VOCABULAIRE.noms[VOCABULAIRE.noms.length - 1]
    const dernierAdjectif = VOCABULAIRE.adjectifs[VOCABULAIRE.adjectifs.length - 1]
    expect(tirerUneEtiquette(presqueUn)).toBe(`${dernierNom}-${dernierAdjectif}-99`)
  })

  it('ne rend pas toujours la même chose', () => {
    const tirees = new Set(Array.from({ length: 50 }, () => tirerUneEtiquette()))
    expect(tirees.size).toBeGreaterThan(40)
  })
})
