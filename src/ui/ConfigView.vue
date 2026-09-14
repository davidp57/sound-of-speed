<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import NumberField from './components/NumberField.vue'
import { ProfileImportError, fromFile, toFile } from '../core/preset/store'
import type { ProfileSection } from '../core/preset/store'
import { isComfortable, isReachableOrigin, shareUrl } from '../core/preset/share'
import qrcode from 'qrcode-generator'
import {
  buildProfile,
  describeProfile,
  type EngineKind,
  type Temperament,
  type Usage,
} from '../core/preset/wizard'
import { SIMPLE_GEAR_COUNTS } from '../core/preset/character'
import { missingSentence } from '../core/calibration/coverage'
import {
  SOUND_SOURCES,
  needsSimulatedEngine,
  soundSourceOf,
  type SoundSource,
} from '../core/preset/schema'
import {
  ENGINE_LIBRARY,
  ORIGIN_MAX_GAPS,
  closestLibraryEngine,
} from '../core/preset/engine-library'
import {
  DEFAULT_RENDERING,
  MUFFLER_INSIDE_HZ,
  MUFFLER_OUTSIDE_HZ,
  type SynthRendering,
} from '../core/synth/settings'
import {
  editedProfile,
  setSampleDir,
  setSoundSource,
  addProfile,
  applyLibraryEngine,
  applySynthSettings,
  synthSettings,
  backgroundAudio,
  setBackgroundAudio,
  offlineStatus,
  prepareOffline,
  promptInstall,
  deleteProfile,
  duplicateActive,
  profileList,
  renameActive,
  resetActive,
  restoreFactoryProfiles,
  canUndoGlobalChange,
  gearCount,
  responsiveness,
  selectProfile,
  selectedProfileId,
  setGearCount,
  setResponsiveness,
  setSportiness,
  sportiness,
  toggleFavorite,
  undoGlobalChange,
  library,
  libraryLoading,
  refreshLibrary,
  banks,
  refreshBanks,
  missingBankFiles,
  forgetUnusedBanks,
  calibrationOverrides,
  calibrationMissing,
  uploadConsent,
  uploadError,
  uploadPending,
  uploadStorageError,
  journalDeposits,
  journalError,
  retryUploads,
  setUploadConsent,
  synthSupported,
  archiveProgress,
  exportServerData,
  engineList,
  activeEngine,
  engineUsage,
  chooseEngine,
  saveActiveAsEngine,
  forgetEngine,
  exportEngine,
  importEngine,
  answerMeasuredCar,
  carDecision,
  driveFace,
  measuredCar,
  measuredOverrides,
  setDriveFace,
  simulatorAvailable,
  sourceKind,
  setSource,
  type SourceKind,
} from '../state'

/**
 * Les sources de vitesse qu'on peut choisir, et pourquoi il n'y en a qu'une en
 * voiture.
 *
 * David : « en voiture on est toujours en GPS, pas besoin des boutons simu ou
 * rejeu ». Le simulateur et le rejeu sont des outils d'atelier ; ni l'un ni
 * l'autre n'a de sens au volant, où ils ne seraient qu'un moyen de se tromper
 * sur ce qu'on entend. La rangée entière disparaît quand il ne reste que le
 * GPS : un seul bouton qu'on ne peut pas désactiver n'est pas un choix.
 */
const SOURCES = computed<{ id: SourceKind; label: string }[]>(() =>
  simulatorAvailable.value
    ? [
        { id: 'simulator', label: 'Simulateur' },
        { id: 'geolocation', label: 'GPS' },
        { id: 'replay', label: 'Rejeu' },
      ]
    : [{ id: 'geolocation', label: 'GPS' }],
)

/**
 * Écran de configuration.
 *
 * Toute modification est appliquée immédiatement, pendant que la boucle tourne :
 * il n'y a pas de bouton « valider ». Les profils sont enregistrés au fil de
 * l'eau dans le stockage du navigateur, et exportables en JSON pour être
 * transportés d'un appareil à l'autre.
 */

/**
 * Ce qu'on règle : le profil assemblé, sections vivantes.
 *
 * Chaque curseur écrit dans le groupe où le réglage vit — le moteur, la boîte ou
 * la voiture — et non plus dans le profil, qui ne porte plus de valeurs. Les
 * chemins n'ont pas changé pour autant : `profile.engine.idleRpm` désigne
 * toujours le ralenti, il atterrit simplement dans le moteur.
 */
const profile = editedProfile
const importError = ref('')

/**
 * Le clac, coupé et rendu d'un appui.
 *
 * Il n'a pas d'interrupteur dans le profil — c'est une intensité, et zéro le
 * fait taire. Couper garde donc la valeur d'avant pour la rendre telle quelle :
 * un conducteur qui coupe le clac en ville ne doit pas retrouver un réglage
 * d'usine en le rallumant. Rechargée sans valeur retenue, la bascule repart de
 * celle des profils livrés.
 */
const CLAC_PAR_DEFAUT = 0.35
const dernierClac = ref(0)

const clacActif = computed(() => profile.value.feel.shiftJolt.clack > 0)

function basculerLeClac(): void {
  const jolt = profile.value.feel.shiftJolt
  if (jolt.clack > 0) {
    dernierClac.value = jolt.clack
    jolt.clack = 0
    return
  }
  jolt.clack = dernierClac.value > 0 ? dernierClac.value : CLAC_PAR_DEFAUT
}

/**
 * Origine du son, avec son libellé.
 *
 * La lecture passe par `soundSourceOf` : un profil reçu par lien depuis une
 * version antérieure n'a pas le champ, et l'affichage ne doit pas rester vide.
 */
const SOUND_SOURCE_LABELS: Record<SoundSource, string> = {
  recorded: 'Enregistré',
  live: 'Généré en direct',
  prerendered: 'Généré à l’avance',
}

const soundSource = computed<SoundSource>({
  get: () => soundSourceOf(profile.value),
  set: (value) => {
    setSoundSource(value)
  },
})

/**
 * Les trois choix du moteur simulé, en conduisant.
 *
 * David : « la page de réglage des moteurs c'est pour nous, sur PC ; rien à
 * faire dans l'app en voiture. En voiture on peut choisir un profil de synthèse,
 * avec le choix du moteur, le choix de l'échappement et de l'endroit d'où on
 * écoute. On ajoutera des curseurs si besoin plus tard. »
 *
 * D'où des listes et pas des curseurs : on choisit, on ne règle pas. Chaque
 * liste garde une entrée « réglé à la main », qui n'apparaît que si la valeur du
 * profil ne tombe sur aucun palier — un réglage fin fait au banc ne doit pas se
 * faire écraser par le simple fait d'ouvrir cet écran.
 */
