import type { DrivetrainPreset, EnginePreset, FeelPreset } from '../preset/schema'
import {
  downshiftFloorRpm,
  kickdownLoadFor,
  upshiftFloorRpm,
  FIRST_UPSHIFT_FLOOR_RPM,
  type DriveMode,
} from './drive-mode'

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
 *
 * **Sous accélération seulement, et c'est le sens de la règle.** Le seuil se
 * décale de seize cents tours avec la charge : pied au plancher il est haut, et
 * il s'effondre en une demi-seconde quand on relâche, bien plus vite que le
 * régime ne descend. Le dépassement était alors franchi non parce que le moteur
 * montait, mais parce que la barre était tombée — et le passage se faisait sans
 * attendre. David : « accélération jusqu'à 4800 tr/min en 4e, arrêt de
 * l'accélération, le simu passe la 5 et la 6 ». Deux fois, puisque le rapport
 * suivant voit son propre seuil effondré de la même façon.
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

/**
 * Décélération à partir de laquelle on considère que la voiture ralentit
 * vraiment, en m/s², et durée qu'il faut la tenir pour interdire une montée.
 *
 * La bande de croisière regarde la **dérive** de la vitesse sur trois secondes,
 * ce qui la rend robuste au bruit mais lente : quand on lève le pied après une
 * longue croisière, la stabilité est déjà acquise et la dérive met plus d'une
 * seconde à voir le ralentissement. La boîte a le temps de monter un rapport de
 * plus — mesuré : un passage du quatrième au cinquième une seconde après le
 * lever de pied, sur une perte de 0,5 km/h par seconde.
 *
 * L'accélération instantanée, elle, le sait tout de suite, mais elle est bruitée
 * à un dixième de m/s². On la cumule donc : le compteur monte pendant qu'on
 * ralentit et redescend deux fois plus vite sinon, si bien qu'une croisière qui
 * tremble autour de zéro ne l'atteint jamais et qu'un vrai ralentissement le
 * franchit en un tiers de seconde.
 *
 * Ce délai s'ajoute à la durée du passage lui-même : une montée décidée juste
 * avant un lever de pied s'engage quand même, et son coup de gaz tombe six
 * dixièmes de seconde plus tard, alors que la voiture ralentit déjà. C'est
 * pourquoi le seuil est court — et pourquoi, en montée, le coup de gaz suit
 * l'effort du moment plutôt que le réglage seul.
 */
const CRUISE_SLOWING_MS2 = 0.05
const CRUISE_SLOWING_HOLD_S = 0.35

/**
 * Plafond du compteur de ralentissement, en secondes.
 *
 * Le compteur ne sert qu'à franchir `CRUISE_SLOWING_HOLD_S` : au-delà, chaque
 * seconde de plus n'ajoute rien à la décision et ne fait qu'allonger le temps
 * qu'il faudra pour la défaire. Sans plafond il devient une dette.
 *
 * Relevé en roulant le 11 septembre 2026 : après quarante-quatre minutes de
 * stationnement, il valait **2 706 secondes** pour un seuil de 0,35. La page en
 * veille bat au ralenti — jusqu'à vingt secondes par tour — et le conditionneur
 * prêtait alors à une voiture immobile une décélération de trois dixièmes ;
 * chaque tour versait donc vingt secondes au compteur. Il décroît deux fois
 * plus vite qu'il ne monte, mais rendre 2 706 secondes demandait vingt-deux
 * minutes d'accélération continue : l'inhibition de montée ne retombait jamais.
 * La boîte a tenu la deuxième de 22 à 108 km/h, jusqu'au rupteur, et n'a plus
 * passé un seul rapport de tout le trajet.
 *
 * Trois fois le seuil laisse la marge utile — une croisière bruitée n'y arrive
 * pas — et se rend en un peu plus d'une demi-seconde.
 */
const SLOWING_CEILING_S = CRUISE_SLOWING_HOLD_S * 3

/**
 * Décélération au-delà de laquelle on ne cumule plus rien : on ralentit, point.
 *
 * Le cumul existe pour ne pas confondre le bruit de la mesure avec un
 * ralentissement, et un dixième de m/s² est bien dans ce bruit. Un demi-m/s²
 * ne l'est pas — la traînée du simulateur en donne déjà 1,4 à cent kilomètres à
 * l'heure. Attendre un tiers de seconde de plus n'apporte alors aucune
 * certitude et laisse le temps à un passage de se déclencher.
 */
const CLEARLY_SLOWING_MS2 = 0.5

