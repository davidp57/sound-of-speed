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
  return normalizeEnergy(out)
}

/**
 * Ramène la réponse à une énergie de un.
 *
 * Sans cela, allonger la résonance rend le son plus fort et la raccourcir le
 * rend plus faible — deux réglages pour un seul curseur, impossible à régler
 * à l'oreille. La normalisation du `ConvolverNode` vise autre chose et n'est pas
 * sous notre main : on la coupe et l'on fait la nôtre.
 *
 * L'énergie plutôt que la crête, parce qu'un bruit convolué se comporte comme
 * une somme de contributions indépendantes : c'est la somme des carrés qui se
 * conserve, pas le maximum.
 */
export function normalizeEnergy(response: Float32Array): Float32Array {
  let energy = 0
  for (let i = 0; i < response.length; i += 1) {
    const value = response[i] ?? 0
    energy += value * value
  }
  if (energy <= 0) return response
  const gain = 1 / Math.sqrt(energy)
  for (let i = 0; i < response.length; i += 1) response[i] = (response[i] ?? 0) * gain
  return response
}
