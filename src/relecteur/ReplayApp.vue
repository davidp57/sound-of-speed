<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import TrackMap from './TrackMap.vue'
import DialGauge from '../ui/components/DialGauge.vue'
import { loadDepositCredentials } from '../core/preset/store'
import { listSessions, loadSession, type SessionEntry } from '../core/session/read'
import { stateAt, trackAt, type Session } from '../core/session/model'

/**
 * Le relecteur : revoir un trajet au lieu de le raconter de mémoire.
 *
 * Il déroule une session enregistrée comme un lecteur vidéo — lecture, pause,
 * déplacement libre — et montre à chaque instant ce que la voiture a vécu.
 *
 * **Ce qu'il montre est ce qui a été enregistré.** Un journal ne porte la
 * vitesse qu'une fois par seconde, et le régime, le rapport et la charge
 * qu'une fois toutes les dix secondes : entre deux relevés, une valeur est une
 * interpolation, et elle le dit. La présenter comme une mesure ferait croire à
 * un passage de rapport qu'on n'a jamais observé.
 */

const credentials = loadDepositCredentials()

const entries = ref<SessionEntry[]>([])
const chosen = ref<string>('')
const session = ref<Session | null>(null)
const failures = ref<string[]>([])
const busy = ref(false)
const note = ref('')

/** Position de lecture, en millisecondes depuis le début de la session. */
const at = ref(0)
const playing = ref(false)
const rate = ref(1)
let timer: ReturnType<typeof setInterval> | null = null
let lastTick = 0

const hasAccount = credentials.user !== '' && credentials.password !== ''

async function refresh(): Promise<void> {
  busy.value = true
  note.value = ''
  try {
    entries.value = await listSessions(credentials)
    if (entries.value.length === 0) {
      note.value = hasAccount
        ? 'Aucune session sur le serveur.'
        : "Aucun compte de dépôt sur cet appareil : le relecteur lit le serveur avec le même compte que l'application."
    }
  } finally {
    busy.value = false
  }
}

/**
 * Le chargement en cours, pour que deux ne se marchent pas dessus.
 *
 * Changer de session pendant qu'une autre charge lançait deux lectures, et
 * c'était la plus lente qui s'affichait — donc pas celle qu'on avait demandée.
 */
let pending = 0

async function open(key: string): Promise<void> {
  const entry = entries.value.find((candidate) => candidate.key === key)
  if (!entry) return
  stop()
  const jeton = ++pending
  busy.value = true
  note.value = `Chargement de ${entry.files.length} fichier${entry.files.length > 1 ? 's' : ''}…`
  try {
    const chargé = await loadSession(entry, credentials)
    if (jeton !== pending) return
    session.value = chargé.session
    failures.value = chargé.failures
    at.value = 0
    note.value = ''
  } catch (error) {
    if (jeton !== pending) return
    note.value = error instanceof Error ? error.message : 'Session illisible.'
  } finally {
    if (jeton === pending) busy.value = false
  }
}

watch(chosen, (key) => void open(key))

const duration = computed(() => session.value?.durationMs ?? 0)
const reading = computed(() => (session.value ? stateAt(session.value.states, at.value) : null))
const position = computed(() => (session.value ? trackAt(session.value.track, at.value) : null))

/** Les faits marquants, groupés pour ne pas couvrir la barre de rafales. */
const marks = computed(() => {
  const total = duration.value
  if (!session.value || total <= 0) return []
  const groupes = new Map<string, { at: number; kind: string; count: number }>()
  for (const event of session.value.events) {
    // Un centième de la durée : deux rejets à deux secondes d'écart sur une
    // heure de trajet sont le même moment, et deux marques superposées ne se
    // distinguent pas.
    const cellule = `${event.kind}:${Math.round((event.at / total) * 100)}`
    const trouvé = groupes.get(cellule)
    if (trouvé) trouvé.count += 1
    else groupes.set(cellule, { at: event.at, kind: event.kind, count: 1 })
  }
  return [...groupes.values()]
})

const KIND_LABELS: Record<string, string> = {
  source: 'source de vitesse',
  reject: 'positions rejetées',
  'fix-restart': 'suivi relancé',
  'speed-origin': 'origine de la vitesse',
  audio: 'son',
  profile: 'configuration',
  capture: 'capture',
  error: 'erreur',
}

function label(kind: string): string {
  return KIND_LABELS[kind] ?? kind
}

