import type { LayerPreset, Profile } from '../preset/schema'
import type { EngineState } from '../engine/engine'
import { computeMix } from './mix'

/**
 * Moteur audio à échantillons.
 *
 * Toutes les couches jouent en permanence, en boucle, dès l'activation. Seuls
 * leurs gains et leurs vitesses de lecture bougent. C'est la technique classique
 * de l'audio de jeu, et elle tient à une raison précise : démarrer et arrêter des
 * sources au fil du régime produit des discontinuités de phase, donc des clics,
 * là où un fondu entre deux boucles déjà en cours reste inaudible.
 *
 * Le calcul de ce qu'il faut appliquer ne vit pas ici — il est dans `mix.ts`,
 * sous forme de fonction pure, ce qui permet à l'écran de télémétrie d'afficher
 * exactement les valeurs que ce moteur va poser sur les nœuds.
 */

/** Constante de lissage des gains, en secondes. Assez courte pour suivre, assez longue pour ne pas cliquer. */
const GAIN_GLIDE_S = 0.02
/** Constante de lissage de la vitesse de lecture. Plus longue : un saut de hauteur s'entend davantage. */
const RATE_GLIDE_S = 0.03
/** Période de la surveillance du contexte et du média, en millisecondes. */
const WATCHDOG_MS = 2000
/**
 * Adresse du silence qui maintient la session audio.
 *
 * Un fichier servi, produit par `npm run silence` et versionné avec son script.
 * Il est hors de `public/audio/`, qui n'est pas versionné : cette arborescence
 * est celle des échantillons, déposés dans un volume du NAS.
 */
const SILENCE_URL = '/silence.mp3'
/** Durée du fondu appliqué aux boucles mal raccordées, en secondes. */
const SEAM_FADE_S = 0.03
/** Fondu, bien plus court, quand le point de bouclage a pu être aligné. */
const ALIGNED_FADE_S = 0.008
/** Discontinuité au-delà de laquelle on recolle la boucle. */
const SEAM_THRESHOLD = 0.005
/** Durée du motif comparé pour trouver le point de bouclage, en secondes. */
const MATCH_WINDOW_S = 0.03
/** Portion de fin explorée à la recherche de ce point, en secondes. */
const SEARCH_SPAN_S = 0.4
/** Poids de la forme d'onde devant l'écart de niveau, dans le choix du raccord. */
const SHAPE_WEIGHT = 0.35

export type AudioPhase = 'idle' | 'loading' | 'ready' | 'error'

export interface AudioStatus {
  phase: AudioPhase
  loaded: number
  total: number
  error: string
  contextState: AudioContextState | 'none'
  sampleRate: number
  /** Vrai quand la cadence est fournie par le fil audio plutôt que par l'affichage. */
  clockRunning: boolean
  /** Couches dont la boucle a dû être recollée au chargement. */
  repaired: string[]
  /** Niveau efficace en sortie, de 0 à 1. Dit si quelque chose sort vraiment. */
  outputLevel: number
  /** Niveau crête récent, de 0 à 1. Au-delà de 1, la sortie écrête. */
  outputPeak: number
  /**
   * Latence propre au traitement, en millisecondes.
   */
  baseLatencyMs: number
  /**
   * Délai entre la demande d'un son et sa sortie effective du haut-parleur, en
   * millisecondes.
   *
   * Aucun code ne peut l'annuler : elle appartient au chemin audio du système,
   * et une liaison sans fil y ajoute couramment cent à trois cents
   * millisecondes. C'est la première chose à regarder quand le son paraît
   * traîner derrière l'affichage, avant de soupçonner le calcul.
   */
  outputLatencyMs: number
  /** Le maintien de session est-il demandé ? */
  keepAlive: boolean
  /** Le média de maintien joue-t-il réellement, à cet instant ? */
  keepAlivePlaying: boolean
  /**
   * Ce que le navigateur a refusé, s'il a refusé.
   *
   * Un refus de lecture était avalé, donc invisible : on ne pouvait pas
   * distinguer « le maintien ne suffit pas » de « le maintien n'a jamais
   * démarré ». Vide quand tout va bien.
   */
  keepAliveError: string
  /**
   * Nombre de fois qu'il a fallu relancer le contexte depuis l'activation.
   *
   * Zéro dit que le système ne l'a jamais suspendu — et donc que la
   * surveillance périodique ne sert à rien, ce qu'on veut savoir.
   */
  contextResumes: number
  /** Nombre de salves de pétarade déclenchées depuis l'activation. */
  backfires: number
}

