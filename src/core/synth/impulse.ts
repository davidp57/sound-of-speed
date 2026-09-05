/**
 * La résonance d'échappement, quand Web Audio la calcule à notre place.
 *
 * engine-sim convolue son signal par une réponse impulsionnelle, échantillon
 * par échantillon : dix mille multiplications par échantillon de sortie. Mesuré
 * sur le poste de bureau, c'est la moitié du budget processeur. Web Audio sait
 * faire la même chose en transformée de Fourier partitionnée, dans du code
 * natif, pour une fraction du prix.
 *
 * **Ce n'est pas un bruit, c'est un tube.** La première version reprenait la
 * recette d'engine-sim — un bruit blanc qui décroît en exponentielle — et
 * c'était une erreur de fond : convoluer des impulsions par du bruit rend du
 * bruit. À haut régime les explosions se succèdent assez vite pour que la
 * texture tienne, mais au ralenti chaque explosion devient une bouffée de
 * souffle au lieu d'un coup. David l'a entendu ainsi, résonance à fond : « on
 * n'entend pas du tout le moteur, juste le souffle, comme des interférences sur
 * une radio FM ».
 *
 * Un échappement est un tube. Son onde de pression court jusqu'au bout, se
 * réfléchit sur l'extrémité ouverte — en changeant de signe —, revient, et
 * ainsi de suite en s'affaiblissant. Sa réponse impulsionnelle est donc une
 * suite d'échos espacés du temps d'aller-retour, pas du souffle. C'est ce qui
 * lui donne sa note, et c'est ce qu'on construit ici.
 */

/**
 * La réponse d'un tube d'échappement.
 *
 * @param length durée de la réponse, en échantillons
 * @param sampleRate cadence du contexte audio, en hertz
 * @param tubeHz fréquence d'accord du tube — l'inverse du temps d'aller-retour
 * @param decay nombre de constantes de temps sur la durée ; 4 laisse 1,8 % à la fin
 *
 * Chaque réflexion est adoucie par un passe-bas à un pôle : une extrémité de
 * tube ne renvoie pas une impulsion nette, elle perd ses aigus à chaque
 * passage. Sans cela le peigne sonnerait métallique.
 */
export function exhaustImpulse(
  length: number,
  sampleRate = 48000,
  tubeHz = 60,
  decay = 4,
): Float32Array {
  const samples = Math.max(1, Math.floor(length))
  const out = new Float32Array(samples)

  const period = sampleRate / Math.max(1, tubeHz)
  for (let k = 0; k * period < samples; k += 1) {
    const position = Math.round(k * period)
    if (position >= samples) break
    // Le signe alterne : l'extrémité ouverte réfléchit une onde de pression en
    // onde de dépression. C'est ce qui met la fondamentale à un demi-tour de
    // tube et non à un tour entier.
    const sign = k % 2 === 0 ? 1 : -1
    const envelope = Math.exp((-decay * position) / samples)
    out[position] = (out[position] ?? 0) + sign * envelope
  }

  return normalizeEnergy(soften(out, sampleRate))
}

/**
 * Adoucit une suite d'échos en passe-bas à un pôle.
 *
 * Une réflexion réelle s'étale et perd ses aigus. Un train de pics nus
 * donnerait un peigne parfait — un son de tuyau d'orgue, pas d'échappement.
 * Deux kilohertz : assez haut pour que la note reste franche, assez bas pour
 * que les pics cessent de claquer.
 */
function soften(response: Float32Array, sampleRate: number): Float32Array {
  const cutoffHz = 2000
  const a = 1 - Math.exp((-2 * Math.PI * cutoffHz) / sampleRate)
  let state = 0
  for (let i = 0; i < response.length; i += 1) {
    state += a * ((response[i] ?? 0) - state)
    response[i] = state
  }
  return response
}

/**
 * Ramène la réponse à une énergie de un.
 *
 * Sans cela, allonger la résonance rend le son plus fort et la raccourcir le
 * rend plus faible — deux réglages pour un seul curseur, impossible à régler
 * à l'oreille. La normalisation du `ConvolverNode` vise autre chose et n'est pas
 * sous notre main : on la coupe et l'on fait la nôtre.
 *
 * L'énergie plutôt que la crête, parce que les contributions se somment sans
 * se renforcer : c'est la somme des carrés qui se conserve, pas le maximum.
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
