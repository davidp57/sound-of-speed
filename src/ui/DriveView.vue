<script setup lang="ts">
import { computed } from 'vue'

import DialGauge from './components/DialGauge.vue'
import DriveSelector from './DriveSelector.vue'
import {
  activateAudio,
  activeProfile,
  captureStatus,
  driveFace,
  favoriteProfiles,
  masterVolume,
  setMasterVolume,
  selectProfile,
  selectedProfileId,
  audioStatus,
  synthIsOrigin,
  synthStatus,
  acknowledgeCarShift,
  answerMeasuredCar,
  isRunning,
  measuredCar,
  measuredCarShift,
  nextGearRpm,
  proposesMeasuredCar,
  lastAccuracyM,
  soundState,
  setMuted,
  fixRestarts,
  fixStats,
  rejectionCause,
  sourceDetail,
  sourceKind,
  sourceStatus,
  telemetry,
  journalDetaille,
  journalDetailleJusqua,
} from '../state'

withDefaults(defineProps<{ immersive?: boolean }>(), { immersive: false })

/**
 * Quitter le plein écran.
 *
 * L'état est tenu par `App.vue`, qui commande aussi l'API plein écran du
 * navigateur : cet écran ne fait que déclarer l'intention.
 */
const emit = defineEmits<{ exit: [] }>()

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

/**
 * Le rapport affiché, et « P » quand l'application est au repos.
 *
 * C'est la position du sélecteur qu'on lit alors, pas un rapport engagé — et la
 * même lettre dans les deux modes de boîte : « N » en manuelle laisserait
 * croire à un point mort qui n'existe pas ici, et à un moyen d'y aller.
 */
/** « un trajet », « dix-sept trajets » : le pluriel se dit. */
/** Ce que le témoin du journal détaillé dit au survol, et aux lecteurs d'écran. */
const detailTitre = computed(() => {
  const fin = journalDetailleJusqua.value
  if (fin === null) return 'Journal détaillé'
  const heure = new Date(fin).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return `Journal détaillé — s'éteint à ${heure}`
})

const trajetsMesures = computed(() => {
  const count = measuredCar.value?.aggregate.tripCount ?? 0
  return count === 1 ? '1 trajet' : `${count} trajets`
})

const gearLabel = computed(() => (isRunning.value ? telemetry.value.gearbox.label : 'P'))

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
  // Complété plus bas par la précision réellement annoncée : c'est elle qui
  // distingue un GPS médiocre d'une valeur sentinelle.

  tooClose:
    'Les positions se suivent de trop près pour en tirer une vitesse, et le GPS ' +
    'n’annonce pas la sienne.',
  none: 'Le GPS envoie des positions, mais aucune vitesse n’en sort.',
}

/**
 * Le seul message qui compte à cet instant, ou rien.
 *
 * Un seul, et par ordre de ce que le conducteur peut y faire : une autorisation
 * refusée se règle, un rejet se comprend, un silence s'attend. En empiler
 * plusieurs reviendrait à n'en faire lire aucun.
 */
const alerte = computed(() => {
  if (!isRunning.value) return 'Application au repos. Toucher D pour démarrer.'
  if (sourceKind.value === 'geolocation' && sourceStatus.value === 'denied') {
    return 'La localisation a été refusée. Autorisez-la dans les réglages du site.'
  }
  if (rejectionMessage.value) return rejectionMessage.value
  return silentSourceMessage.value
})

const rejectionMessage = computed(() => {
  if (rejectionCause.value === null) return ''
  const base = REJECTION_LABELS[rejectionCause.value] ?? ''
  const annoncee = lastAccuracyM.value
  if (rejectionCause.value !== 'inaccurate' || annoncee === null) return base
  return `${base} Annoncée : ${Math.round(annoncee).toLocaleString('fr-FR')} m.`
})
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
 * moteur simulé qu'il faut lire. Ce que le bouton dit de lui-même — son texte,
 * sa couleur, son geste — vient désormais de `soundState`, qui compose cette
 * phase avec le reste en une seule lecture ; sans quoi les trois se
 * désaccordent, comme du temps où le libellé tenait compte de l'origine et la
 * couleur non.
 */
