/**
 * L'allure : une seule réponse à « qu'est-ce que la voiture est en train de
 * faire ? ».
 *
 * **Allure et non mouvement**, bien que le lot s'appelle MOUVEMENT : `motion.ts`
 * existe déjà dans `core/input/`, et c'est la sonde de l'accéléromètre. Deux
 * fichiers du même nom pour deux notions voisines auraient coûté plus cher que
 * ce paragraphe.
 *
 * La boîte posait cette question cinq fois, de cinq façons, avec cinq seuils qui
 * ne s'accordaient pas : un seuil de freinage tenu une seconde, un compteur de
 * ralentissement qui montait deux fois moins vite qu'il ne descendait, un
 * raccourci pour les décélérations franches, une rampe continue sur le plancher
 * de descente, et un « est-ce qu'on accélère ? » réduit au signe. Chacun avait
 * sa raison, aucun ne connaissait les autres, et c'est l'ordre des conditions
 * qui arbitrait.
 *
 * Le lot FIX-BOITE avait déjà conclu « un compteur, un usage ». La leçon est
 * plutôt : **une notion, une lecture**. Les usages restent nombreux — inhiber
 * une montée, autoriser un rétrogradage au freinage, abaisser un plancher — et
 * chacun prend de cette lecture ce dont il a besoin : l'état, ou le temps passé
 * dedans.
 *
 * **L'hystérésis, en une phrase** : chaque frontière a deux seuils — celui qui
 * fait entrer dans l'état le plus marqué, et un plus doux qui en fait sortir —
 * et tout changement se confirme pendant un délai, sauf quand le seuil est
 * franchi si largement qu'il n'y a plus de doute à lever. C'est ce qui empêche
 * une croisière bruitée de faire osciller la lecture, là où un seuil nu bascule
 * à chaque tremblement de mesure, sans retarder pour autant un vrai lever de
 * pied.
 */

/**
 * Ce que fait la voiture, du plus marqué au moins marqué.
 *
 * Quatre états et non trois : freiner n'est pas ralentir, et la boîte a besoin
 * de la distinction — on rétrograde au freinage, on se contente d'interdire une
 * montée quand le pied se lève. Les quatre sont **ordonnés** par l'accélération,
 * ce qui permet à chaque usage de prendre le palier qui le concerne au lieu
 * d'avoir son propre seuil.
 */
export type PaceState = 'braking' | 'slowing' | 'holding' | 'accelerating'

/** Rang d'un état sur l'échelle, du plus freiné au plus accéléré. */
const RANK: Record<PaceState, number> = {
  braking: 0,
  slowing: 1,
  holding: 2,
  accelerating: 3,
}

export interface PaceOptions {
  /**
   * Décélération à partir de laquelle on freine, en m/s², négative.
   *
   * Elle vient du profil — `brakeDownshiftAccelMs2`, −0,7 en Route et −1 en
   * Sport : c'est le réglage qui dit à quel point il faut ralentir pour qu'une
   * boîte rétrograde, et il reste réglable.
   */
  brakingMs2: number
  /**
   * Décélération à partir de laquelle on ralentit, en m/s², négative.
   *
   * Elle est basse — quelques centièmes — parce qu'un lever de pied doit se voir
   * tout de suite : sans elle, une montée décidée juste avant s'engage quand
   * même. Ce qui la protège du bruit n'est pas sa hauteur mais le délai de
   * confirmation et la bande morte.
   */
  slowingMs2: number
  /** Accélération à partir de laquelle on accélère, en m/s², positive. */
  acceleratingMs2: number
  /**
   * Largeur de la bande morte, en m/s².
   *
   * Un état ne se rend pas au seuil qui l'a fait prendre : il faut le franchir
   * en sens inverse d'autant. Sans elle, une accélération qui tremble autour
   * d'un seuil ferait osciller la lecture aussi vite que le bruit.
   */
  releaseMs2: number
  /**
   * Durée pendant laquelle un état nouveau doit tenir avant d'être adopté, en
   * secondes.
   *
   * C'est un retard assumé, et il est court : la lecture sert à décider d'un
   * passage de rapport, et un passage décidé une demi-seconde trop tard
   * s'entend autant qu'un passage de trop.
   */
  confirmS: number
  /**
   * Marge au-delà de laquelle un franchissement se passe de confirmation, en
   * m/s².
   *
   * Le délai existe pour lever un doute ; à ce point du seuil, il n'y en a plus,
   * et l'attendre laisse le temps à un passage de rapport de s'engager. Mesuré
   * sur le lever de pied que David avait relevé — « accélération jusqu'à
   * 4 800 tr/min en 4ᵉ, arrêt de l'accélération, le simu passe la 5 et la 6 » :
   * sans cette marge, le rapport monte quand même.
   */
  frankMs2: number
  /**
   * Constante de lissage de l'accélération, en secondes.
   *
   * Le conditionneur en livre déjà une lissée, mais sur une fenêtre réglée pour
   * la vitesse, pas pour cette décision-là. Ce second lissage est court et n'a
   * qu'un rôle : que la valeur qui décide soit la même partout, et qu'elle soit
   * la même d'une image à l'autre.
   *
   * **Un dixième de seconde, et c'est un compromis mesuré, pas un réglage
   * confortable.** Au banc de positions fabriquées, l'allonger améliore
   * franchement la tenue au bruit — la boîte encaisse 1,75 km/h au lieu de 1,5 à
   * trois dixièmes. Mais le lissage retarde d'autant la vue d'un lever de pied,
   * et à deux dixièmes le ralentissement arrive après qu'un passage s'est
   * engagé, ce que David avait relevé en roulant. La marge au bruit est donc
   * bornée par la réactivité, et non par cette pièce.
   */
  smoothS: number
}

