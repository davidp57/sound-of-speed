/**
 * Centroïde spectral, porté de `src/core/audio/analyze.ts`.
 *
 * Le « centre de gravité » du timbre : il ne donne pas le régime, mais il dit
 * où se tient le corps du son. C'est la grandeur qui tranche la question du
 * ticket — combien de prises faut-il — parce que c'est elle que le
 * rééchantillonnage déplace à tort. Sur une vraie voiture, monter en régime
 * déplace la raie d'allumage sans déplacer les résonances d'échappement et de
 * caisse ; sur une prise rejouée à 0,3×, tout descend ensemble.
 *
 * Même portage que `loop.mjs`, pour la même raison : les fonctions d'origine
 * sont privées à leur module et travaillent sur des `AudioBuffer`.
 */

/** Nombre de points par fenêtre. Résolution d'environ 1,3 Hz à 44,1 kHz. */
const FFT_SIZE = 32768
/** Nombre de fenêtres réparties dans le fichier, pour moyenner. */
const WINDOW_COUNT = 6
/** Au-dessus, on ne mesure plus le moteur mais le souffle de la prise. */
const CENTROID_LIMIT_HZ = 8000

/**
 * Transformée de Fourier rapide, en place.
 *
 * Exportée depuis le 14 septembre 2026 : `echappement.mjs` s'en sert pour
 * convoluer une prise par la captation d'échappement. Une seconde copie aurait
 * été une seconde chose à corriger.
 */
export function fft(real, imaginary) {
  const n = real.length

  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      let t = real[i]
      real[i] = real[j]
      real[j] = t
      t = imaginary[i]
      imaginary[i] = imaginary[j]
      imaginary[j] = t
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
        const tReal = real[b] * wReal - imaginary[b] * wImaginary
        const tImaginary = real[b] * wImaginary + imaginary[b] * wReal
        real[b] = real[a] - tReal
        imaginary[b] = imaginary[a] - tImaginary
        real[a] += tReal
        imaginary[a] += tImaginary

        const nextReal = wReal * stepReal - wImaginary * stepImaginary
        wImaginary = wReal * stepImaginary + wImaginary * stepReal
        wReal = nextReal
      }
    }
  }
}

function magnitudeSpectrum(samples, offset) {
  const real = new Float32Array(FFT_SIZE)
  const imaginary = new Float32Array(FFT_SIZE)
  const available = Math.min(FFT_SIZE, samples.length - offset)
  for (let i = 0; i < available; i += 1) {
    real[i] = samples[offset + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1)))
  }
  fft(real, imaginary)

  const half = FFT_SIZE / 2
  const magnitude = new Float32Array(half)
  for (let i = 0; i < half; i += 1) {
    magnitude[i] = Math.sqrt(real[i] * real[i] + imaginary[i] * imaginary[i])
  }
  return magnitude
}

/** Centre de gravité du spectre, en hertz, moyenné sur plusieurs fenêtres. */
export function spectralCentroid(samples, sampleRate) {
  const binHz = sampleRate / FFT_SIZE
  const span = Math.max(0, samples.length - FFT_SIZE)
  const offsets = []
  for (let i = 0; i < WINDOW_COUNT; i += 1) {
    offsets.push(Math.floor((span * i) / Math.max(1, WINDOW_COUNT - 1)))
  }

  const limit = Math.floor(CENTROID_LIMIT_HZ / binHz)
  let weighted = 0
  let total = 0
  for (const offset of offsets) {
    const spectrum = magnitudeSpectrum(samples, offset)
    for (let i = 1; i < Math.min(limit, spectrum.length); i += 1) {
      weighted += i * binHz * spectrum[i]
      total += spectrum[i]
    }
  }
  return total > 0 ? weighted / total : 0
}

/** Niveau efficace d'un échantillon, de 0 à 1. */
export function rms(samples) {
  let energy = 0
  for (let i = 0; i < samples.length; i += 1) energy += samples[i] * samples[i]
  return samples.length > 0 ? Math.sqrt(energy / samples.length) : 0
}

/** Niveau crête, de 0 à 1. */
export function peak(samples) {
  let top = 0
  for (let i = 0; i < samples.length; i += 1) {
    const magnitude = Math.abs(samples[i])
    if (magnitude > top) top = magnitude
  }
  return top
}
