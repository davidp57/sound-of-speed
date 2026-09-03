import type { Trace } from '../speed/replay'

/**
 * Mesures tirées d'une trace enregistrée.
 *
 * C'est le socle de l'étalonnage : la voiture réelle roule, on garde ce que le
 * GPS a dit, et on en tire des chiffres. Rien ici ne connaît les profils —
 * mesurer une voiture avec les réglages qu'on cherche à corriger n'apprendrait
 * rien.
 *
 * Deux différences avec le conditionnement de `core/speed/conditioner.ts`, qui
 * estime la même pente :
 *
 * 1. **La fenêtre est centrée.** En roulant, on n'a que le passé ; ici la trace
 *    est entière, donc la pente à un instant s'ajuste sur les mesures d'avant
 *    *et* d'après. L'estimation n'a plus de retard, et c'est ce qui permet de
 *    dater correctement le début d'un freinage.
 * 2. **Rien n'est borné par un profil.** Le conditionnement écrête
 *    l'accélération entre `minAccelMs2` et `maxAccelMs2` — deux réglages que
 *    l'étalonnage est justement censé informer. Les mesurer à travers eux
 *    donnerait la borne réglée, jamais la valeur réelle.
 */

/** Fenêtre d'ajustement de la pente, en millisecondes. */
export const SLOPE_WINDOW_MS = 1000
/**
 * Fenêtre servant à chiffrer le bruit de mesure, en millisecondes.
 *
 * Courte à dessein : sur quatre dixièmes de seconde, une vitesse réelle est
 * quasiment une droite, et ce qui s'écarte de la droite est du bruit. Plus long,
 * on compterait la courbure du mouvement comme du bruit.
 */
export const NOISE_WINDOW_MS = 400
/** Plafond de l'élargissement de cette fenêtre quand la cadence est lente. */
export const NOISE_WINDOW_MAX_MS = 1000
/** Nombre de mesures qu'il faut dans la fenêtre pour chiffrer le bruit. */
export const NOISE_MIN_POINTS = 5
/** Bande d'accélération, en m/s², dans laquelle la vitesse est dite tenue. */
export const HELD_BAND_MS2 = 0.25
/** Durée minimale d'un palier, en secondes. */
export const HELD_MIN_S = 2
/**
 * Vitesse en deçà de laquelle un palier ne compte pas, en km/h.
 *
 * Un feu rouge est une accélération nulle qui dure : sans ce plancher, l'arrêt
 * serait la vitesse la plus tenue de toute la trace de ville.
 */
export const HELD_MIN_KMH = 5
/** Vitesse en deçà de laquelle le véhicule est considéré à l'arrêt, en km/h. */
export const STANDSTILL_KMH = 0.8

export interface TracePoint {
  /** Décalage depuis la première mesure, en secondes. */
  t: number
  kmh: number
  /**
   * Pente ajustée sur la fenêtre centrée, en m/s².
   *
   * `null` quand la fenêtre ne porte pas de quoi ajuster : moins de deux
   * mesures, ou toutes au même instant.
   */
  accelMs2: number | null
}

/** Une portion de trace où la vitesse est tenue. */
export interface Plateau {
  /** Début, en secondes depuis la première mesure. */
  startS: number
  durationS: number
  /** Vitesse moyenne pendant le palier, en km/h. */
  kmh: number
}

export interface TraceMeasure {
  count: number
  durationS: number
  /**
   * Intervalle médian entre deux mesures, en millisecondes.
   *
   * La médiane, et non la moyenne : une seule interruption — page mise en veille,
   * tunnel — suffit à rendre la moyenne illisible.
   */
  cadenceMs: number
  /**
   * Écart-type du bruit de mesure, en km/h. `null` quand la cadence est trop
   * lente pour séparer le bruit du mouvement.
   */
  noiseKmh: number | null
  points: TracePoint[]
  /** Vitesse la plus basse et la plus haute rencontrées, en km/h. */
  minKmh: number
  maxKmh: number
  /**
   * Vitesse au 99ᵉ centile, en km/h : la maximale réellement pratiquée.
   *
   * Le maximum brut retiendrait un saut isolé du GPS, et proposerait donc une
   * vitesse plausible calée sur une mesure aberrante.
   */
  practicedMaxKmh: number
  /** Accélération soutenue la plus forte, en m/s². `null` si indéterminable. */
  peakAccelMs2: number | null
  /** Décélération soutenue la plus forte, en m/s². Négative. */
  peakDecelMs2: number | null
  plateaus: Plateau[]
}

/**
 * Mesure une trace de bout en bout.
 *
 * La fenêtre de pente est un paramètre, avec une valeur par défaut : c'est ce
 * qui permet de vérifier une fenêtre proposée sur la trace même qui l'a
 * proposée, au lieu de la croire sur parole.
 */
