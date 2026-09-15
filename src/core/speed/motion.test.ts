import { describe, expect, it } from 'vitest'

import { DEFAULT_MOTION, MotionReader, isSlowing, type MotionState } from './motion'

/**
 * Ce que ces tests tiennent : la lecture du mouvement dit le bon état, ne
 * bascule pas sur un tremblement de mesure, et compte le temps passé dedans.
 *
 * Elle se vérifie seule — ni boîte, ni moteur, ni navigateur : une suite
 * d'accélérations fabriquées entre, un état sort.
 */

const FRAME_S = 1 / 60

/** Fait lire une accélération constante pendant une durée. */
function tenir(lecteur: MotionReader, accelMs2: number, secondes: number): MotionState {
  let etat: MotionState = lecteur.current.state
  for (let i = 0; i < Math.round(secondes / FRAME_S); i += 1) {
    etat = lecteur.tick(FRAME_S, accelMs2).state
  }
  return etat
}

/** Bruit reproductible, d'écart-type unité. */
function bruit(graine: number): () => number {
  let etat = graine >>> 0
  const suivant = (): number => {
    etat = (etat + 0x6d2b79f5) >>> 0
    let t = etat
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return () => (suivant() + suivant() - 1) * Math.sqrt(6)
}

describe('la lecture du mouvement', () => {
  it('part de la vitesse tenue', () => {
    expect(new MotionReader().current.state).toBe('holding')
  })

  it('nomme les quatre états', () => {
    expect(tenir(new MotionReader(), 1.5, 2)).toBe('accelerating')
    expect(tenir(new MotionReader(), 0, 2)).toBe('holding')
    expect(tenir(new MotionReader(), -0.3, 2)).toBe('slowing')
    expect(tenir(new MotionReader(), -1.5, 2)).toBe('braking')
  })

  it('voit un lever de pied sans attendre', () => {
    // La contrainte qui fixe le délai de confirmation, et elle vient de la
    // route : « si j'arrête d'accélérer juste avant que la boîte ne monte un
    // rapport, elle le monte quand même ». Une perte d'un demi-km/h par seconde
    // — 0,14 m/s² — doit être vue avant qu'un passage ne s'engage.
    const lecteur = new MotionReader()
    tenir(lecteur, 1.2, 3)

    const etat = tenir(lecteur, -0.14, 0.8)

    expect(isSlowing(etat)).toBe(true)
  })

  it('ne bascule pas sur un tremblement de mesure', () => {
    // Une croisière tenue, vue par un récepteur : l'accélération tremble autour
    // de zéro avec l'écart-type mesuré au banc, 0,17 m/s². Trois fois le seuil
    // de ralentissement, et pourtant la lecture ne doit pas bouger — c'est
    // exactement ce que le compteur qu'elle remplace n'obtenait qu'à force de
    // décroître deux fois plus vite qu'il ne montait.
    const lecteur = new MotionReader()
    const tirage = bruit(11)
    let changements = 0
    let precedent = lecteur.current.state

    for (let i = 0; i < Math.round(120 / FRAME_S); i += 1) {
      const etat = lecteur.tick(FRAME_S, tirage() * 0.17).state
      if (etat !== precedent) changements += 1
      precedent = etat
    }

    expect(changements).toBe(0)
  })

  it('rend un état plus difficilement qu elle ne le prend', () => {
    // La bande morte : on entre en ralentissement au seuil, on n'en sort qu'une
    // bande morte plus haut. Une accélération posée entre les deux garde l'état,
    // là où elle n'aurait pas suffi à le faire prendre.
    const entre = DEFAULT_MOTION.slowingMs2
    const sort = DEFAULT_MOTION.slowingMs2 + DEFAULT_MOTION.releaseMs2
    const milieu = (entre + sort) / 2

    const lecteur = new MotionReader()
    expect(tenir(lecteur, -0.3, 2)).toBe('slowing')
    expect(tenir(lecteur, milieu, 2)).toBe('slowing')
    expect(tenir(lecteur, 0.3, 2)).toBe('accelerating')

    // Et le même milieu ne fait pas entrer en ralentissement depuis la croisière.
    const neuf = new MotionReader()
    expect(tenir(neuf, milieu, 2)).toBe('holding')
  })

  it('compte le temps passé dans l état', () => {
    const lecteur = new MotionReader()
    tenir(lecteur, -1.5, 3)
    const avant = lecteur.current.forS

    tenir(lecteur, -1.5, 2)

    expect(lecteur.current.forS).toBeCloseTo(avant + 2, 1)
  })

  it('remet le compteur à zéro en changeant d état', () => {
    const lecteur = new MotionReader()
    tenir(lecteur, -1.5, 5)
    expect(lecteur.current.forS).toBeGreaterThan(4)

    tenir(lecteur, 1.5, 1)

    expect(lecteur.current.state).toBe('accelerating')
    expect(lecteur.current.forS).toBeLessThan(1)
  })

  it('confirme avant d adopter', () => {
    const lecteur = new MotionReader()
    tenir(lecteur, 0, 2)

    // Un franchissement modeste — juste au-delà du seuil, bien en deçà de la
    // marge qui dispense de confirmer. Plus court que le délai, il ne change
    // rien ; tenu, il passe.
    const modeste = DEFAULT_MOTION.slowingMs2 - DEFAULT_MOTION.frankMs2 / 2

    expect(tenir(lecteur, modeste, DEFAULT_MOTION.confirmS / 3)).toBe('holding')
    expect(tenir(lecteur, modeste, DEFAULT_MOTION.confirmS)).toBe('slowing')
  })

  it('n attend pas quand le franchissement ne laisse aucun doute', () => {
    // Le délai lève un doute ; à ce point du seuil il n'y en a plus, et
    // l'attendre laisse le temps à un passage de rapport de s'engager. C'est le
    // lever de pied que David avait relevé : « accélération jusqu'à 4 800 tr/min
    // en 4ᵉ, arrêt de l'accélération, le simu passe la 5 et la 6 ».
    const lecteur = new MotionReader()
    tenir(lecteur, 0, 2)

    const franc = DEFAULT_MOTION.slowingMs2 - DEFAULT_MOTION.frankMs2 * 2
    expect(tenir(lecteur, franc, DEFAULT_MOTION.confirmS / 3)).toBe('slowing')
  })

  it('prend le seuil de freinage du profil', () => {
    // Sport freine plus tard que Route : c'est le réglage `brakeDownshiftAccelMs2`
    // qui le dit, et la lecture ne le remplace pas.
    const route = new MotionReader({ brakingMs2: -0.7 })
    const sport = new MotionReader({ brakingMs2: -1 })

    expect(tenir(route, -0.85, 2)).toBe('braking')
    expect(tenir(sport, -0.85, 2)).toBe('slowing')
  })

  it('lisse l accélération qu elle rend', () => {
    // Une seule grandeur continue pour tout le monde : ce qui a besoin d'un
    // chiffre prend celui-là, et non une seconde estimation du même signal.
    const lecteur = new MotionReader()
    const tirage = bruit(3)
    for (let i = 0; i < Math.round(20 / FRAME_S); i += 1) lecteur.tick(FRAME_S, -1 + tirage() * 0.5)

    expect(lecteur.current.accelMs2).toBeGreaterThan(-1.2)
    expect(lecteur.current.accelMs2).toBeLessThan(-0.8)
  })

  it('tient un pas de temps aberrant', () => {
    // La page en veille bat au ralenti, jusqu'à vingt secondes par tour. Le
    // compteur qu'on remplace y accumulait 2 706 secondes de dette ; celui-ci
    // borne le pas comme le moteur le fait.
    const lecteur = new MotionReader()
    tenir(lecteur, 0, 1)

    lecteur.tick(20, -0.3)

    expect(lecteur.current.forS).toBeLessThanOrEqual(1.3)
  })
})
