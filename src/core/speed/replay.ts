import { SpeedSource, type SpeedSample } from './source'
import { timeScaleOfSamples } from './timescale'

/**
 * Rejeu d'une trace enregistrée.
 *
 * Rejouer un trajet réel autant de fois qu'on veut, à l'identique, rend
 * reproductible le réglage du lissage et des seuils de passage, au lieu de le
 * faire dépendre d'un aller-retour sur route.
 *
 * **D'où viennent les traces qu'il rejoue.** De l'étalonnage embarqué, qui les
 * enregistre étape par étape et les garde dans le stockage local. Le panneau de
 * l'écran Télémétrie qui permettait d'en enregistrer à la main, de les exporter
 * et de les réimporter a été retiré avec l'arrivée du relecteur : la capture du
 * trajet remonte désormais toute seule au serveur, et c'est le relecteur qui
 * sert à revoir un trajet.
 */

export interface Trace {
  /** Nom donné à la trace au moment de l'enregistrement. */
  name: string
  /** Horodatage du début, en millisecondes. */
  startedAt: number
  /** Échantillons bruts, dans l'ordre, tels que la source les a émis. */
  samples: SpeedSample[]
}

export class ReplaySource extends SpeedSource {
  readonly kind = 'replay' as const
  readonly label = 'Rejeu'

  private index = 0
  private elapsedMs = 0
  private running = false
  private baseAt = 0
  /**
   * Diviseur qui ramène les horodatages de la trace en millisecondes.
   *
   * Une trace enregistrée dans la voiture porte des microsecondes : sans lui, le
   * rejeu attendait mille fois trop longtemps entre deux échantillons — une
   * trace de soixante secondes se déroulait sur seize heures, donc ne se
   * rejouait pas. Les traces déjà déposées sur le serveur restent lisibles
   * telles quelles, ce qui est le seul moyen de rejouer l'essai du 9 septembre
   * 2026.
   */
  private timeScale = 1

  constructor(
    private trace: Trace,
    /** 1 = temps réel, 0.5 = deux fois plus lent, 2 = deux fois plus vite. */
    public rate = 1,
  ) {
    super()
    this.adopt(trace)
  }

  setTrace(trace: Trace): void {
    this.adopt(trace)
    this.rewind()
  }

  /** Prend une trace, et relève l'unité dans laquelle elle est horodatée. */
  private adopt(trace: Trace): void {
    this.trace = trace
    this.baseAt = trace.samples[0]?.at ?? trace.startedAt
    this.timeScale = timeScaleOfSamples(trace.samples)
  }

  /** Instant d'un échantillon depuis le début de la trace, en millisecondes. */
  private offsetMs(sample: SpeedSample): number {
    return (sample.at - this.baseAt) / this.timeScale
  }

  getTrace(): Trace {
    return this.trace
  }

  /** Durée totale de la trace, en secondes. */
  get durationS(): number {
    const last = this.trace.samples[this.trace.samples.length - 1]
    if (!last) return 0
    return this.offsetMs(last) / 1000
  }

  /** Progression, de 0 à 1. */
  get progress(): number {
    const total = this.durationS
    return total > 0 ? Math.min(1, this.elapsedMs / 1000 / total) : 0
  }

  get isFinished(): boolean {
    return this.index >= this.trace.samples.length
  }

  rewind(): void {
    this.index = 0
    this.elapsedMs = 0
  }

  start(): void {
    if (this.trace.samples.length === 0) {
      this.setStatus('unavailable', 'trace vide')
      return
    }
    this.running = true
    this.setStatus('active')
  }

  stop(): void {
    this.running = false
    this.setStatus('idle')
  }

  override tick(dt: number): void {
    if (!this.running || dt <= 0) return

    this.elapsedMs += dt * 1000 * this.rate

    // Émet tous les échantillons dont l'heure est passée. En rejeu accéléré il
    // peut y en avoir plusieurs dans la même image : c'est voulu, le
    // conditionnement en aval s'en accommode.
    while (this.index < this.trace.samples.length) {
      const sample = this.trace.samples[this.index]
      if (!sample) break
      if (this.offsetMs(sample) > this.elapsedMs) break
      this.emit(sample)
      this.index += 1
    }

    if (this.isFinished) {
      this.running = false
      this.setStatus('idle', 'trace terminée')
    }
  }
}

/** Enregistreur : branché sur une source, il accumule ce qu'elle émet. */
export class TraceRecorder {
  private samples: SpeedSample[] = []
  private startedAt = 0
  private recording = false

  get isRecording(): boolean {
    return this.recording
  }

  get count(): number {
    return this.samples.length
  }

  start(): void {
    this.samples = []
    this.startedAt = Date.now()
    this.recording = true
  }

  push(sample: SpeedSample): void {
    if (this.recording) this.samples.push(sample)
  }

  stop(name: string): Trace {
    this.recording = false
    return { name, startedAt: this.startedAt, samples: this.samples }
  }
}
