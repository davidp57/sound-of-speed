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

/**
 * Montée de charge qui vaut une demande franche.
 *
 * En conduite réelle il n'y a pas de pédale : la charge est déduite de
 * l'accélération. Son **niveau** ne dit donc pas « on demande fort » mais « on
 * accélère » — mesuré, le seuil de 0,75 se franchissait dès 1 m/s², soit
 * 3,6 km/h par seconde, et le rétrogradage tirait en permanence.
 *
 * Ce qui distingue « j'écrase » de « je remets délicatement les gaz », c'est la
 * **montée** : la pédale qui bouge.
 */
const KICKDOWN_RISE_LOAD = 0.35
/**
 * Fenêtre sur laquelle cette montée est mesurée, en secondes.
 *
 * Une seconde et demie, et ce n'est pas un choix esthétique : l'accélération
 * vient d'une pente estimée sur une seconde, une détection plus courte lirait
 * du bruit. Corollaire assumé — la détection est un peu en retard sur le pied.
 */
const KICKDOWN_RISE_WINDOW_S = 1.5
/** Délai minimal entre deux rétrogradages forcés, en secondes. */
const KICKDOWN_COOLDOWN_S = 3
/** Accélération au-delà de laquelle la vitesse n'est plus tenue, en m/s². */
const CRUISE_STEADY_ACCEL_MS2 = 0.3
/**
 * Fenêtre sur laquelle la dérive de vitesse est mesurée, en secondes.
 *
 * « Tenir une vitesse » se mesure sur la **vitesse**, pas sur sa dérivée. Cette
 * fenêtre est comparée par moitiés : l'écart entre la vitesse moyenne de la
 * seconde moitié et celle de la première, rapporté au temps qui les sépare,
 * donne une dérive en m/s² qu'on compare aux mêmes bornes qu'avant.
 *
 * C'est la moyenne qui fait le travail : le bruit d'une mesure isolée est divisé
 * par la racine du nombre d'images moyennées. L'accélération instantanée, elle,
 * est bruitée à un dixième de m/s² même une fois estimée proprement — soit
 * exactement la borne basse de la bande, si bien que le critère se décidait au
 * tirage au sort.
 *
 * Trois secondes, et la durée est **mesurée**. Sur douze minutes de vitesse
 * parfaitement tenue, à 25, 40, 60 et 90 km/h, avec un bruit de mesure de
 * ±1 km/h et la cadence rapide du GPS :
 *
 * - en jugeant sur l'accélération instantanée, quarante-six passages parasites ;
 * - sur une dérive mesurée sur deux secondes, quatre, dont deux descentes — donc
 *   encore des allers-retours ;
 * - sur trois secondes, aucun, et cela quelle que soit la fenêtre
 *   d'accélération réglée, de 200 à 2000 ms.
 *
 * Le coût est une latence : un ralentissement est vu en une seconde et demie au
 * lieu d'être vu tout de suite. C'est sans conséquence ici — ce critère décide
 * d'une montée en croisière, qui attend de toute façon deux secondes de
 * stabilité, et le freinage franc a son propre chemin, immédiat.
 */
const CRUISE_WINDOW_S = 3
/**
 * Décélération au-delà de laquelle la vitesse n'est plus tenue, en m/s².
 *
 * Bien plus serrée que du côté de l'accélération, et ce n'est pas une
 * coquetterie : une bande symétrique faisait passer un ralentissement doux —
 * 1 km/h par seconde — pour une croisière. La descente au régime s'en trouvait
 * suspendue, si bien qu'on gardait le dernier rapport jusqu'à l'arrêt, puis
 * qu'on passait tous les rapports d'un coup au premier freinage franc.
 *
 * Tenir une vitesse, c'est ne pas la perdre. Un dixième de m/s² laisse passer le
 * tremblement de la mesure, pas un ralentissement.
 */
const CRUISE_DECEL_LIMIT_MS2 = 0.1
/**
 * Délai après une descente avant qu'une montée en croisière soit permise, en
 * secondes.
 *
 * Sans lui, une accélération qui tremble autour de la bande fait alterner
 * descente et montée à quelques secondes d'intervalle — le va-et-vient qu'on
 * entend entre deux rapports voisins.
 */
