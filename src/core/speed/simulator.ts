import { SpeedSource } from './source'

/**
 * Vitesse simulée au clavier ou à la manette, pour travailler sur un poste fixe.
 *
 * La physique est volontairement grossière — ce n'est pas un simulateur de
 * conduite, juste de quoi produire une courbe de vitesse crédible : une poussée
 * qui s'essouffle avec la vitesse, une traînée, un frein franc.
 *
 * Ce qui compte davantage est **ce qu'il émet**. En vitesse exacte, il livre un
 * chiffre parfait à chaque image, et toute la difficulté du produit disparaît :
 * mesuré en croisière tenue à 110 km/h, l'accélération vue vaut exactement zéro,
 * quand un vrai GPS en montre 0,51 m/s² de pointe — un quart de la charge pleine
 * du profil Route, sur une vitesse qui ne bouge pas. En mesure GPS, il retient sa
 * vitesse et ne la livre qu'à la cadence d'un récepteur, bruitée.
 *
 * Le troisième mode ne vit pas ici : il produit des **positions**, que la vraie
 * source GPS traite (`gpsProviderFrom`).
 */

/** Ce que le simulateur émet. */
export type SimulatorMode = 'perfect' | 'measured'

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

/**
 * Réglages du signal imité, valeurs relevées sur la voiture.
 *
 * La cadence est celle du GPS de la Tesla en roulant — quelques dizaines de
 * millisecondes, et non la seconde qu'on suppose partout. C'est l'hypothèse
 * fausse qui a coûté le lot PENTE, et la reproduire ici serait la réintroduire
 * dans le banc censé la démentir. À l'arrêt, le même récepteur s'espace à
 * plusieurs secondes : la cadence suit donc la vitesse.
 */
export interface SignalOptions {
  /** Cadence en roulant, en millisecondes. */
  cadenceMs: number
  /** Cadence à l'arrêt, en millisecondes. */
  standstillCadenceMs: number
  /** Écart-type du bruit de mesure, en km/h. */
  noiseKmh: number
}

export const DEFAULT_SIGNAL: SignalOptions = {
  cadenceMs: 30,
  standstillCadenceMs: 2000,
  noiseKmh: 1,
}

/** Vitesse en deçà de laquelle le récepteur est considéré à l'arrêt, en km/h. */
const STANDSTILL_KMH = 1

export class SimulatorSource extends SpeedSource {
  readonly kind = 'simulator' as const
  readonly label = 'Simulateur'

  private kmh = 0
  private throttle = 0
  private brake = 0
  private running = false
  private mode: SimulatorMode = 'perfect'
  private signal: SignalOptions = { ...DEFAULT_SIGNAL }
  /** Temps écoulé depuis la dernière mesure émise, en millisecondes. */
  private sinceEmitMs = 0
  private noise = noiseSource(1)
  /** Horloge propre, en millisecondes. Zéro tant qu'aucun pas n'a été fait. */
  private clockMs = 0
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

  /**
   * Ce que le simulateur émet : la vitesse exacte, ou une mesure de GPS.
   *
   * Changer de mode remet le tirage du bruit à son début : deux essais lancés
   * dans le même ordre donnent la même suite, sans quoi on ne saurait pas si un
   * écart entendu vient du réglage ou du hasard.
   */
  setMode(mode: SimulatorMode): void {
    this.mode = mode
    this.sinceEmitMs = 0
    this.noise = noiseSource(1)
  }

  getMode(): SimulatorMode {
    return this.mode
  }

  setSignal(options: SignalOptions): void {
    this.signal = { ...options }
  }

  getSignal(): SignalOptions {
    return { ...this.signal }
  }

  /** La vitesse vraie du véhicule, avant toute mesure. En km/h. */
  get trueKmh(): number {
    return this.kmh
  }

  /**
   * Avance la physique seule, sans rien émettre.
   *
   * C'est ce dont le fournisseur de positions a besoin : il pilote lui-même ce
   * qui sort, et la source GPS n'a que faire d'une vitesse émise en parallèle.
   */
  advance(dt: number): void {
    if (dt <= 0) return
    this.advanceClock(dt)
    this.integrate(dt)
  }

  /** L'heure courante du simulateur, en millisecondes. */
  get clock(): number {
    return this.now()
  }

  private advanceClock(dt: number): void {
    this.clockMs = this.now() + dt * 1000
  }

  override tick(dt: number): void {
    if (!this.running || dt <= 0) return

    this.advanceClock(dt)
    this.integrate(dt)

    if (this.mode === 'perfect') {
      this.emit({ kmh: this.kmh, at: this.now(), accuracyM: null, derived: false })
      return
    }

    // Une mesure ne sort qu'à la cadence du récepteur, et le reste du temps il
    // ne se passe rien — c'est le silence entre deux mesures qui met le
    // conditionnement à l'épreuve, pas la mesure elle-même.
    this.sinceEmitMs += dt * 1000
    const due =
      this.kmh < STANDSTILL_KMH ? this.signal.standstillCadenceMs : this.signal.cadenceMs
    if (this.sinceEmitMs < due) return
    this.sinceEmitMs = 0

    this.emit({
      kmh: Math.max(0, this.kmh + this.noise() * this.signal.noiseKmh),
      at: this.now(),
      accuracyM: null,
      derived: false,
    })
  }

  /** La physique, sans rien émettre. */
  private integrate(dt: number): void {
    if (this.cruise !== null) {
      // Le régulateur rejoint la consigne puis s'y tient, sans osciller autour :
      // on rapproche la vitesse d'une fraction de l'écart à chaque pas, et on
      // borne le rapprochement pour que la reprise reste crédible à l'oreille.
      const error = this.cruise - this.kmh
      const step = clamp(error * CRUISE_RESPONSE * dt, -BRAKE_KMH_S * dt, THRUST_KMH_S * dt)
      this.kmh = clamp(this.kmh + step, 0, MAX_KMH)
      return
    }

    const thrust = (THRUST_KMH_S * this.throttle * THRUST_HALF_KMH) / (THRUST_HALF_KMH + this.kmh)
    const drag = DRAG_KMH_S + DRAG_QUADRATIC * this.kmh * this.kmh
    const braking = BRAKE_KMH_S * this.brake

    this.kmh = clamp(this.kmh + (thrust - drag - braking) * dt, 0, MAX_KMH)
  }

  /**
   * L'horloge du simulateur, avancée par les pas qu'on lui donne.
   *
   * Et non `performance.now()`, qui ne bouge pas quand la boucle est avancée à
   * pas fixe depuis le banc de mise au point : tous les échantillons portaient
   * alors le même horodatage, le conditionnement voyait un écart nul et n'en
   * tirait aucune pente. Une horloge cumulée rend le banc mesurable sans rien
   * changer en marche normale, où la somme des pas suit l'heure de près.
   */
  private now(): number {
    if (this.clockMs === 0) this.clockMs = performance.timeOrigin + performance.now()
    return this.clockMs
  }
}

/**
 * Bruit de mesure reproductible, d'écart-type unité.
 *
 * À graine fixe, et c'est délibéré : un banc dont le bruit change à chaque essai
 * ne permet pas de comparer deux réglages. La somme de deux tirages uniformes
 * approche une cloche mieux qu'un seul, ce qui suffit pour un bruit de GPS.
 */
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

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}
