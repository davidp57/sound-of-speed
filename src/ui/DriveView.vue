<script setup lang="ts">
import { computed } from 'vue'

import DialGauge from './components/DialGauge.vue'
import { describesSimulatedEngine, soundSourceOf } from '../core/preset/schema'
import {
  ENGINE_LIBRARY,
  ORIGIN_MAX_GAPS,
  closestLibraryEngine,
} from '../core/preset/engine-library'
import {
  activateAudio,
  activeProfile,
  applyLibraryEngine,
  driveFace,
  favoriteProfiles,
  masterVolume,
  setDriveFace,
  setMasterVolume,
  simulatorAvailable,
  selectProfile,
  selectedProfileId,
  audioStatus,
  isMuted,
  synthIsOrigin,
  synthStatus,
  isRunning,
  keepScreenOn,
  screenLockError,
  screenLockHeld,
  screenLockSupported,
  setKeepScreenOn,
  setMuted,
  setShiftMode,
  setDriveMode,
  currentDriveMode,
  setSource,
  shiftDown,
  shiftUp,
  fixRestarts,
  fixStats,
  rejectionCause,
  sourceDetail,
  sourceKind,
  sourceStatus,
  telemetry,
  type SourceKind,
} from '../state'
import { DRIVE_MODE_LABELS } from '../core/drivetrain/drive-mode'

/**
 * Bascule le tempérament.
 *
 * Deux valeurs, donc un bouton et non deux : il porte celle qui est active et
 * donne l'autre au clic. C'est le patron que le plein écran emploie déjà pour la
 * commande de boîte.
 */
function toggleDriveMode(): void {
  setDriveMode(currentDriveMode.value === 'sport' ? 'road' : 'sport')
}

withDefaults(defineProps<{ immersive?: boolean }>(), { immersive: false })

/**
 * Les moteurs simulés, à portée de pouce.
 *
 * David : « on doit pouvoir changer facilement la source du son du profil
 * [...] en sélectionnant le moteur simulé sur la page principale. Donc, des
 * boutons pour le profil, et si le profil sélectionné correspond à un moteur
 * simulé (ou à une simu enregistrée, d'ailleurs) des boutons pour chaque type
 * de moteur dispo. »
 *
 * Le rang n'apparaît que si le profil décrit un moteur simulé. Sur un profil
 * *généré à l'avance*, il choisit bien le moteur du profil, mais la banque
 * déjà rendue continue de jouer : le son ne changera qu'au prochain rendu.
 */
const showsEngines = computed(() => describesSimulatedEngine(soundSourceOf(activeProfile.value)))

const closestEngine = computed(() => {
  const mine = activeProfile.value.engineDefinition
  if (mine === undefined) return null
  return closestLibraryEngine(mine, activeProfile.value.engine.redlineRpm)
})

/** Le bouton allumé : seulement quand le moteur est chargé tel quel. */
const loadedEngineId = computed(() =>
  closestEngine.value?.gaps === 0 ? closestEngine.value.engine.id : '',
)

/**
 * Ce qui s'affiche en tête du rang.
 *
 * Un moteur retouché n'allume aucun bouton — mais le taire laisserait croire
 * qu'aucun n'est chargé. Le libellé dit alors de qui il descend.
 */
const engineLabel = computed(() => {
  const near = closestEngine.value
  if (near === null || near.gaps > ORIGIN_MAX_GAPS) return 'Moteur'
  if (near.gaps === 0) return 'Moteur'
  const s = near.gaps > 1 ? 's' : ''
  return `${near.engine.short}, retouché — ${near.gaps} valeur${s}`
})

/**
 * Quitter le plein écran.
 *
 * L'état est tenu par `App.vue`, qui commande aussi l'API plein écran du
 * navigateur : cet écran ne fait que déclarer l'intention.
 */
const emit = defineEmits<{ exit: [] }>()

