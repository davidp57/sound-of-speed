import { exhaustImpulse } from './impulse'
import { PLAYER_PROCESSOR, PLAYER_SOURCE } from './player-source'
import { RENDERER_SOURCE } from './renderer-source'
import { realtimeFactor } from './reserve'
import { clampSynthSettings, DEFAULT_SYNTH, needsRebuild, type SynthSettings } from './settings'

/**
 * Le son produit par engine-sim, joué en direct.
 *
 * Trois fils travaillent ensemble :
 *
 * - le **fil principal** tient les réglages et transmet, à chaque tour de la
 *   boucle de Speed, le régime affiché et l'effort ;
 * - le **calculateur** (`renderer-source.ts`) fait tourner engine-sim en
 *   WebAssembly et remplit une réserve ;
 * - le **lecteur** (`player-source.ts`), dans le fil audio, vide cette réserve
 *   et compte ce qui manque.
 *
 * La réserve est ce qui absorbe les pointes. Un moteur qui tient tout juste le
 * temps réel en moyenne craque sans elle dès qu'une trame coûte le double —
 * et c'est ce que fait engine-sim à chaque allumage.
 *
 * Ce module ne connaît ni Vue ni le profil. Le lot SYNTHESE prévoit un champ
 * `soundSource` à la racine du profil ; quand il existera, il suffira d'appeler
 * `start()` et `stop()` selon sa valeur. En attendant, l'onglet de
 * développement s'en charge.
 */

export type SynthPhase = 'idle' | 'loading' | 'ready' | 'error'

export interface SynthStatus {
  phase: SynthPhase
  error: string
  /** Cadence du contexte audio, en hertz. */
  sampleRate: number
  /** Temps qu'a demandé la construction du moteur simulé, en millisecondes. */
  buildMs: number
  /** Le régime qu'on impose, celui du cadran. */
  targetRpm: number
  /** Le régime que le moteur simulé tient vraiment. */
  engineRpm: number
  /** L'effort transmis, de 0 à 1. */
  effort: number
  /** Coefficient temps réel du calcul, mesuré sur la dernière fenêtre. */
  realtime: number
  /** Part du temps réel consommée par le calcul, de 0 à 1 et au-delà. */
  cpuLoad: number
  /** Réserve courante, en millisecondes de son. */
  reserveMs: number
  /** Réserve interne d'engine-sim, en millisecondes. */
  innerLatencyMs: number
  /** Nombre de creux depuis l'activation. */
  underruns: number
  /** Durée totale des creux, en millisecondes. */
  underrunMs: number
  /** Échantillons que le WebAssembly n'a pas su rendre à temps. */
  shortfall: number
  /** Niveau crête en sortie du lecteur, de 0 à 1. */
  peak: number
  /** Niveau efficace en sortie, de 0 à 1. */
  rms: number
  /**
   * Part de l'énergie au-dessus d'un kilohertz, de 0 à 1.
   *
   * Le ticket demande que l'effort change le **timbre** et pas seulement le
   * niveau. Un chiffre le dit : si la brillance ne bouge pas quand l'effort
   * monte, c'est un coup de volume déguisé.
   */
  brightness: number
}

const IDLE_STATUS: SynthStatus = {
  phase: 'idle',
  error: '',
  sampleRate: 0,
  buildMs: 0,
  targetRpm: 0,
  engineRpm: 0,
  effort: 0,
  realtime: 0,
  cpuLoad: 0,
  reserveMs: 0,
  innerLatencyMs: 0,
  underruns: 0,
  underrunMs: 0,
  shortfall: 0,
  peak: 0,
  rms: 0,
  brightness: 0,
}

/**
 * Où le module WebAssembly est servi.
 *
 * Le même binaire que la page de mesure `/sonde/`, et c'est voulu : deux copies
 * divergeraient, et l'on comparerait alors un chiffre mesuré à un son produit
 * par autre chose.
 */
const MODULE_PATH = '/sonde/probe.mjs'

