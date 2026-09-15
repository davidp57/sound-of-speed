import { describe, expect, it } from 'vitest'
import { Backoff } from './backoff'

const LIMITS = { retryMs: 30_000, maxRetryMs: 15 * 60_000 }

describe('Backoff', () => {
  it('laisse passer la première tentative sans attendre', () => {
    expect(new Backoff(LIMITS).ready(0)).toBe(true)
  })

  it('attend la durée de base après un premier échec, puis la double', () => {
    const b = new Backoff(LIMITS)

    b.failed(0, true)
    expect(b.ready(29_999)).toBe(false)
    expect(b.ready(30_000)).toBe(true)

    b.failed(30_000, true)
    expect(b.ready(89_999)).toBe(false)
    expect(b.ready(90_000)).toBe(true)
  })

  it('plafonne l’attente', () => {
    const b = new Backoff(LIMITS)
    for (let i = 0; i < 20; i += 1) b.failed(0, true)
    expect(b.readyAt).toBe(LIMITS.maxRetryMs)
  })

  it('attend le maximum quand la tentative ne vaut pas d’être refaite', () => {
    const b = new Backoff(LIMITS)
    b.failed(0, false)
    expect(b.readyAt).toBe(LIMITS.maxRetryMs)
  })

  it('retombe à rien dès qu’un dépôt aboutit', () => {
    const b = new Backoff(LIMITS)
    b.failed(0, true)
    b.failed(30_000, true)
    b.succeeded()
    expect(b.failureCount).toBe(0)
    expect(b.ready(0)).toBe(true)
  })

  it('tient la cadence du 11 septembre 2026 : sept tentatives, pas sept cents', () => {
    // Quarante-quatre minutes d'arrêt hors réseau, la boucle interrogeant le
    // recul à chaque tour et chaque tentative coûtant les 3,6 s d'une requête
    // qui n'aboutit pas. Sans recul, la même simulation consommait 734 rangs.
    const b = new Backoff(LIMITS)
    const FIN = 44 * 60_000
    const ECHEC_MS = 3600
    let tentatives = 0
    let now = 0
    let busyUntil = 0

    while (now < FIN) {
      if (now >= busyUntil && b.ready(now)) {
        tentatives += 1
        busyUntil = now + ECHEC_MS
        b.failed(busyUntil, true)
      }
      now += 16
    }

    expect(tentatives).toBe(7)
  })
})
