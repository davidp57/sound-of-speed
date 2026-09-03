import { computed, ref, shallowRef, watch } from 'vue'

import { Loop } from './core/loop'
import { AudioEngine, type AudioStatus } from './core/audio/engine'
import { writeSetting, type SettingPath } from './core/calibration/settings'
import { analyzeSample, type SampleAnalysis } from './core/audio/analyze'
import { MediaSession, ScreenLock } from './core/session'
import { Offline, type OfflineStatus } from './core/offline'
import { Engine, type EngineState } from './core/engine/engine'
import { Gearbox, type GearboxState, type ShiftMode } from './core/drivetrain/gearbox'
import { SpeedConditioner, type ConditionedSpeed } from './core/speed/conditioner'
import { GeolocationSource } from './core/speed/geolocation'
import { ReplaySource, TraceRecorder, type Trace } from './core/speed/replay'
import { SimulatorSource } from './core/speed/simulator'
import { FixWatchdog } from './core/speed/watchdog'
import type { SourceStatus, SpeedSample, SpeedSource } from './core/speed/source'
import type { Profile, ProfileOrigin } from './core/preset/schema'
import {
  applyResponsiveness,
  applySportiness,
  resizeGearTables,
  responsivenessOf,
  setGearCount as withGearCount,
  sportinessOf,
} from './core/preset/character'
import { fetchLibrary, type LibraryEntry } from './core/preset/library'
import { readProfileFromUrl } from './core/preset/share'
import {
  applyOrigin,
  captureOrigin,
  duplicateProfile,
  loadProfiles,
  loadTraces,
  missingFactoryProfiles,
  resetProfileSection,
  saveTraces,
  tracesFromFile,
  tracesToFile,
  type ProfileSection,
  loadAdvancedMode,
  loadInheritedVolume,
  loadMasterVolume,
  loadSelectedId,
  newId,
  saveAdvancedMode,
  saveProfiles,
  saveMasterVolume,
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

/** Volume des profils livrés, et repli quand il n'y a rien à reprendre. */
const DEFAULT_VOLUME = 0.7

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
const gearbox = new Gearbox(
  activeProfile.value.drivetrain,
  activeProfile.value.engine,
  activeProfile.value.feel,
)
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

/**
 * Chien de garde du signal de vitesse.
 *
 * En arrière-plan, le système espace les mesures de position puis finit parfois
 * par ne plus rien envoyer. Le son continuant de son côté, il se figerait sur la
 * dernière vitesse connue — sans que rien ne le signale.
 */
const fixWatchdog = new FixWatchdog()
/** Nombre de relances du suivi, pour l'écran de télémétrie. */
export const fixRestarts = ref(0)
export const isRecording = ref(false)
export const recordedCount = ref(0)
export const traces = ref<Trace[]>(loadTraces())
/** Message d'échec de l'enregistrement des traces, quand le quota est atteint. */
export const traceStorageError = ref('')
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

/**
 * Volume général : une préférence de **cet appareil**.
 *
 * Il vivait dans le profil, ce qui produisait trois effets tous fautifs : passer
 * de Route à Sport en roulant faisait sauter le niveau, un profil partagé
 * emportait le volume réglé pour une autre voiture, et réinitialiser la section
 * de mixage remettait le son au niveau d'usine alors qu'on voulait seulement
 * retrouver un caractère.
 *
 * Le volume dépend de l'autoradio, de la position du téléphone, du bruit de
 * roulement. Rien de cela n'est un attribut du moteur qu'on imite.
 *
 * **Reprise** : à la première ouverture après la mise à jour, la préférence
 * prend la valeur du profil actif — celle que David a réellement réglée — puis
 * elle est écrite, ce qui empêche la reprise de se rejouer. Le champ du profil
 * n'est plus lu ensuite.
 */
export const masterVolume = ref(
  // Trois sources, dans cet ordre : la préférence de cet appareil ; à défaut, le
  // volume que portait le profil enregistré avant la mise à jour ; à défaut, la
  // valeur des profils livrés. La deuxième se lit dans le stockage brut, et non
  // dans `profiles` ci-dessus : les charger retire déjà ce champ.
  loadMasterVolume() ?? loadInheritedVolume(loadSelectedId()) ?? DEFAULT_VOLUME,
)
saveMasterVolume(masterVolume.value)
audio.setMasterVolume(masterVolume.value)

/**
 * Mode avancé de l'écran de configuration : une préférence de **cet appareil**.
 *
 * L'écran s'ouvre sur une vue courte — quelques curseurs globaux — et les
 * cinquante réglages détaillés attendent derrière cette bascule. Aucun n'est
 * supprimé : chacun a été ajouté pour une raison mesurée. Mais on ne les
 * parcourait plus, on les subissait.
 */
export const advancedMode = ref(loadAdvancedMode())

export function setAdvancedMode(value: boolean): void {
  advancedMode.value = value
  saveAdvancedMode(value)
}

/**
 * Visage de l'écran de conduite, et présence du décor.
 *
 * Deux **préférences de cet appareil**, comme le volume général : elles ne
 * décrivent pas le moteur qu'on imite, et un profil partagé n'a pas à emporter
 * la façon dont son destinataire regarde son écran. Elles ne passent donc pas
 * par le magasin de profils, et ne sont pas redemandées à chaque ouverture.
 *
 * Le tableau de bord est le visage par défaut : c'est en conduisant que l'écran
 * est regardé. Le décor, lui, est absent par défaut — c'est de l'agrément, et un
 * navigateur de bord ancien n'a pas à le payer sans qu'on l'ait demandé.
 */
export type DriveFace = 'dials' | 'numbers'

const FACE_KEY = 'speed.driveFace.v1'
const SCENERY_KEY = 'speed.scenery.v1'

function readPreference(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    // Navigation privée, quota plein : on retombe sur la valeur par défaut.
    return null
  }
}

