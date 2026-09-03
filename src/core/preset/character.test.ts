import { describe, expect, it } from 'vitest'

import {
  MAX_GEARS,
  applySportiness,
  resizeGearTables,
  responsivenessOf,
  shiftDelaysFor,
  sportinessOf,
  upshiftTableFor,
} from './character'
import { createDefaultProfile, createRoadProfile } from './defaults'
import { applyOrigin, captureOrigin } from './store'
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

/**
 * Ce que fait la boîte sur quatre-vingt-dix secondes de vitesse tenue.
 *
 * Le régime obtenu et le nombre de passages : le premier dit si la boîte dort,
 * le second si elle brasse. Les deux se lisent sur la boîte elle-même et non
 * sur les réglages — c'est ce qu'on entendra.
 */
function cruise(profile: Profile, kmh: number): { gear: number; rpm: number; shifts: number } {
  const gearbox = new Gearbox(profile.drivetrain, profile.engine, profile.feel)
  const inGear = (gear: number) => rpmInGear(profile, gear, kmh)
  let gear = 0
  let shifts = 0
  for (let frame = 0; frame * (1 / 60) <= 90; frame += 1) {
    const state = gearbox.tick(1 / 60, {
      rpmInGear: inGear,
      atStandstill: false,
      load: 0.5,
      kmh,
      accelMs2: 0,
    })
    if (state.gear !== gear) shifts += 1
    gear = state.gear
  }
  return { gear, rpm: inGear(gear), shifts }
}

/** Régime auquel la boîte finit par croiser, à vitesse tenue. */
function cruiseRpm(profile: Profile, kmh: number): number {
  return cruise(profile, kmh).rpm
}

/**
 * Accélération franche depuis l'arrêt, à 2,5 m/s² jusqu'à 150 km/h.
 *
 * Rend le rapport atteint, le nombre de passages et la pointe de régime : c'est
 * là qu'un profil injouable se voit, soit parce qu'il tape dans le rupteur, soit
 * parce qu'il monte les rapports au pas.
 */
