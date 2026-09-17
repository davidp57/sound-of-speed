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
 *
 * Il sort **deux** régimes, et c'est voulu : le régime net, sur lequel la boîte,
 * ses seuils et la télémétrie travaillent, et le régime entendu, qui porte le
 * tremblement et fixe les vitesses de lecture. Un compteur, un usage.
 */

/**
 * Composantes du tremblement : poids, et rapport à la fréquence réglée.
 *
 * Trois sinusoïdes plutôt qu'une : à une seule fréquence, le tremblement
 * s'entend comme un vibrato. La deuxième est à √2 fois la première, un rapport
 * irrationnel, ce qui empêche la somme de se répéter — elle n'a pas de période.
 * La troisième est la composante lente : 0,117 fois la fréquence réglée, soit
 * 0,70 Hz pour les 6 Hz des profils livrés.
 *
 * Des sinusoïdes et non un tirage au sort : c'est reproductible sans graine à
 * gérer, et une même situation donne toujours le même son. Un générateur
 * pseudo-aléatoire aurait fait dépendre le mixage de l'historique des appels.
 *
 * La somme des poids vaut un : l'amplitude réglée est donc l'excursion maximale,
 * atteinte quand les trois composantes s'alignent.
 */
const FLUTTER_PARTS: { weight: number; ratio: number; phase: number }[] = [
  { weight: 0.45, ratio: 1, phase: 0 },
  { weight: 0.25, ratio: Math.SQRT2, phase: 1.7 },
  { weight: 0.3, ratio: 0.117, phase: 0.6 },
]

/**
 * Atténuation du tremblement avec le régime et avec la charge.
 *
 * Un moteur se stabilise en montant et sous couple : il tremble au ralenti et à
 * vide. Le tremblement tombe donc au quart au rupteur, et à 40 % pied au
 * plancher. Aucune des deux atténuations ne va jusqu'à zéro — sous charge
 * partielle, un moteur tremble encore.
 */
const FLUTTER_RPM_FALLOFF = 3
const FLUTTER_LOAD_FALLOFF = 0.6

export interface EngineState {
  /** Régime affiché, et celui sur lequel travaillent la boîte et ses seuils. */
  rpm: number
  /**
   * Régime entendu, en tours par minute : le régime net plus le tremblement.
   *
   * C'est lui, et lui seul, qui fixe les vitesses de lecture des couches. Le
   * tremblement n'atteint donc ni la boîte, ni la télémétrie, ni les seuils de
   * passage : ceux-ci travaillent sur le régime, et quelques dizaines de tours
   * suffiraient à les faire osciller.
   */
  audibleRpm: number
  /** Régime imposé par la vitesse et le rapport, avant inertie et rupteur. */
  kinematicRpm: number
  /** De 0 (pied levé) à 1 (pleine charge). Pilote la boîte et ses seuils. */
  load: number
  /**
   * Le travail du moteur, de 0 à 1 : l'accélération **plus** la traînée à
   * vaincre. Pilote le fondu on/off et le relief de charge.
   *
   * Deux grandeurs plutôt qu'une, parce que la boîte et le son ne demandent pas
   * la même chose. La boîte veut l'**intention** du conducteur — demande-t-il de
   * l'accélération ? — et cela ne dépend pas de la vitesse. Le son veut le
   * **travail** — combien le moteur pousse —, et tenir 130 km/h en demande
   * beaucoup quand tenir 30 n'en demande presque pas.
   *
   * Les avoir confondues faisait que toute vitesse tenue donnait le même demi,
   * de l'arrêt à 130 km/h : mesuré, cinq allures tenues à 0,50 au centième près.
   */
  effort: number
  /** Fraction du rupteur, de 0 à 1. */
  rpmFraction: number
  /** Fréquence d'allumage, en hertz. Diagnostic. */
  firingHz: number
  limiterActive: boolean
  /** Vrai quand le régime est tenu par le ralenti et non par les roues. */
  idling: boolean
}

/**
 * Vitesse au-delà de laquelle l'embrayage est forcément fermé, en km/h.
 *
 * Sans cette borne, un régime bas sur un grand rapport — trente kilomètres à
 * l'heure à mille cent tours — passerait pour un décollage, et le régime serait
 * relevé à tort. On ne patine qu'en partant : « la première, même juste pour
 * lancer, jusque vingt kilomètres à l'heure ».
 */
const CLUTCH_KMH = 25

