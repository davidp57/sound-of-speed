import { computed, ref, shallowRef, watch } from 'vue'

import { Loop } from './core/loop'
import { AudioEngine, type AudioStatus } from './core/audio/engine'
import { writeSetting, type SettingPath } from './core/calibration/settings'
import { analyzeSample, type SampleAnalysis } from './core/audio/analyze'
import { MediaSession, ScreenLock } from './core/session'
import { Offline, type OfflineStatus } from './core/offline'
import { Engine, SHIFT_CLACK_AT, type EngineState } from './core/engine/engine'
import { Gearbox, type GearboxState, type ShiftMode } from './core/drivetrain/gearbox'
import { SpeedConditioner, type ConditionedSpeed } from './core/speed/conditioner'
import { GeolocationSource } from './core/speed/geolocation'
import { ReplaySource, TraceRecorder, type Trace } from './core/speed/replay'
import { SimulatorSource } from './core/speed/simulator'
import { GpsBench, DEFAULT_BENCH, type BenchOptions } from './core/speed/gps-bench'
import { GamepadReader, type PadSnapshot } from './core/input/gamepad'
import { RejectionWatch, type RejectionCause } from './core/speed/rejection'
import { FixWatchdog } from './core/speed/watchdog'
import type { SourceStatus, SpeedSample, SpeedSource } from './core/speed/source'
import { soundSourceOf } from './core/preset/schema'
import type { EngineDefinition, Profile, ProfileOrigin } from './core/preset/schema'
import { clampEngineDefinition } from './core/preset/engine-definition'
import type { LibraryEngine } from './core/preset/engine-library'
import {
  applyResponsiveness,
  applySportiness,
  resizeGearTables,
  responsivenessOf,
  setGearCount as withGearCount,
  sportinessOf,
} from './core/preset/character'
import { SynthEngine, type SynthStatus } from './core/synth/synth'
import { DEFAULT_RENDERING, DEFAULT_SYNTH, renderingOf, type SynthSettings } from './core/synth/settings'
import { Journal, newSessionId } from './core/journal/journal'
import { JournalCollector, type SoundCost } from './core/journal/collect'
import { sendsAutomatically, type UploadConsent } from './core/upload/consent'
import { toWav } from './bench/wav'
import { UploadQueue, type QueuedUpload } from './core/upload/queue'
import { loadQueue, saveQueue } from './core/upload/store'
import { putFile, slug, stamp } from './core/upload/put'
import { PROFILE_FOLDER, profileBody, profileFileName, profileUploadId } from './core/upload/profile'
import { depositSlice } from './core/journal/deposit'
import { fetchBanks, missingFiles, usedBanks, type Bank } from './core/audio/banks'
import { fetchLibrary, type LibraryEntry } from './core/preset/library'
import { readProfileFromUrl } from './core/preset/share'
import {
  analyzeSession,
  missingStepLabels,
  overridesFor,
  withCalibration,
} from './core/calibration/onboard'
import type { CalibrationStepId } from './core/calibration/protocol'
import {
  TRACE_FOLDER,
  deposit,
  depositName,
  traceBody,
  type DepositOutcome,
} from './core/deposit/deposit'
import { loadCalibration, saveCalibration, type CalibrationSession } from './core/calibration/store'
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
  loadDepositCredentials,
  loadInheritedVolume,
  loadMasterVolume,
  loadSelectedId,
  newId,
  saveAdvancedMode,
  saveProfiles,
  saveDepositCredentials,
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

/**
 * Étalonnage : une couche par-dessus le profil, pas une recopie dedans.
 *
 * Un profil décrit un son ; l'étalonnage décrit la **voiture** — ce dont elle
 * est capable. Deux choses distinctes, et la seconde ne s'écrit pas dans la
 * première. Ce qu'on règle reste intact, la mesure vaut pour tous les profils à
 * la fois, et refaire l'étalonnage ne fait rien perdre.
 *
 * L'analyse des traces est mémorisée à part : elle est coûteuse et ne dépend que
 * des enregistrements, quand la composition se refait à chaque réglage touché.
 */
export const calibration = ref<CalibrationSession>(loadCalibration())

/**
 * Étape d'étalonnage dont l'enregistrement est en cours.
 *
 * Elle vit ici, et non dans l'écran d'étalonnage, parce que les écrans sont
 * démontés quand on change d'onglet : l'étape était alors perdue tandis que
 * l'enregistrement continuait. Au retour, l'application savait qu'un
 * enregistrement tournait mais plus lequel, toutes les étapes s'annonçaient
 * occupées par une autre, et plus aucun bouton ne permettait de l'arrêter. Il
 * suffisait d'aller regarder l'écran de conduite — ce que fait forcément
 * quelqu'un qui roule — pour condamner l'écran jusqu'au rechargement.
 */
export const calibrationStep = ref<CalibrationStepId | null>(null)

export function setCalibration(session: CalibrationSession): boolean {
  calibration.value = session
  return saveCalibration(session)
}

const calibrationAnalyses = computed(() => analyzeSession(calibration.value, traces.value))

/** Ce que la mesure impose au profil courant, en clair. */
export const calibrationOverrides = computed(() =>
  overridesFor(activeProfile.value, calibrationAnalyses.value),
)

/**
 * Les étapes qui manquent pour que l'étalonnage compte.
 *
 * Vide quand il n'y a rien d'enregistré comme quand tout l'est : c'est la
 * présence d'une session entamée qui distingue les deux, et l'écran le sait.
 */
export const calibrationMissing = computed(() =>
  calibrationAnalyses.value.length === 0 && Object.keys(calibration.value).length === 0
    ? []
    : missingStepLabels(calibrationAnalyses.value),
)

/**
 * Le profil que le moteur emploie : le réglé, corrigé par le mesuré.
 *
 * C'est lui que lisent le conditionnement, le moteur, la boîte et le mixage.
 * L'écran de configuration, lui, édite `activeProfile` — on règle ce qu'on a
 * choisi, on entend ce que la voiture peut.
 */
export const runtimeProfile = computed<Profile>(() =>
  withCalibration(activeProfile.value, calibrationOverrides.value),
)

