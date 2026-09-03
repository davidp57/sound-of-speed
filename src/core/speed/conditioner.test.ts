import { describe, expect, it } from 'vitest'

import { SpeedConditioner } from './conditioner'
import { createDefaultProfile } from '../preset/defaults'
import type { SpeedPreset } from '../preset/schema'
import type { SpeedSample } from './source'

/**
 * Tests du conditionnement du signal de vitesse.
 *
 * On fabrique ici une trace synthétique et on la fait passer dans le
 * conditionnement image par image, comme le ferait la boucle. La **cadence des
 * mesures** est un paramètre : un hertz par défaut, mais le GPS d'une Tesla en
 * mouvement livre une position toutes les trente millisecondes, et le
 * conditionnement doit se comporter pareil dans les deux cas. Ce qu'on vérifie est le comportement mesuré : la sortie est continue,
 * et l'écart de suivi suit une loi connue.
 *
 * Les bornes de ces tests sont des valeurs **mesurées**, notées en regard. Elles
 * décrivent le procédé, elles ne fixent pas un objectif : l'écart croît
 * proportionnellement à l'accélération, et vouloir mieux demanderait un autre
 * procédé, pas un meilleur réglage.
 */

const FRAME_S = 1 / 60
const preset = (): SpeedPreset => createDefaultProfile().speed

/**
 * Une mesure telle qu'une source l'émet.
 *
 * La précision et l'origine — lue ou déduite — ne servent qu'à l'affichage de
 * télémétrie : le conditionnement ne les regarde pas, mais elles font partie du
 * contrat de `SpeedSample` et se déclarent donc ici une fois pour toutes.
 */
function mesure(kmh: number, at: number): SpeedSample {
  return { kmh, at, accuracyM: 5, derived: false }
}

interface Point {
  t: number
  real: number
  smoothed: number
}

/**
 * Fait tourner le conditionnement sur une trace, en relevant à chaque image la
 * vitesse conditionnée face à la vitesse réelle du véhicule.
 *
 * @param speedAt Vitesse réelle, en km/h, à un instant donné en secondes.
 * @param seconds Durée simulée.
 */
function run(
  speedAt: (t: number) => number,
  seconds: number,
  overrides: Partial<SpeedPreset> = {},
  frameS = FRAME_S,
  samplePeriodS = 1,
): Point[] {
  const conditioner = new SpeedConditioner({ ...preset(), ...overrides })
  const points: Point[] = []
  const start = 1_000_000
  let nextSampleAt = 0

  for (let frame = 0; frame * frameS <= seconds; frame += 1) {
    const t = frame * frameS
    // Une boucle, et non un `if` : à cadence rapide, plusieurs mesures peuvent
    // tomber dans la même image.
    while (t >= nextSampleAt) {
      conditioner.push(mesure(speedAt(nextSampleAt), start + nextSampleAt * 1000))
      nextSampleAt += samplePeriodS
    }
    points.push({ t, real: speedAt(t), smoothed: conditioner.tick(frameS).kmh })
  }
  return points
}

/** Plus grand écart entre deux images consécutives. Mesure la continuité. */
function largestStep(points: Point[]): number {
  let worst = 0
  for (let i = 1; i < points.length; i += 1) {
    const current = points[i]
    const previous = points[i - 1]
    if (!current || !previous) continue
    worst = Math.max(worst, Math.abs(current.smoothed - previous.smoothed))
  }
  return worst
}

/** Plus grand écart de suivi sur un intervalle, en secondes. */
function largestError(points: Point[], from: number, to = Number.POSITIVE_INFINITY): number {
  let worst = 0
  for (const point of points) {
    if (point.t < from || point.t > to) continue
    worst = Math.max(worst, Math.abs(point.smoothed - point.real))
  }
  return worst
}

