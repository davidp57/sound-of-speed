/**
 * La résonance d'échappement, quand Web Audio la calcule à notre place.
 *
 * engine-sim convolue son signal par une réponse impulsionnelle, échantillon
 * par échantillon : dix mille multiplications par échantillon de sortie. Mesuré
 * sur le poste de bureau, c'est la moitié du budget processeur. Web Audio sait
 * faire la même chose en transformée de Fourier partitionnée, dans du code
 * natif, pour une fraction du prix.
 *
 * On reprend donc la recette d'engine-sim — un bruit qui décroît en
 * exponentielle — pour la donner à un `ConvolverNode`. Ce n'est pas la réponse
 * d'un vrai échappement : c'est la même approximation que celle du modèle, au
 * même endroit de la chaîne.
 */

/** Générateur reproductible : deux appels de mêmes réglages donnent le même son. */
function makeRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    // Xorshift 32 bits. Rien n'exige une bonne loi ici — seulement qu'elle soit
    // la même d'une exécution à l'autre, pour qu'un réglage se compare.
    state ^= state << 13
    state >>>= 0
    state ^= state >>> 17
    state ^= state << 5
    state >>>= 0
    return state / 0xffffffff
  }
}

/**
 * Une réponse impulsionnelle en bruit décroissant.
 *
 * `decay` est le nombre de constantes de temps sur la durée : 4 laisse 1,8 %
 * du niveau à la fin, ce qui suffit pour que la coupure ne s'entende pas.
 */
export function exhaustImpulse(length: number, decay = 4): Float32Array {
  const samples = Math.max(1, Math.floor(length))
  const out = new Float32Array(samples)
  const random = makeRandom(1)
  for (let i = 0; i < samples; i += 1) {
    const envelope = Math.exp((-decay * i) / samples)
    out[i] = (2 * random() - 1) * envelope
  }
  return out
}
