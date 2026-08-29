import { computed, ref, shallowRef, watch } from 'vue'

import { Loop } from './core/loop'
import { AudioEngine, type AudioStatus } from './core/audio/engine'
import { analyzeSample, type SampleAnalysis } from './core/audio/analyze'
import { MediaSession, ScreenLock } from './core/session'
import { Offline, type OfflineStatus } from './core/offline'
import { Engine, type EngineState } from './core/engine/engine'
import { Gearbox, type GearboxState, type ShiftMode } from './core/drivetrain/gearbox'
import { SpeedConditioner, type ConditionedSpeed } from './core/speed/conditioner'
import { GeolocationSource } from './core/speed/geolocation'
import { ReplaySource, TraceRecorder, type Trace } from './core/speed/replay'
import { SimulatorSource } from './core/speed/simulator'
import type { SourceStatus, SpeedSample, SpeedSource } from './core/speed/source'
import type { Profile } from './core/preset/schema'
import {
  duplicateProfile,
  loadProfiles,
  missingFactoryProfiles,
  loadSelectedId,
  newId,
  saveProfiles,
  saveSelectedId,
} from './core/preset/store'

/**
 * État de l'application.
 *
 * Un module unique plutôt qu'un magasin par domaine : il n'y a qu'une voiture,
 * qu'une boucle et qu'un profil actif à la fois. Les trois écrans lisent tous
 * dans le même objet de télémétrie, remplacé en bloc à chaque image — remplacer
 * une référence coûte moins cher que d'entretenir vingt valeurs réactives
 * mises à jour soixante fois par seconde.
 */

export type SourceKind = 'simulator' | 'geolocation' | 'replay'

export interface Telemetry {
  speed: ConditionedSpeed
  engine: EngineState
  gearbox: GearboxState
  /** Facteur de lecture qu'appliquera chaque couche audio, indexé par clé. */
  frameMs: number
}

const profiles = ref<Profile[]>(loadProfiles())
const selectedId = ref<string>(loadSelectedId() ?? profiles.value[0]?.id ?? '')

export const activeProfile = computed<Profile>(() => {
  const found = profiles.value.find((p) => p.id === selectedId.value)
  return found ?? (profiles.value[0] as Profile)
})

const simulator = new SimulatorSource()
const geolocation = new GeolocationSource({
  maxPlausibleKmh: activeProfile.value.speed.maxPlausibleKmh,
})
const replay = new ReplaySource({ name: 'vide', startedAt: 0, samples: [] })

const conditioner = new SpeedConditioner(activeProfile.value.speed)
const gearbox = new Gearbox(activeProfile.value.drivetrain, activeProfile.value.engine)
const engine = new Engine(activeProfile.value.engine, activeProfile.value.mix)
const recorder = new TraceRecorder()
const loop = new Loop()
const audio = new AudioEngine()
const screenLock = new ScreenLock()
const mediaSession = new MediaSession()
const offline = new Offline()

export const sourceKind = ref<SourceKind>('simulator')
export const sourceStatus = ref<SourceStatus>('idle')
export const sourceDetail = ref<string>('')
export const isRunning = ref(false)
export const isRecording = ref(false)
export const recordedCount = ref(0)
export const traces = ref<Trace[]>([])
export const replayProgress = ref(0)
export const audioStatus = ref<AudioStatus>({ ...audio.status })
export const isMuted = ref(false)
export const screenLockSupported = screenLock.supported
export const screenLockHeld = ref(false)
export const screenLockError = ref('')
export const keepScreenOn = ref(false)
/**
 * Maintien de la session audio en arrière-plan.
 *
 * Activé par défaut : sans lui, le son se coupe quand l'écran s'éteint. Le
 * désactiver sert à vérifier s'il est responsable d'une latence de sortie
 * excessive, certains téléphones basculant sur un chemin plus tamponné dès
 * qu'un lecteur média tourne.
 */
export const backgroundAudio = ref(true)
export const offlineStatus = ref<OfflineStatus>({ ...offline.status })

export const telemetry = shallowRef<Telemetry>({
  speed: {
    kmh: 0,
    accelMs2: 0,
    rawKmh: 0,
    slopeKmhS: 0,
    sinceLastSampleMs: 0,
    recentGapsMs: [],
    atStandstill: true,
  },
  engine: {
    rpm: activeProfile.value.engine.idleRpm,
    kinematicRpm: 0,
    load: 0,
    rpmFraction: 0,
    firingHz: 0,
    limiterActive: false,
    idling: true,
  },
  gearbox: {
    gear: 0,
    label: 'N',
    gearCount: activeProfile.value.drivetrain.gearRatios.length,
    ratio: activeProfile.value.drivetrain.gearRatios[0] ?? 1,
    mode: 'auto',
    isShifting: false,
    shiftProgress: 1,
    shiftDirection: null,
    isShiftReady: false,
  },
  frameMs: 0,
})