describe('SpeedConditioner', () => {
  it('rend une sortie continue là où les mesures forment un escalier', () => {
    // À 12 km/h par seconde, le signal brut monte par marches de 12 km/h, une
    // par seconde. Mesuré : la plus grande variation d'une image à l'autre est
    // de 1,39 km/h, soit près de dix fois moins que la marche qu'elle remplace.
    const points = run((t) => t * 12, 12)

    expect(largestStep(points)).toBeLessThan(1.5)
    expect(largestStep(points)).toBeLessThan(12 / 8)
  })

  it('suit une accélération ordinaire à moins de 1 km/h près', () => {
    // 8 km/h par seconde, soit 2,2 m/s² : une accélération franche mais
    // courante. Mesuré : 0,93 km/h d'écart maximal.
    const points = run((t) => t * 8, 8)

    expect(largestError(points, 2)).toBeLessThan(1)
  })

  it("voit son écart croître avec l'accélération, proportionnellement", () => {
    // La loi mesurée est linéaire : environ 0,12 km/h d'écart par km/h/s
    // d'accélération. C'est ce qui borne la promesse précédente — au-delà de
    // 8,5 km/h/s, l'écart dépasse le km/h, et c'est inhérent au procédé.
    const doux = largestError(run((t) => t * 4, 8), 2)
    const vif = largestError(run((t) => t * 12, 8), 2)

    expect(doux).toBeLessThan(0.6)
    expect(vif).toBeGreaterThan(1)
    // Trois fois l'accélération, trois fois l'écart, à 10 % près.
    expect(vif / doux).toBeGreaterThan(2.7)
    expect(vif / doux).toBeLessThan(3.3)
  })

  it('suit une vitesse tenue sans dériver', () => {
    const points = run(() => 90, 10)

    // Mesuré : écart exactement nul une fois établi.
    expect(largestError(points, 3)).toBeLessThan(0.05)
    expect(largestStep(points.filter((p) => p.t >= 3))).toBeLessThan(0.01)
  })

  it("oublie une pente périmée en une seconde", () => {
    // Rampe à 12 km/h/s pendant six secondes, puis vitesse tenue à 72.
    //
    // L'extrapolation continue un instant sur la pente estimée : c'est ce qui
    // produit le dépassement, et c'est inhérent au procédé — la pente ne peut
    // pas se démentir avant la mesure suivante. Ce qui compte est le temps
    // qu'elle met à le faire.
    const points = run((t) => Math.min(72, t * 12), 20)

    // Mesuré : 9,7 km/h de dépassement à t = 7 s, une seconde après la rupture
    // de pente.
    expect(largestError(points, 6, 7.5)).toBeGreaterThan(5)
    expect(largestError(points, 6, 7.5)).toBeLessThan(12)

    // Et deux secondes après, il n'en reste rien. La pente était auparavant
    // calculée sur l'historique entier : il fallait alors une quinzaine de
    // secondes, pendant lesquelles le régime restait trop haut.
    expect(largestError(points, 8, 20)).toBeLessThan(0.05)
  })

  it("obéit au réglage de fenêtre d'accélération", () => {
    const ecartApres = (accelWindowMs: number) =>
      largestError(run((t) => Math.min(72, t * 12), 20, { accelWindowMs }), 8, 8.5)

    // Deux secondes après la rupture de pente : avec une fenêtre d'une seconde
    // la pente est déjà oubliée, avec quatre secondes elle traîne encore.
    // Mesuré : 0,001 km/h contre 7,27.
    expect(ecartApres(1000)).toBeLessThan(0.05)
    expect(ecartApres(4000)).toBeGreaterThan(5)

    // En deçà de l'intervalle entre deux mesures, la fenêtre ne peut rien
    // gagner : il n'existe pas d'entrée plus récente à laquelle se comparer.
    // C'est une limite du signal, pas du réglage.
    expect(ecartApres(300)).toBeCloseTo(ecartApres(1000), 3)
  })

  it("ne dégrade pas le suivi d'une accélération régulière", () => {
    // La correction de la fenêtre ne devait rien changer ici : sur une rampe
    // linéaire, la pente vaut la même chose quelle que soit la fenêtre.
    // Mesuré avant et après : 0,467 à 4 km/h/s, 0,934 à 8, 1,401 à 12.
    expect(largestError(run((t) => t * 4, 8), 2)).toBeCloseTo(0.467, 2)
    expect(largestError(run((t) => t * 8, 8), 2)).toBeCloseTo(0.934, 2)
    expect(largestError(run((t) => t * 12, 8), 2)).toBeCloseTo(1.401, 2)
  })

  it("prend une seconde à voir un freinage franc, et pas plus", () => {
    // Au début d'un freinage, la pente estimée vaut encore zéro : il faut la
    // fenêtre d'accélération entière pour qu'elle bascule. L'écart maximal vaut
    // donc à peu près la vitesse perdue en une seconde.
    // Mesuré : 19,7 km/h pour un freinage à 20 km/h/s (5,6 m/s²).
    const decel = 20
    const points = run((t) => (t < 5 ? 110 : Math.max(0, 110 - (t - 5) * decel)), 9)
    const error = largestError(points, 5, 9)

    expect(error).toBeGreaterThan(decel * 0.7)
    expect(error).toBeLessThan(decel * 1.3)
  })

  it('ne cherche pas de pente quand le véhicule est immobile', () => {
    const conditioner = new SpeedConditioner(preset())
    const start = 1_000_000

    // Le tremblement d'un GPS à l'arrêt. C'est là qu'il est le plus fort — à
    // ±3 km/h, la régression laisse encore passer 0,6 m/s² — et c'est aussi le
    // seul endroit où l'on sait à coup sûr que l'accélération est nulle : on ne
    // l'estime donc pas.
    const jitter = [0, 0.4, 0.2, 0.6, 0.3, 0.5]
    jitter.forEach((kmh, index) => {
      conditioner.push(mesure(kmh, start + index * 1000))
    })
    const state = conditioner.tick(FRAME_S)

    expect(state.slopeKmhS).toBe(0)
    expect(state.accelMs2).toBe(0)
  })

  it('voit repartir une voiture arrêtée sans attendre', () => {
    // Le seuil d'immobilité porte sur les mesures, non sur la vitesse lissée, et
    // il suffit qu'une seule mesure de la fenêtre le dépasse : sinon un départ
    // franc serait manqué le temps que la vitesse lissée monte. Mesuré à la
    // cadence rapide sur un départ à 2 m/s² : la pente est encore nulle à la
    // seconde du départ, vaut 0,29 m/s² un quart de seconde plus tard, et
    // atteint sa vraie valeur une seconde après.
    const conditioner = new SpeedConditioner(preset())
    const start = 1_000_000
    let slope = 0
    for (let i = 0; i * 0.03 <= 1.3; i += 1) {
      const at = i * 0.03
      conditioner.push(mesure(at < 1 ? 0 : 7.2 * (at - 1), start + at * 1000))
      slope = conditioner.tick(0.03).slopeKmhS
    }

    expect(slope).toBeGreaterThan(0)
  })

  it('lit la même accélération quelle que soit la cadence des mesures', () => {
    // Le défaut que ce test verrouille : l'historique était borné à seize
    // mesures, soit une demi-seconde à trente millisecondes de cadence. La
    // fenêtre réglée n'était jamais atteinte, et la zone morte — un écart fixe
    // en km/h, divisé par une durée deux fois plus courte — annulait toute
    // accélération sous 0,58 m/s². Une reprise douce était vue comme une vitesse
    // tenue.
    //
    // Mesuré sur l'estimateur retenu, sans bruit : 0,350 m/s² lu à toutes les
    // cadences de 30 ms à 1 s, au millième près.
    for (const periodS of [1, 0.25, 0.1, 0.03]) {
      const conditioner = new SpeedConditioner(preset())
      const start = 1_000_000
      // 0,35 m/s², soit 1,26 km/h par seconde : la reprise douce qui
      // disparaissait.
      for (let i = 0; i * periodS <= 20; i += 1) {
        const at = i * periodS
        conditioner.push(mesure(30 + 1.26 * at, start + at * 1000))
      }
      const state = conditioner.tick(FRAME_S)

      expect(state.slopeKmhS / 3.6).toBeGreaterThan(0.34)
      expect(state.slopeKmhS / 3.6).toBeLessThan(0.36)
    }
  })

  it('estime la pente d autant plus sûrement que le GPS parle souvent', () => {
    // À bruit de mesure égal, la régression moyenne d'autant mieux qu'elle a de
    // points. Mesuré avec ±1 km/h de bruit sur une rampe à 2 m/s² : écart-type
    // de 0,257 m/s² à un hertz, 0,215 à 250 ms, 0,115 à 30 ms.
    const ecarts = [1, 0.25, 0.03].map((periodS) => {
      const conditioner = new SpeedConditioner(preset())
      const start = 1_000_000
      let seed = 4242
      const bruit = (): number => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff
        return (seed / 0x7fffffff) * 2 - 1
      }
      const lues: number[] = []
      for (let i = 0; i * periodS <= 20; i += 1) {
        const at = i * periodS
        conditioner.push(mesure(30 + 7.2 * at + bruit(), start + at * 1000))
        const state = conditioner.tick(periodS)
        if (at > 10) lues.push(state.slopeKmhS / 3.6)
      }
      const moyenne = lues.reduce((a, b) => a + b, 0) / lues.length
      return Math.sqrt(lues.reduce((a, b) => a + (b - moyenne) ** 2, 0) / lues.length)
    })

    const [lent, moyen, rapide] = ecarts as [number, number, number]
    expect(rapide).toBeLessThan(moyen)
    expect(moyen).toBeLessThan(lent)
    // Mesuré : 0,115 m/s² à trente millisecondes.
    expect(rapide).toBeLessThan(0.15)
  })

  it('oublie une pente au rythme de la fenêtre réglée, à toute cadence', () => {
    // La fenêtre décide du temps qu'une pente met à s'oublier. Elle ne le
    // décidait plus dès que le GPS livrait vite : seize mesures suffisaient à la
    // remplir, et le réglage ne commandait rien. Mesuré deux secondes après la
    // fin d'une accélération, sur une fenêtre de quatre secondes : 3,60 km/h/s
    // de pente restante à un hertz, 3,61 à trente millisecondes.
    const restante = (periodS: number): number => {
      const conditioner = new SpeedConditioner({ ...preset(), accelWindowMs: 4000 })
      const start = 1_000_000
      let slope = 0
      for (let i = 0; i * periodS <= 10; i += 1) {
        const at = i * periodS
        // Rampe pendant huit secondes, puis vitesse tenue.
        conditioner.push(mesure(30 + 7.2 * Math.min(at, 8), start + at * 1000))
        slope = conditioner.tick(periodS).slopeKmhS
      }
      return slope
    }

    const lent = restante(1)
    const rapide = restante(0.03)

    expect(lent).toBeGreaterThan(3.2)
    expect(lent).toBeLessThan(4)
    expect(Math.abs(rapide - lent)).toBeLessThan(0.5)
  })

  it('écarte une mesure aberrante au lieu de la suivre', () => {
    const conditioner = new SpeedConditioner(preset())
    const max = preset().maxPlausibleKmh

    conditioner.push(mesure(90, 1_000_000))
    for (let frame = 0; frame < 120; frame += 1) conditioner.tick(FRAME_S)
    const avant = conditioner.tick(FRAME_S).kmh

    // Une valeur absurde, puis une salve : rien n'en passe.
    conditioner.push(mesure(9000, 1_001_000))
    conditioner.push(mesure(max * 3, 1_002_000))
    conditioner.push(mesure(max + 1, 1_003_000))
    for (let frame = 0; frame < 120; frame += 1) conditioner.tick(FRAME_S)
    const state = conditioner.tick(FRAME_S)

    // La mesure n'est pas ramenée au plafond, elle est ignorée : la vitesse
    // conditionnée reste sur sa trajectoire, comme si rien n'était arrivé.
    // Auparavant elle montait vers 260 km/h, donc le moteur au rupteur.
    expect(state.rawKmh).toBe(90)
    expect(state.kmh).toBeCloseTo(avant, 1)
  })

  it('accepte une mesure exactement au plafond du plausible', () => {
    const conditioner = new SpeedConditioner(preset())
    const max = preset().maxPlausibleKmh

    conditioner.push(mesure(max, 1_000_000))
    const state = conditioner.tick(FRAME_S)

    // C'est la borne du plausible, pas celle de l'aberrant.
    expect(state.rawKmh).toBe(max)
  })

  it('écarte une vitesse négative sans écarter la mesure', () => {
    const conditioner = new SpeedConditioner(preset())

    conditioner.push(mesure(-5, 1_000_000))
    const state = conditioner.tick(FRAME_S)

    // Une vitesse négative n'a pas de sens, mais elle ne dit rien d'aberrant
    // sur la mesure : on la ramène à l'arrêt.
    expect(state.rawKmh).toBe(0)
  })

  it('ne propage pas une mesure non finie', () => {
    const conditioner = new SpeedConditioner(preset())

    conditioner.push(mesure(50, 1_000_000))
    for (let frame = 0; frame < 30; frame += 1) conditioner.tick(FRAME_S)
    conditioner.push(mesure(Number.NaN, 1_001_000))
    const state = conditioner.tick(FRAME_S)

    expect(Number.isFinite(state.kmh)).toBe(true)
    expect(state.kmh).toBeGreaterThan(0)
  })

  it('suit plus vite à raideur élevée qu’à raideur basse', () => {
    // On ne vérifie pas une valeur mais la direction du réglage : c'est ce que
    // l'utilisateur constate en bougeant le curseur.
    const raide = run((t) => t * 10, 4, { springOmega: 25 })
    const mou = run((t) => t * 10, 4, { springOmega: 4 })

    expect(largestError(raide, 2)).toBeLessThan(largestError(mou, 2))
  })

  it('rapporte les intervalles entre mesures', () => {
    const conditioner = new SpeedConditioner(preset())
    const start = 1_000_000

    conditioner.push(mesure(10, start))
    conditioner.push(mesure(20, start + 1000))
    conditioner.push(mesure(30, start + 2200))
    const state = conditioner.tick(FRAME_S)

    expect(state.recentGapsMs).toEqual([1000, 1200])
  })

  it('repart de zéro après une réinitialisation', () => {
    const conditioner = new SpeedConditioner(preset())

    conditioner.push(mesure(100, 1_000_000))
    for (let frame = 0; frame < 120; frame += 1) conditioner.tick(FRAME_S)
    expect(conditioner.tick(FRAME_S).kmh).toBeGreaterThan(50)

    conditioner.reset()
    const state = conditioner.tick(FRAME_S)

    expect(state.kmh).toBe(0)
    expect(state.rawKmh).toBe(0)
    expect(state.atStandstill).toBe(true)
  })

  it('donne le même résultat à 30 et à 120 images par seconde', () => {
    // Le pas d'intégration est fixe et découplé de l'affichage : c'est une
    // promesse du module, et elle se vérifie.
    const trace = (t: number) => Math.min(100, t * 9)
    const last = (frameS: number) => {
      const points = run(trace, 6, {}, frameS)
      return points[points.length - 1]?.smoothed ?? 0
    }

    expect(Math.abs(last(1 / 30) - last(1 / 120))).toBeLessThan(0.5)
  })
})
