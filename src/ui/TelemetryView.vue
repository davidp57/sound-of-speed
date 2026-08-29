<script setup lang="ts">
import { computed, ref } from 'vue'

import ValueRow from './components/ValueRow.vue'
import { computeMix } from '../core/audio/mix'
import { rpmAtSpeed } from '../core/preset/defaults'
import {
  activeProfile,
  audioStatus,
  isRecording,
  playTrace,
  recordedCount,
  replayProgress,
  setReplayRate,
  sourceKind,
  startRecording,
  stopRecording,
  telemetry,
  traces,
} from '../state'

/**
 * Écran avancé : tout ce qui alimente le son, y compris le mixage des couches,
 * calculé ici avant même qu'un moteur audio soit branché. Régler un profil se
 * fait donc à l'œil autant qu'à l'oreille.
 */

const traceName = ref('')
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

function fixed(value: number, digits = 1): string {
  return Number.isFinite(value) ? value.toFixed(digits) : '—'
}

function onRecordToggle(): void {
  if (isRecording.value) {
    stopRecording(traceName.value)
    traceName.value = ''
  } else {
    startRecording()
  }
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
      <ValueRow
        label="Depuis dernière mesure"
        :value="Math.round(telemetry.speed.sinceLastSampleMs)"
        unit="ms"
        :warn="staleFix"
        hint="Au-delà de trois secondes, la vitesse affichée n'est plus qu'une extrapolation."
      />
      <ValueRow
        label="Intervalles récents"
        :value="telemetry.speed.recentGapsMs.join(' · ') || '—'"
        unit="ms"
        hint="Le GPS livre en général une mesure par seconde."
      />
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
      <ValueRow label="Charge" :value="fixed(telemetry.engine.load, 3)" :bar="telemetry.engine.load" />
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

    <section class="panel wide">
      <h2>Mixage des couches</h2>
      <p class="note">
        Gains et vitesses de lecture calculés pour l'image courante. Une vitesse marquée
        « bornée » signale un échantillon étiré au-delà de sa plage utile : c'est là qu'il
        faut soit ajouter une couche, soit rapprocher les régimes d'ancrage.
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
      <h2>Traces</h2>
      <p class="note">
        Enregistrer un trajet réel permet de le rejouer ensuite sur un poste fixe, à
        l'identique. C'est le seul moyen de régler le lissage ou les seuils de passage
        sans refaire la route à chaque essai.
      </p>
      <div class="trace-controls">
        <input v-model="traceName" type="text" placeholder="Nom de la trace" />
        <button :class="{ 'is-active': isRecording }" @click="onRecordToggle">
          {{ isRecording ? `Arrêter (${recordedCount} mesures)` : 'Enregistrer' }}
        </button>
      </div>

      <ul v-if="traces.length" class="trace-list">
        <li v-for="trace in traces" :key="trace.startedAt">
          <span>{{ trace.name }}</span>
          <span class="muted">{{ trace.samples.length }} mesures</span>
          <button @click="playTrace(trace)">Rejouer</button>
        </li>
      </ul>
      <p v-else class="note">Aucune trace enregistrée.</p>

      <template v-if="sourceKind === 'replay'">
        <ValueRow label="Progression" :value="`${Math.round(replayProgress * 100)} %`" :bar="replayProgress" />
        <label class="rate">
          Vitesse de rejeu : ×<span class="numeric">{{ replayRate.toFixed(1) }}</span>
          <input type="range" min="0.25" max="4" step="0.25" :value="replayRate" @input="onRateChange" />
        </label>
      </template>
    </section>
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

.rate {
  display: block;
  color: var(--muted);
  margin-top: 0.6rem;
}
</style>