function fullThrottle(profile: Profile): { gear: number; shifts: number; peakRpm: number } {
  const gearbox = new Gearbox(profile.drivetrain, profile.engine, profile.feel)
  const dt = 1 / 60
  let shifts = 0
  let gear = 0
  let kmh = 0
  let peakRpm = 0
  for (let frame = 0; frame < 60 * 40; frame += 1) {
    kmh = Math.min(150, kmh + 2.5 * 3.6 * dt)
    const inGear = (g: number) => rpmInGear(profile, g, kmh)
    const state = gearbox.tick(dt, {
      rpmInGear: inGear,
      atStandstill: kmh < 1,
      load: 0.95,
      kmh,
      accelMs2: 2.5,
    })
    if (state.gear !== gear) shifts += 1
    gear = state.gear
    peakRpm = Math.max(peakRpm, inGear(gear))
  }
  return { gear, shifts, peakRpm }
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

describe('le curseur « calme ↔ sportif »', () => {
  it('se relit exactement là où on l’a posé', () => {
    // C'est ce qui permet au curseur de refléter le profil courant sans sauter
    // quand on le relâche. Mesuré sur toute la course, des deux profils
    // livrés : l'écart maximal entre position posée et position relue est de
    // 0,0001 — un dixième de millième de cran.
    let pire = 0
    for (const modele of [route, sport]) {
      for (let i = 0; i <= 100; i += 1) {
        const voulu = i / 100
        pire = Math.max(pire, Math.abs(sportinessOf(applySportiness(modele, voulu)) - voulu))
      }
    }
    expect(pire).toBeLessThan(0.001)
  })

  it('change le caractère de la boîte de façon audible', () => {
    const calme = applySportiness(route, 0)
    const sportif = applySportiness(route, 1)

    // Mesuré sur une accélération franche : la pointe de régime passe de 3929 à
    // 6043 tr/min pour un rupteur à 6500, et la boîte n'est plus qu'en
    // quatrième à 150 km/h là où le profil calme est en sixième.
    //
    // Les bornes laissent la place à la dispersion : la boîte tire au sort
    // ±120 tr/min à chaque passage sur ce profil, exprès, pour ne pas sonner
    // comme une machine. Le relevé varie donc d'une exécution à l'autre.
    const bande = route.drivetrain.upshiftJitterRpm * 2
    expect(fullThrottle(calme).peakRpm).toBeGreaterThan(3929 - bande)
    expect(fullThrottle(calme).peakRpm).toBeLessThan(3929 + bande)
    expect(fullThrottle(sportif).peakRpm).toBeGreaterThan(6043 - bande)
    expect(fullThrottle(sportif).peakRpm).toBeLessThan(6043 + bande)
    expect(fullThrottle(sportif).gear).toBeLessThan(fullThrottle(calme).gear)

    expect(sportif.engine.inertia).toBeLessThan(calme.engine.inertia)
    expect(sportif.drivetrain.shiftTimeMs).toBeLessThan(calme.drivetrain.shiftTimeMs)
    expect(sportif.drivetrain.cruiseMinRpm).toBeGreaterThan(calme.drivetrain.cruiseMinRpm)
    expect(sportif.feel.shiftJolt.depth).toBeGreaterThan(calme.feel.shiftJolt.depth)
  })

  it('reste jouable aux deux extrêmes : ni boîte qui brasse, ni boîte qui dort', () => {
    for (const modele of [route, sport]) {
      for (const s of [0, 1]) {
        const p = applySportiness(modele, s)

        // Ne brasse pas : à vitesse tenue, la boîte monte ses rapports une fois
        // et s'arrête. Mesuré : cinq passages au plus sur nonante secondes à
        // 110 km/h, soit la montée de la première à la sixième.
        const tenue = cruise(p, 110)
        expect(tenue.shifts).toBeLessThanOrEqual(p.drivetrain.gearRatios.length)

        // Ne dort pas : le régime de croisière reste au-dessus du plancher, et
        // loin du rupteur. Mesuré : 2355 tr/min sur Route, 2865 sur Sport, à
        // 110 km/h et quel que soit le curseur — il ne touche pas au pont.
        expect(tenue.rpm).toBeGreaterThanOrEqual(p.drivetrain.cruiseMinRpm)
        expect(tenue.rpm).toBeLessThan(p.engine.redlineRpm * 0.6)

        // Et pied au plancher, elle n'attaque pas le rupteur. Mesuré : 93 % du
        // rupteur au plus sportif, ce qui laisse la marge du limiteur.
        const franche = fullThrottle(p)
        expect(franche.peakRpm).toBeLessThan(p.engine.redlineRpm)
        expect(franche.shifts).toBeLessThanOrEqual(p.drivetrain.gearRatios.length)
      }
    }
  })

  it('reprend sans incohérence un profil réglé à la main', () => {
    // Route a ses seuils placés en vitesse, donc décroissants — ce qu'aucune loi
    // ne produit. Le curseur les refait : ils doivent redevenir une rampe
    // cohérente, et la boîte rester utilisable.
    const repris = applySportiness(route, 0.6)

    const { upshiftRpm } = repris.drivetrain
    for (let i = 1; i < upshiftRpm.length; i += 1) {
      expect(upshiftRpm[i]!).toBeGreaterThan(upshiftRpm[i - 1]!)
    }
    expect(repris.drivetrain.minUpshiftRpm).toBeLessThan(upshiftRpm[0]!)
    // La première ne hurle pas au démarrage : à la vitesse où elle cède la
    // place, elle est encore loin de son seuil de passage.
    const auLancement = rpmInGear(repris, 0, repris.drivetrain.launchUpshiftKmh)
    expect(auLancement).toBeLessThan(upshiftRpm[0]!)
    expect(cruiseRpm(repris, 110)).toBeGreaterThanOrEqual(repris.drivetrain.cruiseMinRpm)
  })

  it('ne touche ni au pont, ni aux démultiplications, ni au signal', () => {
    // Le tempérament n'est pas la mécanique : un curseur de caractère qui
    // déplacerait le pont changerait la vitesse à laquelle on croise.
    for (const s of [0, 0.5, 1]) {
      const p = applySportiness(route, s)
      expect(p.drivetrain.finalDrive).toBe(route.drivetrain.finalDrive)
      expect(p.drivetrain.gearRatios).toEqual(route.drivetrain.gearRatios)
      expect(p.engine.redlineRpm).toBe(route.engine.redlineRpm)
      expect(p.engine.idleRpm).toBe(route.engine.idleRpm)
      expect(p.speed).toEqual(route.speed)
      expect(p.mix).toEqual(route.mix)
      expect(p.layers).toEqual(route.layers)
    }
  })

  it('laisse à la main les interrupteurs qu’on a mis exprès', () => {
    // La pétarade s'éteint au plus calme — c'est la règle du guide, une voiture
    // tranquille ne claque pas. Le rétrogradage forcé et l'à-coup, eux, ne se
    // coupent jamais : couper ce que quelqu'un a activé n'est pas un caractère.
    expect(applySportiness(route, 0).feel.backfire.enabled).toBe(false)
    expect(applySportiness(route, 0.5).feel.backfire.enabled).toBe(true)
    expect(applySportiness(route, 0).feel.kickdown.enabled).toBe(
      route.feel.kickdown.enabled,
    )
    expect(applySportiness(route, 0).feel.shiftJolt.enabled).toBe(
      route.feel.shiftJolt.enabled,
    )
  })

  it('se laisse défaire : on retrouve l’état d’avant le mouvement', () => {
    // L'état de retour est celui du lot ORIGINE, pris à la volée juste avant le
    // premier mouvement. C'est ce qui rend le geste sans risque.
    const retour = captureOrigin(route)

    const gache = applySportiness(applySportiness(route, 1), 0.2)
    const rendu = applyOrigin(gache, retour)

    expect(rendu.drivetrain).toEqual(route.drivetrain)
    expect(rendu.engine).toEqual(route.engine)
    expect(rendu.feel).toEqual(route.feel)
    // L'identité ne bouge pas au passage.
    expect(rendu.id).toBe(route.id)
    expect(rendu.name).toBe(route.name)
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
