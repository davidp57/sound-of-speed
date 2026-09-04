import { describe, expect, it } from 'vitest'

import { GpsBench, DEFAULT_BENCH } from './gps-bench'
import { GeolocationSource } from './geolocation'
import { SimulatorSource } from './simulator'
import type { SpeedSample } from './source'

/**
 * Ce que ces tests tiennent : le banc traverse bien la **vraie** source GPS, et
 * il en obtient une vitesse dans les deux cas qui comptent — récepteur qui
 * annonce sa vitesse, et récepteur qui ne l'annonce pas, où elle doit être
 * dérivée de deux positions. C'est ce second chemin qui s'était tu en roulant.
 */

function bench(options: Partial<typeof DEFAULT_BENCH> = {}) {
  const simulator = new SimulatorSource()
  simulator.start()
  const gps = new GpsBench(simulator)
  gps.setOptions({ ...DEFAULT_BENCH, ...options })

  const source = new GeolocationSource({ maxPlausibleKmh: 260, maxAccuracyM: 250 })
  source.setProvider(gps)
  const samples: SpeedSample[] = []
  source.onSample((sample) => samples.push(sample))
  source.start()

  return { simulator, gps, source, samples }
}

/** Fait rouler le banc pendant une durée, à soixante tours de boucle par seconde. */
function run(gps: GpsBench, durationS: number): void {
  const dt = 1 / 60
  for (let i = 0; i < Math.round(durationS * 60); i += 1) gps.tick(dt)
}

describe('GpsBench', () => {
  it('fait produire des vitesses par la vraie source GPS', () => {
    const { simulator, gps, samples } = bench()
    simulator.setThrottle(1)

    run(gps, 5)

    expect(samples.length).toBeGreaterThan(100)
    expect(samples.at(-1)?.kmh).toBeGreaterThan(50)
  })

  it('dérive la vitesse quand le récepteur ne l annonce pas', () => {
    // Le chemin qui s'était tu en roulant : sans `coords.speed`, la source doit
    // tirer la vitesse de deux positions. Elle refusait alors les écarts trop
    // courts tout en remplaçant sa référence, si bien qu'aucun n'atteignait
    // jamais le minimum exploitable.
    const { simulator, gps, samples } = bench({ reportsSpeed: false })
    simulator.setThrottle(1)

    run(gps, 5)

    expect(samples.length).toBeGreaterThan(10)
    expect(samples.at(-1)?.derived).toBe(true)
    expect(samples.at(-1)?.kmh).toBeGreaterThan(50)
  })

  it('tient la cadence réglée, et s espace à l arrêt', () => {
    // Trente millisecondes en roulant, deux secondes à l'arrêt : les valeurs
    // relevées sur la voiture, et non la seconde qu'on suppose partout.
    const roulant = bench()
    roulant.simulator.setThrottle(1)
    run(roulant.gps, 4)

    const arret = bench()
    run(arret.gps, 4)

    expect(roulant.samples.length).toBeGreaterThan(100)
    expect(arret.samples.length).toBeLessThanOrEqual(3)
  })

  it('annonce la précision réglée sur chaque position', () => {
    const { simulator, gps, samples } = bench({ accuracyM: 42 })
    simulator.setThrottle(1)

    run(gps, 2)

    expect(samples.every((sample) => sample.accuracyM === 42)).toBe(true)
  })

  it('fait rejeter les positions trop floues par la source', () => {
    // Le filtre de précision est dans la source, pas dans le banc : c'est bien
    // le module réel qui décide, et le banc ne fait que lui donner à voir.
    const simulator = new SimulatorSource()
    simulator.start()
    simulator.setThrottle(1)
    const gps = new GpsBench(simulator)
    gps.setOptions({ ...DEFAULT_BENCH, accuracyM: 400 })

    const source = new GeolocationSource({ maxPlausibleKmh: 260, maxAccuracyM: 250 })
    source.setProvider(gps)
    const samples: SpeedSample[] = []
    source.onSample((sample) => samples.push(sample))
    source.start()

    run(gps, 3)

    expect(samples).toHaveLength(0)
    expect(source.stats.rejected.inaccurate).toBeGreaterThan(50)
  })

  it('fait rejeter les mesures au-delà du plausible', () => {
    // Le défaut du 4 septembre, reproduit sans rouler : une borne calée sur un
    // bouchon, et l'autoroute passe entière à la trappe.
    const simulator = new SimulatorSource()
    simulator.start()
    simulator.setThrottle(1)
    const gps = new GpsBench(simulator)

    const source = new GeolocationSource({ maxPlausibleKmh: 40, maxAccuracyM: 250 })
    source.setProvider(gps)
    const samples: SpeedSample[] = []
    source.onSample((sample) => samples.push(sample))
    source.start()

    run(gps, 6)

    const dernier = samples.at(-1)?.kmh ?? 0
    expect(dernier).toBeLessThanOrEqual(40)
    expect(source.stats.rejected.implausible).toBeGreaterThan(50)
  })

  it('bruite la vitesse dérivée autant que la vitesse annoncée', () => {
    // Sans bruit sur la position, le mode « vitesse non annoncée » livrerait un
    // signal plus propre que l'autre — l'inverse de ce qu'un vrai récepteur fait.
    const annoncee = bench()
    annoncee.simulator.setCruise(110)
    run(annoncee.gps, 8)

    const derivee = bench({ reportsSpeed: false })
    derivee.simulator.setCruise(110)
    run(derivee.gps, 8)

    const ecart = (samples: SpeedSample[]): number => {
      const kmh = samples.slice(-100).map((s) => s.kmh)
      const moyenne = kmh.reduce((a, b) => a + b, 0) / kmh.length
      return Math.sqrt(kmh.reduce((a, b) => a + (b - moyenne) ** 2, 0) / kmh.length)
    }

    expect(ecart(annoncee.samples)).toBeGreaterThan(0.2)
    expect(ecart(derivee.samples)).toBeGreaterThan(0.2)
  })
})
