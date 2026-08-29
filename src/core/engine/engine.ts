import type { EnginePreset, MixPreset } from '../preset/schema'

/**
 * Moteur.
 *
 * Il traduit une vitesse et un rapport en régime, puis en deux grandeurs dont
 * l'audio a besoin : le régime lui-même, qui fixe la hauteur, et la charge, qui
 * arbitre le fondu entre les couches « en charge » et « pied levé ».
 *
 * La charge est le paramètre subtil. Dans une voiture électrique on ne dispose
 * pas de la position de la pédale : la seule information disponible est
 * l'accélération, dérivée du GPS. On s'en sert comme mesure d'effort — accélérer
 * franchement vaut pleine charge, ralentir vaut pied levé, et tenir une vitesse
 * stable se situe entre les deux. C'est une approximation, mais c'est celle qui
 * s'entend juste.
 */

export interface EngineState {
  /** Régime affiché et sonorisé, en tours par minute. */
  rpm: number
  /** Régime imposé par la vitesse et le rapport, avant inertie et rupteur. */
  kinematicRpm: number
  /** De 0 (pied levé) à 1 (pleine charge). Pilote le fondu on/off. */
  load: number
  /** Fraction du rupteur, de 0 à 1. */
  rpmFraction: number
  /** Fréquence d'allumage, en hertz. Diagnostic. */
  firingHz: number
  limiterActive: boolean
  /** Vrai quand le régime est tenu par le ralenti et non par les roues. */
  idling: boolean
}

export interface EngineInput {
  kmh: number
  accelMs2: number
  /** Rapport total, produit du rapport de boîte et du pont. */
  totalRatio: number
  wheelRadiusM: number
  atStandstill: boolean
  isShifting: boolean
  /**
   * Position de l'accélérateur, de 0 à 1, quand la source la connaît (simulateur).
   * En conduite réelle il n'y en a pas : passer `null` et la charge sera
   * entièrement déduite de l'accélération.
   */
  throttle: number | null
}

export class Engine {
  private rpm: number
  private load = 0
  private limiterCutRemainingS = 0
  private limiterActive = false

  constructor(
    private preset: EnginePreset,
    private mix: MixPreset,
  ) {
    this.rpm = preset.idleRpm
  }

  setPresets(preset: EnginePreset, mix: MixPreset): void {
    this.preset = preset
    this.mix = mix
  }

  reset(): void {
    this.rpm = this.preset.idleRpm
    this.load = 0
    this.limiterCutRemainingS = 0
    this.limiterActive = false
  }

  /** Régime qu'imposerait la vitesse dans un rapport total donné. */
  static kinematicRpm(kmh: number, totalRatio: number, wheelRadiusM: number): number {
    const wheelRps = kmh / 3.6 / (2 * Math.PI * Math.max(0.05, wheelRadiusM))
    return wheelRps * 60 * totalRatio
  }

  tick(dt: number, input: EngineInput): EngineState {
    const step = Math.max(0, Math.min(dt, 0.25))

    const kinematic = Engine.kinematicRpm(input.kmh, input.totalRatio, input.wheelRadiusM)
    const target = this.resolveTarget(kinematic, input)

    this.advanceRpm(step, target, input)
    this.advanceLoad(step, input)
    this.applyLimiter(step)

    const fraction = clamp(this.rpm / Math.max(1, this.preset.redlineRpm), 0, 1)

    return {
      rpm: this.rpm,
      kinematicRpm: kinematic,
      load: this.load,
      rpmFraction: fraction,
      firingHz: (this.rpm / 120) * this.preset.cylinders,
      limiterActive: this.limiterActive,
      idling: kinematic < this.preset.idleRpm,
    }
  }

