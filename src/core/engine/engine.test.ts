import { describe, expect, it } from 'vitest'

import { Engine, type EngineInput } from './engine'
import { createDefaultProfile } from '../preset/defaults'

/**
 * Tests du moteur.
 *
 * L'essentiel porte sur le **découplage** : à l'arrêt et pendant un passage, le
 * régime ne suit plus les roues. C'est ce qui permet un coup d'accélérateur au
 * point mort, c'est la première chose que casse un changement d'inertie, et
 * c'est invisible sur un écran de télémétrie tant qu'on roule normalement.
 */

const FRAME_S = 1 / 60
const profile = createDefaultProfile()

function makeEngine() {
  const p = createDefaultProfile()
  return new Engine(p.engine, p.mix)
}

/** Entrée par défaut : à l'arrêt, sans gaz, sans passage en cours. */
function input(overrides: Partial<EngineInput> = {}): EngineInput {
  return {
    kmh: 0,
    accelMs2: 0,
    // Un rapport de croisière, pas le premier : en première, 80 km/h place le
    // moteur au rupteur et tout ce qu'on mesurerait ensuite serait le bornage.
    totalRatio: profile.drivetrain.gearRatios[3]! * profile.drivetrain.finalDrive,
    wheelRadiusM: profile.drivetrain.wheelRadiusM,
    atStandstill: true,
    isShifting: false,
    throttle: null,
    ...overrides,
  }
}

/** Fait tourner le moteur pendant une durée, avec une entrée constante. */
function settle(engine: Engine, seconds: number, over: Partial<EngineInput> = {}) {
  let state = engine.tick(FRAME_S, input(over))
  for (let f = 1; f * FRAME_S <= seconds; f += 1) state = engine.tick(FRAME_S, input(over))
  return state
}

describe('Engine.kinematicRpm', () => {
  it('convertit une vitesse en régime', () => {
    // 100 km/h, rapport total 3,3, roue de 0,33 m de rayon.
    // Circonférence 2π × 0,33 = 2,073 m ; 27,78 m/s ⇒ 13,4 tr/s de roue ;
    // ×60 ×3,3 ⇒ 2653 tr/min.
    const rpm = Engine.kinematicRpm(100, 3.3, 0.33)

    expect(rpm).toBeGreaterThan(2600)
    expect(rpm).toBeLessThan(2700)
  })

  it('est proportionnel à la vitesse et au rapport', () => {
    const base = Engine.kinematicRpm(50, 3, 0.33)

    expect(Engine.kinematicRpm(100, 3, 0.33)).toBeCloseTo(base * 2, 5)
    expect(Engine.kinematicRpm(50, 6, 0.33)).toBeCloseTo(base * 2, 5)
  })

  it('donne un régime nul à l’arrêt', () => {
    expect(Engine.kinematicRpm(0, 3, 0.33)).toBe(0)
  })
})

describe('Engine — découplage', () => {
  it('retombe au ralenti à l’arrêt, même si les roues tournent vite', () => {
    const engine = makeEngine()

    // Contradiction volontaire : une vitesse élevée déclarée à l'arrêt. C'est
    // ce que produit un GPS qui tremble pendant que la voiture est immobile.
    const state = settle(engine, 3, { kmh: 90, atStandstill: true })

    expect(state.rpm).toBeCloseTo(profile.engine.idleRpm, 0)
  })

  it('monte librement quand on donne des gaz à l’arrêt', () => {
    const engine = makeEngine()

    const state = settle(engine, 2, { atStandstill: true, throttle: 1 })

    // Le coup d'accélérateur au point mort : le régime va chercher le rupteur.
    expect(state.rpm).toBeGreaterThan(profile.engine.redlineRpm * 0.9)
  })

  it('redescend au ralenti quand on relâche', () => {
    const engine = makeEngine()

    settle(engine, 2, { atStandstill: true, throttle: 1 })
    const state = settle(engine, 3, { atStandstill: true, throttle: 0 })

    expect(state.rpm).toBeCloseTo(profile.engine.idleRpm, 0)
  })

  it('coupe le couple pendant un passage : le régime décroche des roues', () => {
    const engine = makeEngine()
    const rolling = { kmh: 80, atStandstill: false, throttle: null }

    const engaged = settle(engine, 2, rolling)
    const shifting = settle(engine, 0.5, { ...rolling, isShifting: true })

    // Mesuré par construction : la cible pendant un passage vaut 72 % du régime
    // cinématique, donc le régime chute nettement sous celui des roues.
    expect(shifting.rpm).toBeLessThan(engaged.rpm * 0.85)
    expect(shifting.rpm).toBeLessThan(shifting.kinematicRpm)
    expect(shifting.rpm).toBeGreaterThan(profile.engine.idleRpm)
  })

  it('suit les roues dès que le couple revient', () => {
    const engine = makeEngine()
    const rolling = { kmh: 80, atStandstill: false, throttle: null }

    settle(engine, 1, { ...rolling, isShifting: true })
    const state = settle(engine, 1, rolling)

    expect(state.rpm).toBeCloseTo(state.kinematicRpm, 0)
  })

  it('signale le ralenti quand les roues ne mènent plus le moteur', () => {
    const engine = makeEngine()

    const slow = engine.tick(FRAME_S, input({ kmh: 2, atStandstill: false }))
    const fast = engine.tick(FRAME_S, input({ kmh: 90, atStandstill: false }))

    expect(slow.idling).toBe(true)
    expect(fast.idling).toBe(false)
  })
})

