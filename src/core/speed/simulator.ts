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
/** Vivacité du régulateur : fraction de l'écart rattrapée par seconde. */
const CRUISE_RESPONSE = 1.6

export class SimulatorSource extends SpeedSource {
  readonly kind = 'simulator' as const
  readonly label = 'Simulateur'

  private kmh = 0
  private throttle = 0
  private brake = 0
  private running = false
  /**
   * Vitesse à tenir, ou `null` en conduite libre.
   *
   * C'est un régulateur, pas une valeur imposée une fois : sans cela, le curseur
   * ne faisait que poser la vitesse avant que la traînée ne la fasse retomber
   * aussitôt — alors que ce qu'on veut simuler, c'est précisément une allure
   * stabilisée, comme on la tient sur autoroute.
   */
  private cruise: number | null = null

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

  /** Position de l'accélérateur, de 0 à 1. Reprendre les commandes lève le maintien. */
  setThrottle(value: number): void {
    const next = clamp(value, 0, 1)
    if (next > 0) this.cruise = null
    this.throttle = next
  }

  /** Position du frein, de 0 à 1. Reprendre les commandes lève le maintien. */
  setBrake(value: number): void {
    const next = clamp(value, 0, 1)
    if (next > 0) this.cruise = null
    this.brake = next
  }

  /** Vitesse à tenir, ou `null` pour rendre la main. */
  setCruise(kmh: number | null): void {
    this.cruise = kmh === null ? null : clamp(kmh, 0, MAX_KMH)
  }

  getCruise(): number | null {
    return this.cruise
  }

  getThrottle(): number {
    return this.throttle
  }

  getBrake(): number {
    return this.brake
  }

  override tick(dt: number): void {
    if (!this.running || dt <= 0) return

    if (this.cruise !== null) {
      // Le régulateur rejoint la consigne puis s'y tient, sans osciller autour :
      // on rapproche la vitesse d'une fraction de l'écart à chaque pas, et on
      // borne le rapprochement pour que la reprise reste crédible à l'oreille.
      const error = this.cruise - this.kmh
      const step = clamp(error * CRUISE_RESPONSE * dt, -BRAKE_KMH_S * dt, THRUST_KMH_S * dt)
      this.kmh = clamp(this.kmh + step, 0, MAX_KMH)
    } else {
      const thrust =
        (THRUST_KMH_S * this.throttle * THRUST_HALF_KMH) / (THRUST_HALF_KMH + this.kmh)
      const drag = DRAG_KMH_S + DRAG_QUADRATIC * this.kmh * this.kmh
      const braking = BRAKE_KMH_S * this.brake

      this.kmh = clamp(this.kmh + (thrust - drag - braking) * dt, 0, MAX_KMH)
    }

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
