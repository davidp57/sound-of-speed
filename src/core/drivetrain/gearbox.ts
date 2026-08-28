import type { DrivetrainPreset, EnginePreset } from '../preset/schema'

/**
 * Boîte de vitesses.
 *
 * Elle ne transmet rien — elle choisit un rapport et déclare quand le couple est
 * coupé. Le régime en découle, il est calculé dans le module moteur.
 *
 * Le passage automatique tient sur une idée simple : une condition de montée
 * (le régime approche du rupteur) doit rester vraie pendant une temporisation
 * avant d'être appliquée. Cette temporisation diffère d'un rapport à l'autre,
 * volontairement : avec une valeur unique, la boîte sonne comme un métronome et
 * on entend tout de suite que c'est une machine qui décide.
 */

export type ShiftMode = 'auto' | 'manual'
export type ShiftDirection = 'up' | 'down' | null

/** Anti-rebond sur les commandes manuelles, en millisecondes. */
const MANUAL_DEBOUNCE_MS = 220

export interface GearboxState {
  /** Index du rapport engagé, 0 = premier. */
  gear: number
  /** Étiquette affichée : « N » à l'arrêt s'il y a plusieurs rapports. */
  label: string
  gearCount: number
  ratio: number
  mode: ShiftMode
  isShifting: boolean
  /** Progression du passage en cours, de 0 à 1. */
  shiftProgress: number
  shiftDirection: ShiftDirection
  /** Vrai quand la condition de montée est remplie mais la temporisation pas écoulée. */
  isShiftReady: boolean
}

export class Gearbox {
  private gear = 0
  private mode: ShiftMode = 'auto'
  private shiftRemainingS = 0
  private shiftDirection: ShiftDirection = null
  private readyForS = 0
  private lastManualAt = 0

  constructor(
    private drivetrain: DrivetrainPreset,
    private engine: EnginePreset,
  ) {}

  setPresets(drivetrain: DrivetrainPreset, engine: EnginePreset): void {
    this.drivetrain = drivetrain
    this.engine = engine
    this.gear = clampInt(this.gear, 0, this.gearCount - 1)
  }

  get gearCount(): number {
    return Math.max(1, this.drivetrain.gearRatios.length)
  }

  get hasGearbox(): boolean {
    return this.gearCount > 1
  }

  get ratio(): number {
    return this.drivetrain.gearRatios[this.gear] ?? 1
  }

  setMode(mode: ShiftMode): void {
    this.mode = mode
  }

  getMode(): ShiftMode {
    return this.mode
  }

  reset(): void {
    this.gear = 0
    this.shiftRemainingS = 0
    this.shiftDirection = null
    this.readyForS = 0
  }

  /**
   * Choisit d'emblée le rapport adapté à une vitesse, sans passer par la
   * séquence de passages. Utilisé au démarrage et après un changement de profil,
   * pour éviter de partir en première à 90 km/h.
   */
  settleFor(rpmInGear: (gear: number) => number): void {
    const ceiling = this.engine.redlineRpm * this.drivetrain.upshiftAtLowLoadRatio
    let chosen = 0
    for (let g = 0; g < this.gearCount; g += 1) {
      chosen = g
      if (rpmInGear(g) <= ceiling) break
    }
    this.gear = chosen
    this.shiftRemainingS = 0
    this.shiftDirection = null
    this.readyForS = 0
  }

  shiftUp(): boolean {
    const now = Date.now()
    if (now - this.lastManualAt < MANUAL_DEBOUNCE_MS) return false
    if (!this.hasGearbox || this.gear >= this.gearCount - 1 || this.shiftRemainingS > 0) {
      return false
    }
    this.lastManualAt = now
    this.applyShift(1)
    return true
  }

  shiftDown(): boolean {
    const now = Date.now()
    if (now - this.lastManualAt < MANUAL_DEBOUNCE_MS) return false
    if (!this.hasGearbox || this.gear <= 0 || this.shiftRemainingS > 0) return false
    this.lastManualAt = now
    this.applyShift(-1)
    return true
  }

  private applyShift(delta: number): void {
    this.gear = clampInt(this.gear + delta, 0, this.gearCount - 1)
    this.shiftRemainingS = this.drivetrain.shiftTimeMs / 1000
    this.shiftDirection = delta > 0 ? 'up' : 'down'
    this.readyForS = 0
  }

  /**
   * @param dt        Temps écoulé, en secondes.
   * @param rpmInGear Régime qu'aurait le moteur dans un rapport donné, à la
   *                  vitesse actuelle. Fourni par l'appelant pour éviter que la
   *                  boîte connaisse la géométrie des roues.
   * @param atStandstill Véhicule à l'arrêt.
   * @param load        Charge moteur, de 0 à 1. Décale le seuil de montée.
   */
  tick(
    dt: number,
    rpmInGear: (gear: number) => number,
    atStandstill: boolean,
    load: number,
  ): GearboxState {
    if (this.shiftRemainingS > 0) {
      this.shiftRemainingS = Math.max(0, this.shiftRemainingS - dt)
      if (this.shiftRemainingS === 0) this.shiftDirection = null
    }

    let ready = false

    if (this.mode === 'auto' && this.hasGearbox && this.shiftRemainingS === 0) {
      const rpm = rpmInGear(this.gear)
      // Le seuil de montée glisse avec la charge : au rupteur pied au plancher,
      // bien plus bas en charge partielle.
      const span =
        this.drivetrain.upshiftAtRedlineRatio - this.drivetrain.upshiftAtLowLoadRatio
      const ratio = this.drivetrain.upshiftAtLowLoadRatio + span * clamp01(load)
      const upThreshold = this.engine.redlineRpm * ratio
      const downThreshold = this.engine.redlineRpm * this.drivetrain.downshiftAtRedlineRatio

      if (rpm >= upThreshold && this.gear < this.gearCount - 1) {
        ready = true
        this.readyForS += dt
        const delay = this.drivetrain.shiftDelaysS[this.gear] ?? 0.8
        if (this.readyForS >= delay) this.applyShift(1)
      } else if (rpm <= downThreshold && this.gear > 0 && !atStandstill) {
        this.readyForS = 0
        this.applyShift(-1)
      } else {
        this.readyForS = 0
      }
    }

    if (atStandstill && this.mode === 'auto') this.gear = 0

    const shiftTotalS = Math.max(0.001, this.drivetrain.shiftTimeMs / 1000)

    return {
      gear: this.gear,
      label: atStandstill && this.hasGearbox ? 'N' : String(this.gear + 1),
      gearCount: this.gearCount,
      ratio: this.ratio,
      mode: this.mode,
      isShifting: this.shiftRemainingS > 0,
      shiftProgress: 1 - this.shiftRemainingS / shiftTotalS,
      shiftDirection: this.shiftDirection,
      isShiftReady: ready,
    }
  }
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

function clampInt(v: number, lo: number, hi: number): number {
  return Math.round(v < lo ? lo : v > hi ? hi : v)
}