interface LoadedLayer {
  key: string
  source: AudioBufferSourceNode
  gain: GainNode
}

/**
 * Horloge sur le fil audio.
 *
 * Le navigateur gèle l'affichage et ralentit les minuteurs d'une page en
 * arrière-plan, mais le fil audio, lui, continue de tourner à cadence fixe tant
 * que le contexte est actif. Faire battre la simulation depuis ce fil est donc le
 * seul moyen d'obtenir un son qui ne se fige pas quand on pose son téléphone.
 */
const CLOCK_WORKLET = `
class ClockProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.elapsed = 0
    this.period = sampleRate / 60
  }
  process() {
    this.elapsed += 128
    if (this.elapsed >= this.period) {
      this.elapsed = 0
      this.port.postMessage(currentTime)
    }
    return true
  }
}
registerProcessor('speed-clock', ClockProcessor)
`

export class AudioEngine {
  private context: AudioContext | null = null
  private layers: LoadedLayer[] = []
  private bus: GainNode | null = null
  private highpass: BiquadFilterNode | null = null
  private shaper: WaveShaperNode | null = null
  private limiter: DynamicsCompressorNode | null = null
  private makeup: GainNode | null = null
  private watchdog: ReturnType<typeof setInterval> | null = null
  private analyser: AnalyserNode | null = null
  private scope: Float32Array<ArrayBuffer> | null = null
  private keepAlive: HTMLAudioElement | null = null
  private clock: AudioWorkletNode | null = null

  private appliedDrive = -1
  private loadToken = 0
  /** Bruit blanc court, réutilisé par toutes les pétarades. */
  private noise: AudioBuffer | null = null

  readonly status: AudioStatus = {
    phase: 'idle',
    loaded: 0,
    total: 0,
    error: '',
    contextState: 'none',
    sampleRate: 0,
    clockRunning: false,
    repaired: [],
    outputLevel: 0,
    outputPeak: 0,
    baseLatencyMs: 0,
    outputLatencyMs: 0,
    keepAlive: false,
    keepAlivePlaying: false,
    keepAliveError: '',
    contextResumes: 0,
    backfires: 0,
  }

  /** Appelé à chaque battement de l'horloge audio, quand elle est en place. */
  onClockTick: ((dt: number) => void) | null = null

  private lastClockTime = 0

  get isReady(): boolean {
    return this.status.phase === 'ready'
  }

  /**
   * Prépare le contexte et charge les échantillons.
   *
   * Doit être appelé depuis un geste de l'utilisateur : les navigateurs
   * refusent de démarrer un contexte audio autrement, et l'échec est silencieux.
   */
  async activate(profile: Profile): Promise<void> {
    if (!this.context) {
      const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) {
        this.fail("Ce navigateur ne fournit pas l'API Web Audio.")
        return
      }
      this.context = new Ctor({ latencyHint: 'interactive' })
      this.buildBus(this.context)
      this.startKeepAlive()
      await this.startClock(this.context)
    }

    if (this.context.state === 'suspended') await this.context.resume()
    this.status.contextState = this.context.state
    this.status.sampleRate = this.context.sampleRate
    this.readLatency()

