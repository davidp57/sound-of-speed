import { describe, expect, it } from 'vitest'
import {
  ENGINE_LIBRARY,
  ORIGIN_MAX_GAPS,
  closestLibraryEngine,
  libraryEngine,
} from './engine-library'
import { ENGINE_FIELDS } from './schema'

// Les clés qu'une définition doit porter : tout le contrat sauf le rupteur, qui
// vient du profil et vit dans `redlineRpm`.
const DEFINITION_KEYS = ENGINE_FIELDS.filter((field) => field.fromProfile !== true).map(
  (field) => field.key,
)

describe('bibliothèque de moteurs', () => {
  it('donne un identifiant unique à chaque moteur', () => {
    const ids = ENGINE_LIBRARY.map((entry) => entry.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('retrouve un moteur par son identifiant', () => {
    for (const entry of ENGINE_LIBRARY) {
      expect(libraryEngine(entry.id)).toBe(entry)
    }
    expect(libraryEngine('moteur-qui-n-existe-pas')).toBeUndefined()
  })

  it.each(ENGINE_LIBRARY.map((entry) => [entry.id, entry] as const))(
    '%s porte les vingt-sept réglages du contrat',
    (_id, entry) => {
      const keys = Object.keys(entry.definition).sort()
      expect(keys).toEqual([...DEFINITION_KEYS].sort())
    },
  )

  it.each(ENGINE_LIBRARY.map((entry) => [entry.id, entry] as const))(
    '%s tient dans les bornes des réglages',
    (_id, entry) => {
      const definition = entry.definition as unknown as Record<string, number>
      for (const field of ENGINE_FIELDS) {
        if (field.fromProfile === true) continue
        const value = definition[field.key]
        expect(Number.isFinite(value)).toBe(true)
        expect(value).toBeGreaterThanOrEqual(field.min)
        expect(value).toBeLessThanOrEqual(field.max)
      }
    },
  )

  it.each(ENGINE_LIBRARY.map((entry) => [entry.id, entry] as const))(
    '%s annonce un rupteur dans les bornes, et sa source',
    (_id, entry) => {
      const revLimit = ENGINE_FIELDS.find((field) => field.key === 'revLimit')
      expect(revLimit).toBeDefined()
      expect(entry.redlineRpm).toBeGreaterThanOrEqual(revLimit!.min)
      expect(entry.redlineRpm).toBeLessThanOrEqual(revLimit!.max)
      expect(entry.source).toMatch(/^assets\/engines\/.+\.mr$/)
      expect(entry.label.length).toBeGreaterThan(0)
    },
  )

  // Quatre ou huit, et rien entre les deux : `probe.cpp` n'a que ces deux
  // constructeurs, et une définition hors de ce choix serait ramenée à l'un des
  // deux sans qu'on l'entende venir.
  it('ne propose que des architectures que le C++ sait construire', () => {
    for (const entry of ENGINE_LIBRARY) {
      expect([4, 8]).toContain(entry.definition.cylinders)
    }
  })
})

describe('closestLibraryEngine', () => {
  it('reconnaît un moteur chargé tel quel, sans écart', () => {
    const gm = libraryEngine('gm-ls')!
    const near = closestLibraryEngine(gm.definition, gm.redlineRpm)
    expect(near?.engine.id).toBe('gm-ls')
    expect(near?.gaps).toBe(0)
  })

  it('désigne le moteur d’origine d’une définition retouchée', () => {
    // Le cas réel : David avait chargé le 454 puis affiné trois valeurs au
    // banc. « Chevrolet 454, retouché » est plus utile que « réglé à la main ».
    const gros = libraryEngine('chevrolet-454')!
    const retouche = {
      ...gros.definition,
      chamberVolume: gros.definition.chamberVolume + 3,
      intakeRunnerVolume: gros.definition.intakeRunnerVolume + 5,
    }
    const near = closestLibraryEngine(retouche, gros.redlineRpm)
    expect(near?.engine.id).toBe('chevrolet-454')
    expect(near?.gaps).toBe(2)
  })

  it('compte le rupteur comme un écart', () => {
    const gm = libraryEngine('gm-ls')!
    expect(closestLibraryEngine(gm.definition, gm.redlineRpm + 500)?.gaps).toBe(1)
  })

  it('mesure sans juger : l’écart peut dépasser le seuil', () => {
    // La fonction rend toujours le plus proche ; c'est l'écran qui décide
    // qu'au-delà de `ORIGIN_MAX_GAPS` plus rien ne dit d'où l'on est parti.
    const gm = libraryEngine('gm-ls')!
    const ailleurs = Object.fromEntries(
      Object.keys(gm.definition).map((key) => [key, 1]),
    ) as unknown as typeof gm.definition
    const near = closestLibraryEngine(ailleurs, 1)
    expect(near).not.toBeNull()
    expect(near!.gaps).toBeGreaterThan(ORIGIN_MAX_GAPS)
  })
})

describe('rendu des moteurs', () => {
  it('donne un rendu à chaque moteur', () => {
    for (const entry of ENGINE_LIBRARY) {
      expect(entry.rendering.levelerTarget).toBeGreaterThan(0)
      expect(entry.rendering.convolverMix).toBeGreaterThanOrEqual(0)
    }
  })

  it('livre le GM LS avec les valeurs relevées par David', () => {
    const gm = libraryEngine('gm-ls')!
    expect(gm.rendering.convolverMix).toBe(0.45)
  })

  it('ne fait pas voyager le volume avec le moteur', () => {
    // Il l'a fait, et changer de moteur remettait le volume à chaque fois : on
    // comparait alors deux timbres à deux niveaux. Il vit maintenant dans les
    // réglages du banc.
    for (const entry of ENGINE_LIBRARY) {
      expect(entry.rendering).not.toHaveProperty('volume')
    }
  })

  it('vise une crête qui laisse de la marge sous le plafond', () => {
    // Mesuré au ralenti sur le V8, à volume un : 1,26 % d'échantillons écrêtés
    // en moyenne et 2,73 % en pointe à trente-deux mille, contre 0,02 % et
    // 0,39 % à seize mille. David l'entendait — « ça part en écrêtage ».
    for (const entry of ENGINE_LIBRARY) {
      expect(entry.rendering.levelerTarget).toBeLessThanOrEqual(16000)
    }
  })
})