/**
 * L'infobulle d'un repère, suivie à la souris.
 *
 * Et non l'attribut `title` du navigateur : il met une seconde à paraître, ce
 * qui est une seconde de trop quand on balaie une barre pour trouver où
 * quelque chose s'est passé.
 */
const hovered = ref<{ x: number; text: string } | null>(null)

function showMark(event: MouseEvent, mark: { at: number; kind: string; count: number }): void {
  const barre = (event.currentTarget as HTMLElement).parentElement
  const boite = barre?.getBoundingClientRect()
  hovered.value = {
    x: boite ? event.clientX - boite.left : 0,
    text: `${label(mark.kind)}${mark.count > 1 ? ` — ${mark.count} fois` : ''} · ${clock(mark.at)}`,
  }
}

/**
 * Les échelles des cadrans, reprises de l'écran de conduite.
 *
 * Le compteur est fixe à 180 km/h pour la même raison que dans la voiture : la
 * vitesse maximale théorique dépasse 300, et l'aiguille passerait sa vie dans
 * le coin. Le compte-tours, lui, suit le rupteur enregistré dans l'en-tête de
 * la session — c'est le moteur qui jouait ce jour-là, pas celui d'aujourd'hui.
 */
const SPEED_SCALE_KMH = 180
const SPEED_STEP_KMH = 20

const redlineRpm = computed<number | null>(() => {
  const runtime = session.value?.header?.['runtime']
  if (typeof runtime !== 'object' || runtime === null) return null
  const engine = (runtime as Record<string, unknown>)['engine']
  if (typeof engine !== 'object' || engine === null) return null
  const rpm = (engine as Record<string, unknown>)['softLimitRpm']
  return typeof rpm === 'number' ? rpm : null
})

/** Borne haute du compte-tours : le rupteur arrondi, ou de quoi tenir le relevé. */
const rpmScale = computed(() => {
  const rupteur = redlineRpm.value
  const vu = Math.max(0, ...(session.value?.states.map((point) => point.rpm) ?? [0]))
  return Math.ceil(Math.max(rupteur ?? 0, vu, 1000) / 1000) * 1000
})

/** L'horloge du lecteur. Vingt fois par seconde suffit à l'œil. */
function play(): void {
  if (playing.value || duration.value <= 0) return
  playing.value = true
  lastTick = performance.now()
  timer = setInterval(() => {
    const now = performance.now()
    const dt = now - lastTick
    lastTick = now
    at.value = Math.min(duration.value, at.value + dt * rate.value)
    if (at.value >= duration.value) stop()
  }, 50)
}

function stop(): void {
  playing.value = false
  if (timer !== null) clearInterval(timer)
  timer = null
}

function toggle(): void {
  if (playing.value) stop()
  else play()
}

onBeforeUnmount(stop)

/** Durée en minutes et secondes, telle qu'on la lit et qu'on la dit. */
function clock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Un délai depuis le départ, écrit sans qu'on puisse le confondre avec une heure. */
function duree(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(total / 60)
  const sec = total % 60
  return m > 0 ? `${m} min ${String(sec).padStart(2, '0')} s` : `${sec} s`
}

/**
 * Un écart au relevé, dit dans l'unité qui le rend parlant.
 *
 * « 0,0 s » se lit comme « pile dessus » alors qu'il peut valoir quarante
 * millisecondes ; c'est justement la distinction que cet écran doit tenir.
 */
