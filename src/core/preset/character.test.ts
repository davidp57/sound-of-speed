import { describe, expect, it } from 'vitest'

import {
  MAX_GEARS,
  resizeGearTables,
  responsivenessOf,
  shiftDelaysFor,
  sportinessOf,
  upshiftTableFor,
} from './character'
import { createDefaultProfile, createRoadProfile } from './defaults'
import { Engine } from '../engine/engine'
import { Gearbox } from '../drivetrain/gearbox'
import type { Profile } from './schema'

/**
 * Tests du caractère relu et redistribué.
 *
 * Ce qui se vérifie ici n'est pas une liste de valeurs — elles relèvent du goût
 * — mais deux propriétés : les lois s'**inversent** (un profil rend le
 * tempérament qui l'a produit), et les tables **suivent** le nombre de rapports
 * sans laisser de valeur étrangère au profil.
 */

const route = createRoadProfile()
const sport = createDefaultProfile()

/** Régime dans un rapport donné, à une vitesse donnée. */
function rpmInGear(profile: Profile, gear: number, kmh: number): number {
  const { gearRatios, finalDrive, wheelRadiusM } = profile.drivetrain
  return Engine.kinematicRpm(kmh, (gearRatios[gear] ?? 1) * finalDrive, wheelRadiusM)
}

/** Régime auquel la boîte finit par croiser, à vitesse tenue. */
function cruiseRpm(profile: Profile, kmh: number): number {
  const gearbox = new Gearbox(profile.drivetrain, profile.engine, profile.feel)
  const inGear = (gear: number) => rpmInGear(profile, gear, kmh)
  let gear = 0
  for (let frame = 0; frame * (1 / 60) <= 90; frame += 1) {
    gear = gearbox.tick(1 / 60, {
      rpmInGear: inGear,
      atStandstill: false,
      load: 0.5,
      kmh,
      accelMs2: 0,
    }).gear
  }
  return inGear(gear)
}

describe('le caractère se relit dans le profil', () => {
  it('lit les deux profils livrés à leur place', () => {
    // Mesuré : Route rend 0,225 et Sport 0,800. Ce ne sont pas des valeurs
    // voulues — aucun des deux profils n'a été construit par ces lois — mais
    // l'ordre, lui, est celui qu'on attend, et l'écart est franc.
    expect(sportinessOf(route)).toBeCloseTo(0.225, 2)
    expect(sportinessOf(sport)).toBeCloseTo(0.8, 2)
    expect(sportinessOf(route)).toBeLessThan(sportinessOf(sport))
  })

  it('place les deux profils livrés au milieu de la réactivité', () => {
    // Par construction : le milieu du curseur est le réglage qui a servi
    // jusqu'ici. Route lit 0,500 malgré un lissage de charge un peu plus long
    // que Sport, la médiane écartant cette seule lecture.
    expect(responsivenessOf(route)).toBeCloseTo(0.5, 3)
    expect(responsivenessOf(sport)).toBeCloseTo(0.5, 3)
  })
})

describe('les régimes de passage suivent le tempérament', () => {
  it('monte la rampe entière avec le tempérament', () => {
    const calme = upshiftTableFor(6, 6500, 0)
    const sportif = upshiftTableFor(6, 6500, 1)

    for (let i = 0; i < calme.length; i += 1) {
      expect(sportif[i]!).toBeGreaterThan(calme[i]!)
    }
    // Mesuré à 6500 tr/min de rupteur : 2730 → 3250 au plus calme, 4420 → 5330
    // au plus sportif. Le rupteur reste hors d'atteinte des deux côtés.
    expect(calme[0]).toBe(2730)
    expect(sportif[sportif.length - 1]).toBe(5330)
    for (const rpm of [...calme, ...sportif]) expect(rpm).toBeLessThan(6500)
  })

  it('donne une rampe croissante, un seuil par passage', () => {
    for (const count of [2, 3, 6, MAX_GEARS]) {
      const table = upshiftTableFor(count, 6500, 0.5)
      expect(table).toHaveLength(Math.max(1, count - 1))
      for (let i = 1; i < table.length; i += 1) {
        expect(table[i]!).toBeGreaterThan(table[i - 1]!)
      }
    }
  })
})

