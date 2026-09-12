/**
 * Pourquoi la vitesse ne bouge plus, quand des positions arrivent quand même.
 *
 * Une source qui reçoit et jette tout est indiscernable, à l'écran, d'une source
 * qui ne reçoit rien : les deux donnent une vitesse figée. Le chien de garde ne
 * sait pas les distinguer non plus, et relance un suivi qui fonctionnait très
 * bien — c'est ce qu'on a vu en roulant le 4 septembre 2026, avec un étalonnage
 * qui avait plafonné la vitesse acceptée à 40 km/h.
 *
 * Cette pièce ne connaît que des nombres : elle ne lit pas l'heure, ne parle à
 * personne, et se vérifie sans navigateur. Elle ne corrige rien non plus — elle
 * nomme la cause pour qu'on la lise à l'écran, la correction relevant du réglage
 * qui a produit la borne.
 */

/** Silence au-delà duquel on cherche une explication, en secondes. */
export const REJECTION_AFTER_S = 3

/** Les comptes d'une source, tels qu'elle les tient. */
export interface RejectionCounts {
  received: number
  emitted: number
  implausible: number
  tooClose: number
  inaccurate: number
}

/**
 * La cause dominante, ou `null` quand il n'y a rien à dire.
 *
 * `none` couvre le cas où la source reçoit, ne produit rien, et ne compte aucun
 * rejet : ce n'est plus un filtre qui écarte les mesures, c'est autre chose, et
 * l'annoncer comme un rejet serait mentir.
 */
export type RejectionCause = 'implausible' | 'tooClose' | 'inaccurate' | 'none'

const ZERO: RejectionCounts = {
  received: 0,
  emitted: 0,
  implausible: 0,
  tooClose: 0,
  inaccurate: 0,
}

export class RejectionWatch {
  private readonly afterS: number
  /** Les comptes au dernier instant où une vitesse est sortie. */
  private mark: RejectionCounts = ZERO
  private silenceS = 0

  constructor(afterS: number = REJECTION_AFTER_S) {
    this.afterS = afterS
  }

  reset(): void {
    this.mark = ZERO
    this.silenceS = 0
  }

  /**
   * Avance d'un tour de boucle et rend la cause du silence, ou `null`.
   *
   * @param dt      Temps écoulé depuis le tour précédent, en secondes.
   * @param counts  Les comptes courants de la source.
   */
  tick(dt: number, counts: RejectionCounts): RejectionCause | null {
    if (counts.emitted !== this.mark.emitted) {
      this.mark = { ...counts }
      this.silenceS = 0
      return null
    }

    this.silenceS += dt
    if (this.silenceS < this.afterS) return null

    // Rien n'arrive non plus : c'est un silence de la source, pas un rejet. Le
    // chien de garde s'en occupe, et le dire deux fois brouillerait les deux.
    if (counts.received === this.mark.received) return null

    return dominant(counts, this.mark)
  }
}

function dominant(counts: RejectionCounts, mark: RejectionCounts): RejectionCause {
  const grown: [RejectionCause, number][] = [
    ['implausible', counts.implausible - mark.implausible],
    ['inaccurate', counts.inaccurate - mark.inaccurate],
    ['tooClose', counts.tooClose - mark.tooClose],
  ]
  let best: RejectionCause = 'none'
  let most = 0
  for (const [cause, growth] of grown) {
    if (growth > most) {
      most = growth
      best = cause
    }
  }
  return best
}
