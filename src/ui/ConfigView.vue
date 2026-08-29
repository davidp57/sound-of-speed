<script setup lang="ts">
import { computed, ref } from 'vue'

import NumberField from './components/NumberField.vue'
import { finalDriveFor, rpmAtSpeed } from '../core/preset/defaults'
import { ProfileImportError, fromFile, toFile } from '../core/preset/store'
import type { SampleAnalysis } from '../core/audio/analyze'
import type { LayerRole } from '../core/preset/schema'
import {
  activeProfile,
  addProfile,
  analyzeLayerFile,
  backgroundAudio,
  setBackgroundAudio,
  offlineStatus,
  prepareOffline,
  promptInstall,
  deleteProfile,
  duplicateActive,
  profileList,
  renameActive,
  restoreFactoryProfiles,
  selectProfile,
  selectedProfileId,
} from '../state'

/**
 * Écran de configuration.
 *
 * Toute modification est appliquée immédiatement, pendant que la boucle tourne :
 * il n'y a pas de bouton « valider ». Les profils sont enregistrés au fil de
 * l'eau dans le stockage du navigateur, et exportables en JSON pour être
 * transportés d'un appareil à l'autre.
 */

const profile = activeProfile
const importError = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

const ROLES: { id: LayerRole; label: string }[] = [
  { id: 'on', label: 'en charge' },
  { id: 'off', label: 'pied levé' },
  { id: 'idle', label: 'ralenti' },
  { id: 'limiter', label: 'rupteur' },
]

/**
 * Vitesse à laquelle le rupteur tombe dans le dernier rapport. C'est le chiffre
 * parlant : le rapport de pont, seul, ne dit rien à personne. Le modifier
 * recalcule le pont en conséquence.
 */
const redlineSpeed = computed<number>({
  get() {
    const { drivetrain, engine } = profile.value
    const top = drivetrain.gearRatios[drivetrain.gearRatios.length - 1] ?? 1
    const wheelRps =
      engine.redlineRpm / 60 / Math.max(0.01, top * drivetrain.finalDrive)
    return wheelRps * 2 * Math.PI * drivetrain.wheelRadiusM * 3.6
  },
  set(kmh: number) {
    const { drivetrain, engine } = profile.value
    const top = drivetrain.gearRatios[drivetrain.gearRatios.length - 1] ?? 1
    if (kmh <= 0) return
    drivetrain.finalDrive = Number(
      finalDriveFor(engine.redlineRpm, kmh, top, drivetrain.wheelRadiusM).toFixed(3),
    )
  },
})

/** Un curseur par passage : autant que de rapports, moins un. */
const upshiftSlots = computed(() => {
  const count = Math.max(0, profile.value.drivetrain.gearRatios.length - 1)
  const table = profile.value.drivetrain.upshiftRpm
  return Array.from({ length: count }, (_, i) => table[i] ?? table[table.length - 1] ?? 6000)
})

function setUpshiftRpm(index: number, value: number): void {
  const table = [...upshiftSlots.value]
  table[index] = value
  profile.value.drivetrain.upshiftRpm = table
}

/**
 * Vitesse à laquelle le passage se produira, ce qui parle bien plus qu'un
 * régime seul quand on cherche à placer ses rapports.
 */
function upshiftHint(index: number, rpm: number): string {
  const { drivetrain } = profile.value
  const ratio = drivetrain.gearRatios[index]
  if (!ratio) return ''
  const wheelRps = rpm / 60 / Math.max(0.01, ratio * drivetrain.finalDrive)
  const kmh = wheelRps * 2 * Math.PI * drivetrain.wheelRadiusM * 3.6
  return `Soit environ ${Math.round(kmh)} km/h à charge moyenne.`
}

/** Régime en croisière, repère utile pour juger si la boîte est trop courte. */
const cruiseRpm = computed(() => {
  const { drivetrain } = profile.value
  const top = drivetrain.gearRatios[drivetrain.gearRatios.length - 1] ?? 1
  return rpmAtSpeed(130, top, drivetrain.finalDrive, drivetrain.wheelRadiusM)
})

const ratiosText = computed<string>({
  get: () => profile.value.drivetrain.gearRatios.map((r) => r.toFixed(2)).join(', '),
  set(text: string) {
    const parsed = text
      .split(/[,\s]+/)
      .map((piece) => Number(piece.replace(',', '.')))
      .filter((value) => Number.isFinite(value) && value > 0)
    if (parsed.length > 0) profile.value.drivetrain.gearRatios = parsed
  },
})

const delaysText = computed<string>({
  get: () => profile.value.drivetrain.shiftDelaysS.map((d) => d.toFixed(2)).join(', '),
  set(text: string) {
    const parsed = text
      .split(/[,\s]+/)
      .map((piece) => Number(piece.replace(',', '.')))
      .filter((value) => Number.isFinite(value) && value >= 0)
    if (parsed.length > 0) profile.value.drivetrain.shiftDelaysS = parsed
  },
})