/**
 * Les sources de vitesse qu'on peut choisir, et pourquoi il n'y en a qu'une en
 * voiture.
 *
 * David : « en voiture on est toujours en GPS, pas besoin des boutons simu ou
 * rejeu ». Le simulateur et le rejeu sont des outils d'atelier — l'un fabrique
 * une vitesse, l'autre en rejoue une enregistrée ; ni l'un ni l'autre n'a de
 * sens au volant, où ils ne seraient qu'un moyen de se tromper sur ce qu'on
 * entend. Ils ne sont donc proposés qu'en développement, et la rangée entière
 * disparaît quand il ne reste que le GPS : un seul bouton qu'on ne peut pas
 * désactiver n'est pas un choix.
 */
const SOURCES: { id: SourceKind; label: string }[] = simulatorAvailable
  ? [
      { id: 'simulator', label: 'Simulateur' },
      { id: 'geolocation', label: 'GPS' },
      { id: 'replay', label: 'Rejeu' },
    ]
  : [{ id: 'geolocation', label: 'GPS' }]

/**
 * Les trois modes du banc, et ce que chacun met à l'épreuve.
 *
 * L'ordre est celui de la fidélité croissante, et le libellé dit ce qu'on gagne
 * à descendre d'un cran — sans quoi personne ne saurait pourquoi choisir le
 * troisième.
 */
const STATUS_LABELS: Record<string, string> = {
  idle: 'en attente',
  starting: 'acquisition…',
  active: 'actif',
  denied: 'refusé',
  unsupported: 'non pris en charge',
  unavailable: 'indisponible',
}

const manual = computed(() => telemetry.value.gearbox.mode === 'manual')

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
/**
 * Ce que l'écran dit quand le GPS ne donne rien.
 *
 * Une source muette n'affichait aucun message : la vitesse restait à zéro sans
 * un mot, et le chien de garde relançait le suivi en silence. Relevé en roulant
 * le 8 septembre 2026, au départ d'un parking souterrain — rien à l'écran ne
 * disait s'il fallait attendre, ressortir, ou donner une autorisation.
 *
 * Le compte des positions reçues sépare les deux cas, et ils n'appellent pas la
 * même chose de la part du conducteur.
 */
const SILENT_AFTER_MS = 5000
const silentSourceMessage = computed(() => {
  if (sourceKind.value !== 'geolocation' || !isRunning.value) return ''
  if (sourceStatus.value === 'denied') return ''
  const silence = telemetry.value.speed.sinceLastSampleMs
  if (silence < SILENT_AFTER_MS) return ''

  const seconds = Math.round(silence / 1000)
  const relances = fixRestarts.value > 0 ? ` Suivi relancé ${fixRestarts.value} fois.` : ''
  if (fixStats.value.received === 0) {
    return (
      `Aucune position reçue depuis ${seconds} s. Le GPS n'accroche pas sous un ` +
      `bâtiment, et l'autorisation de localisation se donne par adresse : celle-ci ` +
      `peut ne pas l'avoir encore.${relances}`
    )
  }
  return `Plus aucune position depuis ${seconds} s.${relances}`
})

/**
 * Un seul bouton pour le son, et il bascule.
 *
 * Il n'activait auparavant que le son, sans jamais l'éteindre : une fois allumé,
 * il affichait « Son actif » et rappelait l'activation à chaque clic. Un bouton
 * qui montre un état allumé doit pouvoir l'éteindre, sans quoi il ment.
 */
/**
 * L'état du son, quelle que soit son origine.
 *
 * Un profil « généré en direct » ne charge pas de banque : c'est l'état du
 * moteur simulé que le bouton doit montrer. Une seule lecture pour tout ce que
 * le bouton dit de lui-même — son texte, sa couleur, son geste — sinon les trois
 * se désaccordent : le libellé tenait compte de l'origine, la couleur non, et le
 * bouton annonçait « Son actif » en gris pendant que le moteur simulé jouait.
 */
const audioPhase = computed(() =>
  synthIsOrigin.value ? synthStatus.value.phase : audioStatus.value.phase,
)

const audioLabel = computed(() => {
  switch (audioPhase.value) {
    case 'loading':
      return synthIsOrigin.value
        ? 'Moteur en construction'
        : `Chargement ${audioStatus.value.loaded}/${audioStatus.value.total}`
    case 'ready':
      return isMuted.value ? 'Son coupé' : 'Son actif'
    case 'error':
      return 'Son en erreur'
    default:
      return 'Activer le son'
  }
})

