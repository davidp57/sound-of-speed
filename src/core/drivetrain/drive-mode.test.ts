import { describe, expect, it } from 'vitest'

import {
  downshiftFloorRpm,
  driveModeFromUpshiftRpm,
  isDriveMode,
  kickdownLoadFor,
  upshiftFloorRpm,
  FIRST_UPSHIFT_FLOOR_RPM,
  type DriveMode,
} from './drive-mode'
import { createDefaultProfile, createRoadProfile } from '../preset/defaults'

/**
 * Tests du mode de conduite.
 *
 * Ce qui se vérifie ici est **l'invariant**, pas le réglage : le plancher de
 * descente reste sous celui de montée, quelles que soient la demande et la
 * décélération. C'est lui qui interdit à la boîte de rendre un rapport qu'elle
 * vient d'engager, et il se démontre au lieu de se régler — c'était précisément
 * ce qui manquait à la règle d'avant, où deux nombres indépendants ouvraient
 * une plage de va-et-vient sur chaque rapport.
 *
 * Les marges elles-mêmes ne sont pas testées pour leur valeur : elles se règlent
 * à l'oreille, et un test qui les fige empêcherait de les régler.
 */

const IDLE = 800
const MODES: DriveMode[] = ['road', 'sport']

describe('le plancher de montée', () => {
  it('part du ralenti du moteur', () => {
    for (const mode of MODES) {
      expect(upshiftFloorRpm(mode, 0.5, IDLE)).toBeGreaterThan(IDLE)
      // Un autre ralenti déplace le plancher d'autant : c'est le moteur qui
      // décide du bas de la plage, pas une constante.
      expect(upshiftFloorRpm(mode, 0.5, 1200) - upshiftFloorRpm(mode, 0.5, IDLE)).toBeCloseTo(
        400,
        6,
      )
    }
  })

  it('monte avec la demande : plus on demande, plus on laisse monter les tours', () => {
    for (const mode of MODES) {
      const levé = upshiftFloorRpm(mode, 0, IDLE)
      const croisière = upshiftFloorRpm(mode, 0.5, IDLE)
      const plancher = upshiftFloorRpm(mode, 1, IDLE)
      expect(levé).toBeLessThan(croisière)
      expect(croisière).toBeLessThan(plancher)
      // La marge double à pleine charge, par rapport à la charge moyenne.
      expect(plancher - IDLE).toBeCloseTo(2 * (croisière - IDLE), 6)
    }
  })

  it('garde le mode sport au-dessus du mode route, à toute demande', () => {
    for (const demand of [0, 0.25, 0.5, 0.75, 1]) {
      expect(upshiftFloorRpm('sport', demand, IDLE)).toBeGreaterThan(
        upshiftFloorRpm('road', demand, IDLE),
      )
    }
  })

  it('ne dépend pas du rupteur : c’est le rapport visé qui décide', () => {
    // La règle d'avant tirait ses seuils du rupteur. Celle-ci n'en a pas
    // besoin : elle regarde le régime qu'aurait le rapport suivant, et
    // l'étagement de la boîte fait le reste.
    expect(upshiftFloorRpm.length).toBe(3)
  })
})

describe('le plancher de descente', () => {
  it('reste sous le plancher de montée, quoi qu’il arrive', () => {
    // L'invariant du lot, balayé : c'est lui qui interdit l'aller-retour.
    for (const mode of MODES) {
      for (const demand of [0, 0.2, 0.4, 0.5, 0.7, 1]) {
        for (const accel of [2, 0, -0.5, -1, -2, -5]) {
          const montée = upshiftFloorRpm(mode, demand, IDLE)
          expect(downshiftFloorRpm(mode, accel, IDLE, montée)).toBeLessThan(montée)
        }
      }
    }
  })

  it('remonte avec la décélération : on rétrograde plus tôt en freinant', () => {
    for (const mode of MODES) {
      const montée = upshiftFloorRpm(mode, 0.5, IDLE)
      const roueLibre = downshiftFloorRpm(mode, 0, IDLE, montée)
      const freinage = downshiftFloorRpm(mode, -2, IDLE, montée)
      expect(freinage).toBeGreaterThan(roueLibre)
    }
  })

  it('ne descend pas sous le ralenti', () => {
    for (const mode of MODES) {
      const montée = upshiftFloorRpm(mode, 1, IDLE)
      expect(downshiftFloorRpm(mode, 0, IDLE, montée)).toBeGreaterThan(IDLE)
    }
  })
})

