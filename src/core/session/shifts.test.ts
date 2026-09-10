import { describe, expect, it } from 'vitest'
import { findGearChanges, findShiftBursts, recordedShifts } from './shifts'
import type { StatePoint } from './model'

/** Des relevés à cadence choisie, dont on ne fixe que le rapport. */
function relevés(cadenceMs: number, rapports: number[]): StatePoint[] {
  return rapports.map((gear, i) => ({
    at: i * cadenceMs,
    kmh: 50,
    rpm: 2000,
    gear,
    load: 0.5,
    accelMs2: 0,
  }))
}

describe('les enchaînements de rapports', () => {
  it('ne voit rien dans une conduite à rapport stable', () => {
    expect(findShiftBursts(relevés(100, [3, 3, 3, 3, 3]))).toEqual([])
  })

  it('ne voit rien dans un passage isolé', () => {
    expect(findShiftBursts(relevés(100, [3, 3, 4, 4, 4]))).toEqual([])
  })

  it('voit deux passages qui se suivent, et le dit mesuré', () => {
    const trouvés = findShiftBursts(relevés(500, [3, 4, 5, 5]))

    expect(trouvés).toHaveLength(1)
    expect(trouvés[0]).toMatchObject({ at: 0, count: 2, spanMs: 1000, measured: true, from: 3, to: 5 })
  })

  it('ne marque pas une montée ordinaire étalée sur une minute', () => {
    // Passer de la première à la sixième en conduisant n'a rien d'un
    // enchaînement : c'est la durée, et elle seule, qui les sépare.
    expect(findShiftBursts(relevés(10_000, [1, 2, 3, 4, 5, 6]))).toEqual([])
  })

  it('retient un saut de deux rapports entre deux relevés, sans le dire mesuré', () => {
    // Ce que le journal permet d'affirmer : deux passages ont eu lieu dans cet
    // intervalle. Pas qu'ils se sont suivis.
    const trouvés = findShiftBursts(relevés(10_000, [2, 4, 4]))

    expect(trouvés).toHaveLength(1)
    expect(trouvés[0]).toMatchObject({ count: 2, spanMs: 10_000, measured: false, from: 2, to: 4 })
  })

  it('reconnaît un aller-retour de la boîte', () => {
    const trouvés = findShiftBursts(relevés(600, [2, 4, 2, 4, 4]))

    expect(trouvés).toHaveLength(1)
    expect(trouvés[0]).toMatchObject({ count: 6, measured: true, from: 2, to: 4 })
  })

  it('reconnaît le même aller-retour à la cadence d’un journal', () => {
    // Le cas relevé le 10 septembre entre 290 et 310 secondes : deuxième,
    // quatrième, deuxième, quatrième, à un relevé toutes les dix secondes.
    // Six rapports pour trois relevés : la boîte a bougé plusieurs fois entre
    // deux regards, et c'est cela qu'on veut retrouver.
    const trouvés = findShiftBursts(relevés(10_000, [2, 4, 2, 4, 4]))

    expect(trouvés).toHaveLength(1)
    expect(trouvés[0]).toMatchObject({ count: 6, measured: false, from: 2, to: 4 })
  })

  it('sépare deux enchaînements qu’un palier sépare', () => {
    const trouvés = findShiftBursts(relevés(500, [1, 2, 3, 3, 3, 3, 4, 5, 5]))

    expect(trouvés).toHaveLength(2)
    expect(trouvés[0]?.at).toBe(0)
    expect(trouvés[1]?.at).toBe(2500)
  })

  it('tient sur une session vide ou d’un seul relevé', () => {
    expect(findShiftBursts([])).toEqual([])
    expect(findShiftBursts(relevés(100, [3]))).toEqual([])
  })
})

describe('les passages de rapport', () => {
  it('donne le sens et le nombre de rapports franchis', () => {
    const passages = findGearChanges(relevés(1000, [3, 4, 4, 2]))

    expect(passages).toHaveLength(2)
    expect(passages[0]).toMatchObject({ at: 1000, up: true, steps: 1, from: 3, to: 4 })
    expect(passages[1]).toMatchObject({ at: 3000, up: false, steps: 2, from: 4, to: 2 })
  })

  it('ne voit rien sans changement', () => {
    expect(findGearChanges(relevés(1000, [4, 4, 4]))).toEqual([])
  })
})

describe('les passages inscrits font foi', () => {
  const event = (at: number, from: number, to: number) => ({
    at,
    kind: 'shift',
    data: { from, to },
  })

  it('lit les passages du journal plutôt que de les deviner', () => {
    const changes = recordedShifts([
      event(1000, 4, 5),
      { at: 1500, kind: 'reject', data: { motif: 'inaccurate' } },
      event(2000, 5, 4),
    ])

    expect(changes).toEqual([
      { at: 1000, up: true, steps: 1, from: 4, to: 5 },
      { at: 2000, up: false, steps: 1, from: 5, to: 4 },
    ])
  })

  it('écarte ce qui n’est pas un passage lisible', () => {
    expect(recordedShifts([event(10, 3, 3), { at: 20, kind: 'shift', data: {} }])).toEqual([])
  })

  it('mesure la durée d’un enchaînement au lieu de l’encadrer', () => {
    // Quatre allers-retours en quatre secondes : avec les seuls relevés à dix
    // secondes, ce moment se résumait à un changement, ou à rien du tout.
    const changes = recordedShifts([
      event(10_000, 5, 6),
      event(11_200, 6, 5),
      event(12_400, 5, 6),
      event(13_600, 6, 5),
    ])
    const [rafale, ...reste] = findShiftBursts([], undefined, undefined, changes)

    expect(reste).toEqual([])
    expect(rafale).toMatchObject({ at: 10_000, count: 4, spanMs: 3600, measured: true })
  })

  it('ne groupe pas deux passages éloignés', () => {
    const changes = recordedShifts([event(0, 1, 2), event(30_000, 2, 3)])
    expect(findShiftBursts([], undefined, undefined, changes)).toEqual([])
  })

  it('rend les relevés quand le journal n’a rien inscrit', () => {
    const états = [
      { at: 0, kmh: 40, rpm: 2000, gear: 2, load: 0.5, accelMs2: 0 },
      { at: 10_000, kmh: 60, rpm: 2000, gear: 4, load: 0.5, accelMs2: 0 },
    ]
    expect(findGearChanges(états, [])).toHaveLength(1)
  })
})
