import { afterEach, describe, expect, it, vi } from 'vitest'

import { Gearbox } from './gearbox'
import { Engine } from '../engine/engine'
import { createDefaultProfile } from '../preset/defaults'
import type { DrivetrainPreset, FeelPreset, Profile } from '../preset/schema'

/**
 * Tests de la boîte de vitesses.
 *
 * Le banc reproduit une montée en vitesse et une décélération, en fournissant à
 * la boîte le régime qu'aurait le moteur dans chaque rapport — exactement ce que
 * fait l'assemblage réel. On relève ensuite à quel régime chaque passage s'est
 * produit, et on le compare au réglage.
 *
 * La dispersion aléatoire est mise à zéro dans la plupart des tests : elle est
 * vérifiée pour elle-même, à part. Sans cela, aucune assertion sur un régime de
 * passage ne serait reproductible.
 */

const FRAME_S = 1 / 60

/**
 * Accélération par défaut : nulle.
 *
 * Chaque appel de `tick` la nomme, et c'est la liaison la plus proche qui
 * décide — le banc `drive` la calcule depuis son profil de vitesse, les tests
 * qui en font leur sujet la déclarent eux-mêmes.
 */
const accelMs2 = 0

/** Profil de test : dispersion nulle, pour que les passages soient déterministes. */
function profile(over: Partial<DrivetrainPreset> = {}, feel: Partial<FeelPreset> = {}): Profile {
  const base = createDefaultProfile()
  return {
    ...base,
    drivetrain: { ...base.drivetrain, upshiftJitterRpm: 0, ...over },
    feel: { ...base.feel, ...feel },
  }
}

function makeGearbox(p: Profile): Gearbox {
  return new Gearbox(p.drivetrain, p.engine, p.feel)
}

/** Régime qu'aurait le moteur dans un rapport donné, à une vitesse donnée. */
function rpmInGearAt(p: Profile, kmh: number) {
  return (gear: number) =>
    Engine.kinematicRpm(
      kmh,
      (p.drivetrain.gearRatios[gear] ?? 1) * p.drivetrain.finalDrive,
      p.drivetrain.wheelRadiusM,
    )
}

/** Vitesse à laquelle un rapport atteint un régime donné. */
function kmhForRpm(p: Profile, gear: number, rpm: number): number {
  const ratio = (p.drivetrain.gearRatios[gear] ?? 1) * p.drivetrain.finalDrive
  const wheelRps = rpm / 60 / ratio
  return wheelRps * 2 * Math.PI * p.drivetrain.wheelRadiusM * 3.6
}

interface Shift {
  from: number
  to: number
  kmh: number
  rpm: number
}

/**
 * Fait rouler la boîte sur un profil de vitesse, et relève chaque changement de
 * rapport avec le régime auquel il s'est produit.
 */
function drive(
  p: Profile,
  speedAt: (t: number) => number,
  seconds: number,
  load = 0.5,
): { shifts: Shift[]; gearbox: Gearbox; last: ReturnType<Gearbox['tick']> } {
  const gearbox = makeGearbox(p)
  const shifts: Shift[] = []
  let previous = 0
  let last = gearbox.tick(FRAME_S, { rpmInGear: rpmInGearAt(p, 0), atStandstill: true, load: load, kmh: 0, accelMs2 })

  for (let frame = 1; frame * FRAME_S <= seconds; frame += 1) {
    const t = frame * FRAME_S
    const kmh = speedAt(t)
    // L'accélération vient du profil de vitesse lui-même : un banc qui
    // simulerait une vitesse sans l'accélération correspondante mentirait à la
    // boîte, et les règles qui en dépendent se vérifieraient sur une fiction.
    const accelMs2 = (kmh - speedAt(t - FRAME_S)) / FRAME_S / 3.6
    const rpmInGear = rpmInGearAt(p, kmh)
    const before = rpmInGear(previous)
    last = gearbox.tick(FRAME_S, { rpmInGear: rpmInGear, atStandstill: kmh < 1, load: load, kmh: kmh, accelMs2 })
    if (last.gear !== previous) {
      shifts.push({ from: previous, to: last.gear, kmh, rpm: before })
      previous = last.gear
    }
  }
  return { shifts, gearbox, last }
}

/**
 * Fait tourner la boîte à **vitesse fixe**, avec une charge et une accélération
 * pilotées dans le temps.
 *
 * Le banc `drive` fait varier la vitesse et en déduit l'accélération ; celui-ci
 * fait l'inverse — il tient la vitesse et déclare ce que la boîte doit croire de
 * son évolution. C'est ce qu'il faut pour les règles qui regardent la demande et
 * la tendance plutôt que le régime.
 */
