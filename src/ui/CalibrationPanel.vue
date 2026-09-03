<script setup lang="ts">
import { computed, ref } from 'vue'

import { analyzeStep, type StepAnalysis } from '../core/calibration/analyze'
import { CALIBRATION_STEPS, type CalibrationStepId } from '../core/calibration/protocol'
import { loadCalibration, saveCalibration } from '../core/calibration/store'
import { readSetting, type SettingPath } from '../core/calibration/settings'
import { suggest, type Suggestion } from '../core/calibration/suggest'
import {
  activeProfile,
  applyCalibrationSetting,
  isRecording,
  isRunning,
  playTrace,
  recordedCount,
  startRecording,
  stopRecording,
  traces,
} from '../state'

/**
 * Étalonnage : mesurer la vraie voiture pour régler les virtuelles.
 *
 * Les réglages qui décident de la charge, des seuils de passage et des bornes
 * d'accélération ont tous été choisis par le calcul, faute de savoir ce que fait
 * la voiture. Cet écran demande de rouler, mesure, et met le chiffre obtenu
 * face à celui du profil.
 *
 * **Elle propose, elle n'applique pas.** La recopie se fait réglage par réglage,
 * sur un geste, jamais en bloc — la même règle que pour les candidats d'ancrage
 * de l'analyse d'échantillon, qui se départagent à l'oreille. Et le filet est
 * en place : « Réinitialiser » ramène un profil à ce qu'il était.
 */

/** Étape → horodatage de la trace qui l'a enregistrée. */
const session = ref(loadCalibration())
/** Étape dont l'enregistrement est en cours. */
const active = ref<CalibrationStepId | null>(null)
const storageError = ref('')

/**
 * Ce qu'une recopie a écrasé, réglage par réglage.
 *
 * Un retour en arrière immédiat, à côté du bouton qui vient d'écrire : dans une
 * voiture, aller chercher « réinitialiser » dans l'écran de configuration
 * remettrait toute une section, et pas seulement la valeur qu'on regrette. Cette
 * mémoire ne vit que le temps de la session ; la garantie durable, elle, est
 * l'origine du profil, à laquelle « réinitialiser » sait revenir.
 */
const overwritten = ref<Partial<Record<SettingPath, { value: number | number[]; shown: string }>>>(
  {},
)

function traceFor(step: CalibrationStepId) {
  const startedAt = session.value[step]
  if (startedAt === undefined) return undefined
  return traces.value.find((trace) => trace.startedAt === startedAt)
}

/** Les étapes enregistrées, mesurées et jugées. */
const analyses = computed<StepAnalysis[]>(() => {
  const result: StepAnalysis[] = []
  for (const step of CALIBRATION_STEPS) {
    const trace = traceFor(step.id)
    if (trace) result.push(analyzeStep(step.id, trace))
  }
  return result
})

const suggestions = computed<Suggestion[]>(() => suggest(analyses.value, activeProfile.value))

/**
 * Où en est la session, en une ligne.
 *
 * Une session incomplète reste utile, et c'est justement pour cela qu'il faut
 * dire ce qu'elle contient : sans ce compte, on ne sait pas si une ligne « non
 * mesuré » vient d'une étape oubliée ou d'une étape refusée.
 */
const progress = computed(() => {
  const recorded = rows.value.filter((row) => row.recorded && !row.orphan).length
  const valid = rows.value.filter((row) => row.analysis?.valid === true).length
  const proposed = suggestions.value.filter((entry) => entry.setting !== null).length
  const notMeasured = suggestions.value.filter((entry) => entry.measured === null).length
  return { recorded, total: CALIBRATION_STEPS.length, valid, proposed, notMeasured }
})

/**
 * Une ligne d'étape, prête à afficher.
 *
 * Le calcul est fait ici plutôt que dans le gabarit : une étape a trois états —
 * pas enregistrée, enregistrée, et enregistrée mais dont la trace a été
 * supprimée depuis la liste des traces — et les mêler à la volée dans des
 * conditions imbriquées rend le gabarit illisible.
 */
const rows = computed(() =>
  CALIBRATION_STEPS.map((step) => {
    const found = analyses.value.find((analysis) => analysis.step === step.id) ?? null
    return {
      step,
      analysis: found,
      recorded: session.value[step.id] !== undefined,
      orphan: session.value[step.id] !== undefined && found === null,
    }
  }),
)

