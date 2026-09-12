/**
 * Chien de garde du signal de vitesse.
 *
 * Les systèmes mobiles espacent fortement les mesures de position dès que la
 * page n'est plus au premier plan, et finissent parfois par ne plus rien
 * envoyer du tout. Le son, lui, continue — il se figerait alors sur la dernière
 * vitesse connue, ce qui est pire que le silence : rien ne le signale.
 *
 * Deux contraintes ont dicté cette forme.
 *
 * D'abord **pas de minuteur**. Un `setInterval` est ralenti, puis gelé, en
 * arrière-plan — précisément là où le chien de garde sert. Il est donc
 * interrogé à chaque tour de boucle, laquelle continue de battre grâce à
 * l'horloge du fil audio. Cette pièce ne connaît donc que des nombres : elle ne
 * lit pas l'heure, ne pose pas de minuteur, et se vérifie sans navigateur.
 *
 * Ensuite **une relance ne se répète pas**. Un GPS réellement indisponible
 * serait sinon relancé soixante fois par seconde, sans plus de résultat qu'une
 * fois toutes les cinq secondes.
 */

/** Silence au-delà duquel on considère le suivi perdu, en millisecondes. */
export const STALE_FIX_MS = 20_000
/** Délai minimal entre deux relances, en millisecondes. */
export const RESTART_COOLDOWN_MS = 5_000

export interface FixWatchdogOptions {
  staleAfterMs?: number
  cooldownMs?: number
}

export class FixWatchdog {
  private readonly staleAfterMs: number
  private readonly cooldownMs: number

  /** Temps accumulé depuis la dernière relance, en millisecondes. */
  private sinceRestartMs = Number.POSITIVE_INFINITY

  /** Nombre de relances demandées. Remonté à l'écran de télémétrie. */
  restarts = 0

  constructor(options: FixWatchdogOptions = {}) {
    this.staleAfterMs = options.staleAfterMs ?? STALE_FIX_MS
    this.cooldownMs = options.cooldownMs ?? RESTART_COOLDOWN_MS
  }

  reset(): void {
    this.sinceRestartMs = Number.POSITIVE_INFINITY
    this.restarts = 0
  }

  /**
   * Avance d'un tour de boucle et dit s'il faut relancer le suivi.
   *
   * @param dt                 Temps écoulé depuis le tour précédent, en secondes.
   * @param sinceLastSampleMs  Silence de la source, en millisecondes.
   * @param watching           Faux quand le suivi est à l'arrêt, ou quand la
   *                           source n'est pas celle qu'on surveille — un
   *                           simulateur ni un rejeu ne se relancent.
   */
  tick(dt: number, sinceLastSampleMs: number, watching: boolean): boolean {
    if (!watching) {
      // Le compte du délai ne court pas quand il n'y a rien à surveiller :
      // reprendre le suivi ne doit pas hériter d'une attente déjà écoulée.
      this.sinceRestartMs = Number.POSITIVE_INFINITY
      return false
    }

    if (Number.isFinite(dt) && dt > 0 && Number.isFinite(this.sinceRestartMs)) {
      this.sinceRestartMs += dt * 1000
    }

    if (sinceLastSampleMs < this.staleAfterMs) return false
    if (this.sinceRestartMs < this.cooldownMs) return false

    this.sinceRestartMs = 0
    this.restarts += 1
    return true
  }
}
