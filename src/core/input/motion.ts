/**
 * Ce que l'accéléromètre du téléphone donne, s'il donne quelque chose.
 *
 * **Pourquoi cette sonde existe.** L'accélération de la voiture est aujourd'hui
 * déduite de la vitesse GPS, qui n'arrive qu'une fois par seconde : elle traîne
 * derrière ce que fait la voiture, et c'est d'elle que dépendent la charge, donc
 * le son, donc les passages de rapport. Un accéléromètre la mesurerait
 * directement. Avant d'écrire cette source, il faut savoir ce que l'appareil
 * fournit vraiment — trois choses qu'aucune documentation ne dit pour *ce*
 * téléphone dans *cette* voiture :
 *
 * 1. à quelle cadence les relevés arrivent ;
 * 2. si l'accélération **sans la gravité** est renseignée, ou seulement celle
 *    qui l'inclut — dans ce second cas il faudrait connaître l'orientation du
 *    téléphone pour retrancher la gravité, ce qui est un autre chantier ;
 * 3. quelle amplitude on observe, pour la comparer à ce que le GPS déduit.
 *
 * La sonde ne parle pas au navigateur : elle reçoit des relevés et rend une
 * lecture, comme `gamepad.ts`. C'est ce qui la rend vérifiable sans appareil.
 */

/** Un relevé, tel que l'événement du navigateur le porte. */
export interface MotionSample {
  /** Millisecondes, horloge de l'appelant. */
  at: number
  /** Accélération sans la gravité, quand le navigateur la renseigne. */
  linear: { x: number; y: number; z: number } | null
  /** Accélération gravité comprise. */
  withGravity: { x: number; y: number; z: number } | null
  /** Intervalle annoncé entre deux relevés, en millisecondes. */
  intervalMs: number | null
}

/** Ce qu'on sait dire de l'accéléromètre après l'avoir écouté. */
export interface MotionReading {
  /** Relevés reçus depuis le début. */
  count: number
  /** Cadence mesurée sur la fenêtre, en hertz. `null` avant deux relevés. */
  hz: number | null
  /** Intervalle annoncé par l'appareil, en millisecondes. */
  announcedMs: number | null
  /** Vrai si l'accélération sans gravité est renseignée. */
  linear: boolean
  /** Norme crête sur la fenêtre, en m/s². `null` si rien n'est exploitable. */
  peakMs2: number | null
  /** Norme moyenne sur la fenêtre, en m/s². */
  meanMs2: number | null
}

/**
 * Fenêtre d'observation, en millisecondes.
 *
 * Cinq secondes : assez pour qu'une cadence se mesure et qu'une accélération de
 * conduite s'y voie, assez court pour que la valeur affichée suive ce qu'on est
 * en train de faire.
 */
const WINDOW_MS = 5000

export class MotionProbe {
  private readonly window: { at: number; norm: number | null }[] = []
  private total = 0
  private lastLinear = false
  private announced: number | null = null

  add(sample: MotionSample): void {
    this.total += 1
    if (sample.intervalMs !== null) this.announced = sample.intervalMs

    // La norme sans gravité est la seule qui se compare à l'accélération que la
    // chaîne utilise. Celle qui inclut la gravité vaut environ 9,81 au repos :
    // la retenir donnerait une amplitude qui ne veut rien dire.
    const vector = sample.linear
    this.lastLinear = vector !== null
    this.window.push({
      at: sample.at,
      norm: vector ? Math.hypot(vector.x, vector.y, vector.z) : null,
    })

    const limite = sample.at - WINDOW_MS
    while (this.window.length > 1 && (this.window[0]?.at ?? 0) < limite) this.window.shift()
  }

  get reading(): MotionReading {
    const premier = this.window[0]
    const dernier = this.window[this.window.length - 1]
    const span = premier && dernier ? dernier.at - premier.at : 0
    const normes = this.window.map((p) => p.norm).filter((n): n is number => n !== null)

    return {
      count: this.total,
      hz: span > 0 && this.window.length > 1 ? ((this.window.length - 1) / span) * 1000 : null,
      announcedMs: this.announced,
      linear: this.lastLinear,
      peakMs2: normes.length > 0 ? Math.max(...normes) : null,
      meanMs2: normes.length > 0 ? normes.reduce((a, b) => a + b, 0) / normes.length : null,
    }
  }
}
