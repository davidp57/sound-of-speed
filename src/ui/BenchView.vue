<script setup lang="ts">
import { computed, ref } from 'vue'

import {
  benchOptions,
  getSimulatedCruise,
  padConnected,
  padLabel,
  padMapping,
  setBenchOptions,
  setBrake,
  setSimulatedSpeed,
  setSimulationMode,
  setSource,
  setThrottle,
  simulationMode,
  sourceKind,
  telemetry,
  type SimulationMode,
} from '../state'

/**
 * Le banc : conduire une vitesse à la main, et régler ce que la source fabrique.
 *
 * Ces commandes vivaient au milieu de l'écran de conduite, sous les cadrans.
 * Elles y prenaient la place de ce qu'on lit en roulant, et l'écran de conduite
 * est déjà l'écran le plus chargé de l'application. David, le 8 septembre 2026,
 * demandait « une page à part pour le simu » : la voici.
 *
 * Elle est autonome — elle choisit sa source et rappelle les trois chiffres qui
 * disent où l'on en est — parce qu'on s'en sert garé, sans regarder les cadrans.
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

const modeHint = computed(
  () => MODES.find((mode) => mode.id === simulationMode.value)?.hint ?? '',
)

const onSimulator = computed(() => sourceKind.value === 'simulator')

function patchBench(
  key: 'cadenceMs' | 'standstillCadenceMs' | 'noiseKmh' | 'accuracyM',
  event: Event,
): void {
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
</script>

<template>
  <div class="bench-view">
    <section class="panel">
      <h2>Banc</h2>
      <p class="hint">
        Conduire une vitesse à la main, sans rouler. C'est ici qu'on juge un son à
        régime établi, et qu'on distingue un défaut de son d'un défaut de signal.
      </p>

      <div v-if="!onSimulator" class="group column">
        <p class="hint warn">
          La source active est le {{ sourceKind === 'geolocation' ? 'GPS' : 'rejeu' }} :
          les commandes ci-dessous ne pilotent rien.
        </p>
        <div class="group">
          <button @click="setSource('simulator')">Passer au simulateur</button>
        </div>
      </div>

      <div class="readout">
        <span><b class="numeric">{{ Math.round(telemetry.speed.kmh) }}</b> km/h</span>
        <span><b class="numeric">{{ Math.round(telemetry.engine.rpm) }}</b> tr/min</span>
        <span>rapport <b class="numeric">{{ telemetry.gearbox.gear || 'N' }}</b></span>
      </div>
    </section>

    <section class="panel">
      <h2>Piloter</h2>
      <div class="pedals">
        <button
          :disabled="!onSimulator"
          @pointerdown="setThrottle(1)"
          @pointerup="setThrottle(0)"
          @pointerleave="setThrottle(0)"
        >
          Accélérer
        </button>
        <button
          :disabled="!onSimulator"
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
        <input
          type="range"
          min="0"
          max="220"
          step="1"
          :disabled="!onSimulator"
          :value="sliderSpeed"
          @input="onSlider"
        />
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
    </section>

    <section class="panel">
      <h2>Ce que le banc fabrique</h2>
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

      <template v-if="simulationMode !== 'perfect'">
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
              Décoché, la source doit la dériver de deux positions — le chemin où
              elle s'était tue en roulant.
            </span>
          </label>
        </template>
      </template>
    </section>
  </div>
</template>

<style scoped>
.bench-view {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  max-width: 60rem;
  margin: 0 auto;
}

.panel {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 1rem;
  border: 1px solid var(--line);
  border-radius: 0.5rem;
  background: var(--panel);
}

h2 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

/* Les trois chiffres qui disent où l'on en est, sans quitter cette page. */
.readout {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  font-size: 1.1rem;
}

.readout b {
  font-size: 1.6rem;
}

.numeric {
  font-variant-numeric: tabular-nums;
}

.group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.group.column {
  flex-direction: column;
  align-items: stretch;
}

.modes {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

/*
 * Des cibles larges : on appuie dessus dans une voiture, parfois à l'arrêt mais
 * jamais dans de bonnes conditions.
 */
.pedals {
  display: flex;
  gap: 0.75rem;
}

.pedals button {
  flex: 1;
  padding: 1.1rem;
  font-size: 1.05rem;
}

.slider {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.slider input {
  width: 100%;
}

.bench {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.bench input[type='number'] {
  width: 7rem;
}

.hint {
  margin: 0;
  color: var(--muted);
  font-size: 0.85rem;
}

.hint.warn {
  color: var(--warn);
}

.note {
  color: var(--muted);
  font-size: 0.8rem;
}
</style>