function hold(
  p: Profile,
  kmh: number,
  seconds: number,
  at: (t: number) => { load: number; accelMs2: number },
): { shifts: { from: number; to: number; t: number }[]; gear: number } {
  const gearbox = makeGearbox(p)
  const rpmInGear = rpmInGearAt(p, kmh)
  const shifts: { from: number; to: number; t: number }[] = []
  let previous = gearbox.tick(FRAME_S, { rpmInGear, atStandstill: false, kmh, ...at(0) }).gear

  for (let frame = 1; frame * FRAME_S <= seconds; frame += 1) {
    const t = frame * FRAME_S
    const state = gearbox.tick(FRAME_S, { rpmInGear, atStandstill: false, kmh, ...at(t) })
    if (state.gear !== previous) {
      shifts.push({ from: previous, to: state.gear, t })
      previous = state.gear
    }
  }
  return { shifts, gear: previous }
}

/**
 * Horloge simulée pour l'anti-rebond des commandes manuelles.
 *
 * La boîte lit `Date.now()` directement. On ne fausse donc que `Date` — pas les
 * minuteurs, dont les tests n'ont pas besoin — et on avance le temps à la main :
 * les 220 ms d'anti-rebond deviennent vérifiables sans attendre.
 */
function fakeClock() {
  let now = 1_700_000_000_000
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(now)
  return {
    avance(ms: number) {
      now += ms
      vi.setSystemTime(now)
    },
  }
}

/**
 * Laisse un passage en cours s'achever, et l'anti-rebond s'écouler.
 *
 * Deux verrous distincts empêchent une commande manuelle d'aboutir : le passage
 * précédent tant qu'il court — mesuré en temps de boucle — et l'anti-rebond de
 * 220 ms — mesuré sur l'horloge. Les deux se lèvent séparément, d'où ces deux
 * gestes côte à côte.
 */
function laisseFinir(gearbox: Gearbox, horloge: { avance: (ms: number) => void }, p: Profile) {
  for (let f = 0; f * FRAME_S < 0.25; f += 1) {
    gearbox.tick(FRAME_S, { rpmInGear: rpmInGearAt(p, 80), atStandstill: false, load: 0.5, kmh: 80, accelMs2 })
  }
  horloge.avance(300)
}

afterEach(() => {
  vi.useRealTimers()
})

