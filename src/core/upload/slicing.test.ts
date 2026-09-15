import { describe, expect, it } from 'vitest'
import { SliceBuffer } from './slicing'

interface Ligne {
  at: number
  n: number
}

function tampon(over: Partial<ConstructorParameters<typeof SliceBuffer<Ligne>>[0]> = {}) {
  return new SliceBuffer<Ligne>({
    sessionId: 'abcd',
    startedAt: Date.UTC(2026, 8, 10, 17, 0, 0),
    serialize: (l) => JSON.stringify(l),
    parse: (ligne) => JSON.parse(ligne) as Ligne,
    ...over,
  })
}

describe('le découpage en tranches', () => {
  it('découpe sur la taille sans attendre la durée', () => {
    const b = tampon({ sliceAtBytes: 200 })
    for (let i = 0; i < 5; i += 1) b.add({ at: i, n: i })
    expect(b.shouldSlice(0)).toBe(false)
    for (let i = 5; i < 30; i += 1) b.add({ at: i, n: i })
    expect(b.shouldSlice(0)).toBe(true)
  })

  it('oublie le poids d’une tranche partie', () => {
    // Le poids est tenu à jour plutôt que recalculé : s'il ne redescendait pas
    // au découpage, chaque tranche suivante partirait aussitôt.
    const b = tampon({ sliceAtBytes: 200 })
    for (let i = 0; i < 30; i += 1) b.add({ at: i, n: i })
    b.takeSlice(1000)
    b.add({ at: 99, n: 99 })
    expect(b.shouldSlice(1000)).toBe(false)
  })

  it('recompte le poids d’une tranche rendue', () => {
    const b = tampon({ sliceAtBytes: 200 })
    for (let i = 0; i < 30; i += 1) b.add({ at: i, n: i })
    const slice = b.takeSlice(1000)!
    b.restore(slice)
    expect(b.shouldSlice(1000)).toBe(true)
  })

  it('redescend le poids quand le plafond écarte les plus anciens', () => {
    const b = tampon({ sliceAtBytes: 200, maxPending: 3 })
    for (let i = 0; i < 30; i += 1) b.add({ at: i, n: i })
    expect(b.pendingCount).toBe(3)
    expect(b.shouldSlice(0)).toBe(false)
    expect(b.droppedCount).toBe(27)
  })
})

describe('une tranche rendue redemande à partir aussitôt', () => {
  it('repasse le seuil de taille dès le restore', () => {
    const b = tampon({ sliceAtBytes: 200 })
    for (let i = 0; i < 30; i += 1) b.add({ at: i, n: i })
    expect(b.shouldSlice(0)).toBe(true)

    const slice = b.takeSlice(0)!
    expect(b.shouldSlice(0)).toBe(false)

    // Le dépôt échoue et la tranche revient. Le critère de durée est neutralisé
    // — `takeSlice` vient de le remettre à zéro — mais celui de taille, lui, est
    // rétabli par le retour du contenu.
    b.restore(slice)
    expect(b.shouldSlice(0)).toBe(true)

    // C'est ce qui a consommé 726 rangs en 137 secondes le 11 septembre 2026 : le
    // recul de `core/upload/backoff.ts` est ce qui tient la cadence, et rien
    // dans cette pièce-ci ne la tient.
    expect(b.takeSlice(0)!.name).not.toBe(slice.name)
  })
})
