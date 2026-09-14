import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  createFactoryProfiles,
  createBmwI6Profile,
  createGmLsLongHeaderProfile,
  createGmLsProfile,
  createSubaruEj25Profile,
} from './defaults'
import { fromFile } from './store'

/**
 * Les banques livrées sont les seules versionnées avec l'application, et elles
 * ont un métier : qu'un dépôt fraîchement cloné fasse du son. Si leur profil
 * cessait de passer l'import, ou désignait des fichiers absents, l'application
 * resterait muette chez celui qui la découvre — et un chargement raté ne se
 * remarque qu'en allant lire la télémétrie.
 *
 * Il y en avait une, la démonstration. Il y en a trois depuis le 14 septembre
 * 2026 : David les a écoutées et les a jugées livrables.
 */
const BANQUES = ['gm-ls', 'gm-ls-long-header', 'bmw-i6-3l', 'subaru-ej25'] as const

describe.each(BANQUES)('la banque livrée %s', (banque) => {
  const profile = fromFile(readFileSync(`public/audio/${banque}/profil.json`, 'utf8'))

  it('passe l’import de l’application', () => {
    expect(profile.sampleDir).toBe(banque)
    expect(profile.soundSource).toBe('prerendered')
    expect(profile.layers.length).toBeGreaterThan(4)
  })

  it('désigne des fichiers qui sont là', () => {
    for (const couche of profile.layers) {
      expect(() => readFileSync(`public/audio/${banque}/${couche.file}`)).not.toThrow()
    }
  })

  it('est en FLAC, sans reste de WAV', () => {
    // Les prises sortent du banc en WAV et sont compressées ensuite. Un profil
    // qui désigne encore des `.wav` est un transcodage à moitié fait : les
    // fichiers sont là, mais ce sont les lourds.
    for (const couche of profile.layers) {
      expect(couche.file).toMatch(/\.flac$/)
    }
  })

  it('couvre les deux familles et le ralenti', () => {
    const roles = new Set(profile.layers.map((couche) => couche.role))
    expect(roles).toContain('on')
    expect(roles).toContain('off')
    expect(roles).toContain('idle')
  })

  it('emporte le moteur qui a fait son son', () => {
    // Les vingt-neuf nombres du contrat, et non la définition de banque : c'est
    // ce qui permet de rejouer la même banque en son direct, et de la refaire.
    expect(profile.engineDefinition?.cylinders).toBe(profile.engine.cylinders)
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
describe('les profils d’usine', () => {
  it.each([
    ['gm-ls', createGmLsProfile],
    ['gm-ls-long-header', createGmLsLongHeaderProfile],
    ['bmw-i6-3l', createBmwI6Profile],
    ['subaru-ej25', createSubaruEj25Profile],
  ])('%s désigne la banque livrée, fichier par fichier', (banque, creer) => {
    const usine = creer()
    expect(usine.sampleDir).toBe(banque)
    expect(usine.soundSource).toBe('prerendered')
    for (const couche of usine.layers) {
      expect(() => readFileSync(`public/audio/${banque}/${couche.file}`)).not.toThrow()
    }
  })

  it('commence par le V8 croisé, qui est le premier son entendu', () => {
    const livres = createFactoryProfiles()
    expect(livres[0]?.id).toBe('gm-ls')
    expect(livres[0]?.favorite).toBe(true)
    expect(livres.map((p) => p.id)).toEqual([
      'gm-ls',
      'gm-ls-long-header',
      'bmw-i6-3l',
      'subaru-ej25',
    ])
  })

  it('ne livre que des banques qui sont dans le dépôt', () => {
    // Le profil V8 livré désignait `v8-musclecar`, une prise sur une vraie voiture
    // qu'on n'a pas le droit de redistribuer : il était donc muet chez qui
    // découvrait le projet. Aucun profil livré ne doit plus désigner une banque
    // absente de l'image.
    for (const livre of createFactoryProfiles()) {
      expect(() =>
        readFileSync(`public/audio/${livre.sampleDir}/profil.json`),
      ).not.toThrow()
    }
  })
})
