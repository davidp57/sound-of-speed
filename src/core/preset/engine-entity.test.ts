import { describe, expect, it } from 'vitest'

import {
  applyEngine,
  engineFromProfile,
  matchesEngine,
  profilesUsing,
  refreshProfiles,
} from './engine-entity'
import { createDefaultProfile, createRoadProfile } from './defaults'
import type { Profile } from './schema'

/**
 * Tests du moteur comme entité.
 *
 * Ce qui se vérifie ici : qu'un moteur emporte tout ce qui fait son son et
 * **rien d'autre**. Le piège est de trop prendre — la boîte, le signal de
 * vitesse, le nom du profil —, et il se serait vu tard : charger un moteur
 * aurait alors changé la façon de passer les rapports, ce que personne n'aurait
 * relié au choix du moteur.
 */

describe('le moteur extrait d\'un profil', () => {
  it('emporte les réglages, la banque, les couches et le mixage', () => {
    const profil = createRoadProfile()
    const moteur = engineFromProfile(profil)

    expect(moteur.engine).toEqual(profil.engine)
    expect(moteur.sampleDir).toBe(profil.sampleDir)
    expect(moteur.layers).toEqual(profil.layers)
    expect(moteur.mix).toEqual(profil.mix)
  })

  it("emporte les pétarades : c'est son échappement qui claque", () => {
    const profil = createRoadProfile()
    profil.feel.backfire.intensity = 0.42
    expect(engineFromProfile(profil).backfire.intensity).toBe(0.42)
  })

  it('porte un nom et dit d\'où il vient', () => {
    const moteur = engineFromProfile(createRoadProfile())
    expect(moteur.name).toBe('Route')
    expect(moteur.source).toContain('Route')
  })

  it('accepte un nom qui ne soit pas celui du profil', () => {
    expect(engineFromProfile(createRoadProfile(), 'V8 de route').name).toBe('V8 de route')
  })

  it('ne prend ni la boîte, ni le signal de vitesse, ni le caractère', () => {
    const moteur = engineFromProfile(createRoadProfile()) as unknown as Record<string, unknown>
    expect(moteur.drivetrain).toBeUndefined()
    expect(moteur.speed).toBeUndefined()
    expect(moteur.feel).toBeUndefined()
  })

  it('recopie plutôt que de partager : corriger le moteur ne touche pas le profil', () => {
    const profil = createRoadProfile()
    const moteur = engineFromProfile(profil)
    moteur.engine.idleRpm = 1234
    moteur.layers[0]!.gain = 42
    expect(profil.engine.idleRpm).not.toBe(1234)
    expect(profil.layers[0]?.gain).not.toBe(42)
  })
})

describe('appliquer un moteur à un profil', () => {
  it('pose ses valeurs et note lequel', () => {
    const cible = createRoadProfile()
    const moteur = engineFromProfile(createDefaultProfile(), 'Sport')

    const applique = applyEngine(cible, moteur)

    expect(applique.engineId).toBe(moteur.id)
    expect(applique.engine).toEqual(moteur.engine)
    expect(applique.mix).toEqual(moteur.mix)
    expect(applique.sampleDir).toBe(moteur.sampleDir)
  })

  it('ne renomme pas le profil et ne le dépingle pas', () => {
    const cible: Profile = { ...createRoadProfile(), favorite: true }
    const applique = applyEngine(cible, engineFromProfile(createDefaultProfile(), 'Sport'))

    expect(applique.name).toBe('Route')
    expect(applique.favorite).toBe(true)
    expect(applique.id).toBe(cible.id)
  })

  it('ne change pas la façon de passer les rapports', () => {
    // Le défaut qu'on verrouille : un moteur qui emporterait la boîte ferait
    // changer les seuils de passage en changeant de son, et rien à l'écran ne
    // dirait pourquoi.
    const cible = createRoadProfile()
    const applique = applyEngine(cible, engineFromProfile(createDefaultProfile(), 'Sport'))

    expect(applique.drivetrain).toEqual(cible.drivetrain)
    expect(applique.feel.kickdown).toEqual(cible.feel.kickdown)
    expect(applique.feel.shiftJolt).toEqual(cible.feel.shiftJolt)
  })

  it('emporte en revanche ses pétarades, qui sont sa voix', () => {
    const cible = createRoadProfile()
    const source = createDefaultProfile()
    source.feel.backfire.intensity = 0.77
    const applique = applyEngine(cible, engineFromProfile(source, 'Sport'))

    expect(applique.feel.backfire.intensity).toBe(0.77)
    // Et le profil de départ n'a pas bougé : c'est une copie.
    expect(cible.feel.backfire.intensity).not.toBe(0.77)
  })

  it('ne change pas les réglages de mesure de la vitesse', () => {
    const cible = createRoadProfile()
    const applique = applyEngine(cible, engineFromProfile(createDefaultProfile(), 'Sport'))
    expect(applique.speed).toEqual(cible.speed)
  })

  it('recopie les couches : corriger le profil ne touche pas le moteur enregistré', () => {
    const moteur = engineFromProfile(createDefaultProfile(), 'Sport')
    const applique = applyEngine(createRoadProfile(), moteur)
    applique.layers[0]!.gain = 99
    expect(moteur.layers[0]?.gain).not.toBe(99)
  })
})