function blobUrl(source: string): string {
  return URL.createObjectURL(new Blob([source], { type: 'text/javascript' }))
}

export class SynthEngine {
  private context: AudioContext | null = null
  private node: AudioWorkletNode | null = null
  private worker: Worker | null = null
  private dry: GainNode | null = null
  private wet: GainNode | null = null
  private output: GainNode | null = null
  private convolver: ConvolverNode | null = null
  private muffler: BiquadFilterNode | null = null
  private muted = false
  /** Volume général de l'appareil, le même que celui du moteur à échantillons. */
  private masterVolume = 1
  private urls: string[] = []
  private settings: SynthSettings = { ...DEFAULT_SYNTH }
  private state: SynthStatus = { ...IDLE_STATUS }
  private starting = false
  /** Un réglage arrivé pendant un démarrage : rejoué à la fin, pas perdu. */
  private restartWanted = false
  /** Les bornes du balayage : le ralenti et le rupteur du profil actif. */
  private rpmRange: [number, number] = [800, 6000]

  /** Appelé à chaque compte rendu du calculateur, quatre fois par seconde. */
  onStatus: ((status: SynthStatus) => void) | null = null

  get status(): SynthStatus {
    return this.state
  }

  get isRunning(): boolean {
    return this.state.phase === 'ready'
  }

  getSettings(): SynthSettings {
    return this.settings
  }

  /**
   * Démarre le son.
   *
   * À appeler depuis un geste de l'utilisateur : sans cela le navigateur laisse
   * le contexte audio suspendu, et rien ne sort sans qu'aucune erreur ne le
   * dise.
   *
   * Un second appel pendant qu'un démarrage est en cours ne se perd pas : il
   * est **rejoué** à la fin. Le perdre laissait l'écran annoncer un réglage que
   * le moteur n'avait pas — relevé en mesurant : changer le nombre de cylindres
   * puis la fréquence de simulation coup sur coup n'appliquait que le premier,
   * et le chiffre relevé ne correspondait à aucun des deux réglages affichés.
   */
  async start(settings: SynthSettings = this.settings): Promise<void> {
    this.settings = clampSynthSettings(settings)
    if (this.starting) {
      this.restartWanted = true
      return
    }
    this.starting = true
    try {
      do {
        this.restartWanted = false
        await this.launch()
      } while (this.restartWanted)
    } finally {
      this.starting = false
    }
  }

  private async launch(): Promise<void> {
    try {
      await this.stop()
      this.publish({ ...IDLE_STATUS, phase: 'loading' })

      const context = new AudioContext()
      this.context = context
      if (context.state === 'suspended') await context.resume()

      const playerUrl = blobUrl(PLAYER_SOURCE)
      this.urls.push(playerUrl)
      await context.audioWorklet.addModule(playerUrl)

      const node = new AudioWorkletNode(context, PLAYER_PROCESSOR, {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        processorOptions: { reportEvery: 8 },
      })
      this.node = node
      this.buildGraph(context, node)

      const rendererUrl = blobUrl(RENDERER_SOURCE)
      this.urls.push(rendererUrl)
      const worker = new Worker(rendererUrl, { type: 'module' })
      this.worker = worker
      worker.onmessage = (event: MessageEvent) => this.onWorkerMessage(event.data)

      // Un canal direct entre le calculateur et le lecteur. Passer par le fil
      // principal marcherait, mais un rendu de Vue s'intercalerait alors entre
      // le calcul et le son.
      const channel = new MessageChannel()
      node.port.postMessage({ type: 'link', port: channel.port1 }, [channel.port1])
      worker.postMessage({ type: 'link', port: channel.port2 }, [channel.port2])

      worker.postMessage({
        type: 'boot',
        moduleUrl: new URL(MODULE_PATH, location.origin).href,
        sampleRate: context.sampleRate,
        settings: this.settings,
        sweepLow: this.rpmRange[0],
        sweepHigh: this.rpmRange[1],
      })

      this.publish({ ...this.state, sampleRate: context.sampleRate })
    } catch (error) {
      this.publish({
        ...this.state,
        phase: 'error',
        error: error instanceof Error ? error.message : String(error),
      })
      await this.stop()
    }
  }