const audioPhase = computed(() =>
  synthIsOrigin.value ? synthStatus.value.phase : audioStatus.value.phase,
)

/**
 * Le bouton son du plein écran, où le sélecteur n'a pas sa place.
 *
 * Il lit le même état que lui — `soundState` — pour que les deux ne puissent
 * pas se contredire, et il nomme le cas d'une autre application qui a pris la
 * sortie : le bouton disait alors « Activer le son » alors que personne ne
 * l'avait coupé.
 */
const audioLabel = computed(() => {
  switch (soundState.value) {
    case 'loading':
      return synthIsOrigin.value
        ? 'Moteur en construction'
        : `Chargement ${audioStatus.value.loaded}/${audioStatus.value.total}`
    case 'error':
      return 'Son en erreur'
    case 'muted':
      return 'Son coupé'
    case 'taken':
      return 'Son pris ailleurs'
    case 'on':
      return 'Son actif'
    default:
      return 'Activer le son'
  }
})

const audioOn = computed(() => soundState.value === 'on')

function toggleAudio(): void {
  if (soundState.value === 'on') setMuted(true)
  else if (soundState.value === 'muted') setMuted(false)
  else void activateAudio()
}

const rpmPercent = computed(() => {
  const rpm = telemetry.value.engine.audibleRpm
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
      <!--
        Le témoin de session : la seule chose de cette barre qui reste visible
        en immersion. Il répond à la question qu'on ne peut pas se poser en
        roulant — ce que je vis là sera-t-il récupérable au retour ? Sa couleur
        change, il ne bouge pas : l'écran se lit en conduisant.
      -->
      <span
        v-if="captureStatus.state !== 'off'"
        class="capture-light"
        :class="captureStatus.state"
        role="status"
        :title="captureStatus.why"
        :aria-label="captureStatus.why"
      ></span>

      <!--
        Le journal détaillé, quand il est allumé.

        Il rappelle qu'un réglage exceptionnel est en cours, et jusqu'à quand.
        Sans lui, on partirait rouler sans savoir qu'on enregistre dix fois plus,
        ou l'on croirait enregistrer alors qu'il s'est éteint dans la nuit.
      -->
      <span v-if="journalDetaille" class="detail-light" role="status" :title="detailTitre">
        détaillé
      </span>

      <!--
        Le choix de la source vit dans la configuration : on ne le fait pas en
        roulant, et l'écran embarqué reste sobre. Ne reste ici que l'état de la
        source, qui est une information et non une commande.
      -->
      <section v-if="!immersive" class="sources">
      <span class="status">
        {{ STATUS_LABELS[sourceStatus] ?? sourceStatus }}
        <template v-if="sourceDetail"> — {{ sourceDetail }}</template>
      </span>
    </section>

    <!--
      Le choix entre les deux visages est passé en configuration : il se fait
      une fois et ne se touche plus en roulant.

      Le décor qui défilait derrière les cadrans est retiré : il défilait de
      côté, comme un jeu de plateforme, là où une vue depuis la place du
      conducteur défile en perspective, d'avant en arrière. Il reviendra
      autrement, et le code de l'ancien est dans l'historique.
    -->
      <!--
        Changer le son en roulant, sans quitter les cadrans.

        Seuls les profils **épinglés**, et à partir de deux : un bouton unique
        qu'on ne peut pas désactiver n'est pas un choix, et la liste complète est
        dans Paramètres. L'épinglage existait depuis longtemps et ne servait
        qu'à trier une liste ; c'est ici qu'il prend son usage.
      -->
      <section
        v-if="favoriteProfiles.length > 1"
        class="favorites"
        :class="{ large: immersive }"
      >
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
      <!--
        Le rapport est en haut, au milieu, entre les deux cadrans — David, le
        14 septembre 2026. Il occupait avant une colonne centrale qui prenait
        263 des 920 pixels de la rangée : les cadrans sont passés de 296 à
        448 pixels de diamètre en l'en sortant, mesuré sur un écran de 1024.
      -->
      <div class="gear-read">
        <div class="gear-value numeric">{{ gearLabel }}</div>
        <div class="unit">rapport</div>
      </div>

      <div class="cell speed">
        <DialGauge
          :value="telemetry.speed.kmh"
          :max="SPEED_SCALE_KMH"
          :step="SPEED_STEP_KMH"
          unit="km/h"
        />
      </div>

      <div class="cell rpm">
        <DialGauge
          :value="telemetry.engine.audibleRpm"
          :max="rpmScale"
          :step="1000"
          :redline="activeProfile.engine.softLimitRpm"
          :alert="telemetry.engine.limiterActive"
          :ghost="nextGearRpm"
          unit="tr/min"
        />
      </div>

      <!--
        Les commandes de boîte passent sous les cadrans : il n'y a plus de
        colonne centrale pour les tenir, et la bande leur donne des touches
        plus larges qu'elles ne l'étaient entre les deux disques.
      -->
      <DriveSelector class="commandes" />
    </section>

    <section v-else class="readout">
      <div class="cell speed">
        <div class="value numeric">{{ Math.round(telemetry.speed.kmh) }}</div>
        <div class="unit">km/h</div>
      </div>

      <div class="cell gear">
        <DriveSelector />
        <div class="gear-read">
          <div class="value numeric">{{ gearLabel }}</div>
          <div class="unit">rapport</div>
        </div>
      </div>

      <div class="cell rpm">
        <div class="value numeric">{{ Math.round(telemetry.engine.audibleRpm) }}</div>
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
      Ce qui ne va pas se lit **sous les cadrans**, pas au bas de l'écran.
      Le 11 septembre 2026, la géolocalisation a été muette pendant tout un
      trajet : le motif du rejet existait déjà, mais rangé sous les réglages, là
      où personne ne regarde en conduisant.
    -->
    <!--
      La proposition du serveur, et ce qui a bougé depuis.

      Un bandeau, pas une fenêtre : il ne bloque rien, donc il n'a pas à
      attendre l'arrêt. David : « y'a pas de raison, si je suis pas dispo je
      l'ignore et je clic plus tard ». Une fenêtre s'ouvrirait au moment précis
      où l'on veut appuyer sur D et partir.
    -->
    <p v-if="proposesMeasuredCar" class="propose">
      <span>Profil de la voiture prêt, sur {{ trajetsMesures }}.</span>
      <button type="button" @click="answerMeasuredCar('accepted')">Appliquer</button>
      <button type="button" @click="answerMeasuredCar('later')">Plus tard</button>
    </p>

    <p v-else-if="measuredCarShift > 0" class="propose">
      <span>
        La voiture mesurée a changé de {{ Math.round(measuredCarShift * 100) }} %.
        Le son suit.
      </span>
      <button type="button" @click="acknowledgeCarShift()">Vu</button>
    </p>

    <p v-if="alerte" class="alert">{{ alerte }}</p>

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
        <button :class="{ 'is-active': audioOn }" :disabled="!isRunning" @click="toggleAudio()">
          {{ audioLabel }}
        </button>
      </div>
    </section>

    <section v-else class="controls">
      <div class="control-bar">
      <!--
        Le son se coupe et se rend depuis l'en-tête. Il ne reste ici que le
        volume, qui est un réglage : on le pose une fois pour la voiture et on
        n'y revient pas en roulant.
      -->
      <div v-if="audioPhase === 'ready'" class="group">
        <span class="label">Son</span>
        <label class="volume" data-visite="volume">
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
      </div>

      <p v-if="audioPhase === 'error'" class="hint warn">
        {{ synthIsOrigin ? synthStatus.error : audioStatus.error }}
      </p>

    </section>

  </div>
</template>

<style scoped>
/*
 * L'alerte est sous les cadrans, en pleine largeur, et n'apparaît que quand il
 * y a quelque chose à faire. Pas de clignotement : sa présence est le signal.
 */
/*
 * La proposition se distingue d'une alerte : elle n'annonce rien qui cloche.
 * Même place, même largeur, une couleur qui ne crie pas.
 */
.propose {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin: 0;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--line-strong);
  border-radius: 0.5rem;
  font-size: 0.95rem;
}

.alert {
  margin: 0;
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  text-align: center;
  border: 1px solid var(--warn);
  color: var(--warn);
  font-size: 0.95rem;
}

/*
 * L'écran de conduite occupe la place qu'on lui donne, plein écran ou non.
 *
 * Il était borné à 60 rem de large et se dimensionnait sur son contenu : sur un
 * écran de 1200, deux cent quarante pixels de largeur restaient inutilisés et
 * trois cent quarante-trois de hauteur sous les cadrans. C'était sans
 * conséquence tant qu'on supposait qu'on roulait en plein écran ; David n'y
 * passe jamais — dit le 14 septembre 2026 —, donc c'était la mise en page
 * ordinaire qui était fausse.
 */
.drive {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  height: 100%;
}

/*
 * Une seule barre d'outils, sur une ligne quand la place le permet.
 *
 * Ce qui s'y choisissait — la source, l'affichage — est passé en
 * configuration ; il n'y reste que l'état de la source et les profils
 * épinglés. Les groupes se replient l'un après l'autre dès que la largeur
 * manque, ce qui compte : la largeur utile du navigateur de la voiture n'est
 * pas connue, et son zoom n'est pas réglable.
 *
 * Les groupes restent des sections distinctes : ce sont deux choses sans
 * rapport, et un lecteur d'écran doit continuer de les entendre séparées.
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

/*
  Le témoin d'enregistrement. Aucune animation : sa couleur porte le sens, et
  un point qui clignote attire l'œil sans jamais rien apprendre de plus.
*/
.capture-light {
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 50%;
  flex: none;
  background: #2e7d32;
}

.capture-light.warn {
  background: #ef6c00;
}

.capture-light.bad {
  background: #c62828;
}

/*
  Le témoin du journal détaillé : lisible, jamais criard.

  Il n'annonce aucun danger — on dépose un journal plus gros, rien de plus — donc
  pas de couleur d'alerte, qui attirerait l'œil du conducteur pour rien.
*/
.detail-light {
  border: 1px solid var(--muted);
  border-radius: 4px;
  color: var(--muted);
  flex: none;
  font-size: 0.7rem;
  padding: 0 0.3rem;
}

.status {
  color: var(--muted);
  margin-left: 0.5rem;
}

/*
 * Deux ancrages plutôt que deux places au fil du texte : l'état de la source à
 * gauche, les profils à droite. Chacun garde sa place quand l'autre change de
 * largeur — un nom de profil plus long ne doit pas déplacer ce qu'on cherche au
 * même endroit à chaque fois.
 *
 * La marge automatique tombe d'elle-même quand la barre se replie : les groupes
 * se rangent alors l'un sous l'autre, alignés à gauche.
 */
.favorites {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
  margin-left: auto;
}

/*
 * La cible se touche en roulant, et c'est mesuré.
 *
 * Elle faisait 38 pixels de haut, sous le seuil que les deux systèmes
 * recommandent — 44 chez l'un, 48 chez l'autre — pour un bouton qu'on vise d'un
 * doigt, sur une route, sans regarder longtemps. Les 6 pixels rendus coûtent
 * 0,4 % de la hauteur de l'écran de conduite, mesuré à 1 387 pixels : c'est le
 * meilleur marché du lot.
 */
.favorites button {
  min-height: 44px;
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


/*
 * Tableau de bord.
 *
 * Deux cadrans côte à côte, le rapport au-dessus entre les deux, les commandes
 * de boîte en bande dessous.
 *
 * **Le rapport a quitté la rangée** le 14 septembre 2026, sur décision de
 * David : entre les deux cadrans, il leur prenait 263 des 920 pixels
 * disponibles, et les bornait à 296 pixels de diamètre quand la place en
 * permettait 448. Un disque ne peut pas profiter de la hauteur libre — il ne
 * grandit qu'en largeur —, donc tout ce qui occupe le milieu de la rangée se
 * paie en taille de cadran.
 *
 * Les cellules n'ont ni fond ni bordure ici : les cadrans portent déjà leur
 * propre disque opaque.
 */
.dashboard {
  position: relative;
  /*
   * La rangée prend la hauteur qui reste, plein écran ou non : c'est elle qui
   * porte l'écran, tout le reste est une bande. Les cadrans, eux, restent
   * bornés par la largeur de leur colonne — un disque ne grandit pas en
   * hauteur —, et la hauteur en trop leur sert à se centrer.
   */
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  /*
   * La rangée des cadrans est élastique, celle des commandes garde sa taille :
   * ce qui reste revient aux disques.
   *
   * **Le plancher de 11 rem n'est pas décoratif.** Sans lui, la rangée se
   * comprime sans limite dès que la fenêtre est courte : mesuré sur 790 × 590,
   * le disque tombait à 106 pixels — illisible, et sans qu'on puisse faire
   * défiler pour le retrouver. Sous ce plancher, l'écran déborde et défile,
   * ce qui est le moindre mal.
   */
  grid-template-rows: minmax(11rem, 1fr) auto;
  grid-template-areas:
    'speed rpm'
    'commandes commandes';
  align-items: center;
  justify-items: center;
  gap: 0.5rem 0.75rem;
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
  min-height: 0;
  width: 100%;
  height: 100%;
}

/*
 * Le cadran remplit sa cellule et s'y inscrit sans se déformer — c'est le
 * repère du SVG qui tient ses proportions. Il prend donc la plus grande taille
 * que la largeur **et** la hauteur permettent, sans qu'aucune règle n'ait à
 * choisir laquelle des deux borne.
 */
.dashboard .dial {
  width: 100%;
  height: 100%;
  max-height: none;
}

.dashboard .speed {
  grid-area: speed;
}

.dashboard .rpm {
  grid-area: rpm;
}

/*
 * Le rapport est en haut, au milieu, **posé par-dessus** plutôt que rangé dans
 * une rangée à lui : le cadran est dessiné dans un repère plus large que son
 * disque, si bien que le haut de l'écran entre les deux est vide. Une rangée
 * propre lui aurait coûté cent pixels, pris aux disques — c'est exactement ce
 * qu'on cherchait à leur rendre.
 */
.dashboard .gear-read {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1;
}

.dashboard .commandes {
  grid-area: commandes;
  width: 100%;
  max-width: 32rem;
}

.gear-read {
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* Le rapport grandit avec l'écran : c'est l'information qu'on cherche le plus. */
.gear-value {
  font-size: clamp(2.5rem, 12vh, 9rem);
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
 * Il n'y reste que le volume : la boîte est passée dans le sélecteur, le son et
 * le verrou d'écran dans l'en-tête. La barre se replie quand la largeur manque,
 * comme celle du haut.
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

.drive.immersive {
  gap: 0.5rem;
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
 * En portrait, les cadrans s'empilent.
 *
 * Côte à côte, chacun est borné par la moitié de la largeur — 165 pixels
 * mesurés sur un téléphone de 375 —, et la hauteur libre reste vide. L'un sous
 * l'autre, ils font toute la largeur. Le rapport garde sa place en haut et les
 * commandes la leur en bas, comme en paysage : c'est la même planche de bord,
 * pas une autre disposition à apprendre.
 */
@media (max-width: 640px) {
  .dashboard {
    grid-template-columns: 1fr;
    /*
     * Même plancher qu'en paysage, et pour la même raison : sur un téléphone de
     * 375 × 812, la barre d'onglets tient sur trois lignes et ce qui reste ne
     * suffit pas à deux cadrans. Sans plancher, ils tombaient à 60 pixels de
     * diamètre.
     */
    grid-template-rows: minmax(12rem, 1fr) minmax(12rem, 1fr) auto;
    grid-template-areas:
      'speed'
      'rpm'
      'commandes';
  }

  /*
   * Empilés, les deux disques ne laissent plus de creux commun : le rapport se
   * met entre eux, à droite, là où les deux cadrans ont leur coin vide.
   */
  .dashboard .gear-read {
    top: 50%;
    left: auto;
    right: 0.5rem;
    transform: translateY(-50%);
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