describe('savoir si un profil sonne encore comme son moteur', () => {
  it('reconnaît un profil qui vient de le charger', () => {
    const moteur = engineFromProfile(createDefaultProfile(), 'Sport')
    expect(matchesEngine(applyEngine(createRoadProfile(), moteur), moteur)).toBe(true)
  })

  it('voit un profil qui a été affiné depuis', () => {
    const moteur = engineFromProfile(createDefaultProfile(), 'Sport')
    const affine = applyEngine(createRoadProfile(), moteur)
    affine.mix.loadReliefDb += 2
    expect(matchesEngine(affine, moteur)).toBe(false)
  })

  it('voit un changement de banque', () => {
    const moteur = engineFromProfile(createDefaultProfile(), 'Sport')
    const autre = { ...applyEngine(createRoadProfile(), moteur), sampleDir: 'ailleurs' }
    expect(matchesEngine(autre, moteur)).toBe(false)
  })

  it('voit une couche retirée', () => {
    const moteur = engineFromProfile(createDefaultProfile(), 'Sport')
    const applique = applyEngine(createRoadProfile(), moteur)
    applique.layers = applique.layers.slice(1)
    expect(matchesEngine(applique, moteur)).toBe(false)
  })

  it('tolère un écart de calcul, pas un écart de réglage', () => {
    // Un profil qui a fait l'aller-retour par un lien de partage porte des
    // valeurs arrondies : un milliardième d'écart ne change pas de moteur.
    const moteur = engineFromProfile(createDefaultProfile(), 'Sport')
    const applique = applyEngine(createRoadProfile(), moteur)
    applique.engine.idleRpm += 1e-12
    expect(matchesEngine(applique, moteur)).toBe(true)
  })
})

describe('la correction d\'un moteur se répercute', () => {
  it('touche les profils qui le désignent, et eux seuls', () => {
    const moteur = engineFromProfile(createDefaultProfile(), 'Sport')
    const desigant = applyEngine({ ...createRoadProfile(), id: 'a' }, moteur)
    const autre = { ...createRoadProfile(), id: 'b' }

    const corrige = { ...moteur, mix: { ...moteur.mix, loadReliefDb: 9 } }
    const [premier, second] = refreshProfiles([desigant, autre], corrige)

    expect(premier?.mix.loadReliefDb).toBe(9)
    expect(second?.mix.loadReliefDb).toBe(autre.mix.loadReliefDb)
  })

  it('ne touche pas un profil qui joue la même banque sans désigner le moteur', () => {
    // Deux profils peuvent jouer la même banque sans être le même moteur : c'est
    // la désignation qui fait le lien, pas la ressemblance.
    const moteur = engineFromProfile(createDefaultProfile(), 'Sport')
    const jumeau = { ...createDefaultProfile(), id: 'jumeau' }
    delete jumeau.engineId

    const corrige = { ...moteur, mix: { ...moteur.mix, loadReliefDb: 9 } }
    const [repris] = refreshProfiles([jumeau], corrige)

    expect(repris?.mix.loadReliefDb).toBe(jumeau.mix.loadReliefDb)
  })

  it('liste les profils qui désignent un moteur', () => {
    const moteur = engineFromProfile(createDefaultProfile(), 'Sport')
    const a = applyEngine({ ...createRoadProfile(), id: 'a' }, moteur)
    const b = applyEngine({ ...createRoadProfile(), id: 'b' }, moteur)
    const c = { ...createRoadProfile(), id: 'c' }

    expect(profilesUsing([a, b, c], moteur.id).map((p) => p.id)).toEqual(['a', 'b'])
  })
})
