import { describe, expect, it } from 'vitest'

import { withSevenGears } from './seven-gears'
import { createDefaultProfile, createRoadProfile } from './defaults'
import type { DrivetrainPreset } from './schema'

/**
 * La boîte de route livrée jusqu'au 11 septembre 2026, telle qu'elle dort dans
 * le stockage du téléphone de David et dans les profils déposés sur le NAS.
 */
function ancienneBoite(over: Partial<DrivetrainPreset> = {}): DrivetrainPreset {
  return {
    ...createRoadProfile().drivetrain,
    gearRatios: [3.55, 2.04, 1.36, 1.03, 0.86, 0.72],
    upshiftRpm: [3700, 3350, 3050, 2950, 2950],
    shiftDelaysS: [0.3, 0.55, 0.4, 0.6, 0.35, 0.5],
    finalDrive: 3.7,
    ...over,
  }
}

describe('withSevenGears', () => {
  it('donne sa septième à la boîte de route livrée', () => {
    const repris = withSevenGears(ancienneBoite())

    expect(repris.gearRatios).toEqual([3.55, 2.04, 1.36, 1.0, 0.73, 0.53, 0.39])
    // Un seuil de moins que les rapports, une temporisation par rapport.
    expect(repris.upshiftRpm).toHaveLength(6)
    expect(repris.shiftDelaysS).toHaveLength(7)
  })

  it('prolonge les tables au lieu d’inventer une valeur', () => {
    const repris = withSevenGears(ancienneBoite())

    expect(repris.upshiftRpm).toEqual([3700, 3350, 3050, 2950, 2950, 2950])
    expect(repris.shiftDelaysS).toEqual([0.3, 0.55, 0.4, 0.6, 0.35, 0.5, 0.5])
  })

  it('ne touche à rien d’autre', () => {
    const avant = ancienneBoite()
    const repris = withSevenGears(avant)

    expect(repris.finalDrive).toBe(avant.finalDrive)
    expect(repris.wheelRadiusM).toBe(avant.wheelRadiusM)
    expect(repris.shiftTimeMs).toBe(avant.shiftTimeMs)
    expect(repris.cruiseMinRpm).toBe(avant.cruiseMinRpm)
  })

  /**
   * Une boîte qu'on a réglée garde ce qu'on lui a donné : lui ajouter un
   * rapport que personne n'a demandé serait décider à la place de celui qui l'a
   * réglée.
   */
  it('laisse tranquille une boîte réglée à la main', () => {
    const surMesure = ancienneBoite({ gearRatios: [3.2, 1.9, 1.3, 1.0, 0.8, 0.66] })

    expect(withSevenGears(surMesure)).toBe(surMesure)
  })

  it('laisse tranquille une boîte dont le pont a été changé', () => {
    const autrePont = ancienneBoite({ finalDrive: 4.1 })

    expect(withSevenGears(autrePont)).toBe(autrePont)
  })

  /**
   * Les deux boîtes livrées portaient le même étagement ; seul le pont les
   * séparait. Une sportive garde des rapports courts.
   */
  it('laisse tranquille la boîte de sport', () => {
    const sport = createDefaultProfile().drivetrain

    expect(withSevenGears(sport)).toBe(sport)
    expect(sport.gearRatios).toHaveLength(6)
  })

  it('ne refait pas une boîte qui a déjà sept rapports', () => {
    const deja = createRoadProfile().drivetrain

    expect(withSevenGears(deja)).toBe(deja)
  })
})
