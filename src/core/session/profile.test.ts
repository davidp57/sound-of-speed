import { describe, expect, it } from 'vitest'
import { accelProfile } from './profile'
import type { StatePoint } from './model'

function relevé(at: number, accelMs2: number): StatePoint {
  return { at, kmh: 50, rpm: 2000, gear: 4, load: 0.5, accelMs2 }
}

describe('le relief d’un trajet', () => {
  it('range chaque relevé dans sa colonne', () => {
    const { columns } = accelProfile([relevé(0, 1), relevé(9000, -2)], 10_000, 10)

    expect(columns[0]).toEqual({ up: 1, down: 0 })
    expect(columns[9]).toEqual({ up: 0, down: 2 })
  })

  it('étend un relevé jusqu’au suivant, à la cadence de l’enregistrement', () => {
    // Un relevé toutes les dix secondes sur une barre de mille pixels donnerait
    // un pointillé illisible si chaque point n'occupait qu'une colonne.
    const { columns } = accelProfile(
      [relevé(0, 2), relevé(5000, -1), relevé(10_000, 0)],
      10_000,
      10,
    )

    expect(columns[0]).toEqual({ up: 2, down: 0 })
    expect(columns[4]).toEqual({ up: 2, down: 0 })
    expect(columns[5]).toEqual({ up: 0, down: 1 })
    expect(columns[8]).toEqual({ up: 0, down: 1 })
    // La dernière colonne est celle du dernier relevé, qui n'a pas de suivant.
    expect(columns[9]).toEqual({ up: 0, down: 0 })
  })

  it('garde l’extrême et non la moyenne', () => {
    // Une moyenne effacerait le freinage bref, qui est justement ce qu'on
    // cherche à voir.
    const { columns } = accelProfile(
      [relevé(0, 0.2), relevé(100, -3), relevé(200, 0.2)],
      1000,
      1,
    )

    expect(columns[0]).toEqual({ up: 0.2, down: 3 })
  })

  it('ne comble pas un trou d’enregistrement', () => {
    // Au-delà de trois fois la cadence habituelle, ce n'est plus un intervalle
    // mais une coupure : la combler dessinerait une conduite qui n'a pas eu
    // lieu. Ici, un relevé par seconde, puis quarante secondes de silence.
    const relevés = [0, 1000, 2000, 3000, 43_000].map((at) => relevé(at, 1))
    const { columns } = accelProfile(relevés, 44_000, 44)

    expect(columns[0]).toEqual({ up: 1, down: 0 })
    expect(columns[2]).toEqual({ up: 1, down: 0 })
    expect(columns[20]).toEqual({ up: 0, down: 0 })
    expect(columns[43]).toEqual({ up: 1, down: 0 })
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
    expect(columns[9]).toEqual({ up: 2, down: 0 })
  })
})