function remember(step: CalibrationStepId, startedAt: number | undefined): void {
  const next = { ...session.value }
  if (startedAt === undefined) delete next[step]
  else next[step] = startedAt
  session.value = next
  storageError.value = saveCalibration(next)
    ? ''
    : 'La session n’a pas pu être enregistrée : elle ne survivra pas au rechargement.'
}

function onStart(step: CalibrationStepId): void {
  active.value = step
  startRecording()
}

function onStop(): void {
  const step = active.value
  active.value = null
  const label = CALIBRATION_STEPS.find((entry) => entry.id === step)?.label ?? 'étape'
  const trace = stopRecording(`étalonnage — ${label}`)
  if (step && trace) remember(step, trace.startedAt)
}

function onForget(step: CalibrationStepId): void {
  remember(step, undefined)
}

function onReplay(step: CalibrationStepId): void {
  const trace = traceFor(step)
  if (trace) playTrace(trace)
}

function onCopy(suggestion: Suggestion): void {
  const setting = suggestion.setting
  if (!setting) return
  // La valeur écrasée est relevée **avant** l'écriture, et dans l'unité du
  // réglage : c'est elle qu'un retour en arrière doit rendre.
  overwritten.value = {
    ...overwritten.value,
    [setting.path]: {
      value: readSetting(activeProfile.value, setting.path),
      shown: `${shown(setting.current, setting.decimals)} ${setting.unit}`,
    },
  }
  // `write`, et non `proposed` : les seuils de passage s'affichent en km/h et se
  // rangent en tr/min.
  applyCalibrationSetting(setting.path, setting.write)
}

function onUndo(path: SettingPath): void {
  const previous = overwritten.value[path]
  if (!previous) return
  applyCalibrationSetting(path, previous.value)
  const next = { ...overwritten.value }
  delete next[path]
  overwritten.value = next
}

function fixed(value: number, digits = 1): string {
  return Number.isFinite(value) ? value.toFixed(digits) : '—'
}

/** Une valeur ou une liste de valeurs, dans l'unité de la ligne. */
function shown(value: number | number[], digits: number): string {
  return Array.isArray(value)
    ? value.map((entry) => fixed(entry, digits)).join(' · ')
    : fixed(value, digits)
}

/**
 * Ce que l'étape a mesuré, en une formule courte, propre à chaque étape.
 *
 * Au dixième de m/s², la même précision que la proposition : un verdict qui
 * annoncerait 7,31 là où le tableau propose 7,3 ferait douter de l'un des deux.
 */
function summary(analysis: StepAnalysis): string {
  switch (analysis.step) {
    case 'launch':
      return `accélération soutenue ${fixed(analysis.measure.peakAccelMs2 ?? 0)} m/s²`
    case 'coast':
    case 'brake':
      return `décélération soutenue ${fixed(analysis.measure.peakDecelMs2 ?? 0)} m/s²`
    case 'city':
    case 'road':
    case 'highway':
      return ordinarySummary(analysis)
    default:
      return 'mesurée'
  }
}

/**
 * Ce qu'une étape de conduite ordinaire a relevé.
 *
 * Les paliers et leur durée s'affichent par étape : c'est d'eux que sortent les
 * seuils de passage, et une étape qui n'en contient qu'un n'a pas de quoi les
 * informer, même si elle est valide.
 */
function ordinarySummary(analysis: StepAnalysis): string {
  const plateaus = analysis.measure.plateaus
  const held = [...plateaus].sort((a, b) => b.durationS - a.durationS)[0]
  const total = plateaus.reduce((sum, plateau) => sum + plateau.durationS, 0)
  const parts = [
    `${plateaus.length} palier${plateaus.length > 1 ? 's' : ''}`,
    `${fixed(total, 0)} s tenues`,
    `le plus long à ${fixed(held?.kmh ?? 0, 0)} km/h pendant ${fixed(held?.durationS ?? 0, 0)} s`,
    `max pratiqué ${fixed(analysis.measure.practicedMaxKmh, 0)} km/h`,
  ]
  const noise = analysis.measure.noiseKmh
  parts.push(
    noise === null
      ? `cadence ${fixed(analysis.measure.cadenceMs, 0)} ms, bruit non mesurable`
      : `bruit ${fixed(noise, 2)} km/h à ${fixed(analysis.measure.cadenceMs, 0)} ms`,
  )
  return parts.join(', ')
}

