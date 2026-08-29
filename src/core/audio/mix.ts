import type { LayerPreset, MixPreset, Profile } from '../preset/schema'
import type { EngineState } from '../engine/engine'

/**
 * Calcul du mixage des couches.
 *
 * Fonction pure, sans Web Audio : elle dit seulement, pour un régime et une
 * charge donnés, quel gain et quelle vitesse de lecture chaque couche doit
 * recevoir. Le moteur audio se contentera d'appliquer ces valeurs, et l'écran de
 * télémétrie les affiche telles quelles — on voit donc le mixage se calculer
 * avant même qu'un son soit branché, ce qui rend le réglage vérifiable à l'œil.
 *
 * Deux fondus se composent :
 *
 * - en régime, entre les couches d'un même rôle, à puissance constante ;
 * - en charge, entre les rôles « en charge » et « pied levé ».
 *
 * Le fondu à puissance constante (sinus et cosinus plutôt qu'une rampe linéaire)
 * maintient l'énergie perçue stable au milieu du passage. Avec une rampe
 * linéaire, deux sources décorrélées produisent un creux audible à mi-course.
 */

export interface LayerMix {
  key: string
  file: string
  role: LayerPreset['role']
  /** Gain final, avant le gain général. */
  gain: number
  /** Facteur de lecture, déjà borné aux limites de la couche. */
  rate: number
  /**
   * Vrai si `rate` a été borné alors que la couche est réellement audible :
   * l'échantillon est étiré au-delà de sa plage utile et cela s'entend. Une
   * couche bornée mais à gain nul n'est pas signalée — sinon tout le tableau
   * clignoterait en permanence et le signal utile se perdrait.
   */
  rateClamped: boolean
}

export interface MixResult {
  layers: LayerMix[]
  /** Poids de la famille « en charge », de 0 à 1. */
  onWeight: number
  /** Poids de la famille « pied levé ». */
  offWeight: number
  idleWeight: number
  limiterWeight: number
}

/** En deçà, une couche ne contribue pas assez pour qu'un défaut s'entende. */
const AUDIBLE_GAIN = 0.02

/**
 * Écart de hauteur, en octaves, au-delà duquel une couche est réduite au silence.
 *
 * Une couche dont la vitesse de lecture a été bornée ne joue plus à la hauteur
 * du régime : elle tient une note fixe pendant que les autres montent. À
 * l'oreille, cela s'entend comme un second moteur tournant en parallèle, à
 * régime constant. Plutôt que de la laisser mentir, on l'efface à mesure qu'elle
 * s'écarte — une demi-octave suffit à la rendre franchement fausse.
 */
const PITCH_TOLERANCE_OCTAVES = 0.5

