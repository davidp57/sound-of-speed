import { beforeEach, describe, expect, it } from 'vitest'

import {
  engineFromFile,
  engineToFile,
  factoryEngines,
  loadEngines,
  removeEngine,
  saveEngines,
  upsertEngine,
} from './engine-store'
import { engineFromProfile } from './engine-entity'
import { createRoadProfile } from './defaults'
import { ProfileImportError } from './store'

/**
 * Tests du registre des moteurs.
 *
 * Ce qui se vérifie : qu'un moteur corrigé remplace le sien au lieu de
 * s'ajouter à côté — deux entrées du même nom dans une liste sont le plus sûr
 * moyen de choisir la mauvaise —, et qu'un moteur reçu de quelqu'un d'autre
 * n'écrase pas le mien parce que les deux sont nés du même profil d'usine.
 */

/**
 * Faux stockage local, sur le modèle des tests de profils.
 *
 * Le cœur se vérifie sous Node, sans navigateur : il n'y a donc pas de
 * `localStorage`, et un module qui en dépend doit s'en voir donner un.
 */
function fakeStorage() {
  const entries = new Map<string, string>()
  return {
    getItem: (key: string): string | null => entries.get(key) ?? null,
    setItem: (key: string, value: string): void => void entries.set(key, value),
    removeItem: (key: string): void => void entries.delete(key),
    clear: (): void => entries.clear(),
    key: () => null,
    length: 0,
  }
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    value: fakeStorage(),
    configurable: true,
    writable: true,
  })
})

describe('les moteurs livrés', () => {
  it('font un moteur par profil d\'usine', () => {
    const livres = factoryEngines()
    // Un seul profil est livré depuis le 10 septembre 2026 — le V8 —, donc un
    // seul moteur livré. Leur différence tenait aux seuils de passage, qui ont
    // déménagé vers le tempérament.
    expect(livres.map((m) => m.name)).toEqual(['V8'])
  })

  it('porte le rupteur du GM LS, qui est le moteur livré', () => {
    expect(factoryEngines()[0]?.engine.redlineRpm).toBe(6500)
  })

  it('disent qu\'ils sont livrés', () => {
    expect(factoryEngines()[0]?.source).toContain('livré')
  })
})

describe('le registre', () => {
  it('rend les moteurs livrés quand rien n\'est enregistré', () => {
    expect(loadEngines().map((m) => m.name)).toEqual(['V8'])
  })

  it('ajoute un moteur enregistré aux livrés', () => {
    const mien = { ...engineFromProfile(createRoadProfile(), 'Mon V8'), id: 'mien' }
    saveEngines(upsertEngine(factoryEngines(), mien))

    expect(loadEngines().map((m) => m.name)).toContain('Mon V8')
    expect(loadEngines()).toHaveLength(2)
  })

  it('remplace un moteur livré qu\'on a corrigé, au lieu d\'en montrer deux', () => {
    const livre = factoryEngines()[0]!
    const corrige = { ...livre, name: 'V8 retouché' }
    saveEngines(upsertEngine(factoryEngines(), corrige))

    const noms = loadEngines().map((m) => m.name)
    expect(noms).toContain('V8 retouché')
    expect(noms).not.toContain('V8')
    expect(loadEngines()).toHaveLength(1)
  })

  it('n\'enregistre pas les livrés restés intacts', () => {
    saveEngines(factoryEngines())
    expect(localStorage.getItem('speed.engines.v1')).toBe('[]')
    // Et il revient quand même, puisqu'il se reconstruit.
    expect(loadEngines()).toHaveLength(1)
  })

  it('retire un moteur', () => {
    const mien = { ...engineFromProfile(createRoadProfile(), 'Mon V8'), id: 'mien' }
    const avec = upsertEngine(factoryEngines(), mien)
    expect(removeEngine(avec, 'mien').map((m) => m.name)).not.toContain('Mon V8')
  })

  it('survit à un stockage illisible', () => {
    localStorage.setItem('speed.engines.v1', '{ ceci n’est pas du JSON')
    expect(loadEngines().map((m) => m.name)).toEqual(['V8'])
  })

  it('écarte une entrée enregistrée qui n\'est pas un moteur', () => {
    localStorage.setItem('speed.engines.v1', JSON.stringify([{ name: 'sans réglages' }]))
    expect(loadEngines()).toHaveLength(1)
  })
})

describe('un moteur dans un fichier', () => {
  it('fait l\'aller-retour sans rien perdre', () => {
    const mien = engineFromProfile(createRoadProfile(), 'Mon V8')
    const relu = engineFromFile(engineToFile(mien), () => 'neuf')

    expect(relu.name).toBe('Mon V8')
    expect(relu.engine).toEqual(mien.engine)
    expect(relu.layers).toEqual(mien.layers)
    expect(relu.mix).toEqual(mien.mix)
  })

  it('reçoit un identifiant neuf, pour ne pas écraser le mien', () => {
    const mien = engineFromProfile(createRoadProfile(), 'Mon V8')
    expect(engineFromFile(engineToFile(mien), () => 'neuf').id).toBe('neuf')
  })

  it('refuse un fichier qui n\'est pas du JSON', () => {
    expect(() => engineFromFile('pas du json', () => 'x')).toThrow(ProfileImportError)
  })

  it('refuse un JSON qui ne décrit pas un moteur', () => {
    expect(() => engineFromFile('{"version":1,"engine":{"name":"vide"}}', () => 'x')).toThrow(
      ProfileImportError,
    )
  })

  it('accepte un moteur écrit sans son enveloppe', () => {
    const mien = engineFromProfile(createRoadProfile(), 'Mon V8')
    expect(engineFromFile(JSON.stringify(mien), () => 'x').name).toBe('Mon V8')
  })
})
