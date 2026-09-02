import { describe, expect, it } from 'vitest'

import {
  createDefaultProfile,
  createFactoryProfiles,
  createRoadProfile,
  finalDriveFor,
  rpmAtSpeed,
} from './defaults'
import { Engine } from '../engine/engine'
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