function ecart(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`
}

function stamp(ms: number): string {
  return new Date(ms).toLocaleString('fr-FR')
}

/**
 * La carte suit-elle le véhicule ?
 *
 * Active par défaut : on ouvre un trajet pour le voir se dérouler, pas pour
 * courir derrière un point qui sort du cadre. Le bouton la coupe quand on veut
 * examiner un endroit pendant que la lecture continue.
 */
const follow = ref(true)

const copied = ref('')

/**
 * Le repère : ce qu'on colle dans la conversation pour désigner un moment.
 *
 * Une première ligne lisible, que David relit avant d'envoyer, puis l'état
 * complet — de quoi aller droit au moment sans rouvrir les fichiers.
 */
function repere(): string {
  const s = session.value
  if (!s) return ''
  const lu = reading.value
  const pos = position.value
  // « 20:03 » se lit comme une heure dans une conversation, alors que c'est un
  // délai depuis le début du trajet. Le repère est fait pour être collé et lu
  // par quelqu'un d'autre : il dit son unité.
  const tête = `Session ${s.id} du ${stamp(s.startedAt)}, à ${duree(at.value)} du départ`
  const corps = lu
    ? ` — ${lu.value.kmh.toFixed(1)} km/h, ${Math.round(lu.value.rpm)} tr/min, rapport ${lu.value.gear}`
    : ' — aucun relevé'
  const détail = {
    session: s.id,
    startedAt: new Date(s.startedAt).toISOString(),
    atMs: Math.round(at.value),
    mesuré: lu?.measured ?? null,
    écartAuReleveMs: lu ? Math.round(lu.offsetMs) : null,
    kmh: lu ? Number(lu.value.kmh.toFixed(2)) : null,
    rpm: lu ? Math.round(lu.value.rpm) : null,
    rapport: lu?.value.gear ?? null,
    charge: lu ? Number(lu.value.load.toFixed(2)) : null,
    accelMs2: lu ? Number(lu.value.accelMs2.toFixed(2)) : null,
    lat: pos ? Number(pos.lat.toFixed(5)) : null,
    lon: pos ? Number(pos.lon.toFixed(5)) : null,
  }
  return `${tête}${corps}\n${JSON.stringify(détail)}`
}

async function copyRepere(): Promise<void> {
  const texte = repere()
  if (texte === '') return
  try {
    await navigator.clipboard.writeText(texte)
    copied.value = 'Repère copié.'
  } catch {
    copied.value = 'Copie refusée par le navigateur.'
  }
  setTimeout(() => {
    copied.value = ''
  }, 4000)
}

void refresh()
</script>

<template>
  <div class="relecteur">
    <header>
      <h1>Relecteur</h1>
      <div class="pick">
        <select v-model="chosen" :disabled="busy || entries.length === 0">
          <option value="" disabled>Choisir une session…</option>
          <option v-for="entry in entries" :key="entry.key" :value="entry.key">
            {{ stamp(entry.startedAt) }} — {{ entry.id }} ({{ entry.files.length }}
            {{ entry.files.length > 1 ? 'fichiers' : 'fichier' }})
          </option>
        </select>
        <button :disabled="busy" @click="refresh()">Rafraîchir</button>
      </div>
      <span v-if="session" class="muted">
        {{ session.sources.capture > 0 ? 'capture et journal' : 'journal seul' }} —
        {{ session.states.length }} relevés, {{ session.track.length }} positions
      </span>
    </header>

    <p v-if="note" class="note">{{ note }}</p>
    <p v-if="failures.length" class="note">
      Fichiers illisibles, laissés de côté : {{ failures.join(', ') }}
    </p>

    <template v-if="session">
      <section class="panel lecture">
        <div class="timeline">
          <input
            type="range"
            min="0"
            :max="duration"
            step="100"
            :value="at"
            @input="at = Number(($event.target as HTMLInputElement).value)"
          />
          <div class="marks">
            <span
              v-for="(mark, i) in marks"
              :key="i"
              class="mark"
              :class="mark.kind"
              :style="{ left: `${(mark.at / duration) * 100}%` }"
              @mouseenter="showMark($event, mark)"
              @mouseleave="hovered = null"
              @click="at = mark.at"
            ></span>
            <span v-if="hovered" class="bulle" :style="{ left: `${hovered.x}px` }">
              {{ hovered.text }}
            </span>
          </div>
        </div>

        <div class="controls">
          <button class="is-active" @click="toggle()">{{ playing ? 'Pause' : 'Lecture' }}</button>
          <span class="numeric horloge">{{ clock(at) }}</span>
          <span class="muted">sur {{ clock(duration) }}</span>
          <label>
            ×<span class="numeric">{{ rate.toFixed(1) }}</span>
            <input
              type="range"
              min="0.5"
              max="20"
              step="0.5"
              :value="rate"
              @input="rate = Number(($event.target as HTMLInputElement).value)"
            />
          </label>
          <button :aria-pressed="follow" @click="follow = !follow">
            {{ follow ? 'Carte centrée' : 'Recentrer sur la voiture' }}
          </button>
          <button @click="copyRepere()">Copier le repère</button>
          <span v-if="copied" class="muted">{{ copied }}</span>
        </div>
      </section>

      <!--
        Les mêmes cadrans que dans la voiture, et le même composant : relire un
        trajet, c'est revoir ce qu'on avait sous les yeux. Deux dessins pour la
        même valeur donneraient deux impressions différentes du même instant.
      -->
      <section v-if="reading" class="panel cadrans">
        <div class="cadran">
          <DialGauge
            :value="reading.value.kmh"
            :max="SPEED_SCALE_KMH"
            :step="SPEED_STEP_KMH"
            unit="km/h"
          />
        </div>

        <div class="rapport">
          <span class="numeric gear">{{ reading.value.gear }}</span>
          <span class="unite">rapport</span>
          <p class="etat" :class="{ devine: !reading.measured }">
            {{
              reading.measured
                ? 'valeurs mesurées'
                : `interpolé — relevé à ${ecart(reading.offsetMs)}`
            }}
          </p>
          <p class="appoint">
            charge {{ (reading.value.load * 100).toFixed(0) }} % ·
            {{ reading.value.accelMs2.toFixed(2) }} m/s²
          </p>
        </div>

        <div class="cadran">
          <DialGauge
            :value="reading.value.rpm"
            :max="rpmScale"
            :step="1000"
            :redline="redlineRpm"
            unit="tr/min"
          />
        </div>
      </section>
      <p v-else class="note">Cette session ne porte aucun relevé de conduite.</p>

      <section class="panel carte">
        <TrackMap :track="session.track" :at="position" :follow="follow" @seek="at = $event" />
      </section>

      <details v-if="session.header" class="panel">
        <summary>Configuration enregistrée</summary>
        <pre>{{ JSON.stringify(session.header, null, 2) }}</pre>
      </details>
    </template>
  </div>
</template>

<style scoped>
/*
  Pleine hauteur, et la carte prend ce qui reste : c'est elle qu'on regarde le
  plus longtemps, et une carte de vingt lignes ne montre pas un trajet.
*/
.relecteur {
  height: 100vh;
  box-sizing: border-box;
  padding: 0.8rem;
  display: grid;
  grid-template-rows: auto auto auto 1fr auto;
  gap: 0.7rem;
  max-width: 90rem;
  margin: 0 auto;
}

header {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

h1 {
  margin: 0;
  font-size: 1rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.pick {
  display: flex;
  gap: 0.5rem;
  flex: 1;
  min-width: 20rem;
}

select {
  flex: 1;
}

.panel {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 0.7rem 0.9rem;
}

.lecture {
  display: grid;
  gap: 0.4rem;
}

.muted {
  color: var(--muted);
  font-size: 0.85rem;
}

.horloge {
  font-size: 1.2rem;
}

.timeline {
  position: relative;
}

.timeline input {
  width: 100%;
  display: block;
}

.marks {
  position: relative;
  height: 0.7rem;
}

/* Une marque par fait : sa couleur dit sa nature, sa position son instant. */
.mark {
  position: absolute;
  top: 0;
  width: 3px;
  height: 0.7rem;
  background: var(--muted);
  transform: translateX(-1px);
  cursor: pointer;
}

.mark.reject {
  background: #ef6c00;
}

.mark.fix-restart,
.mark.error {
  background: #c62828;
}

.mark.profile {
  background: #e8a33d;
}

.mark.source,
.mark.capture {
  background: #2e7d32;
}

/* L'infobulle paraît sans délai : on balaie la barre pour trouver un moment. */
.bulle {
  position: absolute;
  top: 1rem;
  transform: translateX(-50%);
  white-space: nowrap;
  background: #10131a;
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 0.2rem 0.5rem;
  font-size: 0.8rem;
  pointer-events: none;
  z-index: 500;
}

.controls {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  flex-wrap: wrap;
}

.controls label {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.85rem;
  color: var(--muted);
}

.cadrans {
  display: grid;
  grid-template-columns: 1fr minmax(9rem, 0.6fr) 1fr;
  align-items: center;
  gap: 1rem;
}

.cadran {
  display: flex;
  justify-content: center;
}

.cadran :deep(svg) {
  max-height: 12rem;
}

.rapport {
  text-align: center;
}

.gear {
  font-size: 3rem;
  line-height: 1;
}

.unite {
  display: block;
  color: var(--muted);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.etat {
  margin: 0.6rem 0 0;
  font-size: 0.8rem;
  color: #2e7d32;
}

.etat.devine {
  color: var(--muted);
}

.appoint {
  margin: 0.2rem 0 0;
  font-size: 0.8rem;
  color: var(--muted);
}

.carte {
  min-height: 0;
  padding: 0;
  overflow: hidden;
}

.note {
  color: var(--muted);
  font-size: 0.9rem;
  margin: 0;
}

summary {
  cursor: pointer;
  color: var(--muted);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

pre {
  margin: 0.6rem 0 0;
  overflow: auto;
  max-height: 12rem;
  font-size: 0.8rem;
  color: var(--muted);
}
</style>