function writePreference(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Le choix s'applique quand même, il ne survivra simplement pas au
    // rechargement.
  }
}

export const driveFace = ref<DriveFace>(
  readPreference(FACE_KEY) === 'numbers' ? 'numbers' : 'dials',
)
export const sceneryOn = ref(readPreference(SCENERY_KEY) === '1')

export function setDriveFace(face: DriveFace): void {
  driveFace.value = face
  writePreference(FACE_KEY, face)
}

export function setSceneryOn(value: boolean): void {
  sceneryOn.value = value
  writePreference(SCENERY_KEY, value ? '1' : '0')
}

export const offlineStatus = ref<OfflineStatus>({ ...offline.status })

export const telemetry = shallowRef<Telemetry>({
  speed: {
    kmh: 0,
    accelMs2: 0,
    rawKmh: 0,
    slopeKmhS: 0,
    sinceLastSampleMs: 0,
    recentGapsMs: [],
    slopeSamples: 0,
    atStandstill: true,
  },
  engine: {
    rpm: activeProfile.value.engine.idleRpm,
    audibleRpm: activeProfile.value.engine.idleRpm,
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
    upshiftThresholdRpm: 0,
    downshiftThresholdRpm: 0,
    downshiftBlocked: false,
    kickdownGears: 0,
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
/**
 * Mémoire du lever de pied.
 *
 * Comparer la charge d'une image à la précédente ne détecte rien : le lissage
 * la fait retomber en près d'une seconde, soit sept pour cent par image. Il faut
 * donc retenir qu'on a été en charge, puis guetter le retour au pied levé —
 * une bascule à deux seuils, avec la zone morte qui évite de se redéclencher sur
 * un frémissement.
 */
let loadWasHigh = false
/**
 * Régime au moment où l'on était encore en charge.
 *
 * C'est lui qui décide s'il reste de quoi brûler, et non le régime constaté une
 * demi-seconde plus tard, quand la charge a fini de retomber et que le moteur a
 * déjà perdu des tours.
 */
let rpmWhenLoaded = 0

function step(dt: number): void {
  const source = currentSource()
  source.tick(dt)

  const speed = conditioner.tick(dt)
  const profile = activeProfile.value

  // La charge vient de l'image précédente : le moteur est calculé après la
  // boîte, et un décalage d'une image est imperceptible devant la constante de
  // lissage de la charge.
  const gearboxState = gearbox.tick(dt, {
    rpmInGear: (gear) => rpmInGear(gear, speed.kmh),
    atStandstill: speed.atStandstill,
    load: telemetry.value.engine.load,
    kmh: speed.kmh,
    // La même accélération que celle qui pilote la charge du moteur : une
    // seconde estimation divergerait de la première sans qu'on sache laquelle
    // croire.
    accelMs2: speed.accelMs2,
  })

  const engineState = engine.tick(dt, {
    kmh: speed.kmh,
    accelMs2: speed.accelMs2,
    totalRatio: gearboxState.ratio * profile.drivetrain.finalDrive,
    wheelRadiusM: profile.drivetrain.wheelRadiusM,
    atStandstill: speed.atStandstill,
    isShifting: gearboxState.isShifting,
    throttle: sourceKind.value === 'simulator' ? simulator.getThrottle() : null,
  })

  // Pétarade : elle se déclenche au lever de pied, pas pendant qu'on décélère.
  // C'est la transition qui la produit, une seule fois, et seulement si le moteur
  // tournait assez haut pour qu'il reste de quoi brûler.
  const backfire = profile.feel.backfire
  if (engineState.load >= 0.55) {
    loadWasHigh = true
    rpmWhenLoaded = engineState.rpm
  } else if (loadWasHigh && engineState.load <= 0.3) {
    loadWasHigh = false
    if (backfire.enabled && !isMuted.value && rpmWhenLoaded >= backfire.minRpm) {
      audio.backfire(backfire.intensity, backfire.count)
    }
  }

  if (isMuted.value) audio.mute()
  else {
    audio.update(profile, engineState, {
      isShifting: gearboxState.isShifting,
      progress: gearboxState.shiftProgress,
    })
  }

  // Le niveau de sortie change à chaque image ; le reste du statut ne bouge
  // qu'aux transitions, et est rafraîchi par `refreshAudioStatus`.
  if (audio.isReady) {
    audioStatus.value = {
      ...audioStatus.value,
      outputLevel: audio.status.outputLevel,
      outputPeak: audio.status.outputPeak,
      outputLatencyMs: audio.status.outputLatencyMs,
      baseLatencyMs: audio.status.baseLatencyMs,
      backfires: audio.status.backfires,
      // Le maintien de session et l'état du contexte doivent se voir en direct :
      // c'est précisément quand ils lâchent qu'il faut le savoir.
      keepAlivePlaying: audio.status.keepAlivePlaying,
      keepAliveError: audio.status.keepAliveError,
      contextResumes: audio.status.contextResumes,
      contextState: audio.status.contextState,
    }
  }

  // Le chien de garde est interrogé ici, et non par un minuteur : un minuteur
  // est gelé en arrière-plan, précisément là où il sert. Cette boucle, elle,
  // continue de battre grâce à l'horloge du fil audio.
  const watching = sourceKind.value === 'geolocation' && isRunning.value
  if (fixWatchdog.tick(dt, speed.sinceLastSampleMs, watching)) {
    geolocation.stop()
    geolocation.start()
    fixRestarts.value = fixWatchdog.restarts
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
    gearbox.setPresets(profile.drivetrain, profile.engine, profile.feel)
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
  fixWatchdog.reset()
  fixRestarts.value = 0
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
  // L'activation met le maintien de session en place d'office ; le réglage,
  // lui, peut avoir été coupé avant. Sans cette ligne il était ignoré, et
  // comparer avec et sans devenait impossible — ce qui est justement son seul
  // usage.
  audio.setKeepAlive(backgroundAudio.value)
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

export function setMasterVolume(value: number): void {
  const volume = Number.isFinite(value) && value >= 0 ? value : 1
  masterVolume.value = volume
  saveMasterVolume(volume)
  audio.setMasterVolume(volume)
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
  fixWatchdog.reset()
  fixRestarts.value = 0
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

// Les traces sont conservées d'une session à l'autre : un trajet enregistré en
// roulant doit survivre au rechargement, faute de quoi il n'aura jamais servi.
watch(
  traces,
  (list) => {
    traceStorageError.value = saveTraces(list)
      ? ''
      : "Les traces n'ont pas pu être enregistrées : espace de stockage insuffisant. En supprimer quelques-unes."
  },
  { deep: true },
)

export function deleteTrace(startedAt: number): void {
  traces.value = traces.value.filter((t) => t.startedAt !== startedAt)
}

/** Exporte toutes les traces dans un fichier, pour les rejouer ailleurs. */
export function exportTraces(): string {
  return tracesToFile(traces.value)
}

export function importTraces(text: string): number {
  const imported = tracesFromFile(text)
  const known = new Set(traces.value.map((t) => t.startedAt))
  const fresh = imported.filter((t) => !known.has(t.startedAt))
  if (fresh.length > 0) traces.value = [...traces.value, ...fresh]
  return fresh.length
}

/**
 * Arrête l'enregistrement et rend la trace obtenue, ou `null` si rien n'a été
 * capturé.
 *
 * La trace est rendue parce que l'étalonnage doit savoir **laquelle** vient
 * d'être enregistrée : il rattache une trace à une étape de son protocole, et
 * prendre la dernière de la liste serait une supposition.
 */
export function stopRecording(name: string): Trace | null {
  const trace = recorder.stop(name || `trace ${traces.value.length + 1}`)
  isRecording.value = false
  if (trace.samples.length === 0) return null
  traces.value = [...traces.value, trace]
  return trace
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

export const favoriteProfiles = computed(() => profiles.value.filter((p) => p.favorite))

export function toggleFavorite(id: string): void {
  const profile = profiles.value.find((p) => p.id === id)
  if (profile) profile.favorite = !profile.favorite
}

export function selectProfile(id: string): void {
  if (profiles.value.some((p) => p.id === id)) selectedId.value = id
}

export const library = ref<LibraryEntry[]>([])
export const libraryLoading = ref(false)

/** Interroge le serveur pour les profils qu'on y aurait déposés. */
export async function refreshLibrary(): Promise<void> {
  libraryLoading.value = true
  try {
    library.value = await fetchLibrary()
  } finally {
    libraryLoading.value = false
  }
}

/**
 * Importe un profil reçu par lien, s'il y en a un dans l'adresse.
 * Retourne son nom, pour pouvoir le dire à l'utilisateur.
 */
export async function importFromUrl(): Promise<string | null> {
  const profile = await readProfileFromUrl()
  if (!profile) return null
  addProfile(profile)
  return profile.name
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

/** Ramène une section du profil actif — ou le profil entier — à son état d'usine. */
export function resetActive(section: ProfileSection | 'all'): void {
  const index = profiles.value.findIndex((p) => p.id === selectedId.value)
  if (index < 0) return
  const current = profiles.value[index]
  if (!current) return
  const next = [...profiles.value]
  next[index] = resetProfileSection(current, section)
  profiles.value = next
}

/**
 * Pose la liste des démultiplications du profil actif.
 *
 * Passe par ici, et non par une écriture directe, parce que changer le **nombre**
 * de rapports oblige à redimensionner les tables qui l'accompagnent : les
 * régimes de passage et les temporisations. Sans cela un rapport ajouté héritait
 * du seuil de son prédécesseur et d'une temporisation par défaut étrangère au
 * profil, et un rapport retiré laissait des valeurs orphelines.
 *
 * À nombre de rapports égal, rien d'autre ne bouge : `resizeGearTables` rend le
 * profil tel quel quand ses tables sont déjà à la bonne longueur — on ne
 * redistribue pas des seuils que quelqu'un a placés à l'oreille.
 */
export function setGearRatios(ratios: number[]): void {
  if (ratios.length === 0) return
  const index = profiles.value.findIndex((p) => p.id === selectedId.value)
  const current = profiles.value[index]
  if (!current) return

  const resized = resizeGearTables(current, ratios.length)
  const next = [...profiles.value]
  next[index] = { ...resized, drivetrain: { ...resized.drivetrain, gearRatios: ratios } }
  profiles.value = next
}

// --- Curseurs globaux ----------------------------------------------------

/**
 * État de retour, pris juste avant qu'un curseur global n'écrase le profil.
 *
 * Un curseur global recalcule une dizaine de réglages d'un coup : il ne peut
 * pas faire autrement, et sans retour possible une heure de réglage fin
 * partirait au premier mouvement. Le lot ORIGINE avait déjà doté chaque profil
 * d'un état de retour ; celui-ci en est un second, pris à la volée.
 *
 * Il est relevé au **premier** mouvement et gardé jusqu'à ce qu'on s'en serve :
 * on revient donc à l'état d'avant qu'on ait commencé à toucher aux curseurs,
 * et non à celui d'avant le dernier cran. C'est ce qu'on cherche quand on
 * s'aperçoit qu'on a gâché le profil.
 *
 * De cet appareil et de cette session seulement : il ne s'enregistre pas.
 */
const globalUndo = ref<{ id: string; origin: ProfileOrigin } | null>(null)

export const canUndoGlobalChange = computed(() => globalUndo.value?.id === selectedId.value)

function applyGlobalChange(change: (profile: Profile) => Profile): void {
  const index = profiles.value.findIndex((p) => p.id === selectedId.value)
  const current = profiles.value[index]
  if (!current) return

  if (globalUndo.value?.id !== current.id) {
    globalUndo.value = { id: current.id, origin: captureOrigin(current) }
  }
  const next = [...profiles.value]
  next[index] = change(current)
  profiles.value = next
}

export function undoGlobalChange(): void {
  const snapshot = globalUndo.value
  if (!snapshot) return
  const index = profiles.value.findIndex((p) => p.id === snapshot.id)
  const current = profiles.value[index]
  if (!current) return

  const next = [...profiles.value]
  next[index] = applyOrigin(current, snapshot.origin)
  profiles.value = next
  globalUndo.value = null
}

/**
 * Tempérament du profil actif, de 0 (calme) à 1 (sportif).
 *
 * Déduit du profil et non enregistré dans lui : le curseur reflète donc ce
 * qu'on a réellement sous les doigts, y compris sur un profil réglé à la main
 * ou reçu par lien, au lieu de partir d'une position arbitraire.
 */
export const sportiness = computed(() => sportinessOf(activeProfile.value))

export function setSportiness(value: number): void {
  applyGlobalChange((profile) => applySportiness(profile, value))
}

/**
 * Réactivité du profil actif, de 0 (pépère) à 1 (nerveux).
 *
 * Distincte du tempérament, et il faut qu'elle s'entende : le premier dit si la
 * voiture pousse fort, celle-ci dit si elle répond vite.
 */
export const responsiveness = computed(() => responsivenessOf(activeProfile.value))

export function setResponsiveness(value: number): void {
  applyGlobalChange((profile) => applyResponsiveness(profile, value))
}

/** Nombre de rapports du profil actif. */
export const gearCount = computed(() => activeProfile.value.drivetrain.gearRatios.length)

/**
 * Change le nombre de rapports, boîte complète : démultiplications réparties,
 * régimes de passage et temporisations redimensionnés.
 *
 * Compte comme un mouvement de curseur global — il refait la boîte — donc il
 * prend le même état de retour. Et la boîte se recale aussitôt sur la vitesse
 * courante : sans cela, changer de nombre de rapports en roulant laisserait le
 * rapport engagé pointer sur une démultiplication qui n'est plus la même, donc
 * le régime sauter. Les réglages sont reposés à la main avant le recalage,
 * l'observateur qui s'en charge d'ordinaire ne se déclenchant qu'après.
 */
export function setGearCount(count: number): void {
  applyGlobalChange((profile) => withGearCount(profile, count))
  const profile = activeProfile.value
  gearbox.setPresets(profile.drivetrain, profile.engine, profile.feel)
  gearbox.settleFor((gear) => rpmInGear(gear, telemetry.value.speed.kmh))
}

/**
 * Recopie une valeur mesurée par l'étalonnage dans le profil actif.
 *
 * Un réglage à la fois, sur un geste explicite : l'étalonnage propose, il
 * n'applique pas. Le profil garde son origine, donc « réinitialiser » sait
 * revenir à ce qu'il était avant la recopie.
 */
export function applyCalibrationSetting(
  path: SettingPath,
  value: number | number[],
): void {
  const index = profiles.value.findIndex((p) => p.id === selectedId.value)
  if (index < 0) return
  const current = profiles.value[index]
  if (!current) return
  const next = [...profiles.value]
  next[index] = writeSetting(current, path, value)
  profiles.value = next
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