    await this.load(profile)
  }

  /** Chaîne de sortie, commune à toutes les couches. */
  private buildBus(context: AudioContext): void {
    this.bus = context.createGain()
    this.highpass = context.createBiquadFilter()
    this.shaper = context.createWaveShaper()
    this.limiter = context.createDynamicsCompressor()
    this.analyser = context.createAnalyser()
    this.analyser.fftSize = 1024
    this.scope = new Float32Array(this.analyser.fftSize)

    this.highpass.type = 'highpass'
    this.highpass.Q.value = 0.7
    this.shaper.oversample = '4x'

    // Rapport élevé et attaque courte : ce n'est pas un compresseur d'effet, il
    // est là pour empêcher la somme des couches de saturer en sortie.
    this.limiter.knee.value = 3
    this.limiter.ratio.value = 12
    this.limiter.attack.value = 0.002
    this.limiter.release.value = 0.12

    this.bus.connect(this.highpass)
    this.highpass.connect(this.shaper)
    this.shaper.connect(this.limiter)
    this.makeup = context.createGain()
    // Le limiteur ramène les crêtes bien en dessous du plafond ; ce gain rend le
    // niveau perdu, sans risque d'écrêtage puisqu'il vient après lui.
    this.makeup.gain.value = 1.8
    this.limiter.connect(this.makeup)
    this.makeup.connect(this.analyser)
    this.analyser.connect(context.destination)
  }

  /**
   * Un média silencieux qui tourne en boucle.
   *
   * Sur mobile, la session audio du système est libérée dès que plus aucun
   * élément média ne joue, et le contexte est suspendu quand l'application passe
   * en arrière-plan. Garder un lecteur actif, même muet, maintient la session
   * ouverte — c'est ce qui permet au son de survivre à l'écran éteint.
   */
  /**
   * Relève les latences annoncées par le navigateur. `outputLatency` n'est pas
   * fourni partout ; il vaut alors zéro, ce qui signifie « inconnu » et non
   * « nul ».
   */
  private readLatency(): void {
    const context = this.context
    if (!context) return
    this.status.baseLatencyMs = (context.baseLatency ?? 0) * 1000
    this.status.outputLatencyMs = (context.outputLatency ?? 0) * 1000
  }

  /**
   * Active ou coupe le média silencieux.
   *
   * Il sert à empêcher le système de libérer la session audio quand
   * l'application passe en arrière-plan. Mais faire tourner un lecteur média en
   * parallèle du graphe peut, sur certains téléphones, faire basculer la sortie
   * vers un chemin plus tamponné, donc plus lent. Pouvoir l'éteindre permet de
   * vérifier s'il est en cause quand le son traîne.
   */
  setKeepAlive(enabled: boolean): void {
    if (enabled === this.status.keepAlive) return
    if (enabled) this.startKeepAlive()
    else {
      this.status.keepAlive = false
      this.status.keepAliveError = ''
      const media = this.keepAlive
      this.keepAlive = null
      this.status.keepAlivePlaying = false
      media?.pause()
      // Retiré du document, et pas seulement arrêté : laisser traîner un lecteur
      // muet embrouillerait le diagnostic suivant.
      media?.remove()
    }
    this.readLatency()
  }

  /**
   * Le média de maintien, construit comme un lecteur véritable.
   *
   * Chaque détail de cette construction a une raison, apprise en comparant avec
   * une application qui, elle, tient le son quand le navigateur de la voiture
   * est réduit :
   *
   * - **inséré dans le document**, et non simplement construit. Un élément
   *   détaché joue, mais rien ne garantit qu'un navigateur ancien le compte
   *   comme une lecture — et c'est de ce décompte que dépend le droit de
   *   continuer en arrière-plan ;
   * - **un fichier servi**, et non une adresse `blob:` fabriquée en mémoire. La
   *   pile média du navigateur de la Tesla, un Chromium ancien, ne la traitait
   *   pas comme une lecture véritable ;
   * - **long**, deux minutes plutôt que quatre secondes : chaque passage de
   *   boucle est une occasion de perdre la lecture ;
   * - **`volume = 1`**, bien que le contenu soit déjà silencieux. Baisser le
   *   volume ferait passer le lecteur pour inactif auprès de certains systèmes,
   *   qui libéreraient la session — précisément ce qu'il sert à empêcher.
   */
  private startKeepAlive(): void {
    // Un seul média à la fois. Le chemin qui y menait deux fois est réel :
    // basculer le réglage avant d'activer le son en crée un — le moteur ignore
    // encore qu'il en faut un — puis `activate()` en crée un second. Détachés
    // du document, les doublons passaient inaperçus ; insérés, ils
    // embrouilleraient exactement le diagnostic que ce média sert à établir.
    if (this.keepAlive) return

    const audio = document.createElement('audio')
    const source = document.createElement('source')
    source.type = 'audio/mpeg'
    source.src = SILENCE_URL
    audio.appendChild(source)
    audio.loop = true
    audio.volume = 1
    audio.preload = 'auto'
    audio.setAttribute('playsinline', '')
    audio.style.display = 'none'

    // Un refus du navigateur était jusqu'ici avalé, donc invisible : on ne
    // pouvait pas distinguer « le maintien ne suffit pas » de « le maintien n'a
    // jamais démarré ». Personne n'ouvrira une console au volant, la raison
    // remonte donc jusqu'à l'écran de télémétrie.
    audio.addEventListener('error', () => {
      const code = audio.error?.code
      this.status.keepAliveError = code
        ? `Média refusé par le navigateur (code ${code}).`
        : 'Média refusé par le navigateur.'
    })
    // Certains navigateurs suspendent un média sorti de l'écran : on le relance.
    audio.addEventListener('pause', () => {
      if (this.status.keepAlive) this.playKeepAlive(audio)
    })
    audio.addEventListener('playing', () => {
      this.status.keepAliveError = ''
    })

    document.body.appendChild(audio)
    this.playKeepAlive(audio)
    this.keepAlive = audio
    this.status.keepAlive = true

    // Surveillance permanente, et non seulement au retour au premier plan.
    // Certains navigateurs embarqués suspendent le contexte sans prévenir et
    // sans repasser par un changement de visibilité.
    //
    // Elle est conservée mais **comptée** : un minuteur est de toute façon gelé
    // quand la page l'est, donc son utilité réelle est douteuse. Le compteur
    // tranchera — s'il reste à zéro en voiture, cette surveillance partira.
    if (this.watchdog === null) {
      this.watchdog = setInterval(() => {
        const context = this.context
        if (!context) return
        if (context.state === 'suspended') this.resumeContext(context)
        const media = this.keepAlive
        if (media && media.paused) this.playKeepAlive(media)
      }, WATCHDOG_MS)
    }
  }

  /** Relance le média, en retenant le refus éventuel. */
  private playKeepAlive(audio: HTMLAudioElement): void {
    void audio.play().then(
      () => {
        this.status.keepAliveError = ''
      },
      (error: unknown) => {
        this.status.keepAliveError = describePlayFailure(error)
      },
    )
  }

  /** Relance le contexte, en comptant combien de fois il a fallu le faire. */
  private resumeContext(context: AudioContext): void {
    this.status.contextResumes += 1
    void context.resume().catch(() => undefined)
  }

  private async startClock(context: AudioContext): Promise<void> {
    try {
      const url = URL.createObjectURL(new Blob([CLOCK_WORKLET], { type: 'text/javascript' }))
      await context.audioWorklet.addModule(url)
      URL.revokeObjectURL(url)

      const node = new AudioWorkletNode(context, 'speed-clock')
      node.port.onmessage = (event: MessageEvent<number>) => {
        const now = event.data
        const dt = this.lastClockTime > 0 ? now - this.lastClockTime : 0
        this.lastClockTime = now
        if (dt > 0 && dt < 0.25) this.onClockTick?.(dt)
      }

      // Un nœud sans destination peut être écarté du graphe : on le raccorde par
      // un gain nul, ce qui le maintient traité sans rien produire.
      const mute = context.createGain()
      mute.gain.value = 0
      node.connect(mute)
      mute.connect(context.destination)

      this.clock = node
      this.status.clockRunning = true
    } catch {
      // Pas d'AudioWorklet : on reste sur la cadence de l'affichage, avec le
      // repli par minuteur. Le son se fige en arrière-plan, sans plus.
      this.status.clockRunning = false
    }
  }

  /** (Re)charge les couches déclarées par le profil. */
  async load(profile: Profile): Promise<void> {
    const context = this.context
    if (!context) return

    const token = ++this.loadToken
    const wanted = profile.layers.filter((layer) => layer.enabled && layer.file)

    this.status.phase = 'loading'
    this.status.loaded = 0
    this.status.total = wanted.length
    this.status.error = ''
    this.status.repaired = []

    let decoded: { layer: LayerPreset; buffer: AudioBuffer; repaired: boolean }[]
    try {
      decoded = await Promise.all(
        wanted.map(async (layer) => {
          const url = `/audio/${profile.sampleDir}/${layer.file}`
          const response = await fetch(url)
          if (!response.ok) throw new Error(`${layer.file} : ${response.status}`)
          const raw = await context.decodeAudioData(await response.arrayBuffer())
          const { buffer, repaired } = makeSeamless(context, raw)
          this.status.loaded += 1
          return { layer, buffer, repaired }
        }),
      )
    } catch (error) {
      if (token !== this.loadToken) return
      this.fail(error instanceof Error ? error.message : 'Chargement impossible.')
      return
    }

    // Un second chargement a pu être lancé pendant celui-ci : on abandonne le
    // résultat périmé plutôt que de brancher deux jeux de couches à la fois.
    if (token !== this.loadToken) return

    this.disposeLayers()

    for (const { layer, buffer, repaired } of decoded) {
      const source = context.createBufferSource()
      const gain = context.createGain()
      source.buffer = buffer
      source.loop = true
      gain.gain.value = 0
      source.connect(gain)
      if (this.bus) gain.connect(this.bus)
      // Départ à une position aléatoire : sans cela, deux couches issues du même
      // enregistrement restent en phase et se renforcent en peigne.
      source.start(0, Math.random() * buffer.duration)
      this.layers.push({ key: layer.key, source, gain })
      if (repaired) this.status.repaired.push(layer.key)
    }

    this.status.phase = 'ready'
    this.status.contextState = context.state
  }

  /** Applique le mixage calculé pour l'image courante. */
  update(
    profile: Profile,
    state: EngineState,
    shift?: { isShifting: boolean; progress: number },
  ): void {
    const context = this.context
    if (!context || this.status.phase !== 'ready') return

    const now = context.currentTime
    const mix = computeMix(profile, state, shift)

    for (const entry of mix.layers) {
      const node = this.layers.find((layer) => layer.key === entry.key)
      if (!node) continue
      node.gain.gain.setTargetAtTime(entry.gain, now, GAIN_GLIDE_S)
      node.source.playbackRate.setTargetAtTime(entry.rate, now, RATE_GLIDE_S)
    }

    if (this.highpass) this.highpass.frequency.setTargetAtTime(profile.mix.highpassHz, now, 0.1)
    if (this.limiter) {
      this.limiter.threshold.setTargetAtTime(profile.mix.limiterThresholdDb, now, 0.1)
    }
    if (this.shaper && profile.mix.drive !== this.appliedDrive) {
      this.appliedDrive = profile.mix.drive
      this.shaper.curve = saturationCurve(profile.mix.drive)
    }

    this.measureOutput()
    this.readLatency()
    this.status.contextState = context.state
  }

  /**
   * Niveau de sortie.
   *
   * Sans cette mesure, rien ne distingue « le son marche » de « le graphe est
   * bien monté mais tous les gains sont à zéro » — les deux se ressemblent
   * beaucoup quand on ne peut pas écouter.
   */
  private measureOutput(): void {
    const analyser = this.analyser
    const scope = this.scope
    if (!analyser || !scope) return

    analyser.getFloatTimeDomainData(scope)
    let sum = 0
    let peak = 0
    for (let i = 0; i < scope.length; i += 1) {
      const value = scope[i] ?? 0
      sum += value * value
      const magnitude = Math.abs(value)
      if (magnitude > peak) peak = magnitude
    }
    this.status.outputLevel = Math.sqrt(sum / scope.length)
    this.status.outputPeak = peak
    // Relevé au même rythme que le niveau : un média qui s'arrête en
    // arrière-plan doit se voir dès le retour à l'écran, pas au prochain
    // changement d'état.
    this.status.keepAlivePlaying = this.keepAlive !== null && !this.keepAlive.paused
    // Idem pour l'état du contexte : il n'était relevé qu'aux transitions, donc
    // une suspension par le système ne s'y voyait qu'au retour au premier plan.
    if (this.context) this.status.contextState = this.context.state
  }

  /**
   * Relance le contexte s'il a été suspendu.
   *
   * Le système suspend le contexte quand l'application passe longuement en
   * arrière-plan, ou quand un appel prend la main sur la sortie audio. Il ne le
   * relance jamais de lui-même : sans cette reprise, le son ne revient plus.
   */
  async resumeIfSuspended(): Promise<boolean> {
    const context = this.context
    if (!context) return false
    // Lecture indirecte : l'état change pendant l'attente, alors que le
    // rétrécissement de type opéré par un test direct resterait figé sur la
    // valeur d'avant.
    const readState = (): AudioContextState => context.state
    if (readState() !== 'suspended') return false

    this.status.contextResumes += 1
    await context.resume().catch(() => undefined)
    const state = readState()
    this.status.contextState = state
    return state === 'running'
  }

  /**
   * Pétarade à la décélération.
   *
   * Le claquement d'un imbrûlé qui prend feu dans l'échappement : une impulsion
   * très brève, plutôt grave, avec une queue de souffle. On la synthétise plutôt
   * que de l'échantillonner — quelques dizaines de millisecondes de bruit filtré
   * suffisent, et cela évite de dépendre d'un enregistrement que la banque
   * sonore ne contient pas.
   */
  backfire(intensity: number, count: number): void {
    const context = this.context
    if (!context || this.status.phase !== 'ready' || !this.bus) return

    this.status.backfires += 1
    const now = context.currentTime
    for (let i = 0; i < count; i += 1) {
      // Les claquements ne sont jamais réguliers : c'est ce qui les distingue
      // d'un crépitement mécanique.
      const at = now + Math.random() * 0.28 + i * 0.045
      const duration = 0.05 + Math.random() * 0.07

      const source = context.createBufferSource()
      source.buffer = this.noise ?? (this.noise = makeNoise(context))
      source.playbackRate.value = 0.7 + Math.random() * 0.6
      source.loop = true

      const band = context.createBiquadFilter()
      band.type = 'bandpass'
      band.frequency.value = 260 + Math.random() * 420
      band.Q.value = 1.4

      const gain = context.createGain()
      const peak = intensity * (0.5 + Math.random() * 0.5)
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + 0.004)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + duration)

      source.connect(band)
      band.connect(gain)
      gain.connect(this.bus)
      source.start(at)
      source.stop(at + duration + 0.02)
    }
  }

  /**
   * Coupe le son sans démonter le contexte : les couches restent chargées.
   *
   * Le niveau continue d'être relevé pendant la coupure. Sans cela l'indicateur
   * resterait figé sur sa dernière valeur, donnant à croire que du son sort
   * encore — un afficheur qui ment sur l'état est pire que pas d'afficheur.
   */
  mute(): void {
    if (!this.context) return
    const now = this.context.currentTime
    for (const layer of this.layers) layer.gain.gain.setTargetAtTime(0, now, GAIN_GLIDE_S)
    this.measureOutput()
  }

  async dispose(): Promise<void> {
    if (this.watchdog !== null) {
      clearInterval(this.watchdog)
      this.watchdog = null
    }
    this.disposeLayers()
    this.clock?.port.close()
    this.clock?.disconnect()
    this.clock = null
    this.keepAlive?.pause()
    this.keepAlive = null
    if (this.context) await this.context.close()
    this.context = null
    this.status.phase = 'idle'
    this.status.clockRunning = false
    this.status.contextState = 'none'
  }

  private disposeLayers(): void {
    for (const layer of this.layers) {
      try {
        layer.source.stop()
      } catch {
        // Déjà arrêtée : sans conséquence.
      }
      layer.source.disconnect()
      layer.gain.disconnect()
    }
    this.layers = []
  }

  private fail(message: string): void {
    this.status.phase = 'error'
    this.status.error = message
  }
}

