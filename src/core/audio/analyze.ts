/**
 * Analyse d'un échantillon moteur.
 *
 * Le régime d'ancrage — celui auquel la prise a été enregistrée — détermine la
 * justesse, puisque c'est lui qui fixe le facteur de lecture. On peut le mesurer :
 * un quatre temps produit une raie d'allumage à `régime ÷ 120 × cylindres`, avec
 * ses harmoniques au-dessus.
 *
 * Mais il faut être honnête sur deux limites, sous peine de rendre un chiffre
 * faux avec assurance.
 *
 * D'abord, **l'ambiguïté d'octave**. Le pic le plus fort d'un spectre de moteur
 * n'est presque jamais la fondamentale, et une corrélation harmonique confond
 * volontiers une fréquence avec sa moitié ou son tiers : les harmoniques du
 * multiple sont incluses dans celles du sous-multiple. Aucun critère purement
 * spectral ne tranche de façon fiable sur un signal aussi dense. On rend donc
 * plusieurs candidats classés, à départager à l'oreille — un aller-retour de
 * quelques secondes dans l'éditeur, contre une valeur unique parfois fausse.
 *
 * Ensuite, **les prises en rampe**. Une montée en régime n'a pas un régime, elle
 * en a une plage. Analyser plusieurs fenêtres réparties dans le fichier permet de
 * le détecter et de le dire, au lieu de moyenner en silence.
 */

/** Nombre de points par fenêtre. Résolution d'environ 1,5 Hz à 48 kHz. */
const FFT_SIZE = 32768
/** Nombre de fenêtres réparties dans le fichier, pour déceler une dérive. */
const WINDOW_COUNT = 6
/** Bornes de la recherche, en tours par minute. */
const MIN_RPM = 400
const MAX_RPM = 14000
/** Pas de recherche, en proportion. */
const RPM_STEP_RATIO = 0.0025
/** Harmoniques prises en compte dans le score. */
const HARMONICS = 12
/** Nombre de candidats rendus. */
const CANDIDATE_COUNT = 6
/**
 * Rapports testés autour du meilleur candidat.
 *
 * Ce sont exactement les confusions que fait une détection de hauteur sur un
 * signal de moteur. L'octave (½, 2) est la plus connue, mais la quinte (⅔, 3/2)
 * est ici la plus fréquente : un moteur émet une raie à chaque demi-tour de
 * vilebrequin, et la corrélation verrouille volontiers sur un ordre intermédiaire
 * plutôt que sur l'ordre d'allumage. Mesuré sur les prises haut régime du jeu de
 * test, la bonne valeur était à 3/2 et à 3 fois le meilleur candidat.
 */
const RELATED_RATIOS = [1 / 3, 1 / 2, 2 / 3, 3 / 2, 2, 3]
/** Au-delà de cette dérive relative entre début et fin, la prise est une rampe. */
const RAMP_THRESHOLD = 0.08

export interface RpmCandidate {
  rpm: number
  firingHz: number
  /** Score de corrélation harmonique, rapporté au meilleur candidat. */
  relativeScore: number
}

export interface SampleAnalysis {
  durationS: number
  sampleRate: number
  channels: number
  /** Niveau crête, de 0 à 1. */
  peak: number
  /**
   * Centroïde spectral, en hertz : le « centre de gravité » du timbre.
   *
   * Il ne donne pas le régime, mais il ordonne les prises d'un même moteur de
   * façon fiable, là où la corrélation harmonique se trompe d'octave. Si une
   * prise a un centroïde plus élevé qu'une autre, elle a été enregistrée plus
   * haut en régime — un garde-fou utile pour repérer un candidat aberrant.
   */
  centroidHz: number
  /** Discontinuité de boucle, rapportée au niveau crête. */
  seamRatio: number

  /**
   * Candidats classés par vraisemblance, le plus probable en tête. Ils sont
   * généralement dans des rapports simples les uns des autres : c'est
   * exactement l'ambiguïté que l'oreille lève en une seconde.
   */
  candidates: RpmCandidate[]

  /** Régime mesuré sur la première fenêtre analysée. */
  startRpm: number
  /** Régime mesuré sur la dernière. */
  endRpm: number
  /**
   * Vrai quand le régime est stable d'un bout à l'autre. Sur une prise en rampe,
   * il n'existe pas de régime d'ancrage unique et le candidat rendu correspond au
   * milieu du fichier.
   */
  steady: boolean
}

