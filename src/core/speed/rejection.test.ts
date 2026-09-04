import { describe, expect, it } from 'vitest'

import { RejectionWatch, type RejectionCause, type RejectionCounts } from './rejection'

/**
 * Ce que ces tests décrivent : la différence entre « la source ne reçoit rien »
 * et « la source jette tout ». Les deux figent la vitesse, une seule est un
 * problème de réglage — et c'est celle qu'on n'avait aucun moyen de voir.
 */

const START: RejectionCounts = {
  received: 100,
  emitted: 100,
  implausible: 0,
  tooClose: 0,
  inaccurate: 0,
}

/** Fait tourner la boucle pendant une durée, à soixante tours par seconde. */
function run(
  watch: RejectionWatch,
  durationS: number,
  at: (tour: number) => RejectionCounts,
): (RejectionCause | null)[] {
  const dt = 1 / 60
  const out: (RejectionCause | null)[] = []
  for (let tour = 0; tour < Math.round(durationS * 60); tour += 1) {
    out.push(watch.tick(dt, at(tour)))
  }
  return out
}

describe('RejectionWatch', () => {
  it('se tait tant que des vitesses sortent', () => {
    const watch = new RejectionWatch()

    const causes = run(watch, 10, (tour) => ({
      ...START,
      received: START.received + tour,
      emitted: START.emitted + tour,
    }))

    expect(causes.every((cause) => cause === null)).toBe(true)
  })

  it('nomme le plafond de vitesse quand tout est jeté comme aberrant', () => {
    // Le cas du 4 septembre 2026 : un étalonnage de ville avait porté la vitesse
    // plausible à 40 km/h, et l'autoroute passait entièrement à la trappe.
    const watch = new RejectionWatch()

    const causes = run(watch, 10, (tour) => ({
      ...START,
      received: START.received + tour,
      implausible: tour,
    }))

    expect(causes[0]).toBeNull()
    expect(causes.at(-1)).toBe('implausible')
    // Trois secondes de silence avant de parler : à la cadence de la voiture,
    // c'est une centaine de positions ; à un hertz, trois mesures. Le premier
    // tour ne compte pas, il pose la référence.
    const parle = causes.findIndex((cause) => cause !== null) / 60
    expect(parle).toBeGreaterThanOrEqual(3)
    expect(parle).toBeLessThan(3.1)
  })

  it('nomme la précision quand c est elle qui écarte', () => {
    const watch = new RejectionWatch()

    const causes = run(watch, 10, (tour) => ({
      ...START,
      received: START.received + tour,
      inaccurate: tour,
    }))

    expect(causes.at(-1)).toBe('inaccurate')
  })

  it('retient le rejet qui domine, et non le premier venu', () => {
    const watch = new RejectionWatch()

    const causes = run(watch, 10, (tour) => ({
      ...START,
      received: START.received + tour,
      tooClose: tour,
      inaccurate: Math.floor(tour / 10),
    }))

    expect(causes.at(-1)).toBe('tooClose')
  })

  it('se tait quand la source ne reçoit plus rien', () => {
    // Là, c'est le chien de garde qui parle : la source est muette, aucun filtre
    // n'y est pour rien, et le dire deux fois brouillerait les deux messages.
    const watch = new RejectionWatch()

    const causes = run(watch, 10, () => ({ ...START }))

    expect(causes.every((cause) => cause === null)).toBe(true)
  })

  it('dit qu il ne sait pas quand rien n explique le silence', () => {
    // Des positions arrivent, aucune vitesse ne sort, et aucun compteur de rejet
    // ne bouge : annoncer un rejet serait faux.
    const watch = new RejectionWatch()

    const causes = run(watch, 10, (tour) => ({ ...START, received: START.received + tour }))

    expect(causes.at(-1)).toBe('none')
  })

  it('repart dès qu une vitesse ressort', () => {
    const watch = new RejectionWatch()
    run(watch, 10, (tour) => ({ ...START, received: START.received + tour, implausible: tour }))

    const apres = watch.tick(1 / 60, {
      ...START,
      received: START.received + 601,
      emitted: START.emitted + 1,
      implausible: 600,
    })

    expect(apres).toBeNull()
  })
})
