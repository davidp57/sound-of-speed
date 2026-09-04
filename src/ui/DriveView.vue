<script setup lang="ts">
import { computed, ref } from 'vue'

import DialGauge from './components/DialGauge.vue'
import {
  activateAudio,
  activeProfile,
  driveFace,
  favoriteProfiles,
  masterVolume,
  setBenchOptions,
  setDriveFace,
  setMasterVolume,
  setSimulationMode,
  simulationMode,
  simulatorAvailable,
  selectProfile,
  selectedProfileId,
  audioStatus,
  isMuted,
  isRunning,
  keepScreenOn,
  screenLockError,
  screenLockHeld,
  screenLockSupported,
  setKeepScreenOn,
  setMuted,
  setBrake,
  setShiftMode,
  getSimulatedCruise,
  setSimulatedSpeed,
  setSource,
  setThrottle,
  shiftDown,
  shiftUp,
  benchOptions,
  padConnected,
  padLabel,
  padMapping,
  rejectionCause,
  sourceDetail,
  sourceKind,
  sourceStatus,
  telemetry,
  type SimulationMode,
  type SourceKind,
} from '../state'

withDefaults(defineProps<{ immersive?: boolean }>(), { immersive: false })

/**
 * Quitter le plein écran.
 *
 * L'état est tenu par `App.vue`, qui commande aussi l'API plein écran du
 * navigateur : cet écran ne fait que déclarer l'intention.
 */
const emit = defineEmits<{ exit: [] }>()

// Le simulateur n'est proposé qu'en développement : dans une voiture, il n'est
// qu'un moyen de se tromper sur ce qu'on entend.
const SOURCES: { id: SourceKind; label: string }[] = [
  ...(simulatorAvailable ? [{ id: 'simulator' as const, label: 'Simulateur' }] : []),
  { id: 'geolocation', label: 'GPS' },
  { id: 'replay', label: 'Rejeu' },
]

/**
 * Les trois modes du banc, et ce que chacun met à l'épreuve.
 *
 * L'ordre est celui de la fidélité croissante, et le libellé dit ce qu'on gagne
 * à descendre d'un cran — sans quoi personne ne saurait pourquoi choisir le
 * troisième.
 */
const MODES: { id: SimulationMode; label: string; hint: string }[] = [
  {
    id: 'perfect',
    label: 'Vitesse exacte',
    hint: 'Une vitesse parfaite à chaque image. Commode pour juger un réglage de son, mais toute la difficulté du produit disparaît.',
  },
  {
    id: 'measured',
    label: 'Mesure GPS',
    hint: 'La même vitesse, livrée à la cadence d’un récepteur et bruitée. Met le conditionnement à l’épreuve : extrapolation, charge qui frémit, passages parasites.',
  },
  {
    id: 'positions',
    label: 'Positions GPS',
    hint: 'Des positions complètes, lues par la vraie source GPS. Le seul mode qui éprouve la dérivation par distance, le filtre de précision et le plafond de plausibilité.',
  },
]

const STATUS_LABELS: Record<string, string> = {
  idle: 'en attente',
  starting: 'acquisition…',
  active: 'actif',
  denied: 'refusé',
  unsupported: 'non pris en charge',
  unavailable: 'indisponible',
}

const manual = computed(() => telemetry.value.gearbox.mode === 'manual')

const modeHint = computed(
  () => MODES.find((mode) => mode.id === simulationMode.value)?.hint ?? '',
)

function patchBench(key: 'cadenceMs' | 'standstillCadenceMs' | 'noiseKmh' | 'accuracyM', event: Event): void {
  const value = Number((event.target as HTMLInputElement).value)
  if (!Number.isFinite(value)) return
  setBenchOptions({ ...benchOptions.value, [key]: value })
}

function patchReportsSpeed(event: Event): void {
  setBenchOptions({
    ...benchOptions.value,
    reportsSpeed: (event.target as HTMLInputElement).checked,
  })
}

