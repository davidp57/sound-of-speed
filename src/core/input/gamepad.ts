/**
 * Une manette pour conduire le simulateur.
 *
 * Deux gâchettes analogiques valent mieux qu'une flèche du clavier : la charge
 * se juge à l'oreille sur des transitions, et une commande tout ou rien ne
 * produit que la transition la plus brutale. C'est un outil de mise au point du
 * son, pas une commande de l'application dans la voiture.
 *
 * Cette pièce ne parle pas au navigateur : elle reçoit un instantané de boutons
 * et d'axes, et rend des **intentions**. C'est ce qui la rend vérifiable sans
 * manette et sans navigateur — la lecture de `navigator.getGamepads()` tient en
 * quelques lignes du côté de l'assemblage, et n'a aucune règle à elle.
 *
 * Le repère est celui de la manette Xbox en agencement standard, le seul que
 * les navigateurs garantissent.
 */

/** Index des boutons en agencement standard. */
export const BUTTON = {
  a: 0,
  b: 1,
  x: 2,
  y: 3,
  leftTrigger: 6,
  rightTrigger: 7,
} as const

/** Axe vertical du stick gauche. Négatif vers le haut, comme partout. */
export const AXIS_LEFT_Y = 1

/**
 * Zone morte des gâchettes.
 *
 * Une gâchette au repos n'annonce pas exactement zéro, et un accélérateur qui
 * ne retombe jamais à zéro laisse le simulateur pousser tout seul.
 */
export const TRIGGER_DEADZONE = 0.05
/** Zone morte des sticks, plus large : ils reviennent moins bien au centre. */
export const STICK_DEADZONE = 0.2
/** Course de volume parcourue en une seconde, stick à fond. */
export const VOLUME_PER_S = 0.5

/** Ce que la manette annonce, tel que le navigateur le donne. */
export interface PadSnapshot {
  /** Pression de chaque bouton, de 0 à 1. Les gâchettes sont analogiques. */
  buttons: number[]
  axes: number[]
}

/** Ce qu'on en fait. Les bascules sont des fronts, pas des états. */
export interface PadIntent {
  throttle: number
  brake: number
  shiftUp: boolean
  shiftDown: boolean
  /** Bascule boîte automatique / manuelle. */
  toggleMode: boolean
  /** Bascule du maintien de vitesse. */
  toggleCruise: boolean
  /** Variation du volume général sur ce pas, de −1 à 1. */
  volumeDelta: number
}

const IDLE: PadIntent = {
  throttle: 0,
  brake: 0,
  shiftUp: false,
  shiftDown: false,
  toggleMode: false,
  toggleCruise: false,
  volumeDelta: 0,
}

/** Seuil au-delà duquel un bouton compte comme enfoncé. */
const PRESSED = 0.5

export class GamepadReader {
  /** État des boutons au tour précédent, pour ne réagir qu'aux fronts. */
  private held = new Set<number>()

  reset(): void {
    this.held.clear()
  }

  /**
   * Lit un instantané et rend les intentions du tour.
   *
   * @param snapshot  Ce que la manette annonce, ou `null` si aucune n'est là.
   * @param dt        Temps écoulé depuis le tour précédent, en secondes.
   */
  read(snapshot: PadSnapshot | null, dt: number): PadIntent {
    if (!snapshot) {
      // Une manette débranchée en pleine accélération laisserait la gâchette
      // enfoncée pour toujours : on rend l'état de repos, pas le dernier connu.
      this.held.clear()
      return IDLE
    }

    return {
      throttle: trigger(snapshot.buttons[BUTTON.rightTrigger]),
      brake: trigger(snapshot.buttons[BUTTON.leftTrigger]),
      shiftUp: this.edge(snapshot, BUTTON.a),
      shiftDown: this.edge(snapshot, BUTTON.b),
      toggleMode: this.edge(snapshot, BUTTON.x),
      toggleCruise: this.edge(snapshot, BUTTON.y),
      volumeDelta: volumeFrom(snapshot.axes[AXIS_LEFT_Y], dt),
    }
  }

  /** Vrai au seul tour où le bouton passe de relâché à enfoncé. */
  private edge(snapshot: PadSnapshot, index: number): boolean {
    const pressed = (snapshot.buttons[index] ?? 0) >= PRESSED
    const was = this.held.has(index)
    if (pressed) this.held.add(index)
    else this.held.delete(index)
    return pressed && !was
  }
}

/**
 * Ce que le stick fait au volume sur ce pas. Le navigateur annonce l'axe
 * vertical négatif vers le haut, et le volume monte quand on pousse en avant.
 */
function volumeFrom(axis: number | undefined, dt: number): number {
  const pushed = stick(axis)
  return pushed === 0 ? 0 : -pushed * VOLUME_PER_S * dt
}

/** Une gâchette, zone morte retirée et course redressée. */
function trigger(value: number | undefined): number {
  const raw = value ?? 0
  if (raw <= TRIGGER_DEADZONE) return 0
  return Math.min(1, (raw - TRIGGER_DEADZONE) / (1 - TRIGGER_DEADZONE))
}

/** Un axe de stick, zone morte retirée et course redressée des deux côtés. */
function stick(value: number | undefined): number {
  const raw = value ?? 0
  const size = Math.abs(raw)
  if (size <= STICK_DEADZONE) return 0
  const scaled = (size - STICK_DEADZONE) / (1 - STICK_DEADZONE)
  return raw < 0 ? -scaled : scaled
}
