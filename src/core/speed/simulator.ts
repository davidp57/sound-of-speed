import { SpeedSource, type SpeedSample } from './source'

/**
 * Vitesse simulée au clavier, pour travailler sur un poste fixe.
 *
 * La physique est volontairement grossière — ce n'est pas un simulateur de
 * conduite, juste de quoi produire une courbe de vitesse crédible : une poussée
 * qui s'essouffle avec la vitesse, une traînée, un frein franc.
 */

/**
 * Poussée à l'arrêt, en km/h par seconde.
 *
 * Calibré pour que l'équilibre entre poussée et traînée se situe vers 200 km/h :
 * en dessous, les derniers rapports ne sont jamais engagés et une partie de la
 * plage de réglage reste intestable.
 */
const THRUST_KMH_S = 32
/** Vitesse à laquelle la poussée est retombée de moitié. */
const THRUST_HALF_KMH = 150
/** Traînée passive, pied levé, en km/h par seconde. */
const DRAG_KMH_S = 2
/** Part de la traînée proportionnelle au carré de la vitesse. */
const DRAG_QUADRATIC = 0.0003
/** Freinage, en km/h par seconde. */
const BRAKE_KMH_S = 70
/** Vitesse maximale simulée. */
const MAX_KMH = 260

export class SimulatorSource extends SpeedSource {
  readonly kind = 'simulator' as const
  readonly label = 'Simulateur'

  private kmh = 0
  private throttle = 0
  private brake = 0
  private running = false

  start(): void {
    this.running = true
    this.setStatus('active')
  }

  stop(): void {
    this.running = false
    this.throttle = 0
    this.brake = 0
    this.setStatus('idle')
  }

  /** Position de l'accélérateur, de 0 à 1. */
  setThrottle(value: number): void {
    this.throttle = clamp(value, 0, 1)
  }

  /** Position du frein, de 0 à 1. */
  setBrake(value: number): void {
    this.brake = clamp(value, 0, 1)
  }

  /** Force la vitesse, sans passer par la physique. Utilisé par le curseur de l'écran. */
  setSpeed(kmh: number): void {
    this.kmh = clamp(kmh, 0, MAX_KMH)
  }

  getThrottle(): number {
    return this.throttle
  }

  getBrake(): number {
    return this.brake
  }

  override tick(dt: number): void {
    if (!this.running || dt <= 0) return

    const thrust =
      (THRUST_KMH_S * this.throttle * THRUST_HALF_KMH) / (THRUST_HALF_KMH + this.kmh)
    const drag = DRAG_KMH_S + DRAG_QUADRATIC * this.kmh * this.kmh
    const braking = BRAKE_KMH_S * this.brake

    this.kmh = clamp(this.kmh + (thrust - drag - braking) * dt, 0, MAX_KMH)

    const sample: SpeedSample = {
      kmh: this.kmh,
      at: performance.timeOrigin + performance.now(),
      accuracyM: null,
      derived: false,
    }
    this.emit(sample)
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}