  /**
   * Régime visé.
   *
   * À l'arrêt le moteur est découplé des roues : il retombe au ralenti, ou monte
   * librement si on donne des gaz — c'est ce qui permet un coup d'accélérateur à
   * l'arrêt. Pendant un passage de rapport le couple est coupé, donc le régime
   * chute vers le ralenti au lieu de suivre les roues.
   */
  private resolveTarget(kinematic: number, input: EngineInput): number {
    if (input.atStandstill) {
      const throttle = input.throttle ?? 0
      const free = this.preset.idleRpm + throttle * (this.preset.redlineRpm - this.preset.idleRpm)
      return Math.max(this.preset.idleRpm, free)
    }
    if (input.isShifting) {
      return Math.max(this.preset.idleRpm, kinematic * 0.72)
    }
    return Math.max(this.preset.idleRpm, kinematic)
  }

  /**
   * Le régime ne saute pas à sa cible : le volant moteur a de l'inertie. Deux
   * constantes distinctes, parce qu'un moteur monte plus vite qu'il ne redescend
   * quand il est libre — et l'inverse quand la roue l'entraîne.
   */
  private advanceRpm(dt: number, target: number, input: EngineInput): void {
    const coupled = !input.atStandstill && !input.isShifting
    const rate = target > this.rpm ? this.preset.freeRevRate : this.preset.engineBraking
    const inertia = Math.max(0.05, this.preset.inertia)

    if (coupled) {
      // Sous charge, la roue impose le régime : on suit vite, sans traîner.
      const followRate = clamp(dt * 18, 0, 1)
      this.rpm += (target - this.rpm) * followRate
    } else {
      const delta = (rate / inertia) * dt
      this.rpm =
        target > this.rpm
          ? Math.min(target, this.rpm + delta)
          : Math.max(target, this.rpm - delta)
    }

    this.rpm = clamp(this.rpm, 0, this.preset.redlineRpm)
    if (!Number.isFinite(this.rpm)) this.rpm = this.preset.idleRpm
  }

  /**
   * Charge.
   *
   * Quand la position de l'accélérateur est connue — au simulateur — elle fait
   * foi, seule. On y a longtemps mêlé l'accélération mesurée en prenant le plus
   * grand des deux, ce qui produisait un défaut net : au relâchement, la charge
   * restait tenue par une accélération que la fenêtre glissante d'une seconde
   * mettait tout ce temps à voir retomber. Le régime, lui, suit la vitesse et
   * réagit aussitôt — d'où un son qui traînait derrière l'image d'une seconde
   * environ, alors que la commande était relâchée depuis longtemps.
   *
   * En conduite réelle il n'y a pas de pédale, et l'accélération reste la seule
   * mesure d'effort disponible. Sa latence est alors inhérente au procédé, non
   * un défaut : elle se règle par la fenêtre et la raideur du lissage.
   */
  private advanceLoad(dt: number, input: EngineInput): void {
    let raw: number
    if (input.throttle === null) {
      const full = Math.max(0.1, this.mix.fullLoadAccelMs2)
      raw = clamp(input.accelMs2 / full, -1, 1) * 0.5 + 0.5
    } else {
      raw = clamp(input.throttle, 0, 1)
    }

    const tau = Math.max(0.01, this.mix.loadSmoothingS)
    this.load += (raw - this.load) * clamp(dt / tau, 0, 1)
    this.load = clamp(this.load, 0, 1)
  }

  /**
   * Rupteur : au-delà du seuil doux, l'allumage est coupé par intermittence.
   * C'est cette coupure hachée qui produit le crépitement caractéristique — un
   * simple plafonnement du régime ne s'entend pas.
   */
  private applyLimiter(dt: number): void {
    if (this.limiterCutRemainingS > 0) {
      this.limiterCutRemainingS = Math.max(0, this.limiterCutRemainingS - dt)
      this.limiterActive = this.limiterCutRemainingS > 0
      if (this.limiterActive) {
        this.rpm = Math.max(this.preset.softLimitRpm * 0.985, this.rpm - 400 * dt)
      }
      return
    }

    if (this.rpm >= this.preset.softLimitRpm) {
      this.limiterCutRemainingS = this.preset.limiterHoldMs / 1000
      this.limiterActive = this.limiterCutRemainingS > 0
    } else {
      this.limiterActive = false
    }
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}