const simulator = new SimulatorSource()
const gpsBench = new GpsBench(simulator)
const geolocation = new GeolocationSource({
  maxPlausibleKmh: activeProfile.value.speed.maxPlausibleKmh,
  maxAccuracyM: activeProfile.value.speed.maxAccuracyM,
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
const synth = new SynthEngine()
const screenLock = new ScreenLock()
const mediaSession = new MediaSession()
const offline = new Offline()

/**
 * Les écrans de banc — simulateur de vitesse, réglage de la synthèse.
 *
 * Ils sont là en développement, et dans l'image `:develop`, jamais en
 * production. C'est l'arbitrage du 8 septembre 2026, qui reprend celui du
 * 4 septembre en lui laissant une porte : un banc n'a rien à faire dans la
 * voiture qui sert au quotidien, mais la pile d'essai **est** dans la voiture,
 * et c'est là, garé, qu'un timbre se règle et qu'un défaut de son se cerne.
 *
 * Ce qu'on y gagne s'est déjà vu : « le simulateur fonctionne encore, repasser
 * au GPS rebloque aussitôt » est la phrase qui a orienté le diagnostic du GPS
 * muet du 4 septembre.
 */
const benchAvailable = import.meta.env.DEV || __BENCH__

export const simulatorAvailable = benchAvailable

/**
 * Ce que le banc fabrique, quand le simulateur est la source.
 *
 * - `perfect` : une vitesse exacte à chaque image. Toute la difficulté du
 *   produit disparaît, ce qui reste commode pour juger un réglage de son.
 * - `measured` : la même vitesse, livrée à la cadence d'un GPS et bruitée.
 * - `positions` : des positions complètes, lues par la **vraie** source GPS.
 *   C'est le seul mode qui traverse `GeolocationSource`, où vivaient les deux
 *   derniers défauts relevés en roulant.
 */
export type SimulationMode = 'perfect' | 'measured' | 'positions'
export const simulationMode = ref<SimulationMode>('perfect')
export const benchOptions = ref<BenchOptions>({ ...DEFAULT_BENCH })

export const sourceKind = ref<SourceKind>(simulatorAvailable ? 'simulator' : 'geolocation')
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

/**
 * Pourquoi la vitesse s'est figée alors que des positions arrivent.
 *
 * Le chien de garde ne sait pas le dire : il ne voit qu'un silence, et relance
 * un suivi qui marche. Cette cause-là se lit sur l'écran de conduite, parce
 * qu'elle se corrige par un réglage et non en attendant.
 */
const rejectionWatch = new RejectionWatch()
export const rejectionCause = ref<RejectionCause | null>(null)

/**
 * Manette de jeu, pour conduire le simulateur au bureau.
 *
 * Elle n'apparaît qu'après un premier appui — le navigateur ne la révèle pas
 * avant, pour ne pas la donner comme empreinte à toute page ouverte.
 */
const padReader = new GamepadReader()
export const padConnected = ref(false)
/** Ce que le navigateur dit de la manette : son nom, et l'agencement annoncé. */
export const padLabel = ref('')
export const padMapping = ref('')

/**
 * La manette se signale d'elle-même, sans attendre la boucle.
 *
 * La lecture des commandes vit dans la boucle, avec le reste ; mais la
 * **détection** ne peut pas en dépendre. Boucle à l'arrêt, l'écran affirmait
 * qu'aucune manette n'était branchée, et rien ne permettait de savoir si le
 * navigateur la voyait. L'événement, lui, arrive au premier appui — le moment
 * exact où le navigateur consent à la révéler.
 */
if (typeof window !== 'undefined') {
  window.addEventListener('gamepadconnected', (event) => {
    const pad = (event as GamepadEvent).gamepad
    padConnected.value = true
    padLabel.value = pad.id
    padMapping.value = pad.mapping
  })
  window.addEventListener('gamepaddisconnected', () => {
    padConnected.value = false
    padLabel.value = ''
    padMapping.value = ''
  })
}
/**
 * Ce que la source GPS a vu passer, pour l'écran de télémétrie.
 *
 * Une source qui reçoit des positions sans en tirer aucune vitesse donne le même
 * écran qu'une source qui ne reçoit rien : une vitesse figée. Ces comptes sont
 * ce qui distingue les deux, et leur absence a coûté une semaine.
 */
export const fixStats = ref({
  received: 0,
  emitted: 0,
  implausible: 0,
  tooClose: 0,
  inaccurate: 0,
  lastAccuracyM: null as number | null,
  recentAccuracyM: [] as number[],
})

/**
 * État de l'autorisation de géolocalisation à l'ouverture de la page.
 *
 * Relevé ici, au chargement du module, et pas plus tard : c'est le seul moment
 * où il répond à la question posée — l'autorisation est-elle retenue d'une
 * session à l'autre, ou faut-il la redonner à chaque démarrage de la voiture ?
 * Interrogé après un premier suivi, il vaudrait « accordée » dans les deux cas.
 */
export const geolocationPermissionAtStart = ref<'inconnu' | 'accordée' | 'à demander' | 'refusée'>(
  'inconnu',
)

if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
  // `PermissionName` ne connaît pas encore « geolocation » dans tous les
  // navigateurs, d'où la conversion : l'interroger reste sans effet de bord.
  void navigator.permissions
    .query({ name: 'geolocation' as PermissionName })
    .then((status) => {
      const dire = { granted: 'accordée', prompt: 'à demander', denied: 'refusée' } as const
      geolocationPermissionAtStart.value = dire[status.state] ?? 'inconnu'
    })
    .catch(() => {
      // Certains navigateurs embarqués refusent la requête elle-même. Rester sur
      // « inconnu » vaut mieux qu'annoncer un état inventé.
    })
}
export const isRecording = ref(false)
export const recordedCount = ref(0)
export const traces = ref<Trace[]>(loadTraces())
/** Message d'échec de l'enregistrement des traces, quand le quota est atteint. */
export const traceStorageError = ref('')
export const replayProgress = ref(0)
export const audioStatus = ref<AudioStatus>({ ...audio.status })

/**
 * Joue le clac de la boîte seul, pour le régler à l'oreille.
 *
 * Un événement bref se juge mal quand le moteur tourne par-dessus, et il n'a
 * lieu qu'au passage d'un rapport : sans ce bouton, l'essayer demandait
 * d'accélérer jusqu'au seuil suivant à chaque changement de valeur. Le son doit
 * être activé, comme pour tout le reste.
 */
export function tryClack(): void {
  audio.clack(activeProfile.value.feel.shiftJolt.clack)
}
export const isMuted = ref(false)

/**
 * Le son synthétisé — engine-sim, en direct.
 *
 * C'est le profil qui décide, par son champ `soundSource` : une origine
 * « généré en direct » fait sonner le moteur simulé là où les deux autres font
 * jouer la banque. Le même bouton « Activer le son » sert aux deux, puisque le
 * navigateur ne laisse démarrer un son que sur un geste.
 *
 * Les deux origines ne cohabitent pas : allumer la synthèse coupe les
 * échantillons, et l'éteindre les rend.
 *
 * Ce qui est réservé au banc, c'est l'**écran de réglage** — on ne règle pas un
 * timbre en conduisant —, pas la synthèse elle-même : tout l'enjeu du lot est
 * justement de savoir ce qu'elle coûte dans la voiture. L'image `:develop` le
 * porte depuis le 8 septembre 2026, pour régler garé ce qui sonnait faux en
 * roulant.
 */
export const synthAvailable = benchAvailable
/**
 * Ce navigateur sait-il faire tourner le moteur simulé ?
 *
 * Il lui faut un `AudioWorklet` — le calcul ne peut pas vivre sur le fil de la
 * page sans creuser le son — et du WebAssembly. Un profil « généré en direct »
 * ouvert sur un navigateur qui n'a ni l'un ni l'autre doit le dire, pas grésiller.
 */
export const synthSupported =
  typeof AudioWorkletNode !== 'undefined' && typeof WebAssembly !== 'undefined'
/** L'origine de son que le profil actif déclare. */
export const soundOrigin = computed(() => soundSourceOf(activeProfile.value))
/** Le profil actif fait-il sonner le moteur simulé plutôt que la banque ? */
export const synthIsOrigin = computed(() => soundOrigin.value === 'live')
/**
 * Ce qui décrit la machine qui calcule : fréquence de simulation, taille de
 * bloc, réserve, et les outils du banc. Ces valeurs ne suivent pas un profil
 * d'un appareil à l'autre — un téléphone n'a pas la marge d'un poste de bureau.
 */
const synthDevice = ref<SynthSettings>({ ...DEFAULT_SYNTH })

/**
 * Les réglages complets du synthétiseur : l'appareil, recouvert par le rendu du
 * profil actif.
 *
 * Le rendu — échappement, volume, crête visée, papillon — vient du profil et
 * non d'ici, parce qu'il décrit le moteur et doit le suivre. Changer de profil
 * change donc le son sans qu'on ait rien à recopier, et essayer un autre moteur
 * l'amène avec son réglage.
 */
export const synthSettings = computed<SynthSettings>(() => ({
  ...synthDevice.value,
  ...(activeProfile.value.rendering ?? DEFAULT_RENDERING),
}))
/**
 * Faire tourner la synthèse sans qu'elle sorte du haut-parleur.
 *
 * Ce n'est pas un confort : la charge, les creux et le niveau crête se
 * mesurent tous en amont de la sortie. On relève donc ce que coûte un réglage
 * sans avoir à l'écouter — et sans réveiller la maison.
 */
export const synthSilent = ref(false)
export const synthStatus = ref<SynthStatus>({ ...synth.status })
synth.onStatus = (status) => {
  synthStatus.value = status
}

/**
 * Le moteur que décrit le profil actif.
 *
 * C'est le profil qui porte la définition, et l'écran de synthèse la modifie
 * dedans : cette lecture est ce qui relie les deux, et elle est tolérante parce
 * qu'un profil reçu par lien depuis une version antérieure n'en porte pas.
 */
export const engineDefinition = computed<EngineDefinition>(() =>
  clampEngineDefinition(activeProfile.value.engineDefinition ?? {}),
)

/**
 * Écrit une définition de moteur dans le profil actif, et la fait entendre.
 *
 * Tout sauf les deux bruits demande de rebâtir le moteur simulé, soit une
 * coupure d'une seconde environ : c'est `SynthEngine` qui en décide.
 */
export async function applyEngineDefinition(definition: EngineDefinition): Promise<void> {
  activeProfile.value.engineDefinition = clampEngineDefinition(definition)
  await synth.setEngineDefinition(activeProfile.value.engineDefinition)
}

/**
 * Charge un moteur entier : sa définition, son rupteur **et** son rendu.
 *
 * Les trois vont ensemble. Un GM LS chargé sous le rupteur d'un quatre
 * cylindres ne serait plus un GM LS, et l'écran n'aurait plus rien de fiable à
 * dire sur ce qui est chargé. C'est aussi pour cela que le rupteur reste en
 * gris dans le banc de synthèse : il se règle dans la section moteur du profil,
 * ou il arrive avec le moteur.
 */
export async function applyLibraryEngine(engine: LibraryEngine): Promise<void> {
  activeProfile.value.engine.redlineRpm = engine.redlineRpm
  // Le rendu part avec le moteur, sinon on l'écouterait à travers l'échappement
  // du précédent — et l'on ne saurait plus lequel des deux on entend.
  activeProfile.value.rendering = { ...engine.rendering }
  // Le balayage du banc doit suivre le rupteur qui vient d'arriver, sinon il
  // continue de monter jusqu'à l'ancien.
  synth.setRpmRange(runtimeProfile.value.engine.idleRpm, runtimeProfile.value.engine.redlineRpm)
  await applyEngineDefinition({ ...engine.definition })
  // La définition ne rebâtit que le moteur ; le rendu s'applique par le même
  // chemin que les réglages du banc, sans quoi il resterait dans le profil sans
  // atteindre le graphe audio.
  await synth.apply(synthSettings.value)
}

/** Allume ou coupe le son synthétisé. À appeler depuis un geste de l'écran. */
export async function setSynthEnabled(enabled: boolean): Promise<void> {
  // Le silence est appliqué avant la construction du graphe, et non au premier
  // tour de boucle : sinon la première image sort à plein niveau alors qu'on
  // avait demandé le silence.
  synth.setMuted(isMuted.value || synthSilent.value)
  // Le balayage du banc va du ralenti au rupteur du profil actif : le régime
  // qu'on écoute doit être celui que la voiture atteindra vraiment.
  synth.setRpmRange(runtimeProfile.value.engine.idleRpm, runtimeProfile.value.engine.redlineRpm)
  await synth.setEngineDefinition(engineDefinition.value)
  if (enabled) await synth.start(synthSettings.value)
  else await synth.stop()
}

/** Coupe la sortie du banc sans rien arrêter derrière. */
export function setSynthSilent(silent: boolean): void {
  synthSilent.value = silent
  synth.setMuted(isMuted.value || silent)
}

/** Applique les réglages du banc. Certains coupent le son le temps de rebâtir. */
export async function applySynthSettings(settings: SynthSettings): Promise<void> {
  // Le lot arrive entier ; il repart en deux, chacun là où il vit. Le profil
  // est enregistré tout seul, par le veilleur qui suit la liste des profils.
  synthDevice.value = settings
  activeProfile.value.rendering = renderingOf(settings)
  synth.setRpmRange(runtimeProfile.value.engine.idleRpm, runtimeProfile.value.engine.redlineRpm)
  await synth.apply(synthSettings.value)
}
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
synth.setMasterVolume(masterVolume.value)

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
 * est regardé.
 */
export type DriveFace = 'dials' | 'numbers'

const FACE_KEY = 'speed.driveFace.v1'
const JOURNAL_KEY = 'speed.journal.v1'

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

export function setDriveFace(face: DriveFace): void {
  driveFace.value = face
  writePreference(FACE_KEY, face)
}

/**
 * Ce que l'utilisateur a accepté d'envoyer au serveur, par cran.
 *
 * Une préférence de **cet appareil**, comme le volume : elle ne voyage ni par
 * lien ni par fichier, et un profil partagé ne l'emporte pas. Rien n'est envoyé
 * par défaut, et le cran étendu — qui ajoute la position et les traces — se
 * choisit séparément du minimum : il ne s'en déduit jamais.
 *
 * L'accord gouvernait le seul journal ; il gouverne maintenant tout ce qui
 * remonte. La clé de rangement ne change pas pour autant : la renommer aurait
 * remis à « rien n'est envoyé » un accord déjà donné, et fait croire à une
 * panne.
 */
export const uploadConsent = ref<UploadConsent>(readConsent())

function readConsent(): UploadConsent {
  const stored = readPreference(JOURNAL_KEY)
  return stored === 'minimal' || stored === 'extended' ? stored : 'none'
}

export function setUploadConsent(consent: UploadConsent): void {
  uploadConsent.value = consent
  writePreference(JOURNAL_KEY, consent)
  collector.setConsent(consent)
  // Un accord qui s'ouvre fait partir ce qui attendait, sans attendre le
  // prochain passage de la boucle : c'est le geste qui vient d'être fait.
  if (consent !== 'none') void flushUploads(Date.now(), true)
}

/**
 * Le journal de la session en cours.
 *
 * Une session couvre l'ouverture de la page, et non un trajet : le navigateur de
 * la voiture ne prévient pas quand il se ferme, et découper autrement demanderait
 * de deviner. L'identifiant est tiré au démarrage et sert de préfixe aux
 * tranches, ce qui les regroupe et les trie.
 */
const journalStartedAt = Date.now()
const journal = new Journal({ sessionId: newSessionId(), startedAt: journalStartedAt })
/**
 * Temps de session du journal, accumulé depuis le pas de la boucle.
 *
 * Et non `Date.now()`. Toute la chaîne avance par `dt`, et le banc de mise au
 * point déroule des heures en quelques secondes : un journal branché sur
 * l'horloge murale n'y produisait aucune tranche, donc ne s'y vérifiait pas. La
 * date réelle sert encore à nommer les fichiers, ce qui est son emploi juste.
 */
let journalElapsedMs = 0
const collector = new JournalCollector(journal, readConsent())

/** Tranches déposées, pour que l'écran dise ce qui est parti. */
export const journalDeposits = ref<{ name: string; bytes: number }[]>([])
/** Dernier échec de dépôt, à afficher tel quel. */
export const journalError = ref('')
/** Vrai pendant un dépôt : on n'en lance pas deux à la fois. */
let journalBusy = false

/**
 * Dépose une tranche si l'heure est venue.
 *
 * Appelé depuis la boucle, mais **sans l'attendre** : un dépôt prend le temps du
 * réseau, et la cadence du son ne se règle pas sur celle d'une requête. Un seul
 * dépôt court à la fois, sinon deux tranches partiraient dans un ordre que
 * personne ne garantit.
 */
function depositJournalIfDue(nowMs: number): void {
  if (journalBusy || !sendsAutomatically(uploadConsent.value, 'journal')) return
  if (!journal.shouldSlice(nowMs)) return

  const slice = journal.takeSlice(nowMs)
  if (!slice) return

  journalBusy = true
  void depositSlice(slice, depositCredentials.value)
    .then((outcome) => {
      if (outcome.ok) {
        journalError.value = ''
        journalDeposits.value = [...journalDeposits.value, { name: outcome.name, bytes: outcome.bytes }]
        return
      }
      journalError.value = outcome.detail
      // La tranche revient en attente et se joindra à la suivante : c'est ce qui
      // fait qu'un tunnel ne coûte pas un journal.
      if (outcome.retry) journal.restore(slice)
    })
    .finally(() => {
      journalBusy = false
    })
}

/**
 * Ce que le son a coûté, pour le journal.
 *
 * Rendu `null` quand le profil joue des échantillons : le lecteur de synthèse ne
 * tourne pas, et ses compteurs diraient zéro — ce qui se lirait comme un son
 * parfait plutôt que comme une absence de mesure.
 */
function soundCost(): SoundCost | null {
  const status = synthStatus.value
  if (status.phase !== 'ready') return null
  return {
    realtime: status.realtime,
    cpuLoad: status.cpuLoad,
    underruns: status.underruns,
    underrunMs: status.underrunMs,
    peak: status.peak,
    clipping: status.clipped,
  }
}

/**
 * Cadence de la file, en millisecondes d'horloge murale.
 *
 * La boucle tourne soixante fois par seconde ; interroger la file à cette
 * cadence ne servirait qu'à brûler du temps. Une seconde suffit : c'est la file
 * elle-même qui décide ensuite d'attendre après un échec.
 */
const FLUSH_EVERY_MS = 1000
let lastFlushAt = 0

function flushUploadsIfDue(): void {
  const now = Date.now()
  if (now - lastFlushAt < FLUSH_EVERY_MS) return
  lastFlushAt = now
  void flushUploads(now)
}

/**
 * Dépôt d'une trace sur le serveur.
 *
 * Le navigateur de la voiture refuse tout téléchargement : c'est par là que les
 * traces en sortent. Le compte est une préférence de l'appareil, comme le volume.
 */
export const depositCredentials = ref(loadDepositCredentials())

export function setDepositCredentials(user: string, password: string): void {
  depositCredentials.value = { user, password }
  saveDepositCredentials(depositCredentials.value)
}

/** Nom de la trace en cours de dépôt, pour désactiver son bouton. */
export const depositing = ref('')
/** Résultat du dernier dépôt, à afficher tel quel. */
export const depositMessage = ref('')

export async function depositTrace(trace: Trace): Promise<DepositOutcome> {
  depositing.value = trace.name
  depositMessage.value = ''
  try {
    const issue = await deposit(trace, depositCredentials.value)
    depositMessage.value = issue.ok
      ? `« ${issue.name} » déposée.`
      : issue.detail
    return issue
  } finally {
    depositing.value = ''
  }
}

// --- La remontée automatique ---------------------------------------------

/**
 * Ce qui attend de partir sur le serveur.
 *
 * Une voiture traverse des zones sans réseau, et c'est le cas normal sur une
 * route. Sans file, chaque nature de fichier aurait traité le hors-réseau à sa
 * façon : on pose ici ce qui doit partir, la file l'envoie quand elle peut, et
 * ce qui est parti la quitte.
 *
 * Le journal, lui, garde son mécanisme de tranches, qui fait mieux : ce qui
 * n'est pas parti se joint à la tranche suivante au lieu de faire un fichier de
 * plus.
 */
const uploads = new UploadQueue()
uploads.restore(loadQueue())

/** Ce qui attend, pour que l'écran le dise plutôt que de le laisser deviner. */
export const uploadPending = ref<QueuedUpload[]>([...uploads.list()])
/** Dernier échec de remontée, à afficher tel quel. */
export const uploadError = ref('')
/** Échec d'écriture de la file elle-même, comme pour les traces. */
export const uploadStorageError = ref('')

function rememberQueue(): void {
  uploadPending.value = [...uploads.list()]
  uploadError.value = uploads.lastError
  uploadStorageError.value = saveQueue(uploads.list())
    ? ''
    : "La file d'attente n'a pas pu être enregistrée : espace de stockage insuffisant."
}

/** Vrai pendant un envoi : deux passes en parallèle enverraient deux fois. */
let flushing = false

/**
 * Envoie ce qui attend, si l'heure est venue.
 *
 * Sans `await` du côté de la boucle : un dépôt prend le temps du réseau, et la
 * cadence du son ne se règle pas sur celle d'une requête.
 */
export async function flushUploads(nowMs: number, force = false): Promise<void> {
  if (flushing || uploadConsent.value === 'none') return
  if (force) uploads.retryNow()
  if (!uploads.ready(nowMs)) return

  flushing = true
  try {
    await uploads.flush(nowMs, (item) =>
      putFile(item.folder, item.name, item.body, depositCredentials.value),
    )
  } finally {
    flushing = false
    rememberQueue()
  }
}

/** Relance demandée à la main, quand on ne veut pas attendre. */
export function retryUploads(): void {
  void flushUploads(Date.now(), true)
}

function enqueue(item: QueuedUpload): void {
  uploads.add(item)
  rememberQueue()
  void flushUploads(Date.now())
}

// Le retour du réseau est le moment exact où ce qui attend peut partir :
// l'attendre coûte moins qu'un essai toutes les trente secondes dans un tunnel.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => void flushUploads(Date.now(), true))
}

