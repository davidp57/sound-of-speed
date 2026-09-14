/**
 * L'échappement, posé après coup plutôt que dans le banc.
 *
 * Le mode direct ne fait pas passer tout le son par la réponse d'échappement :
 * il en mélange **45 %**, et garde 55 % de son sec. Le commentaire de
 * `core/synth/rendering.ts` dit pourquoi, et c'est David qui l'a réglé à
 * l'oreille le 6 septembre 2026 : « à cent pour cent, tout le son passait par la
 * réponse d'échappement — celle d'un V8 Chevrolet, y compris sous un quatre
 * cylindres ».
 *
 * Le banc, lui, s'appuyait sur la convolution interne d'engine-sim, qui est
 * entière. Mesuré le 14 septembre 2026 sur le quatre cylindres à 2 245 tr/min,
 * part d'énergie entre 1 et 4 kHz :
 *
 * | | 1–4 kHz |
 * |---|---|
 * | sec, sans convolution | −21,7 dB |
 * | convolué entièrement, ce que le banc produisait | −26,3 dB |
 * | prise réelle, le repère | −18,6 dB |
 *
 * Le sec colle presque à la vraie prise ; c'est la convolution intégrale qui
 * l'enfonce. David, sur la banque livrée : « ça sonne synthétique,
 * électronique ». Sur le mélange à 45 % : « c'est pas mal, on garde ça ».
 *
 * **Ce que ça ne corrige pas**, et il faut le dire : au-dessus de 4 kHz, tout ce
 * que produit le banc reste 30 à 45 dB sous une vraie prise, sec comme convolué.
 * Le modèle ne fabrique pas ce grain-là, et aucun filtre ne crée ce qui n'existe
 * pas.
 */

import { readFileSync } from 'node:fs'

import { fft } from './spectrum.mjs'
import { readWav } from './wav.mjs'

/**
 * La captation, ramenée à énergie unité.
 *
 * Sans cette normalisation, changer de captation changerait le **niveau** des
 * prises, donc le relief mesuré entre elles — on croirait régler une couleur en
 * déplaçant un volume. C'est le même piège que le mélange en gains linéaires,
 * relevé côté direct.
 */
export function lireCaptation(path) {
  const { samples } = readWav(readFileSync(path))
  let energie = 0
  for (let i = 0; i < samples.length; i += 1) energie += samples[i] * samples[i]
  const echelle = energie > 0 ? 1 / Math.sqrt(energie) : 1
  const out = new Float32Array(samples.length)
  for (let i = 0; i < out.length; i += 1) out[i] = samples[i] * echelle
  return out
}

/** La première puissance de deux qui tient la convolution entière. */
function tailleFft(longueur) {
  let n = 1
  while (n < longueur) n <<= 1
  return n
}

/** Convolution par produit de spectres — le calcul direct serait cent fois plus long. */
function convoluer(samples, reponse) {
  const n = tailleFft(samples.length + reponse.length)

  const xRe = new Float32Array(n)
  const xIm = new Float32Array(n)
  xRe.set(samples)
  fft(xRe, xIm)

  const hRe = new Float32Array(n)
  const hIm = new Float32Array(n)
  hRe.set(reponse)
  fft(hRe, hIm)

  for (let i = 0; i < n; i += 1) {
    const re = xRe[i] * hRe[i] - xIm[i] * hIm[i]
    const im = xRe[i] * hIm[i] + xIm[i] * hRe[i]
    xRe[i] = re
    xIm[i] = im
  }

  // Transformée inverse par conjugaison : la même routine sert deux fois.
  for (let i = 0; i < n; i += 1) xIm[i] = -xIm[i]
  fft(xRe, xIm)

  const out = new Float32Array(samples.length)
  for (let i = 0; i < out.length; i += 1) out[i] = xRe[i] / n
  return out
}

/**
 * Le mélange de la chaîne du direct, appliqué à une prise.
 *
 * `mix` est la part **d'énergie** réverbérée, pas le rapport des amplitudes :
 * les deux signaux sont décorrélés, donc ce sont leurs énergies qui s'ajoutent.
 * En gains linéaires, le milieu du réglage perdrait trois décibels — le même
 * piège qu'a corrigé `core/synth/synth.ts`, et pour la même raison.
 */
export function poserEchappement(samples, reponse, mix) {
  if (mix <= 0) return samples
  const mouille = convoluer(samples, reponse)
  const sec = Math.sqrt(1 - mix)
  const humide = Math.sqrt(mix)
  const out = new Float32Array(samples.length)
  for (let i = 0; i < out.length; i += 1) out[i] = sec * samples[i] + humide * mouille[i]
  return out
}
