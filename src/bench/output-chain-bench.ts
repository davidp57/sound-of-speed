/**
 * Banc de mesure de la chaîne de sortie.
 *
 * Il répond à une seule question : le relief que le mixage produit — l'écart de
 * niveau entre croisière et accélération franche — survit-il à la chaîne de
 * sortie ? Le mixage annonce 3,9 dB ; une estimation analytique dit qu'il en
 * reste 0,3 après le limiteur. Ce banc remplace l'estimation par un relevé.
 *
 * **Aucun son ne sort.** Tout est rendu dans un `OfflineAudioContext`, qui
 * calcule un tampon et ne touche jamais la sortie de l'appareil.
 *
 * Il n'entre pas dans l'application : la page qui l'appelle vit hors du build de
 * production, et ce module n'est importé que par elle.
 */

import type { Profile } from '../core/preset/schema'
import type { EngineState } from '../core/engine/engine'
import { computeMix } from '../core/audio/mix'
import { buildOutputChain, saturationCurve } from '../core/audio/output-chain'

/**
 * Fréquence d'échantillonnage du rendu, en Hz.
 *
 * Celle du contexte audio, pas celle des fichiers : les échantillons livrés sont
 * à 44 100 Hz et le navigateur les rééchantillonne à la lecture, la sortie de
 * l'appareil tournant couramment à 48 000. Le banc reproduit donc ce chemin-là.
 */
export const BENCH_SAMPLE_RATE = 48000
/** Durée rendue, en secondes. */
export const BENCH_DURATION_S = 2
/**
 * Début de la fenêtre mesurée, en secondes.
 *
 * Le limiteur met son temps de relâchement — 120 ms — à s'établir, et les
 * sources démarrent à zéro. On laisse passer largement de quoi atteindre le
 * régime permanent avant de relever quoi que ce soit.
 */
export const BENCH_WINDOW_START_S = 0.5

/** Un état moteur à mesurer, et ce qu'il représente. */
export interface BenchState {
  label: string
  state: EngineState
}

/** Une configuration de la chaîne : ce qui est en service, et à quel volume. */
export interface BenchConfig {
  label: string
  bypassShaper: boolean
  bypassLimiter: boolean
  volume: number
  /** Gain de rattrapage. Le neutraliser sépare ce que la chaîne écrase de ce qu'elle rend. */
  makeup?: number
  /** L'ordre d'avant le 17 septembre 2026 : le limiteur avant le rattrapage. */
  limiterBeforeMakeup?: boolean
}

export interface BenchPoint {
  state: string
  config: string
  volume: number
  /** Niveau efficace sur la fenêtre mesurée, en dB par rapport à la pleine échelle. */
  rmsDb: number
  /** Niveau crête, en dB par rapport à la pleine échelle. */
  peakDb: number
  /**
   * Niveau efficace après écrêtage à la pleine échelle, en dB.
   *
   * Le rendu hors ligne travaille en virgule flottante et laisse passer ce qui
   * dépasse un ; le convertisseur de l'appareil, lui, le rogne. Sans cette
   * seconde mesure, le banc relèverait un relief que la voiture n'entend pas.
   */
  clippedRmsDb: number
  /** Part du signal rognée par l'écrêtage, en pour cent des échantillons. */
  clippedRatio: number
  /**
   * Ce que l'écrêtage ajoute au son, rapporté au son lui-même, en dB.
   *
   * L'écrêtage ne fait pas que raboter une crête : il fabrique un signal
   * d'erreur — la partie coupée — qui s'entend comme de la distorsion. Compter
   * les échantillons rognés dit qu'il y en a ; ce rapport dit combien on
   * l'entend. Sous −60 dB il est inaudible, vers −40 il se devine sur un son
   * tenu, au-delà de −30 il s'entend franchement.
   */
  clipErrorDb: number
  /**
   * Réduction appliquée par le limiteur à la fin du rendu, en dB (négative).
   *
   * C'est la mesure qui tranche : sans elle, un limiteur qui n'atténue rien et un
   * limiteur mal branché donnent le même tableau.
   */
  limiterReductionDb: number
}

/** Une couche décodée, prête à jouer. */
export interface BenchLayer {
  key: string
  buffer: AudioBuffer
}

/** Convertit un niveau linéaire en décibels, avec un plancher qui évite l'infini. */
export function toDb(level: number): number {
  return 20 * Math.log10(Math.max(level, 1e-9))
}

/**
 * Charge les couches d'un profil, une fois, pour tous les rendus.
 *
 * Le décodage passe par un contexte hors ligne minuscule, comme le fait
 * l'analyse d'échantillon de l'application : on n'a pas besoin d'un contexte qui
 * joue pour lire un fichier.
 */
export async function loadLayers(profile: Profile): Promise<BenchLayer[]> {
  const scratch = new OfflineAudioContext(1, 1, BENCH_SAMPLE_RATE)
  const wanted = profile.layers.filter((layer) => layer.enabled && layer.file)
  return Promise.all(
    wanted.map(async (layer) => {
      const url = `/audio/${profile.sampleDir}/${layer.file}`
      const response = await fetch(url)
      if (!response.ok) throw new Error(`${layer.file} : ${response.status}`)
      const buffer = await scratch.decodeAudioData(await response.arrayBuffer())
      return { key: layer.key, buffer }
    }),
  )
}