/**
 * Les réglages livrés.
 *
 * `brakingMs2` n'y figure qu'en repli : c'est le profil qui le donne. Les
 * autres valeurs sont mesurées au banc de positions fabriquées — voir
 * `core/drivetrain/gearbox-gps.test.ts`, qui dit combien de bruit la boîte
 * supporte avant de se remettre à osciller.
 */
export const DEFAULT_PACE: PaceOptions = {
  brakingMs2: -0.7,
  slowingMs2: -0.1,
  acceleratingMs2: 0.1,
  releaseMs2: 0.08,
  confirmS: 0.3,
  frankMs2: 0.4,
  smoothS: 0.1,
}

export interface Pace {
  state: PaceState
  /** Temps passé dans cet état, en secondes. */
  forS: number
  /**
   * L'accélération telle qu'elle a servi à décider, en m/s².
   *
   * Rendue parce que tout ce qui a besoin d'une grandeur continue doit prendre
   * celle-là : deux lissages différents du même signal, c'est deux avis de plus.
   */
  accelMs2: number
}

/**
 * Lit l'état du mouvement, image par image.
 *
 * Vérifiable seule, sans boîte et sans navigateur : elle ne connaît qu'une
 * accélération et un pas de temps.
 */
export class PaceReader {
  private options: PaceOptions
  private state: PaceState = 'holding'
  private forS = 0
  private smoothed = 0
  /** État vu mais pas encore adopté, et depuis combien de temps il est vu. */
  private candidate: PaceState | null = null
  private candidateForS = 0

  constructor(options: Partial<PaceOptions> = {}) {
    this.options = { ...DEFAULT_PACE, ...options }
  }

  setOptions(options: Partial<PaceOptions>): void {
    this.options = { ...this.options, ...options }
  }

  reset(): void {
    this.state = 'holding'
    this.forS = 0
    this.smoothed = 0
    this.candidate = null
    this.candidateForS = 0
  }

  /** L'état courant, sans rien avancer. */
  get current(): Pace {
    return { state: this.state, forS: this.forS, accelMs2: this.smoothed }
  }

  tick(dt: number, accelMs2: number): Pace {
    const step = Math.max(0, Math.min(dt, 0.25))

    // Lissage exponentiel, à pas de temps quelconque : la boucle ne bat pas
    // toujours à la même cadence, et un coefficient fixe donnerait une constante
    // de temps qui dépend de la charge de la machine.
    const k = this.options.smoothS <= 0 ? 1 : 1 - Math.exp(-step / this.options.smoothS)
    this.smoothed += (accelMs2 - this.smoothed) * k

    const vu = classify(this.smoothed, this.state, this.options)
    // Franc : le même classement, mais avec des seuils reculés de la marge. S'il
    // désigne déjà l'état nouveau, le doute que le délai devait lever n'existe
    // pas.
    const franc = classify(this.smoothed, this.state, {
      ...this.options,
      brakingMs2: this.options.brakingMs2 - this.options.frankMs2,
      slowingMs2: this.options.slowingMs2 - this.options.frankMs2,
      acceleratingMs2: this.options.acceleratingMs2 + this.options.frankMs2,
    })

    if (vu === this.state) {
      this.candidate = null
      this.candidateForS = 0
    } else {
      if (vu !== this.candidate) {
        this.candidate = vu
        this.candidateForS = 0
      }
      this.candidateForS += step
      if (this.candidateForS >= this.options.confirmS || franc === vu) {
        this.state = vu
        this.forS = 0
        this.candidate = null
        this.candidateForS = 0
      }
    }

    this.forS += step
    return this.current
  }

  /** Vrai si l'état courant est au moins aussi marqué que celui demandé. */
  atMost(state: PaceState): boolean {
    return RANK[this.state] <= RANK[state]
  }
}

/**
 * L'état que cette accélération décrit, vu depuis l'état courant.
 *
 * Les seuils qui **font entrer** dans un état plus marqué sont les seuils
 * nominaux ; ceux qui en font sortir sont décalés de la bande morte. C'est toute
 * l'hystérésis, et elle tient en trois comparaisons.
 */
function classify(accelMs2: number, current: PaceState, options: PaceOptions): PaceState {
  const sortie = (seuil: number, etat: PaceState): number =>
    RANK[current] <= RANK[etat] ? seuil + options.releaseMs2 : seuil

  if (accelMs2 <= sortie(options.brakingMs2, 'braking')) return 'braking'
  if (accelMs2 <= sortie(options.slowingMs2, 'slowing')) return 'slowing'

  const monte =
    RANK[current] >= RANK.accelerating
      ? options.acceleratingMs2 - options.releaseMs2
      : options.acceleratingMs2
  if (accelMs2 >= monte) return 'accelerating'

  return 'holding'
}

/** Vrai si cet état décrit une voiture qui perd de la vitesse. */
export function isSlowing(state: PaceState): boolean {
  return state === 'slowing' || state === 'braking'
}