describe('Gearbox — montée des rapports', () => {
  it('passe chaque rapport au régime déclaré pour lui', () => {
    const p = profile()
    // Accélération douce : 4 km/h par seconde, pour que la temporisation ne
    // laisse pas filer le régime bien au-delà du seuil.
    const { shifts } = drive(p, (t) => t * 4, 60)

    // Le premier passage est celui de la première, qui ne suit aucun seuil de
    // régime : c'est une amorce, elle cède la place à la vitesse de lancement.
    const parRegime = shifts.filter((s) => s.from > 0)
    expect(parRegime.length).toBeGreaterThanOrEqual(4)

    for (const shift of parRegime) {
      const declared = p.drivetrain.upshiftRpm[shift.from]
      expect(declared).toBeDefined()
      // Le passage ne se produit jamais avant le seuil, et la temporisation ne
      // le laisse pas filer de plus de 400 tr/min — la marge de dépassement.
      expect(shift.rpm).toBeGreaterThanOrEqual(declared! - 1)
      expect(shift.rpm).toBeLessThan(declared! + 450)
    }
  })

  it('recule le seuil pied au plancher, et l’avance pied levé', () => {
    const p = profile()
    // Deux boîtes neuves, sous la vitesse de lancement : le rapport engagé est
    // le même des deux côtés, sinon on comparerait deux seuils différents.
    const kmh = p.drivetrain.launchUpshiftKmh - 3
    const plancher = makeGearbox(p).tick(FRAME_S, { rpmInGear: rpmInGearAt(p, kmh), atStandstill: false, load: 1, kmh: kmh, accelMs2 })
      .upshiftThresholdRpm
    const leve = makeGearbox(p).tick(FRAME_S, { rpmInGear: rpmInGearAt(p, kmh), atStandstill: false, load: 0, kmh: kmh, accelMs2 })
      .upshiftThresholdRpm

    // L'écart total vaut le réglage : 1800 tr/min entre les deux extrêmes.
    expect(plancher - leve).toBeCloseTo(p.drivetrain.upshiftLoadSpreadRpm, 0)
    expect(plancher).toBeGreaterThan(leve)
  })

  it('ne descend jamais le seuil sous le régime plancher', () => {
    // Plancher très haut : il doit primer sur le décalage de charge.
    const p = profile({ minUpshiftRpm: 5000 })
    const gearbox = makeGearbox(p)

    const state = gearbox.tick(FRAME_S, { rpmInGear: rpmInGearAt(p, 40), atStandstill: false, load: 0, kmh: 40, accelMs2 })

    expect(state.upshiftThresholdRpm).toBeGreaterThanOrEqual(5000)
  })

  it('attend la temporisation du rapport avant de passer', () => {
    const p = profile({ shiftDelaysS: [0.25, 1.5, 0.35, 0.55, 0.3, 0.45] })
    const gearbox = makeGearbox(p)

    // On se place en deuxième, juste au-dessus de son seuil, sans dépassement.
    const kmh = kmhForRpm(p, 1, p.drivetrain.upshiftRpm[1]! + 100)
    const rpmInGear = rpmInGearAt(p, kmh)
    gearbox.tick(FRAME_S, { rpmInGear: rpmInGear, atStandstill: false, load: 0.5, kmh: kmh, accelMs2 }) // amorce : quitte la première
    expect(gearbox.tick(FRAME_S, { rpmInGear: rpmInGear, atStandstill: false, load: 0.5, kmh: kmh, accelMs2 }).gear).toBe(1)

    // Un tiers de seconde : la condition est remplie, le passage est retenu.
    let state = gearbox.tick(FRAME_S, { rpmInGear: rpmInGear, atStandstill: false, load: 0.5, kmh: kmh, accelMs2 })
    for (let f = 0; f * FRAME_S < 0.33; f += 1) {
      state = gearbox.tick(FRAME_S, { rpmInGear: rpmInGear, atStandstill: false, load: 0.5, kmh: kmh, accelMs2 })
    }
    expect(state.gear).toBe(1)
    expect(state.isShiftReady).toBe(true)

    // Passé la temporisation d'une seconde et demie, il se produit.
    for (let f = 0; f * FRAME_S < 1.4; f += 1) {
      state = gearbox.tick(FRAME_S, { rpmInGear: rpmInGear, atStandstill: false, load: 0.5, kmh: kmh, accelMs2 })
    }
    expect(state.gear).toBe(2)
  })

  it('passe sans attendre quand le régime a dépassé la marge', () => {
    const p = profile({ shiftDelaysS: [5, 5, 5, 5, 5, 5] })
    const gearbox = makeGearbox(p)

    // Bien au-delà du seuil : la temporisation de cinq secondes est ignorée.
    const kmh = kmhForRpm(p, 1, p.drivetrain.upshiftRpm[1]! + 600)
    const rpmInGear = rpmInGearAt(p, kmh)
    // La première cède la place à la vitesse de lancement ; on laisse ce
    // passage s'achever avant de mesurer celui qui nous intéresse.
    for (let f = 0; f * FRAME_S < 0.2; f += 1) gearbox.tick(FRAME_S, { rpmInGear: rpmInGear, atStandstill: false, load: 0.5, kmh: kmh, accelMs2 })
    const state = gearbox.tick(FRAME_S, { rpmInGear: rpmInGear, atStandstill: false, load: 0.5, kmh: kmh, accelMs2 })

    expect(state.gear).toBeGreaterThan(1)
  })

  it('quitte la première à la vitesse de lancement, sans seuil de régime', () => {
    const p = profile()
    const { shifts } = drive(p, (t) => t * 4, 10)
    const amorce = shifts[0]

    expect(amorce?.from).toBe(0)
    expect(amorce?.kmh).toBeGreaterThanOrEqual(p.drivetrain.launchUpshiftKmh)
    expect(amorce?.kmh).toBeLessThan(p.drivetrain.launchUpshiftKmh + 1)
  })

  it('ne monte pas au-delà du dernier rapport', () => {
    const p = profile()
    const { last } = drive(p, (t) => Math.min(240, t * 8), 60)

    expect(last.gear).toBe(p.drivetrain.gearRatios.length - 1)
    expect(last.gearCount).toBe(6)
  })
})