  async stop(): Promise<void> {
    if (this.worker !== null) {
      this.worker.postMessage({ type: 'stop' })
      this.worker.terminate()
      this.worker = null
    }
    if (this.node !== null) {
      this.node.disconnect()
      this.node = null
    }
    for (const node of [this.dry, this.wet, this.output, this.convolver]) node?.disconnect()
    this.dry = null
    this.wet = null
    this.output = null
    this.convolver = null
    if (this.context !== null) {
      const context = this.context
      this.context = null
      await context.close().catch(() => {
        // Un contexte deux fois fermé rejette ; il n'y a rien à réparer.
      })
    }
    for (const url of this.urls) URL.revokeObjectURL(url)
    this.urls = []
    if (this.state.phase !== 'error') this.publish({ ...IDLE_STATUS })
  }

  /** Le régime du cadran et l'effort du moteur, à chaque tour de la boucle. */
  setTarget(rpm: number, effort: number): void {
    this.worker?.postMessage({ type: 'target', rpm, effort })
  }

  /** Le ralenti et le rupteur du profil actif, bornes du balayage du banc. */
  setRpmRange(idleRpm: number, redlineRpm: number): void {
    this.rpmRange = [idleRpm, redlineRpm]
  }

  /**
   * Applique des réglages.
   *
   * Le papillon, le volume et la réserve s'écrivent à chaud. Le nombre de
   * cylindres, la fréquence de simulation, la longueur de la réponse
   * impulsionnelle et la taille de bloc sont figés à la construction : ils
   * imposent de tout reconstruire, et donc une coupure.
   */
  async apply(settings: SynthSettings): Promise<void> {
    const next = clampSynthSettings(settings)
    const rebuild = needsRebuild(this.settings, next)
    this.settings = next
    if (this.state.phase !== 'ready' && this.state.phase !== 'loading') return
    if (rebuild) {
      await this.start(next)
      return
    }
    this.worker?.postMessage({
      type: 'tune',
      throttleIdle: next.throttleIdle,
      throttleFull: next.throttleFull,
      volume: next.volume,
      reserveMs: next.reserveMs,
      sweep: next.sweep,
      sweepSeconds: next.sweepSeconds,
      sweepLow: this.rpmRange[0],
      sweepHigh: this.rpmRange[1],
      forceEffort: next.forceEffort,
      forcedEffort: next.forcedEffort,
    })
    if (this.context !== null && this.node !== null) this.buildGraph(this.context, this.node)
  }