describe('Engine — régime', () => {
  it('ne dépasse jamais le rupteur', () => {
    const engine = makeEngine()

    // Une vitesse absurde dans un rapport court : le régime cinématique
    // dépasserait largement le rupteur.
    const state = settle(engine, 3, { kmh: 400, atStandstill: false, throttle: 1 })

    expect(state.rpm).toBeLessThanOrEqual(profile.engine.redlineRpm)
    expect(state.kinematicRpm).toBeGreaterThan(profile.engine.redlineRpm)
  })

  it('monte plus vite à vide quand la montée à vide est plus vive', () => {
    const base = createDefaultProfile()
    const vif = new Engine({ ...base.engine, freeRevRate: 18000 }, base.mix)
    const mou = new Engine({ ...base.engine, freeRevRate: 3000 }, base.mix)
    const over = { atStandstill: true, throttle: 1 }

    let vifState = vif.tick(FRAME_S, input(over))
    let mouState = mou.tick(FRAME_S, input(over))
    for (let f = 1; f * FRAME_S <= 0.3; f += 1) {
      vifState = vif.tick(FRAME_S, input(over))
      mouState = mou.tick(FRAME_S, input(over))
    }

    expect(vifState.rpm).toBeGreaterThan(mouState.rpm)
  })

  it('retombe plus vite quand le frein moteur est plus fort', () => {
    const base = createDefaultProfile()
    const fort = new Engine({ ...base.engine, engineBraking: 12000 }, base.mix)
    const faible = new Engine({ ...base.engine, engineBraking: 1500 }, base.mix)
    const monte = { atStandstill: true, throttle: 1 }
    const lache = { atStandstill: true, throttle: 0 }

    for (let f = 0; f * FRAME_S <= 2; f += 1) {
      fort.tick(FRAME_S, input(monte))
      faible.tick(FRAME_S, input(monte))
    }
    let fortState = fort.tick(FRAME_S, input(lache))
    let faibleState = faible.tick(FRAME_S, input(lache))
    for (let f = 1; f * FRAME_S <= 0.3; f += 1) {
      fortState = fort.tick(FRAME_S, input(lache))
      faibleState = faible.tick(FRAME_S, input(lache))
    }

    expect(fortState.rpm).toBeLessThan(faibleState.rpm)
  })

  it('freine d’autant plus lentement que le volant est lourd', () => {
    const base = createDefaultProfile()
    const lourd = new Engine({ ...base.engine, inertia: 4 }, base.mix)
    const leger = new Engine({ ...base.engine, inertia: 0.5 }, base.mix)
    const over = { atStandstill: true, throttle: 1 }

    let lourdState = lourd.tick(FRAME_S, input(over))
    let legerState = leger.tick(FRAME_S, input(over))
    for (let f = 1; f * FRAME_S <= 0.3; f += 1) {
      lourdState = lourd.tick(FRAME_S, input(over))
      legerState = leger.tick(FRAME_S, input(over))
    }

    expect(lourdState.rpm).toBeLessThan(legerState.rpm)
  })

  it('rapporte la fréquence d’allumage du nombre de cylindres déclaré', () => {
    const engine = makeEngine()

    const state = settle(engine, 1, { atStandstill: true, throttle: 0 })

    // f = régime / 120 × cylindres.
    expect(state.firingHz).toBeCloseTo((state.rpm / 120) * profile.engine.cylinders, 6)
  })

  it('rapporte la fraction du rupteur, bornée à un', () => {
    const engine = makeEngine()

    const bas = settle(engine, 1, { atStandstill: true, throttle: 0 })
    expect(bas.rpmFraction).toBeCloseTo(profile.engine.idleRpm / profile.engine.redlineRpm, 2)

    const haut = settle(engine, 3, { kmh: 400, atStandstill: false, throttle: 1 })
    expect(haut.rpmFraction).toBeLessThanOrEqual(1)
  })
})

