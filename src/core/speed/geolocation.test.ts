import { afterEach, describe, expect, it } from 'vitest'

import { GeolocationSource } from './geolocation'
import { createDefaultProfile } from '../preset/defaults'
import type { SourceStatus, SpeedSample } from './source'

/**
 * Seuil de précision livré. Lu dans le profil et non recopié : c'est cette
 * valeur-là qui roulera, et un test qui recopierait la sienne ne dirait rien
 * du réglage réel.
 */
const DEFAULT_MAX_ACCURACY_M = createDefaultProfile().speed.maxAccuracyM

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
  /** Les options du dernier appel, telles que le navigateur les recevrait. */
  options: PositionOptions | undefined
}

const original = Reflect.getOwnPropertyDescriptor(globalThis, 'navigator')

afterEach(() => {
  if (original) Reflect.defineProperty(globalThis, 'navigator', original)
})

function installFakeGeolocation(): FakeGeolocation {
  const fake: FakeGeolocation = { watches: [], cleared: [], options: undefined }
  const geolocation = {
    watchPosition(
      onPosition: (position: GeolocationPosition) => void,
      onError: (error: GeolocationPositionError) => void,
      options?: PositionOptions,
    ): number {
      fake.watches.push({ onPosition, onError })
      fake.options = options
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
function position(
  atMs: number,
  metres: number,
  speed: number | null,
  accuracyM: number | null = 5,
): GeolocationPosition {
  return {
    coords: {
      latitude: 49.6 + metres / 111_320,
      longitude: 6.13,
      accuracy: accuracyM,
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
  maxAccuracyM?: number
  accuracyM?: number | null
}): Trajet {
  const fake = installFakeGeolocation()
  const source = new GeolocationSource({
    maxPlausibleKmh: options.maxPlausibleKmh ?? 260,
    maxAccuracyM: options.maxAccuracyM ?? DEFAULT_MAX_ACCURACY_M,
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
    watch.onPosition(
      position(
        atMs,
        (atMs / 1000) * mps,
        options.reportsSpeed ? mps : null,
        options.accuracyM === undefined ? 5 : options.accuracyM,
      ),
    )
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
    const source = new GeolocationSource({ maxPlausibleKmh: 200, maxAccuracyM: DEFAULT_MAX_ACCURACY_M })
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
    const source = new GeolocationSource({ maxPlausibleKmh: 260, maxAccuracyM: DEFAULT_MAX_ACCURACY_M })
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
    const source = new GeolocationSource({ maxPlausibleKmh: 260, maxAccuracyM: DEFAULT_MAX_ACCURACY_M })
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

describe('GeolocationSource — la précision des positions', () => {
  it('rejette une position plus imprécise que le seuil, et la compte', () => {
    // Une position à quelques centaines de mètres près n'est pas une position
    // fausse au sens du GPS, mais la vitesse qu'on en déduit l'est : deux
    // secondes d'écart et trois cents mètres d'incertitude donnent n'importe
    // quoi. Rejeter n'a d'intérêt que si le rejet se compte : un filtre muet
    // qui ferait taire la source ressemblerait trait pour trait au défaut du
    // GPS immobile.
    const { samples, source } = drive({
      kmh: 110,
      cadenceMs: 200,
      seconds: 10,
      reportsSpeed: true,
      maxAccuracyM: 100,
      accuracyM: 400,
    })

    expect(samples).toHaveLength(0)
    expect(source.stats.rejected.inaccurate).toBe(source.stats.received)
    expect(source.stats.emitted).toBe(0)
  })

  it('laisse passer une position précise', () => {
    const { samples, source } = drive({
      kmh: 110,
      cadenceMs: 200,
      seconds: 10,
      reportsSpeed: true,
      maxAccuracyM: 100,
      accuracyM: 8,
    })

    expect(samples.length).toBeGreaterThan(5)
    expect(source.stats.rejected.inaccurate).toBe(0)
  })

  it('accepte une précision juste égale au seuil', () => {
    // La borne est incluse : c'est le seuil au-delà duquel on rejette, pas
    // celui à partir duquel on rejette.
    const { samples } = drive({
      kmh: 90,
      cadenceMs: 500,
      seconds: 5,
      reportsSpeed: true,
      maxAccuracyM: 60,
      accuracyM: 60,
    })

    expect(samples.length).toBeGreaterThan(3)
  })

  it('ne rejette rien d’ordinaire au réglage livré', () => {
    // Le seuil livré est volontairement large : les valeurs réelles de la
    // voiture ne sont pas connues, et un seuil trop serré ferait taire la
    // source — le défaut qu'on vient de corriger. Ce test est là pour qu'un
    // resserrement au doigt mouillé se voie tout de suite : 100 mètres est un
    // relevé médiocre mais crédible sur un récepteur qui voit peu de ciel.
    for (const accuracyM of [5, 25, 60, 100]) {
      const { samples, source } = drive({
        kmh: 110,
        cadenceMs: 200,
        seconds: 10,
        reportsSpeed: true,
        accuracyM,
      })
      expect(source.stats.rejected.inaccurate, `précision ${accuracyM} m`).toBe(0)
      expect(samples.length, `précision ${accuracyM} m`).toBeGreaterThan(5)
    }
  })

  it('n’écarte pas une position dont la précision est inconnue', () => {
    // Tous les navigateurs ne renseignent pas `accuracy`. L'absence de chiffre
    // n'est pas un mauvais chiffre : filtrer là-dessus reviendrait à refuser
    // toutes les positions d'un appareil qui se tait.
    const { samples, source } = drive({
      kmh: 110,
      cadenceMs: 200,
      seconds: 10,
      reportsSpeed: true,
      maxAccuracyM: 100,
      accuracyM: null,
    })

    expect(samples.length).toBeGreaterThan(5)
    expect(source.stats.rejected.inaccurate).toBe(0)
    expect(source.stats.lastAccuracyM).toBeNull()
  })

  it('ne prend pas une position imprécise comme référence', () => {
    // À vitesse déduite, la position rejetée ne doit pas non plus servir de
    // point de départ au calcul suivant : sinon le filtre transforme une
    // position douteuse en vitesse aberrante, et on n'a fait que déplacer le
    // problème d'un rejet à l'autre.
    const fake = installFakeGeolocation()
    const source = new GeolocationSource({ maxPlausibleKmh: 260, maxAccuracyM: 100 })
    const samples: SpeedSample[] = []
    source.onSample((sample) => samples.push(sample))
    source.start()
    const watch = fake.watches[0]!

    watch.onPosition(position(0, 0, null, 6))
    // Un saut de cinq cents mètres, annoncé à neuf cents mètres près.
    watch.onPosition(position(1000, 500, null, 900))
    watch.onPosition(position(2000, 25, null, 6))

    // 25 mètres en deux secondes : 45 km/h. Prise comme référence, la position
    // rejetée aurait donné 475 m/s, donc un second rejet pour aberration.
    expect(samples).toHaveLength(1)
    expect(samples[0]?.kmh).toBeCloseTo(45, 0)
    expect(source.stats.rejected.inaccurate).toBe(1)
    expect(source.stats.rejected.implausible).toBe(0)
  })

  it('remonte la précision courante et les précisions récentes', () => {
    // C'est l'affichage qui décidera du seuil : sans relevé dans la voiture, on
    // ne connaît pas les valeurs réelles. Une position rejetée compte donc dans
    // l'historique — c'est même la première qu'on veut voir.
    const fake = installFakeGeolocation()
    const source = new GeolocationSource({ maxPlausibleKmh: 260, maxAccuracyM: 100 })
    source.start()
    const watch = fake.watches[0]!

    watch.onPosition(position(0, 0, 30, 12))
    watch.onPosition(position(1000, 30, 30, 380))
    watch.onPosition(position(2000, 60, 30, 8))

    expect(source.stats.lastAccuracyM).toBe(8)
    expect(source.stats.recentAccuracyM).toEqual([12, 380, 8])
  })

  it('borne l’historique des précisions', () => {
    // Le GPS de la voiture livre une position toutes les quelques dizaines de
    // millisecondes : sans borne, l'historique grossirait tout le trajet.
    const { source } = drive({
      kmh: 110,
      cadenceMs: 100,
      seconds: 20,
      reportsSpeed: true,
      accuracyM: 7,
    })

    expect(source.stats.received).toBeGreaterThan(100)
    expect(source.stats.recentAccuracyM.length).toBeLessThanOrEqual(12)
  })
})

describe('GeolocationSource — la dernière position', () => {
  it('est tenue à part, et non dans le flux des mesures', () => {
    // Le flux est recopié tel quel par l'enregistreur de traces, et une trace
    // s'exporte et se dépose sans accord particulier : des coordonnées y
    // entreraient par une porte déjà ouverte.
    const { samples, source } = drive({
      kmh: 90,
      cadenceMs: 1000,
      seconds: 5,
      reportsSpeed: true,
    })

    expect(JSON.stringify(samples)).not.toContain('latitude')
    expect(JSON.stringify(samples)).not.toContain('longitude')
    expect(source.lastPosition).not.toBeNull()
    expect(source.lastPosition?.latitude).toBeGreaterThan(49)
  })

  it('est oubliée à l’arrêt du suivi', () => {
    const { source } = drive({ kmh: 50, cadenceMs: 1000, seconds: 3, reportsSpeed: true })
    expect(source.lastPosition).not.toBeNull()

    source.stop()
    expect(source.lastPosition).toBeNull()
  })
})

describe('ce que la source demande au navigateur', () => {
  it('accepte une position déjà connue du système, jusqu’à dix secondes', () => {
    // Interdire le cache — `maximumAge: 0` — faisait attendre un point neuf à
    // chaque démarrage, plusieurs minutes sous un bâtiment, alors que le
    // récepteur en avait un sous la main.
    const fake = installFakeGeolocation()
    const source = new GeolocationSource({ maxPlausibleKmh: 260, maxAccuracyM: 300 })

    source.start()

    expect(fake.options?.maximumAge).toBe(10_000)
    expect(fake.options?.enableHighAccuracy).toBe(true)
  })
})

/**
 * Les comptes d'une source disent ce qu'elle a reçu **depuis le démarrage du
 * suivi**. Une relance demandée à la main ouvre un suivi neuf : les garder
 * ferait lire ensemble deux suivis, et la seule question qu'on se pose alors —
 * celui-ci reçoit-il quelque chose ? — n'aurait plus de réponse lisible.
 */
describe('resetStats', () => {
  it('remet les comptes à zéro sans arrêter le suivi', () => {
    const fake = installFakeGeolocation()
    const source = new GeolocationSource({
      maxPlausibleKmh: 260,
      maxAccuracyM: DEFAULT_MAX_ACCURACY_M,
    })
    const statuses: SourceStatus[] = []
    source.onStatus((status) => statuses.push(status))
    source.start()
    const watch = fake.watches[0]!
    watch.onPosition(position(0, 0, 10))
    watch.onPosition(position(1000, 10, 11, 9999.99))

    expect(source.stats.received).toBeGreaterThan(0)

    source.resetStats()

    expect(source.stats).toMatchObject({
      received: 0,
      emitted: 0,
      lastAccuracyM: null,
      recentAccuracyM: [],
      rejected: { implausible: 0, tooClose: 0, inaccurate: 0 },
    })
    // Le suivi n'est pas touché : le dernier statut reste « actif ».
    expect(statuses.at(-1)).toBe('active')
  })
})
