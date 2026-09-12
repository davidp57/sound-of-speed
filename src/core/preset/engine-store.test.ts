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
import { createFactoryProfiles, createRoadProfile } from './defaults'
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
    // Deux profils sont livrés : la démonstration, dont la banque est dans
    // l'image, et le V8, dont la banque se dépose sur le serveur. Chacun porte
    // son moteur — on ne vérifie pas les noms un par un, seulement qu'il y a
    // bien correspondance : c'est la règle, le reste est du libellé.
    expect(factoryEngines()).toHaveLength(createFactoryProfiles().length)
    expect(factoryEngines().map((m) => m.name)).toContain('V8')
  })

  it('porte le rupteur du GM LS, qui est le moteur livré', () => {
    const v8 = factoryEngines().find((m) => m.name === 'V8')
    expect(v8?.engine.redlineRpm).toBe(6500)
  })

  it('disent qu\'ils sont livrés', () => {
    for (const moteur of factoryEngines()) expect(moteur.source).toContain('livré')
  })
})

describe('le registre', () => {
  it('rend les moteurs livrés quand rien n\'est enregistré', () => {
    expect(loadEngines().map((m) => m.name)).toContain('V8')
    expect(loadEngines()).toHaveLength(factoryEngines().length)
  })

  it('ajoute un moteur enregistré aux livrés', () => {
    const mien = { ...engineFromProfile(createRoadProfile(), 'Mon V8'), id: 'mien' }
    saveEngines(upsertEngine(factoryEngines(), mien))

    expect(loadEngines().map((m) => m.name)).toContain('Mon V8')
    expect(loadEngines()).toHaveLength(factoryEngines().length + 1)
  })

  it('remplace un moteur livré qu\'on a corrigé, au lieu d\'en montrer deux', () => {
    const livre = factoryEngines().find((m) => m.name === 'V8')!
    const corrige = { ...livre, name: 'V8 retouché' }
    saveEngines(upsertEngine(factoryEngines(), corrige))

    const noms = loadEngines().map((m) => m.name)
    expect(noms).toContain('V8 retouché')
    expect(noms).not.toContain('V8')
    expect(loadEngines()).toHaveLength(factoryEngines().length)
  })

  it('n\'enregistre pas les livrés restés intacts', () => {
    saveEngines(factoryEngines())
    expect(localStorage.getItem('speed.engines.v1')).toBe('[]')
    // Et ils reviennent quand même, puisqu'ils se reconstruisent.
    expect(loadEngines()).toHaveLength(factoryEngines().length)
  })

  it('retire un moteur', () => {
    const mien = { ...engineFromProfile(createRoadProfile(), 'Mon V8'), id: 'mien' }
    const avec = upsertEngine(factoryEngines(), mien)
    expect(removeEngine(avec, 'mien').map((m) => m.name)).not.toContain('Mon V8')
  })

  it('survit à un stockage illisible', () => {
    localStorage.setItem('speed.engines.v1', '{ ceci n’est pas du JSON')
    expect(loadEngines().map((m) => m.name)).toContain('V8')
    expect(loadEngines()).toHaveLength(factoryEngines().length)
  })

  it('écarte une entrée enregistrée qui n\'est pas un moteur', () => {
    localStorage.setItem('speed.engines.v1', JSON.stringify([{ name: 'sans réglages' }]))
    expect(loadEngines()).toHaveLength(factoryEngines().length)
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

  it('peut garder son identifiant, quand c’est le mien qui redescend', () => {
    // Un moteur qui revient de sa propre base est le même moteur : lui donner un
    // identifiant neuf en ferait un double à chaque démarrage, et son prochain
    // dépôt un second fichier sur le serveur.
    const mien = engineFromProfile(createRoadProfile(), 'Mon V8')
    expect(engineFromFile(engineToFile(mien), (origine) => origine).id).toBe(mien.id)
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
