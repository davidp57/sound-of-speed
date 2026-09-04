import { SpeedSource, type SpeedSample } from './source'

/**
 * Vitesse réelle, lue au GPS.
 *
 * Deux pièges se traitent ici, à la source, avant tout lissage :
 *
 * 1. `coords.speed` n'est pas toujours renseigné (certains navigateurs de bord,
 *    certains navigateurs de bureau). On retombe alors sur la distance parcourue
 *    entre deux positions, par la formule de haversine.
 * 2. Le GPS produit des aberrations — un saut de position sous un pont donne une
 *    vitesse de 400 km/h. Tout ce qui dépasse le plausible est rejeté plutôt que
 *    lissé, sinon le lissage étale l'aberration sur plusieurs secondes.
 * 3. Une position s'accompagne de sa propre incertitude. À trois cents mètres
 *    près, elle ne dit plus rien d'exploitable — mais le seuil de rejet est un
 *    réglage, large par défaut : trop serré, il ferait taire la source.
 */

/** Rayon terrestre moyen, en mètres. */
const EARTH_RADIUS_M = 6_371_000
/** Intervalle minimal entre deux positions pour en dériver une vitesse, en secondes. */
const MIN_DELTA_S = 0.15
/**
 * Nombre de précisions conservées pour l'affichage.
 *
 * Douze, parce que le GPS de la voiture livre une position toutes les quelques
 * dizaines de millisecondes : ce n'est pas un historique, c'est de quoi lire un
 * ordre de grandeur d'un coup d'œil en roulant.
 */
const RECENT_ACCURACY = 12

export interface GeolocationSourceOptions {
  /** Au-delà, la mesure est considérée comme aberrante et rejetée. */
  maxPlausibleKmh: number
  /** Au-delà, la position est trop floue pour en tirer une vitesse. */
  maxAccuracyM: number
}

/**
 * Ce que la source a vu passer. Remonté à l'écran de télémétrie.
 *
 * Sans ces comptes, une source qui reçoit des positions et ne produit aucune
 * vitesse est indiscernable d'une source qui ne reçoit rien : les deux donnent
 * une vitesse figée et un écran muet. C'est exactement ce qui a rendu invisible
 * pendant une semaine le défaut du repli — l'écart entre `received` et `emitted`
 * l'aurait montré du premier coup d'œil.
 */
export interface GeolocationStats {
  /** Positions reçues du navigateur. */
  received: number
  /** Vitesses effectivement produites. */
  emitted: number
  /**
   * Précision annoncée avec la dernière position reçue, en mètres.
   *
   * Relevée même quand la position est rejetée : c'est la mauvaise valeur qu'on
   * cherche à voir. `null` quand le navigateur ne renseigne pas le champ.
   */
  lastAccuracyM: number | null
  /** Les dernières précisions reçues, de la plus ancienne à la plus récente. */
  recentAccuracyM: number[]
  rejected: {
    /** Au-delà du plausible : une erreur, pas une vitesse. */
    implausible: number
    /** Deux positions trop rapprochées pour en tirer une vitesse. */
    tooClose: number
    /** Précision annoncée au-delà du seuil : la position n'est pas exploitée. */
    inaccurate: number
  }
}

export class GeolocationSource extends SpeedSource {
  readonly kind = 'geolocation' as const
  readonly label = 'GPS'

  private watchId: number | null = null
  /**
   * Position de référence pour le calcul par distance.
   *
   * Elle est **gardée** tant qu'aucune vitesse n'en a été tirée. La remplacer à
   * chaque position, comme on le faisait, empêchait l'écart de jamais atteindre
   * le minimum exploitable : au-delà de six positions par seconde, plus une
   * seule vitesse n'était produite, et le suivi ne repartait plus.
   */
  private previous: GeolocationPosition | null = null

  /**
   * Dernière position connue, hors du flux des mesures.
   *
   * Elle n'est **pas** ajoutée à `SpeedSample`, et ce n'est pas un détail. Le
   * flux des mesures est recopié tel quel par l'enregistreur de traces, et une
   * trace s'exporte en fichier et se dépose sur le serveur **sans accord
   * particulier** : y faire entrer des coordonnées les ferait sortir par une
   * porte déjà ouverte. Une donnée de déplacement ne voyage donc pas dans le
   * canal général — elle se lit ici, explicitement, par qui en a le droit.
   *
   * L'invariant des sources n'en souffre pas : il porte sur le **chiffre de
   * vitesse**, que rien en aval ne doit pouvoir rattacher à une source. Les
   * comptes de `stats` sont déjà exposés de cette façon.
   */
  lastPosition: { latitude: number; longitude: number; at: number } | null = null

  readonly stats: GeolocationStats = {
    received: 0,
    emitted: 0,
    lastAccuracyM: null,
    recentAccuracyM: [],
    rejected: { implausible: 0, tooClose: 0, inaccurate: 0 },
  }