const CRUISE_AFTER_DOWNSHIFT_S = 4
/**
 * Durée hors bande tolérée avant de considérer la croisière rompue, en secondes.
 *
 * L'accélération vient d'une dérivée du GPS : elle tremble. Sans cette
 * tolérance, une seule image en dehors de la bande remettait le compte à zéro,
 * et la montée en croisière ne se déclenchait jamais en conduite réelle —
 * mesuré, un tremblement de 0,25 m/s² suffisait à l'empêcher tout à fait.
 *
 * Elle ne rouvre pas le défaut qu'elle côtoie : un ralentissement, lui, sort de
 * la bande et **y reste**.
 */
const CRUISE_BAND_GRACE_S = 0.4
/** Durée de décélération soutenue avant de descendre, en secondes. */
const BRAKE_HOLD_S = 1
/**
 * Plafond absolu du rapport visé par une descente au freinage, en fraction du
 * rupteur.
 *
 * Il ne sert que de garde-fou : le plafond utile est le **seuil de montée** du
 * rapport visé, que le profil règle déjà rapport par rapport. Descendre au-delà
 * mettrait le moteur au-dessus de son propre point de passage — mesuré, une
 * descente en deuxième à 98 km/h plaçait le moteur à 7232 tr/min, au ras du
 * rupteur, et il y restait jusqu'à l'arrêt.
 */
const BRAKE_DOWNSHIFT_CEILING = 0.85

/**
 * Ce que la boîte a besoin de savoir pour décider.
 *
 * Un objet plutôt que des paramètres positionnels : ils étaient cinq, l'ajout de
 * l'accélération en aurait fait six, et l'appel devenait indéchiffrable. Le
 * moteur a le même arrangement avec `EngineInput`.
 */