describe('Gearbox — rétrogradage', () => {
  it('rétrograde en décélération douce, au seuil de régime', () => {
    const p = profile()
    // Décélération volontairement plus douce que le seuil de freinage du
    // profil : c'est la règle du régime qui doit décider, et elle seule.
    // Quatre cinquièmes du seuil : assez lent pour que la règle du freinage ne
    // se déclenche pas, assez rapide pour descendre toute la boîte.
    const doux = -p.drivetrain.brakeDownshiftAccelMs2 * 3.6 * 0.8
    const { shifts } = drive(
      p,
      (t) => (t < 30 ? Math.min(140, t * 6) : Math.max(0, 140 - (t - 30) * doux)),
      130,
    )
    const descentes = shifts.filter((s) => s.to < s.from)

    expect(descentes.length).toBeGreaterThanOrEqual(3)
    for (const descente of descentes) {
      expect(descente.rpm).toBeLessThanOrEqual(
        p.engine.redlineRpm * p.drivetrain.downshiftAtRedlineRatio + 1,
      )
    }
  })

  it('rétrograde d’autant plus tôt que le seuil de descente est haut', () => {
    const descenteVers3 = (downshiftAtRedlineRatio: number) => {
      const p = profile({ downshiftAtRedlineRatio })
      // Décélération douce, sous le seuil de freinage : sinon la règle du
      // ralentissement prend la main et masque l'effet qu'on mesure.
      const { shifts } = drive(
        p,
        (t) => (t < 25 ? Math.min(130, t * 6) : Math.max(0, 130 - (t - 25) * 1.5)),
        140,
      )
      return shifts.filter((s) => s.to === 2 && s.from > 2).at(-1)?.kmh ?? 0
    }

    expect(descenteVers3(0.2)).toBeLessThan(descenteVers3(0.32))
    expect(descenteVers3(0.32)).toBeLessThan(descenteVers3(0.5))
  })

  it('ne dépend pas du régime plancher, contrairement à ce qu’annonçait le README', () => {
    // Le README attribuait la vitesse de rétrogradage au réglage « Ne jamais
    // monter sous ». Mesuré : il n'y change rien. La garde anti-va-et-vient
    // qu'il alimente n'est jamais le facteur limitant — le seuil de descente
    // l'est. Le README a été corrigé ; ce test tient la correction.
    const descenteVers3 = (minUpshiftRpm: number) => {
      const p = profile({ minUpshiftRpm })
      const { shifts } = drive(
        p,
        (t) => (t < 25 ? Math.min(130, t * 6) : Math.max(0, 130 - (t - 25) * 1.5)),
        140,
      )
      return shifts.filter((s) => s.to === 2 && s.from > 2).at(-1)?.kmh ?? 0
    }

    expect(descenteVers3(4200)).toBe(descenteVers3(2600))
  })

  it('reste sur son rapport quand rétrograder ferait aussitôt remonter', () => {
    const p = profile()
    const gearbox = makeGearbox(p)
    // Hors croisière : à accélération nulle, la montée en croisière prendrait la
    // main et le sujet du test — la garde anti-va-et-vient — ne serait plus
    // observable.
    const accelMs2 = 1.2

    // Vitesse telle que le rapport inférieur dépasserait son propre seuil de
    // montée : rétrograder relancerait un passage dans la foulée.
    const kmh = kmhForRpm(p, 2, p.drivetrain.upshiftRpm[2]! + 200)
    const rpmInGear = rpmInGearAt(p, kmh)
    // On amène la boîte sur un rapport long à cette vitesse.
    for (let f = 0; f * FRAME_S < 5; f += 1) gearbox.tick(FRAME_S, { rpmInGear: rpmInGear, atStandstill: false, load: 0.5, kmh: kmh, accelMs2 })
    const gear = gearbox.tick(FRAME_S, { rpmInGear: rpmInGear, atStandstill: false, load: 0.5, kmh: kmh, accelMs2 }).gear

    // Le rapport se stabilise : pas de va-et-vient d'une image à l'autre.
    for (let f = 0; f * FRAME_S < 3; f += 1) {
      expect(gearbox.tick(FRAME_S, { rpmInGear: rpmInGear, atStandstill: false, load: 0.5, kmh: kmh, accelMs2 }).gear).toBe(gear)
    }
  })

  it('revient au premier rapport à l’arrêt', () => {
    const p = profile()
    const { last } = drive(p, (t) => (t < 20 ? Math.min(100, t * 6) : Math.max(0, 100 - (t - 20) * 20)), 40)

    expect(last.gear).toBe(0)
    expect(last.label).toBe('N')
  })
})

