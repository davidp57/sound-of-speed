/**
 * La chaîne de sortie du son synthétisé, refaite hors du navigateur.
 *
 * Elle reproduit `SynthEngine.buildGraph` : silencieux, puis séparation entre
 * son sec et son réverbéré, la résonance d'échappement étant une convolution
 * par une captation réelle.
 *
 * **Pourquoi elle existe.** Le banc mesurait jusqu'ici le signal que le
 * WebAssembly produit, c'est-à-dire le son **sec** — trois étages en amont de ce
 * qui sort. Le 8 septembre 2026, une mesure a conclu qu'ouvrir le papillon
 * faisait baisser la bande de 1,4 kHz de 2,7 dB pendant que David entendait
 * l'inverse. Il avait raison : on ne comparait pas le même son.
 */

/** Transformée de Fourier en place. `re` et `im` font une puissance de deux. */
export function fft(re, im, inverse = false) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      let t = re[i]
      re[i] = re[j]
      re[j] = t
      t = im[i]
      im[i] = im[j]
      im[j] = t
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = ((inverse ? 2 : -2) * Math.PI) / len
    const stepRe = Math.cos(angle)
    const stepIm = Math.sin(angle)
    for (let start = 0; start < n; start += len) {
      let wRe = 1
      let wIm = 0
      for (let k = 0; k < len / 2; k += 1) {
        const a = start + k
        const b = a + len / 2
        const tRe = re[b] * wRe - im[b] * wIm
        const tIm = re[b] * wIm + im[b] * wRe
        re[b] = re[a] - tRe
        im[b] = im[a] - tIm
        re[a] += tRe
        im[a] += tIm
        const suivant = wRe * stepRe - wIm * stepIm
        wIm = wRe * stepIm + wIm * stepRe
        wRe = suivant
      }
    }
  }
  if (inverse) {
    for (let i = 0; i < n; i += 1) {
      re[i] /= n
      im[i] /= n
    }
  }
}

/** La puissance de deux qui contient `n`. */
function puissanceDeDeux(n) {
  let p = 1
  while (p < n) p <<= 1
  return p
}

/**
 * Le silencieux : un passe-bas du second ordre, sans surtension.
 *
 * Les mêmes coefficients que le `BiquadFilterNode` du navigateur en type
 * `lowpass`, tels que la spécification Web Audio les écrit — Q à 0,707, on
 * cherche à absorber, pas à faire chanter le pot.
 */
export function silencieux(signal, frequenceHz, tauxHz) {
  const q = 0.707
  const w = (2 * Math.PI * frequenceHz) / tauxHz
  const alpha = Math.sin(w) / (2 * q)
  const cosw = Math.cos(w)
  const b0 = (1 - cosw) / 2
  const b1 = 1 - cosw
  const b2 = (1 - cosw) / 2
  const a0 = 1 + alpha
  const a1 = -2 * cosw
  const a2 = 1 - alpha

  const sortie = new Float32Array(signal.length)
  let x1 = 0
  let x2 = 0
  let y1 = 0
  let y2 = 0
  for (let i = 0; i < signal.length; i += 1) {
    const x0 = signal[i]
    const y0 = (b0 / a0) * x0 + (b1 / a0) * x1 + (b2 / a0) * x2 - (a1 / a0) * y1 - (a2 / a0) * y2
    sortie[i] = y0
    x2 = x1
    x1 = x0
    y2 = y1
    y1 = y0
  }
  return sortie
}

/**
 * Convolution par transformée de Fourier.
 *
 * En produit direct, une réponse de quarante mille points sur deux secondes de
 * son demanderait des milliards de multiplications. Ici, trois transformées.
 */
export function convoluer(signal, reponse) {
  const taille = puissanceDeDeux(signal.length + reponse.length)
  const sRe = new Float64Array(taille)
  const sIm = new Float64Array(taille)
  const rRe = new Float64Array(taille)
  const rIm = new Float64Array(taille)
  sRe.set(signal)
  rRe.set(reponse)
  fft(sRe, sIm)
  fft(rRe, rIm)
  for (let i = 0; i < taille; i += 1) {
    const re = sRe[i] * rRe[i] - sIm[i] * rIm[i]
    const im = sRe[i] * rIm[i] + sIm[i] * rRe[i]
    sRe[i] = re
    sIm[i] = im
  }
  fft(sRe, sIm, true)
  return Float32Array.from(sRe.subarray(0, signal.length))
}

