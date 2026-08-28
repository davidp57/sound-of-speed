/**
 * Fonctionnement hors réseau.
 *
 * Une voiture traverse des zones sans couverture, et une application chargée
 * depuis Internet n'y démarre pas. Ce module installe le service worker, permet
 * de mettre les échantillons en cache avant de partir, et rend visible ce qui
 * est déjà disponible — parce qu'un cache dont on ignore le contenu ne rassure
 * personne au moment de couper les données.
 */

export interface OfflineStatus {
  /** Le navigateur sait-il faire ? Faux en navigation privée sur certains d'entre eux. */
  supported: boolean
  /** Le service worker contrôle-t-il la page ? */
  active: boolean
  /** Une version plus récente attend un rechargement. */
  updateReady: boolean
  /** L'application est-elle lancée depuis l'écran d'accueil plutôt que le navigateur ? */
  installed: boolean
  /** Le navigateur propose-t-il de l'installer ? */
  installable: boolean
  online: boolean
  /** Échantillons du profil déjà en cache. */
  cachedFiles: number
  totalFiles: number
  cachedBytes: number
  /** Mise en cache en cours. */
  caching: boolean
  error: string
}

type Listener = (status: OfflineStatus) => void

/** Évènement propre à Chrome, absent des types standards. */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export class Offline {
  private registration: ServiceWorkerRegistration | null = null
  private installPrompt: InstallPromptEvent | null = null
  private listeners = new Set<Listener>()
  private watchedUrls: string[] = []

  readonly status: OfflineStatus = {
    supported: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
    active: false,
    updateReady: false,
    installed: false,
    installable: false,
    online: typeof navigator === 'undefined' || navigator.onLine,
    cachedFiles: 0,
    totalFiles: 0,
    cachedBytes: 0,
    caching: false,
    error: '',
  }

  onChange(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(): void {
    for (const listener of this.listeners) listener({ ...this.status })
  }

  async register(): Promise<void> {
    if (typeof window === 'undefined') return

    this.status.installed =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as { standalone?: boolean }).standalone === true

    window.addEventListener('online', () => {
      this.status.online = true
      this.emit()
    })
    window.addEventListener('offline', () => {
      this.status.online = false
      this.emit()
    })

    window.addEventListener('beforeinstallprompt', (event) => {
      // Empêche la bannière spontanée du navigateur : la proposition est faite
      // par l'application, à un endroit choisi.
      event.preventDefault()
      this.installPrompt = event as InstallPromptEvent
      this.status.installable = true
      this.emit()
    })

    window.addEventListener('appinstalled', () => {
      this.installPrompt = null
      this.status.installable = false
      this.status.installed = true
      this.emit()
    })

    if (!this.status.supported) return

    navigator.serviceWorker.addEventListener('message', (event) => this.receive(event))

    try {
      this.registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      this.status.active = navigator.serviceWorker.controller !== null

      // Une version installée alors qu'une autre contrôle déjà la page signale
      // une mise à jour prête, et non une première installation.
      this.registration.addEventListener('updatefound', () => {
        const installing = this.registration?.installing
        if (!installing) return
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            this.status.updateReady = true
            this.emit()
          }
        })
      })

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        this.status.active = true
        this.emit()
      })
    } catch (error) {
      this.status.error = error instanceof Error ? error.message : 'Installation impossible.'
    }

    this.emit()
  }

  /** Propose l'installation sur l'écran d'accueil. */
  async promptInstall(): Promise<void> {
    const prompt = this.installPrompt
    if (!prompt) return
    await prompt.prompt()
    const choice = await prompt.userChoice
    if (choice.outcome === 'accepted') this.status.installed = true
    this.installPrompt = null
    this.status.installable = false
    this.emit()
  }

  /** Recharge sur la nouvelle version. */
  applyUpdate(): void {
    window.location.reload()
  }

  /** Déclare les fichiers à surveiller, et interroge le cache. */
  watch(urls: string[]): void {
    this.watchedUrls = urls
    this.status.totalFiles = urls.length
    this.send({ type: 'STATUS', urls })
  }

  /** Force la mise en cache des fichiers surveillés, avant de partir. */
  prepare(): void {
    if (this.watchedUrls.length === 0) return
    this.status.caching = true
    this.status.error = ''
    this.emit()
    this.send({ type: 'PRECACHE', urls: this.watchedUrls })
    this.send({ type: 'PRECACHE', urls: this.loadedAssets(), cache: 'assets' })
  }

  /**
   * Ressources de l'application déjà chargées par cette page.
   *
   * Au tout premier chargement, le service worker s'installe après que le
   * navigateur a récupéré le script et la feuille de style : ceux-ci échappent
   * donc à son interception, et n'entreraient en cache qu'à la visite suivante.
   * Se préparer au hors-réseau juste avant de partir n'aurait alors servi à rien.
   * La page, elle, sait ce qu'elle a chargé — autant le lui demander.
   */
  private loadedAssets(): string[] {
    if (typeof performance.getEntriesByType !== 'function') return []
    return performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .filter((name) => {
        if (!name.startsWith(window.location.origin)) return false
        const path = new URL(name).pathname
        return path.startsWith('/assets/') || path.startsWith('/icons/')
      })
  }

  private send(message: unknown): void {
    const worker = navigator.serviceWorker?.controller
    if (!worker) return
    worker.postMessage(message)
  }

  private receive(event: MessageEvent): void {
    const data = event.data as
      | { type: 'STATUS_RESULT'; cached: number; total: number; bytes: number }
      | { type: 'PRECACHE_PROGRESS'; done: number; failed: number; total: number }
      | { type: 'PRECACHE_DONE'; done: number; failed: number; total: number }
      | undefined
    if (!data) return

    if (data.type === 'STATUS_RESULT') {
      this.status.cachedFiles = data.cached
      this.status.totalFiles = data.total
      this.status.cachedBytes = data.bytes
    }

    if (data.type === 'PRECACHE_PROGRESS') {
      this.status.cachedFiles = data.done
      this.status.totalFiles = data.total
    }

    if (data.type === 'PRECACHE_DONE') {
      this.status.caching = false
      if (data.failed > 0) {
        this.status.error = `${data.failed} fichier${data.failed > 1 ? 's' : ''} n'a pas pu être mis en cache.`
      }
      // Relit les tailles réelles maintenant que tout est écrit.
      this.send({ type: 'STATUS', urls: this.watchedUrls })
    }

    this.emit()
  }
}
