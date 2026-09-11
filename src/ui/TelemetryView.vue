<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import ValueRow from './components/ValueRow.vue'
import { computeMix } from '../core/audio/mix'
import { MotionProbe } from '../core/input/motion'
import { rpmAtSpeed } from '../core/preset/defaults'
import {
  activeProfile,
  audioStatus,
  fixRestarts,
  fixStats,
  geolocationPermissionAtStart,
  keepScreenOn,
  screenLockError,
  screenLockHeld,
  screenLockSupported,
  captureCount,
  captureDeposits,
  captureError,
  captureStatus,
  replayProgress,
  setReplayRate,
  sourceKind,
  isRunning,
  measuredCar,
  measuredCarStatus,
  restartGeolocation,
  telemetry,
} from '../state'

/**
 * Écran avancé : tout ce qui alimente le son, y compris le mixage des couches,
 * calculé ici avant même qu'un moteur audio soit branché. Régler un profil se
 * fait donc à l'œil autant qu'à l'oreille.
 */

/** État du maintien de session, en trois mots plutôt qu'en deux booléens. */
const maintien = computed(() => {
  if (!audioStatus.value.keepAlive) return 'coupé'
  return audioStatus.value.keepAlivePlaying ? 'joue' : 'arrêté'
})

/**
 * Ce que le dernier essai de lecture a donné, dit en clair.
 *
 * Les trois derniers cas signalent une plomberie qui ne marche pas, et c'est
 * tout l'intérêt de les distinguer : « rien à proposer » et « le serveur répond
 * n'importe quoi » se ressemblaient à l'écran, puisque ni l'un ni l'autre n'y
 * apparaissait.
 */
const measuredCarLabel = computed(() => {
  switch (measuredCarStatus.value) {
    case 'trouvee':
      return 'profil reçu'
    case 'absente':
      return 'rien à proposer pour l’instant'
    case 'injoignable':
      return 'serveur injoignable'
    case 'illisible':
      return 'réponse illisible'
    case 'perimee':
      return 'mesure d’un procédé plus ancien'
    default:
      return 'pas encore essayé'
  }
})

/** Ce qu'il faut aller regarder, quand il y a quelque chose à regarder. */
const measuredCarWarning = computed(() => {
  if (measuredCarStatus.value === 'illisible') {
    return 'Le serveur a répondu autre chose que la mesure attendue — l’emplacement /profils/ manque à nginx, ou le dossier n’est pas monté.'
  }
  if (measuredCarStatus.value === 'perimee') {
    return 'Le profileur ne tourne pas dans la même version que l’application.'
  }
  return ''
})

const measuredCoverage = computed(() => {
  const coverage = measuredCar.value?.coverage
  if (coverage === undefined) return ''
  return coverage.complete ? 'complète' : `il manque ${coverage.missing.join(', ')}`
})

/** La version servie à cette page, injectée à la construction. */
const appVersion = __APP_VERSION__

const replayRate = ref(1)

const mix = computed(() => computeMix(activeProfile.value, telemetry.value.engine))

const speedError = computed(
  () => telemetry.value.speed.rawKmh - telemetry.value.speed.kmh,
)

const totalRatio = computed(
  () => telemetry.value.gearbox.ratio * activeProfile.value.drivetrain.finalDrive,
)

/** Régime que donnerait chaque rapport à la vitesse courante. */
const gearLadder = computed(() => {
  const { drivetrain, engine } = activeProfile.value
  const kmh = telemetry.value.speed.kmh
  return drivetrain.gearRatios.map((ratio, index) => {
    const rpm = rpmAtSpeed(kmh, ratio, drivetrain.finalDrive, drivetrain.wheelRadiusM)
    return {
      index,
      ratio,
      rpm,
      engaged: index === telemetry.value.gearbox.gear,
      overRedline: rpm > engine.redlineRpm,
    }
  })
})

const staleFix = computed(
  () => sourceKind.value === 'geolocation' && telemetry.value.speed.sinceLastSampleMs > 3000,
)

/**
 * Intervalle typique entre deux mesures.
 *
 * La médiane, et non la moyenne : une seule interruption suffit à rendre la
 * moyenne illisible. Relevé au poste de travail sur une page mise en veille par
 * le navigateur — six intervalles de 13, 6, 66 398, 4, 19 et 1005 ms — la
 * moyenne annonçait 11 241 ms là où la médiane dit 16 ms.
 */
