<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import ConfigView from './ui/ConfigView.vue'
import HelpView from './ui/HelpView.vue'
import DriveView from './ui/DriveView.vue'
import TelemetryView from './ui/TelemetryView.vue'
import CalibrationPanel from './ui/CalibrationPanel.vue'
import SynthView from './ui/SynthView.vue'
import BenchView from './ui/BenchView.vue'
import {
  applyUpdate,
  offlineStatus,
  simulatorAvailable,
  synthAvailable,
  setBrake,
  importFromUrl,
  liaison,
  setThrottle,
  shiftDown,
  shiftUp,
  sourceKind,
  stop,
  activateAudio,
  refreshMeasuredCar,
  keepScreenOn,
  screenLockHeld,
  screenLockSupported,
  setKeepScreenOn,
  setMuted,
  soundState,
} from './state'

/**
 * Ce que dit le bouton du son, dans chacun de ses états.
 *
 * « Son pris par une autre application » est le cas qui manquait : la musique
 * de la voiture suspend notre contexte audio, et le bouton annonçait alors
 * « Activer le son » alors que personne ne l'avait coupé. Le geste le rend — et
 * il faut bien un geste, les navigateurs refusant de reprendre autrement.
 */
const SOUND_TITLES: Record<string, string> = {
  loading: 'Son en chargement',
  error: 'Son en erreur',
  off: 'Activer le son',
  muted: 'Son coupé — toucher pour le rendre',
  taken: 'Son pris par une autre application — toucher pour le rendre',
  on: 'Son actif — toucher pour le couper',
}

function toggleSound(): void {
  if (soundState.value === 'on') setMuted(true)
  else if (soundState.value === 'muted') setMuted(false)
  else void activateAudio()
}

type Tab = 'drive' | 'telemetry' | 'config' | 'calibration' | 'synth' | 'bench'

const tab = ref<Tab>('drive')

/**
 * Mode plein écran.
 *
 * Sur un écran de bord, tout ce qui n'est pas la vitesse, le rapport et le régime
 * est du bruit — et une barre d'onglets est une invitation à toucher l'écran en
 * roulant. Ce mode l'escamote, agrandit les chiffres et élargit les cibles
 * tactiles. On en sort par une zone volontairement discrète, pour ne pas en
 * sortir par accident.
 */
const immersive = ref(false)

/**
 * Aide, montrée d'office à la première ouverture.
 *
 * Le stockage peut être refusé — navigation privée, quota plein. On ne montre
 * alors l'aide qu'une fois par session plutôt que de la répéter à chaque
 * chargement, ni de la taire par prudence.
 */
const HELP_SEEN_KEY = 'speed.helpSeen.v1'
const helpOpen = ref(false)
/** Message d'un profil reçu par lien, le temps de l'annoncer. */
const received = ref('')

/**
 * Ce qu'on dit à l'appareil qui vient d'arriver par un code scanné.
 *
 * Le cas qui mérite d'être annoncé est le compte **gardé** : cet appareil
 * portait déjà des réglages, ils ne suivent pas, et ce compte-là n'a pas de mot
 * de passe pour y revenir. Le taire le ferait découvrir plus tard.
 */
const liaisonVue = ref(false)
const messageDeLiaison = computed(() => {
  const faite = liaison.value
  if (liaisonVue.value || faite === null) return ''
  if (faite.etat === 'sans-reseau') {
    return 'Sans réseau : cet appareil n’a pas pu rejoindre le compte. Rouvrir le lien une fois connecté.'
  }
  if (faite.etat === 'refusee') return faite.detail
  if (faite.ancien === 'garde') {
    return 'Cet appareil a rejoint le compte. Ce qu’il portait avant reste sur son ancien compte, qui n’a pas de mot de passe pour y revenir.'
  }
  return 'Cet appareil a rejoint le compte : ses profils, ses moteurs et ses boîtes arrivent.'
})

function markHelpSeen(): void {
  try {
    localStorage.setItem(HELP_SEEN_KEY, '1')
  } catch {
    // Sans conséquence : l'aide reste accessible par son bouton.
  }
}

function closeHelp(): void {
  helpOpen.value = false
  markHelpSeen()
}

async function toggleImmersive(): Promise<void> {
  immersive.value = !immersive.value
  try {
    if (immersive.value && !document.fullscreenElement) {
      await document.documentElement.requestFullscreen()
    } else if (!immersive.value && document.fullscreenElement) {
      await document.exitFullscreen()
    }
  } catch {
    // Plein écran refusé — c'est courant sur un navigateur embarqué. La mise en
    // page immersive s'applique quand même, ce qui est l'essentiel.
  }
}

