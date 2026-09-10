/**
 * Une session enregistrée, telle qu'on la relit.
 *
 * Deux natures de fichiers décrivent le même trajet, et le relecteur doit
 * savoir lire les deux. Le **journal** raconte : un relevé complet toutes les
 * dix secondes, une position par seconde, et les faits marquants. La
 * **capture** rejoue : tout, à la cadence de l'appareil, avec la configuration
 * en tête.
 *
 * Les sessions des 8, 9 et 10 septembre 2026 n'ont que leur journal — elles
 * sont antérieures à la capture continue. Elles doivent rester relisibles, et
 * c'est pourquoi ce module ne suppose jamais la présence de l'un ou de l'autre.
 *
 * **Ce qui est mesuré et ce qui est deviné se distinguent.** Entre deux relevés
 * espacés de dix secondes, une valeur affichée est une interpolation ; la
 * présenter comme une mesure ferait croire à un passage de rapport qu'on n'a
 * jamais observé.
 */

/** Un relevé de conduite, tel qu'un fichier le porte. */
export interface StatePoint {
  at: number
  kmh: number
  rpm: number
  gear: number
  load: number
  accelMs2: number
}

/** Une position, avec la vitesse qui l'accompagne. */
export interface TrackPoint {
  at: number
  lat: number
  lon: number
  kmh: number
}

/** Un fait daté qui n'est pas un relevé. */
export interface SessionEvent {
  at: number
  kind: string
  data: Record<string, unknown>
}

export interface Session {
  /** Identifiant tiré du nom des fichiers. */
  id: string
  /** Début, en millisecondes, lu dans le nom des fichiers. */
  startedAt: number
  /** Durée couverte, en millisecondes. */
  durationMs: number
  /** Ce que la configuration disait, quand une capture l'a inscrite. */
  header: Record<string, unknown> | null
  states: StatePoint[]
  track: TrackPoint[]
  events: SessionEvent[]
  /** Ce dont la session est faite, pour le dire à l'écran. */
  sources: { journal: number; capture: number }
}

/** Un fichier rapatrié, déjà décompressé. */
export interface SessionFile {
  /** Nom nu, tel qu'il est sur le serveur. */
  name: string
  /** Le dossier d'où il vient : c'est lui qui dit la nature. */
  kind: 'journal' | 'capture'
  text: string
}

/**
 * Les fichiers d'une même session, reconnus à leur nom.
 *
 * Le nom porte la date, l'identifiant de session et le rang :
 * `2026-09-10-17-07-47_2geq_004.jsonl`. L'identifiant seul ne suffit pas — il
 * est court, et deux sessions éloignées pourraient le partager ; c'est le
 * couple date et identifiant qui fait la clé.
 */
export function sessionKeyOf(name: string): { key: string; startedAt: number; rank: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})_([a-z0-9]+)_(\d+)\./.exec(name)
  if (!m) return null
  const [, y, mo, d, h, mi, sec, id, rank] = m
  const startedAt = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(sec))
  return { key: `${y}-${mo}-${d}-${h}-${mi}-${sec}_${id}`, startedAt, rank: Number(rank) }
}

/**
 * Assemble une session depuis ses fichiers.
 *
 * Les tranches sont recollées dans l'ordre de leur rang, et non de leur arrivée.
 * Une ligne illisible est ignorée sans emporter le reste : une session tronquée
 * vaut mieux qu'une session refusée, et un fichier déposé depuis une voiture
 * peut l'être en plein milieu d'une ligne.
 */
export function buildSession(id: string, startedAt: number, files: SessionFile[]): Session {
  const ordered = [...files].sort(
    (a, b) => (sessionKeyOf(a.name)?.rank ?? 0) - (sessionKeyOf(b.name)?.rank ?? 0),
  )

  const states: StatePoint[] = []
  const track: TrackPoint[] = []
  const events: SessionEvent[] = []
  let header: Record<string, unknown> | null = null
  const sources = { journal: 0, capture: 0 }

  for (const file of ordered) {
    sources[file.kind] += 1
    for (const ligne of file.text.split('\n')) {
      if (ligne.trim() === '') continue
      let parsed: unknown
      try {
        parsed = JSON.parse(ligne)
      } catch {
        continue
      }
      if (typeof parsed !== 'object' || parsed === null) continue
      const row = parsed as Record<string, unknown>

      if (row['kind'] === 'header') {
        // Réécrit à chaque tranche : le premier suffit, les suivants ne
        // diffèrent que si la configuration a changé, et un événement daté le
        // dit alors.
        header ??= row
        continue
      }

      const at = typeof row['at'] === 'number' ? row['at'] : null
      if (at === null) continue

      // Deux écritures pour le même fait, et il faut les deux.
      //
      // Le journal enveloppe : `{at, kind:'sample', data:{kmh, rpm, …}}`. La
      // capture écrit à plat : `{at, kmh, rpm, …}`, sans genre, parce qu'une
      // ligne sur dix par seconde ne peut pas se payer une enveloppe. Un
      // relevé de journal lu comme un événement laisse une session vide de
      // tout, ce qui s'est vu sur l'essai du 10 septembre.
      const kind = row['kind']
      if (kind === 'sample') {
        const data = row['data']
        if (typeof data === 'object' && data !== null) {
          collectPoint(data as Record<string, unknown>, at, states, track)
        }
        continue
      }

      if (typeof kind === 'string') {
        const data = row['data']
        events.push({
          at,
          kind,
          data: typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {},
        })
        continue
      }

      collectPoint(row, at, states, track)
    }
  }

  states.sort((a, b) => a.at - b.at)
  track.sort((a, b) => a.at - b.at)
  events.sort((a, b) => a.at - b.at)

  const last = Math.max(
    states[states.length - 1]?.at ?? 0,
    track[track.length - 1]?.at ?? 0,
    events[events.length - 1]?.at ?? 0,
  )

  return { id, startedAt, durationMs: last, header, states, track, events, sources }
}