function currentSource(): SpeedSource {
  if (sourceKind.value === 'geolocation') return geolocation
  if (sourceKind.value === 'replay') return replay
  return simulator
}

// Chaque source alimente le même conditionneur, et l'enregistreur écoute au
// passage : on peut donc capturer aussi bien un trajet réel qu'une session au
// clavier, ce qui rend les cas de test reproductibles.
for (const source of [simulator, geolocation, replay]) {
  source.onSample((sample: SpeedSample) => {
    if (source !== currentSource()) return
    conditioner.push(sample)
    if (recorder.isRecording) {
      recorder.push(sample)
      recordedCount.value = recorder.count
    }
  })
  source.onStatus((status, detail) => {
    if (source !== currentSource()) return
    sourceStatus.value = status
    sourceDetail.value = detail ?? ''
  })
}

/** Régime qu'aurait le moteur dans un rapport donné, à la vitesse courante. */
function rpmInGear(gear: number, kmh: number): number {
  const { drivetrain } = activeProfile.value
  const ratio = drivetrain.gearRatios[gear] ?? 1
  return Engine.kinematicRpm(kmh, ratio * drivetrain.finalDrive, drivetrain.wheelRadiusM)
}

/**
 * Un pas de simulation.
 *
 * Extrait de la boucle pour pouvoir être appelé à pas fixe depuis le banc de
 * mise au point : le navigateur ralentit fortement les minuteurs d'un onglet en
 * arrière-plan, ce qui rend toute mesure prise à la montre inexploitable. Avec
 * un pas imposé, le comportement est reproductible.
 */
function step(dt: number): void {
  const source = currentSource()
  source.tick(dt)

  const speed = conditioner.tick(dt)
  const profile = activeProfile.value

  // La charge vient de l'image précédente : le moteur est calculé après la
  // boîte, et un décalage d'une image est imperceptible devant la constante de
  // lissage de la charge.
  const gearboxState = gearbox.tick(
    dt,
    (gear) => rpmInGear(gear, speed.kmh),
    speed.atStandstill,
    telemetry.value.engine.load,
  )

  const engineState = engine.tick(dt, {
    kmh: speed.kmh,
    accelMs2: speed.accelMs2,
    totalRatio: gearboxState.ratio * profile.drivetrain.finalDrive,
    wheelRadiusM: profile.drivetrain.wheelRadiusM,
    atStandstill: speed.atStandstill,
    isShifting: gearboxState.isShifting,
    throttle: sourceKind.value === 'simulator' ? simulator.getThrottle() : null,
  })

  if (isMuted.value) audio.mute()
  else audio.update(profile, engineState)

  // Le niveau de sortie change à chaque image ; le reste du statut ne bouge
  // qu'aux transitions, et est rafraîchi par `refreshAudioStatus`.
  if (audio.isReady) {
    audioStatus.value = {
      ...audioStatus.value,
      outputLevel: audio.status.outputLevel,
      outputPeak: audio.status.outputPeak,
      outputLatencyMs: audio.status.outputLatencyMs,
      baseLatencyMs: audio.status.baseLatencyMs,
    }
  }

  if (sourceKind.value === 'replay') replayProgress.value = replay.progress

  telemetry.value = {
    speed,
    engine: engineState,
    gearbox: gearboxState,
    frameMs: loop.lastFrameMs,
  }
}

loop.add(step)

/**
 * Choix de la cadence.
 *
 * Dès que l'horloge du fil audio tourne, c'est elle qui bat la mesure et la
 * boucle d'affichage s'efface : le fil audio n'est ni gelé ni ralenti quand la
 * page passe en arrière-plan, contrairement aux images et aux minuteurs. Sans
 * cette bascule, le son se figerait à l'instant où l'écran s'éteint — c'est-à-dire
 * exactement pendant qu'on roule.
 */
function syncDriver(): void {
  if (manualTiming) return
  const audioDriven = audio.status.clockRunning && audio.isReady
  if (audioDriven) {
    loop.stop()
    audio.onClockTick = step
  } else {
    audio.onClockTick = null
    if (isRunning.value) loop.start()
  }
}

audio.onClockTick = null

/**
 * Suspend toute cadence — affichage comme fil audio — sans arrêter la source ni
 * démonter le son. Le banc de mise au point reprend alors la main sur le temps.
 * `stop()`, lui, coupe aussi la source.
 */
let manualTiming = false

export function pauseLoop(): void {
  manualTiming = true
  loop.stop()
  audio.onClockTick = null
}

export function resumeLoop(): void {
  manualTiming = false
  syncDriver()
}

