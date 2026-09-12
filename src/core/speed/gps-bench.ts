import { DEFAULT_SIGNAL, type SignalOptions, type SimulatorSource } from './simulator'
import type { PositionProvider } from './geolocation'

/**
 * Des positions fabriquées, pour que la **vraie** source GPS ait quelque chose à
 * lire sans qu'on roule.
 *
 * Le simulateur ordinaire émet des vitesses toutes faites : il ne traverse
 * jamais `GeolocationSource`, où vivaient pourtant les deux derniers défauts
 * relevés en roulant — la source qui se tait au-delà de six positions par
 * seconde, et le plafond de plausibilité qui rejetait tout. Un banc qui saute ce
 * module ne peut pas les voir.
 *
 * Ce fournisseur intègre donc la vitesse du simulateur en une trajectoire et
 * rend des positions complètes. La route est **droite**, plein nord, et c'est
 * assumé : rien en aval ne lit les coordonnées, seule compte la suite de points
 * dont on tire une vitesse. Le jour où le cap ou la pente entreront dans le
 * calcul, il faudra autre chose.
 */

/** Un degré de latitude, en mètres. Le méridien ne varie que de deux pour mille. */
const METERS_PER_DEGREE = 111_320

/** Point de départ : quelque part en France, et sans importance. */
const START_LATITUDE = 45.75
const START_LONGITUDE = 4.85

export interface BenchOptions extends SignalOptions {
  /** Précision annoncée avec chaque position, en mètres. */
  accuracyM: number
  /**
   * Le récepteur annonce-t-il lui-même la vitesse ?
   *
   * On ne sait pas encore ce que fait celui de la voiture — la ligne « Origine
   * de la vitesse » l'apprendra au premier trajet. En attendant, les deux cas
   * s'entendent ici : renseignée, la vitesse arrive telle quelle ; absente, la
   * source doit la dériver de deux positions, ce qui est le chemin où elle
   * s'était tue.
   */
  reportsSpeed: boolean
}

export const DEFAULT_BENCH: BenchOptions = {
  ...DEFAULT_SIGNAL,
  accuracyM: 8,
  reportsSpeed: true,
}

/** Vitesse en deçà de laquelle le récepteur est considéré à l'arrêt, en km/h. */
const STANDSTILL_KMH = 1

export class GpsBench implements PositionProvider {
  private options: BenchOptions = { ...DEFAULT_BENCH }
  private watchers = new Map<
    number,
    { onPosition: (position: GeolocationPosition) => void }
  >()
  private nextId = 1

  /** Distance parcourue depuis le départ, en mètres. */
  private traveledM = 0
  private sinceEmitMs = 0
  private noise = noiseSource(7)

  constructor(private readonly simulator: SimulatorSource) {}

  setOptions(options: BenchOptions): void {
    this.options = { ...options }
  }

  getOptions(): BenchOptions {
    return { ...this.options }
  }

  reset(): void {
    this.traveledM = 0
    this.sinceEmitMs = 0
    this.noise = noiseSource(7)
  }

  watchPosition(onPosition: (position: GeolocationPosition) => void): number {
    const id = this.nextId
    this.nextId += 1
    this.watchers.set(id, { onPosition })
    return id
  }

  clearWatch(id: number): void {
    this.watchers.delete(id)
  }

  /**
   * Avance la physique et livre une position quand la cadence l'impose.
   *
   * Appelé par la boucle, comme le reste : le banc n'a pas de minuteur à lui,
   * qui serait gelé en arrière-plan précisément là où le signal se dégrade.
   * L'horodatage vient de l'horloge du simulateur, avancée par les pas reçus —
   * l'heure réelle ne bouge pas quand la boucle est avancée à pas fixe.
   */
  tick(dt: number): void {
    if (dt <= 0) return
    this.simulator.advance(dt)
    const at = this.simulator.clock

    const trueKmh = this.simulator.trueKmh
    this.traveledM += (trueKmh / 3.6) * dt

    this.sinceEmitMs += dt * 1000
    const due =
      trueKmh < STANDSTILL_KMH ? this.options.standstillCadenceMs : this.options.cadenceMs
    if (this.sinceEmitMs < due) return
    this.sinceEmitMs = 0

    if (this.watchers.size === 0) return
    const position = this.positionAt(trueKmh, at)
    for (const watcher of this.watchers.values()) watcher.onPosition(position)
  }

  /**
   * Une position complète, telle qu'un récepteur la rendrait.
   *
   * Le bruit porte sur la **vitesse annoncée** et sur la **distance parcourue**,
   * de la même quantité : c'est ce qui fait qu'une vitesse dérivée de deux
   * positions est bruitée elle aussi, sans quoi le mode « vitesse non annoncée »
   * livrerait un signal plus propre que l'autre — l'inverse de la réalité.
   */
  private positionAt(trueKmh: number, at: number): GeolocationPosition {
    const errorKmh = this.noise() * this.options.noiseKmh
    const measuredKmh = Math.max(0, trueKmh + errorKmh)
    // L'erreur de position qui produirait cet écart de vitesse sur un intervalle.
    const jitterM = (errorKmh / 3.6) * (this.options.cadenceMs / 1000)
    const latitude = START_LATITUDE + (this.traveledM + jitterM) / METERS_PER_DEGREE

    return {
      coords: {
        latitude,
        longitude: START_LONGITUDE,
        accuracy: this.options.accuracyM,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: this.options.reportsSpeed ? measuredKmh / 3.6 : null,
        toJSON: () => ({}),
      },
      timestamp: at,
      toJSON: () => ({}),
    } as GeolocationPosition
  }
}

/** Bruit reproductible d'écart-type unité, comme celui du simulateur. */
function noiseSource(seed: number): () => number {
  let state = seed >>> 0
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return () => (next() + next() - 1) * Math.sqrt(6)
}
