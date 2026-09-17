/**
 * La chaîne de sortie, commune à toutes les couches.
 *
 * Elle vivait dans `engine.ts`, où elle n'était constructible qu'avec un
 * contexte audio qui joue. Le banc de mesure a besoin de la même chaîne dans un
 * contexte hors ligne : la sortir ici évite d'en écrire une seconde copie, qui
 * dériverait de celle qui sonne et ferait mesurer autre chose que la réalité.
 *
 * Le module ne fait que **construire et raccorder** les nœuds. Ce qui bouge en
 * conduite — seuil du limiteur, fréquence du filtre, courbe de saturation —
 * reste piloté par l'appelant, à partir du profil.
 */

/** Genou du limiteur, en dB. */
export const LIMITER_KNEE_DB = 3
/** Rapport de compression. Élevé : c'est un limiteur, pas un effet. */
export const LIMITER_RATIO = 12
/** Attaque du limiteur, en secondes. */
export const LIMITER_ATTACK_S = 0.002
/** Relâchement du limiteur, en secondes. */
export const LIMITER_RELEASE_S = 0.12
/** Gain de rattrapage placé après le limiteur. */
export const MAKEUP_GAIN = 1.8
/** Facteur de qualité du passe-haut. */
export const HIGHPASS_Q = 0.7

/** Les nœuds de la chaîne, dans l'ordre où le signal les traverse. */
export interface OutputChain {
  /** Entrée commune : c'est là que se branchent les couches, et où porte le volume général. */
  input: GainNode
  highpass: BiquadFilterNode
  shaper: WaveShaperNode
  limiter: DynamicsCompressorNode
  makeup: GainNode
  /** Dernier nœud de la chaîne, à raccorder à ce qui écoute ou enregistre. */
  output: AudioNode
}

export interface OutputChainOptions {
  /** Volume général, posé sur l'entrée. */
  volume?: number
  /**
   * Court-circuite le saturateur, sans le retirer du graphe.
   *
   * Le banc s'en sert pour séparer ce que le saturateur écrase de ce que le
   * limiteur écrase : mesurer les deux ensemble ne dit pas lequel des deux agit.
   */
  bypassShaper?: boolean
  /** Court-circuite le limiteur, pour la même raison. */
  bypassLimiter?: boolean
  /** Gain de rattrapage. Séparé pour pouvoir le mesurer neutre. */
  makeup?: number
  /**
   * L'ordre d'avant le 17 septembre 2026 : le limiteur **avant** le rattrapage.
   *
   * Il est gardé pour une seule raison, le banc : c'est la ligne de comparaison
   * qui dit ce que le déplacement a changé. Rien dans l'application ne le
   * demande.
   *
   * Pourquoi il a été abandonné : le rattrapage de 1,8 ajoute 5,1 dB **après**
   * le limiteur, donc rien ne rattrapait ce qu'il faisait dépasser. Mesuré au
   * banc sur une accélération franche, volume 1 : la crête montait à +5,0 dBFS,
   * un échantillon sur onze était rogné par le convertisseur, et la distorsion
   * atteignait −18 dB. Retirer complètement le limiteur ne changeait la crête
   * que de 0,4 dB — il ne servait à rien là où il était.
   */
  limiterBeforeMakeup?: boolean
}

/**
 * Construit la chaîne et raccorde ses nœuds entre eux.
 *
 * Rien n'est branché sur la destination : c'est à l'appelant de décider ce qui
 * écoute — la sortie de l'appareil pour le moteur, un enregistrement pour le
 * banc.
 */
export function buildOutputChain(
  context: BaseAudioContext,
  options: OutputChainOptions = {},
): OutputChain {
  const input = context.createGain()
  input.gain.value = options.volume ?? 1

  const highpass = context.createBiquadFilter()
  highpass.type = 'highpass'
  highpass.Q.value = HIGHPASS_Q

  const shaper = context.createWaveShaper()
  shaper.oversample = '4x'

  // Rapport élevé et attaque courte : ce n'est pas un compresseur d'effet, il
  // est là pour empêcher la somme des couches de saturer en sortie.
  const limiter = context.createDynamicsCompressor()
  limiter.knee.value = LIMITER_KNEE_DB
  limiter.ratio.value = LIMITER_RATIO
  limiter.attack.value = LIMITER_ATTACK_S
  limiter.release.value = LIMITER_RELEASE_S

  const makeup = context.createGain()
  // Le rattrapage rend le niveau que le limiteur a pris. Il passe **avant** lui
  // depuis le 17 septembre 2026 : placé après, rien ne rattrapait ce qu'il
  // faisait dépasser, et c'est le limiteur qui devenait décoratif.
  makeup.gain.value = options.makeup ?? MAKEUP_GAIN

  // Un court-circuit laisse le nœud dans le graphe et le contourne : le retirer
  // changerait le nombre d'étages, donc la latence, donc ce qu'on compare.
  input.connect(highpass)
  const afterFilter = options.bypassShaper ? highpass : shaper
  if (!options.bypassShaper) highpass.connect(shaper)

  if (options.bypassLimiter) {
    afterFilter.connect(makeup)
    return { input, highpass, shaper, limiter, makeup, output: makeup }
  }

  if (options.limiterBeforeMakeup) {
    afterFilter.connect(limiter)
    limiter.connect(makeup)
    return { input, highpass, shaper, limiter, makeup, output: makeup }
  }

  // L'ordre livré : le limiteur ferme la marche, donc il voit tout ce qui sort.
  afterFilter.connect(makeup)
  makeup.connect(limiter)
  return { input, highpass, shaper, limiter, makeup, output: limiter }
}

/** Courbe de saturation douce. À 0, la courbe est droite et n'altère rien. */
export function saturationCurve(drive: number): Float32Array {
  const amount = Math.max(0, Math.min(1, drive)) * 4
  const size = 1024
  const curve = new Float32Array(size)
  const norm = amount > 0 ? Math.tanh(amount) : 1
  for (let i = 0; i < size; i += 1) {
    const x = (i / (size - 1)) * 2 - 1
    curve[i] = amount > 0 ? Math.tanh(x * amount) / norm : x
  }
  return curve
}
