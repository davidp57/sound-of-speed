import { describe, expect, it } from 'vitest'

import { FixWatchdog, RESTART_COOLDOWN_MS, STALE_FIX_MS } from './watchdog'

/**
 * Tests du chien de garde du signal de vitesse.
 *
 * C'est la seule pièce de ce lot qui se vérifie sans navigateur, et c'est
 * voulu : elle ne connaît que des nombres, ne lit pas l'heure et ne pose pas de
 * minuteur. Tout le reste du lot — élément média, session audio, contexte
 * suspendu — ne se juge qu'en voiture.
 */

const FRAME_S = 1 / 60

/** Fait tourner la boucle pendant une durée, avec un silence de source donné. */
function run(
  watchdog: FixWatchdog,
  seconds: number,
  sinceLastSampleMs: number,
  watching = true,
): number {
  let relances = 0
  for (let frame = 0; frame * FRAME_S < seconds; frame += 1) {
    if (watchdog.tick(FRAME_S, sinceLastSampleMs, watching)) relances += 1
  }
  return relances
}

describe('FixWatchdog', () => {
  it('relance quand la source se tait trop longtemps', () => {
    const watchdog = new FixWatchdog()

    expect(watchdog.tick(FRAME_S, STALE_FIX_MS, true)).toBe(true)
    expect(watchdog.restarts).toBe(1)
  })

  it('ne relance pas quand la source parle encore', () => {
    const watchdog = new FixWatchdog()

    expect(run(watchdog, 60, STALE_FIX_MS - 1)).toBe(0)
    expect(watchdog.restarts).toBe(0)
  })

  it('espace les relances du délai déclaré', () => {
    const watchdog = new FixWatchdog()

    // Dix secondes de silence complet : deux relances au plus, à cinq secondes
    // d'écart. Sans ce garde-fou il y en aurait six cents.
    const relances = run(watchdog, 10, STALE_FIX_MS * 2)

    expect(relances).toBe(2)
  })

  it('relance à nouveau une fois le délai écoulé', () => {
    const watchdog = new FixWatchdog()

    expect(watchdog.tick(FRAME_S, STALE_FIX_MS, true)).toBe(true)
    // Juste avant l'échéance, rien.
    expect(run(watchdog, RESTART_COOLDOWN_MS / 1000 - 0.2, STALE_FIX_MS)).toBe(0)
    // Juste après, une seule.
    expect(run(watchdog, 0.5, STALE_FIX_MS)).toBe(1)
    expect(watchdog.restarts).toBe(2)
  })

  it('ne relance rien quand il n’y a rien à surveiller', () => {
    const watchdog = new FixWatchdog()

    // Simulateur, rejeu, ou suivi arrêté : le silence de la source ne veut rien
    // dire, et une relance n'aurait aucun sens.
    expect(run(watchdog, 60, STALE_FIX_MS * 10, false)).toBe(0)
    expect(watchdog.restarts).toBe(0)
  })

  it('ne fait pas hériter la reprise du suivi d’une attente déjà écoulée', () => {
    const watchdog = new FixWatchdog()

    watchdog.tick(FRAME_S, STALE_FIX_MS, true)
    // Le suivi s'arrête longtemps, puis reprend en étant déjà muet : la
    // première relance ne doit pas être retenue par un délai couru pendant
    // l'arrêt, ni au contraire s'appuyer sur lui pour partir aussitôt.
    run(watchdog, 30, 0, false)
    const relances = run(watchdog, 0.5, STALE_FIX_MS)

    expect(relances).toBe(1)
  })

  it('accepte un premier tour de boucle sans temps écoulé', () => {
    const watchdog = new FixWatchdog()

    expect(watchdog.tick(0, STALE_FIX_MS, true)).toBe(true)
  })

  it('ignore un temps écoulé absurde', () => {
    const watchdog = new FixWatchdog()

    watchdog.tick(FRAME_S, STALE_FIX_MS, true)
    // Une valeur non finie ne doit pas faire croire que le délai est écoulé.
    expect(watchdog.tick(Number.NaN, STALE_FIX_MS, true)).toBe(false)
    expect(watchdog.tick(Number.POSITIVE_INFINITY, STALE_FIX_MS, true)).toBe(false)
  })

  it('se règle sur d’autres seuils', () => {
    const watchdog = new FixWatchdog({ staleAfterMs: 3000, cooldownMs: 1000 })

    expect(watchdog.tick(FRAME_S, 2999, true)).toBe(false)
    expect(watchdog.tick(FRAME_S, 3000, true)).toBe(true)
    expect(run(watchdog, 0.9, 3000)).toBe(0)
    expect(run(watchdog, 0.3, 3000)).toBe(1)
  })

  it('repart de zéro à la réinitialisation', () => {
    const watchdog = new FixWatchdog()

    watchdog.tick(FRAME_S, STALE_FIX_MS, true)
    expect(watchdog.restarts).toBe(1)

    watchdog.reset()

    expect(watchdog.restarts).toBe(0)
    // Et la première relance suivante est immédiate, comme au démarrage.
    expect(watchdog.tick(FRAME_S, STALE_FIX_MS, true)).toBe(true)
  })
})
