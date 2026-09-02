import { describe, expect, it } from 'vitest'

import { buildProfile, describeProfile, type WizardChoices } from './wizard'
import { createDefaultProfile, createRoadProfile } from './defaults'
import { Engine } from '../engine/engine'
import { Gearbox } from '../drivetrain/gearbox'

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
    // Les lignes sont retrouvées par leur contenu et non par leur rang : en
    // ajouter une au milieu ne doit pas faire échouer un test de vocabulaire.
    expect(lignes.some((l) => /^À 90 km\/h, allure tenue : \de rapport à \d+ tr\/min\.$/.test(l))).toBe(
      true,
    )
    expect(lignes.some((l) => /^À 90 km\/h en dernier rapport : \d+ tr\/min\.$/.test(l))).toBe(true)
    expect(lignes.some((l) => /^À 130 km\/h : \d+ tr\/min\.$/.test(l))).toBe(true)
    // Aucun terme d'implémentation : c'est un aperçu, pas un relevé.
    for (const ligne of lignes) {
      expect(ligne).not.toMatch(/rpm|ratio|upshift/i)
    }
  })

  it('donne un régime cohérent avec le pont annoncé', () => {
    const profile = buildProfile(choices(), template)

    const ligne = describeProfile(profile).find((l) => l.includes('en dernier rapport')) ?? ''
    const annonce = Number(/: (\d+) tr\/min/.exec(ligne)?.[1])

    expect(annonce).toBeCloseTo(rpmAtTop(profile, 90), -1)
  })

  it('annonce le passage dont elle donne la vitesse', () => {
    const profile = buildProfile(choices(), template)

    const ligne = describeProfile(profile).at(-1) ?? ''
    const kmh = Number(/vers (\d+) km\/h/.exec(ligne)?.[1])

    // La première n'est qu'une amorce de lancement : le premier passage
    // commandé par le régime est 2 → 3.
    expect(ligne).toContain('Passage 2 → 3')
    expect(ligne).toContain('à charge moyenne')

    // Et la vitesse annoncée est bien celle où ce passage se produit : à cette
    // vitesse, le deuxième rapport atteint son seuil de montée. Le libellé et
    // le calcul portaient auparavant sur deux rapports différents.
    const { gearRatios, finalDrive, wheelRadiusM } = profile.drivetrain
    const regime = Engine.kinematicRpm(kmh, gearRatios[1]! * finalDrive, wheelRadiusM)
    const seuil = profile.drivetrain.upshiftRpm[1]!
    // À 2 % près : la vitesse est annoncée au km/h près, ce qui vaut une
    // quarantaine de tours sur ce rapport.
    expect(Math.abs(regime - seuil) / seuil).toBeLessThan(0.02)
  })

  it('annonce le premier passage quand la première n’est pas une amorce', () => {
    const profile = buildProfile(choices(), template)
    const sansAmorce = {
      ...profile,
      drivetrain: { ...profile.drivetrain, firstGearLaunchOnly: false },
    }

    const ligne = describeProfile(sansAmorce).at(-1) ?? ''
    const kmh = Number(/vers (\d+) km\/h/.exec(ligne)?.[1])

    expect(ligne).toContain('Passage 1 → 2')

    const { gearRatios, finalDrive, wheelRadiusM } = sansAmorce.drivetrain
    const regime = Engine.kinematicRpm(kmh, gearRatios[0]! * finalDrive, wheelRadiusM)
    const seuil = sansAmorce.drivetrain.upshiftRpm[0]!
    expect(Math.abs(regime - seuil) / seuil).toBeLessThan(0.02)
  })

  it('reste bref sur une boîte à deux rapports', () => {
    const lignes = describeProfile(buildProfile(choices({ gearCount: 2 }), template))

    expect(lignes.length).toBeGreaterThanOrEqual(3)
    expect(lignes[0]).toContain('2 rapports')
  })
})

describe('buildProfile — le caractère de la boîte', () => {
  /** Régime auquel un profil croise réellement, à une vitesse tenue. */
  function croisiere(p: ReturnType<typeof buildProfile>, kmh: number): number {
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
    return rpmInGear(gear)
  }

  it('fait croiser un profil calme plus bas qu’un profil sportif', () => {
    const calme = buildProfile(choices({ temperament: 'calme' }), template)
    const sportif = buildProfile(choices({ temperament: 'sportif' }), template)

    // Sur le régime réellement obtenu, et non sur le réglage : c'est ce qu'on
    // entendra.
    expect(croisiere(calme, 90)).toBeLessThan(croisiere(sportif, 90))
  })

  it('fait attendre plus longtemps un profil sportif avant de monter', () => {
    const calme = buildProfile(choices({ temperament: 'calme' }), template)
    const sportif = buildProfile(choices({ temperament: 'sportif' }), template)

    expect(sportif.drivetrain.cruiseUpshiftAfterS).toBeGreaterThan(
      calme.drivetrain.cruiseUpshiftAfterS,
    )
  })

  it('fait descendre un profil sportif sur une décélération plus faible', () => {
    const calme = buildProfile(choices({ temperament: 'calme' }), template)
    const sportif = buildProfile(choices({ temperament: 'sportif' }), template)

    expect(sportif.drivetrain.brakeDownshiftAccelMs2).toBeGreaterThan(
      calme.drivetrain.brakeDownshiftAccelMs2,
    )
  })

  it('garde le plancher de croisière au-dessus du ralenti, quel que soit le moteur', () => {
    for (const engine of ['diesel', 'essence', 'sportif'] as const) {
      for (const temperament of ['calme', 'equilibre', 'sportif'] as const) {
        const p = buildProfile(choices({ engine, temperament }), template)
        expect(p.drivetrain.cruiseMinRpm).toBeGreaterThan(p.engine.idleRpm)
        expect(p.drivetrain.cruiseMinRpm).toBeLessThan(p.engine.redlineRpm * 0.5)
      }
    }
  })

  it('annonce dans l’aperçu le rapport que la boîte engage vraiment', () => {
    for (const temperament of ['calme', 'equilibre', 'sportif'] as const) {
      const p = buildProfile(choices({ temperament }), template)
      const ligne = describeProfile(p).find((l) => l.includes('allure tenue')) ?? ''
      // Le régime suit « à » sur cette ligne, le deux-points annonçant le
      // rapport : « 5e rapport à 1927 tr/min ».
      const annonce = Number(/à (\d+) tr\/min/.exec(ligne)?.[1])

      // L'aperçu calcule le rapport de croisière plutôt que de faire tourner la
      // boîte. Les deux doivent tomber d'accord, sinon l'aperçu promet autre
      // chose que ce qu'on entendra.
      expect(annonce).toBeCloseTo(croisiere(p, 90), -1)
    }
  })
})