describe('les temporisations suivent la réactivité', () => {
  it('raccourcit au plus nerveux, allonge au plus pépère', () => {
    // Mesuré, à tempérament équilibré : 0,48 s au plus pépère, 0,16 s au plus
    // nerveux, 0,32 s au milieu — la valeur des profils livrés.
    expect(shiftDelaysFor(6, 0.5, 0)[0]).toBe(0.48)
    expect(shiftDelaysFor(6, 0.5, 0.5)[0]).toBe(0.32)
    expect(shiftDelaysFor(6, 0.5, 1)[0]).toBe(0.16)
  })

  it('les garde inégales, et jamais nulles', () => {
    for (const sportiness of [0, 0.5, 1]) {
      for (const responsiveness of [0, 0.5, 1]) {
        const delays = shiftDelaysFor(6, sportiness, responsiveness)
        // Des valeurs identiques donnent une boîte qui sonne comme un
        // métronome : c'est l'écart qui rend le passage crédible.
        expect(new Set(delays).size).toBeGreaterThan(1)
        for (const delay of delays) expect(delay).toBeGreaterThan(0)
      }
    }
  })
})

describe('les tables suivent le nombre de rapports', () => {
  it('rend tel quel un profil dont le nombre de rapports ne change pas', () => {
    expect(resizeGearTables(route, 6)).toBe(route)
    expect(resizeGearTables(sport, 6)).toBe(sport)
  })

  it('ne laisse aucune valeur orpheline, en ajoutant comme en retirant', () => {
    for (const count of [3, 4, 5, 7, 8]) {
      const { drivetrain } = resizeGearTables(route, count)
      expect(drivetrain.upshiftRpm).toHaveLength(count - 1)
      expect(drivetrain.shiftDelaysS).toHaveLength(count)
    }
  })

  it('donne au rapport ajouté un seuil cohérent avec ses voisins', () => {
    // Sept rapports là où le profil en a six : le seuil neuf ne peut pas
    // hériter de son prédécesseur, il s'intercale.
    const { upshiftRpm } = resizeGearTables(route, 7).drivetrain

    expect(upshiftRpm).toHaveLength(6)
    for (let i = 1; i < upshiftRpm.length; i += 1) {
      expect(upshiftRpm[i]!).toBeGreaterThan(upshiftRpm[i - 1]!)
    }
    // Mesuré sur Route : 3110, 3232, 3353, 3475, 3596, 3718 tr/min. Aucun
    // doublon, donc aucun seuil recopié d'un voisin.
    expect(new Set(upshiftRpm).size).toBe(upshiftRpm.length)
    expect(upshiftRpm[0]).toBe(3110)
    expect(upshiftRpm[5]).toBe(3718)
  })

  it('donne des temporisations du profil, et non la valeur de repli', () => {
    // Sans redimensionnement, la boîte se rabattait sur 0,8 s : une valeur qui
    // n'appartient à aucun profil.
    const { shiftDelaysS } = resizeGearTables(route, 8).drivetrain

    expect(shiftDelaysS).toHaveLength(8)
    for (const delay of shiftDelaysS) expect(delay).not.toBe(0.8)
    expect(new Set(shiftDelaysS).size).toBeGreaterThan(1)
    // Mesuré : 0,39 et 0,67 s en alternance, pour un profil qui lit 0,225 de
    // tempérament et 0,5 de réactivité.
    expect(shiftDelaysS[0]).toBe(0.39)
    expect(shiftDelaysS[1]).toBe(0.67)
  })

  it('garde une croisière tenable dans le rapport le plus long', () => {
    // Le redimensionnement ne touche ni au pont ni aux démultiplications : le
    // régime en dernier rapport à 110 km/h ne bouge donc pas. Mesuré sur
    // Route : 2356 tr/min avant comme après, et la boîte croise bien là.
    const avant = rpmInGear(route, 5, 110)
    const apres = resizeGearTables(route, 8)

    expect(rpmInGear(apres, 5, 110)).toBeCloseTo(avant, 3)
    const croisiere = cruiseRpm(apres, 110)
    expect(croisiere).toBeGreaterThan(apres.drivetrain.cruiseMinRpm)
    expect(croisiere).toBeLessThan(apres.engine.redlineRpm * 0.6)
  })

  it('borne un nombre de rapports absurde', () => {
    expect(resizeGearTables(route, 0).drivetrain.shiftDelaysS).toHaveLength(2)
    expect(resizeGearTables(route, 99).drivetrain.shiftDelaysS).toHaveLength(MAX_GEARS)
  })
})