/**
 * Une trace enregistrée part toute seule, au cran de la conduite.
 *
 * Le nom du fichier est celui du dépôt manuel : les deux voies produisent le
 * même fichier au même endroit, et l'identifiant de file porte le début de
 * l'enregistrement, ce qui empêche de déposer deux fois la même trace.
 */
function queueTrace(trace: Trace): void {
  if (!sendsAutomatically(uploadConsent.value, 'trace')) return
  enqueue({
    id: `trace:${trace.startedAt}`,
    kind: 'trace',
    folder: TRACE_FOLDER,
    name: depositName(trace),
    body: traceBody(trace),
    queuedAt: Date.now(),
  })
}

/**
 * Un profil modifié remonte dans la bibliothèque.
 *
 * Pas à la frappe : un curseur qu'on déplace produit des dizaines de valeurs
 * intermédiaires, et aucune ne mérite un fichier. Le profil part quand la main
 * s'arrête.
 */
const PROFILE_SETTLE_MS = 3000
let profileTimer: ReturnType<typeof setTimeout> | null = null

function queueProfilesSoon(): void {
  if (!sendsAutomatically(uploadConsent.value, 'profile')) return
  if (profileTimer !== null) clearTimeout(profileTimer)
  profileTimer = setTimeout(() => {
    profileTimer = null
    const profile = profiles.value.find((entry) => entry.id === selectedId.value)
    if (!profile) return
    enqueue({
      id: profileUploadId(profile),
      kind: 'profile',
      folder: PROFILE_FOLDER,
      name: profileFileName(profile),
      body: profileBody(profile),
      queuedAt: Date.now(),
    })
  }, PROFILE_SETTLE_MS)
}

