<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue'

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
  deleteProfile,
  duplicateActive,
  profileList,
  renameActive,
  resetActive,
  restoreFactoryProfiles,
  selectProfile,
  selectedProfileId,
  toggleFavorite,
  banks,
  refreshBanks,
  missingBankFiles,
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
  ouvertPar,
  importEngine,
} from '../state'

/**
 * L'atelier : ce qui fabrique.
 *
 * Trois volets, et sa navigation est ici plutôt que dans la barre du haut —
 * voir le commentaire du gabarit. Les profils s'y créent, se nomment, se
 * dupliquent, s'exportent et se partagent ; le son s'y règle, mixage et couches
 * comprises ; le banc de synthèse fabrique un timbre.
 *
 * **Le rôle `atelier` l'ouvre, et la synthèse demande le sien en plus.** Ce rôle
 * existait depuis le lot COMPTES : le serveur l'exigeait pour accepter un dépôt,
 * mais aucun écran ne le demandait.
 *
 * La voiture ne le montre jamais — c'est un écran de poste de travail —, et il
 * porte quand même la garde : un appareil est déclaré par celui qui s'en sert,
 * et une déclaration se trompe.
 *
 * Toute modification est appliquée immédiatement, pendant que la boucle tourne :
 * il n'y a pas de bouton « valider ».
 */
const SynthView = defineAsyncComponent(() => import('./SynthView.vue'))

type Volet = 'profils' | 'son' | 'synthese'

/**
 * Les volets ouverts ici.
 *
 * La synthèse demande `synthese` en plus : fabriquer un timbre et régler un
 * profil ne sont pas le même métier, et un compte peut porter l'un sans l'autre.
 */
const VOLETS = computed<{ id: Volet; label: string }[]>(() => [
  { id: 'profils', label: 'Profils' },
  { id: 'son', label: 'Son' },
  ...(ouvertPar('synthese') ? [{ id: 'synthese' as const, label: 'Synthèse' }] : []),
])

const volet = ref<Volet>('profils')

// Un droit qui expire referme son volet sans redémarrage, comme un onglet.
watch(VOLETS, (ouverts) => {
  if (!ouverts.some((entree) => entree.id === volet.value)) volet.value = 'profils'
})

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

const fileInput = ref<HTMLInputElement | null>(null)


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

import type { SampleAnalysis } from '../core/audio/analyze'
import type { LayerRole } from '../core/preset/schema'
import { analyzeLayerFile } from '../state'

const ROLES: { id: LayerRole; label: string }[] = [
  { id: 'on', label: 'en charge' },
  { id: 'off', label: 'pied levé' },
  { id: 'idle', label: 'ralenti' },
  { id: 'limiter', label: 'rupteur' },
]

function addLayer(): void {
  profile.value.layers.push({
    key: `couche-${profile.value.layers.length + 1}`,
    file: '',
    role: 'on',
    anchorRpm: 4000,
    gain: 1,
    minRate: 0.5,
    maxRate: 2,
    enabled: true,
  })
}

function removeLayer(index: number): void {
  profile.value.layers.splice(index, 1)
  delete analyses.value[index]
}

/**
 * Analyse des échantillons.
 *
 * Le résultat n'est jamais appliqué d'office : l'ambiguïté d'octave est réelle
 * sur un spectre de moteur, et un chiffre imposé en silence serait parfois faux
 * sans qu'on sache pourquoi. On propose donc des candidats, et comme le son
 * tourne pendant l'édition, en essayer un se juge à l'oreille immédiatement.
 */
const analyses = ref<Record<number, SampleAnalysis | { error: string }>>({})
const analyzing = ref<number | null>(null)

/** Résultat exploitable pour cette couche, ou `null` si absent ou en échec. */
function analysisOf(index: number): SampleAnalysis | null {
  const entry = analyses.value[index]
  return entry && !('error' in entry) ? entry : null
}