export interface GearboxInput {
  /**
   * Régime qu'aurait le moteur dans un rapport donné, à la vitesse actuelle.
   * Fourni par l'appelant pour éviter que la boîte connaisse la géométrie des
   * roues.
   */
  rpmInGear: (gear: number) => number
  atStandstill: boolean
  /** Charge moteur, de 0 à 1. Décale le seuil de montée. */
  load: number
  /** Vitesse, pour le traitement particulier de la première. */
  kmh: number
  /**
   * Accélération lissée, en m/s², positive en accélération.
   *
   * C'est elle qui distingue une reprise franche d'une reprise douce, une
   * croisière stabilisée d'une accélération, et un freinage d'un simple lever de
   * pied — trois choses qu'un seuil de régime ne peut pas voir.
   */
  accelMs2: number
}

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
  /** Horloge interne, en secondes. Sert à dater l'historique de charge. */
  private elapsedS = 0
  /** Charges récentes, pour mesurer la montée sur la fenêtre déclarée. */
  private loadHistory: { at: number; load: number }[] = []
  private currentLoad = 0
  /** Temps depuis le dernier rétrogradage forcé, en secondes. */
  private sinceKickdownS = Number.POSITIVE_INFINITY
  /** Durée pendant laquelle la vitesse est restée stable, en secondes. */
  private steadyForS = 0
  /** Durée pendant laquelle la décélération est restée soutenue, en secondes. */
  private brakingForS = 0
  /** Temps depuis la dernière descente, en secondes. */
  private sinceDownshiftS = Number.POSITIVE_INFINITY
  /** Durée passée hors de la bande de croisière, en secondes. */
  private outOfBandForS = 0
  /** Vitesses récentes, pour mesurer la dérive sur la fenêtre déclarée. */
  private speedHistory: { at: number; kmh: number }[] = []

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
    this.loadHistory = []
    this.currentLoad = 0
    this.elapsedS = 0
    this.sinceKickdownS = Number.POSITIVE_INFINITY
    this.steadyForS = 0
    this.brakingForS = 0
    this.sinceDownshiftS = Number.POSITIVE_INFINITY
    this.outOfBandForS = 0
    this.speedHistory = []
  }

  /**
   * Montée de charge sur la fenêtre déclarée.
   *
   * La comparaison se fait à la mesure **la plus récente qui soit assez
   * ancienne**, et non à la plus ancienne de l'historique : cette confusion a
   * coûté au conditionnement du signal une fenêtre de seize secondes là où elle
   * en annonçait une, et un régime qui restait trop haut une quinzaine de
   * secondes. On ne la refait pas ici.
   */
  private loadRise(): number {
    for (let i = this.loadHistory.length - 1; i >= 0; i -= 1) {
      const entry = this.loadHistory[i]
      if (entry && this.elapsedS - entry.at >= KICKDOWN_RISE_WINDOW_S) {
        return this.currentLoad - entry.load
      }
    }
    // Pas encore assez d'historique : aucune montée établie, donc aucune
    // demande franche. Le rétrogradage forcé attend, ce qui vaut mieux qu'un
    // déclenchement sur une fenêtre incomplète.
    return 0
  }

  /** Retient la vitesse courante, en ne gardant que la fenêtre déclarée. */
  private recordSpeed(kmh: number): void {
    this.speedHistory.push({ at: this.elapsedS, kmh })
    const limite = this.elapsedS - CRUISE_WINDOW_S
    while (this.speedHistory.length > 1 && (this.speedHistory[0]?.at ?? 0) < limite) {
      this.speedHistory.shift()
    }
  }

  /**
   * Dérive de la vitesse sur la fenêtre, en m/s².
   *
   * La fenêtre est comparée par moitiés plutôt que par ses deux extrémités : une
   * moyenne divise le bruit, deux mesures isolées l'additionnent. Rendue en m/s²
   * pour se comparer aux bornes de la bande, qui sont des accélérations et qui
   * n'ont pas bougé — c'est la façon de les mesurer qui change.
   *
   * Rend `null` tant que la fenêtre n'est pas assez remplie pour que la
   * comparaison ait un sens, et la vitesse n'est alors **pas** tenue : on ne peut
   * pas affirmer qu'une allure se maintient avant de l'avoir observée. Rendre
   * zéro, comme on l'a d'abord fait, revenait à l'affirmer — et la boîte montait
   * un rapport dans les deux secondes suivant un démarrage ou un changement de
   * profil, sans rien avoir constaté.
   */
  private speedDriftMs2(): number | null {
    const points = this.speedHistory
    const oldest = points[0]
    if (!oldest) return null
    const span = this.elapsedS - oldest.at
    if (span < CRUISE_WINDOW_S * 0.5) return null

    const milieu = oldest.at + span / 2
    let sommeAvant = 0
    let nAvant = 0
    let sommeApres = 0
    let nApres = 0
    for (const point of points) {
      if (point.at < milieu) {
        sommeAvant += point.kmh
        nAvant += 1
      } else {
        sommeApres += point.kmh
        nApres += 1
      }
    }
    if (nAvant === 0 || nApres === 0) return null

    // Les deux moyennes sont séparées par la moitié de la fenêtre : c'est cette
    // durée qui convertit un écart de vitesse en accélération.
    const ecartKmh = sommeApres / nApres - sommeAvant / nAvant
    return ecartKmh / (span / 2) / 3.6
  }

  /** Retient la charge courante, en ne gardant que le double de la fenêtre. */
  private recordLoad(load: number): void {
    this.currentLoad = load
    this.loadHistory.push({ at: this.elapsedS, load })
    const limite = this.elapsedS - KICKDOWN_RISE_WINDOW_S * 2
    while (this.loadHistory.length > 1 && (this.loadHistory[0]?.at ?? 0) < limite) {
      this.loadHistory.shift()
    }
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
    if (delta < 0) this.sinceDownshiftS = 0
    this.gear = clampInt(this.gear + delta, 0, this.gearCount - 1)
    this.shiftRemainingS = this.drivetrain.shiftTimeMs / 1000
    this.shiftDirection = delta > 0 ? 'up' : 'down'
    this.readyForS = 0
  }

  /**
   * @param dt    Temps écoulé, en secondes.
   * @param input Ce que la boîte observe — voir `GearboxInput`.
   */
  tick(dt: number, input: GearboxInput): GearboxState {
    const { rpmInGear, atStandstill, load, kmh, accelMs2 } = input

    if (this.shiftRemainingS > 0) {
      this.shiftRemainingS = Math.max(0, this.shiftRemainingS - dt)
      if (this.shiftRemainingS === 0) this.shiftDirection = null
    }

    // Ce que la boîte lit de l'évolution de la vitesse. Trois durées
    // accumulées plutôt que trois instantanés : une boîte ne décide pas sur une
    // image, elle décide sur une tendance.
    this.elapsedS += dt
    this.recordLoad(load)
    this.recordSpeed(kmh)
    this.sinceKickdownS += dt
    this.sinceDownshiftS += dt
    // Tenir une vitesse, c'est ne pas la perdre : la bande est asymétrique.
    //
    // Elle se juge sur la dérive de la vitesse, et non sur l'accélération
    // instantanée : celle-ci est bruitée à un dixième de m/s² une fois estimée
    // au mieux, soit la borne basse de la bande elle-même.
    const drift = this.speedDriftMs2()
    const inBand =
      drift !== null && drift <= CRUISE_STEADY_ACCEL_MS2 && drift >= -CRUISE_DECEL_LIMIT_MS2
    this.outOfBandForS = inBand ? 0 : this.outOfBandForS + dt
    // Une sortie brève est du tremblement de mesure, pas un changement
    // d'allure : le compte de stabilité ne repart à zéro qu'au bout d'un
    // moment dehors.
    const held = this.outOfBandForS < CRUISE_BAND_GRACE_S
    this.steadyForS = held ? this.steadyForS + dt : 0
    this.brakingForS =
      accelMs2 <= this.drivetrain.brakeDownshiftAccelMs2 ? this.brakingForS + dt : 0

    // Deux notions distinctes, et les confondre suffit à faire le yoyo.
    //
    // `steadyNow` dit que la vitesse est tenue **à cet instant** : c'est lui
    // qui suspend la descente au régime, et il doit rester vrai pendant toute
    // la croisière. `steadyLongEnough` dit qu'elle l'est depuis assez longtemps
    // pour tenter un rapport de plus ; il repart à zéro après chaque montée,
    // pour que la cascade se fasse palier par palier, et attend aussi qu'aucune
    // descente ne soit trop récente.
    //
    // En les confondant, chaque montée réarmait la descente au régime dans la
    // seconde — le rapport atteint tournant précisément sous ce seuil — et la
    // boîte oscillait indéfiniment.
    const steadyNow = held
    const steadyLongEnough =
      this.steadyForS >= this.drivetrain.cruiseUpshiftAfterS &&
      this.sinceDownshiftS >= CRUISE_AFTER_DOWNSHIFT_S
    const braking = this.brakingForS >= BRAKE_HOLD_S

    let ready = false
    let blocked = false
    let upThresholdSeen = this.upshiftThreshold(this.gear, load)
    const downThresholdSeen = this.engine.redlineRpm * this.drivetrain.downshiftAtRedlineRatio
    const auto = this.mode === 'auto' && this.hasGearbox && this.shiftRemainingS === 0

    // La première n'est qu'une amorce : passé la vitesse de lancement, elle cède
    // la place sans attendre le moindre seuil de régime.
    if (
      auto &&
      this.drivetrain.firstGearLaunchOnly &&
      this.gear === 0 &&
      kmh >= this.drivetrain.launchUpshiftKmh
    ) {
      this.applyShift(1)
      return this.report(atStandstill, false, false, upThresholdSeen, downThresholdSeen)
    }

    // Le rétrogradage forcé passe avant tout le reste : c'est une demande
    // explicite du conducteur, pas une décision de la boîte.
    //
    // Ce qui le déclenche est la **montée** de charge et non son niveau. Le
    // niveau seul ne distinguait pas « j'écrase » de « je remets délicatement
    // les gaz » : faute de pédale, la charge est déduite de l'accélération, et
    // le seuil se franchissait dès 3,6 km/h par seconde.
    if (auto && this.feel.kickdown.enabled && !atStandstill) {
      const threshold = this.feel.kickdown.loadThreshold
      if (load < threshold * 0.7) this.kickdownArmed = true
      else if (
        this.kickdownArmed &&
        load >= threshold &&
        this.loadRise() >= KICKDOWN_RISE_LOAD &&
        this.sinceKickdownS >= KICKDOWN_COOLDOWN_S
      ) {
        const dropped = this.kickdown(rpmInGear)
        if (dropped > 0) {
          this.kickdownArmed = false
          this.lastKickdown = dropped
          this.sinceKickdownS = 0
          this.steadyForS = 0
          return this.report(atStandstill, false, false, upThresholdSeen, downThresholdSeen)
        }
        this.kickdownArmed = false
      }
    }

    // Descente au ralentissement : le rétrogradage sert aussi à ralentir, et
    // c'était la moitié manquante de son métier. Un seul seuil de régime
    // décidait, le même qu'on lève le pied doucement ou qu'on freine fort.
    if (
      auto &&
      braking &&
      !atStandstill &&
      this.gear > this.downshiftFloor() &&
      // Les descentes au freinage s'espacent par le temps écoulé depuis la
      // dernière, et **non** en remettant à zéro le compteur de freinage :
      // celui-ci sert aussi à inhiber la montée, et le remettre à zéro levait
      // cette inhibition pendant une seconde — juste assez pour que la boîte
      // remonte le rapport qu'elle venait de descendre. Un compteur, un usage.
      this.sinceDownshiftS >= BRAKE_HOLD_S
    ) {
      const candidate = rpmInGear(this.gear - 1)
      // Le plafond utile est le seuil de montée du rapport visé : c'est la
      // notion qu'a le profil du haut de sa plage, réglée rapport par rapport.
      // Le rupteur ne sert que de garde-fou absolu.
      const ceiling = Math.min(
        this.engine.redlineRpm * BRAKE_DOWNSHIFT_CEILING,
        this.upshiftThreshold(this.gear - 1, load),
      )
      if (candidate <= ceiling) {
        this.readyForS = 0
        this.applyShift(-1)
        return this.report(atStandstill, false, false, upThresholdSeen, downThresholdSeen)
      }
    }

    if (auto) {
      const rpm = rpmInGear(this.gear)
      const upThreshold = upThresholdSeen

      // On ne monte pas pendant qu'on freine. Sans cette inhibition, la
      // descente au freinage était défaite aussitôt par la montée au régime —
      // elle descend dans un rapport dont le régime dépasse son propre seuil de
      // montée — et la boîte faisait le va-et-vient tous les trois km/h. Une
      // vraie boîte tient son rapport tant que le pied est sur le frein.
      if (!braking && rpm >= upThreshold && this.gear < this.gearCount - 1) {
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
        this.gear > this.downshiftFloor() &&
        !atStandstill &&
        // Suspendue en croisière : la 4e à 50 km/h tourne à 1532 tr/min, sous
        // ce seuil, et la boîte ferait le yoyo avec la montée en croisière.
        // Cette règle existe pour éviter de brouter ; le plancher de croisière
        // garantit précisément qu'on ne broute pas.
        !steadyNow &&
        // Garde contre le va-et-vient : rétrograder n'a de sens que si le régime
        // obtenu ne franchit pas aussitôt le seuil de montée du rapport visé,
        // ce qui ferait remonter dans la foulée. La marge évite de s'arrêter
        // pile sur le seuil, où le moindre tremblement relancerait le cycle.
        rpmInGear(this.gear - 1) < this.upshiftThreshold(this.gear - 1, load) * 0.98
      ) {
        this.readyForS = 0
        this.applyShift(-1)
      } else {
        if (rpm <= downThresholdSeen && this.gear > 0 && !atStandstill && !steadyNow) {
          blocked = true
        }
        this.readyForS = 0

        // Montée en croisière : la seule raison de monter qui ne regarde pas le
        // régime. Sans elle, un palier figeait le rapport où l'on était — 50 km/h
        // tenus laissaient la 2e à 3034 tr/min quand la 4e donnait 1532.
        //
        // Un rapport à la fois : la cascade se fait d'elle-même, palier par
        // palier, et chaque étape est jugée sur son propre régime.
        if (
          steadyLongEnough &&
          this.shiftRemainingS === 0 &&
          this.gear < this.gearCount - 1 &&
          !atStandstill &&
          rpmInGear(this.gear + 1) >= this.drivetrain.cruiseMinRpm
        ) {
          this.steadyForS = 0
          this.applyShift(1)
        }
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
  /**
   * Rapport le plus bas qu'une descente automatique puisse engager.
   *
   * Quand la première n'est qu'une amorce de lancement, elle ne se réengage pas
   * en roulant : on ne redescend pas en dessous de la deuxième.
   */
  private downshiftFloor(): number {
    return this.drivetrain.firstGearLaunchOnly ? 1 : 0
  }

  private kickdown(rpmInGear: (gear: number) => number): number {
    const target = this.engine.redlineRpm * this.feel.kickdown.targetRpmFraction
    const ceiling = this.engine.redlineRpm * 0.95
    let dropped = 0

    const floor = this.downshiftFloor()
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
