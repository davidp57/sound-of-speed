import { describe, expect, it } from 'vitest'

import {
  createDefaultProfile,
  createFactoryProfiles,
  createRoadProfile,
  finalDriveFor,
  rpmAtSpeed,
} from './defaults'
import { Engine } from '../engine/engine'
import { Gearbox } from '../drivetrain/gearbox'
import type { Profile } from './schema'

/**
 * Tests des profils livrés et des deux conversions vitesse/régime.
 *
 * Ces deux fonctions sont réciproques, et c'est ce qui permet de régler la
 * transmission par un chiffre parlant : on donne la vitesse au rupteur dans le
 * dernier rapport, et le pont s'en déduit. Si elles cessaient d'être
 * réciproques, le curseur mentirait sans que rien ne le signale.
 */

describe('rpmAtSpeed et finalDriveFor', () => {
  it('sont réciproques', () => {
    const pont = finalDriveFor(6500, 210, 0.72, 0.33)

    expect(rpmAtSpeed(210, 0.72, pont, 0.33)).toBeCloseTo(6500, 6)
  })

  it('donnent le même régime que le moteur', () => {
    // Deux chemins pour le même calcul : celui de l'écran de configuration et
    // celui du moteur. Ils ne doivent pas diverger.
    const attendu = Engine.kinematicRpm(130, 0.72 * 3.7, 0.33)

    expect(rpmAtSpeed(130, 0.72, 3.7, 0.33)).toBeCloseTo(attendu, 6)
  })

  it('varient dans le bon sens', () => {
    // Un pont plus long fait tourner moins vite à vitesse égale.
    expect(rpmAtSpeed(130, 0.72, 3.7, 0.33)).toBeLessThan(rpmAtSpeed(130, 0.72, 4.5, 0.33))
    // Une roue plus grande aussi.
    expect(rpmAtSpeed(130, 0.72, 3.7, 0.36)).toBeLessThan(rpmAtSpeed(130, 0.72, 3.7, 0.33))
  })
})

describe('profils livrés', () => {
  it('en livre deux, dont un calibré pour la route', () => {
    const profiles = createFactoryProfiles()

    expect(profiles.map((p) => p.id)).toEqual(['route', 'procar'])
    expect(profiles.map((p) => p.name)).toEqual(['Route', 'Sport'])
  })

  it('rend des copies neuves à chaque appel', () => {
    const premier = createFactoryProfiles()
    premier[0]!.engine.redlineRpm = 42

    expect(createFactoryProfiles()[0]?.engine.redlineRpm).not.toBe(42)
  })

  it('place la croisière du profil Route bien plus bas que celle du profil Sport', () => {
    // C'est la raison d'être du profil Route : à 130 km/h en dernier rapport,
    // 2780 tr/min au lieu de 3390. Le README annonce ces deux chiffres.
    const regime = (p: Profile) => {
      const { gearRatios, finalDrive, wheelRadiusM } = p.drivetrain
      return rpmAtSpeed(130, gearRatios[gearRatios.length - 1] ?? 1, finalDrive, wheelRadiusM)
    }

    expect(regime(createRoadProfile())).toBeCloseTo(2780, -2)
    expect(regime(createDefaultProfile())).toBeCloseTo(3390, -2)
  })

  it('donne à chaque profil des seuils de passage cohérents avec son rupteur', () => {
    for (const profile of createFactoryProfiles()) {
      for (const rpm of profile.drivetrain.upshiftRpm) {
        expect(rpm).toBeGreaterThan(profile.engine.idleRpm)
        expect(rpm).toBeLessThan(profile.engine.redlineRpm)
      }
      expect(profile.engine.softLimitRpm).toBeLessThanOrEqual(profile.engine.redlineRpm)
      expect(profile.mix.crossfadeLowRpm).toBeLessThan(profile.mix.crossfadeHighRpm)
    }
  })

  it('donne une temporisation par rapport, et un seuil par passage', () => {
    for (const profile of createFactoryProfiles()) {
      const count = profile.drivetrain.gearRatios.length
      expect(profile.drivetrain.shiftDelaysS).toHaveLength(count)
      expect(profile.drivetrain.upshiftRpm).toHaveLength(count - 1)
    }
  })

  it('étage les rapports du plus court au plus long', () => {
    for (const profile of createFactoryProfiles()) {
      const ratios = profile.drivetrain.gearRatios
      for (let i = 1; i < ratios.length; i += 1) {
        expect(ratios[i]!).toBeLessThan(ratios[i - 1]!)
      }
    }
  })

  it('déclare une couche par rôle utile, avec des ancrages croissants', () => {
    const profile = createDefaultProfile()

    const roles = profile.layers.map((l) => l.role)
    expect(roles).toContain('on')
    expect(roles).toContain('off')
    expect(roles).toContain('limiter')

    for (const role of ['on', 'off'] as const) {
      const famille = profile.layers.filter((l) => l.role === role)
      expect(famille.length).toBeGreaterThan(1)
      for (const couche of famille) {
        expect(couche.anchorRpm).toBeGreaterThan(0)
        expect(couche.minRate).toBeLessThan(couche.maxRate)
      }
    }
  })
})

