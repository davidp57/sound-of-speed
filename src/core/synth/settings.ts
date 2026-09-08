/**
 * Les réglages du son synthétisé.
 *
 * Ce qui décrit le **moteur** vit dans le profil, où il voyage : c'est
 * `EngineDefinition`, les vingt-sept nombres du contrat. Ce qui reste ici est ce
 * qui décrit le **calcul et le poste** — la fréquence de simulation, la taille
 * de bloc, la réserve, la résonance de sortie —, et qui n'a aucune raison de
 * suivre un profil d'une machine à l'autre.
 *
 * Deux familles de réglages, et la distinction compte : certains s'appliquent
 * sans rien interrompre, les autres exigent de reconstruire le moteur simulé,
 * donc une coupure d'une seconde environ.
 */

import { DEFAULT_RENDERING, clampSynthRendering, type SynthRendering } from './rendering'

export {
  DEFAULT_RENDERING,
  EXHAUST_RESPONSES,
  MUFFLER_INSIDE_HZ,
  MUFFLER_OUTSIDE_HZ,
  SYNTH_RENDERING_KEYS,
  clampSynthRendering,
  exhaustResponseFile,
  renderingOf,
  type ExhaustResponse,
  type SynthRendering,
} from './rendering'

export interface SynthSettings extends SynthRendering {
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
  /** Taille d'un bloc rendu d'un coup, en échantillons. */
  blockFrames: number
  /** Réserve visée dans le lecteur, en millisecondes. */
  reserveMs: number
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
  /** Imposer l'effort plutôt que de suivre celui du moteur. */
  forceEffort: boolean
  /** L'effort imposé, de 0 à 1. */
  forcedEffort: number
  /**
   * La fermeté du dynamomètre, en livres-pied.
   *
   * Il tient le régime par une contrainte du solveur, résolue à chaque pas, et
   * son couple maximal vaut dix mille livres-pied à l'origine. À chaque
   * explosion il freine d'un coup, entre deux il entraîne. Le soupçon à
   * vérifier : ce va-et-vient injecterait du bruit large bande dans la
   * rotation, et la rotation module tout le son.
   *
   * **Le soupçon a été vérifié le 8 septembre 2026, et il est faux.** Balayé de
   * dix mille à vingt à 2 950 tr/min, le régime tenu ne respire à aucun moment :
   * jusqu'à quarante il vaut **exactement** le régime demandé, puis il s'établit
   * plus bas — 2 728 à trente, 2 576 à vingt-cinq, 2 435 à vingt — et chaque
   * fois aussi figé qu'avant. Le baisser ne fait pas osciller le régime, il le
   * fausse.
   *
   * Ce réglage n'a donc aucun emploi utile, et rien ne l'expose à l'écran : le
   * laisser à son maximum est la seule valeur qui tienne. La respiration d'un
   * moteur est à chercher du côté des deux bruits d'engine-sim, `airNoise` et
   * `inputSampleNoise`.
   */
  dynoTorque: number
}

export const DEFAULT_SYNTH: SynthSettings = {
  ...DEFAULT_RENDERING,
  simulationHz: 10000,
  // Convolution déportée par défaut : c'est le seul réglage qui a fait passer
  // le V8 au-dessus du temps réel sur le poste de bureau.
  impulseSamples: 0,
  blockFrames: 1024,
  // Cent vingt millisecondes, et non deux cent cinquante. La réserve absorbe les
  // pointes de calcul, mais elle se paie en retard entre le geste et le son :
  // David l'a vu au changement de rapport, « les tours retombent avant le son ».
  // Avec la réserve interne d'engine-sim par-dessus, on était à plus de trois
  // dixièmes de seconde.
  reserveMs: 120,
  sweep: false,
  sweepSeconds: 12,
  forceEffort: false,
  forcedEffort: 0.5,
  dynoTorque: 10000,
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
  return {
    ...clampSynthRendering(settings),
    simulationHz: Math.round(clamp(settings.simulationHz, 4000, 24000)),
    impulseSamples: Math.round(clamp(settings.impulseSamples, 0, 10000)),
    blockFrames: Math.round(clamp(settings.blockFrames, 128, 8192)),
    reserveMs: Math.round(clamp(settings.reserveMs, 40, 1000)),
    dynoTorque: Math.round(clamp(settings.dynoTorque, 20, 10000)),
    sweep: settings.sweep,
    sweepSeconds: clamp(settings.sweepSeconds, 2, 120),
    forceEffort: settings.forceEffort,
    forcedEffort: clamp(settings.forcedEffort, 0, 1),
  }
}

/**
 * Le changement demande-t-il de reconstruire le moteur simulé ?
 *
 * La fréquence de simulation et la longueur de la réponse impulsionnelle sont
 * figées à la construction, dans des tableaux dimensionnés une fois pour toutes.
 * Le reste — papillon, volume — s'écrit à chaud, et c'est ce qui rend le réglage
 * du timbre supportable : on l'entend changer sans coupure.
 *
 * La description du moteur, elle, ne passe plus par ici : elle vit dans le
 * profil, et c'est `needsEngineRebuild` qui répond la même question pour elle.
 */
export function needsRebuild(previous: SynthSettings, next: SynthSettings): boolean {
  return (
    previous.simulationHz !== next.simulationHz ||
    previous.impulseSamples !== next.impulseSamples ||
    previous.blockFrames !== next.blockFrames ||
    // Les deux bornes de gain du niveleur ne sont recopiées qu'une fois, dans
    // `Synthesizer::initialize` : les écrire à chaud ne fait rien, mesuré.
    previous.leveler !== next.leveler ||
    previous.levelerGain !== next.levelerGain
    // La cible du niveleur n'est volontairement pas ici : elle est relue à
    // chaque échantillon par `renderAudio` et s'écrit à chaud
    // (`synth_set_leveler_target`), donc la régler ne coupe plus le son.
  )
}