const EXHAUSTS = [
  { id: 'direct', label: 'Direct', mix: 0 },
  { id: 'measured', label: 'Mesuré', mix: 0.45 },
  { id: 'wrapped', label: 'Enveloppé', mix: 1 },
] as const

const rendering = computed(() => profile.value.rendering ?? DEFAULT_RENDERING)

/**
 * D'où vient le moteur du profil, et s'il a été retouché depuis.
 *
 * Un moteur chargé puis affiné au banc ne correspond plus exactement à son
 * entrée de bibliothèque. Dire « Chevrolet 454, retouché » vaut mieux que
 * « réglé à la main » : en conduisant, savoir d'où l'on est parti est la seule
 * chose utile.
 */
const closestEngine = computed(() => {
  const mine = profile.value.engineDefinition
  if (mine === undefined) return null
  return closestLibraryEngine(mine, profile.value.engine.redlineRpm)
})

const currentEngineId = computed(() =>
  closestEngine.value !== null && closestEngine.value.gaps === 0
    ? closestEngine.value.engine.id
    : '',
)

/** Ce qu'affiche l'entrée « aucun moteur reconnu » de la liste. */
const engineDrift = computed(() => {
  const near = closestEngine.value
  // Au-delà du seuil, plus rien ne dit d'où l'on est parti : mieux vaut ne rien
  // affirmer que désigner un départ au hasard.
  if (near === null || near.gaps > ORIGIN_MAX_GAPS) return 'Réglé à la main'
  const s = near.gaps > 1 ? 's' : ''
  return `${near.engine.short}, retouché — ${near.gaps} valeur${s}`
})

const currentExhaust = computed(
  () => EXHAUSTS.find((entry) => entry.mix === rendering.value.convolverMix)?.id ?? '',
)

const currentPlace = computed(() => {
  if (rendering.value.mufflerHz >= MUFFLER_OUTSIDE_HZ) return 'outside'
  if (rendering.value.mufflerHz === MUFFLER_INSIDE_HZ) return 'inside'
  return ''
})

function onEngine(event: Event): void {
  const id = (event.target as HTMLSelectElement).value
  const entry = ENGINE_LIBRARY.find((candidate) => candidate.id === id)
  if (entry !== undefined) void applyLibraryEngine(entry)
}

/** Écrit un réglage de rendu dans le profil, et le fait entendre. */
function setRendering(patch: Partial<SynthRendering>): void {
  void applySynthSettings({ ...synthSettings.value, ...patch })
}

function onExhaust(event: Event): void {
  const id = (event.target as HTMLSelectElement).value
  const entry = EXHAUSTS.find((candidate) => candidate.id === id)
  if (entry !== undefined) setRendering({ convolverMix: entry.mix })
}

function onPlace(event: Event): void {
  const id = (event.target as HTMLSelectElement).value
  if (id === 'inside') setRendering({ mufflerHz: MUFFLER_INSIDE_HZ })
  else if (id === 'outside') setRendering({ mufflerHz: MUFFLER_OUTSIDE_HZ })
}

// Les banques se lisent à l'ouverture de l'écran : c'est le seul endroit d'où
// l'on en change, et une banque déposée entre-temps apparaît en y revenant.
onMounted(() => void refreshBanks())

/** La banque du profil, si le serveur l'a listée — sinon rien à sélectionner. */
const knownBank = computed(() =>
  banks.value.some((bank) => bank.name === profile.value.sampleDir) ? profile.value.sampleDir : '',
)

function onBank(event: Event): void {
  const name = (event.target as HTMLSelectElement).value
  // La ligne « réglée à la main » n'est pas un choix : elle dit seulement que la
  // valeur tapée ne correspond à aucune banque listée.
  // La banque appartient au moteur : elle ne se pose donc pas sur le profil.
  if (name !== '') setSampleDir(name)
}

/** Le compte de dépôt se retient dès la frappe : il n'y a rien à valider. */
/**
 * Cran en attente de confirmation.
 *
 * Couper la remontée est immédiat — on n'a pas à confirmer qu'on ne veut plus
 * rien envoyer. C'est l'inverse qui demande un temps d'arrêt : le reste de cet
 * écran s'applique à la frappe, et un envoi de données ne doit pas partir du
 * même geste distrait qu'un curseur qu'on déplace.
 */
const consentPending = ref<'minimal' | 'extended' | null>(null)

function onConsent(consent: 'none' | 'minimal' | 'extended'): void {
  if (consent === 'none') {
    consentPending.value = null
    setUploadConsent('none')
    return
  }
  if (uploadConsent.value === consent) return
  consentPending.value = consent
}

function onConsentConfirm(): void {
  if (consentPending.value === null) return
  setUploadConsent(consentPending.value)
  consentPending.value = null
}

/** Ce qui attend de partir, rangé par nature pour être dit en une phrase. */
const enAttente = computed(() => {
  const noms: Record<string, string> = {
    trace: 'trace',
    profile: 'profil',
    journal: 'journal',
    measurement: 'relevé',
  }
  const compte = new Map<string, number>()
  for (const item of uploadPending.value) {
    compte.set(item.kind, (compte.get(item.kind) ?? 0) + 1)
  }
  return [...compte.entries()].map(([kind, n]) => {
    const nom = noms[kind] ?? kind
    return `${n} ${nom}${n > 1 ? 's' : ''}`
  })
})

const fileInput = ref<HTMLInputElement | null>(null)


/**
 * Curseurs globaux du mode simplifié.
 *
 * Exprimés de zéro à cent plutôt que de zéro à un : ce sont des positions, pas
 * des grandeurs, et un pour-cent est le plus petit pas qui se voie encore.
 */
const sportinessPercent = computed<number>({
  get: () => Math.round(sportiness.value * 100),
  set: (value: number) => setSportiness(value / 100),
})

const responsivenessPercent = computed<number>({
  get: () => Math.round(responsiveness.value * 100),
  set: (value: number) => setResponsiveness(value / 100),
})

/** Ce que donne le profil courant, dans les mêmes termes que la création. */
const simplePreview = computed(() => describeProfile(profile.value))

/**
 * Création guidée.
 *
 * Quatre choix décrits en langage de conducteur, dont on déduit la trentaine de
 * réglages qui ne s'accordent pas indépendamment. L'aperçu se recalcule à chaque
 * changement : on juge avant de créer.
 */
const wizardOpen = ref(false)
const wizard = ref<{
  name: string
  temperament: Temperament
  usage: Usage
  gearCount: number
  engine: EngineKind
}>({ name: '', temperament: 'equilibre', usage: 'route', gearCount: 6, engine: 'essence' })

