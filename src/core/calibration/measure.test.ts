import { describe, expect, it } from 'vitest'

import { HELD_MIN_S, measureTrace, percentile, weightedPercentile } from './measure'
import type { Trace } from '../speed/replay'
import type { SpeedSample } from '../speed/source'

/**
 * Tests de la mesure d'une trace.
 *
 * Le procédé est le même que pour le conditionnement : on fabrique une trace
 * dont on **connaît la vérité** — une rampe à 3 m/s², un palier à 50 km/h, un
 * bruit d'écart-type 0,6 km/h — puis on regarde ce que la mesure en tire. Les
 * bornes des assertions sont les valeurs relevées, notées en regard : elles
 * décrivent ce que le procédé rend, elles ne fixent pas un objectif.
 *
 * La cadence est un paramètre partout, parce que c'est elle qui a fait tomber le
 * conditionnement : trente millisecondes dans une Tesla en mouvement, une
 * seconde sur un GPS ordinaire, plusieurs secondes à l'arrêt.
 */

/**
 * Générateur pseudo-aléatoire à graine.
 *
 * `Math.random` rendrait les bornes de ces tests instables d'une exécution à
 * l'autre, et l'on ne saurait plus si un échec vient du code ou du tirage.
 */
function rng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface TraceOptions {
  durationS: number
  cadenceMs: number
  /** Vitesse vraie, en km/h, à un instant donné en secondes. */
  kmhAt: (t: number) => number
  /** Écart-type du bruit ajouté, en km/h. */
  noiseKmh?: number
  seed?: number
}

/**
 * Trace synthétique.
 *
 * Le bruit est tiré uniformément puis mis à l'échelle par √3, de sorte que son
 * écart-type vaille exactement ce qu'on demande — un tirage uniforme sur
 * [−a, a] a pour écart-type a/√3.
 */
function buildTrace(options: TraceOptions): Trace {
  const random = rng(options.seed ?? 1)
  const samples: SpeedSample[] = []
  const startedAt = 1_700_000_000_000
  for (let ms = 0; ms <= options.durationS * 1000; ms += options.cadenceMs) {
    const noise = options.noiseKmh
      ? (random() * 2 - 1) * options.noiseKmh * Math.sqrt(3)
      : 0
    samples.push({
      kmh: Math.max(0, options.kmhAt(ms / 1000) + noise),
      at: startedAt + ms,
      accuracyM: 5,
      derived: false,
    })
  }
  return { name: 'synthétique', startedAt, samples }
}

/** Rampe d'accélération constante depuis l'arrêt. */
const ramp = (accelMs2: number) => (t: number) => accelMs2 * 3.6 * t

describe('measureTrace — accélération', () => {
  it('retrouve exactement une rampe propre, à toute cadence', () => {
    for (const accelMs2 of [1, 2, 3, 4]) {
      for (const cadenceMs of [30, 250, 1000]) {
        const measure = measureTrace(buildTrace({ durationS: 8, cadenceMs, kmhAt: ramp(accelMs2) }))
        // Mesuré : la valeur rendue est exacte à quatre décimales dans les douze
        // combinaisons. Une rampe *est* une droite, et l'ajustement est une
        // droite : il n'y a rien à approcher.
        expect(measure.peakAccelMs2).toBeCloseTo(accelMs2, 3)
        expect(measure.peakDecelMs2).toBeCloseTo(accelMs2, 3)
      }
    }
  })

  it('estime encore une pente à une mesure par seconde', () => {
    // La fenêtre d'une seconde, centrée, ne contient que la mesure du milieu à
    // cette cadence : sans le plancher de deux mesures, aucune pente ne serait
    // estimée du tout. Relevé avant le correctif : `null` partout.
    const measure = measureTrace(buildTrace({ durationS: 12, cadenceMs: 1000, kmhAt: ramp(3) }))

    expect(measure.count).toBe(13)
    expect(measure.peakAccelMs2).toBeCloseTo(3, 3)
    expect(measure.points.every((p) => p.accelMs2 !== null)).toBe(true)
  })

  it('sur-estime légèrement la crête quand le GPS bruite', () => {
    const measure = measureTrace(
      buildTrace({ durationS: 20, cadenceMs: 30, kmhAt: ramp(2), noiseKmh: 0.6, seed: 7 }),
    )

    // Mesuré : 2,205 m/s² pour 2,000 injectés, soit +0,20. Le 95ᵉ centile d'une
    // pente bruitée retient la crête du bruit autant que celle du mouvement ;
    // l'écart vaut environ 1,6 fois l'écart-type de la pente, lui-même de
    // 0,10 m/s² dans ces conditions. Sur une reprise réelle à 3 ou 4 m/s², cela
    // fait 5 à 7 % d'optimisme, et c'est le sens de l'erreur qu'on préfère :
    // une charge pleine annoncée un peu haut ne bascule pas trop tôt.
    expect(measure.peakAccelMs2).toBeCloseTo(2.2, 1)
  })
})

