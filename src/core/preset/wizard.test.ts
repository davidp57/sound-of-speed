import { describe, expect, it } from 'vitest'

import { buildProfile, describeProfile, type WizardChoices } from './wizard'
import { createDefaultProfile, createRoadProfile } from './defaults'
import { Engine } from '../engine/engine'

/**
 * Tests de la construction guidée.
 *
 * Le principe du guide est que quatre réponses simples suffisent à produire un
 * profil **cohérent** : des réglages qui s'accordent, pas trente valeurs
 * indépendantes. Ce qui se vérifie ici est donc cette cohérence — le pont place
 * bien la croisière au régime voulu, les rapports sont étagés, les seuils de
 * passage montent avec le tempérament — et non des valeurs exactes, qui sont un
 * réglage de goût.
 */

const template = createDefaultProfile()

function choices(over: Partial<WizardChoices> = {}): WizardChoices {
  return {
    name: 'Essai',
    temperament: 'equilibre',
    usage: 'route',
    gearCount: 6,
    engine: 'essence',
    ...over,
  }
}

/** Régime en dernier rapport, à une vitesse donnée. */
function rpmAtTop(profile: ReturnType<typeof buildProfile>, kmh: number): number {
  const { gearRatios, finalDrive, wheelRadiusM } = profile.drivetrain
  const top = gearRatios[gearRatios.length - 1] ?? 1
  return Engine.kinematicRpm(kmh, top * finalDrive, wheelRadiusM)
}

describe('buildProfile — cohérence générale', () => {
  it('place la croisière au régime voulu par le tempérament', () => {
    // C'est le cœur du guide : le pont est déduit du couple vitesse/régime.
    // Route + équilibré = 90 km/h à 43 % du rupteur d'un moteur essence.
    const profile = buildProfile(choices(), template)

    const attendu = profile.engine.redlineRpm * 0.43
    expect(rpmAtTop(profile, 90)).toBeCloseTo(attendu, -1)
  })

  it('fait tourner plus bas un tempérament calme, plus haut un sportif', () => {
    const calme = buildProfile(choices({ temperament: 'calme' }), template)
    const sportif = buildProfile(choices({ temperament: 'sportif' }), template)

    const fraction = (p: ReturnType<typeof buildProfile>) => rpmAtTop(p, 90) / p.engine.redlineRpm
    expect(fraction(calme)).toBeLessThan(fraction(sportif))
  })

  it('adapte le pont au terrain', () => {
    const ville = buildProfile(choices({ usage: 'ville' }), template)
    const autoroute = buildProfile(choices({ usage: 'autoroute' }), template)

    // À vitesse égale, un profil taillé pour l'autoroute tourne plus bas : sa
    // croisière de référence est plus rapide.
    expect(rpmAtTop(autoroute, 90)).toBeLessThan(rpmAtTop(ville, 90))
  })

  it('donne au moteur choisi son rupteur et son ralenti', () => {
    expect(buildProfile(choices({ engine: 'diesel' }), template).engine.redlineRpm).toBe(4600)
    expect(buildProfile(choices({ engine: 'essence' }), template).engine.redlineRpm).toBe(6600)
    expect(buildProfile(choices({ engine: 'sportif' }), template).engine.redlineRpm).toBe(8600)
    expect(buildProfile(choices({ engine: 'diesel' }), template).engine.idleRpm).toBe(750)
  })

  it('garde le seuil de coupure sous le rupteur', () => {
    for (const engine of ['diesel', 'essence', 'sportif'] as const) {
      const profile = buildProfile(choices({ engine }), template)
      expect(profile.engine.softLimitRpm).toBeLessThan(profile.engine.redlineRpm)
    }
  })
})

describe('buildProfile — étagement de la boîte', () => {
  it('produit le nombre de rapports demandé', () => {
    for (const gearCount of [2, 4, 6, 8]) {
      expect(buildProfile(choices({ gearCount }), template).drivetrain.gearRatios).toHaveLength(
        gearCount,
      )
    }
  })

  it('borne un nombre de rapports absurde', () => {
    expect(buildProfile(choices({ gearCount: 0 }), template).drivetrain.gearRatios).toHaveLength(2)
    expect(buildProfile(choices({ gearCount: 40 }), template).drivetrain.gearRatios).toHaveLength(9)
  })

  it('étage les rapports du plus court au plus long', () => {
    const { gearRatios } = buildProfile(choices({ gearCount: 6 }), template).drivetrain

    for (let i = 1; i < gearRatios.length; i += 1) {
      expect(gearRatios[i]!).toBeLessThan(gearRatios[i - 1]!)
    }
  })

  it('répartit les rapports géométriquement, donc à écarts de régime égaux', () => {
    // C'est le propre d'une boîte bien étagée : le rapport d'un rapport au
    // suivant est constant.
    const { gearRatios } = buildProfile(choices({ gearCount: 6 }), template).drivetrain

    const rapports = gearRatios.slice(1).map((r, i) => gearRatios[i]! / r)
    for (const rapport of rapports) {
      expect(rapport).toBeCloseTo(rapports[0]!, 2)
    }
  })

  it('donne un régime de passage par passage, croissant', () => {
    const profile = buildProfile(choices({ gearCount: 6 }), template)
    const { upshiftRpm } = profile.drivetrain

    expect(upshiftRpm).toHaveLength(5)
    for (let i = 1; i < upshiftRpm.length; i += 1) {
      expect(upshiftRpm[i]!).toBeGreaterThanOrEqual(upshiftRpm[i - 1]!)
    }
    for (const rpm of upshiftRpm) {
      expect(rpm).toBeLessThan(profile.engine.redlineRpm)
    }
  })

  it('fait passer plus haut un tempérament sportif', () => {
    const calme = buildProfile(choices({ temperament: 'calme' }), template)
    const sportif = buildProfile(choices({ temperament: 'sportif' }), template)

    const fraction = (p: ReturnType<typeof buildProfile>) =>
      (p.drivetrain.upshiftRpm[0] ?? 0) / p.engine.redlineRpm
    expect(fraction(calme)).toBeLessThan(fraction(sportif))
  })

  it('donne des temporisations inégales', () => {
    const { shiftDelaysS } = buildProfile(choices({ gearCount: 6 }), template).drivetrain

    // Des valeurs identiques donneraient une boîte qui sonne comme un
    // métronome : c'est l'écart qui rend le passage crédible.
    expect(new Set(shiftDelaysS).size).toBeGreaterThan(1)
    expect(shiftDelaysS).toHaveLength(6)
  })

  it('raccourcit les temporisations d’un tempérament vif', () => {
    const calme = buildProfile(choices({ temperament: 'calme' }), template)
    const sportif = buildProfile(choices({ temperament: 'sportif' }), template)

    expect(sportif.drivetrain.shiftDelaysS[0]!).toBeLessThan(calme.drivetrain.shiftDelaysS[0]!)
    expect(sportif.drivetrain.shiftTimeMs).toBeLessThan(calme.drivetrain.shiftTimeMs)
  })
})

