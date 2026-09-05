/**
 * Les réglages du son synthétisé.
 *
 * Ils ne vivent pas dans le profil : le lot SYNTHESE prévoit un champ
 * `soundSource` à la racine du profil, et une définition de moteur en JSON,
 * mais ni l'un ni l'autre n'existe encore. Ce qui suit est le banc de réglage —
 * de quoi trouver un timbre au bureau. Ce qui sera trouvé partira ensuite dans
 * le profil, qui, lui, voyage.
 *
 * Deux familles de réglages, et la distinction compte : certains s'appliquent
 * sans rien interrompre, les autres exigent de reconstruire le moteur simulé,
 * donc une coupure d'une seconde environ.
 */

export interface SynthSettings {
  /** Quatre cylindres en ligne, ou V8 à vilebrequin croisé. */
  cylinders: 4 | 8
  /** Fréquence de la simulation physique, en hertz. */
  simulationHz: number
  /**
   * Longueur de la réponse impulsionnelle calculée dans engine-sim.
   *
   * Zéro la supprime : la résonance d'échappement passe alors sur un
   * `ConvolverNode` de Web Audio, que le navigateur calcule en transformée de
   * Fourier partitionnée au lieu d'un produit direct. C'est le poste le plus
   * lourd de la chaîne — mesuré à la moitié du budget sur un poste de bureau.
   */
  impulseSamples: number
  /** Ouverture du papillon à effort nul, de 0 à 1. */
  throttleIdle: number
  /** Ouverture du papillon à plein effort, de 0 à 1. */
  throttleFull: number
  /** Volume appliqué dans le synthétiseur, de 0 à 2. */
  volume: number
  /** Taille d'un bloc rendu d'un coup, en échantillons. */
  blockFrames: number
  /** Réserve visée dans le lecteur, en millisecondes. */
  reserveMs: number
  /** Résonance d'échappement déportée sur un `ConvolverNode`. */
  convolver: boolean
  /** Longueur de cette résonance, en millisecondes. */
  convolverMs: number
  /** Part de son réverbéré dans la sortie, de 0 à 1. */
  convolverMix: number
  /**
   * Balayage de régime, du ralenti au rupteur et retour.
   *
   * C'est le seul moyen de juger « à régime tenu, puis en accélération » sans
   * conduire : le banc impose la montée, à cadence connue, et l'on écoute. Il
   * remplace le régime que la chaîne calcule tant qu'il est actif.
   */
  sweep: boolean
  /** Durée d'un aller-retour du balayage, en secondes. */
  sweepSeconds: number
  /**
   * Le niveleur d'engine-sim.
   *
   * Il vise une crête constante, ce qui donne un niveau utilisable quel que
   * soit le moteur — et efface l'effort au passage. Le couper laisse passer la
   * dynamique du modèle : c'est le réglage qui décide si l'effort s'entend.
   */
  leveler: boolean
  /** Gain fixe appliqué quand le niveleur est coupé. */
  levelerGain: number
  /** Imposer l'effort plutôt que de suivre celui du moteur. */
  forceEffort: boolean
  /** L'effort imposé, de 0 à 1. */
  forcedEffort: number
}

export const DEFAULT_SYNTH: SynthSettings = {
  cylinders: 8,
  simulationHz: 10000,
  // Convolution déportée par défaut : c'est le seul réglage qui a fait passer
  // le V8 au-dessus du temps réel sur le poste de bureau.
  impulseSamples: 0,
  throttleIdle: 0.06,
  throttleFull: 1,
  /**
   * Zéro vingt-cinq, et c'est mesuré.
   *
   * Le niveleur d'engine-sim vise une crête de 30 000 sur 32 767, soit 0,92 —
   * mais son suiveur de crête décroît en vingt millisecondes, l'intervalle
   * entre deux allumages d'un V8 à 800 tr/min. Le gain remonte donc entre deux
   * bouffées et la suivante déborde. Relevé, régime tenu à 800 : la crête reste
   * collée à 1,000 jusqu'à un volume de 0,35, et tombe à 0,890 à 0,25. Le
   * facteur de crête vaut 28 — un moteur, c'est des impulsions.
   */
  volume: 0.25,
  blockFrames: 1024,
  reserveMs: 250,
  convolver: true,
  convolverMs: 220,
  convolverMix: 0.5,
  leveler: true,
  levelerGain: 1,
  sweep: false,
  sweepSeconds: 12,
  forceEffort: false,
  forcedEffort: 0.5,
}

function clamp(value: number, low: number, high: number): number {
  if (!Number.isFinite(value)) return low
  return value < low ? low : value > high ? high : value
}

/**
 * Ramène des réglages dans leur domaine.
 *
 * Les bornes ne sont pas décoratives : un bloc trop court fait plus d'appels
 * que de calcul, une fréquence de simulation trop basse fait rater des
 * allumages, et un papillon inversé rendrait l'effort silencieux.
 */
export function clampSynthSettings(settings: SynthSettings): SynthSettings {
  const idle = clamp(settings.throttleIdle, 0, 1)
  return {
    cylinders: settings.cylinders === 4 ? 4 : 8,
    simulationHz: Math.round(clamp(settings.simulationHz, 4000, 24000)),
    impulseSamples: Math.round(clamp(settings.impulseSamples, 0, 10000)),
    throttleIdle: idle,
    throttleFull: clamp(settings.throttleFull, idle, 1),
    volume: clamp(settings.volume, 0, 2),
    blockFrames: Math.round(clamp(settings.blockFrames, 128, 8192)),
    reserveMs: Math.round(clamp(settings.reserveMs, 40, 1000)),
    convolver: settings.convolver,
    convolverMs: Math.round(clamp(settings.convolverMs, 10, 2000)),
    convolverMix: clamp(settings.convolverMix, 0, 1),
    leveler: settings.leveler,
    levelerGain: clamp(settings.levelerGain, 0.01, 4),
    sweep: settings.sweep,
    sweepSeconds: clamp(settings.sweepSeconds, 2, 120),
    forceEffort: settings.forceEffort,
    forcedEffort: clamp(settings.forcedEffort, 0, 1),
  }
}

/**
 * Le changement demande-t-il de reconstruire le moteur simulé ?
 *
 * Le nombre de cylindres, la fréquence de simulation et la longueur de la
 * réponse impulsionnelle sont figés à la construction, dans des tableaux
 * dimensionnés une fois pour toutes. Le reste — papillon, volume — s'écrit à
 * chaud, et c'est ce qui rend le réglage du timbre supportable : on l'entend
 * changer sans coupure.
 */
export function needsRebuild(previous: SynthSettings, next: SynthSettings): boolean {
  return (
    previous.cylinders !== next.cylinders ||
    previous.simulationHz !== next.simulationHz ||
    previous.impulseSamples !== next.impulseSamples ||
    previous.blockFrames !== next.blockFrames ||
    // Les deux bornes de gain du niveleur ne sont recopiées qu'une fois, dans
    // `Synthesizer::initialize` : les écrire à chaud ne fait rien, mesuré.
    previous.leveler !== next.leveler ||
    previous.levelerGain !== next.levelerGain
  )
}
