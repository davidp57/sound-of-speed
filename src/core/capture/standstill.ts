/**
 * Déposer ce qui attend quand la voiture s'arrête pour de bon.
 *
 * Une tranche part toutes les cinq minutes. La dernière, elle, n'a pas cinq
 * minutes devant elle : elle attend une fin de session qui n'arrive jamais.
 * David : « mon habitude c'est juste de sortir de ma voiture et ensuite quand
 * je m'éloigne elle s'éteint ». Personne n'arrête l'application ; le navigateur
 * disparaît avec la voiture, sans prévenir, et la fin du trajet — souvent ce
 * qu'on cherchait à revoir — est perdue avec lui.
 *
 * L'arrêt prolongé est le dernier moment où l'on est encore là pour envoyer.
 * Quinze secondes à l'arrêt, et ce qui attend part : le temps de se garer et de
 * couper le contact suffit largement, là où un feu rouge court n'y suffit pas.
 *
 * **Une fois par arrêt, pas toutes les quinze secondes.** Sans quoi un long
 * embouteillage produirait un fichier par quart de minute. Le déclencheur se
 * réarme au redémarrage.
 */

/** Quinze secondes : le choix de David, et il tient dans le temps de se garer. */
const AFTER_MS = 15_000

export class StandstillFlush {
  private since: number | null = null
  private done = false

  constructor(private readonly afterMs: number = AFTER_MS) {}

  /**
   * Faut-il déposer maintenant ?
   *
   * Rend vrai **une seule fois** par arrêt, quand celui-ci a assez duré.
   */
  tick(now: number, stopped: boolean): boolean {
    if (!stopped) {
      this.since = null
      this.done = false
      return false
    }

    if (this.since === null) this.since = now
    if (this.done) return false
    if (now - this.since < this.afterMs) return false

    this.done = true
    return true
  }
}