/** Message d'échec pour cette couche, ou une chaîne vide. */
function errorOf(index: number): string {
  const entry = analyses.value[index]
  return entry && 'error' in entry ? entry.error : ''
}

async function analyzeLayer(index: number): Promise<void> {
  const layer = profile.value.layers[index]
  if (!layer?.file) return
  analyzing.value = index
  try {
    analyses.value = {
      ...analyses.value,
      [index]: await analyzeLayerFile(layer.file, profile.value.engine.cylinders),
    }
  } catch (error) {
    analyses.value = {
      ...analyses.value,
      [index]: { error: error instanceof Error ? error.message : 'Analyse impossible.' },
    }
  } finally {
    analyzing.value = null
  }
}

async function analyzeAll(): Promise<void> {
  for (let index = 0; index < profile.value.layers.length; index += 1) {
    await analyzeLayer(index)
  }
}

function candidateTitle(candidate: { firingHz: number; relativeScore: number }): string {
  return `${candidate.firingHz.toFixed(0)} Hz d'allumage · score ${candidate.relativeScore.toFixed(2)}`
}

/**
 * Ancrages remplacés par un candidat, pour pouvoir revenir en arrière.
 *
 * Appliquer une proposition écrase un réglage parfois trouvé à l'oreille au
 * terme de plusieurs essais. Sans retour possible, la moindre fausse manœuvre —
 * ou un nombre de cylindres erroné, qui décale toutes les propositions — coûte
 * ce travail.
 */
const previousAnchors = ref<Record<number, number>>({})

function applyCandidate(index: number, rpm: number): void {
  const layer = profile.value.layers[index]
  if (!layer || layer.anchorRpm === rpm) return
  previousAnchors.value = { ...previousAnchors.value, [index]: layer.anchorRpm }
  layer.anchorRpm = rpm
}

function undoCandidate(index: number): void {
  const previous = previousAnchors.value[index]
  const layer = profile.value.layers[index]
  if (previous === undefined || !layer) return
  layer.anchorRpm = previous
  const rest = { ...previousAnchors.value }
  delete rest[index]
  previousAnchors.value = rest
}

/**
 * Nombre de cylindres que suggère l'ancrage actuel, au vu de la raie détectée.
 *
 * Si l'ancrage en place est juste, ce nombre doit retomber sur celui du profil.
 * Un écart franc désigne l'un des deux comme faux — et c'est le seul moyen de
 * s'en apercevoir avant d'appliquer une proposition erronée.
 */
function impliedCylinders(index: number): number | null {
  const analysis = analysisOf(index)
  const layer = profile.value.layers[index]
  const best = analysis?.candidates[0]
  if (!analysis || !layer || !best || best.rpm <= 0) return null
  // La raie mesurée vaut régime ÷ 120 × cylindres ; on inverse avec l'ancrage en place.
  return Math.round((best.firingHz * 120) / layer.anchorRpm)
}
</script>

