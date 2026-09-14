import { describe, expect, it } from 'vitest'

import {
  createDefaultProfile,
  knownFactoryProfiles,
  createFactoryProfiles,
  createRoadProfile,
  finalDriveFor,
  rpmAtSpeed,
} from './defaults'
import { Engine } from '../engine/engine'
import { Gearbox } from '../drivetrain/gearbox'
import { driveModeFromUpshiftRpm } from '../drivetrain/drive-mode'
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
  it("les nomme d'après leur moteur, et ne livre que des banques redistribuables", () => {
    // Un profil se nomme d'après ce qu'on entend, et non d'après une façon de
    // conduire : les seuils de passage se déduisent du rupteur et du
    // tempérament, pas d'un profil « Route » ou « Sport ».
    const profiles = createFactoryProfiles()

    // Le V8 croisé est **premier**, et ce n'est pas un détail de rangement : au
    // tout premier lancement, le profil actif est le premier de cette liste.
    // David les a écoutés le 14 septembre 2026 — « les V8 sonnent bien mieux que
    // les 4L ».
    expect(profiles.map((p) => p.id)).toEqual([
      'gm-ls',
      'gm-ls-long-header',
      'bmw-i6-3l',
      'subaru-ej25',
    ])
    expect(profiles[0]!.sampleDir).toBe('gm-ls')
  })

  it('livre le calibrage de la route, et non celui de Sport', () => {
    // Rupteur à 6 500, celui du GM LS livré, et des rapports placés sur les
    // vitesses qu'on pratique vraiment. Le nerf se prend au tempérament.
    const v8 = createFactoryProfiles().find((p) => p.id === 'gm-ls')!
    expect(v8.engine.redlineRpm).toBe(createRoadProfile().engine.redlineRpm)
    expect(v8.drivetrain.finalDrive).toBe(createRoadProfile().drivetrain.finalDrive)
  })

  it('garde les anciens calibrages accessibles, pour la reprise', () => {
    // Un profil « Route » ou « Sport » enregistré doit garder sa base à lui,
    // sinon il se voit complété avec les valeurs d'un autre.
    //
    // Le V8 de Procar y figure bien qu'il ne soit plus livré : c'est celui que
    // David a enregistré, et réinitialiser une de ses sections cherche ici son
    // profil d'origine. Sans lui, on lui rendrait le mixage d'une autre banque.
    expect(knownFactoryProfiles().map((p) => p.id)).toEqual([
      'gm-ls',
      'gm-ls-long-header',
      'bmw-i6-3l',
      'subaru-ej25',
      'v8',
      'route',
      'procar',
    ])
  })

  it('les fait tous sonner par échantillons, et décrit quand même leur moteur', () => {
    // Les trois banques livrées sont produites au banc, donc « générées à
    // l'avance ». La définition de moteur les accompagne : ce sont les
    // vingt-neuf nombres qui ont produit ce son-là, et basculer un profil en
    // direct doit donner un son, pas un formulaire à remplir avant d'entendre
    // quoi que ce soit.
    for (const livre of createFactoryProfiles()) {
      expect(livre.soundSource).toBe('prerendered')
      expect(livre.engineDefinition?.cylinders).toBe(livre.engine.cylinders)
    }

    const cylindres = createFactoryProfiles().map((p) => p.engine.cylinders)
    expect(cylindres).toEqual([8, 8, 6, 4])
  })

  it('rend des copies neuves à chaque appel', () => {
    const premier = createFactoryProfiles()
    premier[0]!.engine.redlineRpm = 42

    expect(createFactoryProfiles()[0]?.engine.redlineRpm).not.toBe(42)
  })

  it('place la croisière du profil Route bien plus bas que celle du profil Sport', () => {
    // C'est la raison d'être du profil Route : à 130 km/h en dernier rapport,
    // 1508 tr/min au lieu de 3390. Le README annonce ces deux chiffres.
    //
    // C'était 2780 avant la sortie du 11 septembre 2026 : la septième et le
    // haut réétagé ont fait tomber la croisière de mille tours.
    const regime = (p: Profile) => {
      const { gearRatios, finalDrive, wheelRadiusM } = p.drivetrain
      return rpmAtSpeed(130, gearRatios[gearRatios.length - 1] ?? 1, finalDrive, wheelRadiusM)
    }

    expect(regime(createRoadProfile())).toBeCloseTo(1508, -2)
    expect(regime(createDefaultProfile())).toBeCloseTo(3390, -2)
  })

  /**
   * Les trois vitesses que David a nommées après la sortie du 11 septembre
   * 2026, et le rapport qu'il veut y trouver : « idéalement il faudrait qu'on
   * soit dans une plage confortable (basse) à 50 en 4, 80 en 5 et 110 en 6 ».
   *
   * Ce test tient l'étagement : il échouera si quelqu'un touche aux rapports
   * sans mesurer ce que ça fait à ces trois points.
   */
  it('tient les trois vitesses de référence du profil Route', () => {
    const p = createRoadProfile()
    const regime = (kmh: number, gear: number) =>
      rpmAtSpeed(kmh, p.drivetrain.gearRatios[gear] ?? 1, p.drivetrain.finalDrive, p.drivetrain.wheelRadiusM)

    expect(p.drivetrain.gearRatios).toHaveLength(7)
    expect(regime(50, 3)).toBeCloseTo(1487, -2)
    expect(regime(80, 4)).toBeCloseTo(1737, -2)
    expect(regime(110, 5)).toBeCloseTo(1734, -2)
    expect(regime(130, 6)).toBeCloseTo(1508, -2)
  })

  /**
   * Une boîte bien étagée a des sauts réguliers : le régime retombe d'autant à
   * chaque passage. L'ancienne s'écrasait en haut — 1,32 · 1,20 · 1,19 — ce
   * qui rendait les trois derniers rapports presque interchangeables.
   */
  it('étage le haut du profil Route régulièrement', () => {
    const ratios = createRoadProfile().drivetrain.gearRatios
    const sauts = ratios.slice(0, -1).map((ratio, i) => ratio / (ratios[i + 1] ?? ratio))

    for (const saut of sauts.slice(2)) {
      expect(saut).toBeGreaterThan(1.3)
      expect(saut).toBeLessThan(1.45)
    }
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
    // Le tempérament vit dans le mode depuis le 10 septembre 2026, et c'est
    // l'application qui le déduit du profil au chargement : un banc qui
    // l'oublierait ferait conduire Sport comme Route.
    const gearbox = new Gearbox(
      p.drivetrain,
      p.engine,
      p.feel,
      driveModeFromUpshiftRpm(p.drivetrain.upshiftRpm, p.engine.redlineRpm),
    )
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

    // Mesuré après les sept rapports : 1820 à 30 km/h, 1487 à 50, 1520 à 70,
    // 1954 à 90, 1734 à 110, 1508 à 130. C'était 1820 / 1532 / 1790 / 1927 /
    // 2355 avant. C'est ce tableau que ce test protège d'un réglage futur
    // maladroit.
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

  it('engage le dernier rapport sur route ouverte, avec le profil Route', () => {
    // Le tirage au sort est neutralisé : la septième entre vers 124 km/h, et à
    // 130 le tirage suffisait à décider seul du rapport obtenu — ce test
    // échouait une fois sur deux. C'est le point d'entrée qui est dispersé, ce
    // qui est le rôle du tirage ; une fois engagée, elle ne se rend pas.
    const base = createRoadProfile()
    const p = { ...base, drivetrain: { ...base.drivetrain, upshiftJitterRpm: 0 } }
    const dernier = p.drivetrain.gearRatios.length - 1

    // La septième est un rapport d'autoroute : à 90 km/h elle tournerait à
    // 1044 tr/min, et la boîte a raison de ne pas l'engager.
    expect(croisiere(p, 90).gear).toBe(dernier - 2)
    expect(croisiere(p, 120).gear).toBe(dernier - 1)
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