/**
 * Recolle une boucle dont les extrémités ne se rejoignent pas.
 *
 * Fondre simplement la queue sur le début ne suffit pas : les deux portions sont
 * décorrélées, leurs harmoniques se combinent au hasard des phases et s'annulent
 * en partie. Sur la prise bas régime, ce creux atteignait trois fois l'ampleur
 * des variations ordinaires du signal et s'entendait comme un gargouillis
 * revenant toutes les quelques secondes — d'autant plus net que c'est la couche
 * la plus jouée.
 *
 * On cherche donc *où* boucler : l'endroit, vers la fin, dont le voisinage
 * ressemble le plus au début, en niveau comme en forme. Couper là met les phases
 * en accord et quelques millisecondes de fondu suffisent.
 *
 * Mais aucun critère indirect ne garantit le résultat — sur une prise en rampe,
 * l'alignement empire les choses. On mesure donc ce qui compte vraiment, le saut
 * d'énergie au raccord, pour les deux versions, et on garde la meilleure. La
 * réparation ne peut ainsi jamais dégrader ce qu'elle prétend corriger.
 */
function makeSeamless(
  context: AudioContext,
  buffer: AudioBuffer,
): { buffer: AudioBuffer; repaired: boolean } {
  const sampleRate = buffer.sampleRate
  const longFade = Math.min(Math.floor(SEAM_FADE_S * sampleRate), Math.floor(buffer.length / 4))
  if (longFade < 8) return { buffer, repaired: false }

  let discontinuity = 0
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel)
    discontinuity = Math.max(
      discontinuity,
      Math.abs((data[0] ?? 0) - (data[buffer.length - 1] ?? 0)),
    )
  }

  const reference = cut(context, buffer, buffer.length, longFade)
  const referenceSeam = seamStep(reference)

  const point = findLoopPoint(buffer)
  if (point !== null) {
    const shortFade = Math.max(4, Math.floor(ALIGNED_FADE_S * sampleRate))
    const aligned = cut(context, buffer, point, shortFade)
    if (seamStep(aligned) < referenceSeam) return { buffer: aligned, repaired: true }
  }

  if (discontinuity <= SEAM_THRESHOLD) return { buffer, repaired: false }
  return { buffer: reference, repaired: true }
}

