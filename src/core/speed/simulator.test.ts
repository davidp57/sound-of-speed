import { describe, expect, it } from 'vitest'

import { SimulatorSource } from './simulator'
import type { SpeedSample } from './source'

/**
 * Tests du simulateur.
 *
 * Sa physique est volontairement grossière, mais elle doit rester crédible : le
 * réglage des passages de rapport et du lissage se fait au clavier, sur un poste
 * fixe, et un simulateur qui plafonnerait trop bas rendrait les derniers
 * rapports intestables.
 */

const FRAME_S = 1 / 60

/** Fait tourner le simulateur et rend le dernier échantillon émis. */
function run(source: SimulatorSource, seconds: number): SpeedSample | null {
  let last: SpeedSample | null = null
  source.onSample((sample) => {
    last = sample
  })
  for (let f = 0; f * FRAME_S <= seconds; f += 1) source.tick(FRAME_S)
  return last
}

describe('SimulatorSource', () => {
  it('s’annonce comme source active au démarrage', () => {
    const source = new SimulatorSource()
    const statuts: string[] = []
    source.onStatus((status) => statuts.push(status))

    source.start()
    source.stop()

    expect(source.kind).toBe('simulator')
    expect(statuts).toEqual(['active', 'idle'])
  })

  it('n’émet rien tant qu’il n’est pas démarré', () => {
    const source = new SimulatorSource()

    expect(run(source, 1)).toBeNull()
  })

  it('accélère pied au plancher, et plafonne', () => {
    const source = new SimulatorSource()
    source.start()
    source.setThrottle(1)

    const apresUneSeconde = run(source, 1)
    const apresLongtemps = run(source, 120)

    expect(apresUneSeconde?.kmh).toBeGreaterThan(10)
    // La poussée s'essouffle avec la vitesse : l'équilibre avec la traînée est
    // calibré vers 200 km/h, pour que les derniers rapports soient atteignables.
    expect(apresLongtemps?.kmh).toBeGreaterThan(180)
    expect(apresLongtemps?.kmh).toBeLessThanOrEqual(260)
  })

  it('ralentit tout seul pied levé', () => {
    const source = new SimulatorSource()
    source.start()
    source.setThrottle(1)
    const lance = run(source, 10)

    source.setThrottle(0)
    const apres = run(source, 3)

    expect(apres?.kmh).toBeLessThan(lance?.kmh ?? 0)
  })

  it('freine plus vite qu’il ne décélère seul', () => {
    const traine = new SimulatorSource()
    const freine = new SimulatorSource()
    traine.start()
    freine.start()
    traine.setThrottle(1)
    freine.setThrottle(1)
    run(traine, 10)
    run(freine, 10)

    traine.setThrottle(0)
    freine.setThrottle(0)
    freine.setBrake(1)

    expect(run(freine, 1)?.kmh).toBeLessThan(run(traine, 1)?.kmh ?? 0)
  })

  it('ne descend pas sous zéro', () => {
    const source = new SimulatorSource()
    source.start()
    source.setBrake(1)

    expect(run(source, 5)?.kmh).toBe(0)
  })

  it('tient une allure demandée, au lieu de la poser une fois', () => {
    const source = new SimulatorSource()
    source.start()
    source.setCruise(90)

    // C'est un régulateur : sans cela, la traînée faisait aussitôt retomber la
    // vitesse que le curseur venait de poser.
    const atteint = run(source, 5)
    const tenu = run(source, 20)

    expect(atteint?.kmh).toBeCloseTo(90, 0)
    expect(tenu?.kmh).toBeCloseTo(90, 0)
  })

  it('rejoint une allure plus basse sans osciller', () => {
    const source = new SimulatorSource()
    source.start()
    source.setCruise(130)
    run(source, 10)

    source.setCruise(60)
    const vitesses: number[] = []
    source.onSample((sample) => vitesses.push(sample.kmh))
    for (let f = 0; f * FRAME_S <= 15; f += 1) source.tick(FRAME_S)

    expect(vitesses.at(-1)).toBeCloseTo(60, 0)
    // Aucun dépassement sous la consigne : la descente est monotone.
    expect(Math.min(...vitesses)).toBeGreaterThan(59.5)
  })

  it('rend la main dès qu’on touche aux commandes', () => {
    const source = new SimulatorSource()
    source.start()
    source.setCruise(100)
    run(source, 5)

    source.setThrottle(1)
    expect(source.getCruise()).toBeNull()

    source.setCruise(100)
    source.setBrake(0.5)
    expect(source.getCruise()).toBeNull()
  })

  it('borne les commandes entre zéro et un', () => {
    const source = new SimulatorSource()

    source.setThrottle(5)
    source.setBrake(-2)

    expect(source.getThrottle()).toBe(1)
    expect(source.getBrake()).toBe(0)
  })

  it('borne l’allure demandée à la vitesse maximale', () => {
    const source = new SimulatorSource()

    source.setCruise(9000)

    expect(source.getCruise()).toBe(260)
  })

  it('relâche les commandes à l’arrêt', () => {
    const source = new SimulatorSource()
    source.start()
    source.setThrottle(1)
    source.setBrake(1)

    source.stop()

    expect(source.getThrottle()).toBe(0)
    expect(source.getBrake()).toBe(0)
  })

  it('permet de se désabonner de ses émissions', () => {
    const source = new SimulatorSource()
    source.start()
    source.setThrottle(1)

    let recu = 0
    const stop = source.onSample(() => {
      recu += 1
    })
    source.tick(FRAME_S)
    stop()
    source.tick(FRAME_S)

    expect(recu).toBe(1)
  })
})
