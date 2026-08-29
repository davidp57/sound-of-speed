import type { SpeedPreset } from '../preset/schema'
import type { SpeedSample } from './source'

/**
 * Conditionnement du signal de vitesse.
 *
 * C'est la pièce la plus importante du projet, et celle qu'on sous-estime : le
 * GPS ne livre qu'une mesure par seconde. Piloter directement un son avec ce
 * signal donne un escalier — la hauteur saute d'un cran chaque seconde. Trois
 * traitements se combinent ici pour en tirer une courbe continue et jouable :
 *
 * 1. Une pente d'accélération, calculée sur une fenêtre glissante d'environ une
 *    seconde, avec une zone morte qui absorbe le tremblement du GPS à l'arrêt.
 * 2. Une extrapolation entre deux mesures : tant que la suivante n'est pas
 *    arrivée, la vitesse continue sur sa lancée au lieu de rester figée.
 * 3. Un ressort amorti critique, intégré à pas fixe, qui rattrape la cible sans
 *    jamais la dépasser. C'est lui qui donne la continuité.
 *
 * Le pas d'intégration est fixe et découplé de la fréquence d'affichage : à 30
 * comme à 120 images par seconde, le comportement est identique.
 */

/** Pas d'intégration du ressort, en secondes. */
const SOLVER_STEP_S = 0.02
/** Au-delà, on considère qu'il y a eu une pause (onglet en arrière-plan). */
const MAX_FRAME_S = 0.25
/** Nombre d'échantillons conservés pour le calcul de pente. */
const HISTORY_SIZE = 16
/** Vitesse en deçà de laquelle on considère le véhicule à l'arrêt, en km/h. */
const STANDSTILL_KMH = 0.8

export interface ConditionedSpeed {
  /** Vitesse lissée, en km/h. C'est elle qui pilote tout le reste. */
  kmh: number
  /** Accélération lissée, en m/s². Positive en accélération. */
  accelMs2: number
  /** Dernière vitesse brute reçue, en km/h. Pour l'écran de télémétrie. */
  rawKmh: number
  /** Pente estimée sur la fenêtre glissante, en km/h par seconde. */
  slopeKmhS: number
  /** Temps écoulé depuis la dernière mesure, en millisecondes. */
  sinceLastSampleMs: number
  /** Intervalles entre les dernières mesures, en millisecondes. Diagnostic. */
  recentGapsMs: number[]
  atStandstill: boolean
}

interface HistoryEntry {
  at: number
  kmh: number
}

export class SpeedConditioner {
  private history: HistoryEntry[] = []
  private gaps: number[] = []

  private rawKmh = 0
  private slopeKmhS = 0
  private targetKmh = 0
  private smoothedKmh = 0
  /** Vitesse de la masse du ressort, en km/h par seconde. */
  private springRate = 0
  private accelMs2 = 0
  private lastSampleAt = 0
  /**
   * Heure de réception, relevée sur notre propre horloge.
   *
   * L'horodatage fourni avec une position n'est pas partout dans la même base
   * que `Date.now()` : certains navigateurs embarqués le comptent depuis le
   * chargement de la page. Les écarts entre mesures restent justes — le suivi de
   * vitesse ne s'en ressent pas — mais la différence avec l'heure courante donne
   * alors un nombre absurde. On ne s'y fie donc que pour des différences entre
   * deux mesures, jamais pour dater une mesure.
   */
  private lastSampleReceivedAt = 0
  private carry = 0

  constructor(private preset: SpeedPreset) {}

  setPreset(preset: SpeedPreset): void {
    this.preset = preset
  }

  reset(): void {
    this.history = []
    this.gaps = []
    this.rawKmh = 0
    this.slopeKmhS = 0
    this.targetKmh = 0
    this.smoothedKmh = 0
    this.springRate = 0
    this.accelMs2 = 0
    this.lastSampleAt = 0
    this.lastSampleReceivedAt = 0
    this.carry = 0
  }

  /** Absorbe une mesure brute. Peut être appelé à n'importe quelle fréquence. */
  push(sample: SpeedSample): void {
    if (!Number.isFinite(sample.kmh)) return

    const kmh = clamp(sample.kmh, 0, this.preset.maxPlausibleKmh)

    if (this.lastSampleAt > 0) {
      const gap = sample.at - this.lastSampleAt
      if (gap > 0) {
        this.gaps.push(Math.round(gap))
        if (this.gaps.length > 6) this.gaps.shift()
      }
    }
    this.lastSampleAt = sample.at
    this.lastSampleReceivedAt = Date.now()
    this.rawKmh = kmh
    this.targetKmh = kmh

    this.history.push({ at: sample.at, kmh })
    if (this.history.length > HISTORY_SIZE) this.history.shift()

    this.slopeKmhS = this.estimateSlope(sample.at, kmh)
  }

