<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import ConfigView from './ui/ConfigView.vue'
import DriveView from './ui/DriveView.vue'
import TelemetryView from './ui/TelemetryView.vue'
import {
  setBrake,
  setThrottle,
  shiftDown,
  shiftUp,
  sourceKind,
  start,
  stop,
  isRunning,
} from './state'

type Tab = 'drive' | 'telemetry' | 'config'

const tab = ref<Tab>('drive')

const TABS: { id: Tab; label: string }[] = [
  { id: 'drive', label: 'Conduite' },
  { id: 'telemetry', label: 'Télémétrie' },
  { id: 'config', label: 'Configuration' },
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
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', releaseControls)
  start()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('blur', releaseControls)
  stop()
})
</script>

<template>
  <div class="shell">
    <header class="bar">
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
      <button class="power" :class="{ 'is-active': isRunning }" @click="isRunning ? stop() : start()">
        {{ isRunning ? 'En marche' : 'Arrêté' }}
      </button>
    </header>

    <main class="content">
      <DriveView v-if="tab === 'drive'" />
      <TelemetryView v-else-if="tab === 'telemetry'" />
      <ConfigView v-else />
    </main>
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.6rem 1rem;
  border-bottom: 1px solid var(--line);
  background: var(--panel);
}

.tabs {
  display: flex;
  gap: 0.4rem;
}

.power {
  min-width: 8rem;
}

.content {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}
</style>
