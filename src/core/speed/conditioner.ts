import type { SpeedPreset } from '../preset/schema'
import type { SpeedSample } from './source'

/**
 * Conditionnement du signal de vitesse.
 *
 * C'est la pièce la plus importante du projet, et celle qu'on sous-estime.
 * Piloter directement un son avec le signal brut donne un escalier — la hauteur
 * saute d'un cran à chaque mesure. Trois traitements se combinent ici pour en
 * tirer une courbe continue et jouable :
 *
 * 1. Une pente d'accélération, ajustée aux moindres carrés sur toutes les
 *    mesures de la fenêtre glissante réglée — une seconde par défaut. Cette
 *    fenêtre décide aussi du temps qu'une pente met à s'oublier : plus elle est
 *    longue, plus le signal est lisse et plus il traîne après une rupture.
 * 2. Une extrapolation entre deux mesures : tant que la suivante n'est pas
 *    arrivée, la vitesse continue sur sa lancée au lieu de rester figée.
 * 3. Un ressort amorti critique, intégré à pas fixe, qui rattrape la cible sans
 *    jamais la dépasser. C'est lui qui donne la continuité.
 *
 * Le pas d'intégration est fixe et découplé de la fréquence d'affichage : à 30
 * comme à 120 images par seconde, le comportement est identique.
 *
 * **La cadence des mesures n'est pas connue d'avance.** Une version antérieure
 * la supposait d'un hertz, et le disait dans son code. Relevé dans une Tesla,
 * le GPS livre une position toutes les quelques dizaines de millisecondes dès
 * que la voiture roule, et s'espace à plusieurs secondes à l'arrêt. Tout ce qui
 * suit est donc écrit en durées, jamais en nombre de mesures.
 */

/** Pas d'intégration du ressort, en secondes. */
const SOLVER_STEP_S = 0.02
/** Au-delà, on considère qu'il y a eu une pause (onglet en arrière-plan). */
const MAX_FRAME_S = 0.25
/**
 * Plafond du nombre de mesures conservées.
 *
 * L'historique est borné en **temps**, pas en nombre : c'est la fenêtre réglée
 * qui décide. Ce plafond n'est qu'un garde-fou mémoire pour une source
 * pathologiquement bavarde — à cinquante hertz, une fenêtre d'une seconde n'en
 * garde qu'une cinquantaine.
 */
const MAX_HISTORY = 512
/** Vitesse en deçà de laquelle on considère le véhicule à l'arrêt, en km/h. */
const STANDSTILL_KMH = 0.8