/** Raccourcit le buffer à `end` et fond la queue sur le début. */
function cut(
  context: AudioContext,
  buffer: AudioBuffer,
  end: number,
  fade: number,
): AudioBuffer {
  const length = Math.max(1, end - fade)
  const output = context.createBuffer(buffer.numberOfChannels, length, buffer.sampleRate)

  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const input = buffer.getChannelData(channel)
    const target = output.getChannelData(channel)
    target.set(input.subarray(0, length))
    for (let i = 0; i < fade; i += 1) {
      const t = i / fade
      const head = target[i] ?? 0
      const tail = input[length + i] ?? 0
      // Fondu à puissance constante : une rampe linéaire creuserait le niveau au
      // milieu du raccord.
      target[i] = head * Math.sin((t * Math.PI) / 2) + tail * Math.cos((t * Math.PI) / 2)
    }
  }
  return output
}

/**
 * Saut d'énergie à la jonction, rapporté au niveau voisin.
 *
 * C'est la grandeur que l'oreille relève : une marche de niveau qui revient à
 * chaque tour. On compare la fin du buffer à son début, puisque c'est ce que la
 * lecture en boucle enchaîne.
 */
function seamStep(buffer: AudioBuffer): number {
  const window = Math.floor(0.02 * buffer.sampleRate)
  const data = buffer.getChannelData(0)
  if (buffer.length < window * 2) return Number.POSITIVE_INFINITY

  let head = 0
  let tail = 0
  for (let i = 0; i < window; i += 1) {
    head += (data[i] ?? 0) ** 2
    tail += (data[buffer.length - window + i] ?? 0) ** 2
  }
  const headRms = Math.sqrt(head / window)
  const tailRms = Math.sqrt(tail / window)
  return Math.abs(headRms - tailRms) / (Math.max(headRms, tailRms) + 1e-9)
}

