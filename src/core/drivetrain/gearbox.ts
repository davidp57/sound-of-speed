import type { DrivetrainPreset, EnginePreset, FeelPreset } from '../preset/schema'

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

/**
 * Dépassement toléré au-dessus du régime de passage, en tours par minute.
 *
 * La temporisation sert à confirmer une intention, pas à laisser filer le
 * régime : sous forte accélération, une demi-seconde d'attente suffit à monter
 * de plus de mille cinq cents tours, et le rapport finissait par passer très
 * au-dessus de la valeur réglée — un curseur qui ne tient pas sa promesse.
 * Passé cette marge, on passe sans attendre.
 */
const UPSHIFT_OVERSHOOT_RPM = 400

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
  /** Régime auquel le rapport engagé cédera la place au suivant. Diagnostic. */
  upshiftThresholdRpm: number
  /** Régime sous lequel la boîte cherchera à rétrograder. Diagnostic. */
  downshiftThresholdRpm: number
  /** Vrai si le rétrogradage est retenu par la garde anti-va-et-vient. */
  downshiftBlocked: boolean
  /** Nombre de rapports descendus par le dernier rétrogradage forcé. */
  kickdownGears: number
}

export class Gearbox {
  private gear = 0
  private mode: ShiftMode = 'auto'
  private shiftRemainingS = 0
  private shiftDirection: ShiftDirection = null
  private readyForS = 0
  private lastManualAt = 0
  /**
   * Écart tiré au sort pour le passage en préparation, en tours par minute.
   *
   * Il est tiré une fois lorsque la condition devient vraie, et non à chaque
   * image : autrement le seuil tremblerait soixante fois par seconde et la
   * dispersion se moyennerait à zéro, sans rien changer à ce qu'on entend.
   */
  private pendingJitter = 0
  /** Rapports descendus par le dernier rétrogradage forcé, pour la télémétrie. */
  private lastKickdown = 0
  /** Empêche un second rétrogradage forcé tant que la pédale reste enfoncée. */
  private kickdownArmed = true

  constructor(
    private drivetrain: DrivetrainPreset,
    private engine: EnginePreset,
    private feel: FeelPreset,
  ) {}