/**
 * Ce qui écarte les positions, quand la vitesse se fige alors que le GPS parle.
 *
 * Le message nomme le réglage à regarder : ces trois causes se corrigent, et
 * aucune ne se résout en attendant. Relevé en roulant le 4 septembre 2026, où
 * un étalonnage de ville avait plafonné la vitesse acceptée sans que rien ne le
 * dise.
 */
const REJECTION_LABELS: Record<string, string> = {
  implausible:
    'Les mesures dépassent la vitesse acceptée et sont toutes écartées. ' +
    'Voyez « Vitesse plausible maximale » — un étalonnage incomplet peut l’avoir abaissée.',
  inaccurate:
    'Les positions sont annoncées trop imprécises et sont toutes écartées. ' +
    'Voyez « Précision GPS acceptée ».',
  tooClose:
    'Les positions se suivent de trop près pour en tirer une vitesse, et le GPS ' +
    'n’annonce pas la sienne.',
  none: 'Le GPS envoie des positions, mais aucune vitesse n’en sort.',
}

const rejectionMessage = computed(() =>
  rejectionCause.value === null ? '' : (REJECTION_LABELS[rejectionCause.value] ?? ''),
)
const sliderSpeed = ref(0)
const cruiseOn = ref(false)

/**
 * Régulateur du simulateur : le curseur tient l'allure au lieu de la poser une
 * fois. Toucher l'accélérateur ou le frein rend la main, comme sur une voiture.
 */
function onSlider(event: Event): void {
  const value = Number((event.target as HTMLInputElement).value)
  sliderSpeed.value = value
  cruiseOn.value = true
  setSimulatedSpeed(value)
}

function releaseCruise(): void {
  cruiseOn.value = false
  setSimulatedSpeed(null)
}

/** Le régulateur peut avoir été levé par une pédale : on suit son état réel. */
const cruiseActive = computed(() => cruiseOn.value && getSimulatedCruise() !== null)

/**
 * Un seul bouton pour le son, et il bascule.
 *
 * Il n'activait auparavant que le son, sans jamais l'éteindre : une fois allumé,
 * il affichait « Son actif » et rappelait l'activation à chaque clic. Un bouton
 * qui montre un état allumé doit pouvoir l'éteindre, sans quoi il ment.
 */
const audioLabel = computed(() => {
  switch (audioStatus.value.phase) {
    case 'loading':
      return `Chargement ${audioStatus.value.loaded}/${audioStatus.value.total}`
    case 'ready':
      return isMuted.value ? 'Son coupé' : 'Son actif'
    case 'error':
      return 'Son en erreur'
    default:
      return 'Activer le son'
  }
})

function toggleAudio(): void {
  if (audioStatus.value.phase === 'ready') setMuted(!isMuted.value)
  else void activateAudio()
}

const rpmPercent = computed(() => {
  const { rpm } = telemetry.value.engine
  const redline = activeProfile.value.engine.redlineRpm
  return Math.round((rpm / Math.max(1, redline)) * 100)
})

/**
 * Échelle du compte-tours : le rupteur, arrondi au millier supérieur, de sorte
 * que la dernière graduation soit un chiffre rond. La zone rouge commence au
 * seuil de coupure, là où l'allumage se met à mordre.
 */
const rpmScale = computed(() => Math.ceil(activeProfile.value.engine.redlineRpm / 1000) * 1000)

/**
 * Échelle du compteur de vitesse : fixe, et c'est voulu.
 *
 * Le premier réflexe était de la déduire de la voiture — la vitesse à laquelle
 * le dernier rapport touche le rupteur. Mesuré sur les profils livrés, cela
 * donne 304 km/h pour Route et 326 pour Sport : l'aiguille passerait sa vie
 * dans le coin inférieur gauche, et la moitié du cadran ne servirait jamais.
 * Un compteur de voiture est gradué pour ce qu'on roule, pas pour ce que la
 * mécanique permet. 180 km/h place 130 aux trois quarts de la course.
 */
const SPEED_SCALE_KMH = 180
const SPEED_STEP_KMH = 20
</script>

