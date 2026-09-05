/**
 * La réserve du lecteur, et le compte des creux.
 *
 * Le calcul du son ne tient pas dans le fil audio : engine-sim demande, sur un
 * poste de bureau, entre la moitié et la totalité du temps réel pour un V8. Il
 * tourne donc dans un fil séparé, qui remplit une réserve, et le fil audio se
 * sert dedans. Toute la question est de garder cette réserve pleine sans jamais
 * calculer trop en avance — ce qui ajouterait du retard entre le cadran et le
 * son.
 *
 * Ce qui suit est la partie du raisonnement qui ne touche ni à Web Audio ni au
 * WebAssembly, donc la partie vérifiable.
 */

/** Combien de blocs rendre pour remonter la réserve à sa cible. */
export function blocksToRender(
  queuedFrames: number,
  reserveFrames: number,
  blockFrames: number,
  maxBlocks = 32,
): number {
  if (blockFrames <= 0) return 0
  const missing = reserveFrames - queuedFrames
  if (missing <= 0) return 0
  return Math.min(maxBlocks, Math.ceil(missing / blockFrames))
}

/**
 * Le compte des creux, tel que le lecteur le tient.
 *
 * Deux chiffres et non un : le **nombre** de creux dit combien de fois le son
 * s'est interrompu, la **durée** dit combien on a perdu. Dix creux d'un bloc
 * s'entendent comme dix craquements ; un creux de dix blocs s'entend comme un
 * trou. Le premier chiffre est le pire des deux, et il faut donc les voir tous
 * les deux.
 */
export interface UnderrunTally {
  count: number
  frames: number
  /** Vrai tant que le creux en cours n'est pas refermé. */
  open: boolean
}

export const EMPTY_TALLY: UnderrunTally = { count: 0, frames: 0, open: false }

/** Enregistre un tour du lecteur : `missing` échantillons n'ont pas été servis. */
export function tallyUnderrun(tally: UnderrunTally, missing: number): UnderrunTally {
  if (missing <= 0) return tally.open ? { ...tally, open: false } : tally
  return {
    count: tally.open ? tally.count : tally.count + 1,
    frames: tally.frames + missing,
    open: true,
  }
}

/**
 * Le coefficient temps réel d'une fenêtre de mesure.
 *
 * Un cumul divisé par la durée totale ne dit pas ce qui se passe maintenant :
 * il faut une fenêtre. Rend 0 quand rien n'a été rendu — pas l'infini, qui
 * s'afficherait comme une performance.
 */
export function realtimeFactor(cpuSeconds: number, audioSeconds: number): number {
  if (audioSeconds <= 0 || cpuSeconds <= 0) return 0
  return audioSeconds / cpuSeconds
}