export function measureTrace(trace: Trace, slopeWindowMs = SLOPE_WINDOW_MS): TraceMeasure {
  const points = toPoints(trace, slopeWindowMs)
  const cadenceMs = medianGapMs(points)

  const slopes: number[] = []
  for (const point of points) {
    const accel = point.accelMs2
    if (accel !== null) slopes.push(accel)
  }

  const speeds = points.map((p) => p.kmh)

  return {
    count: points.length,
    durationS: points.length > 0 ? (points[points.length - 1]?.t ?? 0) : 0,
    cadenceMs,
    noiseKmh: measureNoise(points, cadenceMs),
    points,
    minKmh: speeds.length > 0 ? Math.min(...speeds) : 0,
    maxKmh: speeds.length > 0 ? Math.max(...speeds) : 0,
    practicedMaxKmh: percentile(speeds, 0.99),
    // Le 95ᵉ centile plutôt que le maximum : la fenêtre d'une seconde moyenne
    // déjà le bruit, mais une mesure aberrante isolée y survit assez pour
    // déplacer le maximum. Un centile écarte l'accident sans écarter la crête.
    peakAccelMs2: slopes.length > 0 ? percentile(slopes, 0.95) : null,
    peakDecelMs2: slopes.length > 0 ? percentile(slopes, 0.05) : null,
    plateaus: findPlateaus(points),
  }
}

/**
 * Convertit les mesures brutes en points datés, pente comprise.
 *
 * Les horodatages sont ramenés à la première mesure : les valeurs brutes sont de
 * grands nombres, et leurs carrés perdraient de la précision dans l'ajustement.
 */
function toPoints(trace: Trace, slopeWindowMs: number): TracePoint[] {
  const samples = trace.samples
    .filter((s) => Number.isFinite(s.kmh) && Number.isFinite(s.at))
    .slice()
    .sort((a, b) => a.at - b.at)

  const origin = samples[0]?.at ?? 0
  const raw = samples.map((s) => ({ t: (s.at - origin) / 1000, kmh: Math.max(0, s.kmh) }))

  return raw.map((point, index) => ({
    t: point.t,
    kmh: point.kmh,
    accelMs2: fitSlope(raw, index, Math.max(0, slopeWindowMs) / 1000),
  }))
}

/**
 * Pente des moindres carrés sur la fenêtre centrée autour d'un point, en m/s².
 *
 * Le même estimateur que le conditionnement, pour la même raison : avec trente
 * mesures dans la fenêtre, le bruit se divise par la racine de trente au lieu
 * d'être seuillé. La différence est que la fenêtre est ici symétrique.
 */
function fitSlope(
  points: { t: number; kmh: number }[],
  index: number,
  windowS: number,
): number | null {
  const centre = points[index]
  if (!centre) return null
  const half = windowS / 2

  let lo = index
  while (lo > 0) {
    const point = points[lo - 1]
    if (!point || centre.t - point.t > half) break
    lo -= 1
  }
  let hi = index
  while (hi < points.length - 1) {
    const point = points[hi + 1]
    if (!point || point.t - centre.t > half) break
    hi += 1
  }

  // Au moins deux mesures, quoi qu'il arrive : à un hertz, une fenêtre d'une
  // seconde centrée ne contient que la mesure du milieu, et l'on n'estimerait
  // plus aucune pente. Le conditionnement garde le même plancher, pour la même
  // raison — deux points ne permettent aucune moyenne, mais ils donnent une
  // pente, là où un seul n'en donne pas.
  if (lo === hi) {
    if (index > 0) lo = index - 1
    if (index < points.length - 1) hi = index + 1
  }

  let sx = 0
  let sy = 0
  let sxx = 0
  let sxy = 0
  let n = 0
  for (let i = lo; i <= hi; i += 1) {
    const point = points[i]
    if (!point) continue
    const x = point.t - centre.t
    sx += x
    sy += point.kmh
    sxx += x * x
    sxy += x * point.kmh
    n += 1
  }

  if (n < 2) return null
  const spread = n * sxx - sx * sx
  if (!(Math.abs(spread) > 1e-9)) return null

  const slopeKmhS = (n * sxy - sx * sy) / spread
  return Number.isFinite(slopeKmhS) ? slopeKmhS / 3.6 : null
}

/**
 * Écart-type du bruit de mesure, en km/h.
 *
 * On ajuste une droite sur une fenêtre courte centrée, et on regarde de combien
 * la mesure du milieu s'en écarte. Le résidu d'un ajustement à `m` points sous
 * -estime l'écart-type d'un facteur `√((m − 2) / m)` — deux degrés de liberté
 * partent dans la droite — et la correction est appliquée.
 *
 * **Ce que le chiffre contient en trop** : la courbure réelle du mouvement, que
 * la droite ne peut pas suivre. Mesuré sur une rampe pure, elle ne coûte rien —
 * une rampe *est* une droite. Sur une vitesse qui ondule, le surplus reste sous
 * le dixième de km/h tant que la fenêtre est courte. C'est donc une borne haute,
 * et c'est le bon sens de l'erreur : mieux vaut croire le GPS plus bruyant qu'il
 * n'est que régler le lissage trop vif.
 *
 * Rend `null` quand la cadence est trop lente : avec une mesure par seconde, il
 * n'y a rien à moyenner et l'on ne peut pas distinguer le bruit du mouvement.
 */