  setPresets(drivetrain: DrivetrainPreset, engine: EnginePreset, feel: FeelPreset): void {
    this.drivetrain = drivetrain
    this.engine = engine
    this.feel = feel
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
   * Régime auquel ce rapport doit céder la place au suivant.
   *
   * La valeur du profil vaut à charge moyenne ; l'effort demandé la décale de
   * part et d'autre, et le tirage au sort en cours l'écarte un peu plus.
   */
  private upshiftThreshold(gear: number, load: number): number {
    const table = this.drivetrain.upshiftRpm
    // Le dernier rapport connu sert de repli quand la table est plus courte que
    // la boîte, ce qui arrive dès qu'on ajoute un rapport sans y toucher.
    const base = table[gear] ?? table[table.length - 1] ?? this.engine.redlineRpm * 0.8
    const spread = this.drivetrain.upshiftLoadSpreadRpm
    const shifted = base + (clamp01(load) - 0.5) * spread + this.pendingJitter
    // Le plancher prime : mieux vaut garder un rapport court qu'en engager un
    // long à un régime où le moteur peinerait.
    const floored = Math.max(shifted, this.drivetrain.minUpshiftRpm)
    return clamp(floored, this.engine.idleRpm * 1.2, this.engine.redlineRpm)
  }

  /**
   * Choisit d'emblée le rapport adapté à une vitesse, sans passer par la
   * séquence de passages. Utilisé au démarrage et après un changement de profil,
   * pour éviter de partir en première à 90 km/h.
   */
  settleFor(rpmInGear: (gear: number) => number): void {
    let chosen = 0
    for (let g = 0; g < this.gearCount; g += 1) {
      chosen = g
      // Charge nulle : on retient le rapport le plus long qui convienne, comme
      // le ferait une reprise en douceur.
      if (rpmInGear(g) <= this.upshiftThreshold(g, 0)) break
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
   * @param kmh         Vitesse, pour le traitement particulier de la première.
   */
  tick(
    dt: number,
    rpmInGear: (gear: number) => number,
    atStandstill: boolean,
    load: number,
    kmh: number,
  ): GearboxState {
    if (this.shiftRemainingS > 0) {
      this.shiftRemainingS = Math.max(0, this.shiftRemainingS - dt)
      if (this.shiftRemainingS === 0) this.shiftDirection = null
    }

    let ready = false
    let blocked = false
    let upThresholdSeen = this.upshiftThreshold(this.gear, load)
    const downThresholdSeen = this.engine.redlineRpm * this.drivetrain.downshiftAtRedlineRatio

    // La première n'est qu'une amorce : passé la vitesse de lancement, elle cède
    // la place sans attendre le moindre seuil de régime.
    if (
      this.mode === 'auto' &&
      this.hasGearbox &&
      this.shiftRemainingS === 0 &&
      this.drivetrain.firstGearLaunchOnly &&
      this.gear === 0 &&
      kmh >= this.drivetrain.launchUpshiftKmh
    ) {
      this.applyShift(1)
      return this.report(atStandstill, false, false, upThresholdSeen, downThresholdSeen)
    }

    // Le rétrogradage forcé passe avant tout le reste : c'est une demande
    // explicite du conducteur, pas une décision de la boîte.
    if (
      this.mode === 'auto' &&
      this.hasGearbox &&
      this.shiftRemainingS === 0 &&
      this.feel.kickdown.enabled &&
      !atStandstill
    ) {
      if (load < this.feel.kickdown.loadThreshold * 0.7) this.kickdownArmed = true
      else if (this.kickdownArmed && load >= this.feel.kickdown.loadThreshold) {
        const dropped = this.kickdown(rpmInGear)
        if (dropped > 0) {
          this.kickdownArmed = false
          this.lastKickdown = dropped
          return this.report(atStandstill, false, false, upThresholdSeen, downThresholdSeen)
        }
        this.kickdownArmed = false
      }
    }

    if (this.mode === 'auto' && this.hasGearbox && this.shiftRemainingS === 0) {
      const rpm = rpmInGear(this.gear)
      const upThreshold = upThresholdSeen

      if (rpm >= upThreshold && this.gear < this.gearCount - 1) {
        if (this.readyForS === 0) {
          // Nouvelle intention de passer : on tire l'écart de ce passage-ci.
          this.pendingJitter = (Math.random() * 2 - 1) * this.drivetrain.upshiftJitterRpm
        }
        ready = true
        this.readyForS += dt
        const delay = this.drivetrain.shiftDelaysS[this.gear] ?? 0.8
        const overshot = rpm >= upThreshold + UPSHIFT_OVERSHOOT_RPM
        if (this.readyForS >= delay || overshot) this.applyShift(1)
      } else if (
        rpm <= downThresholdSeen &&
        this.gear > (this.drivetrain.firstGearLaunchOnly ? 1 : 0) &&
        !atStandstill &&
        // Garde contre le va-et-vient : rétrograder n'a de sens que si le régime
        // obtenu ne franchit pas aussitôt le seuil de montée du rapport visé,
        // ce qui ferait remonter dans la foulée. La marge évite de s'arrêter
        // pile sur le seuil, où le moindre tremblement relancerait le cycle.
        rpmInGear(this.gear - 1) < this.upshiftThreshold(this.gear - 1, load) * 0.98
      ) {
        this.readyForS = 0
        this.applyShift(-1)
      } else {
        if (rpm <= downThresholdSeen && this.gear > 0 && !atStandstill) blocked = true
        this.readyForS = 0
      }
      upThresholdSeen = upThreshold
    }

    if (atStandstill && this.mode === 'auto') this.gear = 0

    return this.report(atStandstill, ready, blocked, upThresholdSeen, downThresholdSeen)
  }

  /**
   * Rétrogradage forcé.
   *
   * On descend tant que le rapport atteint reste sous le rupteur et que le
   * régime visé n'est pas déjà obtenu — exactement ce que fait une boîte quand on
   * demande de la reprise : aller chercher le couple là où il est, plutôt que
   * d'attendre son seuil de passage.
   */
  private kickdown(rpmInGear: (gear: number) => number): number {
    const target = this.engine.redlineRpm * this.feel.kickdown.targetRpmFraction
    const ceiling = this.engine.redlineRpm * 0.95
    let dropped = 0

    const floor = this.drivetrain.firstGearLaunchOnly ? 1 : 0
    while (dropped < this.feel.kickdown.maxGears && this.gear > floor) {
      if (rpmInGear(this.gear) >= target) break
      const candidate = rpmInGear(this.gear - 1)
      if (candidate > ceiling) break
      this.gear -= 1
      dropped += 1
      if (candidate >= target) break
    }

    if (dropped > 0) {
      this.shiftRemainingS = this.drivetrain.shiftTimeMs / 1000
      this.shiftDirection = 'down'
      this.readyForS = 0
    }
    return dropped
  }

  private report(
    atStandstill: boolean,
    ready: boolean,
    blocked: boolean,
    upThreshold: number,
    downThreshold: number,
  ): GearboxState {
    const shiftTotalS = Math.max(0.001, this.drivetrain.shiftTimeMs / 1000)
    const kickdownGears = this.lastKickdown
    if (this.shiftRemainingS === 0) this.lastKickdown = 0

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
      upshiftThresholdRpm: upThreshold,
      downshiftThresholdRpm: downThreshold,
      downshiftBlocked: blocked,
      kickdownGears,
    }
  }
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

function clampInt(v: number, lo: number, hi: number): number {
  return Math.round(v < lo ? lo : v > hi ? hi : v)
}