describe('Gearbox — rétrogradage forcé', () => {
  it('descend chercher le couple quand la demande est franche', () => {
    const p = profile()
    const gearbox = makeGearbox(p)
    const kmh = 90
    const rpmInGear = rpmInGearAt(p, kmh)

    // Croisière à charge modérée : la boîte se cale sur un rapport long.
    for (let f = 0; f * FRAME_S < 6; f += 1) gearbox.tick(FRAME_S, { rpmInGear: rpmInGear, atStandstill: false, load: 0.3, kmh: kmh, accelMs2 })
    const avant = gearbox.tick(FRAME_S, { rpmInGear: rpmInGear, atStandstill: false, load: 0.3, kmh: kmh, accelMs2 }).gear

    // Pied au plancher : la demande dépasse le seuil de déclenchement.
    const apres = gearbox.tick(FRAME_S, { rpmInGear: rpmInGear, atStandstill: false, load: 1, kmh: kmh, accelMs2 })

    expect(apres.gear).toBeLessThan(avant)
    expect(apres.kickdownGears).toBe(avant - apres.gear)
    expect(apres.isShifting).toBe(true)
  })

  it('ne descend pas plus de rapports que déclaré', () => {
    const base = createDefaultProfile()
    const p = profile({}, { kickdown: { ...base.feel.kickdown, maxGears: 1 } })
    const gearbox = makeGearbox(p)
    const kmh = 110
    const rpmInGear = rpmInGearAt(p, kmh)

    for (let f = 0; f * FRAME_S < 6; f += 1) gearbox.tick(FRAME_S, { rpmInGear: rpmInGear, atStandstill: false, load: 0.3, kmh: kmh, accelMs2 })
    const avant = gearbox.tick(FRAME_S, { rpmInGear: rpmInGear, atStandstill: false, load: 0.3, kmh: kmh, accelMs2 }).gear
    const apres = gearbox.tick(FRAME_S, { rpmInGear: rpmInGear, atStandstill: false, load: 1, kmh: kmh, accelMs2 })

    expect(avant - apres.gear).toBeLessThanOrEqual(1)
  })

  it('ne dépasse pas le rupteur en descendant', () => {
    const p = profile()
    const gearbox = makeGearbox(p)
    // Vitesse basse : descendre de trois rapports mettrait le moteur au-delà.
    const kmh = 45
    const rpmInGear = rpmInGearAt(p, kmh)

    for (let f = 0; f * FRAME_S < 6; f += 1) gearbox.tick(FRAME_S, { rpmInGear: rpmInGear, atStandstill: false, load: 0.3, kmh: kmh, accelMs2 })
    const apres = gearbox.tick(FRAME_S, { rpmInGear: rpmInGear, atStandstill: false, load: 1, kmh: kmh, accelMs2 })

    expect(rpmInGear(apres.gear)).toBeLessThanOrEqual(p.engine.redlineRpm * 0.95)
  })

  it('ne se déclenche qu’une fois tant que la pédale reste enfoncée', () => {
    const p = profile()
    const gearbox = makeGearbox(p)
    const kmh = 110
    const rpmInGear = rpmInGearAt(p, kmh)

    for (let f = 0; f * FRAME_S < 6; f += 1) gearbox.tick(FRAME_S, { rpmInGear: rpmInGear, atStandstill: false, load: 0.3, kmh: kmh, accelMs2 })
    const premier = gearbox.tick(FRAME_S, { rpmInGear: rpmInGear, atStandstill: false, load: 1, kmh: kmh, accelMs2 }).gear
    // Le passage court, puis on reste pied au plancher : pas de second
    // rétrogradage en cascade.
    for (let f = 0; f * FRAME_S < 1; f += 1) gearbox.tick(FRAME_S, { rpmInGear: rpmInGear, atStandstill: false, load: 1, kmh: kmh, accelMs2 })
    const apres = gearbox.tick(FRAME_S, { rpmInGear: rpmInGear, atStandstill: false, load: 1, kmh: kmh, accelMs2 })

    expect(apres.gear).toBeGreaterThanOrEqual(premier)
  })

  it('ne fait rien quand il est désactivé', () => {
    const base = createDefaultProfile()
    const p = profile({}, { kickdown: { ...base.feel.kickdown, enabled: false } })
    const gearbox = makeGearbox(p)
    const kmh = 110
    const rpmInGear = rpmInGearAt(p, kmh)

    for (let f = 0; f * FRAME_S < 6; f += 1) gearbox.tick(FRAME_S, { rpmInGear: rpmInGear, atStandstill: false, load: 0.3, kmh: kmh, accelMs2 })
    const avant = gearbox.tick(FRAME_S, { rpmInGear: rpmInGear, atStandstill: false, load: 0.3, kmh: kmh, accelMs2 }).gear
    const apres = gearbox.tick(FRAME_S, { rpmInGear: rpmInGear, atStandstill: false, load: 1, kmh: kmh, accelMs2 })

    expect(apres.gear).toBe(avant)
    expect(apres.kickdownGears).toBe(0)
  })
})

describe('Gearbox — dispersion aléatoire', () => {
  it('écarte les régimes de passage sans les moyenner à zéro', () => {
    const jitter = 300
    const p = {
      ...createDefaultProfile(),
      drivetrain: { ...createDefaultProfile().drivetrain, upshiftJitterRpm: jitter },
    }

    const rpms: number[] = []
    for (let run = 0; run < 25; run += 1) {
      const { shifts } = drive(p, (t) => t * 4, 30)
      const deuxieme = shifts.find((s) => s.from === 1)
      if (deuxieme) rpms.push(deuxieme.rpm)
    }

    expect(rpms.length).toBeGreaterThan(10)
    const etendue = Math.max(...rpms) - Math.min(...rpms)
    // Sans dispersion, tous les passages tomberaient au même régime.
    expect(etendue).toBeGreaterThan(50)
    // Et l'écart reste dans les bornes du réglage, à la marge de dépassement près.
    expect(etendue).toBeLessThan(jitter * 2 + 450)
  })

  it('donne toujours le même régime quand elle est nulle', () => {
    const p = profile()
    const rpms = [0, 1, 2].map(() => drive(p, (t) => t * 4, 30).shifts.find((s) => s.from === 1)?.rpm)

    expect(new Set(rpms).size).toBe(1)
  })
})