export interface ConditionedSpeed {
  /** Vitesse lissée, en km/h. C'est elle qui pilote tout le reste. */
  kmh: number
  /** Accélération lissée, en m/s². Positive en accélération. */
  accelMs2: number
  /** Dernière vitesse brute reçue, en km/h. Pour l'écran de télémétrie. */
  rawKmh: number
  /**
   * Vrai si la dernière mesure a été déduite de deux positions plutôt que lue.
   *
   * Le drapeau existe depuis le premier jour dans `SpeedSample` et n'était
   * affiché nulle part. C'est ce qui a rendu invisible pendant une semaine un
   * défaut du repli par distance : rien ne disait par lequel des deux chemins la
   * vitesse arrivait.
   */
  derived: boolean
  /** Pente estimée sur la fenêtre glissante, en km/h par seconde. */
  slopeKmhS: number
  /** Temps écoulé depuis la dernière mesure, en millisecondes. */
  sinceLastSampleMs: number
  /** Intervalles entre les dernières mesures, en millisecondes. Diagnostic. */
  recentGapsMs: number[]
  /**
   * Nombre de mesures qui ont servi à la pente.
   *
   * Affiché parce que c'est ce chiffre qui a permis de trouver que la cadence du
   * GPS n'était pas celle qu'on croyait.
   */
  slopeSamples: number
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
  private derived = false
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
    this.derived = false
    this.slopeKmhS = 0
    this.targetKmh = 0
    this.smoothedKmh = 0
    this.springRate = 0
    this.accelMs2 = 0
    this.lastSampleAt = 0
    this.lastSampleReceivedAt = 0
    this.carry = 0
  }

  /**
   * Absorbe une mesure brute. Peut être appelé à n'importe quelle fréquence.
   *
   * Une mesure au-delà de la vitesse plausible n'est pas une vitesse, c'est une
   * erreur : on n'en tire rien du tout. La ramener au plafond, comme on le
   * faisait, revenait à la croire à moitié — une valeur absurde reçue à 90 km/h
   * faisait monter la vitesse conditionnée vers le plafond, donc le moteur au
   * rupteur, sur une seule mesure fausse.
   *
   * Le plafond lui-même reste accepté : c'est la borne du plausible, pas celle
   * de l'aberrant.
   */
  push(sample: SpeedSample): void {
    if (!Number.isFinite(sample.kmh)) return
    if (sample.kmh > this.preset.maxPlausibleKmh) return

    // Une vitesse négative n'a pas de sens mais ne dit rien d'aberrant sur la
    // mesure : on la ramène à l'arrêt.
    const kmh = Math.max(0, sample.kmh)

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
    this.derived = sample.derived
    this.targetKmh = kmh

    this.history.push({ at: sample.at, kmh })
    this.prune(sample.at)

    this.slopeKmhS = this.estimateSlope(sample.at)
  }

  /**
   * Élague l'historique : on garde les mesures de la fenêtre réglée.
   *
   * Bornée en durée, et non en nombre de mesures. Le bornage en nombre — seize
   * entrées — reposait sur une cadence d'un hertz : à trente millisecondes il
   * ramenait la fenêtre utilisable à une demi-seconde quelle que fût la valeur
   * réglée, et le réglage ne commandait plus rien.
   *
   * Les deux dernières mesures sont gardées quoi qu'il arrive : à cadence lente,
   * la précédente peut être plus vieille que la fenêtre, et il faut bien deux
   * points pour une pente.
   */
  private prune(at: number): void {
    const windowMs = Math.max(0, this.preset.accelWindowMs)
    while (this.history.length > 2) {
      const oldest = this.history[0]
      if (!oldest || at - oldest.at <= windowMs) break
      this.history.shift()
    }
    while (this.history.length > MAX_HISTORY) this.history.shift()
  }

  /**
   * Pente sur la fenêtre glissante, par les moindres carrés.
   *
   * Toutes les mesures de la fenêtre servent, et non deux d'entre elles. C'est
   * ce qui permet de se passer d'une zone morte : le bruit de mesure se moyenne
   * au lieu d'être seuillé.
   *
   * La zone morte qui existait ici retirait un écart fixe en km/h **avant** de
   * diviser par la durée. Un seuil en vitesse divisé par une durée variable
   * donne un seuil d'accélération variable : mesuré, à une cadence de trente
   * millisecondes, elle annulait purement et simplement toute accélération sous
   * 0,58 m/s². Une reprise de 110 à 150 en vingt secondes était vue comme une
   * vitesse tenue — d'où un son de croisière là où le moteur travaillait.
   *
   * Mesuré sur l'estimateur retenu, avec un bruit de mesure de ±1 km/h : la
   * pente est juste à toutes les cadences (0,35 m/s² lue 0,35 ; 2,0 lue 2,00),
   * et son écart-type tombe de 0,22 m/s² à un hertz à 0,09 à trente
   * millisecondes. Plus le GPS parle, plus l'estimation est sûre — l'inverse du
   * comportement précédent.
   *
   * À l'arrêt on ne cherche pas de pente. Un véhicule immobile n'accélère pas,
   * et c'est là que le GPS tremble le plus : à ±3 km/h de tremblement, la
   * régression laisse encore passer 0,6 m/s². Le seuil porte sur les mesures
   * elles-mêmes, pas sur la vitesse lissée, et il suffit qu'**une** mesure de la
   * fenêtre dépasse le seuil pour qu'on estime à nouveau : sinon un démarrage
   * franc serait manqué le temps que la vitesse lissée monte.
   */
  private estimateSlope(at: number): number {
    const points = this.history
    const n = points.length
    if (n < 2) return 0

    let moving = false
    for (const point of points) {
      if (point.kmh >= STANDSTILL_KMH) {
        moving = true
        break
      }
    }
    if (!moving) return 0

    // Abscisses relatives à la mesure courante, en secondes : les horodatages
    // bruts sont de grands nombres, et leur carré perdrait de la précision.
    let sx = 0
    let sy = 0
    let sxx = 0
    let sxy = 0
    for (const point of points) {
      const x = (point.at - at) / 1000
      sx += x
      sy += point.kmh
      sxx += x * x
      sxy += x * point.kmh
    }

    const spread = n * sxx - sx * sx
    // Toutes les mesures au même instant : aucune pente n'est définie.
    if (!(Math.abs(spread) > 1e-9)) return this.slopeKmhS

    const oldest = points[0]
    // Une fenêtre trop courte donne une pente dominée par le bruit. Au
    // démarrage, à cadence rapide, il faut quelques dizaines de mesures avant
    // que la fenêtre soit assez large.
    if (oldest && (at - oldest.at) / 1000 <= 0.15) return this.slopeKmhS

    const slope = (n * sxy - sx * sy) / spread
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

    // L'accélération rendue est la **pente estimée**, et non la vitesse de la
    // masse du ressort.
    //
    // Les deux mesurent la même chose et l'une est bien meilleure que l'autre.
    // Le ressort a pour métier de rattraper une cible qui saute à chaque mesure,
    // sans la dépasser : sa vitesse porte donc tout le bruit du GPS, et le
    // retard qui va avec. Mesuré sur une vitesse parfaitement tenue à la cadence
    // rapide, avec un bruit de mesure de ±1 km/h : 0,83 m/s² d'écart-type et des
    // pointes à 2,2 pour la vitesse du ressort, 0,10 et 0,4 pour la pente. Sur
    // une reprise établie à 2 m/s², le ressort lit 1,96 et la pente 2,00.
    //
    // Ce n'est pas cosmétique : cette valeur décide la charge, donc le fondu
    // entre les couches, et elle décide les passages de la boîte. À 0,83 m/s²
    // de bruit, la boîte changeait de rapport une dizaine de fois par minute sur
    // une vitesse tenue, et jusqu'à quarante-trois fois avec le curseur de
    // réactivité au maximum.
    //
    // La pente était déjà calculée ici, et ne servait qu'à l'extrapolation.
    this.accelMs2 = clamp(
      this.slopeKmhS / 3.6,
      this.preset.minAccelMs2,
      this.preset.maxAccelMs2,
    )

    this.guardAgainstNaN()

    return {
      kmh: this.smoothedKmh,
      accelMs2: this.accelMs2,
      rawKmh: this.rawKmh,
      derived: this.derived,
      slopeKmhS: this.slopeKmhS,
      sinceLastSampleMs,
      recentGapsMs: [...this.gaps],
      slopeSamples: this.history.length,
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