/**
 * Cherche le meilleur point de bouclage vers la fin de l'échantillon.
 *
 * Le coût retenu mêle l'écart de niveau et la dissemblance de forme, le niveau
 * pesant davantage : c'est lui qui s'entend. Retourne `null` quand
 * l'échantillon est trop court pour qu'une recherche ait un sens.
 */
function findLoopPoint(buffer: AudioBuffer): number | null {
  const data = buffer.getChannelData(0)
  const window = Math.floor(MATCH_WINDOW_S * buffer.sampleRate)
  const span = Math.min(Math.floor(SEARCH_SPAN_S * buffer.sampleRate), Math.floor(buffer.length / 3))
  const from = buffer.length - span
  if (from <= window) return null

  let bestEnd: number | null = null
  let bestCost = Number.POSITIVE_INFINITY

  // Un candidat sur deux, un point sur deux dans la fenêtre : la précision reste
  // très inférieure à la période du signal, pour un quart du coût.
  for (let end = from; end < buffer.length - window; end += 2) {
    let dot = 0
    let headEnergy = 0
    let tailEnergy = 0
    for (let k = 0; k < window; k += 2) {
      const head = data[k] ?? 0
      const tail = data[end - window + k] ?? 0
      dot += head * tail
      headEnergy += head * head
      tailEnergy += tail * tail
    }
    const levelGap =
      Math.abs(Math.sqrt(headEnergy) - Math.sqrt(tailEnergy)) /
      (Math.max(Math.sqrt(headEnergy), Math.sqrt(tailEnergy)) + 1e-9)
    const shapeGap = 1 - dot / (Math.sqrt(headEnergy * tailEnergy) + 1e-12)
    const cost = levelGap + SHAPE_WEIGHT * shapeGap

    if (cost < bestCost) {
      bestCost = cost
      bestEnd = end
    }
  }

  return bestEnd
}

