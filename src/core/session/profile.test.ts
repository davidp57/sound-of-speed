import { describe, expect, it } from 'vitest'
import { accelProfile, profileRuns } from './profile'
import type { StatePoint } from './model'

function relevé(at: number, accelMs2: number): StatePoint {
  return { at, kmh: 50, rpm: 2000, gear: 4, load: 0.5, accelMs2 }
}

describe('le relief d’un trajet', () => {
  it('range chaque relevé dans sa colonne', () => {
    const { columns } = accelProfile([relevé(0, 1), relevé(9000, -2)], 10_000, 10)

    expect(columns[0]).toEqual({ value: 1, filled: true })
    expect(columns[9]).toEqual({ value: -2, filled: true })
  })

  it('étend un relevé jusqu’au suivant, à la cadence de l’enregistrement', () => {
    // Un relevé toutes les dix secondes sur une barre de mille pixels donnerait
    // un pointillé illisible si chaque point n'occupait qu'une colonne.
    const { columns } = accelProfile(
      [relevé(0, 2), relevé(5000, -1), relevé(10_000, 0)],
      10_000,
      10,
    )

    expect(columns[0]?.value).toBe(2)
    expect(columns[4]?.value).toBe(2)
    expect(columns[5]?.value).toBe(-1)
    expect(columns[8]?.value).toBe(-1)
    // La dernière colonne est celle du dernier relevé, qui n'a pas de suivant.
    expect(columns[9]).toEqual({ value: 0, filled: true })
  })

  it('garde l’extrême et non la moyenne', () => {
    // Une moyenne effacerait le freinage bref, qui est justement ce qu'on
    // cherche à voir.
    const { columns } = accelProfile(
      [relevé(0, 0.2), relevé(100, -3), relevé(200, 0.2)],
      1000,
      1,
    )

    expect(columns[0]?.value).toBe(-3)
  })

  it('ne comble pas un trou d’enregistrement', () => {
    // Au-delà de trois fois la cadence habituelle, ce n'est plus un intervalle
    // mais une coupure. Ici, un relevé par seconde, puis quarante secondes de
    // silence.
    const relevés = [0, 1000, 2000, 3000, 43_000].map((at) => relevé(at, 1))
    const { columns } = accelProfile(relevés, 44_000, 44)

    expect(columns[0]?.filled).toBe(true)
    expect(columns[2]?.filled).toBe(true)
    expect(columns[20]?.filled).toBe(false)
    expect(columns[43]?.filled).toBe(true)
  })

  it('distingue un zéro mesuré d’une colonne sans relevé', () => {
    // Rouler à vitesse tenue donne une accélération nulle, et ce n'est pas la
    // même chose que ne rien avoir enregistré.
    const { columns } = accelProfile([relevé(0, 0)], 1000, 2)

    expect(columns[0]).toEqual({ value: 0, filled: true })
    expect(columns[1]).toEqual({ value: 0, filled: false })
  })

  it('donne l’échelle, dans un sens comme dans l’autre', () => {
    expect(accelProfile([relevé(0, 1.2), relevé(500, -3.4)], 1000, 4).peak).toBeCloseTo(3.4)
  })

  it('tient sur une session vide', () => {
    const profil = accelProfile([], 0, 5)
    expect(profil.peak).toBe(0)
    expect(profil.columns).toHaveLength(5)
  })

  it('ne déborde pas sur le dernier relevé', () => {
    const { columns } = accelProfile([relevé(10_000, 2)], 10_000, 10)
    expect(columns[9]).toEqual({ value: 2, filled: true })
  })
})

describe('les tronçons de la courbe', () => {
  it('rend un seul tronçon quand rien ne manque', () => {
    const runs = profileRuns([
      { value: 1, filled: true },
      { value: -1, filled: true },
    ])

    expect(runs).toHaveLength(1)
    expect(runs[0]).toEqual([
      { x: 0, value: 1 },
      { x: 1, value: -1 },
    ])
  })

  it('coupe le trait sur un trou plutôt que de le traverser', () => {
    // Relier les deux bords tracerait une pente qui n'a pas eu lieu.
    const runs = profileRuns([
      { value: 1, filled: true },
      { value: 0, filled: false },
      { value: 2, filled: true },
      { value: 3, filled: true },
    ])

    expect(runs).toHaveLength(2)
    expect(runs[0]).toEqual([{ x: 0, value: 1 }])
    expect(runs[1]).toEqual([
      { x: 2, value: 2 },
      { x: 3, value: 3 },
    ])
  })

  it('ne rend rien quand tout manque', () => {
    expect(profileRuns([{ value: 0, filled: false }])).toEqual([])
  })
})