  constructor(private options: GeolocationSourceOptions) {
    super()
  }

  setOptions(options: GeolocationSourceOptions): void {
    this.options = options
  }

  start(): void {
    if (this.watchId !== null) return
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      this.setStatus('unsupported')
      return
    }

    this.setStatus('starting')
    this.watchId = navigator.geolocation.watchPosition(
      (position) => this.handlePosition(position),
      (error) => this.handleError(error),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
    )
  }

  stop(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId)
      this.watchId = null
    }
    this.previous = null
    this.lastPosition = null
    this.setStatus('idle')
  }

  private handlePosition(position: GeolocationPosition): void {
    this.stats.received += 1

    const accuracyM = this.recordAccuracy(position)
    if (accuracyM !== null && accuracyM > this.options.maxAccuracyM) {
      // Le filtre est en tête, avant tout usage : une position trop floue n'est
      // ni une mesure ni une référence. La garder comme référence reviendrait à
      // faire calculer la vitesse suivante depuis un point douteux — le rejet
      // se contenterait alors de changer de nom.
      this.stats.rejected.inaccurate += 1
      return
    }

    const reported = position.coords.speed
    const hasReported = typeof reported === 'number' && Number.isFinite(reported) && reported >= 0

    let kmh: number
    let derived: boolean

    if (hasReported) {
      kmh = reported * 3.6
      derived = false
      this.previous = position
    } else {
      const fallback = this.speedFromPositions(this.previous, position)
      if (fallback === null) {
        // La référence est **conservée** : c'est en la gardant que l'écart finit
        // par atteindre le minimum exploitable. Une position isolée ne sert donc
        // qu'à devenir référence quand il n'y en a pas encore.
        this.stats.rejected.tooClose += 1
        if (!this.previous) this.previous = position
        return
      }
      kmh = fallback
      derived = true
      this.previous = position
    }

    if (!Number.isFinite(kmh) || kmh > this.options.maxPlausibleKmh) {
      // Une mesure au-delà du plausible n'est pas une vitesse, c'est une erreur :
      // on n'en tire rien du tout. La remplacer par la dernière valeur saine puis
      // l'émettre, comme on le faisait, la faisait passer pour une mesure — la
      // vitesse se figeait sans que rien ne le signale, et le chien de garde ne
      // voyait aucun silence dont il aurait pu se saisir. C'est la règle que le
      // conditionnement du signal applique déjà de son côté.
      this.stats.rejected.implausible += 1
      return
    }

    this.lastPosition = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      at: position.timestamp,
    }
    this.stats.emitted += 1
    this.setStatus('active')
    this.emit({
      kmh,
      at: position.timestamp,
      accuracyM,
      derived,
    } satisfies SpeedSample)
  }

  /**
   * Note la précision annoncée, et la rend telle qu'elle sera comparée au seuil.
   *
   * Une précision absente ou absurde vaut « inconnue » et non « mauvaise » :
   * tous les navigateurs ne renseignent pas le champ, et filtrer sur son absence
   * refuserait toutes les positions d'un appareil qui se tait.
   */
  private recordAccuracy(position: GeolocationPosition): number | null {
    const reported = position.coords.accuracy
    const known = typeof reported === 'number' && Number.isFinite(reported) && reported >= 0
    this.stats.lastAccuracyM = known ? reported : null
    if (known) {
      this.stats.recentAccuracyM.push(reported)
      if (this.stats.recentAccuracyM.length > RECENT_ACCURACY) {
        this.stats.recentAccuracyM.shift()
      }
    }
    return known ? reported : null
  }

  private speedFromPositions(
    from: GeolocationPosition | null,
    to: GeolocationPosition,
  ): number | null {
    if (!from) return null
    const seconds = (to.timestamp - from.timestamp) / 1000
    if (!Number.isFinite(seconds) || seconds < MIN_DELTA_S) return null
    const meters = haversineM(from.coords, to.coords)
    return (meters / seconds) * 3.6
  }

  private handleError(error: GeolocationPositionError): void {
    if (error.code === error.PERMISSION_DENIED) {
      this.setStatus('denied', error.message)
    } else {
      this.setStatus('unavailable', error.message)
    }
    // La référence est abandonnée : après une interruption, l'écart avec la
    // prochaine position ne décrit plus un déplacement continu.
    this.previous = null
  }
}

function haversineM(a: GeolocationCoordinates, b: GeolocationCoordinates): number {
  const toRad = Math.PI / 180
  const dLat = (b.latitude - a.latitude) * toRad
  const dLon = (b.longitude - a.longitude) * toRad
  const lat1 = a.latitude * toRad
  const lat2 = b.latitude * toRad

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}