describe('Gearbox — commande manuelle', () => {
  it('monte et descend à la demande', () => {
    const horloge = fakeClock()
    const p = profile()
    const gearbox = makeGearbox(p)
    gearbox.setMode('manual')

    expect(gearbox.getMode()).toBe('manual')
    expect(gearbox.shiftUp()).toBe(true)
    laisseFinir(gearbox, horloge, p)
    expect(gearbox.shiftUp()).toBe(true)
    laisseFinir(gearbox, horloge, p)

    // Deux montées, donc le troisième rapport.
    expect(gearbox.tick(FRAME_S, { rpmInGear: rpmInGearAt(p, 80), atStandstill: false, load: 0.5, kmh: 80, accelMs2 }).gear).toBe(2)
    expect(gearbox.shiftDown()).toBe(true)
  })

  it('ignore une commande répétée trop vite', () => {
    const horloge = fakeClock()
    const p = profile()
    const gearbox = makeGearbox(p)
    gearbox.setMode('manual')

    expect(gearbox.shiftUp()).toBe(true)
    // Le passage s'achève, mais l'anti-rebond de 220 ms court encore : deux
    // appuis rapprochés ne comptent que pour un.
    for (let f = 0; f * FRAME_S < 0.25; f += 1) {
      gearbox.tick(FRAME_S, { rpmInGear: rpmInGearAt(p, 80), atStandstill: false, load: 0.5, kmh: 80, accelMs2 })
    }
    horloge.avance(50)
    expect(gearbox.shiftUp()).toBe(false)

    // Passé l'anti-rebond, la commande reprend.
    horloge.avance(250)
    expect(gearbox.shiftUp()).toBe(true)
  })

  it('ne passe pas tout seul en mode manuel', () => {
    const p = profile()
    const gearbox = makeGearbox(p)
    gearbox.setMode('manual')

    // Bien au-delà du seuil de montée de la première : en automatique, la boîte
    // aurait déjà passé plusieurs rapports.
    const kmh = 120
    const rpmInGear = rpmInGearAt(p, kmh)
    for (let f = 0; f * FRAME_S < 3; f += 1) gearbox.tick(FRAME_S, { rpmInGear: rpmInGear, atStandstill: false, load: 1, kmh: kmh, accelMs2 })

    expect(gearbox.tick(FRAME_S, { rpmInGear: rpmInGear, atStandstill: false, load: 1, kmh: kmh, accelMs2 }).gear).toBe(0)
  })

  it('refuse de monter au-delà du dernier rapport et de descendre sous le premier', () => {
    const horloge = fakeClock()
    const p = profile()
    const gearbox = makeGearbox(p)
    gearbox.setMode('manual')

    expect(gearbox.shiftDown()).toBe(false)
    for (let i = 0; i < p.drivetrain.gearRatios.length - 1; i += 1) {
      expect(gearbox.shiftUp()).toBe(true)
      laisseFinir(gearbox, horloge, p)
    }
    // Le dernier rapport est engagé : il n'y a plus rien au-dessus.
    expect(gearbox.shiftUp()).toBe(false)
  })
})

describe('Gearbox — prise directe', () => {
  it('n’a pas de boîte quand il n’y a qu’un rapport', () => {
    const p = profile({ gearRatios: [3.2] })
    const gearbox = makeGearbox(p)

    expect(gearbox.hasGearbox).toBe(false)
    expect(gearbox.gearCount).toBe(1)

    const state = gearbox.tick(FRAME_S, { rpmInGear: rpmInGearAt(p, 120), atStandstill: false, load: 1, kmh: 120, accelMs2 })
    expect(state.gear).toBe(0)
    expect(state.isShifting).toBe(false)
    // Sans boîte, pas de « N » à l'arrêt : il n'y a rien à débrayer.
    expect(gearbox.tick(FRAME_S, { rpmInGear: rpmInGearAt(p, 0), atStandstill: true, load: 0, kmh: 0, accelMs2 }).label).toBe('1')
  })

  it('choisit d’emblée un rapport adapté à la vitesse', () => {
    const p = profile()
    const gearbox = makeGearbox(p)

    // Reprise en marche à 90 km/h : partir en première serait absurde.
    gearbox.settleFor(rpmInGearAt(p, 90))
    const state = gearbox.tick(FRAME_S, { rpmInGear: rpmInGearAt(p, 90), atStandstill: false, load: 0.5, kmh: 90, accelMs2 })

    expect(state.gear).toBeGreaterThan(1)
    expect(rpmInGearAt(p, 90)(state.gear)).toBeLessThan(p.engine.redlineRpm)
  })
})

