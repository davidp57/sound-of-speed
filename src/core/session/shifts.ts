import type { SessionEvent, StatePoint } from './model'

/**
 * Les enchaînements de rapports : plusieurs passages en peu de temps.
 *
 * C'est le moment qu'on cherche en debriefing. Deux façons de le retrouver, et
 * elles ne se valent pas.
 *
 * **Les passages inscrits.** Depuis le 10 septembre 2026, le journal écrit un
 * événement à chaque changement de rapport : l'enchaînement se lit alors
 * directement, daté à la milliseconde.
 *
 * **Les passages déduits**, pour les trajets enregistrés avant, et pour les
 * relevés seuls. Le journal relève toutes les dix secondes : voir la deuxième
 * puis la quatrième prouve deux passages, mais ne dit pas s'ils se sont suivis
 * en une seconde ou étalés sur neuf. Une capture, elle, relève à la cadence de
 * l'appareil, et la question ne se pose plus. Les deux cas sont donc distingués
 * plutôt que confondus — annoncer un passage rapide qu'on n'a pas mesuré ferait
 * chercher un défaut là où il n'y en a peut-être pas.
 *
 * **Une montée ordinaire n'est pas un enchaînement.** Passer de la première à
 * la sixième en une minute, c'est conduire ; le faire en deux secondes, c'est
 * ce qu'on veut voir. Seule la durée sépare les deux, et c'est elle qui borne.
 */

export interface ShiftBurst {
  /** Instant du premier passage du groupe. */
  at: number
  /** Nombre de rapports franchis. */
  count: number
  /** Durée sur laquelle les passages sont établis, en millisecondes. */
  spanMs: number
  /**
   * Vrai quand la cadence des relevés prouve la rapidité.
   *
   * Faux quand elle ne fait que la rendre possible : les passages sont
   * certains, leur écartement ne l'est pas.
   */
  measured: boolean
  /** Le rapport avant, et celui après. */
  from: number
  to: number
}

/**
 * Trois secondes.
 *
 * En dessous, deux passages se suivent assez pour qu'on les entende comme un
 * enchaînement ; au-dessus, c'est de la conduite ordinaire. Le seuil est
 * arbitraire et se règle ici, à un seul endroit.
 */
const WINDOW_MS = 3000

/** Deux rapports franchis : un seul passage n'est pas un enchaînement. */
const MIN_SHIFTS = 2

export function findShiftBursts(
  states: StatePoint[],
  windowMs: number = WINDOW_MS,
  minShifts: number = MIN_SHIFTS,
  recorded: GearChange[] = [],
): ShiftBurst[] {
  // Des passages inscrits valent mieux que des passages déduits : ils sont
  // datés, donc la durée d'un enchaînement se mesure au lieu de s'encadrer.
  if (recorded.length > 0) return burstsFromShifts(recorded, windowMs, minShifts)

  const bursts: ShiftBurst[] = []
  if (states.length < 2) return bursts

  let i = 0
  while (i < states.length - 1) {
    const avant = states[i] as StatePoint
    const apres = states[i + 1] as StatePoint
    if (apres.gear === avant.gear) {
      i += 1
      continue
    }

    // Un groupe : les intervalles qui se suivent et qui portent tous un
    // changement. Une seconde de rapport stable le referme.
    const début = i
    let franchis = 0
    while (i < states.length - 1) {
      const a = states[i] as StatePoint
      const b = states[i + 1] as StatePoint
      if (b.gear === a.gear) break
      franchis += Math.abs(b.gear - a.gear)
      i += 1
    }

    const premier = states[début] as StatePoint
    const dernier = states[i] as StatePoint
    const span = dernier.at - premier.at
    const intervalles = i - début

    // Ce qui sépare un enchaînement d'une conduite ordinaire, quand la cadence
    // des relevés ne permet pas de mesurer la durée : la **densité**. Plus d'un
    // rapport franchi par relevé, c'est que la boîte a bougé plusieurs fois
    // entre deux regards.
    //
    // Monter de la première à la sixième en cinquante secondes fait cinq
    // rapports pour cinq relevés : de la conduite. Faire deuxième, quatrième,
    // deuxième, quatrième fait six rapports pour trois relevés : la boîte
    // hésite, et c'est exactement ce qu'on cherche à retrouver.
    const dense = franchis >= 2 * intervalles
    const retenu = franchis >= minShifts && (span <= windowMs || dense)
    if (retenu) {
      bursts.push({
        at: premier.at,
        count: franchis,
        spanMs: span,
        measured: span <= windowMs,
        from: premier.gear,
        to: dernier.gear,
      })
    }
  }

  return bursts
}