/**
 * Découpage d'un passage de rapport, en fractions de sa durée.
 *
 * Quatre phases : la chute au neutre, le coup de gaz, le temps mort où le
 * rapport s'engage — c'est là que tombe le clac —, puis la reprise du couple.
 * Le coup de gaz est le plus court des quatre : c'est un geste sec.
 */
const SHIFT_PHASES = { dropEnd: 0.34, blipEnd: 0.52, clackEnd: 0.6 } as const

/** Fraction du passage à laquelle le rapport s'engage, et où le clac tombe. */
export const SHIFT_CLACK_AT = SHIFT_PHASES.blipEnd

/** Interpolation adoucie aux deux bouts : un régime ne casse pas de pente. */
function ease(from: number, to: number, t: number): number {
  const x = clamp(t, 0, 1)
  return from + (to - from) * x * x * (3 - 2 * x)
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
   * Avancement du passage en cours, de 0 à 1. Sans elle, le moteur reste
   * découplé toute la durée du passage et ne rejoint les roues qu'après —
   * ce qui décale la chute de régime derrière le creux de niveau.
   */
  shiftProgress?: number
  /**
   * Plongée du régime sous le rapport visé, en tours par minute, le temps du
   * passage. Négatif donne un coup de gaz au lieu d'un creux.
   *
   * C'est un réglage de ressenti et non une donnée de la boîte, mais il arrive
   * par l'entrée comme la progression : le moteur ne connaît que le régime et
   * les rapports, et c'est l'assemblage qui lui dit ce que le profil veut
   * entendre.
   */
  shiftDipRpm?: number
  /**
   * Hauteur du coup de gaz au-dessus du régime du rapport visé, en tours par
   * minute. Zéro supprime la remontée et laisse la séquence en trois temps.
   */
  shiftBlipRpm?: number
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
  private effort = 0
  private limiterCutRemainingS = 0
  private limiterActive = false
  /**
   * Temps écoulé depuis la remise à zéro, en secondes, pour la phase du
   * tremblement. Le tremblement est une fonction de ce seul compteur : la même
   * suite de pas donne donc la même suite de régimes entendus.
   */
  private flutterTimeS = 0
  /**
   * Régime au moment où le passage a commencé, ou `null` hors passage.
   *
   * La séquence part de là : sans ce point de départ mémorisé, la descente
   * repartirait du régime courant à chaque tour et la trajectoire dépendrait
   * de la cadence d'appel.
   */
  private shiftStartRpm: number | null = null

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
    this.effort = 0
    this.limiterCutRemainingS = 0
    this.limiterActive = false
    this.flutterTimeS = 0
    this.shiftStartRpm = null
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

    this.advanceRpm(step, target, kinematic, input)
    this.advanceLoad(step, input)
    this.applyLimiter(step)

    const fraction = clamp(this.rpm / Math.max(1, this.preset.redlineRpm), 0, 1)

    return {
      rpm: this.rpm,
      audibleRpm: this.advanceFlutter(step),
      kinematicRpm: kinematic,
      load: this.load,
      effort: this.effort,
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
   *
   * **Dès que la voiture avance, c'est l'embrayage qui commande**, et non plus le
   * ralenti. Le plancher était le ralenti : de zéro à six kilomètres à l'heure
   * sur le profil Sport, les roues tournant moins vite, le régime restait à 780
   * et le son était celui de l'arrêt.
   *
   * **L'embrayage se ferme progressivement.** Une première version tenait un
   * palier : le régime sautait au régime de décollage et y restait jusqu'à ce
   * que les roues le rattrapent. David l'a écouté et c'était faux — « on passe
   * de 800 à 1 300 sans aucun changement même en accélérant doucement ; seulement
   * à partir d'une dizaine de km/h ça commence à augmenter ». On ne lâche pas
   * l'embrayage d'un coup : le régime monte du ralenti vers le régime de
   * décollage à mesure que la voiture avance, puis suit les roues.
   *
   * Et la hauteur atteinte dépend des gaz : on ne démarre pas en douceur comme
   * on démarre vite.
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
    // En ralentissant, on débraye avant de caler : dès que les roues descendent
    // sous le ralenti, le moteur s'en détache et y retombe. C'est ce qui se passe
    // en freinant jusqu'à l'arrêt, où l'on reste en deuxième.
    if (input.accelMs2 < 0 && kinematic < this.preset.idleRpm) return this.preset.idleRpm

    // Jamais sous le ralenti, même si le profil est mal réglé.
    const idle = this.preset.idleRpm
    const launch = Math.max(idle, this.preset.launchRpm)

    if (input.kmh < CLUTCH_KMH && kinematic < launch) {
      // Ce que les gaz demandent. Un plancher : même pied levé on décolle un peu,
      // sinon la voiture avancerait à régime de ralenti, ce qu'on cherche
      // justement à supprimer.
      const demand = clamp(input.throttle ?? this.load, 0.3, 1)
      const reached = idle + (launch - idle) * demand
      // Le glissement se referme à mesure que les roues montent : zéro à
      // l'arrêt, un quand elles atteignent le régime demandé.
      const closing = clamp(kinematic / Math.max(1, reached), 0, 1)
      return Math.max(idle + (reached - idle) * closing, kinematic)
    }

    return Math.max(idle, kinematic)
  }

  /**
   * La trajectoire du régime pendant un passage, en cinq temps.
   *
   * Les quatre bornes découpent la durée du passage. Elles sont en dur : ce
   * sont des proportions du geste, pas des goûts — c'est `shiftTimeMs` qui
   * décide de la durée réelle de chacune, et donc de ce qui s'entend.
   *
   * ```
   *  départ ──┐                    ┌── sommet du coup de gaz
   *           │      ╱╲           ╱
   *           └─────╱  ╲─────────╱ clac
   *            creux     ╲______╱
   *                       régime des roues, puis réaccélération
   * ```
   */
  private shiftRpm(progress: number, kinematic: number, input: EngineInput): number {
    if (this.shiftStartRpm === null) this.shiftStartRpm = this.rpm
    const start = this.shiftStartRpm
    const idle = this.preset.idleRpm

    const floor = Math.max(idle, kinematic - Math.max(0, input.shiftDipRpm ?? 0))
    const peak = Math.max(floor, kinematic + Math.max(0, input.shiftBlipRpm ?? 0))

    // Le neutre : le couple lâche, le moteur tombe. Rapide, mais pas
    // instantané — un volant moteur a de l'inertie.
    if (progress < SHIFT_PHASES.dropEnd) {
      return ease(start, floor, progress / SHIFT_PHASES.dropEnd)
    }
    // Le coup de gaz : court et franc, c'est lui qu'on entend le mieux.
    if (progress < SHIFT_PHASES.blipEnd) {
      const t = (progress - SHIFT_PHASES.dropEnd) / (SHIFT_PHASES.blipEnd - SHIFT_PHASES.dropEnd)
      return ease(floor, peak, t)
    }
    // Le rapport s'engage : c'est là que tombe le clac, déclenché ailleurs.
    if (progress < SHIFT_PHASES.clackEnd) return peak
    // L'embrayage se lâche : le régime est repris par les roues.
    const t = (progress - SHIFT_PHASES.clackEnd) / (1 - SHIFT_PHASES.clackEnd)
    return ease(peak, kinematic, t)
  }

  /**
   * Le régime ne saute pas à sa cible : le volant moteur a de l'inertie. Deux
   * constantes distinctes, parce qu'un moteur monte plus vite qu'il ne redescend
   * quand il est libre — et l'inverse quand la roue l'entraîne.
   */
  private advanceRpm(
    dt: number,
    target: number,
    kinematic: number,
    input: EngineInput,
  ): void {
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

    // Le passage de rapport, en cinq temps.
    //
    // C'est la séquence que David décrit en écoutant une vraie boîte :
    // « accélération, montée de régime ; passage au neutre, descente rapide ;
    // coup de gaz, montée rapide très courte ; passage du rapport, clac ;
    // lâcher de l'embrayage, reprise du couple, descente rapide au régime des
    // roues puis réaccélération ».
    //
    // Trois versions ont précédé celle-ci et aucune ne s'entendait. La
    // première laissait le régime descendre au frein moteur pendant tout le
    // passage puis rattraper après ; la deuxième le ramenait dans le temps du
    // passage, mais en ligne droite ; la troisième lui faisait creuser un
    // trou sous le rapport visé. Ce qui manquait à toutes : **la remontée**,
    // et surtout du temps. Un passage durait 120 ms, et rien de tout cela
    // n'est audible en un dixième de seconde — c'est `shiftTimeMs`, dans la
    // transmission, qui décide si la séquence a la place d'exister.
    // Sans progression fournie, on ne sait pas où en est le passage : le moteur
    // reste simplement découplé, comme avant que la séquence existe. C'est le
    // cas des bancs qui tiennent `isShifting` sans dérouler le temps.
    if (input.isShifting && input.shiftProgress !== undefined) {
      this.rpm = this.shiftRpm(clamp(input.shiftProgress, 0, 1), kinematic, input)
    } else if (!input.isShifting) {
      this.shiftStartRpm = null
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

    this.advanceEffort(dt, input, tau)
  }

  /**
   * Effort : ce que le moteur fournit vraiment.
   *
   * L'accélération demandée, plus la traînée à vaincre — laquelle croît comme le
   * carré de la vitesse, et vaut la moitié de la charge disponible au repère
   * réglé. Sans ce second terme, tenir une allure vaut toujours le même demi,
   * que ce soit à 30 ou à 130 km/h, et la moitié de l'échelle reste inutilisée.
   *
   * Le lissage est celui de la charge : les deux grandeurs suivent la même
   * mesure d'entrée, et les désaccorder ferait entendre deux moteurs.
   */
  private advanceEffort(dt: number, input: EngineInput, tau: number): void {
    const full = Math.max(0.1, this.mix.fullLoadAccelMs2)
    const dragRef = Math.max(1, this.mix.dragRefKmh)
    const share = Math.max(0, input.kmh) / dragRef
    const raw = clamp(input.accelMs2 / full + 0.5 * share * share, 0, 1)

    this.effort += (raw - this.effort) * clamp(dt / tau, 0, 1)
    this.effort = clamp(this.effort, 0, 1)
  }

  /**
   * Tremblement de régime.
   *
   * Le conditionnement produit un signal d'une régularité qu'aucun moteur
   * thermique n'a, et cette régularité est une part importante de ce qui fait
   * entendre une machine plutôt qu'un moteur. On ajoute donc au régime un
   * tremblement lent, d'autant plus fort que le régime et la charge sont bas.
   *
   * Il ne va que dans le régime **entendu** : la boîte, ses seuils et la
   * télémétrie gardent le régime net.
   *
   * À amplitude nulle, la valeur rendue est exactement le régime net — le
   * comportement d'avant ce réglage, au bit près.
   */
  private advanceFlutter(dt: number): number {
    this.flutterTimeS += dt

    const amplitude = this.flutterAmplitude()
    const hz = this.preset.flutterHz
    if (!(amplitude > 0) || !(hz > 0)) return this.rpm

    let offset = 0
    for (const part of FLUTTER_PARTS) {
      const angle = 2 * Math.PI * hz * part.ratio * this.flutterTimeS + part.phase
      offset += part.weight * Math.sin(angle)
    }

    // Le plancher descend avec l'amplitude, et c'est tout l'objet.
    //
    // Il valait `idleRpm`. Or au ralenti le régime est **exactement** à cette
    // valeur : toute la demi-oscillation vers le bas était écrasée contre la
    // borne, et le moteur passait la moitié du temps rigoureusement stable —
    // mesuré, 51 % des images. David l'entendait : « au ralenti, le moteur est à
    // 800 rpm stables ». Un vrai ralenti descend sous sa consigne autant qu'il
    // monte au-dessus ; le plancher suit donc le tremblement.
    //
    // La moitié du ralenti reste un garde-fou : en dessous, un moteur a calé, et
    // les couches se joueraient près d'une octave trop bas. Le curseur s'arrête à
    // 150 tr/min, donc il ne mord jamais — il n'est là que pour un profil importé
    // qui n'est pas passé par le curseur.
    const plancher = Math.max(this.preset.idleRpm - amplitude, this.preset.idleRpm / 2)
    return clamp(this.rpm + amplitude * offset, plancher, this.preset.redlineRpm)
  }

  /**
   * Amplitude du tremblement à cet instant, en tours par minute.
   *
   * Deux atténuations se multiplient, l'une avec le régime et l'autre avec la
   * charge, et aucune ne s'annule : sous charge partielle un moteur tremble
   * encore. L'atténuation en régime est hyperbolique plutôt que linéaire — elle
   * mord surtout dans le bas de la plage, là où le tremblement s'entend.
   */
  private flutterAmplitude(): number {
    const { flutterRpm, idleRpm, redlineRpm } = this.preset
    if (!(flutterRpm > 0)) return 0

    const span = Math.max(1, redlineRpm - idleRpm)
    const share = clamp((this.rpm - idleRpm) / span, 0, 1)
    return (
      (flutterRpm * (1 - FLUTTER_LOAD_FALLOFF * clamp(this.load, 0, 1))) /
      (1 + FLUTTER_RPM_FALLOFF * share)
    )
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
