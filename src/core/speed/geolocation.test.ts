import { afterEach, describe, expect, it } from 'vitest'

import { GeolocationSource } from './geolocation'
import type { SourceStatus, SpeedSample } from './source'

/**
 * Tests de la source GPS.
 *
 * Le navigateur est remplacé par une fausse géolocalisation à laquelle on pousse
 * les positions qu'on veut, à la cadence qu'on veut. C'est le seul moyen de
 * vérifier ce module sans rouler — et son absence a coûté cher : la source
 * cessait de produire toute vitesse au-delà de six positions par seconde, ce qui
 * ne se voyait qu'en voiture.
 *
 * **La cadence est le paramètre qui compte.** Le GPS d'une Tesla livre une
 * position toutes les quelques dizaines de millisecondes dès qu'elle roule, et
 * s'espace à plusieurs secondes à l'arrêt. Chaque comportement se vérifie donc
 * aux deux bouts.
 */

interface FakeWatch {
  onPosition: (position: GeolocationPosition) => void
  onError: (error: GeolocationPositionError) => void
}

interface FakeGeolocation {
  watches: FakeWatch[]
  cleared: number[]
}

const original = Reflect.getOwnPropertyDescriptor(globalThis, 'navigator')

afterEach(() => {
  if (original) Reflect.defineProperty(globalThis, 'navigator', original)
})

function installFakeGeolocation(): FakeGeolocation {
  const fake: FakeGeolocation = { watches: [], cleared: [] }
  const geolocation = {
    watchPosition(
      onPosition: (position: GeolocationPosition) => void,
      onError: (error: GeolocationPositionError) => void,
    ): number {
      fake.watches.push({ onPosition, onError })
      return fake.watches.length
    },
    clearWatch(id: number): void {
      fake.cleared.push(id)
    },
    getCurrentPosition(): void {},
  }
  Reflect.defineProperty(globalThis, 'navigator', {
    value: { geolocation },
    configurable: true,
    writable: true,
  })
  return fake
}

/**
 * Une position sur une route rectiligne, à `metres` du départ.
 *
 * `speed` à `null` reproduit un navigateur qui ne renseigne pas la vitesse — le
 * cas où elle doit être déduite de deux positions.
 */
function position(atMs: number, metres: number, speed: number | null): GeolocationPosition {
  return {
    coords: {
      latitude: 49.6 + metres / 111_320,
      longitude: 6.13,
      accuracy: 5,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed,
    },
    timestamp: atMs,
  } as unknown as GeolocationPosition
}

interface Trajet {
  samples: SpeedSample[]
  statuses: SourceStatus[]
  source: GeolocationSource
}

/** Déroule un trajet à vitesse constante, à la cadence demandée. */
function drive(options: {
  kmh: number
  cadenceMs: number
  seconds: number
  reportsSpeed: boolean
  maxPlausibleKmh?: number
}): Trajet {
  const fake = installFakeGeolocation()
  const source = new GeolocationSource({
    maxPlausibleKmh: options.maxPlausibleKmh ?? 260,
  })
  const samples: SpeedSample[] = []
  const statuses: SourceStatus[] = []
  source.onSample((sample) => samples.push(sample))
  source.onStatus((status) => statuses.push(status))
  source.start()

  const watch = fake.watches[0]
  if (!watch) throw new Error('aucune surveillance installée')

  const mps = options.kmh / 3.6
  const steps = Math.round((options.seconds * 1000) / options.cadenceMs)
  for (let i = 0; i <= steps; i += 1) {
    const atMs = i * options.cadenceMs
    watch.onPosition(position(atMs, (atMs / 1000) * mps, options.reportsSpeed ? mps : null))
  }
  return { samples, statuses, source }
}

describe('GeolocationSource — la vitesse lue', () => {
  it('délivre à toutes les cadences', () => {
    for (const cadenceMs of [30, 100, 250, 1000, 3000]) {
      const { samples } = drive({ kmh: 110, cadenceMs, seconds: 20, reportsSpeed: true })
      expect(samples.length, `cadence ${cadenceMs} ms`).toBeGreaterThan(5)
      expect(samples[samples.length - 1]?.kmh).toBeCloseTo(110, 5)
      expect(samples.every((sample) => !sample.derived)).toBe(true)
    }
  })
})