/**
 * Rend un état moteur dans une configuration de chaîne, et relève son niveau.
 *
 * Les gains et les vitesses de lecture viennent de `computeMix`, c'est-à-dire de
 * la même fonction que celle qui pilote le moteur audio : le banc ne rejoue pas
 * une idée du mixage, il rejoue le mixage.
 *
 * Deux écarts assumés avec ce qui joue dans la voiture, tous deux sans effet sur
 * un niveau moyen :
 *
 * - les boucles ne sont pas recollées — le raccord agit sur quelques
 *   millisecondes par tour de boucle, et de la même façon dans tous les états ;
 * - les positions de départ sont réparties régulièrement au lieu d'être tirées
 *   au sort, sinon deux passes du banc ne donneraient pas le même chiffre.
 */
export async function renderPoint(
  profile: Profile,
  layers: BenchLayer[],
  benchState: BenchState,
  config: BenchConfig,
): Promise<BenchPoint> {
  const rendered = await renderBuffer(profile, layers, benchState, config)
  return {
    ...measure(rendered.buffer),
    state: benchState.label,
    config: config.label,
    volume: config.volume,
    limiterReductionDb: rendered.limiterReductionDb,
  }
}

/**
 * Rend un extrait et retourne le tampon, pour l'écouter au lieu de le mesurer.
 *
 * Un tableau de décibels ne dit pas si une distorsion s'entend ; le même rendu,
 * enregistré et comparé au casque, le dit.
 */
export async function renderBuffer(
  profile: Profile,
  layers: BenchLayer[],
  benchState: BenchState,
  config: BenchConfig,
  durationSeconds: number = BENCH_DURATION_S,
): Promise<{ buffer: AudioBuffer; limiterReductionDb: number }> {
  const frames = Math.round(BENCH_SAMPLE_RATE * durationSeconds)
  const context = new OfflineAudioContext(2, frames, BENCH_SAMPLE_RATE)

  const chain = buildOutputChain(context, {
    volume: config.volume,
    bypassShaper: config.bypassShaper,
    bypassLimiter: config.bypassLimiter,
    ...(config.makeup === undefined ? {} : { makeup: config.makeup }),
    ...(config.limiterBeforeMakeup === undefined
      ? {}
      : { limiterBeforeMakeup: config.limiterBeforeMakeup }),
  })
  chain.highpass.frequency.value = profile.mix.highpassHz
  chain.limiter.threshold.value = profile.mix.limiterThresholdDb
  chain.shaper.curve = saturationCurve(profile.mix.drive)
  chain.output.connect(context.destination)

  const mix = computeMix(profile, benchState.state)
  mix.layers.forEach((layerMix, index) => {
    const loaded = layers.find((candidate) => candidate.key === layerMix.key)
    if (!loaded) return
    const source = context.createBufferSource()
    source.buffer = loaded.buffer
    source.loop = true
    source.playbackRate.value = layerMix.rate
    const gain = context.createGain()
    gain.gain.value = layerMix.gain
    source.connect(gain)
    gain.connect(chain.input)
    const offset = (index / Math.max(1, mix.layers.length)) * loaded.buffer.duration
    source.start(0, offset)
  })

  const buffer = await context.startRendering()
  return { buffer, limiterReductionDb: config.bypassLimiter ? 0 : chain.limiter.reduction }
}

/**
 * Niveau efficace, crête, et niveau efficace une fois la sortie rognée.
 *
 * Les trois se relèvent sur la même fenêtre stable, tous canaux confondus.
 */
function measure(buffer: AudioBuffer): {
  rmsDb: number
  peakDb: number
  clippedRmsDb: number
  clippedRatio: number
  clipErrorDb: number
} {
  const from = Math.round(BENCH_WINDOW_START_S * buffer.sampleRate)
  let sum = 0
  let clippedSum = 0
  let count = 0
  let over = 0
  let peak = 0
  let errorSum = 0
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel)
    for (let i = from; i < data.length; i += 1) {
      const value = data[i] ?? 0
      sum += value * value
      count += 1
      const magnitude = Math.abs(value)
      if (magnitude > peak) peak = magnitude
      if (magnitude > 1) over += 1
      const bounded = Math.max(-1, Math.min(1, value))
      clippedSum += bounded * bounded
      const error = value - bounded
      errorSum += error * error
    }
  }
  const rms = count > 0 ? Math.sqrt(sum / count) : 0
  const clippedRms = count > 0 ? Math.sqrt(clippedSum / count) : 0
  const errorRms = count > 0 ? Math.sqrt(errorSum / count) : 0
  return {
    rmsDb: toDb(rms),
    peakDb: toDb(peak),
    clippedRmsDb: toDb(clippedRms),
    clippedRatio: count > 0 ? (over / count) * 100 : 0,
    clipErrorDb: clippedRms > 0 ? toDb(errorRms / clippedRms) : -Infinity,
  }
}