function measureNoise(points: TracePoint[], cadenceMs: number): number | null {
  if (points.length < NOISE_MIN_POINTS) return null

  // La fenêtre s'élargit quand le GPS parle peu, jusqu'à un plafond au-delà
  // duquel on mesurerait la courbure plutôt que le bruit.
  const windowMs = Math.min(NOISE_WINDOW_MAX_MS, Math.max(NOISE_WINDOW_MS, 4 * cadenceMs))
  const half = windowMs / 2000

  let squares = 0
  let degrees = 0
  for (let index = 0; index < points.length; index += 1) {
    const fit = fitAt(points, index, half)
    if (!fit || fit.n < NOISE_MIN_POINTS) continue
    const centre = points[index]
    if (!centre) continue
    const residual = centre.kmh - fit.value
    squares += residual * residual
    degrees += 1 - 2 / fit.n
  }

  if (degrees <= 0) return null
  return Math.sqrt(squares / degrees)
}

/** Valeur de la droite ajustée à l'endroit du point central. */
function fitAt(
  points: TracePoint[],
  index: number,
  halfS: number,
): { value: number; n: number } | null {
  const centre = points[index]
  if (!centre) return null

  let sx = 0
  let sy = 0
  let sxx = 0
  let sxy = 0
  let n = 0
  for (let i = index; i >= 0; i -= 1) {
    const point = points[i]
    if (!point || centre.t - point.t > halfS) break
    const x = point.t - centre.t
    sx += x
    sy += point.kmh
    sxx += x * x
    sxy += x * point.kmh
    n += 1
  }
  for (let i = index + 1; i < points.length; i += 1) {
    const point = points[i]
    if (!point || point.t - centre.t > halfS) break
    const x = point.t - centre.t
    sx += x
    sy += point.kmh
    sxx += x * x
    sxy += x * point.kmh
    n += 1
  }

  if (n < 3) return null
  const spread = n * sxx - sx * sx
  if (!(Math.abs(spread) > 1e-9)) return null

  const slope = (n * sxy - sx * sy) / spread
  const intercept = (sy - slope * sx) / n
  // L'abscisse du point central vaut zéro par construction : la valeur ajustée
  // est donc l'ordonnée à l'origine.
  return { value: intercept, n }
}

/** Intervalle médian entre deux mesures, en millisecondes. */
function medianGapMs(points: TracePoint[]): number {
  const gaps: number[] = []
  for (let i = 1; i < points.length; i += 1) {
    const previous = points[i - 1]
    const current = points[i]
    if (!previous || !current) continue
    // Arrondi à la milliseconde, comme la télémétrie : les horodatages d'une
    // position sont entiers, et le passage par les secondes laisserait sinon
    // traîner des millionièmes.
    const gap = Math.round((current.t - previous.t) * 1000)
    if (gap > 0) gaps.push(gap)
  }
  return gaps.length > 0 ? percentile(gaps, 0.5) : 0
}

/**
 * Portions où la vitesse est tenue.
 *
 * Une croisière, ici, n'est rien d'autre qu'une suite de mesures dont
 * l'accélération reste dans une bande étroite assez longtemps. C'est ce dont on
 * tire les vitesses que l'on pratique vraiment — la seule chose qui puisse
 * remplacer le souvenir qu'on en a.
 */
function findPlateaus(points: TracePoint[]): Plateau[] {
  const plateaus: Plateau[] = []
  let start = -1
  let sum = 0
  let count = 0

  const close = (end: number): void => {
    if (start < 0) return
    const from = points[start]
    const to = points[end]
    if (from && to && count > 0) {
      const durationS = to.t - from.t
      if (durationS >= HELD_MIN_S) {
        plateaus.push({ startS: from.t, durationS, kmh: sum / count })
      }
    }
    start = -1
    sum = 0
    count = 0
  }

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index]
    if (!point) continue
    const accel = point.accelMs2
    const held = accel !== null && Math.abs(accel) <= HELD_BAND_MS2 && point.kmh >= HELD_MIN_KMH
    if (held) {
      if (start < 0) start = index
      sum += point.kmh
      count += 1
    } else {
      close(index - 1)
    }
  }
  close(points.length - 1)

  return plateaus
}

/**
 * Centile d'une série, par interpolation linéaire entre les deux rangs voisins.
 *
 * Écrit ici plutôt qu'importé : quatre lignes, et c'est le seul endroit du
 * projet qui en a besoin.
 */
export function percentile(values: number[], fraction: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const rank = (sorted.length - 1) * Math.min(1, Math.max(0, fraction))
  const low = Math.floor(rank)
  const high = Math.ceil(rank)
  const lowValue = sorted[low] ?? 0
  const highValue = sorted[high] ?? lowValue
  return lowValue + (highValue - lowValue) * (rank - low)
}