describe('profils livrés — la croisière', () => {
  const VITESSES = [30, 50, 70, 90, 110, 130]

  /**
   * Rapport et régime auxquels un profil se stabilise à vitesse tenue.
   *
   * On fait tourner la boîte à vitesse fixe, accélération nulle, assez
   * longtemps pour que la montée en croisière ait fini sa cascade.
   */
  function croisiere(p: Profile, kmh: number): { gear: number; rpm: number } {
    const gearbox = new Gearbox(p.drivetrain, p.engine, p.feel)
    const rpmInGear = (gear: number) =>
      Engine.kinematicRpm(
        kmh,
        (p.drivetrain.gearRatios[gear] ?? 1) * p.drivetrain.finalDrive,
        p.drivetrain.wheelRadiusM,
      )
    let gear = 0
    for (let frame = 0; frame * (1 / 60) <= 90; frame += 1) {
      gear = gearbox.tick(1 / 60, {
        rpmInGear,
        atStandstill: false,
        load: 0.5,
        kmh,
        accelMs2: 0,
      }).gear
    }
    return { gear, rpm: rpmInGear(gear) }
  }

  it('ne laisse aucun régime de croisière absurde sur Route', () => {
    const p = createRoadProfile()

    // Mesuré : 1820 à 30 km/h, 1532 à 50, 1790 à 70, 1927 à 90, 2355 à 110.
    // C'est ce tableau que ce test protège d'un réglage futur maladroit.
    for (const kmh of VITESSES.filter((v) => v < 130)) {
      expect(croisiere(p, kmh).rpm).toBeLessThan(2500)
    }
  })

  it('ne fait brouter aucun des deux profils', () => {
    for (const p of createFactoryProfiles()) {
      for (const kmh of VITESSES) {
        expect(croisiere(p, kmh).rpm).toBeGreaterThanOrEqual(p.drivetrain.cruiseMinRpm)
      }
    }
  })

  it('engage la sixième sur route ouverte, avec le profil Route', () => {
    const p = createRoadProfile()
    const dernier = p.drivetrain.gearRatios.length - 1

    expect(croisiere(p, 90).gear).toBe(dernier)
    expect(croisiere(p, 130).gear).toBe(dernier)
  })

  it('fait croiser Sport plus haut que Route, à chaque vitesse', () => {
    const route = createRoadProfile()
    const sport = createDefaultProfile()

    for (const kmh of VITESSES) {
      expect(croisiere(sport, kmh).rpm).toBeGreaterThan(croisiere(route, kmh).rpm)
    }
  })

  it('donne aux deux profils un caractère de boîte cohérent avec leur nom', () => {
    const route = createRoadProfile()
    const sport = createDefaultProfile()

    // Sport croise plus haut, garde ses rapports plus longtemps, et descend au
    // freinage sur une décélération plus faible.
    expect(sport.drivetrain.cruiseMinRpm).toBeGreaterThan(route.drivetrain.cruiseMinRpm)
    expect(sport.drivetrain.cruiseUpshiftAfterS).toBeGreaterThan(
      route.drivetrain.cruiseUpshiftAfterS,
    )
    expect(sport.drivetrain.brakeDownshiftAccelMs2).toBeGreaterThan(
      route.drivetrain.brakeDownshiftAccelMs2,
    )
  })

  it('garde le plancher de croisière au-dessus du ralenti', () => {
    for (const p of createFactoryProfiles()) {
      expect(p.drivetrain.cruiseMinRpm).toBeGreaterThan(p.engine.idleRpm)
      expect(p.drivetrain.cruiseMinRpm).toBeLessThan(p.engine.redlineRpm * 0.5)
    }
  })
})