/**
 * Vitesse à laquelle la demande retombe vers la charge, par seconde.
 *
 * La **demande** est ce que le seuil de montée devrait regarder, et ce n'est pas
 * la charge de l'instant. Le seuil se décale de `upshiftLoadSpreadRpm` — seize
 * cents tours sur Route — pour distinguer une conduite tranquille, qui monte tôt
 * sur un rapport long, d'une accélération franche qui étire chaque rapport.
 * C'est l'**intention** du conducteur qu'il attend ; sur une vraie automatique,
 * c'est la position de la pédale.
 *
 * Faute de pédale, la charge se déduit de l'accélération, c'est-à-dire du
 * **résultat**. Deux conséquences, et David les a toutes deux relevées : « les
 * rapports montent plus tôt quand on accélère moins, et plus tard après un
 * kickdown ». En côte, pied au plancher, l'accélération est faible : la charge
 * tombe, le seuil descend de huit cents tours et la boîte monte tôt — exactement
 * l'inverse de ce qu'il faudrait. Et au lever de pied, la charge s'effondre en
 * une demi-seconde, donc le seuil passe sous le régime sans que le moteur ait
 * bougé.
 *
 * La demande monte instantanément avec la charge et n'en redescend qu'à cette
 * vitesse-là : trois secondes pour revenir de la pleine charge au pied levé.
 * Une accélération franche garde donc ses rapports longs quelques secondes après
 * qu'on a relâché, ce qui est le comportement d'une boîte qui a compris qu'on
 * conduisait vite. Et le seuil ne peut plus tomber d'un coup sous le régime :
 * au plus quelque cinq cents tours par seconde, sur le profil Route.
 *
 * Quatre gardes avaient été posées en aval avant de traiter cette cause-là.
 * Trois dépendaient du moment où l'accélération mesurée devient franchement
 * négative — or elle est lissée quand la charge ne l'est presque pas, si bien
 * qu'elles arrivaient après. La quatrième freinait la descente du seuil ; la
 * demande la remplace, en disant *pourquoi* il ne doit pas descendre.
 */
