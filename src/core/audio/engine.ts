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
/** Durée du fondu appliqué aux boucles mal raccordées, en secondes. */
const SEAM_FADE_S = 0.03
/** Discontinuité au-delà de laquelle on recolle la boucle. */
const SEAM_THRESHOLD = 0.005

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
  /** Le média silencieux qui maintient la session tourne-t-il ? */
  keepAlive: boolean
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
  private analyser: AnalyserNode | null = null
  private scope: Float32Array<ArrayBuffer> | null = null
  private keepAlive: HTMLAudioElement | null = null
  private clock: AudioWorkletNode | null = null

  private appliedDrive = -1
  private loadToken = 0

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
    this.limiter.connect(this.analyser)
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
      this.keepAlive?.pause()
      this.keepAlive = null
      this.status.keepAlive = false
    }
    this.readLatency()
  }

  private startKeepAlive(): void {
    const audio = new Audio(silentWavUrl(4))
    audio.loop = true
    audio.volume = 0
    audio.setAttribute('playsinline', '')
    void audio.play().catch(() => undefined)
    this.keepAlive = audio
    this.status.keepAlive = true
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
  update(profile: Profile, state: EngineState): void {
    const context = this.context
    if (!context || this.status.phase !== 'ready') return

    const now = context.currentTime
    const mix = computeMix(profile, state)

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

    await context.resume().catch(() => undefined)
    const state = readState()
    this.status.contextState = state
    return state === 'running'
  }

  /** Coupe le son sans démonter le contexte : les couches restent chargées. */
  mute(): void {
    if (!this.context) return
    const now = this.context.currentTime
    for (const layer of this.layers) layer.gain.gain.setTargetAtTime(0, now, GAIN_GLIDE_S)
  }

  async dispose(): Promise<void> {
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
 * Un échantillon dont le dernier point est loin du premier produit un clic à
 * chaque tour — d'autant plus audible que la boucle est courte et rejouée
 * souvent. On raccourcit le buffer du temps d'un fondu et on mélange la queue au
 * début, ce qui rend le raccord continu au prix de quelques millisecondes.
 */
function makeSeamless(
  context: AudioContext,
  buffer: AudioBuffer,
): { buffer: AudioBuffer; repaired: boolean } {
  const fade = Math.min(Math.floor(SEAM_FADE_S * buffer.sampleRate), Math.floor(buffer.length / 4))
  if (fade < 8) return { buffer, repaired: false }

  let discontinuity = 0
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel)
    const first = data[0] ?? 0
    const last = data[buffer.length - 1] ?? 0
    discontinuity = Math.max(discontinuity, Math.abs(first - last))
  }
  if (discontinuity <= SEAM_THRESHOLD) return { buffer, repaired: false }

  const length = buffer.length - fade
  const output = context.createBuffer(buffer.numberOfChannels, length, buffer.sampleRate)

  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const input = buffer.getChannelData(channel)
    const target = output.getChannelData(channel)
    target.set(input.subarray(0, length))
    for (let i = 0; i < fade; i += 1) {
      const t = i / fade
      const head = target[i] ?? 0
      const tail = input[length + i] ?? 0
      // Fondu à puissance constante, comme entre deux couches : une rampe
      // linéaire creuserait le niveau au milieu du raccord.
      target[i] = head * Math.sin((t * Math.PI) / 2) + tail * Math.cos((t * Math.PI) / 2)
    }
  }

  return { buffer: output, repaired: true }
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

/** Fabrique une piste silencieuse, sans avoir à embarquer de fichier. */
function silentWavUrl(seconds: number): string {
  const sampleRate = 8000
  const frames = sampleRate * seconds
  const bytes = 44 + frames * 2
  const view = new DataView(new ArrayBuffer(bytes))

  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i))
  }

  ascii(0, 'RIFF')
  view.setUint32(4, bytes - 8, true)
  ascii(8, 'WAVEfmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  ascii(36, 'data')
  view.setUint32(40, frames * 2, true)

  return URL.createObjectURL(new Blob([view.buffer], { type: 'audio/wav' }))
}