/**
 * Avance la simulation d'un nombre de pas fixes. Réservé à la mise au point :
 * exposé sur `window.__speed` en développement uniquement.
 */
export function advanceManually(dtSeconds: number, steps: number): void {
  for (let i = 0; i < steps; i += 1) step(dtSeconds)
}

// Au retour au premier plan, deux choses peuvent avoir été perdues sans que rien
// ne le signale : le contexte audio, suspendu par le système, et le verrou
// d'écran, relâché d'office. Les deux se redemandent ici.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return
    void audio.resumeIfSuspended().then((resumed) => {
      if (resumed) refreshAudioStatus()
    })
    screenLockHeld.value = screenLock.held
    if (screenLock.held) screenLockError.value = ''
  })
}

// Toute modification du profil est répercutée à chaud dans les modules : c'est
// ce qui permet de régler un paramètre pendant que le son tourne.
watch(
  activeProfile,
  (profile) => {
    conditioner.setPreset(profile.speed)
    gearbox.setPresets(profile.drivetrain, profile.engine)
    engine.setPresets(profile.engine, profile.mix)
    geolocation.setOptions({ maxPlausibleKmh: profile.speed.maxPlausibleKmh })
  },
  { deep: true, immediate: true },
)

/**
 * Signature des couches : ce qui, dans un profil, impose de relire les fichiers.
 * Bouger un gain ou un régime d'ancrage n'en fait pas partie — ces réglages
 * s'appliquent sans toucher aux buffers, ce qui est tout l'intérêt d'un éditeur
 * qui travaille pendant que le son tourne.
 */
const sampleSignature = computed(() => {
  const profile = activeProfile.value
  const layers = profile.layers.map((l) => `${l.key}:${l.file}:${l.enabled}`).join('|')
  return `${profile.sampleDir}#${layers}`
})

watch(sampleSignature, () => {
  if (audio.isReady || audio.status.phase === 'loading') {
    void audio.load(activeProfile.value).then(refreshAudioStatus)
  }
})

watch(
  () => [activeProfile.value.name, activeProfile.value.engine.cylinders] as const,
  () => {
    if (audio.isReady) void syncMediaSession()
  },
)

watch(profiles, (list) => saveProfiles(list), { deep: true })
watch(selectedId, (id) => {
  saveSelectedId(id)
  gearbox.settleFor((gear) => rpmInGear(gear, telemetry.value.speed.kmh))
})

export function start(): void {
  currentSource().start()
  loop.start()
  isRunning.value = true
}

export function stop(): void {
  currentSource().stop()
  loop.stop()
  isRunning.value = false
}

/** Adresses des échantillons du profil actif, telles que le cache les connaît. */
const sampleUrls = computed(() =>
  activeProfile.value.layers
    .filter((layer) => layer.enabled && layer.file)
    .map((layer) => `/audio/${activeProfile.value.sampleDir}/${layer.file}`),
)

offline.onChange((status) => {
  offlineStatus.value = status
})

/**
 * Prépare l'application à fonctionner sans réseau.
 *
 * Appelé au démarrage : le service worker s'installe, puis on lui demande ce
 * qu'il a déjà des échantillons du profil courant.
 */
export async function initOffline(): Promise<void> {
  await offline.register()
  offline.watch(sampleUrls.value)
}

/** Met en cache tous les échantillons du profil, sans attendre d'en avoir besoin. */
export function prepareOffline(): void {
  offline.prepare()
}

export async function promptInstall(): Promise<void> {
  await offline.promptInstall()
}

export function applyUpdate(): void {
  offline.applyUpdate()
}

watch(sampleUrls, (urls) => offline.watch(urls))

function refreshAudioStatus(): void {
  audioStatus.value = { ...audio.status, repaired: [...audio.status.repaired] }
  syncDriver()
}

/**
 * Démarre le son. Doit partir d'un geste de l'utilisateur : les navigateurs
 * refusent d'ouvrir un contexte audio autrement, et l'échec est silencieux.
 */
export async function activateAudio(): Promise<void> {
  await audio.activate(activeProfile.value)
  refreshAudioStatus()

  mediaSession.setHandlers({
    onPlay: () => setMuted(false),
    onPause: () => setMuted(true),
  })
  await syncMediaSession()
  mediaSession.setPlaying(!isMuted.value)
}

/** Titre et sous-titre affichés par le système sur l'écran verrouillé. */
async function syncMediaSession(): Promise<void> {
  const profile = activeProfile.value
  const gears = profile.drivetrain.gearRatios.length
  await mediaSession.setProfile(
    profile.name,
    `${profile.engine.cylinders} cylindres · ${gears} rapport${gears > 1 ? 's' : ''}`,
  )
}

