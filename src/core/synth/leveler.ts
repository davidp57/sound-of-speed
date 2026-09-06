/**
 * La cible du niveleur, corrigée toute seule.
 *
 * David : « avec d'autres moteurs, d'autres échappements, le réglage de crête
 * visée nécessaire pour avoir le but escompté est différent. Ça serait bien
 * d'avoir un truc plus dynamique, qui calcule et se modifie en temps réel ».
 * Une cible fixe fait un compromis entre deux régimes qui n'en demandent pas :
 * ce qui écrête au ralenti d'un moteur peut être exactement ce qu'il faut en
 * charge, ou ce qu'il faut au ralenti d'un autre.
 *
 * Le principe : un **plafond** choisi à la main — la saturation qu'on
 * autorise en pleine charge, l'ancien curseur — et un **plancher**, qui
 * descend tout seul quand la crête mesurée reste écrêtée, et ne remonte que
 * lentement quand elle redevient propre. La cible réellement envoyée
 * interpole entre les deux selon l'effort : au ralenti, c'est le plancher qui
 * décide ; à pleine charge, c'est le plafond.
 *
 * La correction s'estompe avec l'effort plutôt que de s'arrêter net à un
 * seuil : sous charge, un peu de saturation est voulue, pas une erreur à
 * corriger. C'est aussi ce qui évite qu'un simple coup de gaz ne déclenche une
 * correction destinée au ralenti.
 *
 * La remontée est volontairement plus lente que la descente : redescendre vite
 * évite l'écrêtage dès qu'il apparaît, remonter lentement évite qu'un plancher
 * qui vient de se trouver un point correct reparte aussitôt vers le plafond et
 * y écrête de nouveau — un pompage audible, pire que ce qu'on corrige.
 */

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

export interface LevelerAutoState {
  /** Le plancher courant, sur l'échelle des entiers 16 bits. */
  floor: number
}

export interface LevelerAutoParams {
  /** La cible en pleine charge — le réglage à la main, devenu un plafond. */
  ceiling: number
  /** Le plancher ne descend jamais sous cette valeur : le son ne doit jamais disparaître. */
  floorMin: number
  /** Crête mesurée au-delà de laquelle on considère qu'on écrête. */
  clipPeak: number
  /** Crête mesurée en-deçà de laquelle on autorise le plancher à remonter. */
  safePeak: number
  /** Vitesse de descente du plancher, en unités de cible par seconde. */
  fallPerSecond: number
  /** Vitesse de remontée, plus lente pour ne pas repartir aussitôt vers le plafond. */
  risePerSecond: number
}

/**
 * Des constantes de départ, à ajuster à l'oreille comme le reste du banc.
 *
 * `floorMin` à 4 000 laisse un moteur très fort trouver un point bas sans
 * jamais couper le son. `clipPeak`/`safePeak` encadrent la zone où on ne
 * corrige rien : au-dessus de 0,98 c'est déjà écrêté, en-dessous de 0,85 c'est
 * déjà propre — entre les deux, le plancher ne bouge pas. La descente couvre
 * l'écart plafond/plancher en un peu plus d'une seconde ; la remontée, en une
 * vingtaine de secondes.
 */
export const DEFAULT_LEVELER_AUTO_PARAMS = {
  floorMin: 4000,
  clipPeak: 0.98,
  safePeak: 0.85,
  fallPerSecond: 12000,
  risePerSecond: 600,
} satisfies Omit<LevelerAutoParams, 'ceiling'>

/** Le plancher, un pas de correction plus loin. */
export function nextLevelerFloor(
  state: LevelerAutoState,
  peak: number,
  effort: number,
  dtSeconds: number,
  params: LevelerAutoParams,
): LevelerAutoState {
  const weight = clamp(1 - effort, 0, 1)
  let floor = state.floor
  if (peak >= params.clipPeak) {
    floor -= params.fallPerSecond * dtSeconds * weight
  } else if (peak <= params.safePeak) {
    floor += params.risePerSecond * dtSeconds * weight
  }
  return { floor: clamp(floor, params.floorMin, params.ceiling) }
}

/** La cible à envoyer maintenant, entre le plancher et le plafond selon l'effort. */
export function levelerTargetFor(floor: number, ceiling: number, effort: number): number {
  return floor + (ceiling - floor) * clamp(effort, 0, 1)
}