export function analyzeSample(buffer: AudioBuffer, cylinders: number): SampleAnalysis {
  const cyl = Math.max(1, cylinders)
  const rpmToHz = cyl / 120
  const binHz = buffer.sampleRate / FFT_SIZE

  const windows = windowOffsets(buffer.length)
  const spectra = windows.map((offset) => magnitudeSpectrum(readWindow(buffer, offset)))

  // Les scores des fenêtres sont additionnés avant de choisir : une raie
  // présente d'un bout à l'autre ressort ainsi mieux qu'un accident local.
  const grid: { rpm: number; score: number }[] = []
  for (let rpm = MIN_RPM; rpm <= MAX_RPM; rpm *= 1 + RPM_STEP_RATIO) {
    const bin = (rpm * rpmToHz) / binHz
    let total = 0
    for (const spectrum of spectra) total += harmonicScore(spectrum, bin)
    grid.push({ rpm, score: total / spectra.length })
  }

  const candidates = pickCandidates(grid, rpmToHz, (rpm) => {
    let total = 0
    for (const spectrum of spectra) total += harmonicScore(spectrum, (rpm * rpmToHz) / binHz)
    return total / spectra.length
  })
  const reference = candidates[0]?.rpm ?? MIN_RPM

  // La dérive se mesure autour du candidat retenu : on cherche, dans chaque
  // fenêtre, le régime le mieux corrélé à proximité, plutôt que de relancer une
  // recherche globale qui pourrait basculer d'octave d'une fenêtre à l'autre.
  const first = spectra[0]
  const last = spectra[spectra.length - 1]
  const startRpm = first ? refineNear(first, reference, rpmToHz / binHz) : reference
  const endRpm = last ? refineNear(last, reference, rpmToHz / binHz) : reference

  const drift = Math.abs(endRpm - startRpm) / Math.max(1, reference)
  const { seamRatio, peak } = measureSeam(buffer)
  const centroidHz = spectralCentroid(spectra, binHz)

  return {
    durationS: buffer.duration,
    sampleRate: buffer.sampleRate,
    channels: buffer.numberOfChannels,
    peak,
    centroidHz,
    seamRatio,
    candidates,
    startRpm: Math.round(startRpm),
    endRpm: Math.round(endRpm),
    steady: drift < RAMP_THRESHOLD,
  }
}

/**
 * Retient les meilleurs maxima locaux, en écartant les quasi-doublons.
 *
 * Sans filtrage, les quatre premières places seraient occupées par quatre points
 * voisins du même sommet, ce qui n'apprendrait rien. On impose donc un écart d'au
 * moins 12 % entre candidats retenus.
 */
function pickCandidates(
  grid: { rpm: number; score: number }[],
  rpmToHz: number,
  scoreAt: (rpm: number) => number,
): RpmCandidate[] {
  const sorted = [...grid].sort((a, b) => b.score - a.score)
  const best = sorted[0]
  if (!best || best.score <= 0) return []

  // Les maxima de la grille, en écartant les quasi-doublons : sans ce filtrage,
  // les premières places seraient occupées par plusieurs points du même sommet.
  const pool: { rpm: number; score: number }[] = []
  for (const entry of sorted) {
    if (pool.length >= CANDIDATE_COUNT) break
    if (pool.some((other) => Math.abs(Math.log(entry.rpm / other.rpm)) < 0.12)) continue
    pool.push(entry)
  }

  // Puis les rapports simples du meilleur, qu'ils aient ou non émergé d'eux-mêmes.
  // Ils sont ajoutés avec leur score réel, donc ne remontent pas artificiellement.
  for (const ratio of RELATED_RATIOS) {
    const rpm = best.rpm * ratio
    if (rpm < MIN_RPM || rpm > MAX_RPM) continue
    if (pool.some((other) => Math.abs(Math.log(rpm / other.rpm)) < 0.12)) continue
    pool.push({ rpm, score: scoreAt(rpm) })
  }

  pool.sort((a, b) => b.score - a.score)

  return pool.slice(0, CANDIDATE_COUNT).map((entry) => ({
    rpm: Math.round(entry.rpm),
    firingHz: entry.rpm * rpmToHz,
    relativeScore: entry.score / best.score,
  }))
}

/** Affine le régime au voisinage d'une référence, sur une seule fenêtre. */
function refineNear(spectrum: Float32Array, reference: number, rpmToBin: number): number {
  let best = reference
  let bestScore = -1
  // ±25 % autour de la référence : assez pour suivre une rampe d'une fenêtre à
  // l'autre, trop peu pour sauter d'une octave.
  for (let rpm = reference * 0.75; rpm <= reference * 1.25; rpm *= 1.002) {
    const score = harmonicScore(spectrum, rpm * rpmToBin)
    if (score > bestScore) {
      bestScore = score
      best = rpm
    }
  }
  return best
}

/**
 * Score d'un candidat : l'énergie trouvée là où ses harmoniques devraient être.
 *
 * Les rangs élevés pèsent moins, étant plus bruités et plus sensibles à une
 * erreur sur la fondamentale. Le total est moyenné sur le nombre d'harmoniques
 * réellement utilisées, faute de quoi les fondamentales basses seraient
 * avantagées : elles en font tenir davantage sous la fréquence de Nyquist.
 */
function harmonicScore(spectrum: Float32Array, fundamentalBin: number): number {
  if (fundamentalBin < 1) return 0

  let sum = 0
  let weightTotal = 0
  for (let h = 1; h <= HARMONICS; h += 1) {
    const bin = fundamentalBin * h
    if (bin >= spectrum.length - 1) break
    const weight = 1 / h
    sum += peakNear(spectrum, bin) * weight
    weightTotal += weight
  }
  return weightTotal > 0 ? sum / weightTotal : 0
}

