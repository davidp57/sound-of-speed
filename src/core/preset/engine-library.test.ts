import { describe, expect, it } from 'vitest'
import { ENGINE_LIBRARY, libraryEngine } from './engine-library'
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
