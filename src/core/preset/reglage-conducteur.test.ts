import { describe, expect, it } from 'vitest'

import { createRoadProfile } from './defaults'
import { assembleProfile } from './assemble'
import { sportinessOf, responsivenessOf } from './character'
import {
  avecReglage,
  estVide,
  lireReglage,
  rapportsAffiches,
  reactiviteAffichee,
  SANS_REGLAGE,
  temperamentAffiche,
  type ReglageConducteur,
} from './reglage-conducteur'
import type { Profile } from './schema'

/** Un profil livré, tel que l'atelier le dépose. */
function livre(): Profile {
  return createRoadProfile()
}

describe('la couche du conducteur', () => {
  it('ne touche à rien quand elle est vide', () => {
    const profil = livre()

    expect(avecReglage(profil, SANS_REGLAGE)).toEqual(profil)
  })

  it('laisse le profil livré intact', () => {
    const profil = livre()
    const avant = structuredClone(profil)

    avecReglage(profil, { temperament: 1, reactivite: 1, rapports: 4 })

    expect(profil).toEqual(avant)
  })

  it('pose le tempérament demandé, et lui seul', () => {
    const profil = livre()

    const compose = avecReglage(profil, { ...SANS_REGLAGE, temperament: 1 })

    expect(sportinessOf(compose)).toBeCloseTo(1, 1)
    // La réactivité, qui touche le signal, n'a pas bougé.
    expect(responsivenessOf(compose)).toBeCloseTo(responsivenessOf(profil), 5)
  })

  it('pose le nombre de rapports demandé', () => {
    const compose = avecReglage(livre(), { ...SANS_REGLAGE, rapports: 4 })

    expect(compose.drivetrain.gearRatios).toHaveLength(4)
    // Les tables indexées par rapport suivent : sans cela un rapport ajouté
    // hériterait du seuil de son prédécesseur.
    expect(compose.drivetrain.upshiftRpm).toHaveLength(3)
  })

  it('redimensionne avant de poser le tempérament', () => {
    // Si l'ordre s'inversait, le tempérament réglerait des cases que le
    // redimensionnement redistribuerait ensuite.
    const compose = avecReglage(livre(), { temperament: 1, reactivite: null, rapports: 4 })

    expect(compose.drivetrain.upshiftRpm).toHaveLength(3)
    expect(sportinessOf(compose)).toBeCloseTo(1, 1)
  })

  it('borne ce qui sort des limites plutôt que de rendre un profil absurde', () => {
    const compose = avecReglage(livre(), { temperament: 12, reactivite: -3, rapports: 99 })

    expect(sportinessOf(compose)).toBeLessThanOrEqual(1)
    expect(compose.drivetrain.gearRatios.length).toBeLessThanOrEqual(9)
  })

  it('survit à une version corrigée du même profil', () => {
    // C'est tout l'objet de la couche : l'atelier redépose, le réglage tient.
    const reglage: ReglageConducteur = { temperament: 1, reactivite: null, rapports: null }
    const corrige = livre()
    corrige.engine.idleRpm = 900

    const compose = avecReglage(corrige, reglage)

    expect(compose.engine.idleRpm).toBe(900)
    expect(sportinessOf(compose)).toBeCloseTo(1, 1)
  })
})

describe('ce que les curseurs affichent', () => {
  it('montre ce que porte le profil livré tant qu’on n’y a pas touché', () => {
    const profil = livre()

    expect(temperamentAffiche(profil, SANS_REGLAGE)).toBeCloseTo(sportinessOf(profil), 5)
    expect(reactiviteAffichee(profil, SANS_REGLAGE)).toBeCloseTo(
      responsivenessOf(profil),
      5,
    )
    expect(rapportsAffiches(profil, SANS_REGLAGE)).toBe(profil.drivetrain.gearRatios.length)
  })

  it('montre la couche dès qu’elle porte une position', () => {
    const profil = livre()

    expect(temperamentAffiche(profil, { ...SANS_REGLAGE, temperament: 0.25 })).toBe(0.25)
    expect(rapportsAffiches(profil, { ...SANS_REGLAGE, rapports: 5 })).toBe(5)
  })

  it('montre zéro comme une position, pas comme une absence', () => {
    // Le piège du `||` : un tempérament tout à gauche vaut zéro, et zéro est un
    // choix. Il ne doit pas retomber sur ce que porte le profil.
    const profil = livre()

    expect(temperamentAffiche(profil, { ...SANS_REGLAGE, temperament: 0 })).toBe(0)
  })
})

describe('ce qui a été rangé', () => {
  it('se relit tel quel', () => {
    expect(lireReglage({ temperament: 0.7, reactivite: 0.2, rapports: 6 })).toEqual({
      temperament: 0.7,
      reactivite: 0.2,
      rapports: 6,
    })
  })

  it('écarte ce qui n’a pas la bonne forme sans rien perdre du reste', () => {
    expect(lireReglage({ temperament: 'beaucoup', reactivite: 0.5 })).toEqual({
      temperament: null,
      reactivite: 0.5,
      rapports: null,
    })
  })

  it('rend une couche vide sur un contenu abîmé', () => {
    expect(lireReglage(null)).toEqual(SANS_REGLAGE)
    expect(lireReglage('rien')).toEqual(SANS_REGLAGE)
    expect(estVide(lireReglage(undefined))).toBe(true)
  })
})

describe('assembler puis composer', () => {
  it('donne le même profil qu’une composition sur le profil assemblé', () => {
    // La couche se pose sur ce que le moteur emploie, pas sur une entité isolée.
    const profil = livre()
    const assemble = assembleProfile(profil, {})

    expect(avecReglage(assemble, { ...SANS_REGLAGE, rapports: 5 }).drivetrain.gearRatios)
      .toHaveLength(5)
  })
})