/**
 * Normalise une réponse en énergie, comme `loadResponse` le fait.
 *
 * Sans cela le niveau dépendrait de la longueur de la captation, et passer d'une
 * réponse à l'autre ferait sauter le volume.
 */
export function normaliserEnergie(reponse) {
  let energie = 0
  for (let i = 0; i < reponse.length; i += 1) energie += reponse[i] * reponse[i]
  if (energie <= 0) return reponse
  const gain = 1 / Math.sqrt(energie)
  const sortie = new Float32Array(reponse.length)
  for (let i = 0; i < reponse.length; i += 1) sortie[i] = reponse[i] * gain
  return sortie
}

/**
 * Le plateau haut qui rend de l'éclat en charge.
 *
 * Les coefficients du `BiquadFilterNode` en type `highshelf`, tels que la
 * spécification Web Audio les écrit. Son gain suit l'effort : nul pied levé.
 */
export function plateauHaut(signal, gainDb, frequenceHz, tauxHz) {
  if (gainDb === 0) return signal
  const a = Math.pow(10, gainDb / 40)
  const w = (2 * Math.PI * frequenceHz) / tauxHz
  const cosw = Math.cos(w)
  const alpha = (Math.sin(w) / 2) * Math.sqrt((a + 1 / a) * (1 / 0.707 - 1) + 2)
  const deuxRacineAlpha = 2 * Math.sqrt(a) * alpha

  const b0 = a * (a + 1 + (a - 1) * cosw + deuxRacineAlpha)
  const b1 = -2 * a * (a - 1 + (a + 1) * cosw)
  const b2 = a * (a + 1 + (a - 1) * cosw - deuxRacineAlpha)
  const a0 = a + 1 - (a - 1) * cosw + deuxRacineAlpha
  const a1 = 2 * (a - 1 - (a + 1) * cosw)
  const a2 = a + 1 - (a - 1) * cosw - deuxRacineAlpha

  const sortie = new Float32Array(signal.length)
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0
  for (let i = 0; i < signal.length; i += 1) {
    const x0 = signal[i]
    const y0 = (b0 / a0) * x0 + (b1 / a0) * x1 + (b2 / a0) * x2 - (a1 / a0) * y1 - (a2 / a0) * y2
    sortie[i] = y0
    x2 = x1; x1 = x0; y2 = y1; y1 = y0
  }
  return sortie
}

/**
 * Le graphe complet : silencieux, éclat en charge, puis mélange du sec et du
 * réverbéré.
 *
 * Les deux gains sont des racines, comme dans `buildGraph` : les deux signaux
 * sont décorrélés, donc ce sont leurs énergies qui s'ajoutent. En gains
 * linéaires, le milieu du curseur perdrait trois décibels.
 */
export function chaineDeSortie(sec, {
  mufflerHz, convolverMix, reponse, tauxHz, loadBrightnessDb = 0, effort = 0,
}) {
  const filtre = plateauHaut(
    silencieux(sec, mufflerHz, tauxHz),
    loadBrightnessDb * effort,
    1500,
    tauxHz,
  )
  const mix = reponse === null ? 0 : convolverMix
  if (mix <= 0) {
    const sortie = new Float32Array(filtre.length)
    for (let i = 0; i < filtre.length; i += 1) sortie[i] = filtre[i]
    return sortie
  }
  const gainSec = Math.sqrt(1 - mix)
  const gainReverbere = Math.sqrt(mix)
  const reverbere = convoluer(filtre, normaliserEnergie(reponse))
  const sortie = new Float32Array(filtre.length)
  for (let i = 0; i < filtre.length; i += 1) {
    sortie[i] = filtre[i] * gainSec + reverbere[i] * gainReverbere
  }
  return sortie
}
