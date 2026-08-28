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
 */

/** Rayon terrestre moyen, en mètres. */
const EARTH_RADIUS_M = 6_371_000
/** Intervalle minimal entre deux positions pour en dériver une vitesse, en secondes. */
const MIN_DELTA_S = 0.15

export interface GeolocationSourceOptions {
  /** Au-delà, la mesure est considérée comme aberrante et rejetée. */
  maxPlausibleKmh: number
}

export class GeolocationSource extends SpeedSource {
  readonly kind = 'geolocation' as const
  readonly label = 'GPS'

  private watchId: number | null = null
  private previous: GeolocationPosition | null = null
  private lastKmh = 0

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
    this.setStatus('idle')
  }

  private handlePosition(position: GeolocationPosition): void {
    const reported = position.coords.speed
    const hasReported = typeof reported === 'number' && Number.isFinite(reported) && reported >= 0

    let kmh: number
    let derived: boolean

    if (hasReported) {
      kmh = reported * 3.6
      derived = false
    } else {
      const fallback = this.speedFromPositions(this.previous, position)
      if (fallback === null) {
        this.previous = position
        return
      }
      kmh = fallback
      derived = true
    }

    this.previous = position

    if (!Number.isFinite(kmh) || kmh > this.options.maxPlausibleKmh) {
      // Aberration : on garde la dernière valeur saine plutôt que de propager le saut.
      kmh = this.lastKmh
    }
    this.lastKmh = kmh

    this.setStatus('active')
    this.emit({
      kmh,
      at: position.timestamp,
      accuracyM: position.coords.accuracy ?? null,
      derived,
    } satisfies SpeedSample)
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
    this.lastKmh = 0
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