const sampleRate = computed(() => {
  const gaps = [...telemetry.value.speed.recentGapsMs].sort((a, b) => a - b)
  if (gaps.length === 0) return '—'
  const middle = Math.floor(gaps.length / 2)
  const median =
    gaps.length % 2 === 1
      ? (gaps[middle] ?? 0)
      : ((gaps[middle - 1] ?? 0) + (gaps[middle] ?? 0)) / 2
  return String(Math.round(median))
})

/** Ordre de grandeur des dernières précisions, arrondi : on lit en roulant. */
const recentAccuracy = computed(() =>
  fixStats.value.recentAccuracyM.map((m) => Math.round(m)).join(' · '),
)

/**
 * Ce que la page occupe réellement, en pixels CSS.
 *
 * Aucune de ces valeurs ne se déduit : le zoom du navigateur de la voiture n'est
 * pas réglable, et sa valeur par défaut a changé avec le logiciel de bord. La
 * mise en page ne peut donc être calée que sur un relevé.
 */
const pageWidth = ref(0)
const pageHeight = ref(0)
const pixelRatio = ref(1)
const screenSize = ref('—')

function readViewport(): void {
  if (typeof window === 'undefined') return
  const root = document.documentElement
  pageWidth.value = root.clientWidth
  pageHeight.value = root.clientHeight
  pixelRatio.value = window.devicePixelRatio
  screenSize.value = `${window.screen.width} × ${window.screen.height}`
}

onMounted(() => {
  readViewport()
  window.addEventListener('resize', readViewport)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', readViewport)
  window.removeEventListener('devicemotion', onMotion)
})

/** Réponse de l'API de verrou d'écran, en clair plutôt qu'en trois booléens. */
const verrou = computed(() => {
  if (!screenLockSupported) return 'API absente'
  if (!keepScreenOn.value) return 'disponible, non demandé'
  return screenLockHeld.value ? 'tenu' : 'demandé, non obtenu'
})

/**
 * L'accéléromètre : une inconnue qu'on relève avant d'écrire une source.
 *
 * L'accélération vient aujourd'hui de la vitesse GPS, qui n'arrive qu'une fois
 * par seconde ; c'est d'elle que dépendent la charge, donc le son, donc les
 * passages de rapport. Un accéléromètre la mesurerait directement — encore
 * faut-il savoir ce que la voiture en donne. Trois questions, une par ligne
 * affichée : à quelle cadence, avec ou sans la gravité, et quelle amplitude.
 *
 * L'écoute ne démarre pas toute seule : iOS exige un geste de l'utilisateur
 * pour l'autoriser, et un relevé de diagnostic n'a pas à tourner quand on ne le
 * regarde pas.
 */
type MotionPermissionApi = { requestPermission?: () => Promise<'granted' | 'denied'> }

const motionProbe = new MotionProbe()
const motionReading = ref(motionProbe.reading)
const motionStatus = ref<'absent' | 'prêt' | 'refusée' | 'écoute'>(
  typeof window !== 'undefined' && 'DeviceMotionEvent' in window ? 'prêt' : 'absent',
)
let motionLastPaint = 0
const motionError = ref('')

function vector(source: DeviceMotionEventAcceleration | null): {
  x: number
  y: number
  z: number
} | null {
  if (!source || source.x === null || source.y === null || source.z === null) return null
  return { x: source.x, y: source.y, z: source.z }
}

function onMotion(event: DeviceMotionEvent): void {
  const at = performance.now()
  motionProbe.add({
    at,
    linear: vector(event.acceleration),
    withGravity: vector(event.accelerationIncludingGravity),
    intervalMs: Number.isFinite(event.interval) ? event.interval : null,
  })
  // Les relevés arrivent jusqu'à soixante fois par seconde ; rafraîchir
  // l'affichage à cette cadence coûterait plus que la mesure ne rapporte.
  if (at - motionLastPaint < 250) return
  motionLastPaint = at
  motionReading.value = motionProbe.reading
}

async function listenToMotion(): Promise<void> {
  if (motionStatus.value === 'absent' || motionStatus.value === 'écoute') return
  const api = DeviceMotionEvent as unknown as MotionPermissionApi
  motionError.value = ''
  if (typeof api.requestPermission === 'function') {
    // Elle rejette aussi bien qu'elle refuse — hors geste de l'utilisateur, par
    // exemple. Sans ce filet, le bouton resterait sans effet et sans raison :
    // exactement le silence qu'un écran de diagnostic ne doit pas produire.
    try {
      const réponse = await api.requestPermission()
      if (réponse !== 'granted') {
        motionStatus.value = 'refusée'
        return
      }
    } catch (error) {
      motionStatus.value = 'refusée'
      motionError.value = error instanceof Error ? error.message : String(error)
      return
    }
  }
  window.addEventListener('devicemotion', onMotion)
  motionStatus.value = 'écoute'
}