describe('GeolocationSource — la vitesse déduite de deux positions', () => {
  it('délivre à toutes les cadences, y compris la plus rapide', () => {
    // Le défaut corrigé : une position arrivant avant le délai minimal était
    // refusée **et** remplaçait la référence, si bien que l'écart entre deux
    // positions ne s'accumulait jamais. Mesuré alors : zéro vitesse produite sur
    // une minute à 110 km/h dès que la cadence passait sous 150 ms — c'est-à-dire
    // dès que la voiture roulait. Le suivi ne repartait plus, et relancer la
    // surveillance n'y changeait rien puisque la cadence restait rapide.
    for (const cadenceMs of [30, 50, 100, 250, 1000]) {
      const { samples } = drive({ kmh: 110, cadenceMs, seconds: 60, reportsSpeed: false })
      expect(samples.length, `cadence ${cadenceMs} ms`).toBeGreaterThan(5)
    }
  })

  it('rend une vitesse juste, quelle que soit la cadence', () => {
    for (const cadenceMs of [30, 100, 1000]) {
      const { samples } = drive({ kmh: 90, cadenceMs, seconds: 30, reportsSpeed: false })
      const dernieres = samples.slice(-5)
      for (const sample of dernieres) {
        expect(sample.kmh, `cadence ${cadenceMs} ms`).toBeCloseTo(90, 0)
        expect(sample.derived).toBe(true)
      }
    }
  })

  it('compte les positions reçues et les vitesses produites', () => {
    // À cadence rapide, toutes les positions ne donnent pas une vitesse : il en
    // faut deux assez espacées. L'écart entre les deux comptes est donc normal —
    // ce qui ne l'est pas, c'est qu'il soit total, et c'est ce que ces deux
    // chiffres rendent visible à l'écran de télémétrie.
    const { samples, source } = drive({
      kmh: 110,
      cadenceMs: 30,
      seconds: 10,
      reportsSpeed: false,
    })
    // Dix secondes à trente millisecondes : 334 positions, de la première à la
    // dernière incluses.
    expect(source.stats.received).toBe(334)
    expect(source.stats.emitted).toBe(samples.length)
    expect(source.stats.emitted).toBeGreaterThan(0)
  })
})

describe('GeolocationSource — les mesures aberrantes', () => {
  it('n’émet pas une mesure au-delà du plausible', () => {
    // Elle était remplacée par la dernière valeur saine **et émise quand même**,
    // ce qui la faisait passer pour une mesure : la vitesse se figeait sans que
    // rien ne le signale, et le chien de garde ne voyait aucun silence dont il
    // aurait pu se saisir. Le conditionnement du signal, lui, ignore déjà
    // entièrement une valeur aberrante — les deux disent maintenant la même
    // chose.
    const fake = installFakeGeolocation()
    const source = new GeolocationSource({ maxPlausibleKmh: 200 })
    const samples: SpeedSample[] = []
    source.onSample((sample) => samples.push(sample))
    source.start()
    const watch = fake.watches[0]!

    // Les vitesses sont en mètres par seconde, comme le navigateur les rend :
    // 30 m/s valent 108 km/h.
    watch.onPosition(position(0, 0, 30))
    watch.onPosition(position(1000, 30, 30))
    // Un saut de position sous un pont : 400 km/h, au-delà du plausible déclaré.
    watch.onPosition(position(2000, 130, 400 / 3.6))
    watch.onPosition(position(3000, 160, 30))

    expect(samples.map((s) => Math.round(s.kmh))).toEqual([108, 108, 108])
    expect(source.stats.rejected.implausible).toBe(1)
  })

  it('traite une vitesse négative comme non renseignée', () => {
    // Des implémentations rendent −1 quand la vitesse n'est pas disponible.
    // La prendre au mot donnerait une vitesse négative ; il faut la déduire des
    // positions, comme si le champ était absent.
    const fake = installFakeGeolocation()
    const source = new GeolocationSource({ maxPlausibleKmh: 260 })
    const samples: SpeedSample[] = []
    source.onSample((sample) => samples.push(sample))
    source.start()
    const watch = fake.watches[0]!

    watch.onPosition(position(0, 0, -1))
    watch.onPosition(position(1000, 25, -1))

    expect(samples).toHaveLength(1)
    expect(samples[0]?.derived).toBe(true)
    expect(samples[0]?.kmh).toBeCloseTo(90, 0)
  })
})

describe('GeolocationSource — la reprise du suivi', () => {
  it('repart d’une référence neuve après un arrêt', () => {
    // Le chien de garde relance le suivi en appelant `stop` puis `start`. La
    // position de référence ne doit pas survivre à cet arrêt : l'écart avec la
    // première position d'après serait celui d'une interruption entière.
    const fake = installFakeGeolocation()
    const source = new GeolocationSource({ maxPlausibleKmh: 260 })
    const samples: SpeedSample[] = []
    source.onSample((sample) => samples.push(sample))

    source.start()
    fake.watches[0]!.onPosition(position(0, 0, null))
    source.stop()
    source.start()
    // Trente secondes plus tard, à trois cents mètres : sans remise à zéro, cela
    // donnerait 36 km/h alors qu'on ne sait rien de ce qui s'est passé entre les
    // deux.
    fake.watches[1]!.onPosition(position(30_000, 300, null))

    expect(samples).toHaveLength(0)
    expect(fake.cleared).toEqual([1])
  })
})
