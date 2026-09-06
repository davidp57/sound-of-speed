/**
 * Ce qui fait le **son** d'un moteur simulé, séparé de ce qui décrit le calcul.
 *
 * La distinction n'est pas cosmétique, elle vient d'un besoin de David : « en
 * voiture on peut choisir un profil de synthèse, avec le choix du moteur
 * (profil préréglé sur PC), le choix de l'échappement [...] et de l'endroit d'où
 * on écoute », et « on pourra choisir les autres profils moteur en voiture
 * aussi ? j'aimerais bien en tester plusieurs ».
 *
 * Essayer plusieurs moteurs au volant n'a de sens que si chacun arrive avec son
 * réglage. Un moteur écouté avec l'échappement et le volume du précédent sonne
 * mal, et l'on ne sait plus si c'est le moteur ou le réglage qu'on entend. Ces
 * valeurs voyagent donc **avec le moteur** : la bibliothèque en pose un jeu
 * d'usine, le profil en garde une copie modifiable — comme il garde déjà une
 * copie modifiable de la définition.
 *
 * Ce qui n'est **pas** ici, et pourquoi : la fréquence de simulation, la
 * longueur de la réponse impulsionnelle interne, la taille de bloc et la réserve
 * décrivent la machine qui calcule. La réserve en particulier est l'arbitrage
 * entre la latence et le risque de creux : les 60 ms que David tient sur son PC,
 * sans un seul creux mesuré, n'ont pas la même marge sur un téléphone. Embarquée
 * dans un moteur d'usine, elle ferait attribuer au moteur un trou qui vient de
 * l'appareil.
 */

/** Les réponses d'échappement disponibles. */
export const EXHAUST_RESPONSES = [
  { id: 'smooth_39', label: 'V8 Chevrolet 454', file: 'smooth_39.wav' },
  { id: 'mild_exhaust', label: 'Silencieux doux', file: 'mild_exhaust.wav' },
  { id: 'minimal_muffling_01', label: 'Silencieux minimal', file: 'minimal_muffling_01.wav' },
  { id: 'sharp_01', label: 'Sec', file: 'sharp_01.wav' },
  { id: 'tube', label: 'Tube fabriqué', file: null },
] as const

export type ExhaustResponse = (typeof EXHAUST_RESPONSES)[number]['id']

export function exhaustResponseFile(id: ExhaustResponse): string | null {
  return EXHAUST_RESPONSES.find((entry) => entry.id === id)?.file ?? null
}

/**
 * Les deux fréquences de silencieux que l'écran de conduite propose comme un
 * choix : dedans, dehors.
 *
 * Ce sont les mêmes valeurs que les repères du banc. Elles sont ici parce que
 * l'écran de conduite ne montre pas de curseur : il pose l'une ou l'autre.
 */
export const MUFFLER_INSIDE_HZ = 6000
export const MUFFLER_OUTSIDE_HZ = 22000

export interface SynthRendering {
  /** Ouverture du papillon à effort nul, de 0 à 1. */
  throttleIdle: number
  /** Ouverture du papillon à plein effort, de 0 à 1. */
  throttleFull: number
  /** Volume appliqué dans le synthétiseur, de 0 à 6. */
  volume: number
  /** Le niveleur d'engine-sim, qui vise une crête constante. */
  leveler: boolean
  /** Gain fixe appliqué quand le niveleur est coupé. */
  levelerGain: number
  /** La crête qu'il vise, sur l'échelle des entiers 16 bits. */
  levelerTarget: number
  /** Résonance d'échappement déportée sur un `ConvolverNode`. */
  convolver: boolean
  /** Longueur de cette résonance, en millisecondes. */
  convolverMs: number
  /** Part de son réverbéré dans la sortie, de 0 à 1. */
  convolverMix: number
  /** D'où vient la résonance d'échappement. */
  exhaustResponse: ExhaustResponse
  /** Accord du tube fabriqué, en hertz. Sans effet sur une captation réelle. */
  exhaustHz: number
  /** Coupure du silencieux, en hertz. C'est aussi le point d'écoute. */
  mufflerHz: number
}

/** Les clés du rendu, pour le découper d'un jeu de réglages complet. */
export const SYNTH_RENDERING_KEYS = [
  'throttleIdle',
  'throttleFull',
  'volume',
  'leveler',
  'levelerGain',
  'levelerTarget',
  'convolver',
  'convolverMs',
  'convolverMix',
  'exhaustResponse',
  'exhaustHz',
  'mufflerHz',
] as const satisfies readonly (keyof SynthRendering)[]

/**
 * Un profil reçu par lien ou par fichier peut porter n'importe quoi : une
 * valeur non finie retombe sur la borne basse plutôt que de propager un NaN
 * jusque dans le graphe audio, où il fait taire la sortie sans rien dire.
 */
function clamp(value: number, low: number, high: number): number {
  if (!Number.isFinite(value)) return low
  return value < low ? low : value > high ? high : value
}

/** Ramène un rendu venu de l'extérieur dans ses bornes. */
export function clampSynthRendering(rendering: SynthRendering): SynthRendering {
  // Le plein papillon ne descend pas sous le ralenti : l'effort ne peut pas
  // fermer les gaz en montant.
  const idle = clamp(rendering.throttleIdle, 0, 1)
  return {
    throttleIdle: idle,
    throttleFull: clamp(rendering.throttleFull, idle, 1),
    volume: clamp(rendering.volume, 0, 6),
    leveler: rendering.leveler,
    levelerGain: clamp(rendering.levelerGain, 0.01, 4),
    levelerTarget: Math.round(clamp(rendering.levelerTarget, 1000, 32000)),
    convolver: rendering.convolver,
    convolverMs: Math.round(clamp(rendering.convolverMs, 10, 2000)),
    convolverMix: clamp(rendering.convolverMix, 0, 1),
    exhaustResponse: EXHAUST_RESPONSES.some((e) => e.id === rendering.exhaustResponse)
      ? rendering.exhaustResponse
      : 'smooth_39',
    exhaustHz: Math.round(clamp(rendering.exhaustHz, 20, 400)),
    mufflerHz: Math.round(clamp(rendering.mufflerHz, 120, 22000)),
  }
}

/** Découpe le rendu d'un jeu de réglages qui contient aussi le calcul. */
export function renderingOf(settings: SynthRendering): SynthRendering {
  return clampSynthRendering({
    throttleIdle: settings.throttleIdle,
    throttleFull: settings.throttleFull,
    volume: settings.volume,
    leveler: settings.leveler,
    levelerGain: settings.levelerGain,
    levelerTarget: settings.levelerTarget,
    convolver: settings.convolver,
    convolverMs: settings.convolverMs,
    convolverMix: settings.convolverMix,
    exhaustResponse: settings.exhaustResponse,
    exhaustHz: settings.exhaustHz,
    mufflerHz: settings.mufflerHz,
  })
}
