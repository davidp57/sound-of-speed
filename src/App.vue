<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import ConfigView from './ui/ConfigView.vue'
import HelpView from './ui/HelpView.vue'
import DriveView from './ui/DriveView.vue'
import TelemetryView from './ui/TelemetryView.vue'
import CalibrationPanel from './ui/CalibrationPanel.vue'
import {
  applyUpdate,
  offlineStatus,
  setBrake,
  importFromUrl,
  setThrottle,
  shiftDown,
  shiftUp,
  sourceKind,
  start,
  stop,
  isRunning,
} from './state'

type Tab = 'drive' | 'telemetry' | 'config' | 'calibration'

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
/** Nom d'un profil reçu par lien, le temps de l'annoncer. */
const received = ref('')

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
      received.value = name
      helpOpen.value = false
    }
  })

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', releaseControls)
  document.addEventListener('fullscreenchange', onFullscreenChange)
  start()
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
      <div class="right">
        <button class="help-button" title="Aide" @click="helpOpen = true">?</button>
        <button @click="toggleImmersive()">Plein écran</button>
        <button class="power" :class="{ 'is-active': isRunning }" @click="isRunning ? stop() : start()">
          {{ isRunning ? 'En marche' : 'Arrêté' }}
        </button>
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
      <DriveView v-if="tab === 'drive' || immersive" :immersive="immersive" />
      <TelemetryView v-else-if="tab === 'telemetry'" />
      <CalibrationPanel v-else-if="tab === 'calibration'" />
      <ConfigView v-else />
    </main>

    <div v-if="received" class="banner">
      <span>Profil « {{ received }} » ajouté.</span>
      <button @click="received = ''">Fermer</button>
    </div>

    <HelpView v-if="helpOpen" @close="closeHelp()" />

    <button v-if="immersive" class="escape" title="Quitter le plein écran" @click="toggleImmersive()">
      ×
    </button>
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
 * Ses six boutons tenaient sur une seule ligne quoi qu'il arrive, et ce qui
 * dépassait sortait de l'écran. Mesuré sur un téléphone de 375 pixels :
 * « En marche » était entièrement dehors — 228 pixels au-delà du bord. Il
 * fallait faire glisser la page de côté pour atteindre le bouton qui démarre et
 * coupe tout, sans que rien n'indique qu'il était là.
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

.power {
  min-width: 8rem;
}

.help-button {
  width: 2.4rem;
  padding: 0.5rem 0;
  font-weight: 600;
}

.immersive .content {
  padding: 0;
}

.escape {
  position: fixed;
  top: 0.5rem;
  right: 0.5rem;
  width: 2.2rem;
  height: 2.2rem;
  padding: 0;
  line-height: 1;
  font-size: 1.2rem;
  opacity: 0.35;
  background: transparent;
}

.escape:hover {
  opacity: 1;
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
