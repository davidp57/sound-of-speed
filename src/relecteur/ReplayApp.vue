<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import TrackMap from './TrackMap.vue'
import DialGauge from '../ui/components/DialGauge.vue'
import {
  atLeastDurationMs,
  listSessions,
  loadSession,
  type SessionEntry,
} from '../core/session/read'
import { deleteTrip, downloadTrip, pinTrip, retentionVerdict } from '../core/session/manage'
import { sessionFromArchive } from '../core/session/archive'
import { stateAt, trackAt, type Session } from '../core/session/model'
import { findGearChanges, findShiftBursts, recordedShifts } from '../core/session/shifts'
import { accelProfile, profileRuns } from '../core/session/profile'
import { profileFromHeader, whyNoSound } from '../core/session/header'
import { SessionPlayback, type PlaybackFrame } from '../core/session/playback'
import { AudioEngine } from '../core/audio/engine'
import type { Profile } from '../core/preset/schema'

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

/**
 * Le son, et pourquoi il ne se met pas en route tout seul.
 *
 * Un navigateur refuse de produire du son sans un geste de l'utilisateur, et
 * c'est tant mieux : on ouvre le relecteur pour regarder un trajet aussi
 * souvent que pour l'écouter. Le bouton est donc explicite, et l'activation
 * charge la banque de la capture — quelques mégaoctets qu'il serait absurde de
 * tirer à chaque ouverture.
 */
const audio = new AudioEngine()
const soundOn = ref(false)
const soundBusy = ref(false)
const soundNote = ref('')
let playback: SessionPlayback | null = null
let played: Profile | null = null
const frame = ref<PlaybackFrame | null>(null)

/** Ce que la capture peut faire entendre, ou ce qui l'en empêche. */
const soundImpossible = computed(() => whyNoSound(session.value?.header ?? null))

/**
 * L'écart entre ce que la chaîne recalcule aujourd'hui et ce que la capture a
 * inscrit ce jour-là.
 *
 * C'est la vérification que rien d'autre ne donne : une régression du moteur ou
 * de la boîte se voit ici, sur un trajet réel, sans reprendre la route. Un écart
 * de rapport est plus parlant qu'un écart de régime — il dit que la boîte ne
 * décide plus pareil.
 */
const drift = computed(() => (frame.value === null ? null : SessionPlayback.drift(frame.value)))

const driftLabel = computed(() => {
  const écart = drift.value
  if (écart === null) return ''
  const rapport =
    écart.gear === 0 ? 'même rapport' : `${écart.gear > 0 ? '+' : ''}${écart.gear} rapport`
  return `Écart avec l'enregistré : ${Math.round(écart.rpm)} tr/min, ${rapport}`
})

async function toggleSound(): Promise<void> {
  if (soundOn.value) {
    stopSound()
    return
  }
  const profile = profileFromHeader(session.value?.header ?? null)
  if (profile === null || session.value === null) {
    soundNote.value = soundImpossible.value
    return
  }
  soundBusy.value = true
  soundNote.value = 'Chargement de la banque…'
  try {
    await audio.activate(profile)
    await audio.load(profile)
    played = profile
    playback = new SessionPlayback(profile, session.value)
    playback.seek(at.value)
    soundOn.value = true
    soundNote.value = ''
  } catch (error) {
    soundNote.value = error instanceof Error ? error.message : 'Le son n’a pas pu démarrer.'
  } finally {
    soundBusy.value = false
  }
}

function stopSound(): void {
  audio.mute()
  audio.unload()
  soundOn.value = false
  playback = null
  played = null
  frame.value = null
}

/**
 * Repositionne la chaîne après un déplacement.
 *
 * Elle repart de son repos, calée sur le rapport qui convient à la vitesse
 * d'arrivée : le son se rétablit en une seconde environ, et ce n'est pas un
 * défaut à corriger — un moteur ne saute pas d'un régime à un autre.
 */
function seekSound(): void {
  playback?.seek(at.value)
}

/** Déplacer la tête de lecture, et la chaîne avec elle. */
function goTo(ms: number): void {
  at.value = ms
  seekSound()
}