export const offlineStatus = ref<OfflineStatus>({ ...offline.status })

export const telemetry = shallowRef<Telemetry>({
  speed: {
    kmh: 0,
    accelMs2: 0,
    rawKmh: 0,
    derived: false,
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
    effort: 0,
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
  // En mode « positions », c'est la vraie source GPS qui travaille : le banc ne
  // fait que lui fournir à lire. Rien en aval ne doit pouvoir distinguer les deux.
  if (simulationMode.value === 'positions') return geolocation
  return simulator
}

/** Vrai quand le banc doit être avancé à la place de la source. */
function benchDrives(): boolean {
  return sourceKind.value === 'simulator' && simulationMode.value === 'positions'
}

/**
 * La position de l'accélérateur est-elle une information dont dispose le moteur ?
 *
 * Seulement au simulateur en vitesse exacte. Dès que le banc imite un GPS, non :
 * la voiture ne dit pas ce que fait le pied, et c'est précisément la difficulté
 * qu'on veut mettre à l'épreuve.
 */
function padThrottleKnown(): boolean {
  return sourceKind.value === 'simulator' && simulationMode.value === 'perfect'
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
  const { drivetrain } = runtimeProfile.value
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
 * Passage de rapport en cours au tour précédent.
 *
 * Le claquement se tire quand il se termine, pas quand il commence : c'est la
 * reprise du couple qui rallume l'imbrûlé, et c'est là qu'on l'entend.
 */
let wasShifting = false
/** Le clac de ce passage-ci a déjà été tiré : il n'en faut qu'un. */
let clackDone = false
/**
 * Régime au moment où l'on était encore en charge.
 *
 * C'est lui qui décide s'il reste de quoi brûler, et non le régime constaté une
 * demi-seconde plus tard, quand la charge a fini de retomber et que le moteur a
 * déjà perdu des tours.
 */
let rpmWhenLoaded = 0

function step(dt: number): void {
  applyPad(dt)

  const source = currentSource()
  if (benchDrives()) gpsBench.tick(dt)
  else source.tick(dt)

  const speed = conditioner.tick(dt)
  const profile = runtimeProfile.value

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
    shiftProgress: gearboxState.shiftProgress,
    shiftDipRpm: profile.feel.shiftJolt.enabled ? profile.feel.shiftJolt.dipRpm : 0,
    shiftBlipRpm: profile.feel.shiftJolt.enabled ? profile.feel.shiftJolt.blipRpm : 0,
    // La pédale n'est connue qu'en « vitesse exacte ». Dès que le banc imite un
    // GPS, elle ne l'est plus — c'est tout le sujet : une voiture ne dit pas ce
    // que fait le pied, et la charge doit se déduire de l'accélération mesurée.
    // La transmettre quand même faisait que les trois modes s'entendaient
    // pareil : le calcul de charge réel n'était jamais exercé.
    throttle: padThrottleKnown() ? simulator.getThrottle() : null,
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

  // Les deux bruits d'un passage, et ils ne tombent pas au même instant.
  //
  // Le clac de la boîte arrive quand le rapport s'engage, au sommet du coup de
  // gaz — pas à la fin du passage : ce qui reste après lui, c'est l'embrayage
  // qui se lâche, et cela ne claque pas. Le claquement d'échappement, lui,
  // suit la reprise du couple, donc la fin.
  const jolt = profile.feel.shiftJolt
  const sonore = jolt.enabled && !isMuted.value
  if (sonore && gearboxState.isShifting && !clackDone && gearboxState.shiftProgress >= SHIFT_CLACK_AT) {
    // Plus discret en descendant : on rétrograde pied levé ou en freinant, donc
    // avec un moteur bien plus doux, et le même clac y paraît deux fois plus
    // fort. C'est un réglage et non un calcul : le bon dosage dépend de la
    // banque.
    const descend = gearboxState.shiftDirection === 'down'
    audio.clack(jolt.clack * (descend ? jolt.clackDownshift : 1))
    clackDone = true
  }
  if (wasShifting && !gearboxState.isShifting) {
    if (sonore && jolt.crackle > 0) audio.backfire(jolt.crackle, 1)
  }
  if (!gearboxState.isShifting) clackDone = false
  wasShifting = gearboxState.isShifting

  // Une seule origine de son à la fois. Le régime transmis est le régime
  // **entendu**, celui qui porte le tremblement, comme pour les échantillons.
  //
  // On transmettait le régime net, au motif que le tremblement « sortait tout
  // seul du modèle physique ». Mesuré le 8 septembre 2026 : il n'en sort pas.
  // Le régime tenu par le moteur simulé est exactement le régime demandé — 780
  // pour 780, 2 952 pour 2 952 — parce que le dynamomètre travaille au couple
  // maximum du domaine. Le son n'avait donc aucune variation de régime, nulle
  // part, et un régime rigoureusement constant donne un signal rigoureusement
  // périodique.
  if (synth.isRunning) {
    audio.mute()
    synth.setMuted(isMuted.value || synthSilent.value)
    synth.setTarget(engineState.audibleRpm, engineState.effort)
  } else if (isMuted.value) audio.mute()
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
      clacks: audio.status.clacks,
      activeSources: audio.status.activeSources,
      layerRefreshes: audio.status.layerRefreshes,
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

  if (sourceKind.value === 'geolocation') {
    const stats = geolocation.stats
    rejectionCause.value = watching
      ? rejectionWatch.tick(dt, {
          received: stats.received,
          emitted: stats.emitted,
          implausible: stats.rejected.implausible,
          tooClose: stats.rejected.tooClose,
          inaccurate: stats.rejected.inaccurate,
        })
      : null
    fixStats.value = {
      received: stats.received,
      emitted: stats.emitted,
      implausible: stats.rejected.implausible,
      tooClose: stats.rejected.tooClose,
      inaccurate: stats.rejected.inaccurate,
      lastAccuracyM: stats.lastAccuracyM,
      recentAccuracyM: [...stats.recentAccuracyM],
    }
  }

  // Le journal regarde le même instantané que la télémétrie, et décide seul de
  // se taire : c'est lui qui sait à quelles transitions il tient, non la boucle.
  journalElapsedMs += dt * 1000
  collector.observe({
    at: journalElapsedMs,
    source: sourceKind.value,
    sourceStatus: sourceStatus.value,
    derived: speed.derived,
    kmh: speed.kmh,
    accelMs2: speed.accelMs2,
    rpm: engineState.rpm,
    gear: gearboxState.gear + 1,
    load: engineState.load,
    fixRestarts: fixWatchdog.restarts,
    rejected: {
      implausible: geolocation.stats.rejected.implausible,
      tooClose: geolocation.stats.rejected.tooClose,
      inaccurate: geolocation.stats.rejected.inaccurate,
    },
    audioState: audio.status.contextState,
    accuracyM: geolocation.stats.lastAccuracyM,
    latitude: geolocation.lastPosition?.latitude ?? null,
    longitude: geolocation.lastPosition?.longitude ?? null,
    sound: soundCost(),
  })
  depositJournalIfDue(journalElapsedMs)
  flushUploadsIfDue()

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
  runtimeProfile,
  (profile) => {
    conditioner.setPreset(profile.speed)
    gearbox.setPresets(profile.drivetrain, profile.engine, profile.feel)
    engine.setPresets(profile.engine, profile.mix)
    geolocation.setOptions({
      maxPlausibleKmh: profile.speed.maxPlausibleKmh,
      maxAccuracyM: profile.speed.maxAccuracyM,
    })
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

/**
 * Le son a-t-il été demandé ?
 *
 * Ni l'un ni l'autre des deux moteurs ne peut porter cette mémoire : changer
 * d'origine remet justement l'un des deux à zéro. Sans elle, passer sur un
 * profil à synthèse allumerait un son que personne n'a demandé, et en revenir
 * laisserait muet un son qui jouait.
 */
let soundWanted = false

/**
 * Passe d'une origine de son à l'autre : la banque, ou le moteur simulé.
 *
 * **L'invariant « une seule origine à la fois » se tient ici, à la transition.**
 * La boucle continue de faire taire la banque tant que le moteur simulé tourne,
 * mais elle ne peut pas en être la garantie : le jour où elle s'arrête, plus
 * rien ne coupe la banque et les deux sons se superposent. C'est ce qui est
 * arrivé le 7 septembre 2026 — le bouton annonçait « Son actif », donc le moteur
 * simulé était bien en service, et le ralenti de la banque s'entendait dessous.
 *
 * Le son suit son origine sans qu'on ait à le redemander : il était actif avant
 * le changement, il l'est après. Aucun geste nouveau n'est nécessaire, le
 * contexte audio ayant déjà été déverrouillé par le premier.
 */
async function applySoundOrigin(direct: boolean): Promise<void> {
  if (direct) {
    // La banque part pour de bon, lectures comprises : la laisser tourner à
    // gain nul, c'est garder cinq lectures vivantes sous un son qu'elles ne
    // produisent plus.
    audio.unload()
    refreshAudioStatus()
    if (soundWanted) await setSynthEnabled(true)
    return
  }

  await synth.stop()
  if (!soundWanted) return
  await audio.activate(activeProfile.value)
  audio.setKeepAlive(backgroundAudio.value)
  refreshAudioStatus()
}

// Les changements s'enchaînent au lieu de se croiser : deux allers-retours
// rapides entre les deux origines lanceraient sinon un démarrage et un arrêt en
// même temps, et l'ordre d'arrivée déciderait de ce qui sort.
let originSwitch: Promise<void> = Promise.resolve()
watch(synthIsOrigin, (direct) => {
  originSwitch = originSwitch.then(() => applySoundOrigin(direct)).catch(() => {})
})

watch(
  profiles,
  (list) => {
    saveProfiles(list)
    queueProfilesSoon()
  },
  { deep: true },
)
watch(selectedId, (id) => {
  saveSelectedId(id)
  gearbox.settleFor((gear) => rpmInGear(gear, telemetry.value.speed.kmh))
})

/**
 * Dépose les dernières secondes du son de la synthèse sur le serveur.
 *
 * Le banc hors navigateur refait la chaîne, mais il ne reproduit ni le lecteur,
 * ni la convolution du navigateur, ni la carte son. Le 8 septembre 2026, un
 * cliquetis entendu dans la voiture était absent du son que ce banc fabriquait
 * avec exactement les mêmes réglages : sans capture, la question restait
 * indécidable.
 *
 * Le fichier part dans `mesures/`, comme les relevés de la sonde, parce que le
 * navigateur de la voiture ne télécharge rien.
 */
export async function captureSynthSound(): Promise<string> {
  const extrait = await synth.captureOutput()
  if (extrait === null) return 'Rien à capturer : la synthèse ne tourne pas.'

  const nom = `son-${slug(activeProfile.value.name)}-${stamp(Date.now())}.wav`
  const fichier = toWav([extrait.samples], extrait.sampleRate)
  const secondes = (extrait.samples.length / extrait.sampleRate).toFixed(0)

  const issue = await putFile('/mesures/', nom, fichier, depositCredentials.value)
  if (issue.ok) return `${secondes} s déposées dans mesures/${nom}.`

  // Le dépôt n'existe que sur le serveur : au poste de travail, sous le serveur
  // de développement, il n'y a pas de WebDAV et la réponse est un 404. Le
  // téléchargement prend alors le relais — et c'est l'inverse dans la voiture,
  // où le navigateur ne télécharge rien mais où le dépôt marche.
  if (telecharger(fichier, nom)) {
    return `${secondes} s téléchargées (${nom}) — le dépôt a répondu : ${issue.detail}`
  }
  return issue.detail
}

/** Propose un fichier au téléchargement. Faux si le navigateur s'y refuse. */
function telecharger(contenu: Blob, nom: string): boolean {
  try {
    const url = URL.createObjectURL(contenu)
    const lien = document.createElement('a')
    lien.href = url
    lien.download = nom
    document.body.appendChild(lien)
    lien.click()
    lien.remove()
    // Laisser au navigateur le temps de lire l'adresse avant de la révoquer.
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    return true
  } catch {
    return false
  }
}

export function start(): void {
  // L'attente d'une première mesure s'ouvre ici : c'est ce qui permet au chien
  // de garde de relancer un suivi qui n'a jamais rien reçu.
  conditioner.reset()
  fixWatchdog.reset()
  fixRestarts.value = 0
  rejectionWatch.reset()
  rejectionCause.value = null
  currentSource().start()
  loop.start()
  isRunning.value = true
}

export function stop(): void {
  currentSource().stop()
  loop.stop()
  isRunning.value = false
  // Le son synthétisé n'est plus alimenté en régime : le laisser tourner
  // reviendrait à tenir indéfiniment le dernier régime reçu.
  void synth.stop()
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

/**
 * La liste surveillée suit le profil.
 *
 * Elle n'était déclarée qu'au démarrage : changer de banque — ou de profil, ou
 * éteindre une couche — laissait l'écran compter les fichiers de l'ancienne, et
 * « Préparer hors réseau » mettait en cache ceux dont on venait de se
 * détourner. Le défaut se voyait peu tant que la banque se tapait à la main ;
 * il se voit tout de suite depuis qu'elle se choisit dans une liste.
 */
watch(sampleUrls, (urls) => offline.watch(urls))

/** Met en cache tous les échantillons du profil, sans attendre d'en avoir besoin. */
export function prepareOffline(): void {
  offline.prepare()
}

/** Libère du cache les échantillons des banques dont plus aucun profil ne se sert. */
export function forgetUnusedBanks(): void {
  offline.forget(usedBanks(profiles.value))
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
  soundWanted = true
  // Un profil « généré en direct » n'a pas de banque à charger : c'est le moteur
  // simulé qu'on allume. « Généré à l'avance », lui, passe par ici comme
  // « enregistré » — sa banque est un dossier d'échantillons comme un autre.
  if (synthIsOrigin.value) {
    await setSynthEnabled(true)
    return
  }
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
  synth.setMasterVolume(volume)
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
  if (kind === 'simulator' && !simulatorAvailable) return
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
  rejectionWatch.reset()
  rejectionCause.value = null
  if (wasRunning) currentSource().start()
}

export function setThrottle(value: number): void {
  simulator.setThrottle(value)
}

export function setBrake(value: number): void {
  simulator.setBrake(value)
}

/**
 * Change ce que le banc fabrique.
 *
 * La source est arrêtée puis reprise autour du changement : passer de la vitesse
 * exacte aux positions change la source active elle-même, et un suivi laissé
 * ouvert continuerait de nourrir le conditionnement pendant la bascule.
 */
export function setSimulationMode(mode: SimulationMode): void {
  if (mode === simulationMode.value) return
  const wasRunning = isRunning.value && sourceKind.value === 'simulator'
  if (wasRunning) currentSource().stop()

  simulationMode.value = mode
  simulator.setMode(mode === 'measured' ? 'measured' : 'perfect')
  // Le fournisseur n'est branché qu'en mode « positions » : le laisser en place
  // ferait lire un banc à la place du vrai récepteur, dans la voiture.
  geolocation.setProvider(mode === 'positions' ? gpsBench : null)
  gpsBench.reset()
  conditioner.reset()
  rejectionWatch.reset()
  rejectionCause.value = null

  if (wasRunning) currentSource().start()
}

/** Réglages du signal imité : cadence, bruit, précision, vitesse annoncée. */
export function setBenchOptions(options: BenchOptions): void {
  benchOptions.value = { ...options }
  gpsBench.setOptions(options)
  simulator.setSignal(options)
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

/**
 * Manette : ce que le navigateur en dit, à ce tour précis.
 *
 * L'objet rendu par `getGamepads` est un instantané figé — il faut le
 * redemander à chaque image, et non garder la référence. La **première manette
 * non nulle** est prise : deux manettes branchées ne conduiraient pas deux
 * voitures.
 *
 * On ne filtre **pas** sur l'agencement annoncé, et c'est une correction. Exiger
 * `mapping === 'standard'` écartait en silence toute manette qui s'annonce
 * autrement — ce qui arrive selon le navigateur, le pilote et le mode de
 * liaison, et laisse l'écran affirmer qu'aucune manette n'est branchée. Ce que
 * le navigateur annonce est désormais affiché plutôt que jugé : si l'agencement
 * n'est pas standard, l'écran le dit et prévient que les boutons peuvent ne pas
 * correspondre.
 */
function readPad(): PadSnapshot | null {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return null
  for (const pad of navigator.getGamepads()) {
    if (!pad) continue
    padLabel.value = pad.id
    padMapping.value = pad.mapping
    return { buttons: pad.buttons.map((button) => button.value), axes: [...pad.axes] }
  }
  return null
}

/**
 * La manette commande le simulateur.
 *
 * Une gâchette analogique vaut mieux qu'une flèche du clavier pour juger un son :
 * la charge s'entend sur des transitions, et une commande tout ou rien ne
 * produit que la plus brutale. Les intentions sont appliquées ici, où vivent
 * déjà les commandes de l'écran — la manette n'est qu'une autre main.
 */
function applyPad(dt: number): void {
  const snapshot = readPad()
  if (snapshot !== null) padConnected.value = true
  const intent = padReader.read(snapshot, dt)
  if (!snapshot) return

  if (intent.throttle > 0 || padThrottleWasOn) simulator.setThrottle(intent.throttle)
  if (intent.brake > 0 || padBrakeWasOn) simulator.setBrake(intent.brake)
  padThrottleWasOn = intent.throttle > 0
  padBrakeWasOn = intent.brake > 0

  if (intent.shiftUp) gearbox.shiftUp()
  if (intent.shiftDown) gearbox.shiftDown()
  if (intent.toggleMode) gearbox.setMode(gearbox.getMode() === 'manual' ? 'auto' : 'manual')
  if (intent.toggleCruise) {
    simulator.setCruise(simulator.getCruise() === null ? telemetry.value.speed.kmh : null)
  }
  // Bornée comme le curseur de l'écran, qui va de zéro à un : `setMasterVolume`
  // ne plafonne pas, personne n'ayant jamais pu lui demander davantage.
  if (intent.volumeDelta !== 0) {
    setMasterVolume(Math.min(1, Math.max(0, masterVolume.value + intent.volumeDelta)))
  }
}

/**
 * Mémoire de la dernière commande de la manette.
 *
 * Sans elle, une manette au repos remettrait l'accélérateur à zéro soixante fois
 * par seconde et le curseur de l'écran ne servirait plus à rien dès qu'une
 * manette est branchée. La manette ne reprend la main qu'en étant touchée, et la
 * rend quand elle revient au repos.
 */
let padThrottleWasOn = false
let padBrakeWasOn = false

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
  // L'étape d'étalonnage ne survit pas à l'arrêt, d'où qu'il vienne : un
  // enregistrement arrêté depuis l'écran de télémétrie laissait sinon une étape
  // annoncée en cours pour toujours.
  calibrationStep.value = null
  if (trace.samples.length === 0) return null
  traces.value = [...traces.value, trace]
  queueTrace(trace)
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

export const banks = ref<Bank[]>([])

/**
 * Interroge le serveur pour les banques d'échantillons qu'on y aurait déposées.
 *
 * Une liste vide n'est pas une panne : le serveur de production sait lister,
 * mais rien n'oblige un autre à le faire, et la saisie du nom reste ouverte.
 */
export async function refreshBanks(): Promise<void> {
  banks.value = await fetchBanks()
}

/** La banque du profil actif, si le serveur l'a listée. */
export const activeBank = computed(() =>
  banks.value.find((bank) => bank.name === activeProfile.value.sampleDir),
)

/**
 * Fichiers que le profil actif déclare et que sa banque n'a pas.
 *
 * Seules les couches actives comptent : ce sont celles que le moteur ira
 * chercher, et une couche éteinte peut porter un nom laissé pour plus tard.
 */
export const missingBankFiles = computed(() =>
  missingFiles(
    activeBank.value,
    activeProfile.value.layers.filter((layer) => layer.enabled).map((layer) => layer.file),
  ),
)

export const library = ref<LibraryEntry[]>([])
export const libraryLoading = ref(false)

/** Interroge le serveur pour les profils qu'on y aurait déposés. */
export async function refreshLibrary(): Promise<void> {
  libraryLoading.value = true
  try {
    library.value = await fetchLibrary(depositCredentials.value)
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