describe('Gearbox — la demande, et non le niveau', () => {
  /** Une charge qui monte lentement : une reprise en douceur. */
  const douce = (t: number) => ({ load: Math.min(0.95, 0.5 + t * 0.03), accelMs2: 1 })
  /** Une charge qui bondit après deux secondes et demie : on écrase. */
  const franche = (t: number) => ({ load: t < 2.5 ? 0.2 : 0.9, accelMs2: t < 2.5 ? 0 : 2 })

  it('ne rétrograde pas quand on remet délicatement les gaz', () => {
    const p = profile()
    // Vitesse choisie pour que le rapport engagé soit loin de ses deux seuils :
    // ce qui bouge dans ce test est la charge, rien d'autre.
    const kmh = kmhForRpm(p, 1, p.drivetrain.upshiftRpm[1]! - 900)

    const { shifts } = hold(p, kmh, 20, douce)

    // Mesuré avant ce lot : la charge franchissait 0,75 dès 1 m/s², soit
    // 3,6 km/h par seconde, et la boîte descendait pour cela.
    expect(shifts.filter((s) => s.to < s.from)).toHaveLength(0)
  })

  it('rétrograde quand on écrase', () => {
    const p = profile()

    // Le rapport engagé doit tourner **sous** le régime visé par le
    // rétrogradage, sinon il n'y a rien à aller chercher et la boîte a raison
    // de ne rien faire. Une croisière à 70 km/h l'y place.
    const { shifts } = hold(p, 70, 20, franche)
    const descentes = shifts.filter((s) => s.to < s.from)

    expect(descentes.length).toBeGreaterThan(0)
    // Et pas avant la demande : la montée de charge se mesure sur une seconde
    // et demie, donc le déclenchement ne peut pas précéder la fin de la fenêtre.
    expect(descentes[0]!.t).toBeGreaterThanOrEqual(2.5)
  })

  it('ne rétrograde pas sur une charge élevée mais stable', () => {
    const p = profile()
    const kmh = kmhForRpm(p, 3, p.drivetrain.upshiftRpm[3]! - 900)

    // Pied au plancher depuis toujours : c'est un plateau, pas une demande.
    const { shifts } = hold(p, kmh, 30, () => ({ load: 0.95, accelMs2: 2 }))

    expect(shifts.filter((s) => s.to < s.from)).toHaveLength(0)
  })

  it('espace deux rétrogradages forcés de trois secondes', () => {
    const p = profile()

    /** Deux coups de pied brefs, le second après le délai indiqué. */
    const deuxCoups = (secondA: number) =>
      hold(p, 70, 16, (t) => {
        const ecrase = (t >= 4 && t < 4.5) || (t >= secondA && t < secondA + 0.5)
        return { load: ecrase ? 0.9 : 0.2, accelMs2: ecrase ? 2 : 0 }
      }).shifts.filter((s) => s.to < s.from).length

    // Deux secondes et demie après le premier : trop tôt, il ne se passe rien.
    expect(deuxCoups(6.5)).toBe(1)
    // Quatre secondes après : le délai est écoulé, la boîte redescend.
    expect(deuxCoups(8)).toBe(2)
  })
})

