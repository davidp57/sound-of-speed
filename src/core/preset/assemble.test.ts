import { describe, expect, it } from 'vitest'

import { assembleProfile, partsFor } from './assemble'
import { engineFromProfile } from './engine-entity'
import { gearboxFromProfile } from './gearbox-entity'
import { DEFAULT_REAL_CAR } from './real-car'
import { createDefaultProfile, createRoadProfile } from './defaults'

/**
 * Tests de l'assemblage.
 *
 * Ce qui se vérifie : que les sections assemblées portent exactement les noms
 * et les valeurs qu'attend la chaîne. C'est ce qui permet de vider le profil
 * sans toucher aux trois cent trente-six points d'appel qui les lisent — et si
 * l'assemblage se trompe, aucun de ces points ne s'en plaindra : le son sera
 * simplement faux.
 *
 * Et qu'une pièce absente laisse la section telle quelle, ce qui rend la
 * transition possible.
 */

describe('assembler un profil', () => {
  it('pose le moteur désigné', () => {
    const moteur = engineFromProfile(createDefaultProfile(), 'Sport')
    const assemble = assembleProfile(createRoadProfile(), { engine: moteur })

    expect(assemble.engine).toEqual(moteur.engine)
    expect(assemble.mix).toEqual(moteur.mix)
    expect(assemble.sampleDir).toBe(moteur.sampleDir)
    expect(assemble.engineId).toBe(moteur.id)
  })

  it('pose la boîte désignée', () => {
    const boite = gearboxFromProfile(createDefaultProfile(), 'Sport')
    const assemble = assembleProfile(createRoadProfile(), { gearbox: boite })

    expect(assemble.drivetrain.finalDrive).toBe(boite.drivetrain.finalDrive)
    expect(assemble.feel.shiftJolt).toEqual(boite.shiftJolt)
    expect(assemble.gearboxId).toBe(boite.id)
  })

  it('pose le signal de la voiture réelle, en écrasant celui du profil', () => {
    // Le signal décrit la voiture et non le profil : un profil reçu d'ailleurs
    // n'impose jamais sa mesure à celui qui le reçoit.
    const profil = createRoadProfile()
    profil.speed.accelWindowMs = 4000
    const voiture = { ...DEFAULT_REAL_CAR, accelWindowMs: 600 }

    expect(assembleProfile(profil, { realCar: voiture }).speed.accelWindowMs).toBe(600)
  })

  it('ne laisse pas le modèle de voiture entrer dans le signal', () => {
    const assemble = assembleProfile(createRoadProfile(), {
      realCar: { ...DEFAULT_REAL_CAR, model: 'Tesla Model 3' },
    })
    expect((assemble.speed as unknown as Record<string, unknown>).model).toBeUndefined()
  })

  it('assemble les trois pièces sans qu\'elles se recouvrent', () => {
    const moteur = engineFromProfile(createDefaultProfile(), 'Sport')
    const boite = gearboxFromProfile(createRoadProfile(), 'Route')
    const voiture = { ...DEFAULT_REAL_CAR, springOmega: 20 }

    const assemble = assembleProfile(createRoadProfile(), {
      engine: moteur,
      gearbox: boite,
      realCar: voiture,
    })

    // Le moteur de Sport, la boîte de Route, le signal de l'appareil.
    expect(assemble.engine.redlineRpm).toBe(moteur.engine.redlineRpm)
    expect(assemble.drivetrain.finalDrive).toBe(boite.drivetrain.finalDrive)
    expect(assemble.speed.springOmega).toBe(20)
  })

  it('garde les pétarades du moteur, que la boîte ne touche pas', () => {
    const moteur = engineFromProfile(createDefaultProfile(), 'Sport')
    const boite = gearboxFromProfile(createRoadProfile(), 'Route')
    const assemble = assembleProfile(createRoadProfile(), { engine: moteur, gearbox: boite })
    // Les pétarades suivent le moteur ; ici le profil de départ et le moteur
    // sont Route et Sport, et c'est le profil qui les porte encore.
    expect(assemble.feel.backfire).toBeDefined()
  })

  it('laisse une section telle quelle quand sa pièce est absente', () => {
    const profil = createRoadProfile()
    const assemble = assembleProfile(profil, {})
    expect(assemble).toEqual(profil)
  })

  it('garde le nom, l\'identifiant et l\'épinglage du profil', () => {
    const profil = { ...createRoadProfile(), favorite: true }
    const assemble = assembleProfile(profil, {
      engine: engineFromProfile(createDefaultProfile(), 'Sport'),
      gearbox: gearboxFromProfile(createDefaultProfile(), 'Sport'),
    })
    expect(assemble.id).toBe(profil.id)
    expect(assemble.name).toBe('Route')
    expect(assemble.favorite).toBe(true)
  })
})

describe('trouver les pièces d\'un profil', () => {
  const moteur = engineFromProfile(createDefaultProfile(), 'Sport')
  const boite = gearboxFromProfile(createRoadProfile(), 'Route')

  it('trouve ce que le profil désigne', () => {
    const profil = { ...createRoadProfile(), engineId: moteur.id, gearboxId: boite.id }
    const pieces = partsFor(profil, [moteur], [boite], DEFAULT_REAL_CAR)

    expect(pieces.engine?.name).toBe('Sport')
    expect(pieces.gearbox?.name).toBe('Route')
    expect(pieces.realCar).toEqual(DEFAULT_REAL_CAR)
  })

  it('traite une désignation introuvable comme une absence', () => {
    // Un moteur supprimé ne doit pas rendre le profil muet : il le laisse jouer
    // ce qu'il porte encore.
    const profil = { ...createRoadProfile(), engineId: 'disparu' }
    expect(partsFor(profil, [], [], DEFAULT_REAL_CAR).engine).toBeUndefined()
  })

  it('ne cherche rien quand le profil ne désigne rien', () => {
    const pieces = partsFor(createRoadProfile(), [moteur], [boite], DEFAULT_REAL_CAR)
    expect(pieces.engine).toBeUndefined()
    expect(pieces.gearbox).toBeUndefined()
  })

  it('rend toujours la voiture réelle : elle ne se désigne pas', () => {
    expect(partsFor(createRoadProfile(), [], [], DEFAULT_REAL_CAR).realCar).toBeDefined()
  })
})