/** Une seconde de bruit blanc, source de toutes les impulsions. */
function makeNoise(context: AudioContext): AudioBuffer {
  const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1
  return buffer
}

/** Courbe de saturation douce. À 0, la courbe est droite et n'altère rien. */
function saturationCurve(drive: number): Float32Array {
  const amount = Math.max(0, Math.min(1, drive)) * 4
  const size = 1024
  const curve = new Float32Array(size)
  const norm = amount > 0 ? Math.tanh(amount) : 1
  for (let i = 0; i < size; i += 1) {
    const x = (i / (size - 1)) * 2 - 1
    curve[i] = amount > 0 ? Math.tanh(x * amount) / norm : x
  }
  return curve
}

/**
 * Traduit un refus de lecture en une phrase lisible sans console.
 *
 * `NotAllowedError` est le cas courant : le navigateur exige un geste de
 * l'utilisateur, ou refuse un second lecteur. C'est exactement ce qu'on
 * soupçonnait sans pouvoir le vérifier.
 */
function describePlayFailure(error: unknown): string {
  if (!(error instanceof Error)) return 'Lecture du média de maintien refusée.'
  switch (error.name) {
    case 'NotAllowedError':
      return 'Média refusé : le navigateur exige un geste, ou n’accepte qu’un lecteur.'
    case 'NotSupportedError':
      return 'Média refusé : format non pris en charge par ce navigateur.'
    case 'AbortError':
      return 'Lecture du média interrompue par le système.'
    default:
      return `Média refusé (${error.name}).`
  }
}
