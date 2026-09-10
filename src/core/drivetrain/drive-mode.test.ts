import { describe, expect, it } from 'vitest'

import {
  DRIVE_MODE_CURVES,
  driveModeFromUpshiftRpm,
  isDriveMode,
  upshiftFraction,
  upshiftRpmFor,
} from './drive-mode'
import { createDefaultProfile, createRoadProfile } from '../preset/defaults'

/**
 * Tests du mode de conduite.
 *
 * Ce qui se vérifie d'abord : que **rien ne change** sur les moteurs livrés. Les
 * seuils des deux profils viennent de quatorze écoutes ; les exprimer en
 * fraction du rupteur ne doit pas les déplacer. C'est la seule chose que ce
 * changement pouvait casser sans qu'on l'entende avant de rouler.
 *
 * Ensuite : qu'un moteur de rupteur différent passe ses rapports ailleurs — ce
 * qui est tout le propos, et ce qui n'était pas le cas.
 */

const PASSAGES = 5

describe('les courbes des deux modes', () => {
  it('reproduisent les seuils du profil Route', () => {
    const route = createRoadProfile()
    const rupteur = route.engine.redlineRpm
    route.drivetrain.upshiftRpm.forEach((attendu, gear) => {
      expect(upshiftRpmFor('road', gear, PASSAGES, rupteur)).toBeCloseTo(attendu, 0)
    })
  })

  it('reproduisent les seuils du profil Sport', () => {
    const sport = createDefaultProfile()
    const rupteur = sport.engine.redlineRpm
    sport.drivetrain.upshiftRpm.forEach((attendu, gear) => {
      expect(upshiftRpmFor('sport', gear, PASSAGES, rupteur)).toBeCloseTo(attendu, 0)
    })
  })

  it('disent les deux philosophies : Route monte de plus en plus tôt', () => {
    const courbe = DRIVE_MODE_CURVES.road
    expect(courbe[0]).toBeGreaterThan(courbe[courbe.length - 1] ?? 1)
  })

  it('et Sport de plus en plus tard', () => {
    const courbe = DRIVE_MODE_CURVES.sport
    expect(courbe[0]).toBeLessThan(courbe[courbe.length - 1] ?? 0)
  })

  it('gardent le mode sport au-dessus du mode route, à chaque passage', () => {
    for (let gear = 0; gear < PASSAGES; gear += 1) {
      expect(upshiftFraction('sport', gear, PASSAGES)).toBeGreaterThan(
        upshiftFraction('road', gear, PASSAGES),
      )
    }
  })
})

describe('le régime de passage suit le moteur', () => {
  it('monte avec le rupteur : c\'est tout le propos', () => {
    // Le défaut mesuré au banc : un moteur à 11 000 tr/min passait ses rapports
    // au même endroit qu'un V8 à 6 500.
    const v8 = upshiftRpmFor('sport', 2, PASSAGES, 6500)
    const moto = upshiftRpmFor('sport', 2, PASSAGES, 11000)
    expect(moto).toBeGreaterThan(v8)
    // Proportionnellement, et non d'un écart arbitraire.
    expect(moto / v8).toBeCloseTo(11000 / 6500, 2)
  })

  it('ne dépasse jamais le rupteur du moteur', () => {
    // Le Chevrolet 454 tapait son rupteur avant d'avoir le droit de monter :
    // les seuils absolus de Sport allaient jusqu'à 6 500 pour un rupteur à 5 500.
    for (const rupteur of [5500, 6500, 8400, 11000]) {
      for (let gear = 0; gear < PASSAGES; gear += 1) {
        expect(upshiftRpmFor('sport', gear, PASSAGES, rupteur)).toBeLessThan(rupteur)
        expect(upshiftRpmFor('road', gear, PASSAGES, rupteur)).toBeLessThan(rupteur)
      }
    }
  })
})

describe('une boîte qui n\'a pas cinq passages', () => {
  it('étale la courbe sur le nombre de passages qu\'elle a', () => {
    // Trois rapports, donc deux passages : le premier et le dernier de la
    // courbe, sans rien inventer entre.
    expect(upshiftFraction('road', 0, 2)).toBeCloseTo(DRIVE_MODE_CURVES.road[0] ?? 0, 4)
    const dernier = DRIVE_MODE_CURVES.road[DRIVE_MODE_CURVES.road.length - 1] ?? 0
    expect(upshiftFraction('road', 1, 2)).toBeCloseTo(dernier, 4)
  })

  it('donne à un rapport ajouté un seuil cohérent avec ses voisins', () => {
    // C'est ce que les seuils absolus ne savaient pas faire : un rapport ajouté
    // héritait du seuil de son prédécesseur.
    const fractions = Array.from({ length: 7 }, (_, gear) => upshiftFraction('sport', gear, 7))
    for (let i = 1; i < fractions.length; i += 1) {
      expect(fractions[i]).toBeGreaterThanOrEqual(fractions[i - 1] ?? 0)
    }
  })

  it('tient une boîte à prise directe, sans passage', () => {
    expect(upshiftFraction('road', 0, 1)).toBeCloseTo(DRIVE_MODE_CURVES.road[0] ?? 0, 4)
    expect(Number.isFinite(upshiftFraction('road', 0, 0))).toBe(true)
  })

  it('ne sort jamais de la courbe, même pour un rapport hors boîte', () => {
    const courbe = DRIVE_MODE_CURVES.sport
    const min = Math.min(...courbe)
    const max = Math.max(...courbe)
    for (const gear of [-3, 0, 4, 99]) {
      const f = upshiftFraction('sport', gear, PASSAGES)
      expect(f).toBeGreaterThanOrEqual(min)
      expect(f).toBeLessThanOrEqual(max)
    }
  })
})

describe('la lecture d\'un mode', () => {
  it('reconnaît les deux modes et rien d\'autre', () => {
    expect(isDriveMode('road')).toBe(true)
    expect(isDriveMode('sport')).toBe(true)
    expect(isDriveMode('course')).toBe(false)
    expect(isDriveMode(undefined)).toBe(false)
  })
})

describe('la reprise du mode depuis des seuils absolus', () => {
  it('reconnaît le tempérament du profil Route', () => {
    const route = createRoadProfile()
    expect(
      driveModeFromUpshiftRpm(route.drivetrain.upshiftRpm, route.engine.redlineRpm),
    ).toBe('road')
  })

  it('reconnaît le tempérament du profil Sport', () => {
    const sport = createDefaultProfile()
    expect(
      driveModeFromUpshiftRpm(sport.drivetrain.upshiftRpm, sport.engine.redlineRpm),
    ).toBe('sport')
  })

  it('sans elle, le profil Sport se mettrait à conduire comme un profil Route', () => {
    // C'est la raison d'être de cette fonction : le mode remplace la différence
    // qui vivait dans les seuils, il faut donc la lire avant de la remplacer.
    const sport = createDefaultProfile()
    const mode = driveModeFromUpshiftRpm(sport.drivetrain.upshiftRpm, sport.engine.redlineRpm)
    expect(upshiftRpmFor(mode, 4, 5, sport.engine.redlineRpm)).toBeCloseTo(6500, 0)
  })

  it('choisit la route quand il n\'y a rien à lire', () => {
    expect(driveModeFromUpshiftRpm([], 6500)).toBe('road')
    expect(driveModeFromUpshiftRpm([3000], 0)).toBe('road')
  })
})