/**
 * Verrou d'écran : sans lui, l'écran s'éteint au bout de quelques dizaines de
 * secondes et l'on perd de vue la vitesse et le rapport engagé, en conduite.
 */
export async function setKeepScreenOn(value: boolean): Promise<void> {
  keepScreenOn.value = value
  if (value) await screenLock.enable()
  else await screenLock.disable()
  screenLockHeld.value = screenLock.held
  screenLockError.value = value ? screenLock.lastError : ''
}

/**
 * Mesure un échantillon : régime d'ancrage, qualité du raccord de boucle, format.
 *
 * Le décodage se fait dans un contexte hors ligne dédié, indépendant du moteur
 * audio : on peut donc analyser un fichier avant même d'avoir activé le son, et
 * l'analyse d'un fichier absent ou illisible ne perturbe pas ce qui joue.
 */
export async function analyzeLayerFile(
  file: string,
  cylinders: number,
): Promise<SampleAnalysis> {
  const response = await fetch(`/audio/${activeProfile.value.sampleDir}/${file}`)
  if (!response.ok) throw new Error(`${file} : ${response.status}`)

  const Ctor =
    window.OfflineAudioContext ??
    (window as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
      .webkitOfflineAudioContext
  if (!Ctor) throw new Error("Ce navigateur ne fournit pas l'API Web Audio.")

  const scratch = new Ctor(1, 1, 48000)
  const buffer = await scratch.decodeAudioData(await response.arrayBuffer())
  return analyzeSample(buffer, cylinders)
}

export function setBackgroundAudio(value: boolean): void {
  backgroundAudio.value = value
  audio.setKeepAlive(value)
  refreshAudioStatus()
}

export function setMuted(value: boolean): void {
  isMuted.value = value
  if (value) audio.mute()
  mediaSession.setPlaying(!value)
}

export function setSource(kind: SourceKind): void {
  if (kind === sourceKind.value) return
  const wasRunning = isRunning.value
  currentSource().stop()
  sourceKind.value = kind
  conditioner.reset()
  engine.reset()
  gearbox.reset()
  sourceStatus.value = 'idle'
  sourceDetail.value = ''
  if (wasRunning) currentSource().start()
}

export function setThrottle(value: number): void {
  simulator.setThrottle(value)
}

export function setBrake(value: number): void {
  simulator.setBrake(value)
}

/** Vitesse à tenir au simulateur, ou `null` pour rendre la main. */
export function setSimulatedSpeed(kmh: number | null): void {
  simulator.setCruise(kmh)
}

export function getSimulatedCruise(): number | null {
  return simulator.getCruise()
}

export function setShiftMode(mode: ShiftMode): void {
  gearbox.setMode(mode)
}

export function shiftUp(): void {
  gearbox.shiftUp()
}

export function shiftDown(): void {
  gearbox.shiftDown()
}

export function startRecording(): void {
  recorder.start()
  isRecording.value = true
  recordedCount.value = 0
}

export function stopRecording(name: string): void {
  const trace = recorder.stop(name || `trace ${traces.value.length + 1}`)
  isRecording.value = false
  if (trace.samples.length > 0) traces.value = [...traces.value, trace]
}

export function playTrace(trace: Trace): void {
  replay.setTrace(trace)
  setSource('replay')
  conditioner.reset()
  if (!isRunning.value) start()
  else replay.start()
}

export function setReplayRate(rate: number): void {
  replay.rate = rate
}

// --- Gestion des profils -------------------------------------------------

export const profileList = computed(() => profiles.value)
export const selectedProfileId = computed(() => selectedId.value)

export function selectProfile(id: string): void {
  if (profiles.value.some((p) => p.id === id)) selectedId.value = id
}

export function addProfile(profile: Profile): void {
  profiles.value = [...profiles.value, profile]
  selectedId.value = profile.id
}

/** Réintroduit les profils livrés qui ne sont plus dans la liste. */
export function restoreFactoryProfiles(): number {
  const missing = missingFactoryProfiles(profiles.value)
  if (missing.length > 0) profiles.value = [...profiles.value, ...missing]
  return missing.length
}

export function duplicateActive(): void {
  const copy = duplicateProfile(activeProfile.value, `${activeProfile.value.name} (copie)`)
  addProfile(copy)
}

export function renameActive(name: string): void {
  const profile = profiles.value.find((p) => p.id === selectedId.value)
  if (profile) profile.name = name
}

export function deleteProfile(id: string): void {
  if (profiles.value.length <= 1) return
  const remaining = profiles.value.filter((p) => p.id !== id)
  profiles.value = remaining
  if (selectedId.value === id) selectedId.value = remaining[0]?.id ?? ''
}

export function resetProfileId(profile: Profile): Profile {
  return { ...profile, id: newId() }
}