const TEMPERAMENTS: { id: Temperament; label: string; note: string }[] = [
  { id: 'calme', label: 'Calme', note: 'Monte tôt, tourne bas, reste discret.' },
  { id: 'equilibre', label: 'Équilibré', note: 'Le compromis ordinaire.' },
  { id: 'sportif', label: 'Vif', note: 'Étire les rapports, monte dans les tours.' },
]
const USAGES: { id: Usage; label: string; note: string }[] = [
  { id: 'ville', label: 'Ville', note: 'Rapports serrés, tout se joue sous 70 km/h.' },
  { id: 'route', label: 'Route', note: 'Départementales et voies rapides.' },
  { id: 'autoroute', label: 'Autoroute', note: 'Dernier rapport très long.' },
]
const ENGINE_KINDS: { id: EngineKind; label: string; note: string }[] = [
  { id: 'diesel', label: 'Diesel', note: 'Rupteur bas, vers 4600 tr/min.' },
  { id: 'essence', label: 'Essence', note: 'Vers 6600 tr/min.' },
  { id: 'sportif', label: 'Haut régime', note: 'Au-delà de 8600 tr/min.' },
]

const wizardPreview = computed(() => describeProfile(buildProfile(wizard.value, profile.value)))

function createFromWizard(): void {
  addProfile(buildProfile(wizard.value, profile.value))
  wizardOpen.value = false
  wizard.value = { ...wizard.value, name: '' }
}

/**
 * Partage du profil courant.
 *
 * Le lien contient le profil lui-même, compressé : rien à héberger, rien à
 * inscrire. Le code à scanner évite d'avoir à recopier une adresse d'un écran à
 * l'autre — le geste naturel entre un poste de travail et un téléphone.
 */
const shareLink = ref('')
const shareQr = ref('')
const shareNote = ref('')

async function onShare(): Promise<void> {
  if (shareLink.value) {
    shareLink.value = ''
    shareQr.value = ''
    return
  }
  const url = await shareUrl(profile.value, window.location.origin)
  shareLink.value = url
  if (!isReachableOrigin(window.location.origin)) {
    shareNote.value =
      "Ce lien porte l'adresse à laquelle vous consultez l'application, qui n'est joignable que d'ici. Pour un lien utilisable ailleurs, refaire l'opération depuis l'adresse publique du serveur."
  } else if (!isComfortable(url)) {
    shareNote.value =
      "Ce profil donne un lien très long : le code peut être difficile à lire. L'export en fichier est plus sûr."
  } else {
    shareNote.value = ''
  }

  // Correction moyenne : assez robuste pour un écran, sans gonfler le code.
  const code = qrcode(0, 'M')
  code.addData(url)
  code.make()
  shareQr.value = code.createSvgTag({ cellSize: 4, margin: 2, scalable: true })
}

async function onCopyLink(): Promise<void> {
  try {
    await navigator.clipboard.writeText(shareLink.value)
    shareNote.value = 'Lien copié.'
  } catch {
    shareNote.value = 'Copie refusée par le navigateur : sélectionner le lien à la main.'
  }
}

const restoreNote = ref('')

/**
 * Réinitialisation par section.
 *
 * En deux temps : un premier clic demande confirmation, un second agit. Écraser
 * des réglages cherchés à l'oreille mérite une seconde d'hésitation, et un
 * dialogue système serait plus lourd que le geste lui-même.
 */
const RESET_SECTIONS: { id: ProfileSection | 'all'; label: string }[] = [
  { id: 'all', label: 'tout le profil' },
  { id: 'engine', label: 'le moteur' },
  { id: 'drivetrain', label: 'la transmission' },
  { id: 'speed', label: 'le signal de vitesse' },
  { id: 'mix', label: 'le mixage' },
  { id: 'feel', label: 'le caractère' },
  { id: 'layers', label: 'les couches et la banque' },
]

const resetSection = ref<ProfileSection | 'all'>('drivetrain')
const resetPending = ref(false)

function onReset(): void {
  if (!resetPending.value) {
    resetPending.value = true
    return
  }
  resetActive(resetSection.value)
  resetPending.value = false
  const label = RESET_SECTIONS.find((s) => s.id === resetSection.value)?.label ?? ''
  restoreNote.value = `Réinitialisé : ${label}.`
}

function onRestore(): void {
  const added = restoreFactoryProfiles()
  restoreNote.value =
    added > 0
      ? `${added} profil${added > 1 ? 's' : ''} rétabli${added > 1 ? 's' : ''}.`
      : 'Tous les profils d’usine sont déjà présents.'
}

