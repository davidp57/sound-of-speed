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
  let last = gearbox.tick(FRAME_S, rpmInGearAt(p, 0), true, load, 0)

  for (let frame = 1; frame * FRAME_S <= seconds; frame += 1) {
    const t = frame * FRAME_S
    const kmh = speedAt(t)
    const rpmInGear = rpmInGearAt(p, kmh)
    const before = rpmInGear(previous)
    last = gearbox.tick(FRAME_S, rpmInGear, kmh < 1, load, kmh)
    if (last.gear !== previous) {
      shifts.push({ from: previous, to: last.gear, kmh, rpm: before })
      previous = last.gear
    }
  }
  return { shifts, gearbox, last }
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
    gearbox.tick(FRAME_S, rpmInGearAt(p, 80), false, 0.5, 80)
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
    const plancher = makeGearbox(p).tick(FRAME_S, rpmInGearAt(p, kmh), false, 1, kmh)
      .upshiftThresholdRpm
    const leve = makeGearbox(p).tick(FRAME_S, rpmInGearAt(p, kmh), false, 0, kmh)
      .upshiftThresholdRpm

    // L'écart total vaut le réglage : 1800 tr/min entre les deux extrêmes.
    expect(plancher - leve).toBeCloseTo(p.drivetrain.upshiftLoadSpreadRpm, 0)
    expect(plancher).toBeGreaterThan(leve)
  })

  it('ne descend jamais le seuil sous le régime plancher', () => {
    // Plancher très haut : il doit primer sur le décalage de charge.
    const p = profile({ minUpshiftRpm: 5000 })
    const gearbox = makeGearbox(p)

    const state = gearbox.tick(FRAME_S, rpmInGearAt(p, 40), false, 0, 40)

    expect(state.upshiftThresholdRpm).toBeGreaterThanOrEqual(5000)
  })

  it('attend la temporisation du rapport avant de passer', () => {
    const p = profile({ shiftDelaysS: [0.25, 1.5, 0.35, 0.55, 0.3, 0.45] })
    const gearbox = makeGearbox(p)

    // On se place en deuxième, juste au-dessus de son seuil, sans dépassement.
    const kmh = kmhForRpm(p, 1, p.drivetrain.upshiftRpm[1]! + 100)
    const rpmInGear = rpmInGearAt(p, kmh)
    gearbox.tick(FRAME_S, rpmInGear, false, 0.5, kmh) // amorce : quitte la première
    expect(gearbox.tick(FRAME_S, rpmInGear, false, 0.5, kmh).gear).toBe(1)

    // Un tiers de seconde : la condition est remplie, le passage est retenu.
    let state = gearbox.tick(FRAME_S, rpmInGear, false, 0.5, kmh)
    for (let f = 0; f * FRAME_S < 0.33; f += 1) {
      state = gearbox.tick(FRAME_S, rpmInGear, false, 0.5, kmh)
    }
    expect(state.gear).toBe(1)
    expect(state.isShiftReady).toBe(true)

    // Passé la temporisation d'une seconde et demie, il se produit.
    for (let f = 0; f * FRAME_S < 1.4; f += 1) {
      state = gearbox.tick(FRAME_S, rpmInGear, false, 0.5, kmh)
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
    for (let f = 0; f * FRAME_S < 0.2; f += 1) gearbox.tick(FRAME_S, rpmInGear, false, 0.5, kmh)
    const state = gearbox.tick(FRAME_S, rpmInGear, false, 0.5, kmh)

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
  it('rétrograde en décélération', () => {
    const p = profile()
    // Montée à 140, puis décélération franche jusqu'à l'arrêt.
    const { shifts } = drive(p, (t) => (t < 30 ? Math.min(140, t * 6) : Math.max(0, 140 - (t - 30) * 8)), 60)
    const descentes = shifts.filter((s) => s.to < s.from)

    expect(descentes.length).toBeGreaterThanOrEqual(3)
    // Un rétrogradage se produit sous le seuil de descente, jamais au-dessus.
    for (const descente of descentes) {
      expect(descente.rpm).toBeLessThanOrEqual(
        p.engine.redlineRpm * p.drivetrain.downshiftAtRedlineRatio + 1,
      )
    }
  })

  it('rétrograde d’autant plus tôt que le seuil de descente est haut', () => {
    const descenteVers3 = (downshiftAtRedlineRatio: number) => {
      const p = profile({ downshiftAtRedlineRatio })
      const { shifts } = drive(
        p,
        (t) => (t < 25 ? Math.min(130, t * 6) : Math.max(0, 130 - (t - 25) * 6)),
        60,
      )
      // Vitesse à laquelle le troisième rapport est retrouvé.
      return shifts.filter((s) => s.to === 2 && s.from > 2).at(-1)?.kmh ?? 0
    }

    // Mesuré : 46 km/h à 0,20 du rupteur, 73 km/h à 0,32, et 114 km/h à 0,50.
    // C'est ce réglage — « Descente sous » — qui commande le rétrogradage.
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
        (t) => (t < 25 ? Math.min(130, t * 6) : Math.max(0, 130 - (t - 25) * 6)),
        60,
      )
      return shifts.filter((s) => s.to === 2 && s.from > 2).at(-1)?.kmh ?? 0
    }

    expect(descenteVers3(4200)).toBe(descenteVers3(2600))
  })

  it('reste sur son rapport quand rétrograder ferait aussitôt remonter', () => {
    const p = profile()
    const gearbox = makeGearbox(p)

    // Vitesse telle que le rapport inférieur dépasserait son propre seuil de
    // montée : rétrograder relancerait un passage dans la foulée.
    const kmh = kmhForRpm(p, 2, p.drivetrain.upshiftRpm[2]! + 200)
    const rpmInGear = rpmInGearAt(p, kmh)
    // On amène la boîte sur un rapport long à cette vitesse.
    for (let f = 0; f * FRAME_S < 5; f += 1) gearbox.tick(FRAME_S, rpmInGear, false, 0.5, kmh)
    const gear = gearbox.tick(FRAME_S, rpmInGear, false, 0.5, kmh).gear

    // Le rapport se stabilise : pas de va-et-vient d'une image à l'autre.
    for (let f = 0; f * FRAME_S < 3; f += 1) {
      expect(gearbox.tick(FRAME_S, rpmInGear, false, 0.5, kmh).gear).toBe(gear)
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
    for (let f = 0; f * FRAME_S < 6; f += 1) gearbox.tick(FRAME_S, rpmInGear, false, 0.3, kmh)
    const avant = gearbox.tick(FRAME_S, rpmInGear, false, 0.3, kmh).gear

    // Pied au plancher : la demande dépasse le seuil de déclenchement.
    const apres = gearbox.tick(FRAME_S, rpmInGear, false, 1, kmh)

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

    for (let f = 0; f * FRAME_S < 6; f += 1) gearbox.tick(FRAME_S, rpmInGear, false, 0.3, kmh)
    const avant = gearbox.tick(FRAME_S, rpmInGear, false, 0.3, kmh).gear
    const apres = gearbox.tick(FRAME_S, rpmInGear, false, 1, kmh)

    expect(avant - apres.gear).toBeLessThanOrEqual(1)
  })

  it('ne dépasse pas le rupteur en descendant', () => {
    const p = profile()
    const gearbox = makeGearbox(p)
    // Vitesse basse : descendre de trois rapports mettrait le moteur au-delà.
    const kmh = 45
    const rpmInGear = rpmInGearAt(p, kmh)

    for (let f = 0; f * FRAME_S < 6; f += 1) gearbox.tick(FRAME_S, rpmInGear, false, 0.3, kmh)
    const apres = gearbox.tick(FRAME_S, rpmInGear, false, 1, kmh)

    expect(rpmInGear(apres.gear)).toBeLessThanOrEqual(p.engine.redlineRpm * 0.95)
  })

  it('ne se déclenche qu’une fois tant que la pédale reste enfoncée', () => {
    const p = profile()
    const gearbox = makeGearbox(p)
    const kmh = 110
    const rpmInGear = rpmInGearAt(p, kmh)

    for (let f = 0; f * FRAME_S < 6; f += 1) gearbox.tick(FRAME_S, rpmInGear, false, 0.3, kmh)
    const premier = gearbox.tick(FRAME_S, rpmInGear, false, 1, kmh).gear
    // Le passage court, puis on reste pied au plancher : pas de second
    // rétrogradage en cascade.
    for (let f = 0; f * FRAME_S < 1; f += 1) gearbox.tick(FRAME_S, rpmInGear, false, 1, kmh)
    const apres = gearbox.tick(FRAME_S, rpmInGear, false, 1, kmh)

    expect(apres.gear).toBeGreaterThanOrEqual(premier)
  })

  it('ne fait rien quand il est désactivé', () => {
    const base = createDefaultProfile()
    const p = profile({}, { kickdown: { ...base.feel.kickdown, enabled: false } })
    const gearbox = makeGearbox(p)
    const kmh = 110
    const rpmInGear = rpmInGearAt(p, kmh)

    for (let f = 0; f * FRAME_S < 6; f += 1) gearbox.tick(FRAME_S, rpmInGear, false, 0.3, kmh)
    const avant = gearbox.tick(FRAME_S, rpmInGear, false, 0.3, kmh).gear
    const apres = gearbox.tick(FRAME_S, rpmInGear, false, 1, kmh)

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
    expect(gearbox.tick(FRAME_S, rpmInGearAt(p, 80), false, 0.5, 80).gear).toBe(2)
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
      gearbox.tick(FRAME_S, rpmInGearAt(p, 80), false, 0.5, 80)
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
    for (let f = 0; f * FRAME_S < 3; f += 1) gearbox.tick(FRAME_S, rpmInGear, false, 1, kmh)

    expect(gearbox.tick(FRAME_S, rpmInGear, false, 1, kmh).gear).toBe(0)
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

    const state = gearbox.tick(FRAME_S, rpmInGearAt(p, 120), false, 1, 120)
    expect(state.gear).toBe(0)
    expect(state.isShifting).toBe(false)
    // Sans boîte, pas de « N » à l'arrêt : il n'y a rien à débrayer.
    expect(gearbox.tick(FRAME_S, rpmInGearAt(p, 0), true, 0, 0).label).toBe('1')
  })

  it('choisit d’emblée un rapport adapté à la vitesse', () => {
    const p = profile()
    const gearbox = makeGearbox(p)

    // Reprise en marche à 90 km/h : partir en première serait absurde.
    gearbox.settleFor(rpmInGearAt(p, 90))
    const state = gearbox.tick(FRAME_S, rpmInGearAt(p, 90), false, 0.5, 90)

    expect(state.gear).toBeGreaterThan(1)
    expect(rpmInGearAt(p, 90)(state.gear)).toBeLessThan(p.engine.redlineRpm)
  })
})
