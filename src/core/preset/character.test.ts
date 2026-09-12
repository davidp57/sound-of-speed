import { describe, expect, it } from 'vitest'

import {
  MAX_GEARS,
  SIMPLE_GEAR_COUNTS,
  applyResponsiveness,
  applySportiness,
  gearRatiosFor,
  resizeGearTables,
  responsivenessOf,
  setGearCount,
  shiftDelaysFor,
  sportinessOf,
  upshiftTableFor,
} from './character'
import { createDefaultProfile, createRoadProfile } from './defaults'
import { applyOrigin, captureOrigin } from './store'
import { Engine } from '../engine/engine'
import { Gearbox } from '../drivetrain/gearbox'
import { SpeedConditioner } from '../speed/conditioner'
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
  // La reprise s'arrête à 150 km/h, et le relevé avec elle.
  //
  // Le banc tenait ensuite la vitesse pendant vingt-trois secondes tout en
  // annonçant 2,5 m/s² : la boîte voyait une accélération franche là où la
  // vitesse ne bougeait plus. Elle juge maintenant la croisière sur la vitesse,
  // et empilait donc ses rapports pendant ce plateau — les deux profils
  // finissaient en sixième, ce que le test comparait. Le sujet est le rapport
  // engagé **à 150 km/h en reprise**, pas celui atteint en croisière ensuite.
  for (let frame = 0; frame < 60 * 40 && kmh < 150; frame += 1) {
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

    // **Le tempérament de passage a déménagé.** Ce test relevait la pointe de
    // régime — 3929 tr/min au plus calme, 6043 au plus sportif — parce que le
    // curseur écrivait les régimes de passage. Ils se déduisent maintenant du
    // **mode de conduite** et du rupteur du moteur, et le curseur ne commande
    // plus la boîte de cette façon : la pointe ne bouge donc plus avec lui.
    //
    // Le curseur écrit toujours la table, qui n'est plus lue. C'est une écriture
    // morte, à retirer avec les curseurs globaux — la retirer ici changerait la
    // façon dont le tempérament d'un profil se **lit**, donc six autres tests,
    // et ce n'est pas le sujet de ce lot.
    expect(fullThrottle(sportif).peakRpm).toBeCloseTo(fullThrottle(calme).peakRpm, -3)

    // Ce que le curseur change encore, et qui s'entend :
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

        // Ne dort pas : le régime de croisière reste bien au-dessus du ralenti
        // et loin du rupteur. Mesuré à 110 km/h : 1734 tr/min sur Route depuis
        // les sept rapports — c'était 2355 —, 2865 sur Sport, quel que soit le
        // curseur, qui ne touche pas au pont.
        //
        // La comparaison portait sur `cruiseMinRpm`, et elle ne veut plus rien
        // dire : depuis le lot PLANCHER, ce réglage ne pilote plus la boîte —
        // il ne sert qu'au guide de création — et sa loi de caractère le monte
        // à 1950 en plein sportif, au-dessus de ce qu'une boîte à rapports
        // longs peut tenir.
        expect(tenue.rpm).toBeGreaterThanOrEqual(p.engine.idleRpm * 1.6)
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

/**
 * Bruit de mesure reproductible, ±amplitude en km/h.
 *
 * Un GPS ne livre pas une rampe propre : sans bruit, la mesure de continuité ne
 * mesure rien, le conditionneur extrapolant exactement entre deux points
 * alignés.
 */
function jitter(seed: number, amplitude: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return (x - Math.floor(x) - 0.5) * 2 * amplitude
}

/**
 * Suivi d'une rampe de 0 à 90 km/h en quinze secondes, bruitée à ±1 km/h.
 *
 * Rend la plus grande **marche** — l'écart de vitesse conditionnée d'une image
 * à la suivante, ce qui s'entendrait comme un saut de hauteur — et le **retard**
 * maximal sur la vitesse vraie, exprimé en millisecondes de la rampe.
 */
function tracking(profile: Profile, cadenceMs: number): { stepKmh: number; lagMs: number } {
  const conditioner = new SpeedConditioner(profile.speed)
  const dt = 1 / 60
  const vraie = (secs: number) => (secs < 15 ? (90 * secs) / 15 : 90)
  let nextSample = 0
  let seed = 0
  let previous = 0
  let stepKmh = 0
  let lagKmh = 0
  for (let frame = 0; frame < 60 * 25; frame += 1) {
    const at = frame * dt * 1000
    if (at >= nextSample) {
      seed += 1
      conditioner.push({
        kmh: vraie(at / 1000) + jitter(seed, 1),
        at,
        accuracyM: 5,
        derived: false,
      })
      nextSample = at + cadenceMs
    }
    const out = conditioner.tick(dt)
    const secs = at / 1000
    // Les trois premières secondes sont écartées : le ressort part de zéro et
    // son rattrapage initial n'est pas un défaut de suivi.
    if (secs > 3 && secs < 14) {
      stepKmh = Math.max(stepKmh, Math.abs(out.kmh - previous))
      lagKmh = Math.max(lagKmh, vraie(secs) - out.kmh)
    }
    previous = out.kmh
  }
  // La rampe monte de 6 km/h par seconde : un retard en vitesse s'y convertit
  // en retard de temps.
  return { stepKmh, lagMs: (lagKmh / 6) * 1000 }
}

describe('le curseur « pépère ↔ nerveux »', () => {
  it('se relit exactement là où on l’a posé', () => {
    let pire = 0
    for (const modele of [route, sport]) {
      for (let i = 0; i <= 100; i += 1) {
        const voulu = i / 100
        pire = Math.max(pire, Math.abs(responsivenessOf(applyResponsiveness(modele, voulu)) - voulu))
      }
    }
    // Mesuré : 0,0005 au plus, soit un vingtième de cran sur cent.
    expect(pire).toBeLessThan(0.001)
  })

  it('ne touche pas au caractère réglé par l’autre curseur', () => {
    // La distinction est tout l'objet de ce second curseur : une voiture calme
    // peut être vive, une sportive pâteuse. Les deux lectures sont donc prises
    // sur des réglages disjoints.
    const cale = applySportiness(route, 0.7)

    for (const r of [0, 0.5, 1]) {
      const p = applyResponsiveness(cale, r)
      expect(sportinessOf(p)).toBeCloseTo(0.7, 3)
      expect(p.engine).toEqual(cale.engine)
      expect(p.feel).toEqual(cale.feel)
      expect(p.drivetrain.upshiftRpm).toEqual(cale.drivetrain.upshiftRpm)
      expect(p.drivetrain.cruiseMinRpm).toBe(cale.drivetrain.cruiseMinRpm)
    }
  })

  it('garde la vitesse continue au plus nerveux', () => {
    const nerveux = applyResponsiveness(route, 1)

    // Mesuré sur une rampe bruitée à ±1 km/h, à la cadence la plus défavorable
    // — une mesure par seconde : la vitesse conditionnée bouge de 0,675 km/h
    // par image au plus. Elle ne saute pas : le ressort est amorti critique, et
    // 0,675 km/h vaut une quinzaine de tours par minute en dernier rapport.
    const lent = tracking(nerveux, 1000)
    expect(lent.stepKmh).toBeCloseTo(0.675, 2)
    expect(lent.stepKmh).toBeLessThan(1)

    // À la cadence du GPS d'une Tesla en mouvement, la marche tombe à 0,376 :
    // plus le GPS parle, plus le suivi est doux.
    expect(tracking(nerveux, 33).stepKmh).toBeCloseTo(0.376, 2)
  })

  it('garde un retard supportable au plus pépère', () => {
    const pepere = applyResponsiveness(route, 0)

    // Mesuré : 556 ms de retard à la cadence d'un hertz, 334 ms à trente-trois
    // millisecondes. Une demi-seconde est tenable en conduite — c'est le prix
    // de la douceur, et c'est ce que l'extrême de ce curseur achète.
    const lent = tracking(pepere, 1000)
    expect(lent.lagMs).toBeCloseTo(556, -1)
    expect(lent.lagMs).toBeLessThan(700)
    expect(tracking(pepere, 33).lagMs).toBeLessThan(400)

    // Et il est bien plus doux que le nerveux : 0,242 km/h par image contre
    // 0,675.
    expect(lent.stepKmh).toBeLessThan(tracking(applyResponsiveness(route, 1), 1000).stepKmh)
  })

  it('retrouve au milieu le réglage des profils livrés', () => {
    // Le milieu du curseur n'est pas un compromis inventé : c'est le réglage
    // qui a servi jusqu'ici. Mesuré : 0,433 km/h par image et 409 ms de retard.
    const milieu = applyResponsiveness(route, 0.5)

    expect(milieu.speed.springOmega).toBe(route.speed.springOmega)
    expect(milieu.speed.accelWindowMs).toBe(route.speed.accelWindowMs)
    const suivi = tracking(milieu, 1000)
    expect(suivi.stepKmh).toBeCloseTo(0.433, 2)
    expect(suivi.lagMs).toBeCloseTo(409, -1)
  })

  it('se combine avec le tempérament sans produire de profil injouable', () => {
    for (const s of [0, 1]) {
      for (const r of [0, 1]) {
        const p = applyResponsiveness(applySportiness(route, s), r)

        expect(sportinessOf(p)).toBeCloseTo(s, 2)
        expect(responsivenessOf(p)).toBeCloseTo(r, 2)

        // La boîte ne brasse pas et ne dort pas, quelle que soit la combinaison.
        const tenue = cruise(p, 110)
        expect(tenue.shifts).toBeLessThanOrEqual(p.drivetrain.gearRatios.length)
        expect(tenue.rpm).toBeGreaterThanOrEqual(p.engine.idleRpm * 1.6)
        expect(fullThrottle(p).peakRpm).toBeLessThan(p.engine.redlineRpm)

        // Et le signal reste dans les bornes que l'écran de configuration
        // affiche, donc réglable ensuite à la main.
        expect(p.speed.springOmega).toBeGreaterThanOrEqual(2)
        expect(p.speed.springOmega).toBeLessThanOrEqual(40)
        expect(p.speed.accelWindowMs).toBeGreaterThanOrEqual(200)
        expect(p.speed.accelWindowMs).toBeLessThanOrEqual(3000)
        expect(p.mix.loadSmoothingS).toBeGreaterThanOrEqual(0.02)
        expect(p.mix.loadSmoothingS).toBeLessThanOrEqual(1.5)
        for (const delay of p.drivetrain.shiftDelaysS) expect(delay).toBeGreaterThan(0)
      }
    }
  })
})

describe('les tables suivent le nombre de rapports', () => {
  it('rend tel quel un profil dont le nombre de rapports ne change pas', () => {
    expect(resizeGearTables(route, route.drivetrain.gearRatios.length)).toBe(route)
    expect(resizeGearTables(sport, sport.drivetrain.gearRatios.length)).toBe(sport)
  })

  it('ne laisse aucune valeur orpheline, en ajoutant comme en retirant', () => {
    for (const count of [3, 4, 5, 7, 8]) {
      const { drivetrain } = resizeGearTables(route, count)
      expect(drivetrain.upshiftRpm).toHaveLength(count - 1)
      expect(drivetrain.shiftDelaysS).toHaveLength(count)
    }
  })

  it('donne au rapport ajouté un seuil cohérent avec ses voisins', () => {
    // Un rapport de plus que le profil n'en a : le seuil neuf ne peut pas
    // hériter de son prédécesseur, il s'intercale.
    const count = route.drivetrain.gearRatios.length + 1
    const { upshiftRpm } = resizeGearTables(route, count).drivetrain

    expect(upshiftRpm).toHaveLength(count - 1)
    for (let i = 1; i < upshiftRpm.length; i += 1) {
      expect(upshiftRpm[i]!).toBeGreaterThan(upshiftRpm[i - 1]!)
    }
    // Aucun doublon, donc aucun seuil recopié d'un voisin.
    expect(new Set(upshiftRpm).size).toBe(upshiftRpm.length)
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

describe('le nombre de rapports se change en un geste', () => {
  it('donne le nombre demandé, étagé du plus court au plus long', () => {
    for (const n of SIMPLE_GEAR_COUNTS) {
      const { gearRatios } = setGearCount(route, n).drivetrain

      expect(gearRatios).toHaveLength(n)
      for (let i = 1; i < gearRatios.length; i += 1) {
        expect(gearRatios[i]!).toBeLessThan(gearRatios[i - 1]!)
      }
    }
  })

  it('garde le premier et le dernier rapport, donc le régime en dernier', () => {
    // C'est la contrainte qui a motivé le profil Route : le rapport le plus long
    // doit tourner à un régime tenable à la vitesse de croisière habituelle.
    // Mesuré : 1276 tr/min à 110 km/h sur Route en dernier rapport, quel que
    // soit leur nombre, et 2865 sur Sport. C'était 2355 sur Route avant la
    // septième — le dernier rapport y est un rapport d'autoroute, et 110 km/h
    // n'est pas sa vitesse.
    for (const modele of [route, sport]) {
      const ratios = modele.drivetrain.gearRatios
      const attendu = rpmInGear(modele, ratios.length - 1, 110)

      for (const n of SIMPLE_GEAR_COUNTS) {
        const p = setGearCount(modele, n)
        expect(p.drivetrain.gearRatios[0]).toBe(ratios[0])
        expect(p.drivetrain.gearRatios[n - 1]).toBe(ratios[ratios.length - 1])
        expect(p.drivetrain.finalDrive).toBe(modele.drivetrain.finalDrive)
        expect(rpmInGear(p, n - 1, 110)).toBeCloseTo(attendu, 3)
      }
      expect(attendu).toBeCloseTo(modele.id === 'route' ? 1276 : 2865, -1)
    }
  })

  it('reste cohérente et jouable de trois à huit rapports', () => {
    for (const modele of [route, sport]) {
      for (const n of SIMPLE_GEAR_COUNTS) {
        const p = setGearCount(modele, n)

        // La boîte monte une fois et s'y tient : au plus n − 1 passages sur
        // nonante secondes, et jamais de va-et-vient.
        //
        // Elle ne va plus forcément jusqu'au dernier rapport : depuis la
        // septième, celui-ci est un rapport d'autoroute — 1276 tr/min à
        // 110 km/h sur Route —, et une boîte a raison de ne pas l'engager si
        // bas. Ce que ce test protège est qu'elle se pose et n'hésite plus.
        const tenue = cruise(p, 110)
        expect(tenue.gear).toBeGreaterThan(0)
        expect(tenue.gear).toBeLessThanOrEqual(n - 1)
        expect(tenue.shifts).toBe(tenue.gear)

        // Et pied au plancher elle ne tape pas dans le rupteur.
        expect(fullThrottle(p).peakRpm).toBeLessThan(p.engine.redlineRpm)

        expect(p.drivetrain.upshiftRpm).toHaveLength(n - 1)
        expect(p.drivetrain.shiftDelaysS).toHaveLength(n)
      }
    }
  })

  it('ne fait pas hurler la première dès le démarrage', () => {
    // Mesuré : 528 tr/min sur Route à 5 km/h, pour un seuil de passage à 3110 —
    // et 1027 sur Sport à 8 km/h pour un seuil à 5338. La première a de la
    // marge, quel que soit le nombre de rapports.
    for (const modele of [route, sport]) {
      for (const n of SIMPLE_GEAR_COUNTS) {
        const p = setGearCount(modele, n)
        const auLancement = rpmInGear(p, 0, p.drivetrain.launchUpshiftKmh)

        expect(auLancement).toBeLessThan(p.drivetrain.upshiftRpm[0]!)
        expect(auLancement).toBeLessThan(p.engine.redlineRpm * 0.3)
      }
    }
  })

  it('rend tel quel un profil qui a déjà ce nombre de rapports', () => {
    expect(setGearCount(route, route.drivetrain.gearRatios.length)).toBe(route)
    expect(setGearCount(sport, sport.drivetrain.gearRatios.length)).toBe(sport)
  })

  it('reprend l’étagement du guide quand la boîte n’en a pas', () => {
    // Une prise directe n'a ni premier ni dernier rapport distincts : il n'y a
    // rien à conserver, et l'étagement du guide de création sert de repli.
    const directe: Profile = {
      ...route,
      drivetrain: { ...route.drivetrain, gearRatios: [1] },
    }

    const { gearRatios } = setGearCount(directe, 5).drivetrain

    expect(gearRatios[0]).toBe(3.6)
    expect(gearRatios[4]).toBe(0.72)
  })

  it('étage géométriquement, donc à écarts de régime égaux', () => {
    // C'est le propre d'une boîte bien étagée : le rapport d'un rapport au
    // suivant est constant.
    const ratios = gearRatiosFor(7, 3.6, 0.72)

    const ecarts = ratios.slice(1).map((r, i) => ratios[i]! / r)
    for (const ecart of ecarts) expect(ecart).toBeCloseTo(ecarts[0]!, 2)
  })
})

describe('caractère — le clac de passage', () => {
  /**
   * Les deux lois se répondent : la baisse de trente pour cent demandée le
   * 11 septembre 2026 porte sur la montée seule, à tout caractère.
   */
  it('baisse la montée de trente pour cent sans toucher au rétrogradage', () => {
    for (const s of [0, 0.25, 0.5, 0.75, 1]) {
      const jolt = applySportiness(createRoadProfile(), s).feel.shiftJolt

      // Les lois d'avant la sortie, telles qu'elles étaient écrites.
      const clackAvant = 0.35 + 0.35 * s
      const descenteAvant = clackAvant * (0.5 + 0.15 * s)

      expect(jolt.clack).toBeCloseTo(clackAvant * 0.7, 2)
      expect(jolt.clack * jolt.clackDownshift).toBeCloseTo(descenteAvant, 2)
    }
  })
})