<template>
  <div class="drive" :class="{ immersive }">
    <div class="toolbar">
      <section v-if="!immersive" class="sources">
      <button
        v-for="entry in SOURCES"
        :key="entry.id"
        :aria-pressed="sourceKind === entry.id"
        @click="setSource(entry.id)"
      >
        {{ entry.label }}
      </button>
      <span class="status">
        {{ STATUS_LABELS[sourceStatus] ?? sourceStatus }}
        <template v-if="sourceDetail"> — {{ sourceDetail }}</template>
      </span>
    </section>

    <!--
      Les deux visages de l'écran.
      Les cadrans se lisent mieux en roulant ; on ne règle pas un profil sur une
      aiguille, où cent tours d'écart ne se voient pas. Le choix est une
      préférence de l'appareil, retenue d'une ouverture à l'autre.

      Le décor qui défilait derrière les cadrans est retiré : il défilait de
      côté, comme un jeu de plateforme, là où une vue depuis la place du
      conducteur défile en perspective, d'avant en arrière. Il reviendra
      autrement, et le code de l'ancien est dans l'historique.
    -->
      <section v-if="!immersive" class="face-switch">
        <button :aria-pressed="driveFace === 'dials'" @click="setDriveFace('dials')">Cadrans</button>
        <button :aria-pressed="driveFace === 'numbers'" @click="setDriveFace('numbers')">
          Chiffres
        </button>
      </section>

      <section v-if="favoriteProfiles.length > 1" class="favorites" :class="{ large: immersive }">
      <button
        v-for="entry in favoriteProfiles"
        :key="entry.id"
        :aria-pressed="entry.id === selectedProfileId"
        @click="selectProfile(entry.id)"
      >
        {{ entry.name }}
      </button>
    </section>
    </div>

    <section v-if="driveFace === 'dials'" class="dashboard">
      <div class="cell speed">
        <DialGauge
          :value="telemetry.speed.kmh"
          :max="SPEED_SCALE_KMH"
          :step="SPEED_STEP_KMH"
          unit="km/h"
        />
      </div>

      <div class="cell gear">
        <div class="gear-value numeric">{{ telemetry.gearbox.label }}</div>
        <div class="unit">rapport</div>
      </div>

      <div class="cell rpm">
        <DialGauge
          :value="telemetry.engine.rpm"
          :max="rpmScale"
          :step="1000"
          :redline="activeProfile.engine.softLimitRpm"
          :alert="telemetry.engine.limiterActive"
          unit="tr/min"
        />
      </div>
    </section>

    <section v-else class="readout">
      <div class="cell speed">
        <div class="value numeric">{{ Math.round(telemetry.speed.kmh) }}</div>
        <div class="unit">km/h</div>
      </div>

      <div class="cell gear">
        <div class="value numeric">{{ telemetry.gearbox.label }}</div>
        <div class="unit">rapport</div>
      </div>

      <div class="cell rpm">
        <div class="value numeric">{{ Math.round(telemetry.engine.rpm) }}</div>
        <div class="unit">tr/min</div>
        <div class="gauge">
          <div
            class="fill"
            :class="{ redline: telemetry.engine.limiterActive }"
            :style="{ width: rpmPercent + '%' }"
          />
        </div>
      </div>
    </section>

    <!--
      La sortie du plein écran est à gauche, à l'écart des autres et d'une autre
      couleur. Elle était auparavant une croix flottante en haut à droite, en
      transparence et sans fond, posée **par-dessus** la rangée des profils
      épinglés : quitter le plein écran recouvrait changer de profil. Une flèche
      de retour dit ce qu'elle fait sans qu'on ait à le lire.
    -->
    <section v-if="immersive" class="immersive-controls">
      <button class="exit" title="Quitter le plein écran" @click="emit('exit')">
        <span aria-hidden="true">←</span>
        <span class="sr-only">Quitter le plein écran</span>
      </button>
      <div class="immersive-group">
        <button :class="{ 'is-active': !isMuted }" @click="toggleAudio()">
          {{ isMuted ? 'Son coupé' : 'Son actif' }}
        </button>
        <button :aria-pressed="manual" @click="setShiftMode(manual ? 'auto' : 'manual')">
          {{ manual ? 'Manuelle' : 'Auto' }}
        </button>
        <button :disabled="!manual" @click="shiftDown()">−</button>
        <button :disabled="!manual" @click="shiftUp()">+</button>
      </div>
    </section>

    <section v-else class="controls">
      <div class="control-bar">
      <div class="group">
        <span class="label">Son</span>
        <button
          :class="{ 'is-active': audioStatus.phase === 'ready' && !isMuted }"
          :disabled="audioStatus.phase === 'loading'"
          @click="toggleAudio()"
        >
          {{ audioLabel }}
        </button>
        <label v-if="audioStatus.phase === 'ready'" class="volume">
          Volume
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            :value="masterVolume"
            @input="setMasterVolume(Number(($event.target as HTMLInputElement).value))"
          />
        </label>
      </div>
      <div v-if="screenLockSupported" class="group">
        <span class="label">Écran</span>
        <button :aria-pressed="keepScreenOn" @click="setKeepScreenOn(!keepScreenOn)">
          Garder allumé
        </button>
        <span v-if="keepScreenOn && screenLockHeld" class="hint">actif</span>
        <span v-else-if="keepScreenOn" class="hint warn">
          {{ screenLockError || 'Verrou non obtenu.' }}
        </span>
      </div>
      <div class="group">
        <span class="label">Boîte</span>
        <button :aria-pressed="!manual" @click="setShiftMode('auto')">Auto</button>
        <button :aria-pressed="manual" @click="setShiftMode('manual')">Manuelle</button>
        <button :disabled="!manual" @click="shiftDown()">−</button>
        <button :disabled="!manual" @click="shiftUp()">+</button>
      </div>
      </div>

      <p v-if="audioStatus.phase === 'error'" class="hint warn">{{ audioStatus.error }}</p>

      <template v-if="sourceKind === 'simulator'">
        <div class="group column">
          <span class="note">Ce que le banc fabrique</span>
          <div class="modes">
            <button
              v-for="mode in MODES"
              :key="mode.id"
              :aria-pressed="simulationMode === mode.id"
              :title="mode.hint"
              @click="setSimulationMode(mode.id)"
            >
              {{ mode.label }}
            </button>
          </div>
          <span class="hint">{{ modeHint }}</span>
        </div>

        <div v-if="simulationMode !== 'perfect'" class="group column">
          <label class="bench">
            <span>Cadence en roulant</span>
            <input
              type="number"
              min="10"
              max="2000"
              step="10"
              :value="benchOptions.cadenceMs"
              @input="patchBench('cadenceMs', $event)"
            />
            <span class="note">ms — 30 sur la voiture, mesuré</span>
          </label>
          <label class="bench">
            <span>Cadence à l'arrêt</span>
            <input
              type="number"
              min="100"
              max="10000"
              step="100"
              :value="benchOptions.standstillCadenceMs"
              @input="patchBench('standstillCadenceMs', $event)"
            />
            <span class="note">ms — le récepteur s'espace quand rien ne bouge</span>
          </label>
          <label class="bench">
            <span>Bruit de mesure</span>
            <input
              type="number"
              min="0"
              max="10"
              step="0.1"
              :value="benchOptions.noiseKmh"
              @input="patchBench('noiseKmh', $event)"
            />
            <span class="note">km/h d'écart-type</span>
          </label>
          <template v-if="simulationMode === 'positions'">
            <label class="bench">
              <span>Précision annoncée</span>
              <input
                type="number"
                min="1"
                max="500"
                step="1"
                :value="benchOptions.accuracyM"
                @input="patchBench('accuracyM', $event)"
              />
              <span class="note">m — au-delà du seuil réglé, la source écarte tout</span>
            </label>
            <label class="bench">
              <input
                type="checkbox"
                :checked="benchOptions.reportsSpeed"
                @change="patchReportsSpeed($event)"
              />
              <span>Le récepteur annonce sa vitesse</span>
              <span class="note">
                Décoché, la source doit la dériver de deux positions — le chemin
                où elle s'était tue en roulant.
              </span>
            </label>
          </template>
        </div>
      </template>

      <div v-if="sourceKind === 'simulator'" class="group column">
        <span class="label">Simulateur</span>
        <div class="pedals">
          <button
            @pointerdown="setThrottle(1)"
            @pointerup="setThrottle(0)"
            @pointerleave="setThrottle(0)"
          >
            Accélérer
          </button>
          <button
            @pointerdown="setBrake(1)"
            @pointerup="setBrake(0)"
            @pointerleave="setBrake(0)"
          >
            Freiner
          </button>
        </div>
        <label class="slider">
          <span>
            Allure maintenue : <span class="numeric">{{ sliderSpeed }}</span> km/h
            <template v-if="!cruiseActive"> — inactive</template>
          </span>
          <input type="range" min="0" max="220" step="1" :value="sliderSpeed" @input="onSlider" />
        </label>
        <div class="group">
          <button :disabled="!cruiseActive" @click="releaseCruise()">Rendre la main</button>
          <span class="hint">
            Le simulateur maintient cette vitesse, comme un régulateur. Accélérez ou
            freinez pour reprendre la main.
          </span>
        </div>
        <p class="hint">
          Au clavier : flèches haut et bas pour accélérer et freiner, flèches gauche
          et droite pour changer de rapport en mode manuel.
        </p>
        <template v-if="padConnected">
          <p class="hint">
            Manette : gâchette droite pour accélérer, gauche pour freiner, A et B pour
            changer de rapport, X pour la boîte automatique ou manuelle, Y pour tenir
            la vitesse, stick gauche pour le volume.
          </p>
          <p class="hint">
            Vue par le navigateur : {{ padLabel || 'sans nom' }} — agencement
            {{ padMapping || 'non annoncé' }}.
            <template v-if="padMapping !== 'standard'">
              Les boutons peuvent ne pas correspondre à ceux décrits.
            </template>
          </p>
        </template>
        <p v-else class="hint">
          Une manette branchée prend la main dès qu'on appuie sur un de ses boutons —
          le navigateur ne la révèle pas avant.
        </p>
      </div>

      <p v-if="rejectionMessage" class="hint warn">{{ rejectionMessage }}</p>

      <p v-else-if="sourceKind === 'geolocation' && sourceStatus === 'denied'" class="hint warn">
        La localisation a été refusée. Autorisez-la dans les réglages du site pour
        mesurer votre vitesse.
      </p>
    </section>

    <p v-if="!isRunning" class="hint">La boucle est arrêtée. Rien n'est mis à jour.</p>
  </div>