/**
 * Valeur au voisinage immédiat d'un intervalle non entier : on prend le maximum
 * sur trois points plutôt que la valeur interpolée, une raie réelle n'étant
 * jamais exactement centrée sur un intervalle.
 */
function peakNear(spectrum: Float32Array, bin: number): number {
  const centre = Math.round(bin)
  let best = 0
  for (let i = centre - 1; i <= centre + 1; i += 1) {
    const value = spectrum[i]
    if (value !== undefined && value > best) best = value
  }
  return best
}

/** Positions des fenêtres d'analyse, réparties en évitant les extrémités. */
function windowOffsets(length: number): number[] {
  if (length <= FFT_SIZE) return [0]
  const span = length - FFT_SIZE
  const offsets: number[] = []
  for (let i = 0; i < WINDOW_COUNT; i += 1) {
    offsets.push(Math.floor((span * i) / (WINDOW_COUNT - 1)))
  }
  return offsets
}

/** Extrait une fenêtre monophonique, fenêtrée en Hann. */
function readWindow(buffer: AudioBuffer, offset: number): Float32Array {
  const samples = new Float32Array(FFT_SIZE)
  const available = Math.min(FFT_SIZE, buffer.length - offset)

  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel)
    for (let i = 0; i < available; i += 1) {
      samples[i] = (samples[i] ?? 0) + (data[offset + i] ?? 0) / buffer.numberOfChannels
    }
  }
  for (let i = 0; i < FFT_SIZE; i += 1) {
    samples[i] = (samples[i] ?? 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1)))
  }
  return samples
}

function magnitudeSpectrum(windowed: Float32Array): Float32Array {
  const real = Float32Array.from(windowed)
  const imaginary = new Float32Array(FFT_SIZE)
  fft(real, imaginary)

  const half = FFT_SIZE / 2
  const magnitude = new Float32Array(half)
  for (let i = 0; i < half; i += 1) {
    const re = real[i] ?? 0
    const im = imaginary[i] ?? 0
    magnitude[i] = Math.sqrt(re * re + im * im)
  }
  return magnitude
}

/**
 * Centre de gravité du spectre, moyenné sur les fenêtres. Borné à 8 kHz : au
 * -dessus, on ne mesure plus le moteur mais le souffle de la prise.
 */
function spectralCentroid(spectra: Float32Array[], binHz: number): number {
  const limit = Math.floor(8000 / binHz)
  let weighted = 0
  let total = 0
  for (const spectrum of spectra) {
    for (let i = 1; i < Math.min(limit, spectrum.length); i += 1) {
      const magnitude = spectrum[i] ?? 0
      weighted += i * binHz * magnitude
      total += magnitude
    }
  }
  return total > 0 ? weighted / total : 0
}

/** Discontinuité entre la fin et le début de la boucle, rapportée au crête. */
function measureSeam(buffer: AudioBuffer): { seamRatio: number; peak: number } {
  let seam = 0
  let peak = 0
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel)
    seam = Math.max(seam, Math.abs((data[0] ?? 0) - (data[buffer.length - 1] ?? 0)))
    for (let i = 0; i < data.length; i += 31) {
      const magnitude = Math.abs(data[i] ?? 0)
      if (magnitude > peak) peak = magnitude
    }
  }
  return { seamRatio: peak > 0 ? seam / peak : 0, peak }
}

/**
 * Transformée de Fourier rapide, en base deux, sur place. Écrite ici plutôt
 * qu'importée : une trentaine de lignes, pour l'unique endroit qui en a besoin.
 */
function fft(real: Float32Array, imaginary: Float32Array): void {
  const n = real.length

  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      swap(real, i, j)
      swap(imaginary, i, j)
    }
  }

  for (let length = 2; length <= n; length <<= 1) {
    const angle = (-2 * Math.PI) / length
    const stepReal = Math.cos(angle)
    const stepImaginary = Math.sin(angle)

    for (let start = 0; start < n; start += length) {
      let wReal = 1
      let wImaginary = 0
      for (let k = 0; k < length / 2; k += 1) {
        const a = start + k
        const b = a + length / 2
        const bReal = real[b] ?? 0
        const bImaginary = imaginary[b] ?? 0
        const tReal = bReal * wReal - bImaginary * wImaginary
        const tImaginary = bReal * wImaginary + bImaginary * wReal
        const aReal = real[a] ?? 0
        const aImaginary = imaginary[a] ?? 0

        real[b] = aReal - tReal
        imaginary[b] = aImaginary - tImaginary
        real[a] = aReal + tReal
        imaginary[a] = aImaginary + tImaginary

        const nextReal = wReal * stepReal - wImaginary * stepImaginary
        wImaginary = wReal * stepImaginary + wImaginary * stepReal
        wReal = nextReal
      }
    }
  }
}

function swap(array: Float32Array, i: number, j: number): void {
  const temp = array[i] ?? 0
  array[i] = array[j] ?? 0
  array[j] = temp
}
