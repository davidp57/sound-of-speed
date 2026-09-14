/**
 * Renouvellement de la position de lecture des couches.
 *
 * Chaque couche est une boucle de trois à cinq secondes. À vitesse de lecture
 * réelle — de 0,26 à 0,81 — elle se répète toutes les quatre à vingt secondes,
 * toujours à l'identique, et l'oreille apprend ce motif en quelques tours. C'est
 * la première cause de l'impression de synthèse.
 *
 * Le remède : de temps en temps, reprendre la lecture ailleurs dans
 * l'enregistrement, par un fondu croisé court. Le motif ne se referme plus.
 *
 * Ce module ne porte que le calcul — la cadence des sauts et la forme du fondu.
 * Le graphe est dans `engine.ts`. Ce partage est ce qui rend la loi de fondu
 * vérifiable sans sortir un son.
 *
 * ## Ce qui est mesuré
 *
 * Relevé sur les quatre couches de la banque `v8-musclecar`, à la fenêtre de 20 ms.
 *
 * **La loi de fondu.** Deux positions d'un même enregistrement sont peu
 * corrélées, donc leurs énergies s'ajoutent au lieu de leurs amplitudes. Un
 * fondu linéaire y creuse un trou de 1,2 à 1,8 dB au passage — la théorie en
 * annonce 1,76, la mesure la retrouve. Le fondu à puissance constante ne creuse
 * rien : de −0,5 à +0,2 dB, soit le bruit de la mesure.
 *
 * **La durée.** Vingt millisecondes. Le pire écart de niveau pendant le fondu y
 * vaut 1,2 à 3,3 dB selon la couche, contre 2,3 à 2,8 dB pour le son qui ne
 * saute pas : le raccord reste sous la respiration naturelle du moteur, sauf sur
 * la prise bas régime où il la dépasse d'un demi-décibel. Cinquante
 * millisecondes font moins bien partout.
 *
 * **L'alignement sur le cycle moteur, essayé, abandonné.** Les prises bas régime
 * sont fortement périodiques — 0,93 d'autocorrélation à 34,6 Hz. Choisir la
 * nouvelle position en phase avec l'ancienne, comme le fait le recollement de
 * boucle, ne change pourtant rien : 1,23 dB contre 1,19, 3,30 contre 3,25. Le
 * fondu est assez court pour que la phase n'ait pas le temps de compter.
 */

/**
 * Durée du fondu croisé, en secondes.
 *
 * Vingt millisecondes : voir la mesure ci-dessus. Ce n'est pas un réglage —
 * un curseur de plus qu'on ne saurait pas régler à l'oreille.
 */
export const REFRESH_FADE_S = 0.02

/**
 * Dispersion de l'intervalle entre deux sauts, en fraction de l'intervalle réglé.
 *
 * Un saut à cadence fixe remplacerait la périodicité de la boucle par la sienne.
 */
export const REFRESH_JITTER = 0.4

/** Nombre de points de la courbe de fondu posée sur les gains. */
export const REFRESH_CURVE_STEPS = 33

/**
 * Gains des deux sources à un instant du fondu, de 0 au début à 1 à la fin.
 *
 * La somme des carrés vaut un : c'est ce qui conserve l'énergie quand les deux
 * signaux sont décorrélés, ce que deux positions d'un même enregistrement sont.
 */
export function equalPowerGains(progress: number): { outgoing: number; incoming: number } {
  const u = Math.min(1, Math.max(0, progress))
  const angle = (u * Math.PI) / 2
  return { outgoing: Math.cos(angle), incoming: Math.sin(angle) }
}

/** Les deux courbes de fondu, échantillonnées pour `setValueCurveAtTime`. */
export function equalPowerCurves(steps: number = REFRESH_CURVE_STEPS): {
  outgoing: Float32Array
  incoming: Float32Array
} {
  const outgoing = new Float32Array(steps)
  const incoming = new Float32Array(steps)
  for (let i = 0; i < steps; i += 1) {
    const gains = equalPowerGains(i / (steps - 1))
    outgoing[i] = gains.outgoing
    incoming[i] = gains.incoming
  }
  return { outgoing, incoming }
}

/**
 * Délai avant le prochain saut, en secondes.
 *
 * `draw` est un tirage de 0 inclus à 1 exclu. À intervalle nul ou négatif le
 * renouvellement est éteint, et le délai retourné est nul : c'est l'appelant qui
 * doit alors ne rien programmer.
 */
export function nextRefreshDelayS(intervalS: number, draw: number): number {
  if (!(intervalS > 0)) return 0
  const spread = Math.min(1, Math.max(0, draw))
  return intervalS * (1 - REFRESH_JITTER + 2 * REFRESH_JITTER * spread)
}
