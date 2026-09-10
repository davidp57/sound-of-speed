<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import TrackMap from './TrackMap.vue'
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

async function open(key: string): Promise<void> {
  const entry = entries.value.find((candidate) => candidate.key === key)
  if (!entry) return
  stop()
  busy.value = true
  note.value = `Chargement de ${entry.files.length} fichier${entry.files.length > 1 ? 's' : ''}…`
  try {
    const chargé = await loadSession(entry, credentials)
    session.value = chargé.session
    failures.value = chargé.failures
    at.value = 0
    note.value = ''
  } catch (error) {
    note.value = error instanceof Error ? error.message : 'Session illisible.'
  } finally {
    busy.value = false
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
  const tête = `Session ${s.id} du ${stamp(s.startedAt)}, à ${clock(at.value)}`
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
    </header>

    <p v-if="note" class="note">{{ note }}</p>
    <p v-if="failures.length" class="note">
      Fichiers illisibles, laissés de côté : {{ failures.join(', ') }}
    </p>

    <template v-if="session">
      <section class="panel">
        <div class="entete">
          <span class="numeric big">{{ clock(at) }}</span>
          <span class="muted">sur {{ clock(duration) }}</span>
          <span class="muted">
            {{ session.sources.capture > 0 ? 'capture et journal' : 'journal seul' }} —
            {{ session.states.length }} relevés, {{ session.track.length }} positions
          </span>
        </div>

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
              :title="`${label(mark.kind)}${mark.count > 1 ? ` (${mark.count})` : ''} à ${clock(mark.at)}`"
            ></span>
          </div>
        </div>

        <div class="controls">
          <button class="is-active" @click="toggle()">{{ playing ? 'Pause' : 'Lecture' }}</button>
          <label>
            Vitesse ×<span class="numeric">{{ rate.toFixed(1) }}</span>
            <input
              type="range"
              min="0.5"
              max="20"
              step="0.5"
              :value="rate"
              @input="rate = Number(($event.target as HTMLInputElement).value)"
            />
          </label>
          <button @click="copyRepere()">Copier le repère</button>
          <span v-if="copied" class="muted">{{ copied }}</span>
        </div>
      </section>

      <section class="panel">
        <h2>À cet instant</h2>
        <p v-if="reading && !reading.measured" class="devine">
          Valeurs interpolées — le relevé le plus proche est à {{ ecart(reading.offsetMs) }}.
        </p>
        <p v-else-if="reading" class="mesure">Valeurs mesurées.</p>

        <div v-if="reading" class="valeurs">
          <div><span class="numeric big">{{ reading.value.kmh.toFixed(1) }}</span><span class="unite">km/h</span></div>
          <div><span class="numeric big">{{ Math.round(reading.value.rpm) }}</span><span class="unite">tr/min</span></div>
          <div><span class="numeric big">{{ reading.value.gear }}</span><span class="unite">rapport</span></div>
          <div><span class="numeric big">{{ (reading.value.load * 100).toFixed(0) }}</span><span class="unite">% de charge</span></div>
          <div><span class="numeric big">{{ reading.value.accelMs2.toFixed(2) }}</span><span class="unite">m/s²</span></div>
        </div>
        <p v-else class="note">Cette session ne porte aucun relevé de conduite.</p>
      </section>

      <section class="panel">
        <h2>Où</h2>
        <TrackMap :track="session.track" :at="position" @seek="at = $event" />
      </section>

      <section v-if="session.header" class="panel">
        <h2>Configuration enregistrée</h2>
        <pre>{{ JSON.stringify(session.header, null, 2) }}</pre>
      </section>
    </template>
  </div>
</template>

<style scoped>
.relecteur {
  max-width: 70rem;
  margin: 0 auto;
  padding: 1rem;
  display: grid;
  gap: 1rem;
}

header {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

h1 {
  margin: 0;
  font-size: 1.1rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

h2 {
  margin: 0 0 0.6rem;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--muted);
  font-weight: 600;
}

.pick {
  display: flex;
  gap: 0.5rem;
  flex: 1;
}

select {
  flex: 1;
  min-width: 12rem;
}

.panel {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 0.9rem 1.1rem;
}

.entete {
  display: flex;
  align-items: baseline;
  gap: 0.8rem;
  flex-wrap: wrap;
  margin-bottom: 0.6rem;
}

.big {
  font-size: 1.6rem;
}

.muted {
  color: var(--muted);
  font-size: 0.85rem;
}

.timeline {
  position: relative;
  padding-bottom: 0.9rem;
}

.timeline input {
  width: 100%;
}

.marks {
  position: relative;
  height: 0.6rem;
}

/* Une marque par fait : sa couleur dit sa nature, sa position son instant. */
.mark {
  position: absolute;
  top: 0;
  width: 2px;
  height: 0.6rem;
  background: var(--muted);
  transform: translateX(-1px);
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

.controls {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.controls label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  color: var(--muted);
}

.valeurs {
  display: flex;
  gap: 1.6rem;
  flex-wrap: wrap;
}

.valeurs div {
  display: flex;
  align-items: baseline;
  gap: 0.3rem;
}

.unite {
  color: var(--muted);
  font-size: 0.8rem;
}

.devine {
  color: var(--muted);
  font-size: 0.85rem;
  margin: 0 0 0.6rem;
}

.mesure {
  color: #2e7d32;
  font-size: 0.85rem;
  margin: 0 0 0.6rem;
}

.note {
  color: var(--muted);
  font-size: 0.9rem;
  margin: 0;
}

pre {
  margin: 0;
  overflow-x: auto;
  font-size: 0.8rem;
  color: var(--muted);
}
</style>