const DEMAND_FALL_PER_S = 1 / 3
/** Durée de décélération soutenue avant de descendre, en secondes. */
const BRAKE_HOLD_S = 1

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
  /**
   * Seuil de montée effectivement appliqué, freiné à la descente.
   *
   * `null` tant qu'aucun n'a été calculé, et remis à `null` à chaque changement
   * de rapport : le seuil du rapport précédent n'a rien à dire du nouveau.
   */
  /**
   * Demande du conducteur, de 0 à 1 : la charge, mais qui ne retombe que
   * lentement. Voir `DEMAND_FALL_PER_S`.
   */
  private demand = 0
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
  /**
   * Temps cumulé passé à ralentir, en secondes, moins ce qui a été rendu.
   *
   * Ce n'est pas une durée continue : elle décroît deux fois plus vite qu'elle
   * ne monte, pour qu'une croisière bruitée ne la fasse jamais franchir le seuil.
   */
  private slowingForS = 0
  /** Durée pendant laquelle la décélération est restée soutenue, en secondes. */
  private brakingForS = 0
  /** Temps depuis la dernière descente, en secondes. */
  private sinceDownshiftS = Number.POSITIVE_INFINITY
  /** Durée passée hors de la bande de croisière, en secondes. */
  /** Vitesses récentes, pour mesurer la dérive sur la fenêtre déclarée. */

  constructor(
    private drivetrain: DrivetrainPreset,
    private engine: EnginePreset,
    private feel: FeelPreset,
    /**
     * Le tempérament de la boîte : route ou sport.
     *
     * Il ne vient pas du profil mais de l'appareil, au même titre que la
     * commande automatique ou manuelle : c'est un choix de conduite, et il se
     * fait sous les cadrans. Les seuils de montée s'en déduisent, avec le
     * rupteur du moteur.
     */
    private driveMode: DriveMode = 'road',
  ) {}

  setPresets(drivetrain: DrivetrainPreset, engine: EnginePreset, feel: FeelPreset): void {
    this.drivetrain = drivetrain
    this.engine = engine
    this.feel = feel
    this.gear = clampInt(this.gear, 0, this.gearCount - 1)
  }

  setDriveMode(mode: DriveMode): void {
    this.driveMode = mode
  }

  getDriveMode(): DriveMode {
    return this.driveMode
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
    this.demand = 0
    this.loadHistory = []
    this.currentLoad = 0
    this.elapsedS = 0
    this.sinceKickdownS = Number.POSITIVE_INFINITY
    this.slowingForS = 0
    this.brakingForS = 0
    this.sinceDownshiftS = Number.POSITIVE_INFINITY
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
  private upshiftThreshold(gear: number): number {
    return this.upshiftThresholdAt(gear, this.demand)
  }

  /**
   * Seuil de montée d'un rapport pour une demande donnée.
   *
   * Le choix du rapport de départ le prend à zéro : on repart du rapport le plus
   * long qui convienne, comme après une reprise en douceur, et non de ce que le
   * conducteur demandait avant de changer de profil.
   */
  private upshiftThresholdAt(gear: number, demand: number): number {
    // Le seuil se déduit du **régime qu'aurait le rapport visé**, et non d'une
    // table ni d'une fraction du rupteur. On monte dès que le rapport suivant
    // tourne au-dessus de son plancher — le ralenti plus une marge que le mode
    // et la demande déplacent.
    //
    // Il est rendu exprimé sur le rapport engagé, parce que c'est là que la
    // boîte lit son régime et que la télémétrie l'affiche. Le rapport des deux
    // démultiplications fait la conversion, et c'est lui qui rend le critère
    // sensible à l'**étagement** : un saut court et un saut long ne reçoivent
    // plus le même seuil, ce que la table ne savait pas faire.
    const ratios = this.drivetrain.gearRatios
    const courant = ratios[gear] ?? 1
    const suivant = ratios[gear + 1] ?? courant

    // La première n'est qu'une amorce : on passe la deuxième dès qu'elle tient
    // au-dessus du ralenti, sans regarder le mode ni la charge, et sans tirage
    // au sort. David : « on passe la deuxième dès qu'on peut, sans attendre ».
    if (gear === 0) {
      return clamp(
        (FIRST_UPSHIFT_FLOOR_RPM * courant) / suivant,
        this.engine.idleRpm,
        this.engine.redlineRpm,
      )
    }

    const plancher = upshiftFloorRpm(this.driveMode, clamp01(demand), this.engine.idleRpm)
    const seuil = (plancher * courant) / suivant + this.pendingJitter
    return clamp(seuil, this.engine.idleRpm * 1.2, this.engine.redlineRpm)
  }

  /**
   * Régime en dessous duquel le rapport engagé est rendu.
   *
   * Il remonte avec la décélération — plus on ralentit fort, plus on rétrograde
   * tôt — et reste sous le seuil de montée du même rapport, ce qui interdit
   * l'aller-retour.
   */
  private downshiftThreshold(accelMs2: number): number {
    return downshiftFloorRpm(
      this.driveMode,
      accelMs2,
      this.engine.idleRpm,
      this.upshiftThreshold(this.gear),
    )
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
      if (rpmInGear(g) <= this.upshiftThresholdAt(g, 0)) break
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
    this.sinceKickdownS += dt
    this.sinceDownshiftS += dt
    // Tenir une vitesse, c'est ne pas la perdre : la bande est asymétrique.
    // La demande suit la charge à la montée et la retient à la descente.
    this.demand =
      load >= this.demand ? load : Math.max(load, this.demand - DEMAND_FALL_PER_S * dt)

    // Ce qui reste des compteurs d'allure, et pourquoi il en reste.
    //
    // La croisière n'a plus de mécanisme à elle : le plancher fait entrer le
    // rapport long tout seul. Mais **inhiber la montée quand on ralentit** est
    // une autre affaire, et elle tient toujours : sans elle, lever le pied
    // juste avant un passage le laisse se produire alors que la voiture
    // ralentit déjà. David : « si j'arrête d'accélérer juste avant que la boîte
    // ne monte un rapport, elle le monte quand même ».
    //
    // Ces deux-là seront unifiés avec le reste par le lot MOUVEMENT ; ils sont
    // gardés tels quels ici pour que ce lot ne fasse qu'une chose.
    this.brakingForS =
      accelMs2 <= this.drivetrain.brakeDownshiftAccelMs2 ? this.brakingForS + dt : 0
    this.slowingForS =
      accelMs2 < -CRUISE_SLOWING_MS2
        ? Math.min(SLOWING_CEILING_S, this.slowingForS + dt)
        : Math.max(0, this.slowingForS - dt * 2)
    const slowing =
      accelMs2 <= -CLEARLY_SLOWING_MS2 || this.slowingForS >= CRUISE_SLOWING_HOLD_S
    const braking = this.brakingForS >= BRAKE_HOLD_S

    let ready = false
    let blocked = false
    let upThresholdSeen = this.upshiftThreshold(this.gear)
    const downThresholdSeen = this.downshiftThreshold(accelMs2)
    const auto = this.mode === 'auto' && this.hasGearbox && this.shiftRemainingS === 0

    // La première se conduit comme les autres : on y accélère jusqu'au seuil de
    // régime, et c'est lui qui décide du passage.
    //
    // Elle cédait auparavant la place dès la vitesse de lancement, sans regarder
    // le régime : huit kilomètres à l'heure sur le profil Sport, soit le
    // kilomètre-heure suivant le démarrage. La deuxième y tombait alors bien sous
    // le ralenti, et le régime restait borné jusqu'à douze ou quatorze
    // kilomètres à l'heure. David : « il faut accélérer en première jusqu'à
    // passer la deuxième, comme n'importe quelle vitesse ».
    //
    // `launchUpshiftKmh` ne force plus le passage : il l'**empêche** en dessous.
    // Un coup d'accélérateur au démarrage ne doit pas faire monter les rapports
    // avant que la voiture n'avance vraiment.
    if (auto && this.gear === 0 && kmh < this.drivetrain.launchUpshiftKmh) {
      blocked = true
    }

    // Le rétrogradage forcé passe avant tout le reste : c'est une demande
    // explicite du conducteur, pas une décision de la boîte.
    //
    // Ce qui le déclenche est la **montée** de charge et non son niveau. Le
    // niveau seul ne distinguait pas « j'écrase » de « je remets délicatement
    // les gaz » : faute de pédale, la charge est déduite de l'accélération, et
    // le seuil se franchissait dès 3,6 km/h par seconde.
    if (auto && this.feel.kickdown.enabled && !atStandstill) {
      const threshold = kickdownLoadFor(this.driveMode)
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
          return this.report(atStandstill, false, false, upThresholdSeen, downThresholdSeen)
        }
        this.kickdownArmed = false
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
      //
      // **Ni pendant qu'on ralentit**, ce qui n'est pas la même chose : lever le
      // pied ne fait pas franchir le seuil de freinage, et le franchissement du
      // seuil de régime lance un compte à rebours que plus rien n'annulait.
      // David : « si j'arrête d'accélérer juste avant que la boîte ne monte un
      // rapport, elle le monte quand même ». Reproduit au banc — le seuil
      // franchi, puis le pied levé, et le passage se produit une demi-seconde
      // plus tard alors que la voiture ralentit déjà. Le compteur retombe à zéro
      // dans la branche `else`, donc l'intention est bien abandonnée et non
      // suspendue : reprendre les gaz repart d'un compte neuf.
      if (!braking && !slowing && rpm >= upThreshold && this.gear < this.gearCount - 1) {
        if (this.readyForS === 0) {
          // Nouvelle intention de passer : on tire l'écart de ce passage-ci.
          this.pendingJitter = (Math.random() * 2 - 1) * this.drivetrain.upshiftJitterRpm
        }
        ready = true
        this.readyForS += dt
        const delay = this.drivetrain.shiftDelaysS[this.gear] ?? 0.8
        // Le dépassement ne vaut qu'en accélérant : sinon c'est le seuil qui
        // est descendu sous le régime, pas le régime qui est monté au-dessus.
        const overshot = accelMs2 >= 0 && rpm >= upThreshold + UPSHIFT_OVERSHOOT_RPM
        if (this.readyForS >= delay || overshot) this.applyShift(1)
      } else if (
        rpm <= downThresholdSeen &&
        this.gear > this.downshiftFloor() &&
        !atStandstill
        // Plus de garde contre le va-et-vient, et c'est le propos : le plancher
        // de descente est tenu sous le seuil de montée du même rapport, donc un
        // rapport qu'on vient d'engager ne peut pas être rendu dans la foulée.
        // L'hystérésis se démontre au lieu de s'entourer de conditions.
      ) {
        this.readyForS = 0
        this.applyShift(-1)
      } else {
        if (rpm <= downThresholdSeen && this.gear > 0 && !atStandstill) blocked = true
        this.readyForS = 0

        // Plus de montée en croisière non plus. Elle existait parce que le seuil
        // de montée regardait le rapport qu'on quitte : un palier figeait alors
        // le rapport où l'on était. Le plancher regarde le rapport visé, donc il
        // fait entrer le rapport long de lui-même, sans mécanisme à part — et
        // sans la plage de vitesse où les deux se contredisaient.
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
   *
   * C'est désormais le seul rôle de `firstGearLaunchOnly`. Il commandait aussi le
   * passage immédiat de la première à la deuxième ; ce n'est plus le cas, la
   * première se conduisant comme un rapport ordinaire. Ce qui reste vrai, et que
   * David a formulé ainsi : « la seule différence de la première est qu'on ne
   * revient pas dessus — on freine jusqu'à l'arrêt en deuxième ».
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