describe('le premier passage', () => {
  it('a son propre plancher, au-dessus du ralenti d’un moteur ordinaire', () => {
    // Ni mode ni charge : « on passe la deuxième dès qu'on peut, sans
    // attendre ». La seule chose à éviter est qu'elle tombe sous le ralenti.
    expect(FIRST_UPSHIFT_FLOOR_RPM).toBeGreaterThan(IDLE)
  })
})

describe('le rétrogradage forcé', () => {
  it('demande le pied au plancher en route, et moins en sport', () => {
    expect(kickdownLoadFor('road')).toBeGreaterThan(kickdownLoadFor('sport'))
    // Sur l'échelle réelle de la charge, centrée sur 0,5 : les deux seuils
    // désignent une accélération franche, pas une relance ordinaire.
    expect(kickdownLoadFor('sport')).toBeGreaterThan(0.75)
    expect(kickdownLoadFor('road')).toBeLessThanOrEqual(1)
  })
})

describe('la lecture d’un mode', () => {
  it('reconnaît les deux modes et rien d’autre', () => {
    expect(isDriveMode('road')).toBe(true)
    expect(isDriveMode('sport')).toBe(true)
    expect(isDriveMode('éco')).toBe(false)
    expect(isDriveMode(null)).toBe(false)
  })
})

describe('la reprise du mode depuis des seuils absolus', () => {
  it('reconnaît le tempérament du profil Route', () => {
    const route = createRoadProfile()
    expect(driveModeFromUpshiftRpm(route.drivetrain.upshiftRpm, route.engine.redlineRpm)).toBe(
      'road',
    )
  })

  it('reconnaît le tempérament du profil Sport', () => {
    const sport = createDefaultProfile()
    expect(driveModeFromUpshiftRpm(sport.drivetrain.upshiftRpm, sport.engine.redlineRpm)).toBe(
      'sport',
    )
  })

  it('sans elle, le profil Sport se mettrait à conduire comme un profil Route', () => {
    // C'est la raison d'être de cette fonction, et elle survit au changement de
    // règle : les profils enregistrés portent encore les seuils absolus, et
    // c'est à eux qu'on lit le tempérament que David avait choisi.
    const sport = createDefaultProfile()
    const mode = driveModeFromUpshiftRpm(sport.drivetrain.upshiftRpm, sport.engine.redlineRpm)
    expect(upshiftFloorRpm(mode, 0.5, IDLE)).toBeGreaterThan(upshiftFloorRpm('road', 0.5, IDLE))
  })

  it('choisit la route quand il n’y a rien à lire', () => {
    expect(driveModeFromUpshiftRpm([], 6500)).toBe('road')
    expect(driveModeFromUpshiftRpm([3000], 0)).toBe('road')
  })
})

describe('le mode Route passe ses rapports plus tôt', () => {
  /**
   * Sortie du 11 septembre 2026. David : « ça reste trop longtemps en deux »,
   * et « modifier le mode Route pour que les vitesses passent plus tôt que
   * maintenant, moins vingt pour cent ».
   *
   * Le ralenti est un plancher fixe, donc la baisse de la marge ne se reporte
   * pas telle quelle : le seuil perd vingt pour cent pied au plancher, où il
   * l'a demandée, et quinze en conduite ordinaire. C'est le compromis retenu,
   * et ces deux chiffres sont ce que le test protège.
   */
  it('perd vingt pour cent pied au plancher, quinze en conduite ordinaire', () => {
    const idle = 800
    // Les valeurs d'avant, avec la marge à 900.
    const avant = (demand: number) => idle + 900 * Math.min(2, Math.max(0.5, 2 * demand))

    expect(upshiftFloorRpm('road', 1, idle)).toBeCloseTo(2080, 0)
    expect(upshiftFloorRpm('road', 1, idle) / avant(1)).toBeCloseTo(0.8, 2)

    expect(upshiftFloorRpm('road', 0.5, idle)).toBeCloseTo(1440, 0)
    expect(upshiftFloorRpm('road', 0.5, idle) / avant(0.5)).toBeCloseTo(0.85, 2)
  })

  it('ne touche pas au mode Sport', () => {
    const idle = 780

    expect(upshiftFloorRpm('sport', 1, idle)).toBeCloseTo(idle + 2200 * 2, 0)
    expect(upshiftFloorRpm('sport', 0.5, idle)).toBeCloseTo(idle + 2200, 0)
  })

  it('garde le mode Route sous le mode Sport, à toute demande', () => {
    for (const demand of [0, 0.25, 0.5, 0.75, 1]) {
      expect(upshiftFloorRpm('road', demand, 800)).toBeLessThan(upshiftFloorRpm('sport', demand, 800))
    }
  })
})
