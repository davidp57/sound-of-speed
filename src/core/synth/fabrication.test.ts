import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { createGmLsProfile } from '../preset/defaults'
import { DEFAULT_RENDERING } from './settings'
import {
  cheminDeDefinition,
  commandeDeFabrication,
  definitionDeBanque,
  definitionEnTexte,
  nomDeDefinition,
} from './fabrication'

/**
 * La définition livrée pour le même moteur, lue sur le disque.
 *
 * C'est le test qui compte : la chaîne de fabrication et l'application ne
 * partagent aucun type, et rien d'autre n'empêcherait le format de diverger
 * sans qu'on s'en aperçoive avant de lancer une génération.
 */
const LIVREE = JSON.parse(
  readFileSync('scripts/generate-bank/engines/gm-ls.json', 'utf8'),
) as Record<string, unknown>

describe('la définition de banque', () => {
  it('porte exactement les champs que la chaîne attend', () => {
    const produite = definitionDeBanque(createGmLsProfile(), DEFAULT_RENDERING)

    // Les champs de la définition livrée sont tous produits. L'inverse n'est pas
    // exigé : `redlineRpm` manque à certaines définitions, et l'ajouter ne casse
    // rien.
    for (const champ of Object.keys(LIVREE)) {
      expect(produite, `champ « ${champ} » absent de ce qui est produit`).toHaveProperty(
        champ,
      )
    }
  })

  it('porte les mêmes réglages de prise que la définition livrée', () => {
    const produite = definitionDeBanque(createGmLsProfile(), DEFAULT_RENDERING)
    const priseLivree = LIVREE['bank'] as Record<string, unknown>

    for (const [champ, valeur] of Object.entries(priseLivree)) {
      expect(produite.bank[champ], `réglage de prise « ${champ} »`).toBe(valeur)
    }
  })

  it('reprend la banque du profil, pour le dossier comme pour le moteur', () => {
    const profil = createGmLsProfile()

    const produite = definitionDeBanque(profil, DEFAULT_RENDERING)

    expect(produite.sampleDir).toBe(profil.sampleDir)
    expect(produite.engine).toBe(profil.sampleDir)
  })

  it('prend le limiteur sur la couche du rupteur, pas sur le rupteur', () => {
    // Ce sont deux choses : le rupteur plafonne le moteur joué, le limiteur dit
    // à quel régime la prise a été enregistrée — plus haut. Les confondre donne
    // une banque qui s'arrête plus bas que celle qu'on écoute.
    const profil = createGmLsProfile()
    profil.engine.redlineRpm = 6500

    const produite = definitionDeBanque(profil, DEFAULT_RENDERING)

    expect(produite.redlineRpm).toBe(6500)
    expect(produite.bank['limiterRpm']).toBe(6950)
  })

  it('retombe sur le rupteur quand le profil n’a pas de couche de rupteur', () => {
    const profil = createGmLsProfile()
    profil.layers = profil.layers.filter((couche) => couche.role !== 'limiter')
    profil.engine.redlineRpm = 7200

    expect(definitionDeBanque(profil, DEFAULT_RENDERING).bank['limiterRpm']).toBe(7200)
  })

  it('emporte l’échappement qu’on écoute', () => {
    const produite = definitionDeBanque(createGmLsProfile(), {
      ...DEFAULT_RENDERING,
      exhaustResponse: 'smooth_39',
    })

    expect(produite.exhaustResponse).toBe('smooth_39')
  })

  it('arrondit les régimes : la chaîne ne lit pas des décimales de tour', () => {
    const profil = createGmLsProfile()
    profil.engine.idleRpm = 750.4

    expect(definitionDeBanque(profil, DEFAULT_RENDERING).idleRpm).toBe(750)
  })
})

describe('le fichier et la commande', () => {
  it('nomme le fichier d’après la banque, pas d’après le profil', () => {
    const profil = createGmLsProfile()
    profil.name = 'Mon V8 à moi'

    expect(nomDeDefinition(profil)).toBe('gm-ls.json')
  })

  it('retombe sur le fichier livré pour un profil livré', () => {
    expect(cheminDeDefinition(createGmLsProfile())).toBe(
      'scripts/generate-bank/engines/gm-ls.json',
    )
  })

  it('assainit un nom de banque qui n’en serait pas un', () => {
    const profil = createGmLsProfile()
    profil.sampleDir = 'Écho du V8 !'

    expect(nomDeDefinition(profil)).toBe('echo-du-v8.json')
  })

  it('rend une commande qui compile avant de générer', () => {
    const lignes = commandeDeFabrication(createGmLsProfile()).split('\n')

    expect(lignes).toHaveLength(2)
    expect(lignes[0]).toContain('build-generator')
    expect(lignes[1]).toContain('scripts/generate-bank/engines/gm-ls.json')
  })

  it('n’emploie aucun enchaînement propre à un terminal', () => {
    // `&&` ne s'écrit pas pareil partout, et la ligne doit se coller telle
    // quelle dans celui qu'on a sous la main.
    expect(commandeDeFabrication(createGmLsProfile())).not.toContain('&&')
  })

  it('rend une définition relisible telle quelle', () => {
    const texte = definitionEnTexte(createGmLsProfile(), DEFAULT_RENDERING)

    expect(texte.endsWith('\n')).toBe(true)
    expect(JSON.parse(texte)).toEqual(
      definitionDeBanque(createGmLsProfile(), DEFAULT_RENDERING),
    )
  })
})
