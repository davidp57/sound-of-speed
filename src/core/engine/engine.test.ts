import { describe, expect, it } from 'vitest'

import { Engine, type EngineInput } from './engine'
import { createDefaultProfile, createRoadProfile } from '../preset/defaults'

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

describe('Engine — effort', () => {
  const rolling = { atStandstill: false, throttle: null }

  it('croît avec la vitesse à accélération nulle', () => {
    // Le défaut que ce lot corrige : tenir une allure donnait toujours le même
    // demi, de l'arrêt à 130 km/h. Mesuré avant, cinq allures à 0,50 au
    // centième près.
    const tenu = (kmh: number) => settle(makeEngine(), 3, { ...rolling, kmh, accelMs2: 0 }).effort

    expect(tenu(30)).toBeLessThan(tenu(90))
    expect(tenu(90)).toBeLessThan(tenu(130))
    expect(tenu(130)).toBeGreaterThan(tenu(30) + 0.3)
  })

  it('vaut la moitié au repère de traînée', () => {
    // C'est la définition du réglage : à cette vitesse-là, tenir l'allure
    // consomme la moitié de la charge disponible.
    const p = createDefaultProfile()
    const tenu = settle(makeEngine(), 3, { ...rolling, kmh: p.mix.dragRefKmh, accelMs2: 0 })

    expect(tenu.effort).toBeCloseTo(0.5, 2)
  })

  it('est nul à l’arrêt', () => {
    // Et c'est ce qui fait perdre au ralenti le niveau que la charge à 0,5 lui
    // donnait sans raison : `idleLevelDb` le lui rend.
    expect(settle(makeEngine(), 3, { kmh: 0, accelMs2: 0, throttle: null }).effort).toBeCloseTo(0, 3)
  })

  it('sature à pleine charge et ne dépasse pas', () => {
    const plein = settle(makeEngine(), 3, {
      ...rolling,
      kmh: 200,
      accelMs2: profile.mix.fullLoadAccelMs2 * 2,
    })

    expect(plein.effort).toBeCloseTo(1, 2)
    expect(plein.effort).toBeLessThanOrEqual(1)
  })

  it('ajoute l’accélération à la traînée', () => {
    // Une reprise douce à haute vitesse est le cas du reproche : elle était
    // écrasée entre la croisière et le vrombissement du haut des tours.
    const tenu = settle(makeEngine(), 3, { ...rolling, kmh: 110, accelMs2: 0 })
    const douce = settle(makeEngine(), 3, { ...rolling, kmh: 110, accelMs2: 0.55 })

    expect(douce.effort).toBeGreaterThan(tenu.effort + 0.2)
  })

  it('laisse la charge tranquille : elle reste l’intention du conducteur', () => {
    // Le garde-fou du lot. La boîte lit la charge, et rien de ce qui précède ne
    // doit la déplacer — sans quoi tous les seuils de passage seraient à
    // recaler dans les profils livrés.
    const lent = settle(makeEngine(), 3, { ...rolling, kmh: 30, accelMs2: 0 })
    const vite = settle(makeEngine(), 3, { ...rolling, kmh: 130, accelMs2: 0 })

    expect(lent.load).toBeCloseTo(0.5, 2)
    expect(vite.load).toBeCloseTo(0.5, 2)
  })

  it('suit le repère de traînée du profil', () => {
    // Sport porte un repère plus haut : à vitesse égale, sa traînée pèse moins.
    const route = createRoadProfile()
    const sport = createDefaultProfile()
    const effortAt = (p: ReturnType<typeof createRoadProfile>) => {
      const engine = new Engine(p.engine, p.mix)
      let state = engine.tick(FRAME_S, input({ ...rolling, kmh: 130, accelMs2: 0 }))
      for (let i = 0; i < 180; i += 1) {
        state = engine.tick(FRAME_S, input({ ...rolling, kmh: 130, accelMs2: 0 }))
      }
      return state.effort
    }

    expect(route.mix.dragRefKmh).toBeLessThan(sport.mix.dragRefKmh)
    expect(effortAt(route)).toBeGreaterThan(effortAt(sport))
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

describe('Engine — décollage', () => {
  /**
   * Le régime que le moteur tient après deux secondes d'établissement.
   *
   * On laisse passer le transitoire : ce qu'on juge est le régime tenu, pas la
   * montée qui y mène.
   */
  function tenu(over: Partial<EngineInput>): number {
    const engine = makeEngine()
    let rpm = 0
    for (let f = 0; f * FRAME_S <= 2; f += 1) rpm = engine.tick(FRAME_S, input(over)).rpm
    return rpm
  }

  /** La première, celle où l'on décolle. */
  const premiere = profile.drivetrain.gearRatios[0]! * profile.drivetrain.finalDrive

  it('quitte le ralenti dès que la voiture avance', () => {
    // Le défaut que David a entendu : de zéro à six kilomètres à l'heure, le
    // régime restait collé au ralenti et le son était celui de l'arrêt. Une
    // voiture ne fait pas cela — on lâche l'embrayage et le moteur monte.
    const arret = tenu({ kmh: 0, atStandstill: true, throttle: 0 })
    const lance = tenu({ kmh: 5, atStandstill: false, throttle: 0, totalRatio: premiere })

    expect(arret).toBeCloseTo(profile.engine.idleRpm, 0)
    expect(lance).toBeGreaterThan(profile.engine.idleRpm + 300)
  })

  it('tient le régime de décollage pendant que la voiture prend de la vitesse', () => {
    // C'est ce qu'on entend en vrai : le moteur monte, **reste** là, et les
    // roues le rejoignent ensuite.
    const trois = tenu({ kmh: 3, atStandstill: false, throttle: 0, totalRatio: premiere })
    const cinq = tenu({ kmh: 5, atStandstill: false, throttle: 0, totalRatio: premiere })

    expect(trois).toBeCloseTo(cinq, 0)
    expect(trois).toBeCloseTo(profile.engine.launchRpm, 0)
  })

  it('laisse les roues commander quand elles tournent assez vite', () => {
    // En première, vingt kilomètres à l'heure font tourner les roues bien
    // au-dessus du régime de décollage : l'embrayage est fermé.
    const vite = tenu({ kmh: 20, atStandstill: false, throttle: 0, totalRatio: premiere })

    expect(vite).toBeGreaterThan(2400)
  })

  it('ne relève pas un régime bas sur un grand rapport', () => {
    // Trente kilomètres à l'heure à mille cent tours n'est pas un décollage,
    // c'est une allure tenue sur un rapport long. L'embrayage y est fermé.
    // Le rapport de croisière du banc, celui que `input` pose par défaut.
    const long = tenu({ kmh: 30, atStandstill: false, throttle: 0 })

    expect(long).toBeCloseTo(1118, -1)
    expect(long).toBeLessThan(profile.engine.launchRpm)
  })
})

describe('Engine — tremblement de régime', () => {
  /**
   * Excursion du régime entendu autour du régime net, sur trente secondes.
   *
   * Deux secondes de mise en régime ne sont pas comptées : le régime et la
   * charge mettent ce temps à s'établir, et ce qu'on mesure est l'écart en
   * régime établi.
   */
  function excursion(engine: Engine, over: Partial<EngineInput>) {
    for (let f = 0; f * FRAME_S <= 2; f += 1) engine.tick(FRAME_S, input(over))

    let lo = Infinity
    let hi = -Infinity
    for (let f = 0; f * FRAME_S <= 30; f += 1) {
      const state = engine.tick(FRAME_S, input(over))
      const ecart = state.audibleRpm - state.rpm
      lo = Math.min(lo, ecart)
      hi = Math.max(hi, ecart)
    }
    return { lo, hi, span: hi - lo }
  }

  const ralenti = { atStandstill: true, throttle: 0 }
  const lent = { kmh: 30, atStandstill: false, throttle: 0 }
  const lentEnCharge = { kmh: 30, atStandstill: false, throttle: 1 }
  const vite = { kmh: 80, atStandstill: false, throttle: 0 }
  const viteEnCharge = { kmh: 80, atStandstill: false, throttle: 1 }

  it('fait trembler le régime au ralenti', () => {
    const { lo, hi, span } = excursion(makeEngine(), ralenti)

    // Mesuré sur le profil Sport, réglé à 35 tr/min : 0 à +33,9 tr/min. Le
    // creux est nul parce que le régime est exactement à son plancher au
    // ralenti et que le tremblement ne descend pas sous le ralenti —
    // l'excursion y est donc à sens unique.
    expect(lo).toBe(0)
    expect(hi).toBeGreaterThan(32)
    expect(hi).toBeLessThanOrEqual(profile.engine.flutterRpm)
    expect(span).toBeGreaterThan(32)
  })

  it('tremble de part et d’autre dès que le moteur est entraîné', () => {
    const { lo, hi } = excursion(makeEngine(), lent)

    // Mesuré : ±29,9 tr/min à 1118 tr/min, pied levé.
    expect(lo).toBeLessThan(-28)
    expect(hi).toBeGreaterThan(28)
  })

  it('décroît quand le régime monte', () => {
    const bas = excursion(makeEngine(), lent)
    const haut = excursion(makeEngine(), vite)

    // Mesuré : 59,8 tr/min crête à crête à 1118 tr/min, 36,5 à 2981 — un
    // moteur se stabilise en montant.
    expect(bas.span).toBeCloseTo(59.8, 0)
    expect(haut.span).toBeCloseTo(36.5, 0)
    expect(haut.span).toBeLessThan(bas.span * 0.7)
  })

  it('décroît quand la charge monte', () => {
    const leve = excursion(makeEngine(), vite)
    const ecrase = excursion(makeEngine(), viteEnCharge)

    // Mesuré à 2981 tr/min : 36,5 tr/min crête à crête pied levé, 14,6 pied au
    // plancher — un moteur se stabilise sous couple.
    expect(ecrase.span).toBeCloseTo(14.6, 0)
    expect(ecrase.span).toBeLessThan(leve.span * 0.45)

    // Et à bas régime aussi, où le tremblement est le plus fort.
    expect(excursion(makeEngine(), lentEnCharge).span).toBeLessThan(
      excursion(makeEngine(), lent).span * 0.45,
    )
  })

  it('ne tremble pas du tout à amplitude nulle', () => {
    const base = createDefaultProfile()
    const engine = new Engine({ ...base.engine, flutterRpm: 0 }, base.mix)

    // Exactement le comportement d'avant ce réglage : le régime entendu est le
    // régime net, au bit près, dans toutes les situations.
    for (const over of [ralenti, lent, vite, viteEnCharge]) {
      for (let f = 0; f * FRAME_S <= 5; f += 1) {
        const state = engine.tick(FRAME_S, input(over))
        expect(state.audibleRpm).toBe(state.rpm)
      }
    }
  })

  it('donne deux fois la même suite pour la même suite de pas', () => {
    // Des sinusoïdes et non un tirage au sort : la reproductibilité ne dépend
    // pas d'une graine à passer, elle est acquise par construction.
    const un = makeEngine()
    const deux = makeEngine()

    for (let f = 0; f * FRAME_S <= 10; f += 1) {
      expect(un.tick(FRAME_S, input(vite)).audibleRpm).toBe(
        deux.tick(FRAME_S, input(vite)).audibleRpm,
      )
    }
  })

  it('repart de la même phase après une réinitialisation', () => {
    const engine = makeEngine()

    const premier: number[] = []
    for (let f = 0; f * FRAME_S <= 3; f += 1) {
      premier.push(engine.tick(FRAME_S, input(vite)).audibleRpm)
    }

    engine.reset()
    const second: number[] = []
    for (let f = 0; f * FRAME_S <= 3; f += 1) {
      second.push(engine.tick(FRAME_S, input(vite)).audibleRpm)
    }

    expect(second).toEqual(premier)
  })

  it('ne franchit ni le rupteur ni le ralenti', () => {
    const base = createDefaultProfile()
    // Amplitude absurde : elle dépasse la plage entière du moteur, donc si le
    // bornage manquait, on le verrait tout de suite.
    const engine = new Engine({ ...base.engine, flutterRpm: 4000 }, base.mix)

    for (const over of [ralenti, lent, { kmh: 400, atStandstill: false, throttle: 1 }]) {
      for (let f = 0; f * FRAME_S <= 10; f += 1) {
        const state = engine.tick(FRAME_S, input(over))
        expect(state.audibleRpm).toBeLessThanOrEqual(base.engine.redlineRpm)
        expect(state.audibleRpm).toBeGreaterThanOrEqual(base.engine.idleRpm)
      }
    }
  })

  it('n’atteint pas la boîte : le régime net reste lisse', () => {
    // La boîte, ses seuils et la télémétrie travaillent sur `rpm`. Trois défauts
    // d'oscillation de boîte viennent d'un compteur portant deux sens : le
    // tremblement ne doit pas en ouvrir un quatrième.
    const engine = makeEngine()
    for (let f = 0; f * FRAME_S <= 2; f += 1) engine.tick(FRAME_S, input(vite))

    let precedent = engine.tick(FRAME_S, input(vite)).rpm
    for (let f = 0; f * FRAME_S <= 5; f += 1) {
      const state = engine.tick(FRAME_S, input(vite))
      // À vitesse tenue, le régime net ne bouge plus d'un tour d'une image à
      // l'autre, quand le régime entendu tremble de ±18.
      expect(Math.abs(state.rpm - precedent)).toBeLessThan(1)
      precedent = state.rpm
    }
  })

  it('donne aux profils livrés un tremblement qui suit leur caractère', () => {
    const route = createRoadProfile()
    const sport = createDefaultProfile()

    // Un moteur de sport a un ralenti plus instable qu'un moteur de série.
    expect(sport.engine.flutterRpm).toBeGreaterThan(route.engine.flutterRpm)
    // Mesuré : 24,2 tr/min d'excursion au ralenti sur Route, 33,9 sur Sport.
    expect(excursion(new Engine(route.engine, route.mix), ralenti).span).toBeCloseTo(24.2, 0)
    expect(excursion(new Engine(sport.engine, sport.mix), ralenti).span).toBeCloseTo(33.9, 0)
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
