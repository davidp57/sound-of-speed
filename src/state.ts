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
import { soundSourceOf, type SoundSource } from './core/preset/schema'
import { playBackfire, playClack, type EventTarget } from './core/audio/events'
import { clackAmplitude, shiftCut } from './core/audio/mix'
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
import { Capture, type CaptureHeader } from './core/capture/capture'
import { depositCaptureSlice } from './core/capture/deposit'
import { captureHealth } from './core/capture/health'
import { StandstillFlush } from './core/capture/standstill'
import { JournalCollector, type SoundCost } from './core/journal/collect'
import { sendsAutomatically, type UploadConsent } from './core/upload/consent'
import { toWav } from './bench/wav'
import { archiveName, collectArchive } from './core/export/collect'
import { driveModeFromUpshiftRpm, type DriveMode } from './core/drivetrain/drive-mode'
import {
  engineFromProfile,
  profilesUsing,
  type EngineEntity,
} from './core/preset/engine-entity'
import {
  gearboxFromProfile,
  type GearboxEntity,
} from './core/preset/gearbox-entity'
import {
  customGearboxes,
  gearboxFromFile,
  loadGearboxes,
  saveGearboxes,
  upsertGearbox,
} from './core/preset/gearbox-store'
import { assembleProfile, partsFor } from './core/preset/assemble'
import { realCarFromProfile, type RealCar } from './core/preset/real-car'
import { splitProfiles } from './core/preset/split'
import {
  customEngines,
  engineFromFile,
  engineToFile,
  loadEngines,
  removeEngine,
  saveEngines,
  upsertEngine,
} from './core/preset/engine-store'
import { buildZip } from './core/export/zip'
import {
  relierCetAppareil,
  startIdentity,
  type IdentityOutcome,
  type SortDeLAncien,
} from './core/identity/client'
import {
  rattacherUneAdresse,
  seConnecter,
  supprimerSonCompte,
  type Connexion,
  type Rattachement,
  type Suppression,
} from './core/identity/compte'
import {
  appareilCourant,
  entreeDAppareil,
  rangerLAppareilChoisi,
  type Appareil,
} from './core/appareil'
import { lireLienDansUrl, type CodeDeLiaison } from './core/identity/lien'
import {
  lireLeRetourDuTiers,
  rattacherUnTiers,
  reglerLAncienCompte,
  reprendreLAncien,
  seConnecterAvecUnTiers,
  type Depart,
} from './core/identity/tiers'
import {
  prochaineEcheance,
  rolesOuverts as calculerLesRoles,
  type Role,
} from './core/identity/roles'
import { lireLaCopie, oublierLaCopie, releverLesRoles } from './core/identity/roles-client'
import { loadIdentity, saveIdentity, type LocalIdentity } from './core/identity/store'
import { UploadQueue, type QueuedUpload } from './core/upload/queue'
import { loadQueue, saveQueue } from './core/upload/store'
import {
  aRapatrier,
  cle,
  listerDistant,
  lireDistant,
  loadDejaVu,
  saveDejaVu,
} from './core/upload/rapatriement'
import {
  loadReprise,
  planDeReprise,
  prochains,
  resteAFaire,
  sansCeuxLa,
  saveReprise,
  type ARemonter,
} from './core/upload/reprise-locale'
import { putFile, slug, stamp } from './core/upload/put'
import { PROFILE_FOLDER, profileBody, profileFileName, profileUploadId } from './core/upload/profile'
import {
  ENGINE_FOLDER,
  GEARBOX_FOLDER,
  engineBody,
  entityFileName,
  entityUploadId,
  gearboxBody,
} from './core/upload/entity'
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
import { TRACE_FOLDER, depositName, traceBody } from './core/deposit/deposit'
import {
  loadCalibration,
  loadCarDecision,
  saveCalibration,
  saveCarDecision,
  type CalibrationSession,
} from './core/calibration/store'
import { overridesFromAggregate } from './core/calibration/from-aggregate'
import {
  fetchMeasuredCar,
  type MeasuredCarStatus,
  largestShift,
  shouldPropose,
  type CarAnswer,
  type CarDecision,
  type MeasuredCar,
} from './core/calibration/measured-car'
import type { CarAggregate } from './core/calibration/aggregate'
import {
  applyOrigin,
  captureOrigin,
  duplicateProfile,
  loadProfiles,
  loadTraces,
  missingFactoryProfiles,
  resetProfileSection,
  saveTraces,
  type ProfileSection,
  loadAdvancedMode,
  loadDriveMode,
  saveDriveMode,
  fromFile,
  loadInheritedVolume,
  loadMasterVolume,
  loadSelectedId,
  storedRealCar,
  saveRealCar,
  newId,
  oublierLeCompteDeDepot,
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

/**
 * Les groupes de réglages : les moteurs, les boîtes, la voiture.
 *
 * Ils sont déclarés ici et non plus bas avec leurs fonctions, parce que le
 * profil actif est **assemblé** depuis eux : il faut qu'ils existent avant lui.
 */
const engines = ref<EngineEntity[]>(loadEngines())
const gearboxes = ref<GearboxEntity[]>(loadGearboxes())

// Reprise, une seule fois : un profil enregistré avant les entités porte ses
// valeurs et n'en désigne aucune. Sans ce passage, l'assemblage le laisserait
// jouer des valeurs que plus rien n'édite.
{
  const scinde = splitProfiles(profiles.value, engines.value, gearboxes.value, newId)
  profiles.value = scinde.profiles
  engines.value = scinde.engines
  gearboxes.value = scinde.gearboxes
  // Enregistré tout de suite, et non par le veilleur : il est installé plus bas,
  // donc après ce passage. Sans cela les rattachements ne seraient nulle part, et
  // un profil dont on a réglé le moteur ne le reconnaîtrait plus au chargement
  // suivant — il s'en fabriquerait un deuxième, puis un troisième.
  saveProfiles(profiles.value)
  saveEngines(engines.value)
  saveGearboxes(gearboxes.value)
}

/** Le profil choisi, tel qu'il est enregistré : un nom et des références. */
const storedProfile = computed<Profile>(() => {
  const found = profiles.value.find((p) => p.id === selectedId.value)
  return found ?? (profiles.value[0] as Profile)
})

/**
 * La vraie voiture de cet appareil : une seule, et elle ne suit aucun profil.
 *
 * Reprise du profil actif au premier lancement, faute de mieux : c'est là que
 * les réglages de mesure vivaient, étalonnage compris.
 */
const realCar = ref<RealCar>(storedRealCar() ?? realCarFromProfile(storedProfile.value))

/** Le moteur que le profil actif désigne, quand il en désigne un. */
export const activeEngine = computed<EngineEntity | null>(() => {
  const id = storedProfile.value.engineId
  if (!id) return null
  return engines.value.find((moteur) => moteur.id === id) ?? null
})

/** La boîte que le profil actif désigne, quand il en désigne une. */
export const activeGearbox = computed<GearboxEntity | null>(() => {
  const id = storedProfile.value.gearboxId
  if (!id) return null
  return gearboxes.value.find((boite) => boite.id === id) ?? null
})

/**
 * Le profil actif, assemblé : son moteur, sa boîte, la voiture.
 *
 * Ce que tout le reste lit. Les sections portent les noms qu'elles ont toujours
 * eus — `engine`, `drivetrain`, `speed`, `mix`, `feel`, `layers` — si bien que
 * la chaîne, les écrans et l'audio n'ont pas eu à changer : seule l'écriture a
 * changé de destination, et elle passe désormais par les groupes.
 */
export const activeProfile = computed<Profile>(() =>
  assembleProfile(
    storedProfile.value,
    partsFor(storedProfile.value, engines.value, gearboxes.value, realCar.value),
  ),
)

/**
 * Ce que l'écran de réglage édite : les sections **vivantes** des groupes.
 *
 * Le même profil que ci-dessus, à un détail près qui fait tout : ses sections
 * ne sont pas des copies mais les objets des entités eux-mêmes. Un curseur qui
 * écrit `profile.engine.idleRpm` écrit donc dans le moteur, et le veilleur
 * l'enregistre. Sans ce partage, une écriture atterrirait dans une copie que
 * l'assemblage refait au tour suivant : réglage perdu, et sans un mot.
 */
export const editedProfile = computed<Profile>(() => {
  const assemble = activeProfile.value
  const moteur = activeEngine.value
  const boite = activeGearbox.value
  return {
    ...assemble,
    ...(moteur
      ? {
          engine: moteur.engine,
          mix: moteur.mix,
          layers: moteur.layers,
          sampleDir: moteur.sampleDir,
        }
      : {}),
    ...(boite ? { drivetrain: boite.drivetrain } : {}),
    feel: {
      kickdown: boite ? boite.kickdown : assemble.feel.kickdown,
      backfire: moteur ? moteur.backfire : assemble.feel.backfire,
      shiftJolt: boite ? boite.shiftJolt : assemble.feel.shiftJolt,
    },
    speed: realCar.value,
  }
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
 * Ce que le serveur a mesuré de la voiture, et ce qu'on en a fait.
 *
 * Le profileur dépose un fichier ; l'application le lit au démarrage et le
 * propose quand il est complet. Rien n'est bloquant : sans serveur, sans
 * compte, ou avant que le serveur n'ait de quoi conclure, tout reste `null` et
 * aucun écran ne montre quoi que ce soit.
 */
export const measuredCar = ref<MeasuredCar | null>(null)

/**
 * Ce qui s'est passé au dernier essai de lecture, pour que la télémétrie le
 * dise.
 *
 * Sans cela, une plomberie cassée se lit comme une absence de mesure, et il n'y
 * a rien à l'écran pour distinguer les deux — ce qui a fait attendre David
 * devant un bandeau qui ne pouvait pas venir, le 11 septembre 2026.
 */
export const measuredCarStatus = ref<MeasuredCarStatus | null>(null)
export const carDecision = ref<CarDecision | null>(loadCarDecision())

/** Ce que la voiture mesurée était la dernière fois qu'on l'a signalée. */
const signalledCar = ref<CarAggregate | null>(null)

/**
 * Faut-il proposer la mesure ?
 *
 * La proposition ne bloque rien : elle s'affiche sous les cadrans, même en
 * roulant. David : « y'a pas de raison, si je suis pas dispo je l'ignore et je
 * clic plus tard ».
 */
export const proposesMeasuredCar = computed(() =>
  shouldPropose(measuredCar.value, carDecision.value),
)

/**
 * L'écart au-delà duquel une mesure qui bouge se signale.
 *
 * Un seul nombre pour toutes les grandeurs, et le défaut est assumé : vingt
 * pour cent sur un freinage et vingt pour cent sur une vitesse tenue ne
 * s'entendent pas pareil. C'est un point de départ, à régler à l'usage.
 */
const SHIFT_NOTICE = 0.2

/**
 * Ce qui a bougé depuis la dernière fois qu'on l'a dit, quand c'est notable.
 *
 * Une couche acceptée s'affine sans rien demander — on ne redemande pas douze
 * fois par trajet. Mais un déplacement franc se dit : pneus d'hiver, voiture
 * chargée, quelqu'un d'autre au volant.
 */
export const measuredCarShift = computed(() => {
  const measured = measuredCar.value
  const previous = signalledCar.value
  if (measured === null || previous === null) return 0
  if (carDecision.value?.answer !== 'accepted') return 0
  const shift = largestShift(previous, measured.aggregate)
  return shift >= SHIFT_NOTICE ? shift : 0
})

export function acknowledgeCarShift(): void {
  signalledCar.value = measuredCar.value?.aggregate ?? null
}

/** Ce que la voiture mesurée impose au profil courant. */
export const measuredOverrides = computed(() => {
  const measured = measuredCar.value
  if (measured === null || carDecision.value?.answer !== 'accepted') return []
  return overridesFromAggregate(activeProfile.value, measured.aggregate)
})

export function answerMeasuredCar(answer: CarAnswer): void {
  const measured = measuredCar.value
  if (measured === null) return
  const decision: CarDecision = { answer, forUpdatedAt: measured.updatedAt }
  carDecision.value = decision
  saveCarDecision(decision)
  if (answer === 'accepted') signalledCar.value = measured.aggregate
}

/**
 * Va chercher ce que le serveur a mesuré.
 *
 * Appelé au démarrage, et quand on veut reprendre une proposition écartée. Sans
 * réseau ni serveur, il ne se passe rien.
 */
export async function refreshMeasuredCar(): Promise<void> {
  const probe = await fetchMeasuredCar()
  measuredCarStatus.value = probe.status
  if (probe.car === null) return
  const first = measuredCar.value === null
  measuredCar.value = probe.car
  if (first && carDecision.value?.answer === 'accepted') signalledCar.value = probe.car.aggregate
}

/**
 * Le profil que le moteur emploie : le réglé, corrigé par le mesuré.
 *
 * C'est lui que lisent le conditionnement, le moteur, la boîte et le mixage.
 * L'écran de configuration, lui, édite `activeProfile` — on règle ce qu'on a
 * choisi, on entend ce que la voiture peut.
 */
export const runtimeProfile = computed<Profile>(() =>
  // Les deux couches se composent, et l'ordre compte : l'étalonnage guidé passe
  // en dernier. Il se fait sur commande, en quelques minutes, et vise un
  // réglage précis ; la mesure du serveur s'affine toute seule sur des semaines.
  // Quand David prend la peine de dérouler le protocole, c'est lui qui décide.
  withCalibration(
    withCalibration(activeProfile.value, measuredOverrides.value),
    calibrationOverrides.value,
  ),
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
 * Ils ne dépendent plus de la construction mais de l'**appareil**, depuis le
 * 13 septembre 2026 : une seule image sert les trois usages, et c'est l'écran
 * de la voiture qui ne les montre pas. L'arbitrage du 8 septembre tient, et il
 * tient mieux — un banc n'a rien à faire dans la voiture qui roule, mais il en a
 * sur le téléphone de celui qui règle son son, garé.
 *
 * Ce qu'on y gagne s'est déjà vu : « le simulateur fonctionne encore, repasser
 * au GPS rebloque aussitôt » est la phrase qui a orienté le diagnostic du GPS
 * muet du 4 septembre.
 */
/**
 * Sur quoi tourne-t-on, et ce que ça ouvre.
 *
 * Deviné au démarrage, corrigeable depuis l'écran du compte. **Il ne protège
 * rien** : c'est l'autre axe, les rôles, que le serveur fait respecter.
 */
export const appareil = ref<Appareil>(appareilCourant())

/** Range le choix et l'applique tout de suite : les écrans suivent. */
export function choisirLAppareil(choisi: Appareil): void {
  rangerLAppareilChoisi(choisi)
  appareil.value = choisi
}

export const simulatorAvailable = computed(() => appareil.value !== 'voiture')

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

/**
 * La source au démarrage : le GPS, sauf en développement.
 *
 * **Et surtout pas le simulateur en production.** Le 10 septembre 2026, l'image
 * d'essai démarrait dessus : trente-six secondes de simulateur avant la première
 * position, en roulant. Le faire dépendre de l'appareil rejouerait ce défaut le
 * jour où une voiture serait prise pour un poste de travail.
 */
export const sourceKind = ref<SourceKind>(import.meta.env.DEV ? 'simulator' : 'geolocation')
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
/**
 * La commande de boîte — automatique ou manuelle — telle que l'écran la montre.
 *
 * Elle ne peut pas se lire dans la télémétrie : celle-ci n'est produite que par
 * la boucle, et la boucle s'arrête au repos. Les deux étiquettes semblaient
 * alors mortes — on appuyait sur « AUTO » au parking et rien ne bougeait, alors
 * que la boîte, elle, avait bien changé de mode.
 */
export const shiftMode = ref<ShiftMode>('auto')

export const rejectionCause = ref<RejectionCause | null>(null)

/**
 * La dernière précision annoncée par la source, en mètres.
 *
 * Elle sert à nommer un rejet plutôt qu'à le décrire : le 11 septembre 2026, le
 * navigateur de la voiture a annoncé **9 999,99 m** — une valeur sentinelle, pas
 * une mesure — et toutes les positions ont été écartées pendant tout un trajet.
 * L'écran disait « annoncées trop imprécises » sans donner le chiffre, et il n'y
 * avait aucun moyen de deviner qu'il s'agissait d'une sentinelle.
 */
export const lastAccuracyM = ref<number | null>(null)

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
  playEvent('clack', (target) => playClack(target, activeProfile.value.feel.shiftJolt.clack))
}

/**
 * Joue un bruit bref sur le graphe qui sonne, quel qu'il soit.
 *
 * Les deux origines de son ont leur propre contexte audio : le moteur à
 * échantillons le sien, le moteur simulé le sien. Un bruit d'événement n'est ni
 * l'un ni l'autre — c'est la boîte ou l'échappement — et il doit s'entendre dans
 * les deux cas. On demande donc au graphe actif où se brancher, plutôt que de
 * loger la recette dans l'un des deux.
 *
 * Les compteurs de télémétrie restent tenus par le moteur à échantillons, seul
 * endroit où ils sont lus : c'est un compte, pas un son.
 */
function playEvent(kind: 'clack' | 'backfire', play: (target: EventTarget) => void): void {
  const target = synth.isRunning ? synth.eventTarget() : audio.eventTarget()
  if (!target) return
  audio.noteEvent(kind)
  play(target)
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
 * justement de savoir ce qu'elle coûte dans la voiture. Régler un timbre demande
 * un écran, une souris et du temps : c'est un travail de poste de travail, et
 * l'écran ne s'ouvre que là.
 */
export const synthAvailable = computed(() => appareil.value === 'poste')
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

/**
 * Ce que fait le son, en un mot, pour les deux écrans qui l'affichent.
 *
 * `taken` est le cas qui manquait : une autre application — la musique de la
 * voiture, un appel — a pris la sortie audio et suspendu notre contexte. Le
 * bouton annonçait alors « Activer le son » alors que personne ne l'avait
 * coupé, ou « Son actif » alors que rien ne sortait. Le conducteur ne pouvait
 * pas savoir s'il devait toucher quelque chose ou si l'application était
 * cassée ; il faut le dire, et dire que le geste le rend.
 */
export type SoundState = 'loading' | 'error' | 'off' | 'muted' | 'taken' | 'on'

export const soundState = computed<SoundState>(() => {
  // Au repos il ne sort rien, quoi qu'en dise le moteur audio : « P » a coupé
  // la cadence et le mixage. L'annoncer « actif » ferait chercher une panne là
  // où il n'y a qu'un sélecteur au parking.
  if (!isRunning.value) return 'off'
  const phase = synthIsOrigin.value ? synthStatus.value.phase : audioStatus.value.phase
  if (phase === 'loading') return 'loading'
  if (phase === 'error') return 'error'
  if (phase !== 'ready') return 'off'
  if (isMuted.value) return 'muted'
  // La synthèse n'expose pas d'état de contexte : elle s'arrête franchement
  // quand on la coupe, il n'y a rien à reprendre.
  if (!synthIsOrigin.value && audioStatus.value.contextState === 'suspended') return 'taken'
  return 'on'
})
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
  const cotes = clampEngineDefinition(definition)
  editEngine((moteur) => ({ ...moteur, definition: cotes }))
  await synth.setEngineDefinition(cotes)
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
  editEngine((moteur) => ({
    ...moteur,
    engine: { ...moteur.engine, redlineRpm: engine.redlineRpm },
    // Le rendu part avec le moteur, sinon on l'écouterait à travers
    // l'échappement du précédent — et l'on ne saurait plus lequel on entend.
    rendering: { ...engine.rendering },
  }))
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
  editEngine((moteur) => ({ ...moteur, rendering: renderingOf(settings) }))
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
  // Accorder la remontée en cours de route ouvre un journal qui n'a pas encore
  // dit sur quoi il tourne. C'est précisément la session qu'on voudra lire.
  noterLAppareil()
  writePreference(JOURNAL_KEY, consent)
  collector.setConsent(consent)
  // Un accord qui s'ouvre fait partir ce qui attendait, sans attendre le
  // prochain passage de la boucle : c'est le geste qui vient d'être fait. Et il
  // ouvre peut-être la remontée initiale, ou la part de traces qu'un accord
  // minimal laissait en attente.
  if (consent !== 'none') {
    poursuivreLaRemontee()
    void flushUploads(Date.now(), true)
  }
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
/**
 * L'identifiant de la session, partagé avec la capture continue.
 *
 * C'est lui qui apparie les deux : le journal raconte le trajet, la capture le
 * rejoue, et le relecteur doit savoir qu'ils parlent du même.
 */
const sessionId = newSessionId()
const journal = new Journal({ sessionId, startedAt: journalStartedAt })
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

/**
 * Ce que le navigateur dit de lui-même, écrit **une fois** en tête de session.
 *
 * Reconnaître une voiture à sa chaîne d'agent est un pari, et rien ne permettait
 * de le vérifier : le journal déposé ne portait pas cette chaîne, et le volume du
 * NAS n'a pas de base à interroger. Il la porte désormais, et le premier trajet
 * dira si le marqueur est le bon.
 *
 * Il suit le consentement comme le reste du journal : rien n'est écrit quand on
 * n'a rien accordé.
 */
let appareilNote = false

function noterLAppareil(): void {
  if (appareilNote || typeof window === 'undefined' || uploadConsent.value === 'none') return
  appareilNote = true

  const indices = {
    agent: navigator.userAgent,
    largeur: window.screen?.width ?? window.innerWidth,
    tactile: window.matchMedia?.('(pointer: coarse)').matches === true,
  }
  const hauteur = window.screen?.height ?? window.innerHeight
  journal.add(journalElapsedMs, 'device', entreeDAppareil(indices, appareil.value, hauteur))
}

noterLAppareil()

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
  void depositSlice(slice)
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
 * La capture continue du trajet.
 *
 * Elle démarre **toute seule** quand le GPS démarre, si l'accord de remontée
 * est au dernier cran. Le mécanisme précédent demandait d'appuyer sur un bouton
 * avant de partir : le 10 septembre 2026, David a roulé trente-six minutes, le
 * journal est remonté, et la trace n'existait pas. Le transport était en place
 * depuis des jours ; c'est le geste qui manquait.
 *
 * Elle ne tourne qu'au GPS. Une session au clavier ou un rejeu n'a rien à
 * enregistrer : on capture pour revoir un trajet réel, et le simulateur se
 * refait à volonté.
 */
const capture = new Capture({
  sessionId,
  startedAt: journalStartedAt,
  header: () => captureHeader(),
})

/** Nombre de relevés retenus, pour le dire à l'écran. */
export const captureCount = ref(0)
/** Tranches de capture déposées. */
export const captureDeposits = ref<{ name: string; bytes: number }[]>([])
/** Dernier échec de dépôt de capture, à afficher tel quel. */
export const captureError = ref('')
/**
 * Pourquoi le dernier dépôt a échoué.
 *
 * Le motif et non le message : c'est lui qui décide de la couleur du témoin, et
 * un message se réécrit sans qu'on y pense.
 */
export const captureFailure = ref<'refused' | 'network' | ''>('')
/**
 * Vrai quand la capture tourne.
 *
 * Dérivé, et non posé par la boucle : un état d'affichage qui dépend de la
 * cadence de la boucle ment dès que celle-ci ralentit — page en arrière-plan,
 * application arrêtée —, et c'est précisément là qu'on regarde le témoin.
 */
export const capturing = computed(
  () =>
    sourceKind.value === 'geolocation' &&
    isRunning.value &&
    sendsAutomatically(uploadConsent.value, 'trace'),
)

/** L'état retenu au tour précédent, pour n'inscrire que les bascules. */
let wasCapturing = false
/**
 * Le déclencheur qui dépose ce qui attend quand la voiture s'arrête.
 *
 * Sans lui, la dernière tranche d'un trajet n'est jamais déposée : personne
 * n'arrête l'application, la voiture s'éteint toute seule une fois qu'on s'en
 * éloigne, et le navigateur disparaît avec elle sans prévenir.
 */
const standstill = new StandstillFlush()
let captureBusy = false

/**
 * Les échantillons reçus depuis le dernier tour, en attente d'être inscrits.
 *
 * Ils ne sont pas écrits à la réception mais au tour de boucle suivant : à la
 * réception, la chaîne n'a pas encore tourné, et la sortie qu'on inscrirait
 * serait celle de l'échantillon précédent. Une ligne de capture doit porter une
 * entrée et la sortie **qu'elle a produite**.
 *
 * **Une file, et non un seul.** Le navigateur ralentit la boucle dès que la page
 * n'est plus au premier plan — ce qui arrive en roulant, écran éteint —, et le
 * GPS, lui, continue de livrer. Un seul emplacement perdait alors les positions
 * silencieusement, ce qui est le défaut exact que ce lot corrige.
 */
let pendingSamples: SpeedSample[] = []

/**
 * Ce qui décrit la session, réécrit en tête de chaque tranche.
 *
 * Le profil **assemblé**, et non les identifiants seuls : c'est lui qui permet
 * de rejouer le trajet tel qu'il a sonné, sur un appareil qui ne connaît ni ce
 * moteur ni cette boîte. Les noms l'accompagnent pour que la tranche se lise
 * sans le déchiffrer.
 */
function captureHeader(): CaptureHeader {
  return {
    session: sessionId,
    startedAt: journalStartedAt,
    app: __APP_VERSION__,
    profile: { id: storedProfile.value.id, name: storedProfile.value.name },
    engine: activeEngine.value
      ? { id: activeEngine.value.id, name: activeEngine.value.name }
      : null,
    gearbox: activeGearbox.value
      ? { id: activeGearbox.value.id, name: activeGearbox.value.name }
      : null,
    driveMode: driveMode.value,
    runtime: runtimeProfile.value,
  }
}

/**
 * Inscrit l'échantillon en attente, avec la sortie qu'il vient de produire.
 *
 * Une ligne par échantillon de la source, et non par tour de boucle : la
 * cadence du fichier est alors celle du GPS, ce qui est la seule qui décrive
 * vraiment ce que la voiture a livré.
 */
function observeCapture(nowMs: number, out: CaptureOutput, stopped: boolean): void {
  const allowed = capturing.value
  if (allowed !== wasCapturing) {
    wasCapturing = allowed
    capture.note(nowMs, 'capture', { running: allowed })
    if (!allowed) {
      pendingSamples = []
      // Ce qui reste part maintenant : une capture qui s'arrête n'a plus de
      // tour de boucle pour atteindre ses cinq minutes, et la fin d'un trajet
      // est souvent ce qu'on cherche à revoir.
      depositCaptureIfDue(nowMs, true)
    }
  }
  // Un arrêt qui dure est le dernier moment où l'on est encore là pour
  // envoyer. Quinze secondes suffisent à se garer, pas à un feu rouge.
  //
  // Sur l'horloge murale, et non sur le temps de session : le pas de la boucle
  // est plafonné à un quart de seconde, si bien qu'une page en arrière-plan —
  // écran éteint, ce qui est le cas normal en roulant — voit son temps de
  // session avancer quatre fois moins vite que le monde. Quinze secondes de
  // session y feraient une minute de stationnement, et la voiture serait
  // éteinte avant.
  if (allowed && standstill.tick(Date.now(), stopped)) depositCaptureIfDue(nowMs, true)

  if (!allowed || pendingSamples.length === 0) return

  const reçus = pendingSamples
  pendingSamples = []
  for (const sample of reçus) {
    capture.add({
      at: nowMs,
      src: sample.at,
      kmh: sample.kmh,
      acc: sample.accuracyM,
      der: sample.derived,
      out: out.kmh,
      ms2: out.accelMs2,
      rpm: out.rpm,
      gear: out.gear,
      load: out.load,
    })
  }
  captureCount.value += reçus.length
}

/** Ce que la chaîne a produit à l'instant d'un échantillon. */
interface CaptureOutput {
  kmh: number
  accelMs2: number
  rpm: number
  gear: number
  load: number
}

/**
 * L'état de la session, résumé pour le témoin de l'écran de conduite.
 *
 * Il répond à une seule question : ce qui est en train d'être vécu sera-t-il
 * récupérable au retour ? Le détail vit dans `core/capture/health.ts`, où il se
 * vérifie sans écran.
 */
export const captureStatus = computed(() =>
  captureHealth({
    capturing: capturing.value,
    failure: captureFailure.value,
    gpsActive: sourceStatus.value === 'active',
    rejecting: rejectionCause.value !== null,
  }),
)

/**
 * Dépose une tranche de capture si l'heure est venue.
 *
 * Le même patron que le journal, et pour la même raison : sans l'attendre, un
 * dépôt à la fois, et la tranche revient en attente si elle n'a pas pu partir.
 */
function depositCaptureIfDue(nowMs: number, force = false): void {
  if (captureBusy || !sendsAutomatically(uploadConsent.value, 'trace')) return
  if (!force && !capture.shouldSlice(nowMs)) return

  const slice = capture.takeSlice(nowMs)
  if (!slice) return

  captureBusy = true
  void depositCaptureSlice(slice)
    .then((outcome) => {
      if (outcome.ok) {
        captureError.value = ''
        captureFailure.value = ''
        captureDeposits.value = [
          ...captureDeposits.value,
          { name: outcome.name, bytes: outcome.bytes },
        ]
        return
      }
      captureError.value = outcome.detail
      captureFailure.value = outcome.reason
      if (outcome.retry) capture.restore(slice)
    })
    .finally(() => {
      captureBusy = false
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
  // **Rien ne part tant que cet appareil n'a pas de compte.** Un dépôt envoyé
  // avant recevrait 401, que le client ne rejoue pas — et ce qu'on essayait de
  // sauver serait perdu pour de bon. La file garde, et repart au retour du
  // réseau, en même temps que l'identité s'obtient.
  if (identity.value === null) return
  if (force) uploads.retryNow()
  if (!uploads.ready(nowMs)) return

  flushing = true
  try {
    await uploads.flush(nowMs, (item) =>
      putFile(item.folder, item.name, item.body, {
        epingle: item.epingle === true,
      }),
    )
  } finally {
    flushing = false
    rememberQueue()
    // La file vient de se vider un peu : on la remplit un peu plus. C'est ce qui
    // fait avancer la remontée initiale sans jamais la faire déborder.
    poursuivreLaRemontee()
  }
}

// --- Ce que le navigateur portait rejoint la base -------------------------

/**
 * Combien de reprises on laisse attendre en même temps.
 *
 * La file garde au plus vingt-quatre dépôts et quatre mégaoctets : y verser
 * d'un coup toutes les traces d'un stockage plein en ferait tomber la moitié,
 * et ce qui tombe est justement ce qu'on essayait de sauver. Trois à la fois
 * laisse la place aux dépôts du trajet en cours, qui, eux, ne peuvent pas
 * attendre le démarrage suivant.
 */
const REPRISES_EN_VOL = 3

/**
 * Fait remonter ce qui dort dans le stockage local, par petites poignées.
 *
 * Appelée au démarrage et après chaque envoi : la file se vide, on la remplit
 * un peu plus. Ce qui reste est gardé, donc une remontée interrompue — le
 * navigateur qu'on ferme, le réseau qui tombe — reprend où elle en était.
 *
 * **Rien n'est effacé du stockage local.** Ce lot déplace une copie ; ce qui
 * décide de ce que la voiture relit vient après, et l'effacement des anciennes
 * sources plus tard encore.
 */
function poursuivreLaRemontee(): void {
  if (uploadConsent.value === 'none') return

  let restant = loadReprise()
  if (restant === null) {
    restant = planDeReprise({
      profiles: profiles.value,
      engines: customEngines(engines.value),
      gearboxes: customGearboxes(gearboxes.value),
      traces: traces.value,
    })
    saveReprise(restant)
  }

  if (!resteAFaire(restant, uploadConsent.value)) return

  const partants = prochains(restant, uploadConsent.value, REPRISES_EN_VOL - uploads.list().length)
  const partis: ARemonter[] = []

  for (const entree of partants) {
    const depot = depotDeReprise(entree)
    // Une entrée dont la source a disparu depuis — un profil effacé entre deux
    // démarrages — sort de la liste sans bruit : la garder ferait boucler la
    // reprise sur quelque chose qui n'existe plus.
    //
    // **La poignée entière est posée avant le premier envoi.** Déclencher un
    // envoi à chaque dépôt ne servait à rien : le premier part aussitôt, prend
    // le verrou, et les suivants attendaient le prochain passage de la boucle —
    // c'est-à-dire, à l'arrêt, indéfiniment.
    if (depot !== null) enqueue(depot, false)
    partis.push(entree)
  }

  if (partis.length === 0) return
  saveReprise(sansCeuxLa(restant, partis))
  void flushUploads(Date.now(), true)
}

/** Le dépôt qui correspond à une entrée du plan, ou rien si la source a disparu. */
function depotDeReprise(entree: ARemonter): QueuedUpload | null {
  const maintenant = Date.now()

  if (entree.sorte === 'profile') {
    const profil = profiles.value.find((candidat) => candidat.id === entree.id)
    if (!profil) return null
    return {
      id: profileUploadId(profil),
      kind: 'profile',
      folder: PROFILE_FOLDER,
      name: profileFileName(profil),
      body: profileBody(profil),
      queuedAt: maintenant,
    }
  }

  if (entree.sorte === 'engine') {
    const moteur = engines.value.find((candidat) => candidat.id === entree.id)
    if (!moteur) return null
    return {
      id: entityUploadId(ENGINE_FOLDER, moteur),
      kind: 'profile',
      folder: ENGINE_FOLDER,
      name: entityFileName(moteur),
      body: engineBody(moteur),
      queuedAt: maintenant,
    }
  }

  if (entree.sorte === 'gearbox') {
    const boite = gearboxes.value.find((candidat) => candidat.id === entree.id)
    if (!boite) return null
    return {
      id: entityUploadId(GEARBOX_FOLDER, boite),
      kind: 'profile',
      folder: GEARBOX_FOLDER,
      name: entityFileName(boite),
      body: gearboxBody(boite),
      queuedAt: maintenant,
    }
  }

  const trace = traces.value.find((candidat) => String(candidat.startedAt) === entree.id)
  if (!trace) return null
  return {
    id: `trace:${trace.startedAt}`,
    kind: 'trace',
    folder: TRACE_FOLDER,
    name: depositName(trace),
    body: traceBody(trace),
    queuedAt: maintenant,
    // Épinglée : une trace enregistrée il y a des mois et remontée aujourd'hui
    // serait effacée un mois plus tard par la règle de rétention, c'est-à-dire
    // déplacée pour être perdue.
    epingle: true,
  }
}

// --- Au lancement, la base rend ce qu'elle a de plus récent ---------------

/**
 * Vrai pendant qu'on applique ce que la base rend.
 *
 * Sans cela, appliquer un profil rapatrié déclencherait la surveillance qui le
 * renvoie aussitôt — on redéposerait ce qu'on vient de recevoir, ce qui avance
 * la date du serveur et fait tout reprendre au démarrage suivant.
 */
let pendantLeRapatriement = false

/**
 * Prend ce que la base a de plus récent, une fois, au lancement.
 *
 * Rien n'attend ce travail : l'application démarre sur sa copie locale, et ce
 * qui arrive de la base arrive après. Hors réseau, il ne se passe simplement
 * rien — et une base vide ne fait rien perdre, puisqu'on ajoute et on remplace,
 * jamais on n'efface.
 */
export async function rapatrierAuLancement(): Promise<void> {
  if (uploadConsent.value === 'none') return
  await rapatrier()
}

/**
 * Le travail lui-même, sans le garde du consentement.
 *
 * Relier un appareil l'appelle directement, et c'est voulu : le consentement dit
 * ce qui **part** de la voiture — la position, les trajets, le journal. Ce qui
 * redescend du compte qu'on vient de rejoindre n'est rien d'autre que ses
 * propres réglages, et les redemander serait demander deux fois le même accord.
 */
async function rapatrier(): Promise<void> {
  const vu = loadDejaVu()
  const enAttente = uploads.list().map((item) => cle(item.folder, item.name))
  let change = false

  for (const dossier of [PROFILE_FOLDER, ENGINE_FOLDER, GEARBOX_FOLDER]) {
    const entrees = await listerDistant(dossier)
    for (const { name, quand } of aRapatrier(dossier, entrees, vu, enAttente)) {
      const texte = await lireDistant(dossier, name)
      if (texte === null) continue
      if (!appliquerLeRapatrie(dossier, texte)) continue
      vu[cle(dossier, name)] = quand
      change = true
    }
  }

  if (change) saveDejaVu(vu)
}

/**
 * Range ce qui vient d'arriver, et dit si ça a pris.
 *
 * Un fichier illisible n'est pas retenu comme vu : il redescendra au prochain
 * lancement, ce qui laisse une chance à un dépôt réparé entre-temps.
 */
function appliquerLeRapatrie(dossier: string, texte: string): boolean {
  pendantLeRapatriement = true
  try {
    if (dossier === PROFILE_FOLDER) {
      // L'identifiant d'origine est gardé : ce profil est le nôtre, qui
      // redescend. Un identifiant neuf en ferait un double à chaque démarrage,
      // et son prochain dépôt un second fichier sur le serveur.
      const profil = fromFile(texte, (origine) => origine ?? newId())
      const connu = profiles.value.some((candidat) => candidat.id === profil.id)
      profiles.value = connu
        ? profiles.value.map((candidat) => (candidat.id === profil.id ? profil : candidat))
        : [...profiles.value, profil]
      return true
    }

    if (dossier === ENGINE_FOLDER) {
      // L'identifiant d'origine est gardé : ce moteur est le nôtre, qui
      // redescend. Lui en donner un neuf en ferait un double à chaque démarrage.
      engines.value = upsertEngine(engines.value, engineFromFile(texte, (origine) => origine))
      return true
    }

    gearboxes.value = upsertGearbox(gearboxes.value, gearboxFromFile(texte, (origine) => origine))
    return true
  } catch {
    return false
  } finally {
    pendantLeRapatriement = false
  }
}

/** Relance demandée à la main, quand on ne veut pas attendre. */
export function retryUploads(): void {
  void flushUploads(Date.now(), true)
}

function enqueue(item: QueuedUpload, envoyer = true): void {
  uploads.add(item)
  rememberQueue()
  if (envoyer) void flushUploads(Date.now())
}

// Le retour du réseau est le moment exact où ce qui attend peut partir :
// l'attendre coûte moins qu'un essai toutes les trente secondes dans un tunnel.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => void flushUploads(Date.now(), true))
}

// --- L'identité de cet appareil --------------------------------------------
//
// Elle est lue en local **sans rien attendre**, puis demandée au serveur en
// arrière-plan si l'appareil n'en a pas encore. C'est l'exigence qui commande
// tout le lot COMPTES : l'application part de ce qu'elle a, fait du son, et se
// présente au serveur quand elle peut. Une voiture qui attendrait une réponse
// avant d'afficher ses cadrans serait inutilisable là où elle roule.

/** Qui est cet appareil, pour autant qu'il le sache sans réseau. */
export const identity = ref<LocalIdentity | null>(loadIdentity())

/** Ce qu'a donné la dernière tentative, pour que l'écran puisse le dire. */
export const identityState = ref<IdentityOutcome['state'] | 'inconnue'>('inconnue')

function prendreIdentite(rendu: IdentityOutcome | undefined): void {
  if (rendu === undefined) return
  identityState.value = rendu.state
  if (rendu.state !== 'sans-reseau' && rendu.state !== 'refusee') identity.value = rendu.identity
}

/**
 * Ce que la liaison a donné, quand cet appareil est arrivé par un code scanné.
 *
 * Les faits seulement : l'écran en fait une phrase. `ancien` dit ce qu'est
 * devenu le compte que cet appareil portait avant — effacé s'il était vide,
 * gardé sinon, et c'est ce dernier cas qu'il faut annoncer.
 */
export const liaison = ref<
  | { etat: 'reliee'; ancien: SortDeLAncien }
  /** Un compte tenu ailleurs vient d'être rattaché à celui d'ici. */
  | { etat: 'rattachee-ailleurs' }
  | { etat: 'refusee'; detail: string }
  | { etat: 'sans-reseau' }
  | null
>(null)

/**
 * Le code éventuellement scanné, lu **avant tout le reste**.
 *
 * La lecture efface le fragment au passage : il ouvre un compte, et il n'a rien
 * à faire dans la barre d'adresse d'une page qu'on laisse ouverte.
 */
const lienScanne = typeof window === 'undefined' ? null : lireLienDansUrl()

/**
 * Ce que dit l'adresse au retour d'un compte tenu ailleurs, s'il y a eu départ.
 *
 * Lu ici, avec le code scanné, et pour la même raison : la lecture nettoie
 * l'adresse, et elle doit avoir lieu une fois, au chargement, avant que quoi que
 * ce soit d'autre y touche.
 */
const retourDuTiers = typeof window === 'undefined' ? null : lireLeRetourDuTiers()

/**
 * Le compte que cet appareil portait avant de partir chez le fournisseur.
 *
 * Repris **et oublié** dès maintenant : il ne vaut que pour ce chargement-ci, et
 * le laisser traîner le ferait rejouer au rechargement suivant.
 */
const compteAvantLeTiers = retourDuTiers === null ? null : reprendreLAncien()

/**
 * Rejoint le compte que le code désigne.
 *
 * Le serveur décide du sort du compte que cet appareil portait ; ici on range
 * la nouvelle identité, on oublie ce qu'on croyait avoir déjà vu — ce registre
 * parlait de l'autre compte —, et on redescend ce que le nouveau porte.
 *
 * **Les deux chemins passent par ici** : le code scanné, lu dans l'adresse au
 * démarrage, et le code recopié à la main dans l'écran de configuration. Ce qui
 * se passe ensuite doit être le même, y compris ce que la bannière annonce.
 */
export async function rejoindreUnCompte(code: CodeDeLiaison): Promise<void> {
  const faite = await relierCetAppareil(code)
  if (faite.state === 'sans-reseau') {
    liaison.value = { etat: 'sans-reseau' }
    return
  }
  if (faite.state === 'refusee') {
    liaison.value = { etat: 'refusee', detail: faite.detail }
    return
  }

  identity.value = faite.identity
  identityState.value = 'gardee'
  saveDejaVu({})
  // Le compte a changé : ce qu'on avait retenu de ses rôles parlait de l'autre.
  oublierLesRoles()
  liaison.value = { etat: 'reliee', ancien: faite.ancien }
  await Promise.all([rapatrier(), releverLesRolesDuCompte()])
}

/**
 * Donne une adresse et un mot de passe au compte de cet appareil.
 *
 * Le compte ne change pas : il n'y a donc **rien à rapatrier**, et c'est ce qui
 * distingue ce geste de la connexion. Seul son état change — il cesse d'être
 * anonyme —, et l'écran doit le voir tout de suite.
 */
export async function rattacherSonAdresse(
  email: string,
  motDePasse: string,
): Promise<Rattachement> {
  const rendu = await rattacherUneAdresse(email, motDePasse)
  if (rendu.state !== 'rattachee') return rendu

  const courant = identity.value
  if (courant !== null) {
    const desormais = { ...courant, anonymous: false, email: rendu.email }
    identity.value = desormais
    saveIdentity(desormais)
  }
  return rendu
}

/**
 * Ouvre ici un compte qui existe ailleurs.
 *
 * Le compte change, donc tout ce que l'autre porte redescend — comme après un
 * code de liaison, et pour la même raison : le registre de ce qu'on a déjà vu
 * parlait du compte d'avant.
 */
export async function seConnecterAUnCompte(
  email: string,
  motDePasse: string,
): Promise<Connexion> {
  const rendu = await seConnecter(email, motDePasse)
  if (rendu.state !== 'connectee') return rendu

  identity.value = rendu.identity
  identityState.value = 'gardee'
  saveDejaVu({})
  oublierLesRoles()
  liaison.value = { etat: 'reliee', ancien: rendu.ancien }
  await Promise.all([rapatrier(), releverLesRolesDuCompte()])
  return rendu
}

/**
 * Ajoute un compte tenu ailleurs à celui de cet appareil.
 *
 * Rien ne se met à jour ici : la page part chez le fournisseur et reviendra
 * neuve. Ce qui revient est traité au chargement suivant, plus bas.
 */
export async function rattacherUnCompteTenuAilleurs(fournisseur: string): Promise<Depart> {
  return rattacherUnTiers(fournisseur)
}

/** Ouvre ici le compte que ce fournisseur désigne. Même remarque : la page part. */
export async function seConnecterAvecUnCompteTenuAilleurs(fournisseur: string): Promise<Depart> {
  return seConnecterAvecUnTiers(fournisseur)
}

/**
 * Ce qu'il reste à faire au retour d'un compte tenu ailleurs.
 *
 * **Le compte a déjà changé** quand on arrive ici : c'est le serveur qui l'a
 * fait, pendant l'aller-retour, et `ensureIdentity` vient de le redescendre.
 * Restent trois choses que lui seul ne pouvait pas faire — dire au serveur quel
 * compte cet appareil abandonne, oublier ce qu'on croyait savoir de l'autre, et
 * redescendre ce que le nouveau porte.
 */
async function acheverLeRetourDuTiers(): Promise<void> {
  if (retourDuTiers === 'refuse') {
    liaison.value = {
      etat: 'refusee',
      detail:
        'Ce compte n’a pas ouvert de session ici. Un compte tenu ailleurs doit d’abord être rattaché depuis cet écran, en étant connecté.',
    }
    return
  }
  if (retourDuTiers === null) return

  if (retourDuTiers === 'rattache') {
    // Le compte n'a pas changé : il a seulement une preuve de plus, et il a
    // cessé d'être anonyme — ce que le serveur vient de dire tout seul, puisque
    // `ensureIdentity` a redescendu l'identité juste avant. Rien à corriger ici
    // donc, seulement à l'annoncer : sans cela, on part chez le fournisseur, on
    // revient, et rien ne dit que ça a marché.
    liaison.value = { etat: 'rattachee-ailleurs' }
    return
  }

  // Le compte a changé pendant l'aller-retour. Ce qu'on croyait savoir de
  // l'autre ne vaut plus rien, et ce que celui-ci porte n'est pas encore là.
  const desormais = identity.value?.id
  const ancien =
    compteAvantLeTiers === null || compteAvantLeTiers === desormais
      ? 'aucun'
      : await reglerLAncienCompte(compteAvantLeTiers)

  saveDejaVu({})
  oublierLesRoles()
  liaison.value = { etat: 'reliee', ancien }
  await Promise.all([rapatrier(), releverLesRolesDuCompte()])
}

/**
 * Supprime le compte de cet appareil, et tout ce qu'il porte sur le serveur.
 *
 * **Ce qui est en local reste en local.** Les profils, les moteurs et les
 * réglages de ce navigateur ne sont pas effacés : ils appartiennent à
 * l'appareil, et la remise à zéro des réglages est un autre bouton. Ce qui part
 * est ce que le serveur gardait, et le compte qui le désignait.
 */
export async function supprimerLeCompte(motDePasse = ''): Promise<Suppression> {
  const rendu = await supprimerSonCompte(motDePasse)
  if (rendu.state !== 'supprime') return rendu

  identity.value = null
  identityState.value = 'inconnue'
  liaison.value = null
  // Le registre de ce qu'on a déjà vu parlait d'un compte qui n'existe plus.
  saveDejaVu({})
  oublierLesRoles()
  return rendu
}

// --- Ce que ce compte ouvre -------------------------------------------------
//
// **Les rôles cachent, ils ne protègent pas.** Un navigateur affiche ce qu'il
// veut ; ce qui refuse est le serveur. Ici, on évite seulement de proposer un
// écran qui répondrait non — et, hors réseau, on s'en tient à ce qu'on avait.

/** Ce que le serveur a accordé au dernier relevé, ou rien si on n'a jamais pu. */
const copieDesRoles = ref(typeof window === 'undefined' ? null : lireLaCopie())

/**
 * L'instant auquel les rôles sont jugés.
 *
 * Il n'avance qu'aux échéances, et c'est ce qui referme un droit **sans
 * redémarrage** : la copie ne change pas, l'heure si.
 */
const instantDesRoles = ref(Date.now())

/** Les rôles ouverts à cet instant. Tout est ouvert tant qu'on ne sait rien. */
export const roles = computed<Role[]>(() =>
  calculerLesRoles(copieDesRoles.value, instantDesRoles.value),
)

/** Ce que l'écran demande : cet onglet, ce bouton, ce panneau. */
export function ouvertPar(role: Role): boolean {
  return roles.value.includes(role)
}

let reveilDesRoles: ReturnType<typeof setTimeout> | null = null

/**
 * Se réveiller quand le prochain droit se referme, et pas avant.
 *
 * Scruter l'heure à la seconde pour un événement qui arrive une fois par an
 * serait payer cher un cas rare ; et ne pas se réveiller du tout laisserait un
 * écran ouvert jusqu'au prochain démarrage, ce que le lot interdit.
 */
function programmerLaFermeture(): void {
  if (reveilDesRoles !== null) clearTimeout(reveilDesRoles)
  reveilDesRoles = null

  const quand = prochaineEcheance(copieDesRoles.value, Date.now())
  if (quand === null) return

  // Une seconde après l'échéance, pour ne pas se réveiller juste avant. Et
  // jamais au-delà de ce qu'un minuteur sait attendre — il déborde à vingt-quatre
  // jours, et un débordement se déclenche aussitôt : on se rendort alors.
  const delai = Math.min(Math.max(quand - Date.now() + 1000, 0), 2 ** 31 - 1)
  reveilDesRoles = setTimeout(() => {
    instantDesRoles.value = Date.now()
    programmerLaFermeture()
  }, delai)
}

/**
 * Redemande au serveur ce que ce compte ouvre.
 *
 * Sans réseau, on garde ce qu'on avait : c'est la situation ordinaire, et ce
 * n'est pas une panne.
 */
async function releverLesRolesDuCompte(): Promise<void> {
  const copie = await releverLesRoles()
  if (copie === null) return
  copieDesRoles.value = copie
  instantDesRoles.value = Date.now()
  programmerLaFermeture()
}

/** Un autre compte n'a pas les mêmes rôles : ce qu'on avait retenu ne vaut plus. */
function oublierLesRoles(): void {
  oublierLaCopie()
  copieDesRoles.value = null
  instantDesRoles.value = Date.now()
  programmerLaFermeture()
}

if (typeof window !== 'undefined') {
  // Le mot de passe partagé n'ouvre plus rien : le laisser en clair dans ce
  // navigateur serait une négligence gratuite.
  oublierLeCompteDeDepot()
  // Sans `await`, et ce n'est pas une négligence : voir `startIdentity`.
  programmerLaFermeture()
  startIdentity({}, (rendu) => {
    prendreIdentite(rendu)
    // Les rôles après le compte, et jamais avant : sans compte, le serveur n'a
    // rien à en dire.
    if (rendu?.state !== 'sans-reseau' && rendu?.state !== 'refusee') {
      void releverLesRolesDuCompte()
    }
    // La liaison vient après, et non à la place : l'appareil qui scanne s'est
    // d'abord créé son compte anonyme, comme tout appareil neuf, et c'est ce
    // compte-là que le serveur efface ou garde selon ce qu'il porte.
    if (lienScanne !== null) void rejoindreUnCompte(lienScanne)
    // Le retour d'un compte tenu ailleurs, au même endroit et pour la même
    // raison : il faut que l'identité soit redescendue pour savoir sur quel
    // compte on vient d'atterrir.
    else if (retourDuTiers !== null) void acheverLeRetourDuTiers()
  })
  // Un appareil qui a démarré dans un tunnel prend son compte au retour du
  // réseau, comme la file d'envoi part au même moment.
  window.addEventListener('online', () => {
    if (identity.value === null) startIdentity({}, prendreIdentite)
    else void releverLesRolesDuCompte()
  })
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
  if (pendantLeRapatriement) return
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

/**
 * Les moteurs et les boîtes remontent comme les profils.
 *
 * Depuis que le profil désigne un moteur au lieu de porter ses valeurs, faire
 * remonter le profil seul revient à faire remonter une désignation qui ne mène
 * nulle part : l'autre appareil reçoit un profil qui parle d'un moteur qu'il n'a
 * pas.
 *
 * **Sous le même accord que les profils.** Ce sont des réglages de la même
 * nature ; en faire une catégorie de plus dans l'écran de consentement
 * demanderait à David d'accepter deux fois la même chose.
 *
 * **Seulement ce qui n'est pas livré tel quel** : envoyer les moteurs d'usine
 * inchangés remplirait le registre de copies de ce que toute installation
 * possède déjà.
 */
let entityTimer: ReturnType<typeof setTimeout> | null = null

function queueEntitiesSoon(): void {
  if (pendantLeRapatriement) return
  if (!sendsAutomatically(uploadConsent.value, 'profile')) return
  if (entityTimer !== null) clearTimeout(entityTimer)
  entityTimer = setTimeout(() => {
    entityTimer = null
    for (const engine of customEngines(engines.value)) {
      enqueue({
        id: entityUploadId(ENGINE_FOLDER, engine),
        kind: 'profile',
        folder: ENGINE_FOLDER,
        name: entityFileName(engine),
        body: engineBody(engine),
        queuedAt: Date.now(),
      })
    }
    for (const gearbox of customGearboxes(gearboxes.value)) {
      enqueue({
        id: entityUploadId(GEARBOX_FOLDER, gearbox),
        kind: 'profile',
        folder: GEARBOX_FOLDER,
        name: entityFileName(gearbox),
        body: gearboxBody(gearbox),
        queuedAt: Date.now(),
      })
    }
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
    // Retenu, pas inscrit : la chaîne n'a pas encore tourné pour cet
    // échantillon, et la sortie qu'on écrirait serait celle du précédent.
    if (capturing.value) pendingSamples.push(sample)
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
 * Régime qu'aurait le moteur si le rapport suivant était engagé maintenant.
 *
 * C'est ce que montre la seconde aiguille du compteur. David, après la sortie
 * du 11 septembre 2026 : « afficher le RPM calculé du prochain rapport si on le
 * passait maintenant ».
 *
 * Le calcul est celui que la boîte emploie pour décider, et non un second écrit
 * à côté : deux formules pour la même grandeur finiraient par diverger, et
 * l'aiguille annoncerait un régime auquel la voiture ne retomberait pas.
 *
 * Vaut `null` là où la question n'a pas de sens — moteur arrêté, boîte au point
 * mort, dernier rapport — et l'aiguille disparaît alors.
 */
export const nextGearRpm = computed<number | null>(() => {
  if (!isRunning.value) return null
  const { gearbox, speed } = telemetry.value
  if (gearbox.label === 'N') return null
  const next = gearbox.gear + 1
  if (next >= gearbox.gearCount) return null
  return rpmInGear(next, speed.kmh)
})

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
/**
 * Effort du tour précédent, pour le coup de gaz.
 *
 * Le moteur est calculé après la boîte, donc l'effort de ce tour-ci n'existe pas
 * encore quand il faut décider de la hauteur du coup de gaz. Un tour de retard,
 * soit seize millisecondes, ne se voit pas ici — et c'est plus simple que de
 * couper le calcul en deux.
 */
let lastEffort = 0

/**
 * Hauteur du coup de gaz, selon le sens du passage et ce que fait le pied.
 *
 * **En montée, le coup de gaz suit l'effort.** David : « je crois que le rapport
 * passe automatiquement au moment du coup de gaz, même si j'ai commencé à
 * ralentir juste avant ». Un passage décidé légitimement dure six dixièmes de
 * seconde : son coup de gaz tombe donc après un lever de pied survenu
 * entre-temps, et l'on entend le moteur se relancer alors qu'on vient de
 * l'abandonner.
 *
 * **Au rétrogradage, il reste entier.** C'est là qu'il est le geste du
 * conducteur, et on rétrograde précisément pied levé ou en freinant : le lier à
 * l'effort le supprimerait exactement quand il doit s'entendre.
 */
function blipRpmFor(profile: Profile, direction: 'up' | 'down' | null): number {
  const jolt = profile.feel.shiftJolt
  if (!jolt.enabled) return 0
  if (direction === 'down') return jolt.blipRpm
  return jolt.blipRpm * Math.max(0, Math.min(1, lastEffort))
}

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
    shiftBlipRpm: blipRpmFor(profile, gearboxState.shiftDirection),
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
      playEvent('backfire', (t) => playBackfire(t, backfire.intensity, backfire.count))
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
    playEvent('clack', (t) => playClack(t, clackAmplitude(profile, descend)))
    clackDone = true
  }
  if (wasShifting && !gearboxState.isShifting) {
    if (sonore && jolt.crackle > 0) playEvent('backfire', (t) => playBackfire(t, jolt.crackle, 1))
  }
  if (!gearboxState.isShifting) clackDone = false
  wasShifting = gearboxState.isShifting
  lastEffort = engineState.effort

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
  // La coupure de couple d'un passage vaut pour les deux origines de son.
  //
  // Elle vivait dans `computeMix`, qui n'est appelé que pour la banque
  // d'échantillons : un profil en synthèse gardait donc son effort entier
  // pendant tout le passage, et le moteur simulé continuait de tirer comme si
  // rien ne se passait. Même règle, même forme, appliquée ici à ce qu'on
  // transmet au synthé.
  const shift = { isShifting: gearboxState.isShifting, progress: gearboxState.shiftProgress }

  if (synth.isRunning) {
    audio.mute()
    synth.setMuted(isMuted.value || synthSilent.value)
    synth.setTarget(engineState.audibleRpm, engineState.effort * shiftCut(profile, shift))
  } else if (isMuted.value) audio.mute()
  else {
    audio.update(profile, engineState, shift)
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
    lastAccuracyM.value = stats.lastAccuracyM
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
  observeCapture(
    journalElapsedMs,
    {
      kmh: speed.kmh,
      accelMs2: speed.accelMs2,
      rpm: engineState.rpm,
      gear: gearboxState.gear + 1,
      load: engineState.load,
    },
    speed.atStandstill,
  )
  depositJournalIfDue(journalElapsedMs)
  depositCaptureIfDue(journalElapsedMs)
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

  const issue = await putFile('/mesures/', nom, fichier)
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

/** Avancement du rapatriement, pour que l'attente ne ressemble pas à un blocage. */
export const archiveProgress = ref('')

/**
 * Rapatrie en un seul fichier tout ce que le serveur porte.
 *
 * Le navigateur de la voiture ne télécharge rien : ce qu'elle produit —
 * journal, traces, relevés — s'accumule sur le serveur sans qu'on puisse le
 * reprendre autrement qu'en ouvrant le gestionnaire de fichiers du NAS. Depuis
 * un téléphone, ce bouton suffit.
 *
 * Le paquet part **incomplet plutôt que pas du tout** quand un dossier
 * manque, et le message dit lesquels : un essai à moitié rapatrié reste
 * exploitable, mais il ne doit pas se faire passer pour complet.
 */
export async function exportServerData(): Promise<string> {
  archiveProgress.value = 'Listage…'
  const { entries, failures, bytes } = await collectArchive(
    fetch,
    (done, total) => {
      archiveProgress.value = `${done}/${total}`
    },
  )
  archiveProgress.value = ''

  if (entries.length === 0) {
    if (failures.length > 0) return `Rien récupéré — ${failures.join(', ')}`
    return 'Le serveur ne porte aucun fichier.'
  }

  const nom = archiveName()
  const fichier = new Blob([buildZip(entries)], { type: 'application/zip' })
  const mo = (bytes / 1_048_576).toFixed(1)
  if (!telecharger(fichier, nom)) {
    return "Ce navigateur refuse le téléchargement : à faire depuis un téléphone ou un ordinateur."
  }
  const manques =
    failures.length > 0 ? ` — ${failures.length} non repris : ${failures.join(', ')}` : ''
  return `${entries.length} fichiers, ${mo} Mo${manques}`
}

/**
 * Met l'application en route — c'est la position « D » du sélecteur.
 *
 * Elle rend le son en même temps que la mesure, parce que le geste qui l'a
 * appelée est celui que les navigateurs exigent pour ouvrir un contexte audio.
 * Le faire ailleurs demanderait un second appui pour la seule raison que le
 * code est écrit en deux morceaux.
 *
 * La cadence passe par `syncDriver` et non par `loop.start()`, qui installerait
 * la boucle d'affichage **en plus** de l'horloge du fil audio quand celle-ci
 * tourne déjà : le pas de temps serait alors compté deux fois, et tout ce qui
 * s'intègre dessus — compteurs de la boîte, durée d'un passage, lissage de la
 * charge — avancerait deux fois trop vite. L'ordre était sûr tant que le
 * démarrage avait lieu au chargement de la page, donc avant tout son ; il ne
 * l'est plus depuis que c'est un bouton qui l'appelle.
 */
export function start(): void {
  // L'attente d'une première mesure s'ouvre ici : c'est ce qui permet au chien
  // de garde de relancer un suivi qui n'a jamais rien reçu.
  conditioner.reset()
  fixWatchdog.reset()
  fixRestarts.value = 0
  rejectionWatch.reset()
  rejectionCause.value = null
  currentSource().start()
  isRunning.value = true
  syncDriver()
  void activateAudio()
}

/**
 * Met l'application au repos — c'est la position « P » du sélecteur.
 *
 * Tout s'arrête : la géolocalisation, la boucle, le son des deux origines, et
 * la capture dépose ce qu'elle avait en attente plutôt que de le perdre.
 * L'affichage, lui, reste allumé : c'est par lui qu'on redémarre, et un écran
 * noir ne dirait plus comment.
 *
 * Arrêter le son est ce qui manquait : seule la synthèse se taisait, et le son
 * enregistré continuait de tourner sur le dernier régime reçu.
 */
export function stop(): void {
  currentSource().stop()
  isRunning.value = false
  // Les **deux** cadences s'arrêtent. Couper la seule boucle d'affichage ne
  // suffit pas : dès que la banque joue, c'est l'horloge du fil audio qui bat
  // la mesure, et elle continuait de poster à soixante hertz après « P ». Le
  // silence demandé ci-dessous était alors défait au tour suivant, seize
  // millisecondes plus tard — le ralenti s'entendait toujours, la boîte
  // tournait, le journal s'incrémentait, pendant que l'écran affichait « P ».
  loop.stop()
  audio.onClockTick = null
  audio.mute()
  void synth.stop()
  // Le repos remet le tempérament à « route ». Décision de David, le
  // 11 septembre 2026 : la touche de marche affiche « D » au parking, jamais
  // « S ». Elle le garderait que l'écran mentirait — on lirait D et on
  // repartirait en sport.
  //
  // Sans toucher à la préférence enregistrée : la persistance sert à retrouver
  // au lancement ce que le profil demande, et l'écraser à chaque arrêt la
  // viderait de son sens dès le deuxième trajet.
  setDriveModeWithoutSaving('road')
  // Ce qui a été enregistré jusqu'ici part maintenant : la voiture s'éteint
  // souvent dans la minute qui suit, et une tranche gardée serait perdue.
  depositCaptureIfDue(journalElapsedMs, true)
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

// Corriger l'appareil en « voiture » alors qu'on roulait au simulateur
// laisserait une source que l'écran ne propose plus, et qui ne vient pas du GPS.
// On rend la main au GPS plutôt que de garder une vitesse inventée.
watch(simulatorAvailable, (possible) => {
  if (!possible && sourceKind.value === 'simulator') setSource('geolocation')
})

export function setSource(kind: SourceKind): void {
  if (kind === 'simulator' && !simulatorAvailable.value) return
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

/**
 * Le mode de conduite : le tempérament de la boîte.
 *
 * Une préférence d'appareil, au même titre que la commande automatique ou
 * manuelle — c'est un choix de conduite, et il se fait sur la touche de marche, entre les cadrans. Les
 * seuils de montée s'en déduisent, avec le rupteur du moteur.
 *
 * **Au premier lancement, il se déduit du profil actif** : ses seuils portaient
 * jusqu'ici le tempérament, et imposer « route » ferait conduire un profil Sport
 * comme un profil Route sans que rien ne le dise.
 */
/**
 * Ce qui empêche un changement de tempérament d'être retenu.
 *
 * Le repos remet « route » pour que la touche de marche affiche « D », mais ce
 * n'est pas un choix du conducteur : l'enregistrer effacerait, dès le deuxième
 * trajet, le tempérament que le profil demande.
 */
let persistDriveMode = true

function setDriveModeWithoutSaving(mode: DriveMode): void {
  if (driveMode.value === mode) return
  persistDriveMode = false
  driveMode.value = mode
}

const driveMode = ref<DriveMode>(
  loadDriveMode() ??
    driveModeFromUpshiftRpm(
      activeProfile.value.drivetrain.upshiftRpm,
      activeProfile.value.engine.redlineRpm,
    ),
)

export const currentDriveMode = computed(() => driveMode.value)

/**
 * Un changement de configuration en cours de route s'inscrit, daté.
 *
 * Sans cela, la fin d'une session serait relue avec la configuration du début :
 * l'en-tête décrit l'instant où la tranche part, pas chaque instant qu'elle
 * couvre. Le journal reçoit le même fait — son genre `profile` était déclaré
 * depuis le premier jour sans que rien ne l'émette, et c'est ce qui empêchait
 * de savoir quel moteur jouait pendant un essai.
 */
watch(
  () => [storedProfile.value.id, activeEngine.value?.id, activeGearbox.value?.id, driveMode.value],
  ([profileId, engineId, gearboxId, mode]) => {
    const data = {
      profile: profileId ?? null,
      engine: engineId ?? null,
      gearbox: gearboxId ?? null,
      driveMode: mode ?? null,
    }
    // Le cran « rien n'est envoyé » ne tient pas de journal du tout : écrire
    // ici contournerait le collecteur, qui est le seul à connaître l'accord.
    if (uploadConsent.value !== 'none') journal.add(journalElapsedMs, 'profile', data)
    if (capturing.value) capture.note(journalElapsedMs, 'profile', data)
  },
)

watch(
  driveMode,
  (mode) => {
    if (persistDriveMode) saveDriveMode(mode)
    persistDriveMode = true
    gearbox.setDriveMode(mode)
    // Le rapport est réévalué tout de suite : changer de tempérament en roulant
    // doit s'entendre, et non attendre le prochain passage.
    gearbox.settleFor((gear) => rpmInGear(gear, telemetry.value.speed.kmh))
  },
  { immediate: true },
)

export function setDriveMode(mode: DriveMode): void {
  driveMode.value = mode
}

/**
 * Relance la géolocalisation **en roulant**, à la main, depuis un geste.
 *
 * Ce n'est pas le seul moyen de la relancer : passer par « P » puis « D » le
 * fait déjà, et c'est le propos du sélecteur. Mais « P » arrête tout — le son se
 * coupe, la capture dépose sa tranche et la session se scinde en deux. Ce bouton
 * fait la seule chose qui manquait : **redemander une position sans rien
 * interrompre d'autre**.
 *
 * Il se calque sur le chien de garde, pas sur le démarrage. La distinction est
 * ce qui l'empêche de nuire :
 *
 * - **le conditionnement n'est pas remis à zéro.** Il l'est au démarrage, où la
 *   voiture est à l'arrêt et où il n'y a rien à perdre. Ici la voiture roule :
 *   l'effacer ferait tomber la vitesse lissée et le régime à zéro jusqu'à la
 *   position suivante — la boîte rétrograderait et le son retomberait au
 *   ralenti, pour un bouton censé réparer.
 * - **le compte de relances n'est pas remis à zéro.** C'est un témoin, affiché
 *   en télémétrie et inscrit au journal du trajet : l'effacer détruirait la
 *   preuve qu'on est venu chercher.
 *
 * Ce qui repart, en revanche, ce sont les comptes de la source — ce qu'elle
 * reçoit et ce qu'elle en tire. Sans cela on lirait ensemble deux suivis, et la
 * seule question que ce bouton pose, « celui-ci reçoit-il quelque chose ? »,
 * n'aurait pas de réponse lisible.
 *
 * Le geste compte autant que l'appel. Un navigateur n'ouvre la position qu'après
 * un appui, et c'est précisément l'hypothèse que ce bouton permet d'éprouver
 * une seconde fois : s'il débloque, c'était le geste.
 */
export function restartGeolocation(): void {
  if (!isRunning.value) return
  geolocation.stop()
  geolocation.resetStats()
  fixWatchdog.reset()
  rejectionWatch.reset()
  rejectionCause.value = null
  geolocation.start()
}

export function setShiftMode(mode: ShiftMode): void {
  gearbox.setMode(mode)
  shiftMode.value = mode
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
  // Par `setShiftMode` et non par la boîte directement : l'écran lit le mode
  // dans un état à part — la télémétrie ne vit que tant que la boucle tourne —
  // et une bascule faite à la manette le laisserait afficher « AUTO » pendant
  // que la boîte est en manuelle.
  if (intent.toggleMode) setShiftMode(gearbox.getMode() === 'manual' ? 'auto' : 'manual')
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

/**
 * Ajoute un profil, d'où qu'il vienne, et lui donne ses groupes.
 *
 * Le passage obligé de tout ce qui entre : un fichier, un lien, la
 * bibliothèque, le guide de création, une copie. Un profil reçu désigne le
 * moteur de celui qui l'a envoyé, introuvable ici ; il arrive en revanche avec
 * ses valeurs, donc on lui rend un moteur d'ici — le même s'il existe déjà.
 * Sans ce passage il jouerait bien, mais plus rien ne pourrait le régler.
 */
export function addProfile(profile: Profile): void {
  const scinde = splitProfiles([profile], engines.value, gearboxes.value, newId)
  profiles.value = [...profiles.value, ...scinde.profiles]
  engines.value = scinde.engines
  gearboxes.value = scinde.gearboxes
  selectedId.value = profile.id
}

export function restoreFactoryProfiles(): number {
  const missing = missingFactoryProfiles(profiles.value)
  if (missing.length > 0) profiles.value = [...profiles.value, ...missing]
  return missing.length
}

/** Ramène une section du profil actif — ou le profil entier — à son état d'usine. */
export function resetActive(section: ProfileSection | 'all'): void {
  editAssembled((profile) => resetProfileSection(profile, section))
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
  editAssembled((profile) => {
    const resized = resizeGearTables(profile, ratios.length)
    return { ...resized, drivetrain: { ...resized.drivetrain, gearRatios: ratios } }
  })
}

// --- Moteurs enregistrés -------------------------------------------------

/**
 * Les moteurs disponibles : ceux qui sont livrés, et ceux qu'on enregistre.
 *
 * Un moteur est une entité entière — réglages, banque, couches, mixage — et non
 * un paquet de valeurs recopiées dans un profil. C'est ce qui permet de le
 * corriger une fois pour tous les profils qui le désignent, et de l'envoyer seul
 * sans faire suivre un profil entier.
 */
watch(
  engines,
  (list) => {
    saveEngines(list)
    queueEntitiesSoon()
  },
  { deep: true },
)
watch(
  gearboxes,
  (list) => {
    saveGearboxes(list)
    queueEntitiesSoon()
  },
  { deep: true },
)
watch(realCar, (car) => saveRealCar(car), { deep: true })

export const engineList = computed(() => engines.value)

/**
 * La voiture réelle de cet appareil, et sa mise à jour.
 *
 * Un seul point d'écriture : les réglages de mesure ne se recopient plus dans un
 * profil, ils décrivent la voiture — et un profil reçu de quelqu'un d'autre ne
 * les touche pas.
 */
export const currentRealCar = computed<RealCar>(() => realCar.value)

export function setRealCar(car: RealCar): void {
  realCar.value = car
}

/**
 * Range dans les groupes un profil qu'on vient de modifier en bloc.
 *
 * L'inverse de l'assemblage, et le seul chemin d'écriture pour tout ce qui
 * change plusieurs sections d'un coup : un curseur global, une remise aux
 * valeurs d'usine, une valeur d'étalonnage. Chaque section repart là où elle
 * vit, et le profil enregistré ne reçoit que son identité.
 *
 * Ce qui n'est pas désigné n'est pas rangé : un profil sans moteur garderait ses
 * valeurs. La reprise au chargement fait qu'il n'en existe plus.
 */
function dissolve(next: Profile): void {
  const moteur = activeEngine.value
  if (moteur) {
    const corrige: EngineEntity = {
      ...engineFromProfile(next, moteur.name),
      id: moteur.id,
    }
    if (moteur.source !== undefined) corrige.source = moteur.source
    engines.value = upsertEngine(engines.value, corrige)
  }

  const boite = activeGearbox.value
  if (boite) {
    const corrigee: GearboxEntity = {
      ...gearboxFromProfile(next, boite.name),
      id: boite.id,
    }
    if (boite.source !== undefined) corrigee.source = boite.source
    gearboxes.value = upsertGearbox(gearboxes.value, corrigee)
  }

  realCar.value = realCarFromProfile(next)
}

/** Modifie le profil assemblé, et range le résultat dans les groupes. */
function editAssembled(change: (profile: Profile) => Profile): void {
  dissolve(change(activeProfile.value))
}

/** Pose la banque du moteur actif : elle lui appartient, pas au profil. */
export function setSampleDir(name: string): void {
  editEngine((moteur) => ({ ...moteur, sampleDir: name }))
}

/**
 * Pose l'origine du son du profil actif.
 *
 * Elle reste sur le profil : ce n'est pas un réglage qu'on tâtonne, c'est la
 * déclaration de ce qui produit le son.
 */
export function setSoundSource(value: SoundSource): void {
  const index = profiles.value.findIndex((p) => p.id === selectedId.value)
  const current = profiles.value[index]
  if (!current) return
  const next = [...profiles.value]
  next[index] = { ...current, soundSource: value }
  profiles.value = next
}

/** Modifie le moteur du profil actif. Le seul chemin pour y écrire. */
function editEngine(change: (engine: EngineEntity) => EngineEntity): void {
  const moteur = activeEngine.value
  if (!moteur) return
  engines.value = upsertEngine(engines.value, change(moteur))
}

/** Combien de profils désignent ce moteur. */
export function engineUsage(id: string): number {
  return profilesUsing(profiles.value, id).length
}

/**
 * Désigne un moteur pour le profil actif.
 *
 * Une référence et non une recopie : le profil ne porte plus de valeurs, il dit
 * lequel il joue. Corriger ce moteur s'entend donc aussitôt dans tous les
 * profils qui le désignent, sans rien avoir à répercuter.
 */
export function chooseEngine(id: string): void {
  if (!engines.value.some((connu) => connu.id === id)) return
  const index = profiles.value.findIndex((p) => p.id === selectedId.value)
  const current = profiles.value[index]
  if (!current) return
  const next = [...profiles.value]
  next[index] = { ...current, engineId: id }
  profiles.value = next
}

/**
 * Enregistre le moteur du profil actif sous un nom, comme un moteur neuf.
 *
 * Le profil désigne aussitôt ce qu'il vient de donner : sans cela il faudrait le
 * choisir dans la liste juste après l'avoir créé depuis lui, ce qui n'aurait
 * aucun sens.
 */
export function saveActiveAsEngine(name: string): string {
  const propose = name.trim()
  const moteur: EngineEntity = {
    ...engineFromProfile(activeProfile.value, propose || activeProfile.value.name),
    id: newId(),
  }
  engines.value = upsertEngine(engines.value, moteur)
  chooseEngine(moteur.id)
  return `Moteur « ${moteur.name} » enregistré.`
}

/**
 * Retire un moteur enregistré.
 *
 * Les profils qui le désignaient gardent leurs valeurs : ils ne deviennent pas
 * muets, ils cessent seulement d'être rattachés.
 */
export function forgetEngine(id: string): void {
  engines.value = removeEngine(engines.value, id)
}

/** Propose un moteur au téléchargement, seul. */
export function exportEngine(id: string): string {
  const moteur = engines.value.find((connu) => connu.id === id)
  if (!moteur) return 'Moteur introuvable.'
  const nom = `moteur-${slug(moteur.name)}.json`
  const fichier = new Blob([engineToFile(moteur)], { type: 'application/json' })
  if (!telecharger(fichier, nom)) {
    return "Ce navigateur refuse le téléchargement : à faire depuis un ordinateur."
  }
  return `« ${moteur.name} » exporté.`
}

/** Reprend un moteur exporté, sous un identifiant neuf. */
export function importEngine(text: string): string {
  try {
    const moteur = engineFromFile(text, newId)
    engines.value = upsertEngine(engines.value, moteur)
    return `Moteur « ${moteur.name} » ajouté.`
  } catch (error) {
    return error instanceof Error ? error.message : 'Import impossible.'
  }
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
  const current = activeProfile.value
  if (globalUndo.value?.id !== current.id) {
    globalUndo.value = { id: current.id, origin: captureOrigin(current) }
  }
  dissolve(change(current))
}

export function undoGlobalChange(): void {
  const snapshot = globalUndo.value
  if (!snapshot || snapshot.id !== selectedId.value) return
  dissolve(applyOrigin(activeProfile.value, snapshot.origin))
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
  editAssembled((profile) => writeSetting(profile, path, value))
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

// --- Les deux derniers gestes du chargement -------------------------------
//
// Placés en fin de module, et non près de la file : ils lisent les profils, les
// moteurs, les boîtes et les traces, qui n'existent qu'une fois tout ce fichier
// évalué. Les appeler plus haut les ferait travailler sur des listes vides, ce
// qui ne se verrait pas — la reprise se déclarerait simplement terminée.
//
// La remontée d'abord, le rapatriement ensuite : ce qui n'est pas encore parti
// d'ici est plus récent que tout ce que la base peut rendre, et le rapatriement
// le sait — il laisse de côté ce qui attend dans la file.
poursuivreLaRemontee()
void rapatrierAuLancement()