export function computeMix(
  profile: Profile,
  state: EngineState,
  shift?: { isShifting: boolean; progress: number },
): MixResult {
  const { mix } = profile
  const enabled = profile.layers.filter((layer) => layer.enabled)

  // Charge : fondu à puissance constante entre pied levé et pleine charge.
  //
  // Le contraste resserre l'écart autour du milieu : à un, le fondu va d'un
  // extrême à l'autre et le moteur s'éteint presque en roue libre ; plus bas, les
  // deux familles se mélangent en permanence. Le gain propre aux couches pied
  // levé compense ensuite leur enregistrement plus doux.
  const contrast = clamp(mix.loadContrast, 0, 1)
  const load = clamp(0.5 + (clamp(state.load, 0, 1) - 0.5) * contrast, 0, 1)
  const onWeight = Math.sin((load * Math.PI) / 2)
  const offWeight = Math.cos((load * Math.PI) / 2) * Math.max(0, mix.offLoadGain)

  // Le ralenti s'efface dès que le moteur est entraîné par les roues.
  const idleWeight = state.idling
    ? 1 - smoothstep(profile.engine.idleRpm, mix.idleFadeOutRpm, state.rpm)
    : 0

  const limiterWeight = state.limiterActive ? 1 : 0

  // À-coup de passage : le couple est coupé, donc le son se creuse puis revient.
  // Une boîte parfaitement lisse ne s'entend pas comme une boîte.
  const jolt =
    profile.feel.shiftJolt.enabled && shift?.isShifting
      ? 1 - profile.feel.shiftJolt.depth * Math.sin(clamp(shift.progress, 0, 1) * Math.PI)
      : 1

  const layers: LayerMix[] = []
  for (const role of ['on', 'off', 'idle', 'limiter'] as const) {
    const family = enabled
      .filter((layer) => layer.role === role)
      .sort((a, b) => a.anchorRpm - b.anchorRpm)
    if (family.length === 0) continue

    const familyWeight =
      role === 'on'
        ? onWeight
        : role === 'off'
          ? offWeight
          : role === 'idle'
            ? idleWeight
            : limiterWeight

    const blend = blendWeights(family, state.rpm, mix)

    family.forEach((layer, index) => {
      const raw = state.rpm / Math.max(1, layer.anchorRpm)
      const rate = clamp(raw, layer.minRate, layer.maxRate)
      const gain =
        (blend[index] ?? 0) *
        familyWeight *
        layer.gain *
        mix.masterGain *
        fidelity(raw, rate) *
        (role === 'limiter' ? 1 : jolt)
      layers.push({
        key: layer.key,
        file: layer.file,
        role,
        gain,
        rate,
        rateClamped: Math.abs(rate - raw) > 1e-6 && gain > AUDIBLE_GAIN,
      })
    })
  }

  return { layers, onWeight, offWeight, idleWeight, limiterWeight }
}

/**
 * Répartition du régime entre les couches d'un même rôle.
 *
 * Avec exactement deux couches — le cas courant : un enregistrement bas régime,
 * un haut régime — la bascule s'étale entre `crossfadeLowRpm` et
 * `crossfadeHighRpm`. Ces deux bornes sont indépendantes des régimes d'ancrage,
 * qui, eux, servent uniquement à calculer le repitch : on peut donc déplacer le
 * point de bascule à l'oreille sans toucher à la justesse.
 *
 * Au-delà de deux couches, on retombe sur les ancrages eux-mêmes, en fondant
 * entre les deux voisines qui encadrent le régime.
 */
function blendWeights(family: LayerPreset[], rpm: number, mix: MixPreset): number[] {
  if (family.length === 1) return [1]

  if (family.length === 2) {
    const low = Math.min(mix.crossfadeLowRpm, mix.crossfadeHighRpm)
    const high = Math.max(mix.crossfadeLowRpm, mix.crossfadeHighRpm)
    const t = high > low ? clamp((rpm - low) / (high - low), 0, 1) : rpm >= high ? 1 : 0
    return [Math.cos((t * Math.PI) / 2), Math.sin((t * Math.PI) / 2)]
  }

  const anchors = family.map((layer) => layer.anchorRpm)
  return anchors.map((anchor, index) => {
    const previous = anchors[index - 1]
    const next = anchors[index + 1]

    if (next !== undefined && rpm >= anchor && rpm < next) {
      const t = (rpm - anchor) / (next - anchor)
      return Math.cos((t * Math.PI) / 2)
    }
    if (previous !== undefined && rpm >= previous && rpm < anchor) {
      const t = (rpm - previous) / (anchor - previous)
      return Math.sin((t * Math.PI) / 2)
    }
    if (index === 0 && rpm < anchor) return 1
    if (index === anchors.length - 1 && rpm >= anchor) return 1
    return 0
  })
}

/**
 * Facteur d'effacement d'une couche jouée à la mauvaise hauteur.
 *
 * Vaut un tant que la vitesse de lecture demandée est tenue, et décroît jusqu'à
 * zéro à mesure que le bornage l'en écarte.
 */
function fidelity(raw: number, rate: number): number {
  if (raw <= 0 || rate <= 0) return 0
  const octaves = Math.abs(Math.log2(rate / raw))
  return clamp(1 - octaves / PITCH_TOLERANCE_OCTAVES, 0, 1)
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge1 <= edge0) return x >= edge1 ? 1 : 0
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}