const restoreNote = ref('')

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

/** Taille lisible, pour l'état du cache hors réseau. */
function megabytes(bytes: number): string {
  return `${(bytes / 1048576).toFixed(1)} Mo`
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
  <div class="config">
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
        <button @click="duplicateActive()">Dupliquer</button>
        <button :disabled="profileList.length <= 1" @click="deleteProfile(selectedProfileId)">
          Supprimer
        </button>
        <button :title="'Réintroduit les profils livrés avec l’application'" @click="onRestore()">
          Profils d'usine
        </button>
        <button @click="onExport()">Exporter</button>
        <button @click="fileInput?.click()">Importer</button>
        <input ref="fileInput" type="file" accept="application/json,.json" hidden @change="onImport" />
      </div>
      <p v-if="importError" class="error">{{ importError }}</p>
      <p v-else-if="restoreNote" class="note">{{ restoreNote }}</p>
      <label class="inline">
        Dossier d'échantillons
        <input v-model="profile.sampleDir" type="text" />
      </label>
      <p class="note">
        Chemin relatif au dossier d'échantillons. Il n'est jamais versionné : remplacer
        son contenu suffit à changer de banque sonore, sans toucher au code.
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
        </div>
      </div>

      <p v-if="offlineStatus.error" class="error">{{ offlineStatus.error }}</p>
      <p v-else-if="!offlineStatus.supported" class="note">
        Ce navigateur ne prend pas en charge le fonctionnement hors réseau.
      </p>
    </section>

    <section class="panel">
      <h2>Moteur</h2>
      <NumberField
        v-model="profile.engine.cylinders"
        label="Cylindres enregistrés"
        :min="1"
        :max="16"
        :step="1"
        hint="Décrit le moteur des échantillons, pas celui qu'on veut entendre : il ne modifie pas le son. Il sert à convertir la raie d'allumage en régime lors de l'analyse — une valeur fausse y proposerait des ancrages faux, dans le même rapport."
      />
      <NumberField v-model="profile.engine.idleRpm" label="Ralenti" :min="400" :max="3000" :step="10" unit="tr/min" />
      <NumberField
        v-model="profile.engine.softLimitRpm"
        label="Seuil de coupure"
        :min="2000"
        :max="16000"
        :step="50"
        unit="tr/min"
        hint="Régime auquel l'allumage commence à être coupé."
      />
      <NumberField v-model="profile.engine.redlineRpm" label="Rupteur" :min="2000" :max="16000" :step="50" unit="tr/min" />
      <NumberField
        v-model="profile.engine.limiterHoldMs"
        label="Durée de coupure"
        :min="0"
        :max="400"
        :step="5"
        unit="ms"
        hint="C'est le hachage qui produit le crépitement, pas le plafonnement du régime."
      />
      <NumberField
        v-model="profile.engine.inertia"
        label="Inertie"
        :min="0.1"
        :max="4"
        :step="0.05"
        hint="Volant moteur. Plus c'est lourd, plus le régime met de temps à monter à vide."
      />
      <NumberField v-model="profile.engine.freeRevRate" label="Montée à vide" :min="1000" :max="30000" :step="100" unit="tr/min·s⁻¹" />
      <NumberField v-model="profile.engine.engineBraking" label="Frein moteur" :min="500" :max="20000" :step="100" unit="tr/min·s⁻¹" />
    </section>

    <section class="panel">
      <h2>Transmission</h2>
      <label class="inline">
        Démultiplications
        <input
          type="text"
          :value="ratiosText"
          @change="ratiosText = ($event.target as HTMLInputElement).value"
        />
      </label>
      <p class="note">Du plus court au plus long, séparés par des virgules. Une seule valeur = prise directe.</p>

      <NumberField v-model="profile.drivetrain.finalDrive" label="Pont" :min="1" :max="12" :step="0.05" />
      <NumberField
        v-model="redlineSpeed"
        label="Rupteur atteint à"
        :min="60"
        :max="400"
        :step="1"
        unit="km/h"
        hint="Dans le dernier rapport. Modifier cette valeur recalcule le pont."
      />
      <NumberField v-model="profile.drivetrain.wheelRadiusM" label="Rayon de roue" :min="0.15" :max="0.6" :step="0.005" unit="m" />
      <NumberField v-model="profile.drivetrain.shiftTimeMs" label="Temps de passage" :min="0" :max="500" :step="5" unit="ms" />
      <p class="note">
        Régime auquel chaque rapport cède la place au suivant, à charge moyenne.
        Les régler séparément est le seul moyen d'empêcher les rapports courts de
        monter jusqu'au rupteur sans faire passer les longs beaucoup trop bas.
      </p>
      <NumberField
        v-for="(rpm, index) in upshiftSlots"
        :key="index"
        :model-value="rpm"
        :label="`Passage ${index + 1} → ${index + 2}`"
        :min="1000"
        :max="profile.engine.redlineRpm"
        :step="50"
        unit="tr/min"
        :hint="upshiftHint(index, rpm)"
        @update:model-value="setUpshiftRpm(index, $event)"
      />
      <NumberField
        v-model="profile.drivetrain.upshiftLoadSpreadRpm"
        label="Écart selon la charge"
        :min="0"
        :max="4000"
        :step="50"
        unit="tr/min"
        hint="De combien le passage recule pied au plancher et avance pied levé, de part et d'autre des valeurs ci-dessus."
      />
      <NumberField
        v-model="profile.drivetrain.upshiftJitterRpm"
        label="Dispersion aléatoire"
        :min="0"
        :max="600"
        :step="10"
        unit="tr/min"
        hint="Tiré au sort à chaque passage. Sans lui, la boîte passe toujours au même régime exact et s'entend comme une machine."
      />
      <NumberField
        v-model="profile.drivetrain.minUpshiftRpm"
        label="Ne jamais monter sous"
        :min="800"
        :max="5000"
        :step="50"
        unit="tr/min"
        hint="Plancher, toutes charges confondues. C'est lui qui décide à quelle vitesse la boîte rétrograde en décélération : trop bas, elle reste sur le dernier rapport bien après qu'il n'a plus de sens."
      />
      <NumberField
        v-model="profile.drivetrain.downshiftAtRedlineRatio"
        label="Descente sous"
        :min="0.05"
        :max="0.8"
        :step="0.01"
      />
      <label class="inline">
        Temporisations de montée
        <input
          type="text"
          :value="delaysText"
          @change="delaysText = ($event.target as HTMLInputElement).value"
        />
      </label>
      <p class="note">
        En secondes, une par rapport. Des valeurs volontairement inégales : avec une
        temporisation unique, la boîte sonne comme un métronome.
      </p>
      <p class="derived">À 130 km/h dans le dernier rapport : <b class="numeric">{{ Math.round(cruiseRpm) }}</b> tr/min</p>
    </section>

    <section class="panel">
      <h2>Signal de vitesse</h2>
      <NumberField
        v-model="profile.speed.springOmega"
        label="Raideur du lissage"
        :min="2"
        :max="40"
        :step="0.5"
        hint="Haut : réactif, mais les sauts du GPS s'entendent. Bas : doux, mais en retard."
      />
      <NumberField
        v-model="profile.speed.accelWindowMs"
        label="Fenêtre d'accélération"
        :min="200"
        :max="3000"
        :step="50"
        unit="ms"
      />
      <NumberField
        v-model="profile.speed.accelDeadbandKmh"
        label="Zone morte"
        :min="0"
        :max="5"
        :step="0.1"
        unit="km/h"
        hint="En deçà, la variation est traitée comme du tremblement de mesure."
      />
      <NumberField v-model="profile.speed.maxPlausibleKmh" label="Vitesse plausible max" :min="50" :max="400" :step="10" unit="km/h" />
      <NumberField v-model="profile.speed.maxAccelMs2" label="Accélération max retenue" :min="1" :max="30" :step="0.5" unit="m/s²" />
      <NumberField v-model="profile.speed.minAccelMs2" label="Décélération max retenue" :min="-30" :max="-1" :step="0.5" unit="m/s²" />
    </section>

    <section class="panel">
      <h2>Caractère</h2>
      <p class="note">
        Ce qu'une voiture fait ressentir, et qu'on remarque surtout par son
        absence. Chaque comportement s'active séparément.
      </p>

      <div class="toggle">
        <button
          :aria-pressed="profile.feel.kickdown.enabled"
          @click="profile.feel.kickdown.enabled = !profile.feel.kickdown.enabled"
        >
          Rétrogradage forcé
        </button>
        <span class="note">Descendre chercher le couple quand on enfonce la pédale.</span>
      </div>
      <template v-if="profile.feel.kickdown.enabled">
        <NumberField
          v-model="profile.feel.kickdown.loadThreshold"
          label="Déclenché au-delà de"
          :min="0.3"
          :max="1"
          :step="0.05"
          hint="Charge à partir de laquelle la demande est jugée franche."
        />
        <NumberField
          v-model="profile.feel.kickdown.targetRpmFraction"
          label="Régime visé"
          :min="0.3"
          :max="0.95"
          :step="0.01"
          :hint="`Fraction du rupteur, soit ${Math.round(profile.engine.redlineRpm * profile.feel.kickdown.targetRpmFraction)} tr/min.`"
        />
        <NumberField
          v-model="profile.feel.kickdown.maxGears"
          label="Rapports descendus au plus"
          :min="1"
          :max="4"
          :step="1"
        />
      </template>

      <div class="toggle">
        <button
          :aria-pressed="profile.feel.backfire.enabled"
          @click="profile.feel.backfire.enabled = !profile.feel.backfire.enabled"
        >
          Pétarade
        </button>
        <span class="note">Claquements à l'échappement au lever de pied.</span>
      </div>
      <template v-if="profile.feel.backfire.enabled">
        <NumberField
          v-model="profile.feel.backfire.minRpm"
          label="À partir de"
          :min="1000"
          :max="9000"
          :step="100"
          unit="tr/min"
          hint="En deçà, rien ne se produit : il ne reste pas assez à brûler."
        />
        <NumberField v-model="profile.feel.backfire.intensity" label="Intensité" :min="0" :max="1" :step="0.05" />
        <NumberField v-model="profile.feel.backfire.count" label="Claquements par salve" :min="1" :max="10" :step="1" />
      </template>

      <div class="toggle">
        <button
          :aria-pressed="profile.feel.shiftJolt.enabled"
          @click="profile.feel.shiftJolt.enabled = !profile.feel.shiftJolt.enabled"
        >
          À-coup de passage
        </button>
        <span class="note">Le creux du couple coupé, puis la reprise.</span>
      </div>
      <NumberField
        v-if="profile.feel.shiftJolt.enabled"
        v-model="profile.feel.shiftJolt.depth"
        label="Profondeur"
        :min="0"
        :max="1"
        :step="0.05"
        hint="Zéro donne une boîte parfaitement lisse, ce qu'aucune n'est."
      />
    </section>

    <section class="panel">
      <h2>Mixage</h2>
      <NumberField v-model="profile.mix.masterGain" label="Volume général" :min="0" :max="1" :step="0.01" />
      <NumberField
        v-model="profile.mix.crossfadeLowRpm"
        label="Début de bascule"
        :min="500"
        :max="12000"
        :step="50"
        unit="tr/min"
        hint="Régime où la couche haute commence à entrer. Indépendant des régimes d'ancrage."
      />
      <NumberField v-model="profile.mix.crossfadeHighRpm" label="Fin de bascule" :min="500" :max="16000" :step="50" unit="tr/min" />
      <NumberField
        v-model="profile.mix.fullLoadAccelMs2"
        label="Accélération pleine charge"
        :min="0.5"
        :max="10"
        :step="0.1"
        unit="m/s²"
        hint="Accélération au-delà de laquelle la charge est considérée maximale."
      />
      <NumberField v-model="profile.mix.loadSmoothingS" label="Lissage de la charge" :min="0.02" :max="1.5" :step="0.01" unit="s" />
      <NumberField v-model="profile.mix.idleFadeOutRpm" label="Effacement du ralenti" :min="800" :max="4000" :step="50" unit="tr/min" />
      <NumberField v-model="profile.mix.highpassHz" label="Coupe-bas" :min="10" :max="200" :step="1" unit="Hz" />
      <NumberField v-model="profile.mix.drive" label="Saturation" :min="0" :max="1" :step="0.01" />
      <NumberField v-model="profile.mix.limiterThresholdDb" label="Seuil du limiteur" :min="-24" :max="0" :step="0.5" unit="dB" />
    </section>

    <section class="panel wide">
      <h2>Couches</h2>
      <p class="note">
        Le régime d'ancrage est celui auquel l'échantillon a été enregistré : il détermine
        la justesse, pas le point de bascule. Les bornes de lecture limitent l'étirement —
        au-delà d'environ une octave, l'échantillon devient métallique vers le haut et
        pâteux vers le bas.
      </p>
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
.config {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(23rem, 1fr));
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

.derived {
  color: var(--muted);
  font-size: 0.9rem;
  margin: 0.6rem 0 0;
}

.derived b {
  color: var(--text);
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

.layer-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.7rem;
}

.actions {
  display: flex;
  gap: 0.3rem;
  white-space: nowrap;
}

.analysis td {
  background: var(--panel-alt);
  padding: 0.5rem 0.6rem;
}

.facts {
  display: flex;
  flex-wrap: wrap;
  gap: 1.1rem;
  color: var(--muted);
  font-size: 0.85rem;
}

.facts .warn {
  color: var(--warn);
}

.candidates {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.5rem;
}

.candidates .undo {
  border-color: var(--warn);
  color: var(--warn);
  background: transparent;
}

.candidates button {
  padding: 0.25rem 0.6rem;
  font-variant-numeric: tabular-nums;
}
</style>