/** Sortie du plein écran par la touche d'échappement du navigateur. */
function onFullscreenChange(): void {
  if (!document.fullscreenElement && immersive.value) immersive.value = false
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'drive', label: 'Conduite' },
  { id: 'telemetry', label: 'Télémétrie' },
  { id: 'config', label: 'Configuration' },
  { id: 'calibration', label: 'Étalonnage' },
  // Les deux écrans de banc, absents de la production. Ils ont leur propre page
  // depuis le 8 septembre 2026 : leurs commandes vivaient sous les cadrans de
  // l'écran de conduite, où elles prenaient la place de ce qu'on lit en roulant.
  ...(synthAvailable ? [{ id: 'synth' as Tab, label: 'Synthèse' }] : []),
  ...(simulatorAvailable ? [{ id: 'bench' as Tab, label: 'Banc' }] : []),
]

/**
 * Commandes clavier du simulateur.
 *
 * Elles ne sont actives que lorsque la source est le simulateur, et jamais
 * pendant la saisie dans un champ — sinon taper « 3 » dans l'écran de
 * configuration donnerait un coup d'accélérateur.
 */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || target.isContentEditable
}

function onKeyDown(event: KeyboardEvent): void {
  if (isTyping(event.target) || event.repeat) return

  switch (event.key) {
    case 'ArrowUp':
      if (sourceKind.value === 'simulator') {
        event.preventDefault()
        setThrottle(1)
      }
      break
    case 'ArrowDown':
      if (sourceKind.value === 'simulator') {
        event.preventDefault()
        setBrake(1)
      }
      break
    case 'ArrowRight':
      event.preventDefault()
      shiftUp()
      break
    case 'ArrowLeft':
      event.preventDefault()
      shiftDown()
      break
    default:
      break
  }
}

function onKeyUp(event: KeyboardEvent): void {
  if (isTyping(event.target)) return
  if (event.key === 'ArrowUp') setThrottle(0)
  if (event.key === 'ArrowDown') setBrake(0)
}

/** Perdre le focus de la fenêtre laisserait l'accélérateur enfoncé. */
function releaseControls(): void {
  setThrottle(0)
  setBrake(0)
}

onMounted(() => {
  try {
    helpOpen.value = localStorage.getItem(HELP_SEEN_KEY) === null
  } catch {
    helpOpen.value = true
  }
  // Un profil reçu par lien s'installe avant tout le reste, et le signale.
  void importFromUrl().then((name) => {
    if (name) {
      received.value = `Profil « ${name} » ajouté.`
      helpOpen.value = false
    }
  })

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', releaseControls)
  document.addEventListener('fullscreenchange', onFullscreenChange)
  // Ce que le serveur a mesuré de la voiture. Sans réseau ni serveur, il ne se
  // passe rien : c'est une proposition, pas une dépendance.
  void refreshMeasuredCar()
  // L'application s'ouvre **au repos**, et c'est le propos du sélecteur.
  //
  // Elle démarrait la géolocalisation ici même, sans qu'on ait rien touché.
  // Le 11 septembre 2026, elle n'a reçu que des positions annoncées à
  // 9 999,99 m de précision — la sentinelle d'un navigateur qui n'en sert pas
  // de vraie — pendant tout un trajet, et trois relances n'y ont rien changé.
  // Ce qui a fonctionné est un appui sur un bouton, dans une autre version de
  // l'application. Partir de « P » met ce geste au début de chaque trajet.
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('blur', releaseControls)
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  stop()
})
</script>

