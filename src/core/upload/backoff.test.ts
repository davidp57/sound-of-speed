import { describe, expect, it } from 'vitest'
import { Backoff, SLICE_BACKOFF } from './backoff'

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

  it('tient la cadence du 11 septembre 2026 : cinq tentatives, pas sept cents', () => {
    // La coupure mesurée sur les tranches déposées ce jour-là : 137,1 s, pendant
    // lesquelles le journal a consommé 726 rangs — un toutes les 189 ms.
    const COUPURE_MS = 137_100
    const PAR_TENTATIVE_MS = 189
    const b = new Backoff(SLICE_BACKOFF)

    let tentatives = 0
    let now = 0
    while (now < COUPURE_MS) {
      if (b.ready(now)) {
        tentatives += 1
        now += PAR_TENTATIVE_MS
        b.failed(now, true)
      }
      now += 16
    }

    expect(tentatives).toBe(5)
    // Et la tranche repart peu après le retour du réseau, non des minutes plus
    // tard : c'est ce que le recul court achète sur celui de la file.
    expect(b.readyAt - COUPURE_MS).toBeLessThan(20_000)
  })
})