  /**
   * Pente sur la fenêtre glissante.
   *
   * On compare la mesure courante à la plus récente qui soit assez ancienne :
   * comparer à la précédente donnerait une pente dominée par le bruit. La zone
   * morte retire un écart fixe avant de diviser, ce qui annule la pente quand la
   * variation n'est que du tremblement de mesure.
   */
  private estimateSlope(at: number, kmh: number): number {
    const oldest = this.history.find((entry) => at - entry.at >= this.preset.accelWindowMs)
    const reference = oldest ?? this.history[0]
    if (!reference) return this.slopeKmhS

    const seconds = (at - reference.at) / 1000
    if (seconds <= 0.15) return this.slopeKmhS

    const delta = kmh - reference.kmh
    const deadband = this.preset.accelDeadbandKmh
    const attenuation = clamp((Math.abs(delta) - deadband) / Math.max(deadband, 0.001), 0, 1)
    const slope = (delta * attenuation) / seconds

    return Number.isFinite(slope) ? slope : 0
  }

  /** Avance l'état d'une image. Retourne la vitesse continue. */
  tick(dt: number): ConditionedSpeed {
    const step = clamp(dt, 0, MAX_FRAME_S)
    const now = Date.now()
    const sinceLastSampleMs =
      this.lastSampleReceivedAt > 0 ? now - this.lastSampleReceivedAt : 0

    // Extrapolation : entre deux mesures, la cible suit la pente estimée. Sans
    // cela la vitesse reste plate une seconde puis saute d'un coup.
    if (step > 0 && this.lastSampleAt > 0) {
      this.targetKmh = clamp(
        this.targetKmh + this.slopeKmhS * step,
        0,
        this.preset.maxPlausibleKmh,
      )
    }

    this.integrate(step)

    this.accelMs2 = clamp(
      this.springRate / 3.6,
      this.preset.minAccelMs2,
      this.preset.maxAccelMs2,
    )

    this.guardAgainstNaN()

    return {
      kmh: this.smoothedKmh,
      accelMs2: this.accelMs2,
      rawKmh: this.rawKmh,
      slopeKmhS: this.slopeKmhS,
      sinceLastSampleMs,
      recentGapsMs: [...this.gaps],
      atStandstill: this.smoothedKmh < STANDSTILL_KMH,
    }
  }

  /**
   * Ressort amorti critique, à pas fixe.
   *
   * `a = ω²·(cible − x) − 2ω·v` : l'amortissement vaut exactement le double de la
   * pulsation, ce qui est la frontière entre le rebond et la mollesse. La vitesse
   * rattrape la cible au plus vite sans jamais la dépasser — un dépassement
   * s'entendrait comme un coup de gaz parasite à chaque mesure GPS.
   */
  private integrate(dt: number): void {
    const omega = Math.max(0.1, this.preset.springOmega)
    const stiffness = omega * omega
    const damping = 2 * omega

    this.carry += dt
    let guard = 0
    while (this.carry >= SOLVER_STEP_S && guard < 64) {
      const pull = (this.targetKmh - this.smoothedKmh) * stiffness
      const resist = this.springRate * damping
      this.springRate += (pull - resist) * SOLVER_STEP_S
      this.smoothedKmh = Math.max(0, this.smoothedKmh + this.springRate * SOLVER_STEP_S)
      this.carry -= SOLVER_STEP_S
      guard += 1
    }
    if (guard >= 64) this.carry = 0
  }

  /**
   * Une seule valeur non finie contamine toute la chaîne en une image et le son
   * se coupe sans message. On remet à zéro plutôt que de propager.
   */
  private guardAgainstNaN(): void {
    if (!Number.isFinite(this.smoothedKmh)) this.smoothedKmh = 0
    if (!Number.isFinite(this.springRate)) this.springRate = 0
    if (!Number.isFinite(this.targetKmh)) this.targetKmh = 0
    if (!Number.isFinite(this.accelMs2)) this.accelMs2 = 0
    if (!Number.isFinite(this.slopeKmhS)) this.slopeKmhS = 0
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}