  /**
   * Le graphe de sortie, où vit la résonance d'échappement.
   *
   * engine-sim sait convoluer lui-même, mais en produit direct : dix mille
   * multiplications par échantillon. Le `ConvolverNode` fait la même chose en
   * transformée de Fourier partitionnée, dans du code natif. Le réglage
   * `impulseSamples` à zéro coupe celle d'engine-sim et laisse celle-ci faire
   * le travail.
   */
  private buildGraph(context: AudioContext, node: AudioWorkletNode): void {
    node.disconnect()
    this.dry?.disconnect()
    this.wet?.disconnect()
    this.output?.disconnect()
    this.convolver?.disconnect()
    this.muffler?.disconnect()

    const output = context.createGain()
    output.gain.value = this.muted ? 0 : this.masterVolume
    output.connect(context.destination)
    this.output = output

    // Le silencieux, avant la séparation : il doit agir sur le son sec comme
    // sur le son réverbéré, puisque c'est le même échappement qui les porte.
    // Le placer après la résonance seulement laisserait passer l'aigu cru.
    const muffler = context.createBiquadFilter()
    muffler.type = 'lowpass'
    muffler.frequency.value = this.settings.mufflerHz
    // Sans surtension : on cherche à absorber, pas à faire chanter le pot.
    muffler.Q.value = 0.707
    node.connect(muffler)
    this.muffler = muffler

    const mix = this.settings.convolver ? this.settings.convolverMix : 0
    const dry = context.createGain()
    // Racine, et non proportion directe : le son sec et le son réverbéré sont
    // décorrélés, donc ce sont leurs énergies qui s'ajoutent. En gains linéaires
    // le milieu du curseur perdait trois décibels, et l'on croyait régler une
    // couleur alors qu'on baissait le volume.
    dry.gain.value = Math.sqrt(1 - mix)
    muffler.connect(dry).connect(output)
    this.dry = dry

    if (mix <= 0) {
      this.wet = null
      this.convolver = null
      return
    }

    const length = Math.max(1, Math.round((this.settings.convolverMs / 1000) * context.sampleRate))
    const buffer = context.createBuffer(1, length, context.sampleRate)
    buffer.copyToChannel(
      exhaustImpulse(length, context.sampleRate, this.settings.exhaustHz),
      0,
    )
    const convolver = context.createConvolver()
    // La réponse est déjà normalisée en énergie par `exhaustImpulse` : laisser le
    // nœud en remettre une couche ferait dépendre le niveau de sa longueur.
    convolver.normalize = false
    convolver.buffer = buffer
    const wet = context.createGain()
    wet.gain.value = Math.sqrt(mix)
    muffler.connect(convolver).connect(wet).connect(output)
    this.convolver = convolver
    this.wet = wet
  }

  /**
   * Coupe la sortie sans arrêter le calcul.
   *
   * Arrêter le calcul serait plus économe, mais reprendre demanderait de
   * reconstruire le moteur — une seconde de silence à chaque coupure, et un
   * moteur qui repart froid.
   */
  setMuted(muted: boolean): void {
    this.muted = muted
    this.applyOutputGain()
  }

  /** Le volume général de l'appareil, partagé avec le moteur à échantillons. */
  setMasterVolume(volume: number): void {
    this.masterVolume = volume
    this.applyOutputGain()
  }

  private applyOutputGain(): void {
    if (this.output !== null) this.output.gain.value = this.muted ? 0 : this.masterVolume
  }

  private onWorkerMessage(message: Record<string, number | string>): void {
    if (message['type'] === 'ready') {
      this.publish({
        ...this.state,
        phase: 'ready',
        error: '',
        buildMs: Number(message['buildMs'] ?? 0),
      })
      return
    }
    if (message['type'] === 'error') {
      this.publish({ ...this.state, phase: 'error', error: String(message['error'] ?? '') })
      return
    }
    if (message['type'] !== 'stats') return

    const rate = this.state.sampleRate || 48000
    const cpu = Number(message['cpuSeconds'] ?? 0)
    const audio = Number(message['audioSeconds'] ?? 0)
    const underrunFrames = Number(message['underrunFrames'] ?? 0)
    this.publish({
      ...this.state,
      targetRpm: Number(message['targetRpm'] ?? 0),
      effort: Number(message['effort'] ?? 0),
      engineRpm: Number(message['engineRpm'] ?? 0),
      realtime: realtimeFactor(cpu, audio),
      cpuLoad: audio > 0 ? cpu / audio : 0,
      reserveMs: (Number(message['queuedFrames'] ?? 0) / rate) * 1000,
      innerLatencyMs: Number(message['innerLatency'] ?? 0) * 1000,
      underruns: Number(message['underruns'] ?? 0),
      underrunMs: (underrunFrames / rate) * 1000,
      shortfall: Number(message['shortfall'] ?? 0),
      peak: Number(message['peak'] ?? 0),
      rms: Number(message['rms'] ?? 0),
      brightness: Number(message['brightness'] ?? 0),
    })
  }

  private publish(status: SynthStatus): void {
    this.state = status
    this.onStatus?.(status)
  }
}
