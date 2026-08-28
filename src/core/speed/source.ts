/**
 * Sources de vitesse.
 *
 * Les trois implémentations (simulateur clavier, GPS, rejeu de trace) exposent
 * la même interface. Tout ce qui est en aval — conditionnement, moteur, boîte,
 * audio — ignore d'où vient le chiffre. C'est ce qui permet de développer au
 * clavier sur un poste fixe, de déboguer en rejouant un trajet enregistré, et de
 * rouler pour de vrai, sans une seule branche conditionnelle dans le reste du code.
 */

export interface SpeedSample {
  /** Vitesse brute, en km/h, telle que la source la rapporte. */
  kmh: number
  /** Horodatage, en millisecondes (`Date.now()`). */
  at: number
  /** Précision horizontale en mètres, quand la source la connaît. */
  accuracyM: number | null
  /** Vrai si la vitesse a été déduite de deux positions plutôt que lue directement. */
  derived: boolean
}

export type SourceStatus =
  | 'idle'
  | 'starting'
  | 'active'
  | 'denied'
  | 'unsupported'
  | 'unavailable'

export type SampleListener = (sample: SpeedSample) => void
export type StatusListener = (status: SourceStatus, detail?: string) => void

export abstract class SpeedSource {
  abstract readonly kind: 'simulator' | 'geolocation' | 'replay'
  abstract readonly label: string

  private sampleListeners = new Set<SampleListener>()
  private statusListeners = new Set<StatusListener>()

  protected status: SourceStatus = 'idle'

  onSample(fn: SampleListener): () => void {
    this.sampleListeners.add(fn)
    return () => this.sampleListeners.delete(fn)
  }

  onStatus(fn: StatusListener): () => void {
    this.statusListeners.add(fn)
    return () => this.statusListeners.delete(fn)
  }

  protected emit(sample: SpeedSample): void {
    for (const fn of this.sampleListeners) fn(sample)
  }

  protected setStatus(status: SourceStatus, detail?: string): void {
    this.status = status
    for (const fn of this.statusListeners) fn(status, detail)
  }

  abstract start(): void
  abstract stop(): void

  /**
   * Appelé à chaque image. Les sources purement événementielles, comme le GPS,
   * n'en font rien ; le simulateur y intègre sa physique.
   */
  tick(_dt: number): void {}
}