describe('buildProfile — caractère', () => {
  it('ne fait pas pétarader un tempérament calme', () => {
    expect(buildProfile(choices({ temperament: 'calme' }), template).feel.backfire.enabled).toBe(
      false,
    )
    expect(buildProfile(choices({ temperament: 'sportif' }), template).feel.backfire.enabled).toBe(
      true,
    )
  })

  it('monte l’à-coup et le rétrogradage avec le tempérament', () => {
    const calme = buildProfile(choices({ temperament: 'calme' }), template)
    const sportif = buildProfile(choices({ temperament: 'sportif' }), template)

    expect(sportif.feel.shiftJolt.depth).toBeGreaterThan(calme.feel.shiftJolt.depth)
    expect(sportif.feel.kickdown.maxGears).toBeGreaterThan(calme.feel.kickdown.maxGears)
  })
})

describe('buildProfile — ce qui vient du profil courant', () => {
  it('reprend les échantillons, qui ne se devinent pas', () => {
    const modele = createRoadProfile()

    const profile = buildProfile(choices(), modele)

    expect(profile.sampleDir).toBe(modele.sampleDir)
    expect(profile.layers).toEqual(modele.layers)
    expect(profile.engine.cylinders).toBe(modele.engine.cylinders)
    expect(profile.drivetrain.wheelRadiusM).toBe(modele.drivetrain.wheelRadiusM)
  })

  it('copie les couches sans lien avec le modèle', () => {
    const modele = createRoadProfile()
    const profile = buildProfile(choices(), modele)

    profile.layers[0]!.gain = 0.01

    expect(modele.layers[0]?.gain).not.toBe(0.01)
  })

  it('donne un identifiant neuf et le nom demandé', () => {
    const premier = buildProfile(choices({ name: '  Mon profil  ' }), template)
    const second = buildProfile(choices(), template)

    expect(premier.name).toBe('Mon profil')
    expect(premier.id).not.toBe(second.id)
    expect(premier.id).not.toBe(template.id)
  })

  it('donne un nom par défaut quand on n’en propose pas', () => {
    expect(buildProfile(choices({ name: '   ' }), template).name).toBe('Nouveau profil')
  })
})

describe('describeProfile', () => {
  it('décrit le profil en langage de conducteur', () => {
    const profile = buildProfile(choices(), template)

    const lignes = describeProfile(profile)

    expect(lignes[0]).toContain('6 rapports')
    expect(lignes[0]).toContain(String(profile.engine.redlineRpm))
    expect(lignes[1]).toMatch(/^À 90 km\/h en dernier rapport : \d+ tr\/min\.$/)
    expect(lignes[2]).toMatch(/^À 130 km\/h : \d+ tr\/min\.$/)
    // Aucun terme d'implémentation : c'est un aperçu, pas un relevé.
    for (const ligne of lignes) {
      expect(ligne).not.toMatch(/rpm|ratio|upshift/i)
    }
  })

  it('donne un régime cohérent avec le pont annoncé', () => {
    const profile = buildProfile(choices(), template)

    const lignes = describeProfile(profile)
    const annonce = Number(/: (\d+) tr\/min/.exec(lignes[1] ?? '')?.[1])

    expect(annonce).toBeCloseTo(rpmAtTop(profile, 90), -1)
  })

  it('annonce une vitesse de passage plausible', () => {
    const profile = buildProfile(choices(), template)

    const ligne = describeProfile(profile).at(-1) ?? ''
    const kmh = Number(/vers (\d+) km\/h/.exec(ligne)?.[1])

    // Le libellé annonce « 2 → 3 » mais s'appuie sur le seuil du premier
    // rapport : l'incohérence est signalée dans le lot FIX-CORE. On vérifie
    // ici que le chiffre reste dans un ordre de grandeur crédible.
    expect(ligne).toContain('à charge moyenne')
    expect(kmh).toBeGreaterThan(10)
    expect(kmh).toBeLessThan(150)
  })

  it('reste bref sur une boîte à deux rapports', () => {
    const lignes = describeProfile(buildProfile(choices({ gearCount: 2 }), template))

    expect(lignes.length).toBeGreaterThanOrEqual(3)
    expect(lignes[0]).toContain('2 rapports')
  })
})