/** Le bouton est allumé quand du son sort vraiment, et de n'importe quelle origine. */
const audioOn = computed(() => audioPhase.value === 'ready' && !isMuted.value)

function toggleAudio(): void {
  if (audioPhase.value === 'ready') setMuted(!isMuted.value)
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
      <template v-if="SOURCES.length > 1">
        <button
          v-for="entry in SOURCES"
          :key="entry.id"
          :aria-pressed="sourceKind === entry.id"
          @click="setSource(entry.id)"
        >
          {{ entry.label }}
        </button>
      </template>
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

    <section v-if="showsEngines" class="engines" :class="{ large: immersive }">
      <span class="engines-label">{{ engineLabel }}</span>
      <button
        v-for="entry in ENGINE_LIBRARY"
        :key="entry.id"
        :aria-pressed="entry.id === loadedEngineId"
        @click="applyLibraryEngine(entry)"
      >
        {{ entry.short }}
      </button>
    </section>

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
        <!--
          Les commandes de boîte encadrent le rapport, et ne sont plus rangées
          en bas de l'écran : c'est la disposition que David a dessinée le
          10 septembre 2026, et elle place la main là où le regard est déjà —
          entre les deux cadrans, au lieu de descendre chercher une barre.
        -->
        <div class="gear-controls">
          <button :aria-pressed="manual" @click="setShiftMode(manual ? 'auto' : 'manual')">
            {{ manual ? 'Manuelle' : 'Auto' }}
          </button>
          <button :disabled="!manual" @click="shiftDown()">−</button>
          <button :disabled="!manual" @click="shiftUp()">+</button>
        </div>
        <div class="gear-value numeric">{{ telemetry.gearbox.label }}</div>
        <div class="unit">rapport</div>
        <div class="gear-controls">
          <button @click="toggleDriveMode()">{{ DRIVE_MODE_LABELS[currentDriveMode] }}</button>
        </div>
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
        <div class="gear-controls">
          <button :aria-pressed="manual" @click="setShiftMode(manual ? 'auto' : 'manual')">
            {{ manual ? 'Manuelle' : 'Auto' }}
          </button>
          <button :disabled="!manual" @click="shiftDown()">−</button>
          <button :disabled="!manual" @click="shiftUp()">+</button>
        </div>
        <div class="value numeric">{{ telemetry.gearbox.label }}</div>
        <div class="unit">rapport</div>
        <div class="gear-controls">
          <button @click="toggleDriveMode()">{{ DRIVE_MODE_LABELS[currentDriveMode] }}</button>
        </div>
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
        <button :class="{ 'is-active': audioOn }" @click="toggleAudio()">
          {{ audioLabel }}
        </button>
      </div>
    </section>

    <section v-else class="controls">
      <div class="control-bar">
      <div class="group">
        <span class="label">Son</span>
        <button
          :class="{ 'is-active': audioOn }"
          :disabled="audioPhase === 'loading'"
          @click="toggleAudio()"
        >
          {{ audioLabel }}
        </button>
        <label v-if="audioPhase === 'ready'" class="volume">
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

      </div>

      <p v-if="audioPhase === 'error'" class="hint warn">
        {{ synthIsOrigin ? synthStatus.error : audioStatus.error }}
      </p>

      <p v-if="rejectionMessage" class="hint warn">{{ rejectionMessage }}</p>

      <p v-else-if="sourceKind === 'geolocation' && sourceStatus === 'denied'" class="hint warn">
        La localisation a été refusée. Autorisez-la dans les réglages du site pour
        mesurer votre vitesse.
      </p>

      <p v-else-if="silentSourceMessage" class="hint warn">{{ silentSourceMessage }}</p>
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

.engines {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  flex-wrap: wrap;
  margin-top: 0.4rem;
}

.engines-label {
  font-size: 0.8rem;
  opacity: 0.7;
}

.engines.large button {
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
.gear-controls {
  display: flex;
  gap: 0.4rem;
  justify-content: center;
  flex-wrap: wrap;
}

/* Les commandes ne doivent pas voler la place du rapport, qui se lit d'abord. */
.gear-controls button {
  padding: 0.35rem 0.7rem;
  font-size: 0.9rem;
}

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