/** Ce que la sonde a trouvé, en clair. */
const accéléromètre = computed(() => {
  if (motionStatus.value === 'absent') return 'API absente'
  if (motionStatus.value === 'refusée') return 'autorisation refusée'
  if (motionStatus.value === 'prêt') return 'à démarrer'
  const { count, linear } = motionReading.value
  if (count === 0) return 'écoute, aucun relevé'
  return linear ? 'relevés, sans gravité' : 'relevés, gravité comprise'
})

function fixed(value: number, digits = 1): string {
  return Number.isFinite(value) ? value.toFixed(digits) : '—'
}

/** Une mesure de la sonde, ou un tiret tant qu'elle n'a rien. */
function motionValue(value: number | null, digits = 1): string {
  return value === null ? '—' : value.toFixed(digits)
}

function onRateChange(event: Event): void {
  const value = Number((event.target as HTMLInputElement).value)
  replayRate.value = value
  setReplayRate(value)
}
</script>

<template>
  <div class="telemetry">
    <section class="panel">
      <h2>Vitesse</h2>
      <ValueRow label="Lissée" :value="fixed(telemetry.speed.kmh)" unit="km/h" />
      <ValueRow label="Brute (source)" :value="fixed(telemetry.speed.rawKmh)" unit="km/h" />
      <ValueRow
        label="Écart lissage"
        :value="fixed(speedError)"
        unit="km/h"
        hint="Retard introduit par le ressort. Un écart durablement grand veut dire que la raideur est trop faible."
      />
      <ValueRow label="Pente estimée" :value="fixed(telemetry.speed.slopeKmhS)" unit="km/h·s⁻¹" />
      <ValueRow
        label="Accélération"
        :value="fixed(telemetry.speed.accelMs2, 2)"
        unit="m/s²"
        hint="C'est elle qui sert de mesure de charge, faute de pédale."
      />
      <ValueRow label="À l'arrêt" :value="telemetry.speed.atStandstill ? 'oui' : 'non'" />
    </section>

    <section class="panel">
      <h2>Qualité du signal</h2>
      <!--
        Redemander une position **sans rien arrêter d'autre**. « P » puis « D »
        le fait déjà, mais au prix du son coupé et d'une capture scindée en deux
        sessions ; ce bouton est là pour le faire en roulant.

        Il est sur cet écran parce que c'est celui où l'on vient voir pourquoi la
        vitesse ne bouge pas — les comptes de la source sont juste en dessous, et
        ils repartent de zéro avec lui.

        Au repos, il n'a rien à faire : la boucle est arrêtée, personne ne lirait
        les positions, et ouvrir un suivi là rendrait sans effet le « D » qui
        suit — un suivi déjà ouvert ne se redemande pas.
      -->
      <div v-if="sourceKind === 'geolocation' && isRunning" class="restart">
        <button type="button" @click="restartGeolocation()">Relancer la localisation</button>
        <span class="note">
          Redemande une position sans couper le son ni scinder l'enregistrement.
          À essayer quand la vitesse reste à zéro alors que la source dit
          « actif ».
        </span>
      </div>
      <ValueRow
        label="Depuis dernière mesure"
        :value="Math.round(telemetry.speed.sinceLastSampleMs)"
        unit="ms"
        :warn="staleFix"
        hint="Au-delà de trois secondes, la vitesse affichée n'est plus qu'une extrapolation."
      />
      <ValueRow
        label="Cadence typique"
        :value="sampleRate"
        unit="ms"
        hint="Intervalle médian entre deux mesures. Il varie beaucoup d'un appareil à l'autre, et selon qu'on roule ou non : quelques dizaines de millisecondes en mouvement dans une Tesla, plusieurs secondes à l'arrêt, une seconde sur un GPS ordinaire."
      />
      <ValueRow
        label="Intervalles récents"
        :value="telemetry.speed.recentGapsMs.join(' · ') || '—'"
        unit="ms"
      />
      <ValueRow
        label="Mesures dans la fenêtre"
        :value="telemetry.speed.slopeSamples"
        hint="Nombre de mesures qui servent à estimer la pente. Plus il est grand, plus l'estimation est sûre. À deux, on est à la limite : il n'y a rien à moyenner."
      />
      <ValueRow
        label="Origine de la vitesse"
        :value="telemetry.speed.derived ? 'déduite' : 'lue'"
        :warn="telemetry.speed.derived"
        hint="« Lue » : le navigateur donne la vitesse. « Déduite » : il ne la donne pas, et elle est calculée depuis la distance entre deux positions — ce qui demande deux positions assez espacées, et rend le suivi plus fragile."
      />
      <template v-if="sourceKind === 'geolocation'">
        <ValueRow
          label="Positions reçues"
          :value="fixStats.received"
          hint="Ce que le navigateur a livré depuis le démarrage du suivi."
        />
        <ValueRow
          label="Vitesses produites"
          :value="fixStats.emitted"
          :warn="fixStats.received > 20 && fixStats.emitted === 0"
          hint="Ce qui en est ressorti. À vitesse déduite, il en faut deux positions assez espacées pour en tirer une : l'écart est normal. Un compte à zéro alors que les positions arrivent veut dire que la source ne délivre plus rien, et c'est ce défaut-là qui immobilisait la vitesse."
        />
        <ValueRow
          label="Précision annoncée"
          :value="fixStats.lastAccuracyM === null ? '—' : Math.round(fixStats.lastAccuracyM)"
          unit="m"
          :warn="
            fixStats.lastAccuracyM !== null &&
            fixStats.lastAccuracyM > activeProfile.speed.maxAccuracyM
          "
          hint="Incertitude que le navigateur donne avec la dernière position, rejetée ou non. C'est ce chiffre qui décide du seuil « Précision GPS acceptée » : le relever en roulant, puis resserrer le seuil sur ce qu'on a vu. Un tiret veut dire que le navigateur ne renseigne pas le champ — rien n'est alors filtré là-dessus."
        />
        <ValueRow
          label="Précisions récentes"
          :value="recentAccuracy || '—'"
          unit="m"
          hint="Les douze dernières, de la plus ancienne à la plus récente. Une valeur isolée ne dit rien ; c'est l'ordre de grandeur, et sa dispersion, qui disent où placer le seuil."
        />
        <ValueRow
          label="Rejets"
          :value="`${fixStats.implausible} aberrantes · ${fixStats.tooClose} trop proches · ${fixStats.inaccurate} imprécises`"
          :warn="fixStats.received > 20 && fixStats.inaccurate === fixStats.received"
          hint="Les aberrantes dépassent la vitesse plausible et ne sont pas transmises. Les trop proches n'ont pas assez d'écart avec la position de référence, qui est alors conservée en attendant la suivante. Les imprécises dépassent la précision acceptée : ni mesure, ni référence. Si tout part en imprécises, le seuil est trop serré."
        />
      </template>
      <ValueRow label="Durée d'image" :value="fixed(telemetry.frameMs)" unit="ms" />
    </section>

    <section class="panel">
      <h2>Moteur</h2>
      <ValueRow
        label="Régime"
        :value="Math.round(telemetry.engine.rpm)"
        unit="tr/min"
        :bar="telemetry.engine.rpmFraction"
        :warn="telemetry.engine.limiterActive"
      />
      <ValueRow
        label="Régime entendu"
        :value="Math.round(telemetry.engine.audibleRpm)"
        unit="tr/min"
        hint="Le régime plus le tremblement, seul à fixer les vitesses de lecture. Il s'écarte du régime de quelques dizaines de tours au ralenti, de quelques-uns en haut des tours. C'est le seul endroit où le tremblement se voit : la boîte et ses seuils gardent le régime net."
      />
      <ValueRow
        label="Régime cinématique"
        :value="Math.round(telemetry.engine.kinematicRpm)"
        unit="tr/min"
        hint="Ce qu'imposent les roues, avant inertie et rupteur."
      />
      <ValueRow
        label="Fréquence d'allumage"
        :value="fixed(telemetry.engine.firingHz)"
        unit="Hz"
        hint="Régime ÷ 120 × cylindres. C'est la hauteur fondamentale du son."
      />
      <ValueRow
        label="Charge"
        :value="fixed(telemetry.engine.load, 3)"
        :bar="telemetry.engine.load"
        hint="L'intention : demande-t-on de l'accélération ? C'est elle que lit la boîte, et elle ne dépend pas de la vitesse."
      />
      <ValueRow
        label="Effort"
        :value="fixed(telemetry.engine.effort, 3)"
        :bar="telemetry.engine.effort"
        hint="Le travail du moteur : l'accélération plus la traînée à vaincre, laquelle croît avec le carré de la vitesse. C'est lui que le son suit — le timbre et le niveau."
      />
      <ValueRow label="Rupteur" :value="telemetry.engine.limiterActive ? 'actif' : '—'" :warn="telemetry.engine.limiterActive" />
      <ValueRow label="Au ralenti" :value="telemetry.engine.idling ? 'oui' : 'non'" />
    </section>

    <section class="panel">
      <h2>Transmission</h2>
      <ValueRow label="Rapport" :value="telemetry.gearbox.label" />
      <ValueRow label="Mode" :value="telemetry.gearbox.mode === 'auto' ? 'automatique' : 'manuel'" />
      <ValueRow label="Démultiplication" :value="fixed(telemetry.gearbox.ratio, 2)" />
      <ValueRow label="Rapport total" :value="fixed(totalRatio, 2)" hint="Boîte × pont." />
      <ValueRow
        label="Passage en cours"
        :value="telemetry.gearbox.isShifting ? `${Math.round(telemetry.gearbox.shiftProgress * 100)} %` : '—'"
        :bar="telemetry.gearbox.isShifting ? telemetry.gearbox.shiftProgress : undefined"
      />
      <ValueRow
        label="Montée en attente"
        :value="telemetry.gearbox.isShiftReady ? 'oui' : '—'"
        hint="La condition est remplie, la temporisation du rapport court encore."
      />

      <table class="ladder">
        <thead>
          <tr>
            <th>Rapport</th>
            <th>Démult.</th>
            <th>Régime à la vitesse actuelle</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="entry in gearLadder" :key="entry.index" :class="{ engaged: entry.engaged }">
            <td>{{ entry.index + 1 }}</td>
            <td class="numeric">{{ entry.ratio.toFixed(2) }}</td>
            <td class="numeric" :class="{ over: entry.overRedline }">
              {{ Math.round(entry.rpm) }} tr/min
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="panel">
      <h2>Son</h2>
      <ValueRow label="État" :value="audioStatus.phase" :warn="audioStatus.phase === 'error'" />
      <ValueRow label="Contexte" :value="audioStatus.contextState" />
      <ValueRow
        label="Échantillonnage"
        :value="audioStatus.sampleRate || '—'"
        :unit="audioStatus.sampleRate ? 'Hz' : ''"
      />
      <ValueRow
        label="Horloge audio"
        :value="audioStatus.clockRunning ? 'fil audio' : 'affichage'"
        hint="Sur le fil audio, la cadence survit à l'écran éteint. Sur l'affichage, elle est gelée en arrière-plan."
        :warn="audioStatus.phase === 'ready' && !audioStatus.clockRunning"
      />
      <ValueRow
        label="Latence de sortie"
        :value="audioStatus.outputLatencyMs > 0 ? audioStatus.outputLatencyMs.toFixed(0) : 'non communiquée'"
        :unit="audioStatus.outputLatencyMs > 0 ? 'ms' : ''"
        :warn="audioStatus.outputLatencyMs > 120"
        hint="Délai entre la demande d'un son et sa sortie du haut-parleur. Aucun code ne peut l'annuler : une liaison sans fil y ajoute couramment 100 à 300 ms."
      />
      <ValueRow
        label="Latence de traitement"
        :value="audioStatus.baseLatencyMs.toFixed(1)"
        unit="ms"
      />
      <ValueRow label="Couches chargées" :value="`${audioStatus.loaded} / ${audioStatus.total}`" />
      <ValueRow label="Pétarades" :value="audioStatus.backfires" hint="Salves déclenchées depuis l'activation du son." />
      <ValueRow label="Clacs de boîte" :value="audioStatus.clacks" hint="Chocs mécaniques joués depuis l'activation du son. Le compteur monte à chaque passage de rapport : s'il monte sans qu'on entende rien, c'est le niveau qui est en cause, pas le déclenchement." />
      <ValueRow
        label="Sources en lecture"
        :value="audioStatus.activeSources"
        hint="Une par couche, brièvement deux pendant un renouvellement de position. Durablement au-dessus du nombre de couches, c'est qu'un fondu ne s'est pas refermé."
      />
      <ValueRow
        label="Renouvellements"
        :value="audioStatus.layerRefreshes"
        hint="Sauts de position de lecture depuis l'activation du son. À zéro alors que le réglage n'est pas nul, le renouvellement ne tourne pas."
      />
      <ValueRow
        label="Niveau de sortie"
        :value="audioStatus.outputLevel.toFixed(4)"
        :bar="audioStatus.outputLevel * 4"
        hint="Valeur efficace mesurée après le limiteur. À zéro alors que le son est actif, c'est que tous les gains sont retombés."
      />
      <ValueRow
        label="Crête"
        :value="audioStatus.outputPeak.toFixed(3)"
        :bar="audioStatus.outputPeak"
        :warn="audioStatus.outputPeak >= 0.999"
        hint="À 1,000, la sortie écrête : baisser le volume général."
      />
      <ValueRow
        label="Boucles recollées"
        :value="audioStatus.repaired.join(', ') || '—'"
        hint="Échantillons dont les extrémités ne se rejoignaient pas : un fondu a été appliqué pour supprimer le clic."
      />
      <ValueRow v-if="audioStatus.error" label="Erreur" :value="audioStatus.error" warn />
    </section>

    <!--
      Ce bloc n'existe que pour un essai en voiture : le son s'arrêtait net dès
      que le navigateur de bord était réduit, et rien ne disait pourquoi. Aucune
      de ces valeurs ne se lit dans une console — on conduit.
    -->
    <section class="panel">
      <h2>Arrière-plan</h2>
      <ValueRow
        label="Maintien de session"
        :value="maintien"
        :warn="audioStatus.keepAlive && !audioStatus.keepAlivePlaying"
        hint="Un média silencieux joue en boucle pour que le système ne libère pas la session audio quand la page passe en arrière-plan. S'il est arrêté alors qu'il est demandé, c'est là qu'est le problème."
      />
      <ValueRow
        v-if="audioStatus.keepAliveError"
        label="Refus du navigateur"
        :value="audioStatus.keepAliveError"
        warn
      />
      <ValueRow
        label="Reprises du contexte"
        :value="audioStatus.contextResumes"
        :warn="audioStatus.contextResumes > 0"
        hint="Nombre de fois qu'il a fallu relancer le contexte audio depuis l'activation. À zéro, le système ne l'a jamais suspendu — et la surveillance périodique ne sert à rien."
      />
      <ValueRow
        label="Relances du suivi"
        :value="fixRestarts"
        :warn="fixRestarts > 0"
        hint="Le suivi GPS est relancé quand il se tait plus de vingt secondes : sans cela le son se figerait sur la dernière vitesse connue."
      />
    </section>

    <!--
      Ce bloc répond à des questions qu'aucun code ne peut deviner : la place
      dont la page dispose dans le navigateur de la voiture, dont le zoom n'est
      pas réglable, ce que l'API de verrou d'écran répond vraiment, et si
      l'autorisation de géolocalisation survit d'une session à l'autre. On les
      relève en roulant, puis on règle.
    -->
    <section class="panel">
      <h2>Appareil</h2>
      <ValueRow
        label="Version"
        :value="appVersion"
        hint="La version servie à cette page. Dans la voiture, où un service worker garde un cache et où il n'y a pas de console, c'est le seul moyen de savoir si l'on essaie bien ce qu'on croit essayer."
      />
      <ValueRow
        label="Largeur utile"
        :value="pageWidth"
        unit="px"
        :warn="pageWidth > 0 && pageWidth < 360"
        hint="Largeur de la page en pixels CSS, celle que voit la mise en page. Les panneaux font 21 rem, soit 336 px : en dessous de 360, ils ne tiennent plus côte à côte et la page se réduit à une colonne."
      />
      <ValueRow label="Hauteur utile" :value="pageHeight" unit="px" />
      <ValueRow
        label="Écran annoncé"
        :value="screenSize"
        unit="px"
        hint="Ce que le navigateur déclare pour l'écran. Comparé à la largeur utile, il situe le zoom : sans zoom et sans marge, les deux se rejoignent."
      />
      <ValueRow
        label="Densité de pixels"
        :value="fixed(pixelRatio, 2)"
        hint="Pixels physiques par pixel CSS. Un zoom du navigateur s'y répercute aussi."
      />
      <ValueRow
        label="Verrou d'écran"
        :value="verrou"
        :warn="!screenLockSupported || (keepScreenOn && !screenLockHeld)"
        hint="Ce que répond l'API de maintien d'écran allumé. « API absente » : le navigateur ne la fournit pas, l'écran s'éteindra. « Demandé, non obtenu » : elle existe et a refusé — la raison est en dessous."
      />
      <ValueRow
        v-if="screenLockError"
        label="Raison du refus"
        :value="screenLockError"
        warn
      />
      <ValueRow
        label="Autorisation GPS à l'ouverture"
        :value="geolocationPermissionAtStart"
        :warn="geolocationPermissionAtStart === 'refusée'"
        hint="État relevé au chargement de la page, avant tout suivi. « Accordée » sans avoir rien demandé cette fois-ci veut dire que la voiture retient l'autorisation d'une session à l'autre ; « à demander » qu'il faut la redonner à chaque fois."
      />
      <ValueRow
        label="Accéléromètre"
        :value="accéléromètre"
        :warn="motionStatus === 'absent' || motionStatus === 'refusée'"
        hint="L'accélération est aujourd'hui déduite de la vitesse GPS, qui n'arrive qu'une fois par seconde. Un accéléromètre la mesurerait. « Gravité comprise » veut dire qu'il faudrait connaître l'orientation du téléphone pour s'en servir."
      />
      <ValueRow v-if="motionError" label="Raison du refus" :value="motionError" warn />
      <p v-if="motionStatus === 'prêt' || motionStatus === 'refusée'" class="note">
        <button type="button" @click="listenToMotion">Écouter l'accéléromètre</button>
        L'écoute demande une autorisation sur certains téléphones, et ne démarre
        donc pas seule.
      </p>
      <template v-if="motionStatus === 'écoute'">
        <ValueRow
          label="Cadence mesurée"
          :value="motionValue(motionReading.hz)"
          unit="Hz"
          hint="Relevés reçus par seconde, mesurés sur les cinq dernières secondes. À comparer au 1 Hz du GPS."
        />
        <ValueRow
          label="Intervalle annoncé"
          :value="motionValue(motionReading.announcedMs, 0)"
          unit="ms"
          hint="Ce que l'appareil déclare, qui n'est pas toujours ce qu'il tient."
        />
        <ValueRow
          label="Accélération crête"
          :value="motionValue(motionReading.peakMs2, 2)"
          unit="m/s²"
          hint="Norme la plus forte sur les cinq dernières secondes, gravité exclue. Vide si l'appareil ne sépare pas la gravité."
        />
        <ValueRow
          label="Accélération moyenne"
          :value="motionValue(motionReading.meanMs2, 2)"
          unit="m/s²"
        />
      </template>
    </section>

    <section class="panel wide">
      <h2>Mixage des couches</h2>
      <p class="note">
        Volume et vitesse de lecture de chaque son, à cet instant. La mention
        « bornée » signale un son étiré au-delà de ce qu'il supporte : il faut alors
        soit ajouter un enregistrement, soit rapprocher les régimes de référence.
      </p>
      <table class="layers">
        <thead>
          <tr>
            <th>Couche</th>
            <th>Rôle</th>
            <th>Gain</th>
            <th>Lecture</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="layer in mix.layers" :key="layer.key">
            <td>{{ layer.key }}</td>
            <td class="muted">{{ layer.role }}</td>
            <td class="numeric">{{ layer.gain.toFixed(3) }}</td>
            <td class="numeric">×{{ layer.rate.toFixed(3) }}</td>
            <td>
              <span v-if="layer.rateClamped" class="tag">bornée</span>
            </td>
          </tr>
        </tbody>
      </table>
      <div class="weights">
        <ValueRow label="Poids en charge" :value="mix.onWeight.toFixed(3)" :bar="mix.onWeight" />
        <ValueRow label="Poids pied levé" :value="mix.offWeight.toFixed(3)" :bar="mix.offWeight" />
        <ValueRow label="Poids ralenti" :value="mix.idleWeight.toFixed(3)" :bar="mix.idleWeight" />
      </div>
    </section>

    <section class="panel wide">
      <h2>Capture du trajet</h2>
      <p class="note">
        La capture démarre toute seule au démarrage du GPS, si la remontée est
        au dernier cran. Elle enregistre ce que la source livre et ce que la
        chaîne en fait, et la dépose par tranches pendant qu'on roule : c'est
        avec elle qu'on rejoue un trajet au bureau.
      </p>

      <p class="capture-state" :class="captureStatus.state">{{ captureStatus.why }}</p>

      <ValueRow label="Relevés retenus" :value="String(captureCount)" />
      <ValueRow label="Tranches déposées" :value="String(captureDeposits.length)" />
      <ValueRow
        v-if="captureDeposits.length"
        label="Dernière tranche"
        :value="captureDeposits[captureDeposits.length - 1]?.name ?? ''"
      />
      <p v-if="captureError" class="error">{{ captureError }}</p>

      <template v-if="sourceKind === 'replay'">
        <ValueRow label="Progression" :value="`${Math.round(replayProgress * 100)} %`" :bar="replayProgress" />
        <label class="rate">
          Vitesse de rejeu : ×<span class="numeric">{{ replayRate.toFixed(1) }}</span>
          <input type="range" min="0.25" max="4" step="0.25" :value="replayRate" @input="onRateChange" />
        </label>
      </template>
    </section>

    <!--
      Ce que le serveur a mesuré de la voiture.

      La section existe pour une raison précise : le 11 septembre 2026, la
      chaîne était coupée et rien ne le disait. Une absence de mesure et une
      plomberie cassée se ressemblaient à l'écran — c'est-à-dire qu'aucune des
      deux ne s'y voyait.
    -->
    <section class="panel">
      <h2>Profil mesuré</h2>
      <p class="note">
        Le serveur relit les traces déposées et en tire le profil de la vraie
        voiture. Quand il a de quoi conclure, l'écran de conduite le propose.
      </p>

      <ValueRow label="Dernier essai" :value="measuredCarLabel" />
      <ValueRow
        v-if="measuredCar"
        label="Trajets mesurés"
        :value="String(measuredCar.aggregate.tripCount)"
      />
      <ValueRow v-if="measuredCar" label="Couverture" :value="measuredCoverage" />
      <p v-if="measuredCarWarning" class="error">{{ measuredCarWarning }}</p>
    </section>

    <!--
      L'étalonnage vit dans cet écran plutôt que dans un onglet à lui : il n'a
      pas de raison d'être visible en conduisant. Il garde son propre
      enregistrement, borné par étape — délimiter une mesure n'est pas capturer
      une session, et une étape mal bornée donne une mesure fausse.
    -->
  </div>