function onExport(): void {
  const blob = new Blob([toFile(profile.value)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${slug(profile.value.name)}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

async function onImport(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  importError.value = ''
  try {
    addProfile(fromFile(await file.text()))
  } catch (error) {
    importError.value =
      error instanceof ProfileImportError ? error.message : 'Import impossible.'
  } finally {
    if (fileInput.value) fileInput.value.value = ''
  }
}

function slug(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'profil'
  )
}

/**
 * Une valeur d'étalonnage, avec son unité. Un tableau se lit d'une traite :
 * les seuils de passage n'ont de sens que les uns par rapport aux autres.
 */
function showOverride(
  value: number | number[],
  entry: { unit: string; decimals: number },
): string {
  const one = (v: number): string => v.toFixed(entry.decimals)
  const body = Array.isArray(value) ? value.map(one).join(' / ') : one(value)
  return `${body} ${entry.unit}`
}

/** Taille lisible, pour l'état du cache hors réseau. */
function megabytes(bytes: number): string {
  return `${(bytes / 1048576).toFixed(1)} Mo`
}

/**
 * Les moteurs enregistrés.
 *
 * Le message dit ce qui vient de se passer et s'efface : enregistrer un moteur
 * ou reporter des écarts dedans sont des gestes dont on veut la confirmation, et
 * dont on ne veut pas la trace permanente.
 */
const engineFileInput = ref<HTMLInputElement | null>(null)
const newEngineName = ref('')
const engineNote = ref('')
function direMoteur(message: string): void {
  engineNote.value = message
  setTimeout(() => {
    engineNote.value = ''
  }, 10_000)
}
function onSaveEngine(): void {
  direMoteur(saveActiveAsEngine(newEngineName.value))
  newEngineName.value = ''
}
function onExportEngine(): void {
  if (activeEngine.value) direMoteur(exportEngine(activeEngine.value.id))
}
async function onImportEngine(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  direMoteur(importEngine(await file.text()))
}

/**
 * Rapatriement des données du serveur.
 *
 * Le message reste affiché quelques secondes puis s'efface : il porte le compte
 * de fichiers et ce qui a manqué, ce qui n'a d'intérêt qu'au moment où le
 * téléchargement part.
 */
const archiveBusy = ref(false)
const archiveMessage = ref('')
async function rapatrier(): Promise<void> {
  archiveBusy.value = true
  archiveMessage.value = ''
  try {
    archiveMessage.value = await exportServerData()
  } catch (error) {
    archiveMessage.value = error instanceof Error ? error.message : 'Rapatriement impossible.'
  } finally {
    archiveBusy.value = false
  }
  setTimeout(() => {
    archiveMessage.value = ''
  }, 12_000)
}
</script>

<template>
  <div class="config">
    <section class="panel wide simple">
      <h2>Réglage</h2>

      <!--
        Ce qui se règle une fois et ne se touche plus en roulant. Ces deux
        rangées vivaient sur l'écran de conduite, où elles prenaient la place de
        ce qu'on lit au volant — et où le choix de la source n'était qu'un moyen
        de se tromper sur ce qu'on entend.
      -->
      <!--
        Le rattrapage d'un « plus tard » : la mesure attend, et ce bouton
        l'applique. Pas un export — on n'emporte pas de fichier, on applique ce
        qui est là.
      -->
      <template v-if="measuredCar !== null">
        <p class="choice-label">Profil mesuré de la voiture</p>
        <div class="choices">
          <button
            v-if="carDecision?.answer !== 'accepted'"
            :disabled="!measuredCar.coverage.complete"
            @click="answerMeasuredCar('accepted')"
          >
            Appliquer maintenant
          </button>
          <button v-else @click="answerMeasuredCar('later')">Ne plus l’appliquer</button>
        </div>
        <p class="note">
          {{ measuredCar.aggregate.tripCount }}
          {{ measuredCar.aggregate.tripCount === 1 ? 'trajet mesuré' : 'trajets mesurés' }}
          par le serveur.
          <template v-if="measuredCar.coverage.complete">
            De quoi régler la reprise, le freinage et les passages de rapport,
            sans toucher au son du profil choisi.
          </template>
          <template v-else>{{ missingSentence(measuredCar.coverage) }}</template>
        </p>
      </template>

      <p class="choice-label">Affichage de la conduite</p>
      <div class="choices">
        <button :aria-pressed="driveFace === 'dials'" @click="setDriveFace('dials')">
          Cadrans
        </button>
        <button :aria-pressed="driveFace === 'numbers'" @click="setDriveFace('numbers')">
          Chiffres
        </button>
      </div>
      <p class="note">
        Les cadrans se lisent mieux en roulant ; les chiffres servent au réglage,
        où cent tours d'écart ne se voient pas sur une aiguille. C'est une
        préférence de cet appareil, comme le volume : elle ne voyage pas avec un
        profil partagé.
      </p>

      <template v-if="SOURCES.length > 1">
        <p class="choice-label">Source de vitesse</p>
        <div class="choices">
          <button
            v-for="entry in SOURCES"
            :key="entry.id"
            :aria-pressed="sourceKind === entry.id"
            @click="setSource(entry.id)"
          >
            {{ entry.label }}
          </button>
        </div>
        <p class="note">
          En voiture on est toujours au GPS. Le simulateur et le rejeu sont des
          outils d'atelier — l'un fabrique une vitesse, l'autre en rejoue une
          enregistrée — et n'existent pas dans l'image de production.
        </p>
      </template>

        <NumberField
          v-model="sportinessPercent"
          label="Calme ↔ sportif"
          :min="0"
          :max="100"
          :step="1"
          hint="Le caractère du moteur et de la boîte : inertie, régimes de passage, plancher et délai de croisière, rétrogradage, pétarade, à-coup. Vers zéro la boîte monte tôt et tourne bas ; vers cent elle étire les rapports. Ce curseur refait ces réglages, et le bouton de retour annule le geste."
        />
        <NumberField
          v-model="responsivenessPercent"
          label="Pépère ↔ nerveux"
          :min="0"
          :max="100"
          :step="1"
          hint="La réactivité du signal, et non le caractère : raideur du lissage, fenêtre d'accélération, lissage de la charge, temporisations de passage. Le premier curseur dit si la voiture pousse fort, celui-ci si elle répond vite. Vers cent elle suit au plus près et les sauts du GPS s'entendent ; vers zéro elle est lisse et en retard d'une demi-seconde."
        />

        <p class="choice-label">Nombre de rapports</p>
        <div class="choices">
          <button
            v-for="n in SIMPLE_GEAR_COUNTS"
            :key="n"
            :aria-pressed="gearCount === n"
            @click="setGearCount(n)"
          >
            {{ n }}
          </button>
        </div>
        <p class="note">
          Le premier et le dernier rapport sont conservés, avec le pont : le
          régime en dernier rapport à une vitesse donnée ne bouge pas. Seuls les
          rapports intermédiaires se redistribuent, avec les régimes de passage
          et les temporisations.
        </p>
        <div class="global-actions">
          <button :disabled="!canUndoGlobalChange" @click="undoGlobalChange()">
            Revenir aux réglages d'avant
          </button>
          <span class="note">
            Un curseur global recalcule : il écrase les réglages qu'il commande.
            Ce retour rend l'état du profil tel qu'il était avant le premier
            mouvement.
          </span>
        </div>
        <div class="preview">
          <p class="choice-label">Ce que ça donne</p>
          <p v-for="line in simplePreview" :key="line">{{ line }}</p>
        </div>
    </section>

    <!--
      Les deux effets qui restent réglables au volant.

      Ce n'est pas un compte mais une frontière : le rétrogradage forcé et les
      rapports descendus au plus changent la façon de conduire, donc ils
      appartiennent au tempérament. Ces deux-ci sont du décor sonore, qu'on veut
      couper en ville ou avec un passager sans changer de caractère.
    -->
    <section class="panel wide">
      <h2>Effets sonores</h2>
      <div class="toggle">
        <button
          :aria-pressed="profile.feel.backfire.enabled"
          @click="profile.feel.backfire.enabled = !profile.feel.backfire.enabled"
        >
          Pétarade
        </button>
        <span class="note">Claquements à l'échappement quand on lève le pied.</span>
      </div>
      <div class="toggle">
        <button :aria-pressed="clacActif" @click="basculerLeClac()">Clac de boîte</button>
        <span class="note">Le bruit sec du passage de rapport.</span>
      </div>
      <p class="note">
        Leur réglage fin — seuil, intensité, nombre de claquements — est dans
        l'écran Avancé.
      </p>
    </section>

    <section class="panel wide creation">
      <h2>Créer un profil</h2>
      <div v-if="!wizardOpen" class="creation-pitch">
        <p class="note">
          Quatre questions suffisent : le tempérament, l'usage, le moteur et le
          nombre de rapports. Les trente réglages en découlent, et vous pourrez
          tout modifier ensuite.
        </p>
        <button class="is-active big" @click="wizardOpen = true">Créer un profil…</button>
      </div>

      <div v-if="wizardOpen" class="wizard">
        <p class="note">
          Quelques choix simples, dont découle l'ensemble des réglages. Rien n'est
          figé : c'est un point de départ, que vous pourrez ajuster. Les sons du
          profil actuel sont conservés.
        </p>

        <label class="inline">
          Nom
          <input v-model="wizard.name" type="text" placeholder="Ma voiture" />
        </label>

        <p class="choice-label">Tempérament</p>
        <div class="choices">
          <button
            v-for="entry in TEMPERAMENTS"
            :key="entry.id"
            :aria-pressed="wizard.temperament === entry.id"
            :title="entry.note"
            @click="wizard.temperament = entry.id"
          >
            {{ entry.label }}
          </button>
        </div>
        <p class="note">{{ TEMPERAMENTS.find((t) => t.id === wizard.temperament)?.note }}</p>

        <p class="choice-label">Usage principal</p>
        <div class="choices">
          <button
            v-for="entry in USAGES"
            :key="entry.id"
            :aria-pressed="wizard.usage === entry.id"
            :title="entry.note"
            @click="wizard.usage = entry.id"
          >
            {{ entry.label }}
          </button>
        </div>
        <p class="note">{{ USAGES.find((u) => u.id === wizard.usage)?.note }}</p>

        <p class="choice-label">Moteur</p>
        <div class="choices">
          <button
            v-for="entry in ENGINE_KINDS"
            :key="entry.id"
            :aria-pressed="wizard.engine === entry.id"
            :title="entry.note"
            @click="wizard.engine = entry.id"
          >
            {{ entry.label }}
          </button>
        </div>
        <p class="note">{{ ENGINE_KINDS.find((e) => e.id === wizard.engine)?.note }}</p>

        <p class="choice-label">Nombre de rapports</p>
        <div class="choices">
          <button
            v-for="n in [4, 5, 6, 7, 8]"
            :key="n"
            :aria-pressed="wizard.gearCount === n"
            @click="wizard.gearCount = n"
          >
            {{ n }}
          </button>
        </div>

        <div class="preview">
          <p class="choice-label">Ce que ça donnera</p>
          <p v-for="line in wizardPreview" :key="line">{{ line }}</p>
        </div>

        <div class="choices">
          <button class="is-active" @click="createFromWizard()">Créer le profil</button>
          <button @click="wizardOpen = false">Annuler</button>
        </div>
      </div>
    </section>

    <section class="panel wide">
      <h2>Profils</h2>
      <div class="profiles">
        <select :value="selectedProfileId" @change="selectProfile(($event.target as HTMLSelectElement).value)">
          <option v-for="entry in profileList" :key="entry.id" :value="entry.id">
            {{ entry.name }}
          </option>
        </select>
        <input
          type="text"
          :value="profile.name"
          placeholder="Nom du profil"
          @change="renameActive(($event.target as HTMLInputElement).value)"
        />
        <button
          :aria-pressed="profile.favorite"
          :title="profile.favorite ? 'Retirer de l’écran de conduite' : 'Épingler sur l’écran de conduite'"
          @click="toggleFavorite(selectedProfileId)"
        >
          {{ profile.favorite ? '★ Épinglé' : '☆ Épingler' }}
        </button>
        <button @click="duplicateActive()">Dupliquer</button>
        <button :disabled="profileList.length <= 1" @click="deleteProfile(selectedProfileId)">
          Supprimer
        </button>
        <button :title="'Réintroduit les profils livrés avec l’application'" @click="onRestore()">
          Profils d'usine
        </button>
        <button :class="{ 'is-active': !!shareLink }" @click="onShare()">Partager…</button>
        <button @click="onExport()">Exporter</button>
        <button @click="fileInput?.click()">Importer</button>
        <input ref="fileInput" type="file" accept="application/json,.json" hidden @change="onImport" />
      </div>
      <p v-if="importError" class="error">{{ importError }}</p>
      <p v-else-if="restoreNote" class="note">{{ restoreNote }}</p>
      <div v-if="shareLink" class="share">
        <p class="note">
          Ce lien contient tout le profil. Ouvrez-le sur un autre appareil et il
          s'y installe, sans compte ni serveur. Les fichiers de son, eux, ne sont
          pas transmis : l'autre appareil doit déjà avoir les mêmes.
        </p>
        <div class="qr" v-html="shareQr" />
        <input :value="shareLink" readonly @focus="($event.target as HTMLInputElement).select()" />
        <div class="choices">
          <button @click="onCopyLink()">Copier le lien</button>
          <button @click="onShare()">Fermer</button>
        </div>
        <p v-if="shareNote" class="note">{{ shareNote }}</p>
      </div>

      <div class="engines">
        <span class="note">Moteur</span>
        <p class="note">
          Un moteur, c'est ses réglages, sa banque de sons, ses couches et son
          mixage, ses pétarades — tout ce qui fait qu'on le reconnaît. Il vit à
          part du profil, qui ne fait que le désigner : on peut l'envoyer seul,
          et le corriger une fois pour tous les profils qui le jouent.
        </p>
        <div class="choices">
          <select
            :value="activeEngine?.id ?? ''"
            @change="chooseEngine(($event.target as HTMLSelectElement).value)"
          >
            <option value="" disabled>Aucun moteur désigné</option>
            <option v-for="moteur in engineList" :key="moteur.id" :value="moteur.id">
              {{ moteur.name }}{{ engineUsage(moteur.id) > 1 ? ` — ${engineUsage(moteur.id)} profils` : '' }}
            </option>
          </select>
          <button :disabled="!activeEngine" @click="onExportEngine()">Exporter le moteur</button>
          <button @click="engineFileInput?.click()">Importer un moteur</button>
          <input
            ref="engineFileInput"
            type="file"
            accept="application/json,.json"
            hidden
            @change="onImportEngine"
          />
        </div>
        <p v-if="activeEngine?.source" class="note muted">{{ activeEngine.source }}</p>
        <p v-if="engineUsage(activeEngine?.id ?? '') > 1" class="note warn">
          « {{ activeEngine?.name }} » est joué par
          {{ engineUsage(activeEngine?.id ?? '') }} profils : ce qu'on règle ici
          s'entend dans tous. Pour n'en changer qu'un, enregistrez d'abord le
          moteur sous un autre nom.
        </p>
        <div class="choices">
          <input
            v-model="newEngineName"
            placeholder="Nom du moteur à enregistrer"
            @keyup.enter="onSaveEngine()"
          />
          <button @click="onSaveEngine()">Enregistrer ce moteur</button>
          <button
            v-if="activeEngine && engineUsage(activeEngine.id) === 0"
            @click="forgetEngine(activeEngine.id)"
          >
            Oublier
          </button>
        </div>
        <p v-if="engineNote" class="note">{{ engineNote }}</p>
      </div>

      <div class="library">
        <div class="choices">
          <button :disabled="libraryLoading" @click="refreshLibrary()">
            {{ libraryLoading ? 'Recherche…' : 'Profils du serveur' }}
          </button>
          <span class="note">
            Vos profils y remontent tout seuls dès que la remontée est
            acceptée, et vous pouvez aussi déposer des fichiers dans
            <code>profiles/</code> sur le NAS : ils apparaîtront sur tous vos
            appareils.
          </span>
        </div>
        <ul v-if="library.length" class="library-list">
          <li v-for="entry in library" :key="entry.file">
            <span>{{ entry.profile.name }}</span>
            <span class="muted">{{ entry.file }}</span>
            <button @click="addProfile(entry.profile)">Ajouter</button>
          </li>
        </ul>
      </div>

      <!--
        Ce que la mesure du serveur remplace, dit comme l'étalonnage le dit
        déjà. Les deux couches se composent et l'étalonnage guidé passe en
        dernier : quand on prend la peine de dérouler le protocole, c'est lui
        qui décide.
      -->
      <div v-if="measuredOverrides.length > 0" class="calibrated">
        <p class="note">
          <strong>{{ measuredOverrides.length }}</strong> réglage{{
            measuredOverrides.length > 1 ? 's' : ''
          }}
          de ce profil {{ measuredOverrides.length > 1 ? 'viennent' : 'vient' }} de ce que le
          serveur a mesuré de votre voiture, sur
          {{ measuredCar?.aggregate.tripCount }}
          {{ measuredCar?.aggregate.tripCount === 1 ? 'trajet' : 'trajets' }}. Ce que vous
          réglez ici reste inchangé.
        </p>
        <ul class="note">
          <li v-for="entry in measuredOverrides" :key="entry.path">
            {{ entry.label }} — <strong>{{ showOverride(entry.proposed, entry) }}</strong>
            au lieu de {{ showOverride(entry.current, entry) }}
          </li>
        </ul>
      </div>

      <div v-if="calibrationOverrides.length > 0" class="calibrated">
        <p class="note">
          <strong>{{ calibrationOverrides.length }}</strong> réglage{{
            calibrationOverrides.length > 1 ? 's' : ''
          }}
          de ce profil {{ calibrationOverrides.length > 1 ? 'sont' : 'est' }} remplacé{{
            calibrationOverrides.length > 1 ? 's' : ''
          }}
          par les mesures de votre voiture. Ce que vous réglez ici reste
          inchangé — c'est la valeur mesurée que le moteur emploie.
        </p>
        <ul class="note">
          <li v-for="entry in calibrationOverrides" :key="entry.path">
            {{ entry.label }} — <strong>{{ showOverride(entry.proposed, entry) }}</strong>
            au lieu de {{ showOverride(entry.current, entry) }}
          </li>
        </ul>
      </div>

      <div v-else-if="calibrationMissing.length > 0" class="calibrated">
        <p class="note">
          <strong>L'étalonnage ne s'applique pas</strong> : il manque
          {{ calibrationMissing.join(', ').toLowerCase() }}. Un étalonnage
          incomplet décrit le bout de route enregistré, pas la voiture — une
          seule étape de ville dans un bouchon a déjà plafonné la vitesse
          acceptée à 40 km/h, au-delà de laquelle plus rien ne bougeait. Les
          mesures déjà prises restent visibles dans l'écran d'étalonnage, et se
          recopient à la main.
        </p>
      </div>

      <p class="note">
        <strong>Le compte de cet appareil</strong> vit dans l'écran
        <strong>Compte</strong>, avec de quoi relier un autre appareil au même
        compte. C'est lui qui porte tout ce qui remonte d'ici.
      </p>

      <!--
        La remontée au serveur. Trois positions, et la troisième est un choix
        distinct : la position et la trace sont des données de déplacement, et
        cela se dit avant l'envoi, pas après. La confirmation est un temps
        d'arrêt volontaire — le réglage s'applique sinon à la frappe partout
        ailleurs dans cet écran.
      -->
      <div class="journal">
        <span class="note">Remontée au serveur</span>
        <button
          :class="{ 'is-active': uploadConsent === 'none' }"
          @click="onConsent('none')"
        >
          Rien n’est envoyé
        </button>
        <button
          :class="{ 'is-active': uploadConsent === 'minimal' }"
          @click="onConsent('minimal')"
        >
          Le minimum
        </button>
        <button
          :class="{ 'is-active': uploadConsent === 'extended' }"
          @click="onConsent('extended')"
        >
          Et la conduite
        </button>
      </div>

      <p v-if="consentPending" class="confirm">
        <strong>{{ consentPending === 'minimal' ? 'Le minimum' : 'Le minimum et la conduite' }}</strong>
        sera déposé sur votre serveur, tout seul.
        <span v-if="consentPending === 'minimal'">
          Ce qui part : le journal de bord — source de vitesse, vitesses,
          accélérations, régimes, rapports, relances du suivi, mesures rejetées,
          ce que le son a coûté, et les erreurs —, les relevés de mesure, et vos
          profils, qui rejoignent la bibliothèque partagée. Aucune coordonnée.
        </span>
        <span v-else>
          Ce qui part : tout ce que contient « le minimum », <strong>plus votre
          position</strong> — un point par seconde — et <strong>la capture
          complète de vos trajets</strong>, qui démarre toute seule avec le GPS
          et porte toute la conduite, à la cadence de l’appareil. C’est ce qui
          permet de rejouer un trajet au poste de travail et de comprendre un
          défaut lié à un endroit précis.
        </span>
        Les fichiers arrivent dans les dossiers <code>journal/</code>,
        <code>traces/</code>, <code>mesures/</code> et <code>profiles/</code> de
        votre serveur, et rien ne sort d’ici : l’application ne sait pas les
        effacer, c’est à vous de faire le ménage.
        <span class="confirm-actions">
          <button class="is-active" @click="onConsentConfirm()">J’accepte</button>
          <button @click="consentPending = null">Annuler</button>
        </span>
      </p>
      <p class="note">
        Sert à retrouver ailleurs ce qui naît dans la voiture, dont le navigateur
        refuse les téléchargements, et à comprendre après coup ce que
        l’application a vécu en roulant. Le dépôt emploie le compte ci-dessus.
        <span v-if="journalDeposits.length > 0">
          Journal déposé jusqu’ici : <strong>{{ journalDeposits.length }}</strong>
          fichier{{ journalDeposits.length > 1 ? 's' : '' }},
          {{ Math.round(journalDeposits.reduce((total, entry) => total + entry.bytes, 0) / 1024) }} Ko.
        </span>
      </p>
      <p v-if="enAttente.length > 0" class="note">
        En attente de dépôt : <strong>{{ enAttente.join(', ') }}</strong>.
        <button @click="retryUploads()">Réessayer</button>
      </p>
      <p v-if="uploadError" class="note warn">{{ uploadError }}</p>
      <p v-if="uploadStorageError" class="note warn">{{ uploadStorageError }}</p>
      <p v-if="journalError" class="note warn">{{ journalError }}</p>

      <p class="note">
        Le chemin du retour : tout ce que le serveur porte — journal, traces,
        relevés, profils — en un seul fichier compressé. À faire depuis un
        téléphone ou un ordinateur, le navigateur de la voiture ne téléchargeant
        rien.
        <button :disabled="archiveBusy" @click="rapatrier()">
          {{ archiveProgress || archiveMessage || 'Tout récupérer' }}
        </button>
      </p>

      <div class="reset">
        <span class="note">Réinitialiser</span>
        <select v-model="resetSection" @change="resetPending = false">
          <option v-for="entry in RESET_SECTIONS" :key="entry.id" :value="entry.id">
            {{ entry.label }}
          </option>
        </select>
        <button :class="{ 'is-active': resetPending }" @click="onReset()">
          {{ resetPending ? 'Confirmer' : 'Aux valeurs d’usine' }}
        </button>
        <button v-if="resetPending" @click="resetPending = false">Annuler</button>
      </div>

      <label class="inline">
        Origine du son
        <select v-model="soundSource">
          <option v-for="source in SOUND_SOURCES" :key="source" :value="source">
            {{ SOUND_SOURCE_LABELS[source] }}
          </option>
        </select>
      </label>
      <p class="note">
        D'où vient le son de ce profil. <strong>Enregistré</strong> joue la banque
        d'échantillons en changeant sa vitesse de lecture, ce que fait l'application
        depuis le début. <strong>Généré en direct</strong> simule le moteur pendant la
        conduite, sans le moindre échantillon. <strong>Généré à l'avance</strong> rejoue
        une banque que cette simulation a produite au bureau, une prise par plage de
        régime.
      </p>
      <p v-if="needsSimulatedEngine(soundSource) && !synthSupported" class="note warn">
        Ce navigateur ne sait pas faire tourner le moteur simulé : il lui manque
        l'`AudioWorklet` ou le WebAssembly. Le profil garde son origine, mais le son
        restera celui de la banque d'échantillons tant qu'il sera ouvert ici.
      </p>

      <template v-if="needsSimulatedEngine(soundSource)">
        <label class="inline">
          Moteur
          <select :value="currentEngineId" @change="onEngine($event)">
            <option v-if="currentEngineId === ''" value="">{{ engineDrift }}</option>
            <option v-for="entry in ENGINE_LIBRARY" :key="entry.id" :value="entry.id">
              {{ entry.label }}
            </option>
          </select>
        </label>
        <p class="note">
          Le moteur simulé, avec son rupteur et son réglage de son. Seul le GM LS
          est réglé à ce jour ; les autres sonnent avec le réglage par défaut, ce
          qui s'entend. Les régler se fait au banc, sur un ordinateur.
        </p>

        <label class="inline">
          Échappement
          <select :value="currentExhaust" @change="onExhaust($event)">
            <option v-if="currentExhaust === ''" value="">Réglé à la main</option>
            <option v-for="entry in EXHAUSTS" :key="entry.id" :value="entry.id">
              {{ entry.label }}
            </option>
          </select>
        </label>
        <p class="note">
          Combien de résonance d'échappement passe par-dessus le son direct.
          <strong>Direct</strong> ne garde que le son cru du moteur, et c'est là
          que le grain s'entend le plus ; <strong>enveloppé</strong> ne laisse
          plus que le son réverbéré, qui étale les fronts et adoucit tout.
        </p>

        <label class="inline">
          On écoute
          <select :value="currentPlace" @change="onPlace($event)">
            <option v-if="currentPlace === ''" value="">Réglé à la main</option>
            <option value="inside">De l'habitacle</option>
            <option value="outside">De l'extérieur</option>
          </select>
        </label>
        <p class="note">
          Le silencieux, refermé bas, fait entendre la voiture à travers la tôle
          et les vitres ; ouvert en grand, on l'entend de dehors.
        </p>
      </template>

      <label v-if="banks.length > 0" class="inline">
        Banque d'échantillons
        <select :value="knownBank" @change="onBank($event)">
          <option v-if="knownBank === ''" value="">Réglée à la main</option>
          <option v-for="bank in banks" :key="bank.name" :value="bank.name">
            {{ bank.name }} — {{ bank.files.length }} fichiers
          </option>
        </select>
      </label>

      <label class="inline">
        Dossier d'échantillons
        <input v-model="profile.sampleDir" type="text" />
      </label>
      <p class="note">
        Un dossier par banque, dans le dossier d'échantillons du serveur. Il n'est
        jamais versionné : y déposer un dossier suffit à ajouter une banque, sans
        toucher au code. Le nom se tape aussi à la main, pour une banque que le
        serveur ne sait pas lister.
      </p>
      <p v-if="missingBankFiles.length > 0" class="error">
        Cette banque n'a pas {{ missingBankFiles.join(', ') }}. Une banque nouvelle
        a rarement les mêmes noms de fichiers : ils se corrigent couche par couche,
        plus bas.
      </p>
    </section>

    <section class="panel wide">
      <h2>Hors réseau</h2>
      <p class="note">
        Une voiture traverse des zones sans couverture, et une application chargée
        depuis Internet n'y démarre pas. Une fois les échantillons en cache, tout
        fonctionne sans connexion — et le serveur n'a plus besoin d'être joignable
        pour rouler, seulement pour mettre à jour.
      </p>

      <div class="offline">
        <div class="offline-state">
          <span :class="{ warn: !offlineStatus.active }">
            {{ offlineStatus.active ? 'Prise en charge active' : 'Prise en charge inactive' }}
          </span>
          <span>
            {{ offlineStatus.cachedFiles }} / {{ offlineStatus.totalFiles }} échantillons en cache
            <template v-if="offlineStatus.cachedBytes > 0">
              · {{ megabytes(offlineStatus.cachedBytes) }}
            </template>
          </span>
          <span v-if="offlineStatus.installed">Lancée depuis l'écran d'accueil</span>
          <span v-else-if="!offlineStatus.online" class="warn">Hors réseau</span>
        </div>

        <div class="offline-actions">
          <button :aria-pressed="backgroundAudio" @click="setBackgroundAudio(!backgroundAudio)">
            Son en arrière-plan
          </button>
          <button
            :disabled="offlineStatus.caching || !offlineStatus.active || offlineStatus.totalFiles === 0"
            @click="prepareOffline()"
          >
            {{ offlineStatus.caching ? 'Mise en cache…' : 'Préparer hors réseau' }}
          </button>
          <button v-if="offlineStatus.installable" @click="promptInstall()">
            Installer sur l'écran d'accueil
          </button>
          <button :disabled="!offlineStatus.active" @click="forgetUnusedBanks()">
            Libérer les banques inutilisées
          </button>
        </div>
      </div>

      <p v-if="offlineStatus.freed" class="note">
        <template v-if="offlineStatus.freed.files > 0">
          {{ offlineStatus.freed.files }} fichier{{ offlineStatus.freed.files > 1 ? 's' : '' }}
          libéré{{ offlineStatus.freed.files > 1 ? 's' : '' }}
          <template v-if="offlineStatus.freed.bytes > 0">
            · {{ megabytes(offlineStatus.freed.bytes) }}
          </template>
          — ils se retéléchargeront si un profil y revient.
        </template>
        <template v-else>
          Rien à libérer : le cache ne garde que des banques utilisées.
        </template>
      </p>

      <p v-if="offlineStatus.error" class="error">{{ offlineStatus.error }}</p>
      <p v-else-if="!offlineStatus.supported" class="note">
        Ce navigateur ne prend pas en charge le fonctionnement hors réseau.
      </p>
    </section>

  </div>
</template>

<style scoped>
/*
 * La bande de défilement était déclarée ici ; elle vit maintenant dans
 * `style.css` et se pose sur tous les écrans qui défilent, en voiture et sur
 * téléphone. Cet écran ne la porte donc plus lui-même.
 */
.config {
  display: grid;
  /*
   * Le `min()` est ce qui empêche la grille de déborder en portrait : une
   * colonne d'au moins vingt rem, plus la bande, dépasse la largeur d'un
   * téléphone, et la page se décale alors horizontalement. Mesuré avant
   * correction sur un écran de 375 px : soixante-cinq pixels de débordement.
   */
  grid-template-columns: repeat(auto-fit, minmax(min(20rem, 100%), 1fr));
  gap: 1rem;
  align-items: start;
  max-width: 80rem;
  margin: 0 auto;
}

.panel {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 0.9rem 1.1rem;
}

.panel.wide {
  grid-column: 1 / -1;
}

h2 {
  margin: 0 0 0.6rem;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--muted);
  font-weight: 600;
}

.profiles {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.profiles select,
.profiles input[type='text'] {
  flex: 1 1 12rem;
  width: auto;
}

.inline {
  display: block;
  color: var(--muted);
  margin-top: 0.6rem;
}

.inline input {
  margin-top: 0.25rem;
}

.note {
  color: var(--muted);
  font-size: 0.82rem;
  margin: 0.4rem 0 0.6rem;
}

/*
 * Une note qui avertit. La classe était déjà employée dans cet écran sans être
 * définie : l'avertissement s'y lisait dans le gris de tout le reste, donc il ne
 * se lisait pas.
 */
.note.warn {
  color: var(--warn);
}

.error {
  color: var(--warn);
  margin: 0.5rem 0 0;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th {
  text-align: left;
  color: var(--muted);
  font-weight: 500;
  font-size: 0.78rem;
  padding-bottom: 0.3rem;
}

td {
  padding: 0.2rem 0.3rem 0.2rem 0;
  border-top: 1px solid var(--line);
}

td input[type='number'] {
  width: 6rem;
  text-align: right;
}

.share,
.library {
  margin-top: 0.8rem;
  padding: 0.9rem;
  background: var(--panel-alt);
  border-radius: 8px;
}

.share input {
  margin: 0.6rem 0;
  font-family: ui-monospace, monospace;
  font-size: 0.8rem;
}

.qr {
  background: #fff;
  padding: 0.6rem;
  border-radius: 6px;
  max-width: 15rem;
  margin: 0 auto;
}

.qr :deep(svg) {
  display: block;
  width: 100%;
  height: auto;
}

.library-list {
  list-style: none;
  margin: 0.7rem 0 0;
  padding: 0;
}

.library-list li {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.35rem 0;
  border-top: 1px solid var(--line);
}

.library-list li span:first-child {
  flex: 1;
}

.creation,
.simple {
  border-color: var(--line-strong);
}

.mode .note {
  flex: 1 1 16rem;
  margin: 0;
}

.global-actions {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
  padding-top: 0.6rem;
}

.global-actions .note {
  flex: 1 1 16rem;
  margin: 0;
}

.creation-pitch {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.creation-pitch .note {
  flex: 1 1 18rem;
  margin: 0;
}

.big {
  padding: 0.8rem 1.4rem;
  font-size: 1rem;
}

.wizard {
  margin-top: 0.8rem;
  padding: 0.9rem;
  background: var(--panel-alt);
  border-radius: 8px;
}

.choice-label {
  color: var(--muted);
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin: 0.9rem 0 0.35rem;
}

.choices {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.preview {
  margin-top: 1rem;
  padding: 0.7rem 0.9rem;
  background: var(--bg);
  border-radius: 6px;
}

.preview p:not(.choice-label) {
  margin: 0.2rem 0;
  color: var(--text);
  font-size: 0.9rem;
}

.journal {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

/*
 * La demande de confirmation : encadrée, pour qu'on la lise.
 *
 * Elle dit ce qui part avant que cela ne parte, et c'est le seul endroit de cet
 * écran où un réglage attend un second geste.
 */
.confirm {
  background: var(--panel);
  border: 1px solid var(--accent);
  border-radius: 8px;
  color: var(--text);
  font-size: 0.85rem;
  line-height: 1.5;
  margin: 0.5rem 0;
  padding: 0.7rem 0.9rem;
}

/*
 * Un bloc et non une colonne souple : en `flex-direction: column`, chaque bout
 * de phrase — un `span`, un `code` — prenait sa propre ligne, et le texte se
 * lisait en trois morceaux.
 */
.confirm-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.6rem;
}

.reset {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.7rem;
}

.reset .note {
  margin: 0;
}

.reset select {
  width: auto;
  flex: 0 1 14rem;
}

.toggle {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
  padding: 0.6rem 0 0.3rem;
  border-top: 1px solid var(--line);
}

.toggle .note {
  margin: 0;
  flex: 1 1 12rem;
}

.offline {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
}

.offline-state {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  color: var(--muted);
  font-size: 0.88rem;
}

.offline-state .warn {
  color: var(--warn);
}

.offline-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.facts .warn {
  color: var(--warn);
}
</style>