async function refresh(): Promise<void> {
  busy.value = true
  note.value = ''
  try {
    entries.value = await listSessions()
    if (entries.value.length === 0) {
      // Le relecteur lit sous le compte de **cet** appareil. Ouvert sur un poste
      // qui n'a jamais servi, il ne voit rien — ce n'est pas une panne, et le
      // relier à celui de la voiture est ce qui le remplira.
      note.value =
        'Aucune session sous le compte de cet appareil. Reliez-le à celui de la voiture pour y voir ses trajets.'
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
    const chargé = await loadSession(entry)
    if (jeton !== pending) return
    session.value = chargé.session
    failures.value = chargé.failures
    at.value = 0
    note.value = ''
    gestion.value = false
  } catch (error) {
    if (jeton !== pending) return
    note.value = error instanceof Error ? error.message : 'Session illisible.'
  } finally {
    if (jeton === pending) busy.value = false
  }
}

watch(chosen, (key) => {
  // La banque et la configuration appartiennent à la session : garder le son
  // ouvert ferait entendre la précédente sur le trajet suivant.
  stopSound()
  void open(key)
})

const duration = computed(() => session.value?.durationMs ?? 0)
const reading = computed(() => (session.value ? stateAt(session.value.states, at.value) : null))
const position = computed(() => (session.value ? trackAt(session.value.track, at.value) : null))

/** Les faits marquants, groupés pour ne pas couvrir la barre de rafales. */
const marks = computed(() => {
  const total = duration.value
  if (!session.value || total <= 0) return []
  const groupes = new Map<string, Mark>()
  for (const event of session.value.events) {
    // Les passages ne sont pas des faits marquants : il y en a des centaines
    // par trajet, et ils ont déjà leurs deux représentations — le relief les
    // dessine tous, la barre ne retient que les enchaînements.
    if (event.kind === 'shift') continue
    // Un centième de la durée : deux rejets à deux secondes d'écart sur une
    // heure de trajet sont le même moment, et deux marques superposées ne se
    // distinguent pas.
    const cellule = `${event.kind}:${Math.round((event.at / total) * 100)}`
    const trouvé = groupes.get(cellule)
    if (trouvé) trouvé.count += 1
    else groupes.set(cellule, { at: event.at, kind: event.kind, count: 1 })
  }
  const marques = [...groupes.values()]

  // Les enchaînements de rapports ne sont pas inscrits dans un fichier : ils se
  // déduisent des relevés. On les ajoute ici pour qu'ils vivent sur la même
  // barre que les faits du journal — c'est le même geste de repérage.
  for (const rafale of shiftBursts.value) {
    marques.push({
      at: rafale.at,
      kind: rafale.measured ? 'shift' : 'shift-maybe',
      count: rafale.count,
      detail: rafale.measured
        ? `${rafale.count} rapports en ${(rafale.spanMs / 1000).toFixed(1)} s, de la ${rafale.from} à la ${rafale.to}`
        : `${rafale.count} rapports de la ${rafale.from} à la ${rafale.to}, quelque part dans ${(rafale.spanMs / 1000).toFixed(0)} s`,
    })
  }

  return marques
})

/** Les enchaînements de rapports de la session. */
const shiftBursts = computed(() =>
  session.value
    ? findShiftBursts(session.value.states, undefined, undefined, inscrits.value)
    : [],
)

/**
 * Les passages que le journal a inscrits, quand il en a inscrit.
 *
 * Ils datent du 10 septembre 2026 : un trajet enregistré avant n'en a pas, et
 * le relecteur retombe alors sur ce que les relevés laissent deviner.
 */
const inscrits = computed(() =>
  session.value ? recordedShifts(session.value.events) : [],
)

/**
 * Le relief des accélérations, une colonne par pixel de la barre.
 *
 * La largeur est relevée à l'affichage : mille colonnes pour une barre qui en
 * fait mille, et pas trente-six mille points pour un dessin de vingt pixels de
 * haut.
 */
const barWidth = ref(600)
const relief = computed(() =>
  session.value ? accelProfile(session.value.states, duration.value, barWidth.value) : null,
)

/**
 * Les passages de rapport, posés sur l'axe du relief.
 *
 * Un chevron par passage : vers le haut pour une montée, vers le bas pour un
 * rétrogradage, et d'autant plus large qu'il franchit de rapports. On voit
 * ainsi d'un coup d'œil que la boîte a monté en accélérant — ou qu'elle a
 * rétrogradé alors qu'on accélérait, ce qui se remarque tout de suite quand
 * les deux se lisent sur la même ligne.
 */
/**
 * La courbe du relief, en tronçons de polyligne.
 *
 * Deux fois le même tracé : une fois découpé au-dessus de l'axe, une fois en
 * dessous. C'est ce qui donne une courbe **continue** dont la couleur change au
 * passage par zéro — deux courbes séparées se rejoindraient mal, et un dégradé
 * placerait la limite ailleurs qu'à zéro.
 */
const reliefRuns = computed(() => {
  const profil = relief.value
  if (!profil || profil.peak <= 0) return []
  return profileRuns(profil.columns).map((run) =>
    run
      .map((point) => `${point.x},${(14 - (point.value / profil.peak) * 12).toFixed(2)}`)
      .join(' '),
  )
})

const gearChanges = computed(() =>
  session.value ? findGearChanges(session.value.states, inscrits.value) : [],
)

const timeline = ref<HTMLElement | null>(null)

/**
 * Le chevron d'un passage, en coordonnées du relief.
 *
 * Sa largeur est en colonnes et sa hauteur en unités du dessin : le `viewBox`
 * n'ayant pas le même rapport que la barre à l'écran, un triangle « carré » en
 * coordonnées y paraîtrait écrasé. On le dessine donc large de quelques
 * colonnes, ce qui donne à l'écran une pointe fine et visible.
 */
function chevron(at: number, up: boolean, steps: number): string {
  const total = duration.value
  if (total <= 0) return ''
  const x = (at / total) * barWidth.value
  const demi = Math.max(2, barWidth.value / 300)
  const haut = Math.min(6, 3 + steps)
  return up
    ? `${x},${14 - haut} ${x - demi},14 ${x + demi},14`
    : `${x},${14 + haut} ${x - demi},14 ${x + demi},14`
}

function mesurerBarre(): void {
  const largeur = timeline.value?.getBoundingClientRect().width
  if (largeur && largeur > 0) barWidth.value = Math.round(largeur)
}

onMounted(() => {
  mesurerBarre()
  window.addEventListener('resize', mesurerBarre)
})
onBeforeUnmount(() => window.removeEventListener('resize', mesurerBarre))

const KIND_LABELS: Record<string, string> = {
  shift: 'rapports enchaînés',
  'shift-maybe': 'rapports enchaînés (durée non mesurée)',
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

interface Mark {
  at: number
  kind: string
  count: number
  detail?: string
}

function showMark(event: MouseEvent, mark: Mark): void {
  const barre = (event.currentTarget as HTMLElement).parentElement
  const boite = barre?.getBoundingClientRect()
  const quoi = mark.detail ?? `${label(mark.kind)}${mark.count > 1 ? ` — ${mark.count} fois` : ''}`
  hovered.value = {
    x: boite ? event.clientX - boite.left : 0,
    text: `${label(mark.kind)} · ${clock(mark.at)}${mark.detail ? ` — ${quoi}` : mark.count > 1 ? ` — ${mark.count} fois` : ''}`,
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

/**
 * L'horloge du lecteur.
 *
 * Vingt fois par seconde suffit à l'œil ; le son, lui, demande soixante — la
 * boîte a des temporisations de trois dixièmes, et le moteur une inertie qu'un
 * pas de cinquante millisecondes intègre grossièrement.
 */
function play(): void {
  if (playing.value || duration.value <= 0) return
  playing.value = true
  lastTick = performance.now()
  timer = setInterval(
    () => {
      const now = performance.now()
      const dt = now - lastTick
      lastTick = now
      at.value = Math.min(duration.value, at.value + dt * rate.value)
      driveSound((dt * rate.value) / 1000)
      if (at.value >= duration.value) stop()
    },
    soundOn.value ? 16 : 50,
  )
}

/**
 * Pousse un pas dans la chaîne et applique le mixage.
 *
 * Le pas suivi est celui de la **session**, pas celui de l'horloge : à double
 * vitesse, deux secondes de trajet passent en une seconde de montre, et le
 * moteur doit monter comme il l'a fait. C'est aussi pourquoi un rejeu accéléré
 * sonne aigu — le trajet va plus vite, pas la bande.
 */
function driveSound(dtSession: number): void {
  if (!soundOn.value || playback === null || played === null) return
  const next = playback.tick(dtSession, at.value)
  frame.value = next
  if (next === null) return
  audio.update(played, next.engine, {
    isShifting: next.gearbox.isShifting,
    progress: next.gearbox.shiftProgress,
  })
}

function stop(): void {
  playing.value = false
  if (timer !== null) clearInterval(timer)
  timer = null
  // À l'arrêt, la chaîne est figée : la laisser jouer tiendrait un régime
  // immobile, ce qu'aucun moteur ne fait.
  if (soundOn.value) audio.mute()
}

function toggle(): void {
  if (playing.value) stop()
  else {
    // Le mixage a été coupé à la pause : la chaîne repart d'où la tête de
    // lecture se trouve, plutôt que de reprendre un état vieux de deux minutes.
    if (soundOn.value) seekSound()
    play()
  }
}

onBeforeUnmount(() => {
  stop()
  stopSound()
  void audio.dispose()
})

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
 * Ce qu'on lit dans la liste avant d'avoir choisi.
 *
 * La date situe le trajet, la durée dit s'il vaut la peine d'être ouvert. Elle
 * est annoncée comme une borne — « plus de 15 min » — parce que c'est ce que le
 * nombre de tranches établit, et qu'une durée exacte demanderait de charger la
 * session qu'on est justement en train de choisir.
 */
function dureeAnnoncee(entry: SessionEntry): string {
  const ms = atLeastDurationMs(entry)
  return ms === null ? 'journal seul' : ms === 0 ? 'moins de 5 min' : `plus de ${ms / 60_000} min`
}

function sessionLabel(entry: SessionEntry): string {
  return `${stamp(entry.startedAt)} — ${entry.id} — ${dureeAnnoncee(entry)}`
}

/**
 * Le poids d'un trajet, dit dans l'unité qui se lit.
 *
 * Un kilo-octet et un mégaoctet ne veulent pas dire la même chose devant un
 * bouton qui efface : les six départs avortés de la base pèsent un kilo-octet
 * chacun, et c'est ce chiffre-là qui dit qu'on ne perd rien.
 */
function poids(octets: number): string {
  if (octets < 1024) return `${octets} o`
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Kio`
  return `${(octets / (1024 * 1024)).toFixed(1)} Mio`
}

/**
 * Ce qui retient un trajet, ou ce qui manque pour le regarder.
 *
 * Trois états distincts, et les confondre coûterait : **archivé** vient d'une
 * reprise et ne s'efface pas tout seul, **épinglé** est un choix qu'on peut
 * défaire, **pas encore analysé** dit que le profileur n'a pas regardé — donc
 * qu'effacer perdrait ce que ce trajet avait à montrer.
 */
function etat(entry: SessionEntry): string {
  if (entry.exemption === 'archive') return 'archivé'
  if (entry.exemption === 'epingle') return 'épinglé'
  if (entry.pending > 0) return 'pas encore analysé'
  return ''
}

/** Ce dont le trajet est fait, en clair. */
function contenu(entry: SessionEntry): string {
  const traces = entry.files.filter((file) => file.kind === 'capture').length
  const journal = entry.files.length - traces
  const morceaux = []
  if (traces > 0) morceaux.push(`${traces} trace${traces > 1 ? 's' : ''}`)
  if (journal > 0) morceaux.push(`${journal} journal`)
  return morceaux.join(' · ')
}

/**
 * La liste des trajets, et ce qu'on en fait.
 *
 * Ouverte tant qu'aucun trajet n'est chargé : c'est l'écran d'accueil du
 * relecteur. Elle se referme d'elle-même quand on en ouvre un, et se rappelle
 * d'un bouton.
 */
const gestion = ref(true)

/** Le trajet dont l'effacement attend un second geste, et ce qu'il emporterait. */
const aEffacer = ref<SessionEntry | null>(null)
const geste = ref('')

function demanderEffacement(entry: SessionEntry): void {
  aEffacer.value = entry
  geste.value = ''
}

/**
 * Efface pour de bon, après le second geste.
 *
 * Le profil mesuré ne bouge pas : ce que la trace a montré est déjà cumulé, et
 * le cumul ne se défait pas — c'est toute la promesse de la rétention.
 */
async function effacer(entry: SessionEntry): Promise<void> {
  aEffacer.value = null
  busy.value = true
  try {
    const parties = await deleteTrip(entry.key)
    if (parties === null) {
      geste.value = `Le trajet du ${stamp(entry.startedAt)} n’a pas pu être effacé.`
      return
    }
    geste.value =
      parties === 0
        ? 'Ce trajet était déjà parti.'
        : `Trajet du ${stamp(entry.startedAt)} effacé : ${parties} tranche${parties > 1 ? 's' : ''}.`
    oublierLeVerdict()
    // Celui qu'on lisait vient de disparaître : le garder à l'écran ferait
    // relire un trajet qui n'existe plus.
    if (chosen.value === entry.key) {
      chosen.value = ''
      session.value = null
      stopSound()
    }
    await refresh()
  } finally {
    busy.value = false
  }
}

/**
 * Ce que la règle de rétention emporterait, sans rien effacer.
 *
 * On le regarde avant que quoi que ce soit disparaisse : aucun contrôle ne dira
 * qu'un délai est trop court — un mauvais seuil efface des données et rien ne
 * rougit.
 */
const verdict = ref<Awaited<ReturnType<typeof retentionVerdict>>>(null)

/**
 * Le verdict vieillit dès qu'on touche à un trajet.
 *
 * Un verdict périmé qui nomme encore un trajet qu'on vient d'effacer se lit
 * comme un effacement qui n'a pas pris. On l'efface plutôt que de le recalculer
 * sans qu'on l'ait demandé : c'est un regard qu'on porte, pas un compteur.
 */
function oublierLeVerdict(): void {
  verdict.value = null
}

async function voirLaRegle(): Promise<void> {
  busy.value = true
  try {
    verdict.value = await retentionVerdict()
    if (verdict.value === null) geste.value = 'La règle de rétention n’a pas répondu.'
  } finally {
    busy.value = false
  }
}

/** Les raisons de retenir, comptées : « 14 archivés, 2 trop récents ». */
const raisonsRetenues = computed(() => {
  const comptes = new Map<string, number>()
  for (const retenu of verdict.value?.retenus ?? []) {
    comptes.set(retenu.raison, (comptes.get(retenu.raison) ?? 0) + 1)
  }
  return [...comptes].map(([raison, combien]) => `${combien} ${raison}${combien > 1 ? 's' : ''}`)
})

/**
 * Où l'on en est de la borne d'épingles, tel que le serveur le dit.
 *
 * Connu seulement après un premier épinglage : l'afficher d'avance demanderait
 * une requête de plus pour un chiffre dont on n'a besoin qu'au moment de poser
 * une épingle.
 */
const epingles = ref<{ epinglees: number; borne: number } | null>(null)

/**
 * Épingle un trajet, ou le décroche.
 *
 * L'épingle est un choix — on garde ce trajet —, et le nombre en est borné. Un
 * refus dit quoi faire : décrocher autre chose, ou emporter le trajet.
 */
async function basculerEpingle(entry: SessionEntry): Promise<void> {
  busy.value = true
  geste.value = ''
  try {
    const rendu = await pinTrip(entry.key, entry.exemption !== 'epingle')
    if (rendu === null) {
      geste.value = 'L’épingle n’a pas pu être posée : le serveur n’a pas répondu.'
      return
    }

    epingles.value = { epinglees: rendu.epinglees, borne: rendu.borne }
    oublierLeVerdict()
    if (rendu.etat === 'borne atteinte') {
      geste.value = `Borne atteinte : ${rendu.borne} trajets épinglés. Décrochez-en un, ou téléchargez celui-ci pour le garder hors du serveur.`
      return
    }
    if (rendu.etat === 'archivé') {
      geste.value = 'Ce trajet vient d’une reprise : il est déjà retenu, et l’épingle ne lui sert à rien.'
      return
    }
    await refresh()
  } finally {
    busy.value = false
  }
}

/**
 * Rouvre une archive prise sur le disque.
 *
 * Sans compte et sans serveur : c'est ce qui ferme la boucle de l'archive. Un
 * relecteur ouvert ailleurs, qui ne peut rien lister, sait quand même relire un
 * trajet qu'on lui donne.
 */
const fichierArchive = ref<HTMLInputElement | null>(null)

async function ouvrirArchive(evenement: Event): Promise<void> {
  const fichier = (evenement.target as HTMLInputElement).files?.[0]
  if (fichier === undefined) return

  stop()
  stopSound()
  busy.value = true
  note.value = `Ouverture de ${fichier.name}…`
  // Le jeton du chargement en cours : une archive et une session du serveur ne
  // doivent pas s'écraser l'une l'autre.
  const jeton = ++pending
  try {
    const lu = await sessionFromArchive(new Uint8Array(await fichier.arrayBuffer()))
    if (jeton !== pending) return
    chosen.value = ''
    session.value = lu.session
    failures.value = lu.failures
    at.value = 0
    note.value = `${fichier.name} — relu depuis le disque.`
    gestion.value = false
  } catch (erreur) {
    if (jeton !== pending) return
    note.value = erreur instanceof Error ? erreur.message : 'Archive illisible.'
  } finally {
    if (jeton === pending) busy.value = false
    // Sans cela, rouvrir le même fichier ne déclencherait rien.
    ;(evenement.target as HTMLInputElement).value = ''
  }
}

/**
 * Emporte un trajet sur le disque.
 *
 * C'est la porte de sortie qui rend l'effacement acceptable : l'archive longue
 * est chez l'utilisateur, pas sur le serveur. Elle descend par une requête et
 * non par un lien, le dossier n'étant pas lisible sans mot de passe.
 */
async function telecharger(entry: SessionEntry): Promise<void> {
  busy.value = true
  geste.value = ''
  try {
    const archive = await downloadTrip(entry.key)
    if (archive === null) {
      geste.value = `L’archive du trajet du ${stamp(entry.startedAt)} n’a pas pu être tirée.`
      return
    }

    const adresse = URL.createObjectURL(archive.blob)
    const lien = document.createElement('a')
    lien.href = adresse
    lien.download = archive.filename
    lien.click()
    // L'adresse d'objet tient la mémoire tant qu'on ne la rend pas.
    URL.revokeObjectURL(adresse)

    geste.value = `${archive.filename} — ${poids(archive.blob.size)}.`
  } finally {
    busy.value = false
  }
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
            {{ sessionLabel(entry) }} ({{ entry.files.length }}
            {{ entry.files.length > 1 ? 'fichiers' : 'fichier' }})
          </option>
        </select>
        <button :disabled="busy" @click="refresh()">Rafraîchir</button>
        <button :aria-pressed="gestion" @click="gestion = !gestion">Trajets</button>
        <button
          :disabled="busy"
          title="Relire une archive téléchargée, sans passer par le serveur"
          @click="fichierArchive?.click()"
        >
          Ouvrir une archive…
        </button>
        <input
          ref="fichierArchive"
          type="file"
          accept="application/zip,.zip"
          hidden
          @change="ouvrirArchive"
        />
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

    <!--
      Les trajets du serveur, et ce qu'on en fait.

      Tout se passe ici : on ne trie pas ses archives au volant, et l'application
      de la voiture ne gagne aucun écran. La liste dit ce que chaque trajet pèse
      et ce qui le retient, parce que c'est ce qu'on a besoin de savoir avant
      d'effacer.
    -->
    <section v-if="gestion && entries.length > 0" class="panel trajets">
      <table>
        <thead>
          <tr>
            <th>Trajet</th>
            <th>Durée</th>
            <th>Contenu</th>
            <th>Poids</th>
            <th>État</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="entry in entries" :key="entry.key" :class="{ courant: chosen === entry.key }">
            <td>
              {{ stamp(entry.startedAt) }}
              <span class="muted">{{ entry.id }}</span>
            </td>
            <td>{{ dureeAnnoncee(entry) }}</td>
            <td>{{ contenu(entry) }}</td>
            <td>{{ poids(entry.bytes) }}</td>
            <td>{{ etat(entry) }}</td>
            <td class="actions">
              <button :disabled="busy" @click="chosen = entry.key">Ouvrir</button>
              <button :disabled="busy" @click="telecharger(entry)">Télécharger</button>
              <button
                v-if="entry.exemption !== 'archive'"
                :disabled="busy"
                :aria-pressed="entry.exemption === 'epingle'"
                :title="
                  entry.exemption === 'epingle'
                    ? 'Rendre ce trajet effaçable par la règle'
                    : 'Garder ce trajet malgré la règle'
                "
                @click="basculerEpingle(entry)"
              >
                {{ entry.exemption === 'epingle' ? '★ Épinglé' : '☆ Épingler' }}
              </button>
              <button :disabled="busy" @click="demanderEffacement(entry)">Effacer</button>
            </td>
          </tr>
        </tbody>
      </table>

      <!--
        La confirmation dit ce qui part avant que cela ne parte : un effacement
        qui surprend est un effacement qu'on regrette.
      -->
      <p v-if="aEffacer" class="confirm">
        Effacer le trajet du {{ stamp(aEffacer.startedAt) }} ?
        {{ aEffacer.files.length }} tranche{{ aEffacer.files.length > 1 ? 's' : '' }},
        {{ poids(aEffacer.bytes) }}. Ce qu'il a montré reste dans le profil mesuré ; le trajet,
        lui, ne se relira plus que depuis une archive téléchargée.
        <span class="confirm-actions">
          <button @click="effacer(aEffacer)">Effacer</button>
          <button @click="aEffacer = null">Annuler</button>
        </span>
      </p>
      <!--
        Le verdict de la règle : ce qui partirait, et ce qui retient le reste.
        Il n'efface rien — c'est tout son intérêt.
      -->
      <p class="regle">
        <button :disabled="busy" @click="voirLaRegle()">Ce que la règle emporterait</button>
        <span v-if="verdict" class="muted">
          traces : {{ verdict.delais.traces }} jours · journal seul :
          {{ verdict.delais.journal }} jours
        </span>
      </p>

      <template v-if="verdict">
        <p v-if="verdict.aEffacer.length === 0" class="note">
          Rien ne partirait aujourd'hui. Ce qui reste :
          {{ raisonsRetenues.join(', ') || 'aucun trajet' }}.
        </p>
        <template v-else>
          <p class="note">
            {{ verdict.aEffacer.length }} trajet{{ verdict.aEffacer.length > 1 ? 's' : '' }}
            partirai{{ verdict.aEffacer.length > 1 ? 'ent' : 't' }}, {{ poids(verdict.octets) }}.
            Ce qui reste : {{ raisonsRetenues.join(', ') }}.
          </p>
          <ul class="verdict">
            <li v-for="trajet in verdict.aEffacer" :key="trajet.cle">
              {{ stamp(trajet.enregistreLe) }} — {{ trajet.tranches }} tranche{{
                trajet.tranches > 1 ? 's' : ''
              }}, {{ poids(trajet.octets) }}{{ trajet.isole ? ' — dépôt seul' : '' }}
            </li>
          </ul>
        </template>
      </template>

      <p v-if="geste" class="note">{{ geste }}</p>
      <p v-if="epingles" class="note">
        Épingles : {{ epingles.epinglees }} sur {{ epingles.borne }}. Les trajets archivés, venus
        d'une reprise, n'y comptent pas.
      </p>
    </section>

    <template v-if="session">
      <section class="panel lecture">
        <div ref="timeline" class="timeline">
          <input
            type="range"
            min="0"
            :max="duration"
            step="100"
            :value="at"
            @input="goTo(Number(($event.target as HTMLInputElement).value))"
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
              @click="goTo(mark.at)"
            ></span>
            <span v-if="hovered" class="bulle" :style="{ left: `${hovered.x}px` }">
              {{ hovered.text }}
            </span>
          </div>

          <!--
            Le relief : où l'on a accéléré, où l'on a freiné. Quelques pixels
            suffisent à viser un moment sans le chercher — c'est un repère, pas
            une courbe qu'on lit.
          -->
          <svg
            v-if="relief && relief.peak > 0"
            class="relief"
            :viewBox="`0 0 ${relief.columns.length} 28`"
            preserveAspectRatio="none"
            role="img"
            aria-label="Accélérations et freinages du trajet"
          >
            <!--
              Le même tracé deux fois, découpé à l'axe : au-dessus il est vert,
              en dessous il est rouge, et la courbe reste continue au passage
              par zéro.
            -->
            <defs>
              <clipPath id="relief-haut">
                <rect x="0" y="0" :width="relief.columns.length" height="14" />
              </clipPath>
              <clipPath id="relief-bas">
                <rect x="0" y="14" :width="relief.columns.length" height="14" />
              </clipPath>
            </defs>

            <polyline
              v-for="(run, i) in reliefRuns"
              :key="`h${i}`"
              class="monte"
              :points="run"
              clip-path="url(#relief-haut)"
            />
            <polyline
              v-for="(run, i) in reliefRuns"
              :key="`b${i}`"
              class="freine"
              :points="run"
              clip-path="url(#relief-bas)"
            />

            <line class="zero" x1="0" y1="14" :x2="relief.columns.length" y2="14" />

            <!--
              Les passages, posés sur l'axe : un chevron vers le haut pour une
              montée, vers le bas pour un rétrogradage. Les lire sur la même
              ligne que l'effort montre d'un coup ce qu'on cherche — un
              rétrogradage en pleine accélération, une montée en freinant.
            -->
            <polygon
              v-for="(passage, i) in gearChanges"
              :key="`g${i}`"
              class="passage"
              :class="{ retro: !passage.up }"
              :points="chevron(passage.at, passage.up, passage.steps)"
            />
            <line
              class="tete"
              :x1="(at / duration) * relief.columns.length"
              y1="0"
              :x2="(at / duration) * relief.columns.length"
              y2="28"
            />
          </svg>
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

        <!--
          Le son, et ce qu'il vaut.

          Il ne démarre pas tout seul : un navigateur l'interdit sans un geste,
          et le relecteur s'ouvre aussi souvent pour regarder que pour écouter.
        -->
        <div class="controls son">
          <button
            :disabled="soundBusy || soundImpossible !== ''"
            :aria-pressed="soundOn"
            @click="void toggleSound()"
          >
            {{ soundOn ? 'Couper le son' : 'Écouter le trajet' }}
          </button>
          <span v-if="soundImpossible" class="muted">{{ soundImpossible }}</span>
          <span v-else-if="soundNote" class="muted">{{ soundNote }}</span>
          <span v-else-if="soundOn && driftLabel" class="muted">{{ driftLabel }}</span>
          <span v-else-if="soundOn" class="muted">
            La configuration jouée est celle de la capture, pas celle du profil actif.
          </span>
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
          <!--
            La charge : ce que le moteur croit qu'on demande, et donc ce qui
            fait l'effort qu'on entend. Elle est calculée, jamais mesurée — la
            voiture ne dit pas ce que fait le pied —, et c'est pour cela qu'elle
            se lit à côté du rapport plutôt que sur un cadran : un cadran
            suggérerait un instrument, et il n'y en a pas.
          -->
          <div class="charge">
            <div class="jauge" role="img" :aria-label="`charge ${(reading.value.load * 100).toFixed(0)} %`">
              <span class="remplie" :style="{ width: `${Math.min(100, reading.value.load * 100)}%` }"></span>
            </div>
            <span class="unite">
              accélérateur {{ (reading.value.load * 100).toFixed(0) }} %
            </span>
          </div>

          <p class="appoint">{{ reading.value.accelMs2.toFixed(2) }} m/s²</p>
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

.mark.shift {
  background: #7e57c2;
}

/* Déduit, pas mesuré : la même couleur, en retrait. */
.mark.shift-maybe {
  background: #7e57c2;
  opacity: 0.5;
}

/*
  Le relief. Vingt pixels : assez pour distinguer une reprise d'un coup de
  frein, pas assez pour qu'on le prenne pour une courbe à lire.
*/
.relief {
  display: block;
  width: 100%;
  height: 28px;
  margin-top: 0.2rem;
}

/* Une courbe, pas un remplissage : le trait suit la valeur, l'axe la coupe. */
.relief .monte,
.relief .freine {
  fill: none;
  stroke-width: 1.5;
  vector-effect: non-scaling-stroke;
  stroke-linejoin: round;
}

.relief .monte {
  stroke: #4caf50;
}

.relief .freine {
  stroke: #e53935;
}

/* Le chevron d'un passage : discret, mais lisible sur le vert comme sur le rouge. */
.relief .passage {
  fill: #d7cbe8;
}

.relief .passage.retro {
  fill: #7e57c2;
}

.relief .zero {
  stroke: var(--line);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.relief .tete {
  stroke: #e8a33d;
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
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

/* Le son sur sa propre ligne : c'est une autre nature que le transport. */
.controls.son {
  margin-top: 0.6rem;
  padding-top: 0.6rem;
  border-top: 1px solid var(--line);
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

/*
  La jauge de charge. Pleine largeur de sa colonne, sous le rapport : elle se
  lit d'un coup d'œil comme une pédale, sans qu'on ait à lire un nombre.
*/
.charge {
  margin: 0.7rem 0 0;
}

.jauge {
  height: 0.5rem;
  border: 1px solid var(--line);
  border-radius: 3px;
  overflow: hidden;
  background: #10131a;
}

.remplie {
  display: block;
  height: 100%;
  background: #e8a33d;
}

.charge .unite {
  margin-top: 0.2rem;
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

/*
 * La liste des trajets : un tableau, parce qu'on y compare des poids et des
 * dates. Les colonnes se lisent d'un coup d'œil, ce qu'une suite de cartes ne
 * permet pas.
 */
.trajets table {
  border-collapse: collapse;
  width: 100%;
  font-size: 0.9rem;
}

.trajets th {
  color: var(--muted);
  font-size: 0.75rem;
  font-weight: normal;
  letter-spacing: 0.08em;
  text-align: left;
  text-transform: uppercase;
}

.trajets th,
.trajets td {
  border-bottom: 1px solid var(--line);
  padding: 0.35rem 0.5rem 0.35rem 0;
  white-space: nowrap;
}

/* Le trajet ouvert, pour ne pas le chercher dans la liste. */
.trajets .courant td {
  color: var(--accent);
}

.trajets .actions {
  display: flex;
  gap: 0.4rem;
  justify-content: flex-end;
}

/* La règle, et ses seuils, sur une ligne. */
.regle {
  align-items: center;
  display: flex;
  gap: 0.6rem;
  margin: 0.7rem 0 0;
}

.verdict {
  color: var(--muted);
  font-size: 0.85rem;
  margin: 0.3rem 0 0;
  padding-left: 1.2rem;
}

/*
 * La demande de confirmation : encadrée, pour qu'on la lise. Elle dit ce qui
 * part avant que cela ne parte.
 */
.confirm {
  background: var(--panel);
  border: 1px solid var(--accent);
  border-radius: 8px;
  font-size: 0.85rem;
  line-height: 1.5;
  margin: 0.6rem 0 0;
  padding: 0.7rem 0.9rem;
}

.confirm-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.6rem;
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