</template>

<style scoped>
.telemetry {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(21rem, 1fr));
  gap: 1rem;
  align-items: start;
  max-width: 80rem;
  margin: 0 auto;
}


/* Le recours tient sur une ligne, et dit quand s'en servir. */
.restart {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
}

.restart .note {
  flex: 1;
  min-width: 14rem;
  color: var(--muted);
  font-size: 0.85rem;
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

.note {
  color: var(--muted);
  font-size: 0.85rem;
  margin: 0 0 0.7rem;
}

/* La même échelle de couleurs que le témoin de l'écran de conduite. */
.capture-state {
  margin: 0 0 0.7rem;
  font-size: 0.9rem;
}

.capture-state.ok {
  color: #2e7d32;
}

.capture-state.warn {
  color: #ef6c00;
}

.capture-state.bad,
.capture-state.off {
  color: var(--muted);
}

.capture-state.bad {
  color: #c62828;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 0.6rem;
}

th {
  text-align: left;
  color: var(--muted);
  font-weight: 500;
  font-size: 0.8rem;
  padding-bottom: 0.3rem;
}

td {
  padding: 0.25rem 0;
  border-top: 1px solid var(--line);
}

td.numeric,
th:nth-child(n + 3) {
  text-align: right;
}

.ladder tr.engaged td {
  color: var(--accent);
  font-weight: 600;
}

td.over {
  color: var(--warn);
}

.muted {
  color: var(--muted);
}

.tag {
  background: var(--warn);
  color: #1a0f0a;
  border-radius: 4px;
  padding: 0.05rem 0.35rem;
  font-size: 0.75rem;
}

.weights {
  margin-top: 0.8rem;
}

.trace-controls {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.trace-controls input {
  flex: 1;
}

.trace-controls button {
  white-space: nowrap;
}

.trace-list {
  list-style: none;
  margin: 0.8rem 0;
  padding: 0;
}

.trace-list li {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.35rem 0;
  border-top: 1px solid var(--line);
}

.trace-list li span:first-child {
  flex: 1;
}

.error {
  color: var(--warn);
  margin: 0.5rem 0 0;
}

.rate {
  display: block;
  color: var(--muted);
  margin-top: 0.6rem;
}
</style>
