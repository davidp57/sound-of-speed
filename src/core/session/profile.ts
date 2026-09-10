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
 */

export interface ProfileColumn {
  /** Accélération la plus forte de la colonne, en m/s². Zéro s'il n'y en a pas. */
  up: number
  /** Freinage le plus fort, en m/s², compté positivement. */
  down: number
}

export interface AccelProfile {
  columns: ProfileColumn[]
  /** La plus grande valeur, dans un sens ou dans l'autre, pour l'échelle. */
  peak: number
}

/**
 * Découpe la durée en colonnes et garde les extrêmes de chacune.
 *
 * Les colonnes sans relevé restent vides plutôt que d'hériter de leur voisine :
 * un trou dans l'enregistrement est une information, et le combler dessinerait
 * une conduite qui n'a pas eu lieu.
 */
export function accelProfile(
  states: StatePoint[],
  durationMs: number,
  columns: number,
): AccelProfile {
  const largeur = Math.max(1, Math.floor(columns))
  const colonnes: ProfileColumn[] = Array.from({ length: largeur }, () => ({ up: 0, down: 0 }))
  if (states.length === 0 || durationMs <= 0) return { columns: colonnes, peak: 0 }

  // Au-delà de trois fois la cadence habituelle, c'est un trou dans
  // l'enregistrement et non un intervalle : on ne le comble pas.
  const coupure = 3 * medianGap(states)
  let peak = 0

  const colonneDe = (at: number): number =>
    Math.min(largeur - 1, Math.max(0, Math.floor((at / durationMs) * largeur)))

  const poser = (index: number, valeur: number): void => {
    const colonne = colonnes[index] as ProfileColumn
    if (valeur > colonne.up) colonne.up = valeur
    if (-valeur > colonne.down) colonne.down = -valeur
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
