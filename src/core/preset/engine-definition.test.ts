import { describe, expect, it } from 'vitest'

import { GM_LS_V8, SUBARU_EJ25 } from './defaults'
import {
  clampEngineDefinition,
  engineDefinitionValues,
  needsEngineRebuild,
} from './engine-definition'
import { ENGINE_FIELDS, ENGINE_VALUE_COUNT, type EngineDefinition } from './schema'

describe('le contrat', () => {
  it('a vingt-neuf places, dont vingt-huit réglables', () => {
    // Le nombre est le contrat lui-même : le C++ lit ce tableau par position.
    // Une place de plus ou de moins et tout ce qui suit se décale.
    expect(ENGINE_VALUE_COUNT).toBe(29)
    expect(ENGINE_FIELDS.filter((field) => field.fromProfile === true)).toHaveLength(1)
  })

  it('n’a pas deux fois la même clé', () => {
    const keys = ENGINE_FIELDS.map((field) => field.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('commence par les cylindres et finit par le collecteur', () => {
    // Les deux bouts de l'ordre, écrits en clair : une relecture distraite qui
    // insérerait un paramètre au début ferait tomber ce test.
    expect(ENGINE_FIELDS[0]?.key).toBe('cylinders')
    expect(ENGINE_FIELDS[ENGINE_VALUE_COUNT - 1]?.key).toBe('headerLength')
    // La gigue garde sa place : un paramètre neuf s'ajoute après elle.
    expect(ENGINE_FIELDS[27]?.key).toBe('inputSampleNoise')
    expect(ENGINE_FIELDS[24]?.key).toBe('revLimit')
  })

  it('décrit chaque clé de la définition, et rien d’autre', () => {
    const reglables = ENGINE_FIELDS.filter((field) => field.fromProfile !== true).map((f) => f.key)
    expect([...reglables].sort()).toEqual(Object.keys(GM_LS_V8).sort())
  })

  it('encadre les deux définitions de référence', () => {
    // Des bornes qui rejetteraient une valeur de référence seraient fausses :
    // c'est de là qu'on part pour régler.
    for (const field of ENGINE_FIELDS) {
      if (field.fromProfile === true) continue
      for (const reference of [GM_LS_V8, SUBARU_EJ25]) {
        const value = reference[field.key as keyof EngineDefinition]
        expect(value, `${field.key} au-dessus du plancher`).toBeGreaterThanOrEqual(field.min)
        expect(value, `${field.key} sous le plafond`).toBeLessThanOrEqual(field.max)
      }
    }
  })
})

describe('engineDefinitionValues', () => {
  it('rend les valeurs dans l’ordre du contrat', () => {
    const values = engineDefinitionValues(GM_LS_V8, 6500)

    expect(values).toHaveLength(ENGINE_VALUE_COUNT)
    expect(values[0]).toBe(8)
    // 3,78 pouces : l'alésage relevé dans le fichier du GM LS. C'est donc un
    // 5,7 litres, et non le LS3 qu'on avait cru lire.
    expect(values[1]).toBe(3.78)
    expect(values[4]).toBe(90)
    expect(values[19]).toBe(29)
    expect(values[25]).toBe(0.2)
    expect(values[27]).toBe(0.05)
  })

  it('prend le rupteur du profil, pas de la définition', () => {
    // Le rupteur se règle dans `engine.redlineRpm`. Deux réglages pour un seul
    // chiffre finiraient par se contredire.
    expect(engineDefinitionValues(GM_LS_V8, 8500)[24]).toBe(8500)
    expect(engineDefinitionValues(SUBARU_EJ25, 7200)[24]).toBe(7200)
  })

  it('sépare bien les deux moteurs de référence', () => {
    const v8 = engineDefinitionValues(GM_LS_V8, 6500)
    const quatre = engineDefinitionValues(SUBARU_EJ25, 6500)

    expect(v8[0]).toBe(8)
    expect(quatre[0]).toBe(4)
    // Le tube primaire, qui fixe la résonance : vingt-neuf pouces contre dix.
    expect(v8[19]).toBe(29)
    expect(quatre[19]).toBe(10)
  })

  it('borne ce qu’elle envoie, quoi qu’on lui donne', () => {
    // Le tableau part directement dans la mémoire du module : une valeur
    // aberrante n'y a rien à faire.
    const abime = { ...GM_LS_V8, chamberVolume: -50, airNoise: 9 }

    const values = engineDefinitionValues(abime, 6500)

    expect(values[4]).toBe(15)
    expect(values[26]).toBe(1)
  })
})

describe('clampEngineDefinition', () => {
  it('laisse les définitions de référence intactes', () => {
    expect(clampEngineDefinition(GM_LS_V8)).toEqual(GM_LS_V8)
    expect(clampEngineDefinition(SUBARU_EJ25)).toEqual(SUBARU_EJ25)
  })

  it('ne connaît que quatre et huit cylindres', () => {
    // L'ordre d'allumage et les angles de manetons sont écrits en dur pour ces
    // deux moteurs-là : un six cylindres ne serait pas un six cylindres.
    expect(clampEngineDefinition({ ...GM_LS_V8, cylinders: 6 }).cylinders).toBe(8)
    expect(clampEngineDefinition({ ...GM_LS_V8, cylinders: 5 }).cylinders).toBe(4)
    expect(clampEngineDefinition({ ...GM_LS_V8, cylinders: 4 }).cylinders).toBe(4)
  })

  it('remplace une valeur non finie par celle du V8 de référence', () => {
    // Zéro serait un moteur sans chambre de combustion : le repli est la
    // référence, pas la borne basse.
    const out = clampEngineDefinition({ ...GM_LS_V8, chamberVolume: Number.NaN })

    expect(out.chamberVolume).toBe(GM_LS_V8.chamberVolume)
  })

  it('complète une définition amputée', () => {
    const out = clampEngineDefinition({ cylinders: 4, bore: 3.898 })

    expect(out.cylinders).toBe(4)
    expect(out.bore).toBe(3.898)
    expect(out.stroke).toBe(GM_LS_V8.stroke)
  })
})

describe('needsEngineRebuild', () => {
  it('rebâtit dès qu’un paramètre du modèle change', () => {
    expect(needsEngineRebuild(GM_LS_V8, { ...GM_LS_V8, chamberVolume: 68 })).toBe(true)
    expect(needsEngineRebuild(GM_LS_V8, SUBARU_EJ25)).toBe(true)
  })

  it('ne rebâtit pas pour les deux bruits', () => {
    // Ils s'écrivent à chaud. Une coupure d'une seconde à chaque cran de curseur
    // rendrait leur réglage impraticable, et c'est à l'oreille qu'ils se
    // trouvent.
    expect(needsEngineRebuild(GM_LS_V8, { ...GM_LS_V8, airNoise: 0.4 })).toBe(false)
    expect(needsEngineRebuild(GM_LS_V8, { ...GM_LS_V8, inputSampleNoise: 0.4 })).toBe(false)
  })

  it('ne rebâtit pas quand rien ne change', () => {
    expect(needsEngineRebuild(GM_LS_V8, { ...GM_LS_V8 })).toBe(false)
  })
})