<template>
  <!--
    La navigation de l'atelier est **ici**, pas dans la barre du haut.

    Ces volets y avaient chacun leur onglet : la barre montait à neuf entrées,
    se repliait sur trois rangs dès 375 pixels, et le raccord de l'onglet actif
    au contenu — posé le 14 septembre — n'y voulait plus rien dire. L'atelier
    est l'écran où l'on passe du temps, pas celui qu'on touche en roulant : un
    niveau de navigation de plus s'y paie moins cher qu'en haut.
  -->
  <nav class="volets">
    <button
      v-for="entree in VOLETS"
      :key="entree.id"
      :aria-pressed="volet === entree.id"
      @click="volet = entree.id"
    >
      {{ entree.label }}
    </button>
  </nav>

  <SynthView v-if="volet === 'synthese'" />

  <div v-else class="config">
    <section v-if="volet === 'profils'" class="panel wide">
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

    <section v-if="volet === 'profils'" class="panel wide creation">
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

    <section v-if="volet === 'son'" class="panel">
      <h2>Mixage</h2>
      
      <NumberField
        v-model="profile.mix.loadReliefDb"
        label="Relief de charge"
        :min="0"
        :max="12"
        :step="0.5"
        unit="dB"
        hint="Autant en moins pied levé, autant en plus pied au plancher. Sans lui, accélérer ne s'entend pas : les fondus sont à puissance constante, ils changent le timbre et jamais le volume. À 4, il y a 8 dB entre lever le pied et écraser."
      />
      <NumberField
        v-model="profile.mix.rpmReliefDb"
        label="Relief du régime"
        :min="0"
        :max="12"
        :step="0.5"
        unit="dB"
        hint="Gain gagné entre le ralenti et le rupteur : c'est le rugissement qui monte avec les tours. Il s'ajoute aux 4 dB que la banque livrée donne déjà, sa prise haut régime étant enregistrée plus fort."
      />
      <NumberField
        v-model="profile.mix.idleLevelDb"
        label="Niveau au ralenti"
        :min="-24"
        :max="0"
        :step="0.5"
        unit="dB"
        hint="Au ralenti, faute de couche dédiée dans la banque, on entend la prise « pied levé » jouée deux octaves plus bas. Sans ce réglage elle sonne aussi fort que tout le reste."
      />
      <NumberField
        v-model="profile.mix.offLoadGain"
        label="Gain pied levé"
        :min="0"
        :max="6"
        :step="0.1"
        hint="Curseur de goût sur toute la famille « pied levé ». La compensation des prises plus douces vit maintenant dans le gain de chaque couche, où le déficit se mesure : laisser 1 sauf pour forcer le trait."
      />
      <NumberField
        v-model="profile.mix.loadContrast"
        label="Contraste de charge"
        :min="0"
        :max="1"
        :step="0.05"
        hint="À 1, le fondu va d'un extrême à l'autre. Plus bas, les deux familles se mélangent et l'écart s'entend moins."
      />
      <NumberField
        v-model="profile.mix.layerDetuneCents"
        label="Désaccord des couches"
        :min="0"
        :max="50"
        :step="1"
        unit="centièmes"
        hint="Écart de justesse entre les deux couches d'une même famille, en centièmes de demi-ton. Au rapport exact elles sont parfaitement justes l'une par rapport à l'autre, ce qui n'arrive sur aucun moteur : les inégalités entre cylindres et les deux lignes d'échappement produisent un battement lent. Mesuré, 12 centièmes donnent un battement à 2,4 Hz à 5100 tr/min et 1,5 Hz à 3200."
      />
      <NumberField
        v-model="profile.mix.layerRefreshS"
        label="Renouvellement de position"
        :min="0"
        :max="30"
        :step="0.5"
        unit="s"
        hint="Intervalle moyen entre deux reprises de la lecture ailleurs dans l'enregistrement. Chaque couche est une boucle de trois à cinq secondes qui, sans cela, se répète à l'identique toutes les quatre à vingt secondes selon la vitesse de lecture. L'intervalle réel est tiré à quarante pour cent près, sinon on remplacerait une périodicité par une autre. À zéro, le comportement est celui d'avant ce réglage."
      />
      <NumberField
        v-model="profile.mix.crossfadeLowRpm"
        label="Début de bascule"
        :min="500"
        :max="12000"
        :step="50"
        unit="tr/min"
        hint="Régime où la couche haute commence à entrer. Indépendant des régimes d'ancrage."
      />
      <NumberField v-model="profile.mix.crossfadeHighRpm" label="Fin de bascule" :min="500" :max="16000" :step="50" unit="tr/min"
        hint="Régime au-delà duquel seule la couche haut régime joue. L'écart avec le début de bascule fixe la douceur de la transition."
      />
      <NumberField
        v-model="profile.mix.fullLoadAccelMs2"
        label="Accélération pleine charge"
        :min="0.5"
        :max="10"
        :step="0.1"
        unit="m/s²"
        hint="Accélération au-delà de laquelle la charge est considérée maximale."
      />
      <NumberField
        v-model="profile.mix.dragRefKmh"
        label="Repère de traînée"
        :min="60"
        :max="250"
        :step="5"
        unit="km/h"
        hint="Vitesse à laquelle tenir l'allure demande la moitié de l'effort maximal. Faute de pédale, tenir une allure vaudrait sinon toujours la même chose, à 30 comme à 130 km/h. Bas, tout devient chargé tôt ; haut, la traînée compte peu."
      />
      <NumberField v-model="profile.mix.loadSmoothingS" label="Lissage de la charge" :min="0.02" :max="1.5" :step="0.01" unit="s"
        hint="Temps que met la charge à suivre la pédale. Trop court, le fondu papillonne ; trop long, le son traîne derrière la conduite."
      />
      <NumberField v-model="profile.mix.idleFadeOutRpm" label="Effacement du ralenti" :min="800" :max="4000" :step="50" unit="tr/min"
        hint="Régime au-dessus duquel la couche de ralenti disparaît complètement, le moteur étant alors entraîné par les roues."
      />
      <NumberField v-model="profile.mix.highpassHz" label="Coupe-bas" :min="10" :max="200" :step="1" unit="Hz"
        hint="Retire les fréquences les plus graves. Utile sur un petit haut-parleur, qui ne les reproduit pas et s'y fatigue."
      />
      <NumberField v-model="profile.mix.drive" label="Saturation" :min="0" :max="1" :step="0.01"
        hint="Épaissit le son et le fait paraître plus fort. Trop poussé, il devient sale."
      />
      <NumberField v-model="profile.mix.limiterThresholdDb" label="Seuil du limiteur" :min="-24" :max="0" :step="0.5" unit="dB"
        hint="Niveau à partir duquel le son est retenu pour éviter la saturation. Le baisser laisse monter le volume général, mais aplatit les nuances."
      />
    </section>

    <section v-if="volet === 'son'" class="panel wide">
      <h2>Couches</h2>
      <p class="note">
        Le régime d'ancrage est celui auquel l'échantillon a été enregistré : il détermine
        la justesse, pas le point de bascule. Les bornes de lecture limitent l'étirement —
        au-delà d'environ une octave, l'échantillon devient métallique vers le haut et
        pâteux vers le bas.
      </p>
      <div class="table-scroll">
      <table class="layers">
        <thead>
          <tr>
            <th></th>
            <th>Clé</th>
            <th>Fichier</th>
            <th>Rôle</th>
            <th>Ancrage</th>
            <th>Gain</th>
            <th>Lecture min</th>
            <th>Lecture max</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <template v-for="(layer, index) in profile.layers" :key="index">
          <tr>
            <td><input v-model="layer.enabled" type="checkbox" /></td>
            <td><input v-model="layer.key" type="text" /></td>
            <td><input v-model="layer.file" type="text" /></td>
            <td>
              <select v-model="layer.role">
                <option v-for="role in ROLES" :key="role.id" :value="role.id">{{ role.label }}</option>
              </select>
            </td>
            <td><input v-model.number="layer.anchorRpm" type="number" min="200" max="20000" step="10" /></td>
            <td><input v-model.number="layer.gain" type="number" min="0" max="4" step="0.05" /></td>
            <td><input v-model.number="layer.minRate" type="number" min="0.1" max="1" step="0.05" /></td>
            <td><input v-model.number="layer.maxRate" type="number" min="1" max="4" step="0.05" /></td>
            <td class="actions">
              <button :disabled="!layer.file || analyzing !== null" @click="analyzeLayer(index)">
                {{ analyzing === index ? 'Analyse…' : 'Analyser' }}
              </button>
              <button @click="removeLayer(index)">Retirer</button>
            </td>
          </tr>
          <tr v-if="analyses[index]" class="analysis">
            <td :colspan="9">
              <span v-if="errorOf(index)" class="error">{{ errorOf(index) }}</span>
              <template v-else-if="analysisOf(index)">
                <div class="facts">
                  <span>
                    {{ analysisOf(index)!.durationS.toFixed(2) }} s ·
                    {{ analysisOf(index)!.sampleRate }} Hz ·
                    {{ analysisOf(index)!.channels }} canaux
                  </span>
                  <span :class="{ warn: analysisOf(index)!.seamRatio > 0.02 }">
                    raccord {{ (analysisOf(index)!.seamRatio * 100).toFixed(1) }} %
                  </span>
                  <span>timbre {{ analysisOf(index)!.centroidHz.toFixed(0) }} Hz</span>
                  <span :class="{ warn: !analysisOf(index)!.steady }">
                    <template v-if="analysisOf(index)!.steady">régime stable</template>
                    <template v-else>
                      rampe {{ analysisOf(index)!.startRpm }} → {{ analysisOf(index)!.endRpm }} tr/min
                    </template>
                  </span>
                </div>
                <p
                  v-if="impliedCylinders(index) && impliedCylinders(index) !== profile.engine.cylinders"
                  class="error"
                >
                  L'ancrage en place correspondrait à {{ impliedCylinders(index) }} cylindres, non
                  {{ profile.engine.cylinders }}. L'un des deux est faux : vérifier le nombre de
                  cylindres avant d'appliquer une proposition, sans quoi elle sera décalée d'autant.
                </p>
                <div class="candidates">
                  <span class="muted">Ancrage proposé :</span>
                  <button
                    v-for="candidate in analysisOf(index)!.candidates"
                    :key="candidate.rpm"
                    :aria-pressed="layer.anchorRpm === candidate.rpm"
                    :title="candidateTitle(candidate)"
                    @click="applyCandidate(index, candidate.rpm)"
                  >
                    {{ candidate.rpm }}
                  </button>
                  <button
                    v-if="previousAnchors[index] !== undefined"
                    class="undo"
                    @click="undoCandidate(index)"
                  >
                    Revenir à {{ previousAnchors[index] }}
                  </button>
                </div>
              </template>
            </td>
          </tr>
          </template>
        </tbody>
      </table>
      </div>
      <div class="layer-actions">
        <button class="add" @click="addLayer()">Ajouter une couche</button>
        <button :disabled="analyzing !== null" @click="analyzeAll()">Analyser toutes les couches</button>
      </div>
      <p class="note">
        Le régime d'ancrage est mesurable, mais un spectre de moteur se prête mal à
        une réponse unique : la détection confond volontiers une fréquence avec sa
        moitié, son tiers ou ses trois demis. Les propositions sont donc classées
        et non appliquées d'office. Comme le son tourne pendant l'édition, les
        essayer se juge à l'oreille — la bonne saute aux oreilles, les autres
        sonnent une octave ou une quinte à côté. L'indication « timbre » aide à
        recouper : d'un même moteur, la prise haut régime a forcément le timbre le
        plus aigu.
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

/*
 * Les volets : la même forme que les onglets du haut, à l'échelle en dessous.
 * Un second rang d'onglets identiques au premier se lirait comme le premier ;
 * celui-ci est plus petit et n'a pas de raccord au contenu.
 */
.volets {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  max-width: 80rem;
  margin: 0 auto 1rem;
}

.volets button {
  padding: 0.4rem 0.8rem;
  border-color: transparent;
  background: none;
  color: var(--muted);
  font-size: 0.9rem;
}

.volets button[aria-pressed='true'] {
  background: var(--panel);
  border-color: var(--line);
  color: var(--accent);
  font-weight: 600;
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

.creation,
.simple {
  border-color: var(--line-strong);
}

.mode .note {
  flex: 1 1 16rem;
  margin: 0;
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

.toggle .note {
  margin: 0;
  flex: 1 1 12rem;
}

.offline-state .warn {
  color: var(--warn);
}

.facts .warn {
  color: var(--warn);
}
</style>