describe('measureTrace — bruit et cadence', () => {
  it('retrouve l’écart-type du bruit injecté', () => {
    // Mesuré à 30 ms de cadence, sur une rampe à 2 m/s² de 20 s :
    // 0,3 → 0,3031 · 0,6 → 0,6058 · 1,0 → 1,0096. Moins de 1,5 % d'écart.
    for (const [injected, expected] of [
      [0.3, 0.3031],
      [0.6, 0.6058],
      [1, 1.0096],
    ] as const) {
      const measure = measureTrace(
        buildTrace({ durationS: 20, cadenceMs: 30, kmhAt: ramp(2), noiseKmh: injected, seed: 7 }),
      )
      expect(measure.noiseKmh).toBeCloseTo(expected, 3)
    }
  })

  it('ne compte presque rien de la courbure du mouvement comme du bruit', () => {
    const shape = (t: number): number => 80 + 15 * Math.sin((2 * Math.PI * t) / 20)
    const clean = measureTrace(buildTrace({ durationS: 60, cadenceMs: 30, kmhAt: shape }))
    const noisy = measureTrace(
      buildTrace({ durationS: 60, cadenceMs: 30, kmhAt: shape, noiseKmh: 0.6, seed: 3 }),
    )

    // Mesuré sur une vitesse qui ondule de ±15 km/h en vingt secondes, sans
    // aucun bruit injecté : 0,0072 km/h attribués au bruit. La courbure d'une
    // vitesse réelle est donc négligeable devant le bruit d'un GPS, et le
    // chiffre rendu est bien celui du GPS.
    expect(clean.noiseKmh ?? 0).toBeLessThan(0.02)
    // Et le même ondoiement bruité rend 0,6218 pour 0,6 injectés.
    expect(noisy.noiseKmh).toBeCloseTo(0.6218, 3)
  })

  it('refuse de chiffrer le bruit à une mesure par seconde', () => {
    const measure = measureTrace(
      buildTrace({ durationS: 60, cadenceMs: 1000, kmhAt: ramp(2), noiseKmh: 0.6, seed: 7 }),
    )

    // Avec une mesure par seconde il n'y a rien à moyenner : on ne peut pas
    // distinguer le bruit du mouvement, et on le dit plutôt que de rendre un
    // chiffre qui serait la courbure du trajet.
    expect(measure.noiseKmh).toBeNull()
  })

  it('rend la cadence médiane, insensible à une interruption', () => {
    const trace = buildTrace({ durationS: 10, cadenceMs: 30, kmhAt: ramp(2) })
    // Une page mise en veille par le navigateur : un trou de soixante secondes
    // au milieu. La moyenne des intervalles annoncerait 210 ms, la médiane 30.
    const middle = trace.samples[150]
    if (middle) {
      for (let i = 150; i < trace.samples.length; i += 1) {
        const sample = trace.samples[i]
        if (sample) sample.at += 60_000
      }
    }

    expect(measureTrace(trace).cadenceMs).toBe(30)
  })
})

describe('measureTrace — vitesses', () => {
  it('retient les paliers, pas les arrêts', () => {
    const kmhAt = (t: number): number => {
      if (t < 10) return 50
      if (t < 15) return 50 + (t - 10) * 8
      return 90
    }
    const measure = measureTrace(buildTrace({ durationS: 40, cadenceMs: 200, kmhAt }))

    // Mesuré : 50,0 km/h tenus 9,6 s, puis 90,0 km/h tenus 24,6 s. Les quatre
    // dixièmes manquants de part et d'autre de la rampe sont le prix de la
    // fenêtre centrée : elle voit la rampe venir une demi-fenêtre à l'avance.
    expect(measure.plateaus.length).toBe(2)
    expect(measure.plateaus[0]?.kmh).toBeCloseTo(50, 1)
    expect(measure.plateaus[0]?.durationS).toBeCloseTo(9.6, 1)
    expect(measure.plateaus[1]?.kmh).toBeCloseTo(90, 1)
    expect(measure.plateaus[1]?.durationS).toBeCloseTo(24.6, 1)
  })

  it('ne compte pas un feu rouge comme une vitesse tenue', () => {
    // Trente secondes à l'arrêt : accélération nulle, et durée bien au-delà du
    // minimum d'un palier. Sans le plancher de vitesse, l'arrêt serait la
    // vitesse la plus tenue de toute la trace de ville.
    const measure = measureTrace(buildTrace({ durationS: 30, cadenceMs: 200, kmhAt: () => 0 }))

    expect(measure.durationS).toBeGreaterThan(HELD_MIN_S)
    expect(measure.plateaus).toEqual([])
  })

  it('écarte un saut isolé du GPS de la vitesse pratiquée', () => {
    const trace = buildTrace({ durationS: 30, cadenceMs: 200, kmhAt: () => 90 })
    const spike = trace.samples[75]
    if (spike) spike.kmh = 240

    const measure = measureTrace(trace)

    // Le maximum brut retiendrait 240 km/h, et proposerait donc une vitesse
    // plausible calée sur une mesure aberrante.
    expect(measure.maxKmh).toBe(240)
    expect(measure.practicedMaxKmh).toBeCloseTo(90, 1)
  })
})

