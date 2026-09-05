/**
 * Fermeture de boucle, telle que l'application la fait au chargement.
 *
 * **C'est un portage, pas une invention.** Les fonctions `makeSeamless`,
 * `seamStep`, `cut` et `findLoopPoint` de `src/core/audio/engine.ts` sont
 * privées à ce module et prennent des `AudioBuffer`, que Node n'a pas. On les
 * refait donc ici sur des `Float32Array`, à l'identique — mêmes constantes,
 * même coût, même règle de décision. Toute correction portée là-bas doit
 * l'être ici, et l'inverse.
 *
 * Pourquoi les rejouer au moment de produire plutôt que de laisser
 * l'application s'en charger : parce qu'on veut **chiffrer** le saut d'énergie
 * de chaque prise avant de la livrer. Une boucle qui claque s'entend
 * immédiatement, et le chiffre dit laquelle claque, avant même de l'écouter.
 */

/** Durée du fondu appliqué aux boucles mal raccordées, en secondes. */
const SEAM_FADE_S = 0.03
/** Fondu, bien plus court, quand le point de bouclage a pu être aligné. */
const ALIGNED_FADE_S = 0.008
/** Discontinuité au-delà de laquelle on recolle la boucle. */
const SEAM_THRESHOLD = 0.005
/** Durée du motif comparé pour trouver le point de bouclage, en secondes. */
const MATCH_WINDOW_S = 0.03
/** Portion de fin explorée à la recherche de ce point, en secondes. */
const SEARCH_SPAN_S = 0.4
/** Poids de la forme d'onde devant l'écart de niveau, dans le choix du raccord. */
const SHAPE_WEIGHT = 0.35

/**
 * Saut d'énergie à la jonction, rapporté au niveau voisin.
 *
 * C'est la grandeur que l'oreille relève : une marche de niveau qui revient à
 * chaque tour de boucle. On compare la fin au début, puisque c'est ce que la
 * lecture en boucle enchaîne.
 */
export function seamStep(samples, sampleRate) {
  const window = Math.floor(0.02 * sampleRate)
  if (samples.length < window * 2) return Number.POSITIVE_INFINITY

  let head = 0
  let tail = 0
  for (let i = 0; i < window; i += 1) {
    head += (samples[i] ?? 0) ** 2
    tail += (samples[samples.length - window + i] ?? 0) ** 2
  }
  const headRms = Math.sqrt(head / window)
  const tailRms = Math.sqrt(tail / window)
  return Math.abs(headRms - tailRms) / (Math.max(headRms, tailRms) + 1e-9)
}

/** Raccourcit l'échantillon à `end` et fond la queue sur le début. */
function cut(samples, end, fade) {
  const length = Math.max(1, end - fade)
  const target = new Float32Array(samples.subarray(0, length))
  for (let i = 0; i < fade; i += 1) {
    const t = i / fade
    const head = target[i] ?? 0
    const tail = samples[length + i] ?? 0
    // Fondu à puissance constante : une rampe linéaire creuserait le niveau au
    // milieu du raccord.
    target[i] = head * Math.sin((t * Math.PI) / 2) + tail * Math.cos((t * Math.PI) / 2)
  }
  return target
}

/**
 * Cherche le meilleur point de bouclage vers la fin de l'échantillon.
 *
 * Le coût retenu mêle l'écart de niveau et la dissemblance de forme, le niveau
 * pesant davantage : c'est lui qui s'entend. Rend `null` quand l'échantillon
 * est trop court pour qu'une recherche ait un sens.
 */
function findLoopPoint(samples, sampleRate) {
  const window = Math.floor(MATCH_WINDOW_S * sampleRate)
  const span = Math.min(Math.floor(SEARCH_SPAN_S * sampleRate), Math.floor(samples.length / 3))
  const from = samples.length - span
  if (from <= window) return null

  let bestEnd = null
  let bestCost = Number.POSITIVE_INFINITY

  for (let end = from; end < samples.length - window; end += 2) {
    let dot = 0
    let headEnergy = 0
    let tailEnergy = 0
    for (let k = 0; k < window; k += 2) {
      const head = samples[k] ?? 0
      const tail = samples[end - window + k] ?? 0
      dot += head * tail
      headEnergy += head * head
      tailEnergy += tail * tail
    }
    const levelGap =
      Math.abs(Math.sqrt(headEnergy) - Math.sqrt(tailEnergy)) /
      (Math.max(Math.sqrt(headEnergy), Math.sqrt(tailEnergy)) + 1e-9)
    const shapeGap = 1 - dot / (Math.sqrt(headEnergy * tailEnergy) + 1e-12)
    const cost = levelGap + SHAPE_WEIGHT * shapeGap

    if (cost < bestCost) {
      bestCost = cost
      bestEnd = end
    }
  }

  return bestEnd
}

/**
 * Ferme la boucle, et dit ce que la fermeture a coûté.
 *
 * Les trois candidats sont mis en concurrence sur la seule grandeur qui compte,
 * le saut d'énergie au raccord : la prise telle quelle, la queue fondue sur le
 * début, et le raccord aligné sur le meilleur point de bouclage. On garde le
 * moins mauvais des trois — la fermeture ne peut donc jamais dégrader ce
 * qu'elle prétend corriger.
 */
export function closeLoop(samples, sampleRate) {
  const longFade = Math.min(
    Math.floor(SEAM_FADE_S * sampleRate),
    Math.floor(samples.length / 4),
  )
  const rawSeam = seamStep(samples, sampleRate)
  if (longFade < 8) return { samples, seam: rawSeam, method: 'brut' }

  let discontinuity = Math.abs((samples[0] ?? 0) - (samples[samples.length - 1] ?? 0))

  const faded = cut(samples, samples.length, longFade)
  const fadedSeam = seamStep(faded, sampleRate)

  const point = findLoopPoint(samples, sampleRate)
  if (point !== null) {
    const shortFade = Math.max(4, Math.floor(ALIGNED_FADE_S * sampleRate))
    const aligned = cut(samples, point, shortFade)
    const alignedSeam = seamStep(aligned, sampleRate)
    if (alignedSeam < fadedSeam) {
      return { samples: aligned, seam: alignedSeam, method: 'aligné' }
    }
  }

  if (discontinuity <= SEAM_THRESHOLD && rawSeam <= fadedSeam) {
    return { samples, seam: rawSeam, method: 'brut' }
  }
  return { samples: faded, seam: fadedSeam, method: 'fondu' }
}