/**
 * Range une ligne de relevé là où elle va.
 *
 * Le journal écrit deux formes : le relevé complet et la position. La capture
 * n'en écrit qu'une, qui porte les deux. On regarde donc les champs présents
 * plutôt que la nature du fichier.
 */
function collectPoint(
  row: Record<string, unknown>,
  at: number,
  states: StatePoint[],
  track: TrackPoint[],
): void {
  const nombre = (clé: string): number | null =>
    typeof row[clé] === 'number' ? (row[clé] as number) : null

  const kmh = nombre('kmh')
  const lat = nombre('lat')
  const lon = nombre('lon')
  if (lat !== null && lon !== null) track.push({ at, lat, lon, kmh: kmh ?? 0 })

  const rpm = nombre('rpm')
  const gear = nombre('gear')
  if (kmh === null || rpm === null || gear === null) return

  states.push({
    at,
    // La capture porte la vitesse brute dans `kmh` et la conditionnée dans
    // `out` ; le journal n'écrit que la conditionnée. C'est celle-ci qu'on
    // affiche : c'est elle qui a piloté le son.
    kmh: nombre('out') ?? kmh,
    rpm,
    gear,
    load: nombre('load') ?? 0,
    accelMs2: nombre('ms2') ?? nombre('accel') ?? 0,
  })
}

/**
 * Le premier point à cet instant ou après, par dichotomie.
 *
 * Et non par un parcours. La lecture interroge vingt fois par seconde, et une
 * capture d'une heure porte trente-six mille points : un parcours en balaierait
 * la moitié à chaque image. Les points sont triés, la dichotomie est gratuite.
 */
function firstAtOrAfter(points: { at: number }[], at: number): number {
  let bas = 0
  let haut = points.length
  while (bas < haut) {
    const milieu = (bas + haut) >> 1
    if ((points[milieu] as { at: number }).at < at) bas = milieu + 1
    else haut = milieu
  }
  return bas < points.length ? bas : -1
}

export interface Reading<T> {
  value: T
  /** Faux quand la valeur est interpolée entre deux relevés. */
  measured: boolean
  /** Écart au relevé le plus proche, en millisecondes. */
  offsetMs: number
}

/**
 * Le relevé à un instant donné.
 *
 * Interpolé linéairement entre les deux relevés qui l'encadrent, sauf le
 * rapport, qui ne s'interpole pas : entre la troisième et la quatrième il n'y a
 * pas de trois et demi, et un chiffre qui n'existe pas se lit comme une mesure.
 * On garde celui du relevé précédent.
 */
export function stateAt(states: StatePoint[], at: number): Reading<StatePoint> | null {
  if (states.length === 0) return null

  const i = firstAtOrAfter(states, at)
  if (i === -1) {
    const last = states[states.length - 1] as StatePoint
    return { value: last, measured: false, offsetMs: at - last.at }
  }
  const after = states[i] as StatePoint
  if (i === 0) return { value: after, measured: after.at === at, offsetMs: after.at - at }

  const before = states[i - 1] as StatePoint
  if (after.at === at) return { value: after, measured: true, offsetMs: 0 }

  const span = after.at - before.at
  const k = span > 0 ? (at - before.at) / span : 0
  const mêle = (a: number, b: number): number => a + (b - a) * k

  return {
    value: {
      at,
      kmh: mêle(before.kmh, after.kmh),
      rpm: mêle(before.rpm, after.rpm),
      gear: before.gear,
      load: mêle(before.load, after.load),
      accelMs2: mêle(before.accelMs2, after.accelMs2),
    },
    measured: false,
    offsetMs: Math.min(at - before.at, after.at - at),
  }
}

/** La position à un instant donné, interpolée de la même façon. */
export function trackAt(track: TrackPoint[], at: number): TrackPoint | null {
  if (track.length === 0) return null
  const i = firstAtOrAfter(track, at)
  if (i === -1) return track[track.length - 1] as TrackPoint
  const after = track[i] as TrackPoint
  if (i === 0) return after
  const before = track[i - 1] as TrackPoint
  const span = after.at - before.at
  const k = span > 0 ? (at - before.at) / span : 0
  return {
    at,
    lat: before.lat + (after.lat - before.lat) * k,
    lon: before.lon + (after.lon - before.lon) * k,
    kmh: before.kmh + (after.kmh - before.kmh) * k,
  }
}