</template>

<style scoped>
.drive {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  max-width: 60rem;
  margin: 0 auto;
}

/*
 * Une seule barre d'outils, sur une ligne quand la place le permet.
 *
 * Les trois groupes — source, profil, visage — occupaient trois lignes, soit
 * autant de hauteur prise sur les cadrans. Ils se replient l'un après l'autre
 * dès que la largeur manque, ce qui compte : la largeur utile du navigateur de
 * la voiture n'est pas connue, et son zoom n'est pas réglable.
 *
 * Les groupes restent des sections distinctes : ce sont trois choix sans
 * rapport, et un lecteur d'écran doit continuer de les entendre séparés.
 */
.toolbar {
  display: flex;
  align-items: center;
  gap: 0.4rem 1.25rem;
  flex-wrap: wrap;
}

.sources {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.status {
  color: var(--muted);
  margin-left: 0.5rem;
}

/*
 * Trois ancrages plutôt que trois places au fil du texte : la source à gauche,
 * l'affichage au centre, les profils à droite. Chacun garde sa place quand les
 * autres changent de largeur — un nom de profil plus long ne doit pas déplacer
 * les boutons de source, qu'on cherche au même endroit à chaque fois.
 *
 * Les marges automatiques tombent d'elles-mêmes quand la barre se replie : les
 * groupes se rangent alors les uns sous les autres, alignés à gauche.
 */
.face-switch {
  margin-left: auto;
  margin-right: auto;
}

.favorites {
  margin-left: auto;
}

.favorites {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.favorites.large button {
  flex: 1;
  padding: 0.7rem 0.5rem;
}

.readout {
  display: grid;
  grid-template-columns: 2fr 1fr 2fr;
  gap: 0.75rem;
}

.cell {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 1rem 1.25rem;
}

.value {
  font-size: clamp(2.5rem, 9vw, 5rem);
  line-height: 1;
  font-weight: 300;
}

.gear .value {
  color: var(--accent);
}

.unit {
  color: var(--muted);
  margin-top: 0.35rem;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.gauge {
  margin-top: 0.75rem;
  height: 6px;
  background: var(--panel-alt);
  border-radius: 3px;
  overflow: hidden;
}

.fill {
  height: 100%;
  background: var(--accent);
}

.fill.redline {
  background: var(--warn);
}

.face-switch {
  display: flex;
  gap: 0.4rem;
}


/*
 * Tableau de bord.
 *
 * Trois cellules qui se lisent ensemble, sans rien faire défiler : le compteur,
 * le rapport, le compte-tours. En portrait, les deux cadrans se partagent la
 * largeur et le rapport passe en bandeau sous eux — c'est l'information la plus
 * utile de l'écran, celle qui explique ce qu'on entend, et elle a droit à toute
 * la largeur plutôt qu'au tiers du milieu.
 *
 * Les cellules n'ont ni fond ni bordure ici : les cadrans portent déjà leur
 * propre disque opaque, et le décor doit pouvoir se voir autour.
 */
.dashboard {
  position: relative;
  display: grid;
  grid-template-columns: 1fr minmax(4.5rem, 0.5fr) 1fr;
  grid-template-areas: 'speed gear rpm';
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem;
}

.dashboard .cell {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  background: transparent;
  border: none;
  padding: 0;
  min-width: 0;
}

.dashboard .speed {
  grid-area: speed;
}

.dashboard .rpm {
  grid-area: rpm;
}

.dashboard .gear {
  grid-area: gear;
  text-align: center;
}

.gear-value {
  font-size: clamp(2.5rem, 9vw, 5.5rem);
  line-height: 1;
  font-weight: 300;
  color: var(--accent);
}

.controls {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/*
 * Son, écran et boîte sur une ligne : trois réglages qu'on touche à l'arrêt, et
 * qui prenaient trois lignes de haut à eux seuls. Ils se replient quand la
 * largeur manque, comme la barre du haut.
 */
.control-bar {
  display: flex;
  align-items: center;
  gap: 0.4rem 1.5rem;
  flex-wrap: wrap;
}

.group {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.group.column {
  flex-direction: column;
  align-items: stretch;
}

.label {
  color: var(--muted);
  min-width: 5rem;
}

.modes {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.modes button {
  flex: 1;
  min-width: 8rem;
}

/* Une ligne de réglage du banc : libellé, saisie courte, explication dessous. */
.bench {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.bench input[type='number'] {
  width: 6rem;
}

.pedals {
  display: flex;
  gap: 0.4rem;
}

.pedals button {
  flex: 1;
  padding: 0.9rem;
  touch-action: none;
}

.slider {
  display: block;
  color: var(--muted);
}

.volume {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--muted);
  flex: 1 1 12rem;
}

.hint {
  color: var(--muted);
  font-size: 0.9rem;
  margin: 0;
}

.hint.warn {
  color: var(--warn);
}

/*
 * Mode conduite : les chiffres occupent toute la hauteur disponible et les
 * boutons deviennent des cibles qu'on atteint sans regarder.
 */
.drive.immersive {
  height: 100%;
  gap: 0.5rem;
  max-width: none;
  padding: 0.5rem;
}

.drive.immersive .readout {
  flex: 1;
  align-items: stretch;
}

.drive.immersive .cell {
  display: flex;
  flex-direction: column;
  justify-content: center;
  border: none;
  background: transparent;
}

.drive.immersive .value {
  font-size: clamp(4rem, 18vh, 12rem);
}

.immersive-controls {
  display: flex;
  gap: 1.4rem;
}

.immersive-group {
  display: grid;
  flex: 1;
  gap: 0.5rem;
  grid-template-columns: repeat(4, 1fr);
}

.immersive-controls button {
  padding: 1.1rem 0.5rem;
  font-size: 1.05rem;
}

/*
 * La touche de sortie : à part, et d'une autre couleur.
 *
 * L'écart avec le groupe est plus large que celui qui sépare les commandes entre
 * elles — c'est lui qui empêche de la presser en visant la voisine. Et elle ne
 * porte pas la couleur des commandes de conduite : ce qu'elle fait n'est pas de
 * la même nature.
 */
.exit {
  background: transparent;
  border-color: var(--muted);
  color: var(--muted);
  flex: 0 0 auto;
  font-size: 1.6rem;
  line-height: 1;
  min-width: 3.6rem;
  padding: 1.1rem 0.5rem;
}

/* Le libellé est lu par les lecteurs d'écran, la flèche parle aux autres. */
.sr-only {
  clip-path: inset(50%);
  height: 1px;
  overflow: hidden;
  position: absolute;
  white-space: nowrap;
  width: 1px;
}

/*
 * Mode plein écran, visage à cadrans : la rangée de cadrans prend toute la
 * hauteur disponible et les cadrans s'y inscrivent en gardant leurs
 * proportions. Les rangées sont déclarées, faute de quoi elles se
 * dimensionneraient sur leur contenu et déborderaient de l'écran.
 */
.drive.immersive .dashboard {
  flex: 1;
  min-height: 0;
  align-items: stretch;
  grid-template-rows: minmax(0, 1fr);
}

.drive.immersive .dashboard .cell {
  min-height: 0;
}

/*
 * Les cadrans prennent toute la hauteur de leur cellule au lieu de garder la
 * largeur pour seule mesure : sans cette règle, un cadran de 175 pixels de large
 * flottait au milieu d'une rangée de 500 de haut. Le dessin s'inscrit dans la
 * boîte et se centre, ses proportions étant tenues par le repère du SVG.
 */
.drive.immersive .dashboard .dial {
  height: 100%;
  max-height: none;
}

/* Le rapport grandit avec l'écran : c'est l'information qu'on cherche le plus. */
.drive.immersive .gear-value {
  font-size: clamp(3rem, 14vh, 10rem);
}

@media (max-width: 640px) {
  .dashboard {
    grid-template-columns: 1fr 1fr;
    grid-template-areas:
      'speed rpm'
      'gear gear';
  }

  /*
   * Plein écran en portrait : les cadrans s'empilent.
   *
   * Côte à côte, chacun est borné par la moitié de la largeur — 165 pixels
   * mesurés sur un téléphone de 375 —, et la hauteur libre reste vide. Empilés,
   * ils font 375 de large chacun, avec le rapport entre les deux comme sur une
   * planche de bord. Hors plein écran, ils restent côte à côte : là, c'est de
   * lire les trois d'un coup sans faire défiler qui compte.
   */
  .drive.immersive .dashboard {
    grid-template-columns: 1fr;
    grid-template-areas:
      'speed'
      'gear'
      'rpm';
    grid-template-rows: minmax(0, 1fr) auto minmax(0, 1fr);
  }
}

@media (max-width: 620px) {
  .readout {
    grid-template-columns: 1fr 1fr;
  }

  /*
   * Réservé au visage en chiffres : le tableau de bord a sa propre disposition
   * en portrait, et un sélecteur non qualifié la lui écrasait.
   */
  .readout .rpm {
    grid-column: 1 / -1;
  }
}
</style>