describe('Gearbox — montée en croisière', () => {
  const croisiere = () => ({ load: 0.5, accelMs2: 0 })

  it('monte les rapports quand la vitesse est tenue', () => {
    const p = profile()

    const { shifts, gear } = hold(p, 70, 60, croisiere)

    // Mesuré avant ce lot : 70 km/h tenus laissaient la deuxième à 5165 tr/min.
    expect(shifts.filter((s) => s.to > s.from).length).toBeGreaterThanOrEqual(2)
    expect(rpmInGearAt(p, 70)(gear)).toBeLessThan(3000)
  })

  it('s’arrête au plancher de croisière, et pas avant', () => {
    const p = profile()
    const kmh = 70

    const { gear } = hold(p, kmh, 60, croisiere)
    const rpm = rpmInGearAt(p, kmh)

    // Le rapport retenu tourne au-dessus du plancher…
    expect(rpm(gear)).toBeGreaterThanOrEqual(p.drivetrain.cruiseMinRpm)
    // …et le suivant passerait en dessous, sinon la montée aurait continué.
    if (gear < p.drivetrain.gearRatios.length - 1) {
      expect(rpm(gear + 1)).toBeLessThan(p.drivetrain.cruiseMinRpm)
    }
  })

  it('ne fait pas de yoyo une fois montée', () => {
    const p = profile()

    // Deux minutes de vitesse tenue : le va-et-vient était le risque principal,
    // le rapport atteint tournant sous le seuil de descente au régime.
    const { shifts } = hold(p, 70, 120, croisiere)

    expect(shifts.filter((s) => s.t > 30)).toHaveLength(0)
  })

  it('ne monte pas quand la vitesse n’est pas tenue', () => {
    const p = profile()

    // Une accélération qui oscille sans jamais se tenir dans la bande.
    const { shifts } = hold(p, 70, 60, (t) => ({
      load: 0.5,
      accelMs2: Math.sin(t * 4) * 1.5,
    }))

    expect(shifts.filter((s) => s.to > s.from)).toHaveLength(0)
  })

  it('attend le délai déclaré avant de monter', () => {
    const p = profile({ cruiseUpshiftAfterS: 4 })

    const { shifts } = hold(p, 70, 60, croisiere)
    const premiere = shifts.find((s) => s.to > s.from)

    expect(premiere).toBeDefined()
    expect(premiere!.t).toBeGreaterThanOrEqual(4)
  })

  it('laisse le rétrogradage forcé reprendre la main après une croisière', () => {
    const p = profile()

    // On croise, puis on écrase : c'est là que le rétrogradage prend son sens.
    const { shifts } = hold(p, 70, 60, (t) => {
      if (t < 30) return { load: 0.5, accelMs2: 0 }
      return { load: t < 32 ? 0.2 : 0.9, accelMs2: t < 32 ? 0 : 2 }
    })

    const montees = shifts.filter((s) => s.to > s.from && s.t < 30)
    const descente = shifts.find((s) => s.to < s.from && s.t >= 31.9)

    expect(montees.length).toBeGreaterThan(0)
    expect(descente).toBeDefined()
    // Mesuré : la croisière stabilise la cinquième à 2178 tr/min, et le coup de
    // pied fait tomber trois rapports d'un coup, à 5165 tr/min.
    expect(descente!.from - descente!.to).toBeGreaterThanOrEqual(2)
  })
})

describe('Gearbox — descendre pour ralentir', () => {
  /** Vitesse à laquelle un rapport donné est retrouvé, en décélérant. */
  const descenteVers = (p: Profile, gear: number, kmhParSeconde: number) => {
    const { shifts } = drive(
      p,
      (t) => (t < 30 ? Math.min(140, t * 6) : Math.max(0, 140 - (t - 30) * kmhParSeconde)),
      200,
    )
    return shifts.filter((s) => s.to === gear && s.from > gear).at(-1)?.kmh ?? 0
  }

  it('descend plus tôt en freinant qu’en levant le pied', () => {
    const p = profile()
    const seuil = -p.drivetrain.brakeDownshiftAccelMs2 * 3.6

    const enFreinant = descenteVers(p, 2, seuil * 3)
    const enLevantLePied = descenteVers(p, 2, seuil * 0.8)

    expect(enFreinant).toBeGreaterThan(enLevantLePied)
  })

  it('descend les rapports en cascade sous un freinage prolongé', () => {
    const p = profile()
    const { shifts } = drive(
      p,
      (t) => (t < 30 ? Math.min(140, t * 6) : Math.max(0, 140 - (t - 30) * 12)),
      60,
    )

    expect(shifts.filter((s) => s.to < s.from).length).toBeGreaterThanOrEqual(3)
  })

  it('ne dépasse jamais le plafond de régime en descendant', () => {
    const p = profile()
    const { shifts } = drive(
      p,
      (t) => (t < 30 ? Math.min(200, t * 8) : Math.max(0, 200 - (t - 30) * 20)),
      60,
    )

    for (const descente of shifts.filter((s) => s.to < s.from)) {
      expect(rpmInGearAt(p, descente.kmh)(descente.to)).toBeLessThanOrEqual(
        p.engine.redlineRpm * 0.86,
      )
    }
  })

  it('ne descend pas sur un freinage bref', () => {
    const p = profile()
    const kmh = kmhForRpm(p, 3, p.drivetrain.upshiftRpm[3]! - 900)

    // Une demi-seconde de forte décélération, puis plus rien : la durée compte.
    const { shifts } = hold(p, kmh, 20, (t) => ({
      load: 0.3,
      accelMs2: t > 3 && t < 3.5 ? -4 : 0,
    }))

    expect(shifts.filter((s) => s.to < s.from)).toHaveLength(0)
  })

  it('ne réengage pas la première quand elle n’est qu’une amorce', () => {
    const p = profile()
    const { shifts } = drive(
      p,
      (t) => (t < 20 ? Math.min(100, t * 6) : Math.max(2, 100 - (t - 20) * 15)),
      40,
    )

    for (const descente of shifts.filter((s) => s.to < s.from)) {
      expect(descente.to).toBeGreaterThanOrEqual(1)
    }
  })
})