describe('measureTrace — départs arrêtés', () => {
  it('relève la vitesse une seconde après chaque départ', () => {
    // Deux feux rouges : arrêt, puis départ à 2 m/s². Une seconde après le
    // départ, la vitesse vaut 7,2 km/h.
    const kmhAt = (t: number): number => {
      const cycle = t % 40
      if (cycle < 10) return 0
      return Math.min(50, 2 * 3.6 * (cycle - 10))
    }
    const measure = measureTrace(buildTrace({ durationS: 80, cadenceMs: 100, kmhAt }))

    expect(measure.departureKmh.length).toBe(2)
    // Mesuré : 8,64 km/h aux deux départs, pour 7,2 qu'une lecture rapide
    // attendrait. L'écart est le délai de **détection** du départ : la voiture
    // est déclarée en mouvement à la première mesure au-dessus du seuil
    // d'arrêt, soit deux dixièmes de seconde après avoir bougé à cette cadence.
    // La seconde se compte donc depuis l'instant où l'on voit qu'elle roule, et
    // non depuis celui où elle a commencé — c'est le seul instant qu'une trace
    // GPS connaisse.
    for (const speed of measure.departureKmh) expect(speed).toBeCloseTo(8.64, 2)
  })

  it('ignore un départ qui n’a pas une seconde de trace derrière lui', () => {
    // L'enregistrement s'arrête un demi-tour de seconde après le démarrage.
    const measure = measureTrace(
      buildTrace({
        durationS: 10.5,
        cadenceMs: 100,
        kmhAt: (t) => (t < 10 ? 0 : 2 * 3.6 * (t - 10)),
      }),
    )

    expect(measure.departureKmh).toEqual([])
  })
})

describe('weightedPercentile', () => {
  it('pèse chaque valeur par sa durée', () => {
    // Cent secondes à 90 km/h et deux secondes à 30 : la médiane pondérée est
    // à 90, alors que la médiane simple serait à 60.
    const entries = [
      { value: 30, weight: 2 },
      { value: 90, weight: 100 },
    ]

    expect(weightedPercentile(entries, 0.5)).toBe(90)
    expect(weightedPercentile(entries, 0.01)).toBe(30)
  })

  it('écarte un poids nul et rend zéro sur une série vide', () => {
    expect(weightedPercentile([{ value: 50, weight: 0 }], 0.5)).toBe(0)
    expect(weightedPercentile([], 0.5)).toBe(0)
  })
})

describe('percentile', () => {
  it('interpole entre les deux rangs voisins', () => {
    expect(percentile([0, 10], 0.5)).toBe(5)
    expect(percentile([0, 1, 2, 3, 4], 0.5)).toBe(2)
    expect(percentile([4, 0, 2, 1, 3], 0.25)).toBe(1)
  })

  it('rend zéro sur une série vide', () => {
    expect(percentile([], 0.5)).toBe(0)
  })
})

describe('measureTrace — cas dégénérés', () => {
  it('avale une trace vide sans rien inventer', () => {
    const measure = measureTrace({ name: 'vide', startedAt: 0, samples: [] })

    expect(measure.count).toBe(0)
    expect(measure.peakAccelMs2).toBeNull()
    expect(measure.noiseKmh).toBeNull()
    expect(measure.plateaus).toEqual([])
  })

  it('remet les mesures dans l’ordre et écarte les valeurs non finies', () => {
    const trace: Trace = {
      name: 'désordre',
      startedAt: 0,
      samples: [
        { kmh: 20, at: 2000, accuracyM: null, derived: false },
        { kmh: Number.NaN, at: 1000, accuracyM: null, derived: false },
        { kmh: 10, at: 1000, accuracyM: null, derived: false },
        { kmh: 30, at: 3000, accuracyM: null, derived: false },
      ],
    }

    const measure = measureTrace(trace)

    expect(measure.count).toBe(3)
    expect(measure.points.map((p) => p.kmh)).toEqual([10, 20, 30])
    // 10 km/h par seconde, soit 2,78 m/s².
    expect(measure.peakAccelMs2).toBeCloseTo(10 / 3.6, 3)
  })
})