<template>
  <div class="shell" :class="{ immersive }">
    <header v-if="!immersive" class="bar">
      <nav class="tabs">
        <button
          v-for="entry in TABS"
          :key="entry.id"
          :aria-pressed="tab === entry.id"
          @click="tab = entry.id"
        >
          {{ entry.label }}
        </button>
      </nav>
      <!--
        Le son et le verrou d'écran sont **là-haut**, avec l'aide et le plein
        écran : ce sont des commandes d'appareil, pas de conduite. Les laisser
        entre les cadrans chargeait la seule zone qui doit se lire en roulant.
      -->
      <div class="right">
        <button
          class="icon-button"
          :class="{ 'is-active': soundState === 'on', 'is-warn': soundState === 'taken' }"
          :title="SOUND_TITLES[soundState]"
          :aria-label="SOUND_TITLES[soundState]"
          :aria-pressed="soundState === 'on'"
          @click="toggleSound()"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z" />
            <template v-if="soundState === 'on'">
              <path d="M16 9.2a4 4 0 0 1 0 5.6" />
              <path d="M18.6 6.6a7.6 7.6 0 0 1 0 10.8" />
            </template>
            <template v-else>
              <path d="M16.5 9.5l5 5" />
              <path d="M21.5 9.5l-5 5" />
            </template>
          </svg>
        </button>
        <button
          v-if="screenLockSupported"
          class="icon-button"
          :class="{ 'is-active': keepScreenOn && screenLockHeld, 'is-warn': keepScreenOn && !screenLockHeld }"
          :title="keepScreenOn ? 'Écran gardé allumé' : 'Laisser l’écran s’éteindre'"
          :aria-label="keepScreenOn ? 'Écran gardé allumé' : 'Laisser l’écran s’éteindre'"
          :aria-pressed="keepScreenOn"
          @click="setKeepScreenOn(!keepScreenOn)"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3.5" y="4.5" width="17" height="12" rx="1.5" />
            <path d="M9 20h6" />
          </svg>
        </button>
        <button class="help-button" title="Aide" @click="helpOpen = true">?</button>
        <button @click="toggleImmersive()">Plein écran</button>
      </div>
    </header>

    <div v-if="offlineStatus.updateReady" class="banner">
      <span>Une nouvelle version est prête.</span>
      <button @click="applyUpdate()">Recharger</button>
    </div>
    <div v-else-if="!offlineStatus.online" class="banner offline">
      Hors réseau — l'application tourne sur ce qui est en cache.
    </div>

    <main class="content">
      <DriveView
        v-if="tab === 'drive' || immersive"
        :immersive="immersive"
        @exit="toggleImmersive()"
      />
      <TelemetryView v-else-if="tab === 'telemetry'" />
      <CalibrationPanel v-else-if="tab === 'calibration'" />
      <SynthView v-else-if="tab === 'synth' && synthAvailable" />
      <BenchView v-else-if="tab === 'bench' && simulatorAvailable" />
      <ConfigView v-else />
    </main>

    <div v-if="received" class="banner">
      <span>{{ received }}</span>
      <button @click="received = ''">Fermer</button>
    </div>

    <div v-if="messageDeLiaison" class="banner">
      <span>{{ messageDeLiaison }}</span>
      <button @click="liaisonVue = true">Fermer</button>
    </div>

    <HelpView v-if="helpOpen" @close="closeHelp()" />

  </div>
</template>

<style scoped>
.shell {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/*
 * La barre se replie quand la place manque.
 *
 * Ses boutons tenaient sur une seule ligne quoi qu'il arrive, et ce qui
 * dépassait sortait de l'écran. Mesuré sur un téléphone de 375 pixels, à
 * l'époque où le bouton de marche vivait ici : il était entièrement dehors —
 * 228 pixels au-delà du bord. Il fallait faire glisser la page de côté pour
 * atteindre ce qui démarre et coupe tout, sans que rien n'indique qu'il était
 * là. Ce bouton est depuis passé dans le sélecteur, entre les cadrans, et la
 * barre s'est allégée d'autant ; les mesures ci-dessous datent d'avant ce
 * déplacement et décrivent donc un cas plus serré que l'actuel.
 *
 * L'écran de la voiture est large : le défaut ne s'y produisait pas, ce qui
 * explique qu'il ait vécu longtemps sans se voir.
 *
 * Le repli plutôt que des libellés raccourcis ou des onglets qui glissent :
 * c'est le seul remède qui ne cache rien.
 *
 * **Ce que le repli coûte, mesuré** : il remplace la compression. Sans lui, le
 * navigateur resserrait les deux groupes pour les faire tenir — jusqu'à 603
 * pixels, au-delà desquels il débordait. Avec lui, les groupes gardent leur
 * taille et passent à la ligne dès que la barre descend sous 655 pixels. Entre
 * 603 et 655, il y a donc maintenant deux lignes là où il y en avait une,
 * resserrée. C'est le prix, et il est petit : la barre passe de 58 à 111 pixels
 * de haut sur un téléphone, et rien ne change au-delà de 655.
 */
.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
  padding: 0.6rem 1rem;
  border-bottom: 1px solid var(--line);
  background: var(--panel);
}

.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

/*
 * Poussé à droite même quand il se retrouve seul sur sa ligne : la répartition
 * de la barre le collerait sinon au bord gauche, sous les onglets, alors que
 * les commandes sont à droite quand tout tient sur une ligne. Deux dispositions
 * pour les mêmes boutons se cherchent du regard.
 */
.right {
  display: flex;
  gap: 0.4rem;
  margin-left: auto;
}

/* Les commandes d'appareil : une icône chacune, même gabarit que l'aide. */
.icon-button {
  width: 2.6rem;
  padding: 0.45rem 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-button svg {
  width: 1.35rem;
  height: 1.35rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.icon-button.is-warn {
  border-color: var(--warn);
  color: var(--warn);
}

.help-button {
  width: 2.4rem;
  padding: 0.5rem 0;
  font-weight: 600;
}

.immersive .content {
  padding: 0;
}

.banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 0.45rem 1rem;
  background: var(--accent);
  color: #17130a;
  font-size: 0.9rem;
}

.banner button {
  background: rgba(0, 0, 0, 0.25);
  border-color: transparent;
  color: inherit;
  padding: 0.2rem 0.7rem;
}

.banner.offline {
  background: var(--panel-alt);
  color: var(--muted);
}

.content {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}
</style>
