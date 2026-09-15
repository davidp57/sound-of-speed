/**
 * Le recul entre deux tentatives de dépôt.
 *
 * Une voiture traverse des zones sans réseau, et le dépôt doit repartir tout
 * seul au retour. Entre les deux, la question est : à quelle cadence réessayer ?
 *
 * **Elle n'est pas libre.** Le 11 septembre 2026, le journal a consommé
 * **sept cent vingt-six rangs de tranche en quarante-quatre minutes d'arrêt** —
 * un toutes les 3,6 secondes, la durée d'une requête qui n'aboutit pas. La
 * tranche revenait en attente par `restore`, pesait à nouveau plus que le seuil
 * de découpage, et `shouldSlice` redisait « oui » au tour suivant. Rien ne
 * tenait la cadence : ni le critère de durée, remis à zéro par `takeSlice`, ni
 * le critère de taille, que le retour de la tranche rétablissait aussitôt.
 *
 * Cette politique existait déjà dans `queue.ts`, pour la file des dépôts. Elle
 * est sortie ici parce que le dépôt des tranches en avait besoin à l'identique,
 * et que deux mécanismes qui décrivent le même fait finissent par diverger.
 *
 * Rien ici ne connaît le réseau ni l'horloge : le temps est reçu.
 */

export interface BackoffLimits {
  /** Attente après un premier échec, en millisecondes. Elle double ensuite. */
  retryMs: number
  /** Attente maximale entre deux tentatives, en millisecondes. */
  maxRetryMs: number
}

export const DEFAULT_BACKOFF: BackoffLimits = {
  retryMs: 30_000,
  maxRetryMs: 15 * 60_000,
}

export class Backoff {
  private failures = 0
  private nextTryAt = 0

  constructor(private readonly limits: BackoffLimits = DEFAULT_BACKOFF) {}

  /** Échecs consécutifs depuis la dernière réussite. */
  get failureCount(): number {
    return this.failures
  }

  /** Instant de la prochaine tentative permise, sur l'horloge reçue. */
  get readyAt(): number {
    return this.nextTryAt
  }

  /** L'heure est-elle venue de réessayer ? */
  ready(at: number): boolean {
    return at >= this.nextTryAt
  }

  /** Un dépôt a abouti : le recul retombe à rien. */
  succeeded(): void {
    this.failures = 0
    this.nextTryAt = 0
  }

  /**
   * Un dépôt a échoué.
   *
   * `retry` dit si la même tentative vaut d'être refaite. Un refus ne se corrige
   * pas tout seul : on attend l'attente maximale plutôt que de répéter une
   * requête dont on connaît la réponse.
   */
  failed(at: number, retry: boolean): void {
    this.failures += 1
    this.nextTryAt = at + (retry ? this.wait() : this.limits.maxRetryMs)
  }

  /** Force la prochaine tentative, quand l'utilisateur ou l'arrêt la demande. */
  retryNow(): void {
    this.nextTryAt = 0
    this.failures = 0
  }

  private wait(): number {
    const wait = this.limits.retryMs * 2 ** Math.min(this.failures - 1, 8)
    return Math.min(wait, this.limits.maxRetryMs)
  }
}
