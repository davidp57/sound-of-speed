/**
 * Boucle d'animation.
 *
 * Un seul `requestAnimationFrame` pour toute l'application, avec un repli sur un
 * minuteur quand la page est masquée.
 *
 * Ce repli n'est pas un détail : le navigateur gèle `requestAnimationFrame` dès
 * que la page n'est plus composée — écran éteint, onglet en arrière-plan,
 * application passée en second plan. Sans lui, la vitesse, le régime et le son
 * se figent à la dernière valeur connue au moment précis où l'on pose son
 * téléphone. Le minuteur est lui aussi ralenti par le navigateur en arrière-plan,
 * souvent à une itération par seconde ; ce sera au moteur audio, une fois en
 * place, de tenir la cadence en se calant sur l'horloge de l'AudioContext, qui
 * continue de tourner. En attendant, le repli garde l'état cohérent au retour.
 */

/** Écart maximal retenu entre deux images, en secondes. */
const MAX_STEP_S = 0.25
/** Période du minuteur de repli, en millisecondes. */
const FALLBACK_MS = 16

export type TickHandler = (dt: number) => void

export class Loop {
  private frameHandle: number | null = null
  private timerHandle: ReturnType<typeof setInterval> | null = null
  private lastAt = 0
  private started = false
  private handlers = new Set<TickHandler>()

  /** Durée de la dernière image, en millisecondes. Diagnostic. */
  lastFrameMs = 0
  /** Vrai quand la boucle tourne sur le minuteur plutôt que sur les images. */
  onFallback = false

  constructor() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (this.started) this.attachDriver()
      })
    }
  }

  add(handler: TickHandler): () => void {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  get running(): boolean {
    return this.started
  }

  start(): void {
    if (this.started) return
    this.started = true
    this.lastAt = performance.now()
    this.attachDriver()
  }

  stop(): void {
    this.started = false
    this.detachDriver()
  }

  /** Choisit la source de cadence selon que la page est visible ou non. */
  private attachDriver(): void {
    const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden'
    if (hidden === this.onFallback && (this.frameHandle !== null || this.timerHandle !== null)) {
      return
    }

    this.detachDriver()
    this.onFallback = hidden
    // Le gel a pu durer : on repart de maintenant pour ne pas intégrer d'un coup
    // tout le temps passé en arrière-plan.
    this.lastAt = performance.now()

    if (hidden) {
      this.timerHandle = setInterval(() => this.step(performance.now()), FALLBACK_MS)
    } else {
      const frame = (now: number) => {
        this.step(now)
        this.frameHandle = requestAnimationFrame(frame)
      }
      this.frameHandle = requestAnimationFrame(frame)
    }
  }

  private detachDriver(): void {
    if (this.frameHandle !== null) {
      cancelAnimationFrame(this.frameHandle)
      this.frameHandle = null
    }
    if (this.timerHandle !== null) {
      clearInterval(this.timerHandle)
      this.timerHandle = null
    }
  }

  private step(now: number): void {
    const raw = (now - this.lastAt) / 1000
    this.lastAt = now
    this.lastFrameMs = raw * 1000
    const dt = raw > MAX_STEP_S ? MAX_STEP_S : raw
    if (dt <= 0) return
    for (const handler of this.handlers) handler(dt)
  }
}