/** Un passage de rapport, tel qu'on le montre sur le relief. */
export interface GearChange {
  at: number
  /** Vrai pour une montée, faux pour un rétrogradage. */
  up: boolean
  /** Rapports franchis d'un coup : deux d'un seul relevé se voient plus haut. */
  steps: number
  from: number
  to: number
}

/**
 * Tous les passages de rapport du trajet.
 *
 * Séparé des enchaînements : ceux-ci désignent un moment à examiner, ceux-là
 * dessinent la conduite. Le relief montre les deux, mais pas de la même façon.
 */
export function findGearChanges(
  states: StatePoint[],
  recorded: GearChange[] = [],
): GearChange[] {
  if (recorded.length > 0) return recorded

  const out: GearChange[] = []
  for (let i = 0; i < states.length - 1; i += 1) {
    const a = states[i] as StatePoint
    const b = states[i + 1] as StatePoint
    if (a.gear === b.gear) continue
    out.push({
      at: b.at,
      up: b.gear > a.gear,
      steps: Math.abs(b.gear - a.gear),
      from: a.gear,
      to: b.gear,
    })
  }
  return out
}

/**
 * Les passages tels que le journal les a inscrits.
 *
 * Depuis le 10 septembre 2026, un événement est écrit à chaque changement de
 * rapport. Quand il y en a, ils font foi : datés à la milliseconde, ils disent
 * la fréquence des allers-retours que des relevés espacés de dix secondes ne
 * pouvaient que suggérer. Les sessions plus anciennes n'en portent pas, d'où le
 * repli sur les relevés — un trajet déjà enregistré reste lisible.
 */
export function recordedShifts(events: SessionEvent[]): GearChange[] {
  const out: GearChange[] = []
  for (const event of events) {
    if (event.kind !== 'shift') continue
    const from = event.data['from']
    const to = event.data['to']
    if (typeof from !== 'number' || typeof to !== 'number' || from === to) continue
    out.push({ at: event.at, up: to > from, steps: Math.abs(to - from), from, to })
  }
  return out
}

/**
 * Les enchaînements, quand les passages sont datés.
 *
 * Le groupement ne regarde plus la densité : deux passages séparés de moins que
 * la fenêtre appartiennent au même moment, et c'est tout. La densité n'était
 * qu'un moyen de deviner ce que la cadence des relevés cachait.
 */
function burstsFromShifts(
  changes: GearChange[],
  windowMs: number,
  minShifts: number,
): ShiftBurst[] {
  const bursts: ShiftBurst[] = []
  let i = 0
  while (i < changes.length) {
    const premier = changes[i] as GearChange
    let franchis = premier.steps
    let dernier = premier
    let j = i + 1
    while (j < changes.length) {
      const suivant = changes[j] as GearChange
      if (suivant.at - dernier.at > windowMs) break
      franchis += suivant.steps
      dernier = suivant
      j += 1
    }
    if (franchis >= minShifts && j > i + 1) {
      bursts.push({
        at: premier.at,
        count: franchis,
        spanMs: dernier.at - premier.at,
        measured: true,
        from: premier.from,
        to: dernier.to,
      })
    }
    i = j > i + 1 ? j : i + 1
  }
  return bursts
}