describe('Engine — charge', () => {
  it('déduit la charge de l’accélération quand il n’y a pas de pédale', () => {
    const full = profile.mix.fullLoadAccelMs2
    const rolling = { kmh: 60, atStandstill: false, throttle: null }

    // Accélération franche : pleine charge.
    expect(settle(makeEngine(), 2, { ...rolling, accelMs2: full }).load).toBeCloseTo(1, 1)
    // Décélération franche : pied levé.
    expect(settle(makeEngine(), 2, { ...rolling, accelMs2: -full }).load).toBeCloseTo(0, 1)
    // Vitesse tenue : le milieu. C'est l'approximation assumée du procédé.
    expect(settle(makeEngine(), 2, { ...rolling, accelMs2: 0 }).load).toBeCloseTo(0.5, 1)
  })

  it('borne la charge entre zéro et un', () => {
    const rolling = { kmh: 60, atStandstill: false, throttle: null }

    // Le lissage est exponentiel : la charge s'approche de la borne sans
    // jamais l'atteindre exactement, ce qui suffit.
    expect(settle(makeEngine(), 2, { ...rolling, accelMs2: 50 }).load).toBeGreaterThan(0.999)
    expect(settle(makeEngine(), 2, { ...rolling, accelMs2: -50 }).load).toBeLessThan(0.001)
  })

  it('ne retient que la pédale quand elle est connue', () => {
    const rolling = { kmh: 60, atStandstill: false }

    // Pédale relâchée et pourtant forte accélération mesurée : la pédale fait
    // foi, seule. C'est ce qui a supprimé la seconde de retard au relâchement.
    const state = settle(makeEngine(), 2, {
      ...rolling,
      throttle: 0,
      accelMs2: profile.mix.fullLoadAccelMs2 * 2,
    })

    expect(state.load).toBeCloseTo(0, 2)
  })

  it('lisse la charge au lieu de la faire sauter', () => {
    const engine = makeEngine()
    const rolling = { kmh: 60, atStandstill: false, throttle: null }

    settle(engine, 2, { ...rolling, accelMs2: -profile.mix.fullLoadAccelMs2 })
    // Une seule image de pleine accélération ne doit pas suffire à faire monter
    // la charge d'un extrême à l'autre.
    const apres = engine.tick(FRAME_S, input({ ...rolling, accelMs2: profile.mix.fullLoadAccelMs2 }))

    expect(apres.load).toBeGreaterThan(0)
    expect(apres.load).toBeLessThan(0.3)
  })
})

describe('Engine — rupteur', () => {
  it('s’active au seuil de coupure et hache le régime', () => {
    const engine = makeEngine()

    const state = settle(engine, 3, { kmh: 400, atStandstill: false, throttle: 1 })

    expect(state.limiterActive).toBe(true)
    expect(state.rpm).toBeGreaterThan(profile.engine.softLimitRpm * 0.98)
    expect(state.rpm).toBeLessThanOrEqual(profile.engine.redlineRpm)
  })

  it('reste inactif sous le seuil de coupure', () => {
    const engine = makeEngine()

    const state = settle(engine, 2, { kmh: 60, atStandstill: false, throttle: null })

    expect(state.limiterActive).toBe(false)
  })

  it('tient la coupure la durée déclarée', () => {
    const base = createDefaultProfile()
    const engine = new Engine({ ...base.engine, limiterHoldMs: 200 }, base.mix)
    const over = { kmh: 400, atStandstill: false, throttle: 1 }

    // On atteint le rupteur, ce qui arme une coupure de 200 ms.
    let state = engine.tick(FRAME_S, input(over))
    while (!state.limiterActive) state = engine.tick(FRAME_S, input(over))

    // À 100 ms la coupure court encore, à 250 ms elle est finie.
    for (let f = 0; f * FRAME_S < 0.1; f += 1) state = engine.tick(FRAME_S, input(over))
    expect(state.limiterActive).toBe(true)

    for (let f = 0; f * FRAME_S < 0.16; f += 1) state = engine.tick(FRAME_S, input(over))
    // La coupure précédente est échue ; une nouvelle peut être armée aussitôt,
    // donc on vérifie seulement que le régime est resté sous le rupteur.
    expect(state.rpm).toBeLessThanOrEqual(base.engine.redlineRpm)
  })
})

describe('Engine — réinitialisation', () => {
  it('revient au ralenti', () => {
    const engine = makeEngine()

    settle(engine, 2, { atStandstill: true, throttle: 1 })
    engine.reset()
    const state = engine.tick(FRAME_S, input())

    expect(state.rpm).toBeCloseTo(profile.engine.idleRpm, 0)
    // La charge repart de zéro : une seule image ne la ramène pas au milieu.
    expect(state.load).toBeLessThan(0.1)
    expect(state.limiterActive).toBe(false)
  })
})
