import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { createDemoProfile } from './defaults'
import { fromFile } from './store'

/**
 * La banque de démonstration est la seule versionnée avec l'application, et
 * elle a un métier : qu'un dépôt fraîchement cloné fasse du son. Si son profil
 * cessait de passer l'import, ou désignait des fichiers absents, l'application
 * resterait muette chez celui qui la découvre — et un chargement raté ne se
 * remarque qu'en allant lire la télémétrie.
 */
describe('la banque de démonstration', () => {
  const profile = fromFile(readFileSync('public/audio/demo/profil.json', 'utf8'))

  it('passe l’import de l’application', () => {
    expect(profile.sampleDir).toBe('demo')
    expect(profile.soundSource).toBe('prerendered')
    expect(profile.engine.cylinders).toBe(4)
    expect(profile.layers.length).toBeGreaterThan(4)
  })

  it('désigne des fichiers qui sont là', () => {
    for (const couche of profile.layers) {
      expect(() => readFileSync(`public/audio/demo/${couche.file}`)).not.toThrow()
    }
  })

  it('couvre les deux familles et le ralenti', () => {
    const roles = new Set(profile.layers.map((couche) => couche.role))
    expect(roles).toContain('on')
    expect(roles).toContain('off')
    expect(roles).toContain('idle')
  })
})

/**
 * Le profil livré et la banque livrée doivent rester d'accord.
 *
 * Ils vivent à deux endroits — la définition avec le code, les échantillons avec
 * les autres échantillons — et rien n'empêche mécaniquement de régénérer l'un
 * sans l'autre. Le jour où ça arrive, l'application démarre sur un profil d'usine
 * qui désigne des fichiers absents : silence, et un message qu'il faut aller
 * chercher en télémétrie.
 */
describe('le profil d’usine de démonstration', () => {
  it('désigne la banque livrée, fichier par fichier', () => {
    const usine = createDemoProfile()
    expect(usine.sampleDir).toBe('demo')
    for (const couche of usine.layers) {
      expect(() => readFileSync(`public/audio/demo/${couche.file}`)).not.toThrow()
    }
  })

  it('dit qu’il est généré à l’avance, et décrit un quatre cylindres', () => {
    expect(createDemoProfile().soundSource).toBe('prerendered')
    expect(createDemoProfile().engine.cylinders).toBe(4)
  })
})
