/**
 * Intégration au système : verrou d'écran et session média.
 *
 * Ces deux mécanismes ne servent qu'en usage réel, dans la voiture, et c'est
 * précisément pour cela qu'ils sont faciles à oublier : rien ne manque tant qu'on
 * développe sur un poste fixe. En conduite, leur absence se remarque tout de
 * suite — l'écran s'éteint au bout de trente secondes, et le son se retrouve sans
 * aucun contrôle depuis l'écran verrouillé ou depuis les commandes au volant.
 */

/** Taille de la pochette générée, en pixels. */
const ARTWORK_SIZE = 512

export interface SessionHandlers {
  onPlay: () => void
  onPause: () => void
}

/**
 * Verrou d'écran.
 *
 * Le système relâche le verrou de lui-même dès que la page passe en arrière-plan,
 * et ne le rend pas au retour : il faut le redemander à chaque fois que la page
 * redevient visible, sans quoi l'écran s'éteint après le premier changement
 * d'application.
 */
export class ScreenLock {
  private sentinel: WakeLockSentinel | null = null
  private wanted = false

  /**
   * Raison du dernier refus, telle que le navigateur la donne.
   *
   * Un verrou refusé est invisible : l'écran s'éteint, et rien n'explique
   * pourquoi. Comme personne n'ira ouvrir la console au volant, la raison est
   * remontée jusqu'à l'écran.
   */
  lastError = ''

  /** Faux quand le navigateur ne fournit pas l'API — Safari avant la version 16.4. */
  readonly supported =
    typeof navigator !== 'undefined' && 'wakeLock' in navigator

  get held(): boolean {
    return this.sentinel !== null && !this.sentinel.released
  }

  constructor() {
    if (typeof document === 'undefined') return
    document.addEventListener('visibilitychange', () => {
      if (this.wanted && document.visibilityState === 'visible') void this.acquire()
    })
  }

  async enable(): Promise<void> {
    this.wanted = true
    await this.acquire()
  }

  async disable(): Promise<void> {
    this.wanted = false
    const sentinel = this.sentinel
    this.sentinel = null
    if (sentinel && !sentinel.released) await sentinel.release().catch(() => undefined)
  }

  private async acquire(): Promise<void> {
    if (!this.supported || this.held) return
    try {
      this.sentinel = await navigator.wakeLock.request('screen')
      this.lastError = ''
      this.sentinel.addEventListener('release', () => {
        this.sentinel = null
      })
    } catch (error) {
      // Refusé : page non visible, batterie faible, ou permission bloquée. On
      // réessaiera au prochain retour au premier plan plutôt que d'insister.
      this.sentinel = null
      this.lastError = describe(error)
    }
  }
}

/**
 * Session média.
 *
 * C'est elle qui donne à l'application une existence hors de sa fenêtre : une
 * tuile sur l'écran verrouillé, une entrée dans le panneau de notifications, et
 * surtout la prise en compte des commandes au volant et des boutons du casque.
 * Sans elle, mettre le son en pause impose de rallumer l'écran et de retrouver
 * l'onglet.
 */
export class MediaSession {
  readonly supported = typeof navigator !== 'undefined' && 'mediaSession' in navigator

  private artworkCache = new Map<string, string>()

  setHandlers(handlers: SessionHandlers): void {
    if (!this.supported) return
    this.assign('play', handlers.onPlay)
    this.assign('pause', handlers.onPause)
    // Ces actions n'ont pas de sens ici : les déclarer nulles évite que le
    // système affiche des boutons de navigation inertes.
    for (const action of ['previoustrack', 'nexttrack', 'seekbackward', 'seekforward'] as const) {
      this.assign(action, null)
    }
  }

  async setProfile(name: string, subtitle: string): Promise<void> {
    if (!this.supported) return
    navigator.mediaSession.metadata = new MediaMetadata({
      title: name,
      artist: subtitle,
      album: 'Speed',
      artwork: [{ src: await this.artwork(name), sizes: `${ARTWORK_SIZE}x${ARTWORK_SIZE}`, type: 'image/png' }],
    })
  }

  setPlaying(playing: boolean): void {
    if (!this.supported) return
    navigator.mediaSession.playbackState = playing ? 'playing' : 'paused'
  }

  /**
   * Pochette dessinée à la volée : le nom du profil sur un fond sombre.
   *
   * Générer plutôt qu'embarquer une image évite un asset de plus et permet à la
   * tuile de refléter le profil réellement chargé.
   */
  private async artwork(name: string): Promise<string> {
    const cached = this.artworkCache.get(name)
    if (cached) return cached

    const canvas = document.createElement('canvas')
    canvas.width = ARTWORK_SIZE
    canvas.height = ARTWORK_SIZE
    const context = canvas.getContext('2d')
    if (!context) return ''

    context.fillStyle = '#15181d'
    context.fillRect(0, 0, ARTWORK_SIZE, ARTWORK_SIZE)

    context.strokeStyle = '#e8b04b'
    context.lineWidth = 10
    context.beginPath()
    context.arc(ARTWORK_SIZE / 2, ARTWORK_SIZE / 2, ARTWORK_SIZE * 0.36, Math.PI * 0.75, Math.PI * 1.9)
    context.stroke()

    context.fillStyle = '#e6e9ee'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.font = `600 ${fitFontSize(name)}px system-ui, sans-serif`
    context.fillText(name, ARTWORK_SIZE / 2, ARTWORK_SIZE / 2, ARTWORK_SIZE * 0.62)

    const url = canvas.toDataURL('image/png')
    this.artworkCache.set(name, url)
    return url
  }

  private assign(action: MediaSessionAction, handler: (() => void) | null): void {
    try {
      navigator.mediaSession.setActionHandler(action, handler)
    } catch {
      // Action non gérée par ce navigateur : sans conséquence.
    }
  }
}

/** Traduit l'échec en une phrase compréhensible sans ouvrir la console. */
function describe(error: unknown): string {
  if (!(error instanceof Error)) return 'Verrou refusé par le système.'
  switch (error.name) {
    case 'NotAllowedError':
      return "Verrou refusé : la permission est bloquée, ou la page n'était pas au premier plan."
    case 'AbortError':
      return 'Verrou interrompu par le système, probablement pour économiser la batterie.'
    case 'SecurityError':
      return 'Verrou indisponible : la page doit être servie en HTTPS.'
    default:
      return `Verrou refusé (${error.name}).`
  }
}

/** Réduit la police pour qu'un nom long tienne dans la pochette. */
function fitFontSize(name: string): number {
  if (name.length <= 10) return 64
  if (name.length <= 16) return 48
  return 36
}