/** Écart entre le mesuré et le réglé, signe compris, terme à terme. */
function gap(setting: NonNullable<Suggestion['setting']>): string {
  const proposed = Array.isArray(setting.proposed) ? setting.proposed : [setting.proposed]
  const current = Array.isArray(setting.current) ? setting.current : [setting.current]
  return proposed
    .map((value, index) => {
      const delta = value - (current[index] ?? 0)
      return `${delta > 0 ? '+' : ''}${fixed(delta, setting.decimals)}`
    })
    .join(' · ')
}
</script>

<template>
  <section class="panel wide">
    <h2>Étalonnage</h2>
    <p class="note">
      Rouler selon la consigne, une étape à la fois, et l’application mesure ce
      que la voiture fait vraiment. Elle propose ensuite un réglage face à celui
      du profil : rien n’est appliqué sans un geste, et un profil sait revenir à
      ce qu’il était depuis l’écran de configuration.
    </p>
    <p class="note">
      Profil mesuré : <strong>{{ activeProfile.name }}</strong>. Chaque étape vaut
      séparément — un freinage franc ne se commande pas au milieu du trafic.
    </p>
    <p v-if="!isRunning" class="error">
      Rien ne tourne : démarrez l’application avant d’enregistrer une étape.
    </p>

    <article v-for="row in rows" :key="row.step.id" class="step">
      <h3>{{ row.step.label }}</h3>
      <p class="consigne">{{ row.step.instruction }}</p>
      <p class="critere"><span class="tag">Critère</span> {{ row.step.criterion }}</p>
      <p class="note">Informe : {{ row.step.informs }}</p>

      <div class="controls">
        <button v-if="!isRecording" :disabled="!isRunning" @click="onStart(row.step.id)">
          Enregistrer l’étape
        </button>
        <button v-else-if="active === row.step.id" class="is-active" @click="onStop()">
          Arrêter ({{ recordedCount }} mesures)
        </button>
        <span v-else class="muted">Un autre enregistrement est en cours.</span>

        <template v-if="row.recorded">
          <button :disabled="row.orphan" @click="onReplay(row.step.id)">Rejouer</button>
          <button @click="onForget(row.step.id)">Oublier</button>
        </template>
      </div>

      <p v-if="row.orphan" class="error">
        La trace de cette étape a été supprimée : l’étape est à refaire.
      </p>
      <p v-else-if="row.analysis" class="verdict" :class="{ bad: !row.analysis.valid }">
        <template v-if="row.analysis.valid">
          Étape valide — {{ summary(row.analysis) }}, sur
          {{ row.analysis.measure.count }} mesures en
          {{ fixed(row.analysis.measure.durationS, 1) }} s.
        </template>
        <template v-else>Étape refusée — {{ row.analysis.reason }}</template>
      </p>
      <p v-else class="note">Étape non enregistrée.</p>
    </article>

    <h3>Mesuré face à réglé</h3>
    <p class="note">
      {{ progress.recorded }} étape{{ progress.recorded > 1 ? 's' : '' }} sur
      {{ progress.total }} enregistrée{{ progress.recorded > 1 ? 's' : '' }},
      {{ progress.valid }} valide{{ progress.valid > 1 ? 's' : '' }} —
      {{ progress.proposed }} réglage{{ progress.proposed > 1 ? 's' : '' }} proposé{{ progress.proposed > 1 ? 's' : '' }},
      {{ progress.notMeasured }} non mesuré{{ progress.notMeasured > 1 ? 's' : '' }}.
      Une session incomplète reste utile : ce qui manque est dit, jamais estimé.
    </p>
    <!--
      Le tableau défile de lui-même quand la place manque : sur un téléphone,
      cinq seuils de passage face à cinq autres ne tiennent pas dans la largeur,
      et c'est la page entière qui partirait de côté.
    -->
    <div class="scroller">
    <table class="recap">
      <thead>
        <tr>
          <th>Réglage</th>
          <th>Mesuré</th>
          <th>Réglé</th>
          <th>Écart</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="suggestion in suggestions" :key="suggestion.key">
          <td>
            {{ suggestion.label }}
            <small v-if="suggestion.note" class="muted">{{ suggestion.note }}</small>
          </td>
          <template v-if="suggestion.setting">
            <td class="numeric">
              {{ shown(suggestion.setting.proposed, suggestion.setting.decimals) }}
              <small>{{ suggestion.setting.unit }}</small>
            </td>
            <td class="numeric">
              {{ shown(suggestion.setting.current, suggestion.setting.decimals) }}
              <small>{{ suggestion.setting.unit }}</small>
            </td>
            <td class="numeric">{{ gap(suggestion.setting) }}</td>
            <td>
              <button @click="onCopy(suggestion)">Recopier</button>
              <template v-if="overwritten[suggestion.setting.path]">
                <button @click="onUndo(suggestion.setting.path)">Annuler</button>
                <small class="muted">
                  était {{ overwritten[suggestion.setting.path]?.shown }}
                </small>
              </template>
              <small v-if="suggestion.setting.conversion" class="muted">
                {{ suggestion.setting.conversion }}
              </small>
            </td>
          </template>
          <template v-else-if="suggestion.measured">
            <td class="numeric">
              {{ shown(suggestion.measured.value, suggestion.measured.decimals) }}
              <small>{{ suggestion.measured.unit }}</small>
            </td>
            <td class="numeric muted">—</td>
            <td class="numeric muted">—</td>
            <td></td>
          </template>
          <template v-else>
            <td colspan="3" class="muted">Non mesuré — {{ suggestion.missing }}</td>
            <td></td>
          </template>
        </tr>
      </tbody>
    </table>
    </div>

    <p class="note">
      « Annuler » rend la valeur écrasée, ici et tout de suite. Pour revenir plus
      tard, l’écran de configuration ramène une section entière du profil à ce
      qu’elle était à sa création.
    </p>
    <p v-if="storageError" class="error">{{ storageError }}</p>
  </section>
