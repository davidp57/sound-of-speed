<script setup lang="ts">
import { computed, ref } from 'vue'

import {
  activeProfile,
  isRunning,
  setBrake,
  setShiftMode,
  setSimulatedSpeed,
  setSource,
  setThrottle,
  shiftDown,
  shiftUp,
  sourceDetail,
  sourceKind,
  sourceStatus,
  telemetry,
  type SourceKind,
} from '../state'

const SOURCES: { id: SourceKind; label: string }[] = [
  { id: 'simulator', label: 'Simulateur' },
  { id: 'geolocation', label: 'GPS' },
  { id: 'replay', label: 'Rejeu' },
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
const sliderSpeed = ref(0)

function onSlider(event: Event): void {
  const value = Number((event.target as HTMLInputElement).value)
  sliderSpeed.value = value
  setSimulatedSpeed(value)
}

const rpmPercent = computed(() => {
  const { rpm } = telemetry.value.engine
  const redline = activeProfile.value.engine.redlineRpm
  return Math.round((rpm / Math.max(1, redline)) * 100)
})
</script>

<template>
  <div class="drive">
    <section class="sources">
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

    <section class="readout">
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

    <section class="controls">
      <div class="group">
        <span class="label">Boîte</span>
        <button :aria-pressed="!manual" @click="setShiftMode('auto')">Auto</button>
        <button :aria-pressed="manual" @click="setShiftMode('manual')">Manuelle</button>
        <button :disabled="!manual" @click="shiftDown()">−</button>
        <button :disabled="!manual" @click="shiftUp()">+</button>
      </div>

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
          Vitesse imposée : <span class="numeric">{{ sliderSpeed }}</span> km/h
          <input type="range" min="0" max="220" step="1" :value="sliderSpeed" @input="onSlider" />
        </label>
        <p class="hint">
          Au clavier : flèches haut et bas pour l'accélérateur et le frein, flèches gauche
          et droite pour les rapports en mode manuel.
        </p>
      </div>

      <p v-else-if="sourceKind === 'geolocation' && sourceStatus === 'denied'" class="hint warn">
        La géolocalisation a été refusée. Autorisez-la dans les réglages du site pour
        mesurer la vitesse réelle.
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

.controls {
  display: flex;
  flex-direction: column;
  gap: 1rem;
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

.hint {
  color: var(--muted);
  font-size: 0.9rem;
  margin: 0;
}

.hint.warn {
  color: var(--warn);
}

@media (max-width: 620px) {
  .readout {
    grid-template-columns: 1fr 1fr;
  }

  .rpm {
    grid-column: 1 / -1;
  }
}
</style>
