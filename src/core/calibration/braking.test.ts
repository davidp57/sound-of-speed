import { describe, expect, it } from 'vitest'

import { splitBraking } from './braking'
import type { TracePoint } from './measure'

/**
 * Tests de la séparation entre pied levé et freinage.
 *
 * Ces tests fabriquent des distributions dont la réponse est connue d'avance —
 * un tas, deux tas nets, deux tas qui se touchent — parce que c'est la seule
 * façon de vérifier qu'on ne trouve pas une frontière là où il n'y en a pas.
 * Un procédé de seuillage en rend toujours une : c'est le refus qui compte.
 */

/**
 * Fabrique une suite de points portant les décélérations demandées.
 *
 * Chaque ralentissement est une plage de points sous le seuil, séparée de la
 * suivante par un point à l'accélération nulle qui la ferme.
 */
function pointsFor(decels: readonly number[]): TracePoint[] {
  const points: TracePoint[] = []
  let t = 0
  for (const decel of decels) {
    for (let i = 0; i < 12; i += 1) {
      points.push({ t, kmh: 80 - i, accelMs2: decel })
      t += 0.1
    }
    points.push({ t, kmh: 68, accelMs2: 0 })
    t += 1
  }
  return points
}

/** Une population resserrée autour d'une valeur, sans tirage au sort. */
function around(centre: number, count: number, spread = 0.08): number[] {
  return Array.from({ length: count }, (_, i) => centre + ((i % 5) - 2) * spread)
}

describe('splitBraking', () => {
  it('trouve la frontière entre deux tas nets', () => {
    // Pied levé autour de -0,7, freinage autour de -3,0.
    const split = splitBraking(pointsFor([...around(-0.7, 40), ...around(-3, 25)]))

    expect(split.why).toBe('ok')
    expect(split.boundaryMs2).not.toBeNull()
    expect(split.boundaryMs2!).toBeLessThan(-0.9)
    expect(split.boundaryMs2!).toBeGreaterThan(-2.8)
    expect(split.coastMs2!).toBeCloseTo(-0.7, 1)
    expect(split.brakeMs2!).toBeCloseTo(-3, 1)
  })

  /**
   * Le cas qui compte. Une distribution à une seule bosse n'a pas de frontière,
   * mais un procédé de seuillage en rend une quand même : sans cette
   * vérification, on poserait un seuil de rétrogradage au milieu d'un tas
   * homogène, et il ne voudrait rien dire.
   */
  it('refuse une frontière sur un seul tas', () => {
    const split = splitBraking(pointsFor(around(-1.2, 60, 0.1)))

    expect(split.why).toBe('pas-de-separation')
    expect(split.boundaryMs2).toBeNull()
  })

  /**
   * Deux tas qui se touchent ne se distinguent pas davantage. Le protocole pose
   * déjà cette règle : il refuse une frontière quand les deux étapes rendent la
   * même décélération à moins d'un demi mètre par seconde carrée près.
   */
  it('refuse une frontière quand les deux tas se touchent', () => {
    const split = splitBraking(pointsFor([...around(-1.1, 30), ...around(-1.4, 30)]))

    expect(split.why).toBe('pas-de-separation')
    expect(split.boundaryMs2).toBeNull()
  })

  it('refuse de conclure sur trop peu de ralentissements', () => {
    const split = splitBraking(pointsFor([...around(-0.7, 5), ...around(-3, 4)]))

    expect(split.why).toBe('trop-peu')
    expect(split.boundaryMs2).toBeNull()
  })

  it('relève les ralentissements même quand il ne conclut pas', () => {
    const split = splitBraking(pointsFor(around(-1.2, 40, 0.1)))

    expect(split.slowdowns.length).toBe(40)
    expect(split.slowdowns[0]!.peakDecelMs2).toBeLessThan(0)
    expect(split.slowdowns[0]!.durationS).toBeGreaterThan(0)
  })

  it('ne relève rien sur un trajet qui ne ralentit pas', () => {
    const points: TracePoint[] = Array.from({ length: 200 }, (_, i) => ({
      t: i * 0.1,
      kmh: 90,
      accelMs2: 0,
    }))

    const split = splitBraking(points)

    expect(split.slowdowns).toEqual([])
    expect(split.why).toBe('trop-peu')
  })

  /**
   * La crête et non la moyenne : un ralentissement commence et finit en
   * douceur, et sa moyenne serait diluée par ses bords. C'est sa force
   * maximale qui dit de quelle sorte il est.
   */
  it('situe un ralentissement par sa crête', () => {
    const points: TracePoint[] = [
      { t: 0, kmh: 90, accelMs2: -0.4 },
      { t: 0.1, kmh: 89, accelMs2: -3.2 },
      { t: 0.2, kmh: 87, accelMs2: -0.5 },
      { t: 0.3, kmh: 86, accelMs2: 0 },
    ]

    const split = splitBraking(points)

    expect(split.slowdowns[0]!.peakDecelMs2).toBe(-3.2)
  })
})