</template>

<style scoped>
.note {
  color: var(--muted);
  font-size: 0.85rem;
  margin: 0 0 0.7rem;
}

h2 {
  margin: 0 0 0.6rem;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--muted);
  font-weight: 600;
}

h3 {
  margin: 0.9rem 0 0.4rem;
  font-size: 0.95rem;
}

.step {
  border-top: 1px solid var(--line);
  padding-bottom: 0.6rem;
}

.consigne {
  margin: 0 0 0.4rem;
}

.critere {
  margin: 0 0 0.4rem;
  font-size: 0.9rem;
}

.tag {
  background: var(--panel-alt);
  border-radius: 4px;
  padding: 0.05rem 0.4rem;
  margin-right: 0.4rem;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
}

.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  margin: 0.5rem 0;
}

.verdict {
  margin: 0.3rem 0 0;
  font-size: 0.9rem;
}

.verdict.bad {
  color: var(--warn);
}

.scroller {
  overflow-x: auto;
}

/*
 * La largeur minimale n'est pas décorative : la colonne des libellés porte, sous
 * chaque nom de réglage, la phrase qui dit d'où vient la mesure. Serrée à onze
 * rem sur un téléphone, elle se casse tous les deux mots et la ligne devient
 * illisible. À dix-huit rem la phrase tient sur deux ou trois lignes, et le
 * tableau défile de côté dans son conteneur plutôt que d'emporter la page.
 */
.recap {
  width: 100%;
  border-collapse: collapse;
  min-width: 42rem;
}

.recap td:first-child,
.recap th:first-child {
  min-width: 18rem;
}

.recap th {
  text-align: left;
  color: var(--muted);
  font-weight: 500;
  font-size: 0.8rem;
  padding-bottom: 0.3rem;
}

.recap td {
  padding: 0.35rem 0;
  border-top: 1px solid var(--line);
  vertical-align: top;
}

.recap td.numeric,
.recap th:nth-child(n + 2) {
  text-align: right;
}

.recap td.numeric {
  white-space: nowrap;
}

.recap small {
  color: var(--muted);
  font-size: 0.8em;
}

.recap td small {
  display: block;
}

.muted {
  color: var(--muted);
}

.error {
  color: var(--warn);
  margin: 0.5rem 0 0;
}
</style>
