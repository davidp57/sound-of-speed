import { afterEach, describe, expect, it, vi } from 'vitest'

import { Gearbox } from './gearbox'
import { Engine } from '../engine/engine'
import { SpeedConditioner } from '../speed/conditioner'
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

/**
 * Profil de test : dispersion nulle, pour que les passages soient déterministes,
 * et passage court.
 *
 * Ces tests portent sur les seuils et les temporisations de la boîte, pas sur la
 * durée d'une coupure. Le profil livré est passé à 380 ms pour laisser au son la
 * place de sa séquence — chute, coup de gaz, clac, reprise — et une boîte qui
 * reste occupée un tiers de seconde décale tout ce que ces tests comptent. Ils
 * déclarent donc la durée qu'ils supposent, au lieu de la subir.
 */
function profile(over: Partial<DrivetrainPreset> = {}, feel: Partial<FeelPreset> = {}): Profile {
  const base = createDefaultProfile()
  return {
    ...base,
    drivetrain: { ...base.drivetrain, upshiftJitterRpm: 0, shiftTimeMs: 120, ...over },
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
  /** Instant du passage, en secondes. Sert à isoler une phase du trajet. */
  t: number
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
      shifts.push({ from: previous, to: last.gear, kmh, rpm: before, t })
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
  const shifts: { from: number; to: number; t: number }[] = []
  // La vitesse **intègre** l'accélération déclarée, au lieu de rester figée.
  //
  // Tenir la vitesse fixe tout en déclarant une accélération non nulle décrit
  // une situation qui n'existe pas, et la boîte juge maintenant la croisière sur
  // la dérive de la vitesse : elle verrait une vitesse tenue là où le banc
  // annonce une allure qui bouge. C'est le reproche que `drive` fait déjà à ce
  // genre de banc — « il mentirait à la boîte, et les règles qui en dépendent se
  // vérifieraient sur une fiction ».
  let vitesse = kmh
  const pas = (t: number) => {
    const entree = at(t)
    vitesse = Math.max(0, vitesse + entree.accelMs2 * 3.6 * FRAME_S)
    return { rpmInGear: rpmInGearAt(p, vitesse), atStandstill: false, kmh: vitesse, ...entree }
  }

  let previous = gearbox.tick(FRAME_S, pas(0)).gear

  for (let frame = 1; frame * FRAME_S <= seconds; frame += 1) {
    const t = frame * FRAME_S
    const state = gearbox.tick(FRAME_S, pas(t))
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

  it('accélère en première jusqu’au seuil de régime, comme les autres rapports', () => {
    // La première cédait la place dès la vitesse de lancement, sans regarder le
    // régime : la deuxième tombait alors bien sous le ralenti. David : « elle
    // passe la 2de au km/h suivant [...] et la 2de est en dessous de 800 rpm
    // jusque 12-14 km/h, ce qui donne l'effet que je n'aime pas ».
    const p = profile()
    // Vingt secondes : en première, le seuil de 5 200 tr/min n'arrive qu'aux
    // alentours de quarante kilomètres à l'heure sur ce profil.
    const { shifts } = drive(p, (t) => t * 4, 20)
    const premier = shifts[0]

    expect(premier?.from).toBe(0)
    // Le seuil de régime commande, à la tolérance du pas de simulation près.
    expect(premier?.rpm).toBeGreaterThan(p.drivetrain.upshiftRpm[0]! * 0.85)
    // Et la deuxième y prend le relais bien au-dessus du ralenti.
    const apres = premier!.rpm * (p.drivetrain.gearRatios[1]! / p.drivetrain.gearRatios[0]!)
    expect(apres).toBeGreaterThan(p.engine.idleRpm * 1.5)
  })

  it('ne quitte pas la première avant que la voiture n’avance', () => {
    // Un coup d'accélérateur ne doit pas faire monter les rapports à l'arrêt :
    // `launchUpshiftKmh` empêche désormais le passage au lieu de le forcer.
    const p = profile()
    const { shifts } = drive(p, (t) => Math.min(4, t * 4), 6)

    for (const shift of shifts) {
      if (shift.from === 0) expect(shift.kmh).toBeGreaterThanOrEqual(p.drivetrain.launchUpshiftKmh)
    }
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

    // Le sujet du test est la garde anti-va-et-vient, qui protège la **descente
    // au régime**. Or celle-ci n'est examinée que hors croisière. Il faut donc
    // une vitesse qui ne se tienne pas — et c'est la vitesse qui le dit
    // maintenant, non une accélération déclarée à côté d'elle. Un déclin lent
    // suffit à sortir de la bande sans déplacer beaucoup le point de mesure :
    // trois secondes à −0,3 m/s² coûtent 3,2 km/h.
    const decelMs2 = -0.3

    // Vitesse telle que le rapport inférieur dépasserait son propre seuil de
    // montée : rétrograder relancerait un passage dans la foulée.
    const depart = kmhForRpm(p, 2, p.drivetrain.upshiftRpm[2]! + 200)
    let kmh = depart
    const avance = () => {
      kmh = Math.max(0, kmh + decelMs2 * 3.6 * FRAME_S)
      return {
        rpmInGear: rpmInGearAt(p, kmh),
        atStandstill: false,
        load: 0.5,
        kmh,
        accelMs2: decelMs2,
      }
    }

    // On amène la boîte sur un rapport long à cette vitesse.
    for (let f = 0; f * FRAME_S < 5; f += 1) gearbox.tick(FRAME_S, avance())
    const gear = gearbox.tick(FRAME_S, avance()).gear

    // Le rapport se stabilise : pas de va-et-vient d'une image à l'autre.
    for (let f = 0; f * FRAME_S < 3; f += 1) {
      expect(gearbox.tick(FRAME_S, avance()).gear).toBe(gear)
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
    // Les seuils de régime sont mis hors d'atteinte : toute montée observée est
    // alors nécessairement une montée **en croisière**, qui est le sujet. Sans
    // cela le test relèverait aussi les montées au régime, légitimes, puisque la
    // vitesse monte réellement pendant la première moitié de l'oscillation.
    const p = profile({ upshiftRpm: [8500, 8500, 8500, 8500, 8500] })

    // Une allure qui va et vient : l'accélération oscille assez lentement pour
    // que la vitesse en garde la trace — ±6,8 km/h autour de 70. Une oscillation
    // rapide, elle, ne déplacerait la vitesse que d'un demi km/h, et ce serait
    // alors une vitesse tenue quoi qu'en dise l'accélération instantanée.
    const { shifts } = hold(p, 70, 60, (t) => ({
      load: 0.5,
      accelMs2: Math.sin(t * 0.8) * 1.5,
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

describe('Gearbox — ralentir n’est pas croiser', () => {
  /**
   * Descente depuis une croisière stabilisée à 110 km/h.
   *
   * C'est le scénario où les deux défauts se voyaient : on tient une vitesse,
   * la boîte monte au dernier rapport, puis on ralentit doucement.
   */
  const depuisCroisiere = (p: Profile, kmhParSeconde: number) =>
    drive(
      p,
      (t) => (t < 20 ? Math.min(110, t * 6) : t < 40 ? 110 : Math.max(0, 110 - (t - 40) * kmhParSeconde)),
      40 + 110 / kmhParSeconde + 5,
      // La phase de descente seule : les passages de la montée en vitesse et de
      // la croisière ne sont pas le sujet.
    ).shifts.filter((s) => s.t > 40)

  it('descend régulièrement quand on ralentit doucement', () => {
    const p = profile()
    // 0,8 km/h par seconde, soit 0,22 m/s² : à l'intérieur de la bande
    // d'accélération considérée comme stable. C'était le piège — la descente au
    // régime s'en trouvait suspendue, et le dernier rapport gardé jusqu'à
    // l'arrêt.
    const passages = depuisCroisiere(p, 0.8)
    const descentes = passages.filter((s) => s.to < s.from && s.kmh > 5)

    // Mesuré : 6→5 à 104 km/h, 5→4 à 87, 4→3 à 73, 3→2 à 55.
    expect(descentes.length).toBeGreaterThanOrEqual(4)
    // Étalées, et non entassées dans les derniers kilomètres-heure.
    expect(Math.max(...descentes.map((s) => s.kmh))).toBeGreaterThan(90)
    expect(Math.min(...descentes.map((s) => s.kmh))).toBeLessThan(70)
  })

  it('ne garde pas le dernier rapport jusqu’à l’arrêt', () => {
    const p = profile()
    const dernier = p.drivetrain.gearRatios.length - 1

    const passages = depuisCroisiere(p, 0.8)
    const quitteLeDernier = passages.find((s) => s.from === dernier && s.to < dernier)

    expect(quitteLeDernier).toBeDefined()
    // Bien avant l'arrêt : à 104 km/h, mesuré.
    expect(quitteLeDernier!.kmh).toBeGreaterThan(80)
  })

  it('ne monte pas en croisière quand la vitesse décline doucement', () => {
    const p = profile()

    // Une décélération constante et faible, dans la bande d'accélération mais
    // hors de celle, plus serrée, du côté du ralentissement : tenir une
    // vitesse, c'est ne pas la perdre.
    const { shifts } = hold(p, 90, 60, () => ({ load: 0.4, accelMs2: -0.2 }))

    // Passé la mise en place du rapport adapté à la vitesse, dans la première
    // fraction de seconde, plus aucune montée.
    expect(shifts.filter((s) => s.to > s.from && s.t > 5)).toHaveLength(0)
  })

  it('tolère un tremblement de l’accélération', () => {
    const p = profile()

    // L'accélération vient d'une dérivée du GPS : elle tremble. Une sortie
    // brève de la bande ne doit pas empêcher la croisière, sinon la montée ne
    // se déclencherait jamais en conduite réelle.
    const { shifts } = hold(p, 90, 60, (t) => ({
      load: 0.5,
      accelMs2: Math.sin(t * 7) * 0.25,
    }))

    expect(shifts.filter((s) => s.to > s.from && s.t > 5).length).toBeGreaterThan(0)
  })

  it('distingue un tremblement d’un vrai changement d’allure', () => {
    const p = profile()

    /** Une vitesse pilotée directement, l'accélération en étant déduite. */
    function suivre(
      depart: number,
      vitesseA: (t: number) => number,
      seconds: number,
    ): { from: number; to: number; t: number }[] {
      const gearbox = makeGearbox(p)
      gearbox.settleFor(rpmInGearAt(p, depart))
      const shifts: { from: number; to: number; t: number }[] = []
      let previous = -1
      for (let frame = 0; frame * FRAME_S <= seconds; frame += 1) {
        const t = frame * FRAME_S
        const kmh = vitesseA(t)
        const state = gearbox.tick(FRAME_S, {
          rpmInGear: rpmInGearAt(p, kmh),
          atStandstill: false,
          load: 0.5,
          kmh,
          accelMs2: (kmh - vitesseA(t - FRAME_S)) / FRAME_S / 3.6,
        })
        if (previous >= 0 && state.gear !== previous) {
          shifts.push({ from: previous, to: state.gear, t })
        }
        previous = state.gear
      }
      return shifts
    }

    // Un tremblement : la vitesse bouge de moins d'un km/h. C'est une croisière,
    // et la boîte doit monter — c'est le défaut qu'on avait à l'inverse, où le
    // moindre frémissement l'empêchait tout à fait.
    const tremblement = suivre(90, (t) => 90 + Math.sin(t * 7) * 0.4, 60)
    expect(tremblement.filter((s) => s.to > s.from).length).toBeGreaterThan(0)

    // Une allure qui bouge vraiment : dix km/h d'amplitude sur quelques
    // secondes. Aucune montée en croisière.
    const allure = suivre(90, (t) => 90 + Math.sin(t * 0.8) * 10, 60)
    expect(allure.filter((s) => s.to > s.from && s.t > 5)).toHaveLength(0)
  })
})

describe('Gearbox — on ne monte pas en freinant', () => {
  it('n’annule pas une descente au freinage par une montée au régime', () => {
    const p = profile()

    // Le va-et-vient mesuré avant ce correctif : 3→2 à 98 km/h, 2→3 à 98,
    // 3→2 à 95, 2→3 à 95… un aller-retour tous les trois km/h. La descente au
    // freinage engage un rapport dont le régime dépasse son propre seuil de
    // montée, et la montée le défaisait aussitôt.
    const { shifts } = drive(
      p,
      (t) => (t < 20 ? Math.min(110, t * 6) : Math.max(0, 110 - (t - 20) * 3)),
      70,
    )
    const enRalentissant = shifts.filter((s) => s.t > 20 && s.kmh > 5)

    expect(enRalentissant.filter((s) => s.to > s.from)).toHaveLength(0)
  })

  it('espace les descentes au freinage sans lever l’inhibition de montée', () => {
    const p = profile()

    // Les deux besoins étaient portés par le même compteur : l'espacement des
    // descentes remettait à zéro celui du freinage, ce qui rouvrait la montée
    // pendant une seconde — juste assez pour défaire la descente.
    const { shifts } = drive(
      p,
      (t) => (t < 20 ? Math.min(140, t * 7) : Math.max(0, 140 - (t - 20) * 12)),
      45,
    )
    const enFreinant = shifts.filter((s) => s.t > 20 && s.kmh > 5)

    // Le sujet du test est l'inhibition, pas le nombre de descentes — la
    // cascade est vérifiée ailleurs. Ce qui compte ici : aucune remontée.
    expect(enFreinant.filter((s) => s.to > s.from)).toHaveLength(0)
    expect(enFreinant.filter((s) => s.to < s.from).length).toBeGreaterThan(0)
  })

  it('tient son rapport sur une vitesse tenue malgré le bruit de mesure', () => {
    // Le défaut : la boîte jugeait « vitesse tenue » sur l'accélération, dont le
    // bruit résiduel est du même ordre que la borne basse de sa bande — un
    // dixième de m/s². Une seule image dans la bande remettait le compte à zéro,
    // si bien qu'elle se croyait en croisière deux fois sur trois en
    // ralentissant, gardait un rapport long, et laissait le régime se plaquer au
    // ralenti sous 26 km/h en quatrième. À l'inverse, sur une vitesse vraiment
    // tenue, elle faisait le va-et-vient — mesuré, quarante-trois passages par
    // minute à 90 km/h.
    //
    // Une vitesse tenue se mesure sur la vitesse, pas sur sa dérivée.
    const p = profile()

    /** Bruit blanc reproductible, en unités crête. */
    function bruit(amplitude: number, graine: number): () => number {
      let seed = graine
      return () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff
        return (seed / 0x7fffffff - 0.5) * 2 * amplitude
      }
    }

    // La vitesse et l'accélération viennent du **conditionnement réel**, et non
    // de deux bruits tirés séparément : c'est ce qui compte ici. Le bruit de la
    // vitesse lissée et celui de la pente estimée sont corrélés — quand l'une
    // baisse, l'autre est négative —, et deux tirages indépendants perdent
    // exactement cette corrélation. Un premier essai bâti ainsi passait avant
    // le correctif comme après : il ne prouvait rien.
    for (const vitesse of [25, 40, 60, 90]) {
      for (const fenetreMs of [200, 1000, 2000]) {
        const profilBruite = {
          ...p,
          speed: { ...p.speed, accelWindowMs: fenetreMs },
        }
        const gearbox = makeGearbox(p)
        const conditioner = new SpeedConditioner(profilBruite.speed)
        const bruitKmh = bruit(1, 12345)
        gearbox.setMode('auto')
        gearbox.settleFor(rpmInGearAt(p, vitesse))
        const graine = fenetreMs

        // La charge est calculée par le moteur, et non figée : c'est elle qui
        // décale le seuil de passage — de huit cents tours de part et d'autre
        // sur ce profil. Une charge figée à un demi masquerait entièrement le
        // défaut qu'on cherche.
        const engine = new Engine(p.engine, p.mix)
        const passages: { t: number; from: number; to: number }[] = []
        let precedent = -1
        let load = 0.5
        let prochaineMesureMs = 0
        for (let frame = 0; frame * FRAME_S <= 60; frame += 1) {
          const t = frame * FRAME_S
          // La cadence relevée dans la voiture : une position toutes les trente
          // millisecondes dès qu'elle roule.
          while (prochaineMesureMs <= t * 1000) {
            conditioner.push({
              kmh: vitesse + bruitKmh(),
              at: prochaineMesureMs,
              accuracyM: 5,
              derived: false,
            })
            prochaineMesureMs += 30
          }
          const speed = conditioner.tick(FRAME_S)
          const kmh = speed.kmh
          const accelMs2 = speed.accelMs2
          const state = gearbox.tick(FRAME_S, {
            rpmInGear: rpmInGearAt(p, kmh),
            atStandstill: false,
            load,
            kmh,
            accelMs2,
          })
          load = engine.tick(FRAME_S, {
            kmh,
            accelMs2,
            totalRatio: state.ratio * p.drivetrain.finalDrive,
            wheelRadiusM: p.drivetrain.wheelRadiusM,
            atStandstill: false,
            isShifting: state.isShifting,
            throttle: null,
          }).load
          if (precedent >= 0 && state.gear !== precedent) {
            passages.push({ t, from: precedent, to: state.gear })
          }
          precedent = state.gear
        }

        // La boîte a le droit de monter en croisière — c'est son métier — mais
        // une fois posée elle ne doit plus bouger. On laisse vingt secondes à la
        // cascade, puis on n'accepte plus rien.
        // Les dix premières secondes laissent la vitesse lissée s'établir et la
        // cascade de croisière se faire ; ensuite, plus rien ne doit bouger.
        const apres = passages.filter((p) => p.t > 20)
        expect(apres, `${vitesse} km/h, fenêtre ${graine} ms`).toHaveLength(0)
        // Et aucun aller-retour, même pendant la cascade : un rapport quitté ne
        // se réengage pas.
        const montees = passages.filter((p) => p.to > p.from).length
        const descentes = passages.filter((p) => p.to < p.from).length
        expect(descentes, `${vitesse} km/h, fenêtre ${graine} ms`).toBe(0)
        expect(montees).toBeLessThanOrEqual(p.drivetrain.gearRatios.length - 1)
      }
    }
  })

  it('voit un ralentissement doux malgré le bruit, et descend', () => {
    // La contrepartie du test précédent : un critère insensible au bruit ne doit
    // pas devenir insensible à un vrai ralentissement. Un lever de pied à
    // 0,3 m/s² doit sortir la boîte de la croisière.
    const p = profile()
    const { shifts } = drive(
      p,
      (t) => (t < 20 ? 90 : Math.max(20, 90 - (t - 20) * 1.08)),
      90,
    )

    const descentes = shifts.filter((s) => s.to < s.from)
    expect(descentes.length).toBeGreaterThan(0)
  })

  it('ne descend pas dans un rapport au-delà de son seuil de montée', () => {
    const p = profile()

    // Mesuré avant : une descente en deuxième à 98 km/h plaçait le moteur à
    // 7232 tr/min, au ras du rupteur, et il y restait. Le plafond utile est le
    // seuil de montée du rapport visé, que le profil règle rapport par rapport.
    const { shifts } = drive(
      p,
      (t) => (t < 25 ? Math.min(180, t * 8) : Math.max(0, 180 - (t - 25) * 15)),
      60,
    )

    for (const descente of shifts.filter((s) => s.to < s.from && s.t > 25 && s.kmh > 5)) {
      const regime = rpmInGearAt(p, descente.kmh)(descente.to)
      const seuil = p.drivetrain.upshiftRpm[descente.to] ?? p.engine.redlineRpm
      // À la dispersion de charge près : le seuil se décale avec l'effort.
      expect(regime).toBeLessThanOrEqual(seuil + p.drivetrain.upshiftLoadSpreadRpm)
    }
  })
})

/**
 * Ralentir n'est pas croiser, même très doucement.
 *
 * David, en laissant la voiture décélérer : « parfois le simu passe une vitesse
 * supérieure au lieu de laisser ralentir et de finalement rétrograder ». La
 * bande de croisière est pourtant serrée du côté du ralentissement — un dixième
 * de m/s². Mais une décélération de roue libre s'y tient tout juste, et la
 * dérive mesurée oscille autour de la limite : chaque retour dans la bande
 * remet à zéro le compte de sortie, la tolérance de quatre dixièmes de seconde
 * absorbe le reste, et la vitesse tenue n'est jamais démentie alors qu'on perd
 * un kilomètre à l'heure toutes les deux secondes.
 */
describe('Gearbox — ralentir doucement ne fait pas monter un rapport', () => {
  it('ne monte pas en roue libre, même sur une décélération très douce', () => {
    const p = profile()
    // 90 km/h, puis une perte de 0,4 km/h par seconde : 0,11 m/s², à peine
    // au-delà de la limite de la bande, et bien en deçà d'un freinage.
    // On croise d'abord assez longtemps pour que la boîte ait acquis sa
    // stabilité et fini de monter : c'est l'état réel quand on lève le pied.
    const CROISIERE = 12
    const { shifts } = drive(
      p,
      (t) => (t < CROISIERE ? 90 : 90 - 0.5 * (t - CROISIERE)),
      CROISIERE + 20,
    )

    const montees = shifts.filter((s) => s.to > s.from && s.t > CROISIERE)
    expect(montees).toEqual([])
  })

  it("n'achève pas une montée au régime si on lève le pied avant", () => {
    const p = profile()
    // On accélère jusqu'à frôler le seuil du premier rapport, puis on lâche :
    // le compte à rebours du passage est lancé, la vitesse commence à baisser.
    // Le seuil est franchi, donc le compte à rebours du passage est lancé ;
    // on lève le pied dans la foulée, avant qu'il n'expire.
    const seuil = kmhForRpm(p, 1, p.drivetrain.upshiftRpm[1]!)
    const monteeS = 6
    const { shifts } = drive(
      p,
      (t) =>
        t < monteeS
          ? (seuil * 1.01 * t) / monteeS
          : Math.max(0, seuil * 1.01 - 0.6 * (t - monteeS)),
      monteeS + 12,
    )

    const tardives = shifts.filter((s) => s.to > s.from && s.t >= monteeS)
    expect(tardives).toEqual([])
  })

  it('monte toujours quand la vitesse est vraiment tenue', () => {
    const p = profile()
    const { shifts } = drive(p, () => 90, 25)

    expect(shifts.filter((s) => s.to > s.from).length).toBeGreaterThan(0)
  })
})
