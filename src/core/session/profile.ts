import type { StatePoint } from './model'

/**
 * Le relief d'un trajet, réduit à une colonne par pixel.
 *
 * Sous la timeline, quelques pixels de haut suffisent à voir où l'on a
 * accéléré et où l'on a freiné — et donc à viser un moment sans le chercher.
 *
 * **Une colonne par pixel, et non un point par relevé.** Une capture d'une
 * heure porte trente-six mille relevés pour une barre qui en fait mille : les
 * tracer tous coûterait cher pour un dessin qu'on ne verrait pas mieux. Chaque
 * colonne garde l'extrême de ce qu'elle couvre, et non la moyenne : une
 * moyenne efface un freinage bref, qui est justement ce qu'on cherche.
 *
 * **Une valeur signée par colonne, et non deux extrêmes.** Le dessin est une
 * courbe continue dont la couleur change au passage par zéro ; il lui faut une
 * valeur par abscisse, pas un maximum et un minimum qui se superposeraient.
 */

export interface ProfileColumn {
  /** Accélération en m/s², signée : positive en accélérant, négative en freinant. */
  value: number
  /** Faux quand aucun relevé ne couvre cette colonne — un trou, pas un zéro. */
  filled: boolean
}

export interface AccelProfile {
  columns: ProfileColumn[]
  /** La plus grande valeur, dans un sens ou dans l'autre, pour l'échelle. */
  peak: number
}

/**
 * Découpe la durée en colonnes et garde l'extrême de chacune.
 *
 * Les colonnes que rien ne couvre restent vides plutôt que d'hériter de leur
 * voisine : un trou dans l'enregistrement est une information, et le combler
 * dessinerait une conduite qui n'a pas eu lieu.
 */
export function accelProfile(
  states: StatePoint[],
  durationMs: number,
  columns: number,
): AccelProfile {
  const largeur = Math.max(1, Math.floor(columns))
  const colonnes: ProfileColumn[] = Array.from({ length: largeur }, () => ({
    value: 0,
    filled: false,
  }))
  if (states.length === 0 || durationMs <= 0) return { columns: colonnes, peak: 0 }

  // Au-delà de trois fois la cadence habituelle, c'est un trou dans
  // l'enregistrement et non un intervalle : on ne le comble pas.
  const coupure = 3 * medianGap(states)
  let peak = 0

  const colonneDe = (at: number): number =>
    Math.min(largeur - 1, Math.max(0, Math.floor((at / durationMs) * largeur)))

  const poser = (index: number, valeur: number): void => {
    const colonne = colonnes[index] as ProfileColumn
    if (!colonne.filled || Math.abs(valeur) > Math.abs(colonne.value)) colonne.value = valeur
    colonne.filled = true
  }

  for (let i = 0; i < states.length; i += 1) {
    const point = states[i] as StatePoint
    const suivant = states[i + 1]
    const amplitude = Math.abs(point.accelMs2)
    if (amplitude > peak) peak = amplitude

    const début = colonneDe(point.at)
    // Un relevé vaut jusqu'au suivant : à un relevé toutes les dix secondes
    // pour une barre de mille pixels, les poser en points isolés donnerait un
    // pointillé illisible. C'est la cadence de l'enregistrement qu'on dessine,
    // pas une mesure continue qu'on n'a pas.
    const fin =
      suivant && suivant.at - point.at <= coupure ? colonneDe(suivant.at) - 1 : début

    for (let x = début; x <= Math.max(début, fin); x += 1) poser(x, point.accelMs2)
  }

  return { columns: colonnes, peak }
}

/**
 * Les tronçons continus de la courbe.
 *
 * Un trou d'enregistrement coupe le trait : relier ses deux bords tracerait une
 * pente qui n'a pas eu lieu, et c'est exactement ce qu'on refuse de dessiner.
 * Chaque tronçon est une suite d'abscisses et de valeurs, prête à devenir une
 * polyligne.
 */
export function profileRuns(columns: ProfileColumn[]): { x: number; value: number }[][] {
  const runs: { x: number; value: number }[][] = []
  let courant: { x: number; value: number }[] = []

  for (const [x, colonne] of columns.entries()) {
    if (!colonne.filled) {
      if (courant.length > 0) runs.push(courant)
      courant = []
      continue
    }
    courant.push({ x, value: colonne.value })
  }
  if (courant.length > 0) runs.push(courant)

  return runs
}

/** L'écart habituel entre deux relevés : la médiane, que les trous ne bougent pas. */
function medianGap(states: StatePoint[]): number {
  if (states.length < 2) return Infinity
  const écarts: number[] = []
  for (let i = 0; i < states.length - 1; i += 1) {
    écarts.push((states[i + 1] as StatePoint).at - (states[i] as StatePoint).at)
  }
  écarts.sort((a, b) => a - b)
  return écarts[Math.floor(écarts.length / 2)] ?? Infinity
}
