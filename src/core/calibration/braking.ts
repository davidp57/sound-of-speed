import { COAST_MIN_DECEL_MS2, DOWNSHIFT_SEPARATION_MS2 } from './protocol'
import type { TracePoint } from './measure'

/**
 * Séparer le pied levé du freinage, sans que personne ne l'ait dit.
 *
 * C'est le point dur du lot. Le protocole fait garantir le geste par le
 * conducteur — « lève le pied sans freiner », puis « freine franchement » — et
 * pose le seuil de rétrogradage au milieu des deux mesures. Rien dans une trace
 * ne dit où était le pied.
 *
 * Mais un trajet contient des centaines de ralentissements. Rangés par force,
 * ils forment deux tas : les doux, où la récupération freine seule, et les
 * francs. **La frontière entre les deux tas est le seuil recherché.**
 *
 * Les ralentissements retenus doivent valoir quelque chose — une durée et une
 * vitesse d'entrée, reprises du protocole —, faute de quoi deux dixièmes de
 * seconde d'ondulation du GPS pèseraient autant qu'un freinage d'urgence.
 *
 * Et quand les deux tas ne se séparent pas, on ne propose rien. C'est déjà la
 * règle du protocole, qui refuse une frontière lorsque les deux étapes rendent
 * la même décélération à moins d'un demi mètre par seconde carrée près. Une
 * mesure qu'on n'est pas sûr de savoir lire ne vaut pas mieux que pas de
 * mesure : une borne trop serrée ampute le signal, ce qui est bien pire qu'une
 * borne absente.
 *
 * **Ce module ne remplace pas `suggest.ts`, et il faudra trancher.** Les deux
 * produisent le même réglage — le seuil de rétrogradage — par deux chemins :
 * là-bas le milieu des crêtes de deux étapes garanties par le conducteur, ici
 * la coupure d'une distribution de ralentissements ordinaires. Deux procédés
 * pour une grandeur, c'est exactement ce qui finit par diverger. Tant que rien
 * ne les branche ensemble, la coexistence est sans danger ; le ticket qui les
 * réunira devra dire lequel prime, et sur quel critère.
 */

/** Un ralentissement du trajet, réduit à ce qui le caractérise. */
export interface Slowdown {
  /** Début, en secondes depuis la première mesure. */
  startS: number
  durationS: number
  /** Décélération la plus forte, en m/s². Négative. */
  peakDecelMs2: number
  /** Vitesse au début du ralentissement, en km/h. */
  fromKmh: number
}

export interface BrakingSplit {
  /** Les ralentissements relevés, dans l'ordre du trajet. */
  slowdowns: Slowdown[]
  /**
   * La frontière entre les deux tas, en m/s², ou `null` s'ils ne se séparent
   * pas. Négative, comme les décélérations qu'elle partage.
   */
  boundaryMs2: number | null
  /** Décélération moyenne du tas doux, en m/s². `null` sans séparation. */
  coastMs2: number | null
  /** Décélération moyenne du tas franc, en m/s². `null` sans séparation. */
  brakeMs2: number | null
  /**
   * Pourquoi aucune frontière n'a été trouvée, quand c'est le cas.
   *
   * Dit dans les termes de ce qui manque, pour qu'on sache s'il faut rouler
   * davantage ou si la voiture ne se prête pas à la mesure.
   */
  why: 'ok' | 'trop-peu' | 'pas-de-separation'
}

/**
 * En dessous de ce compte, une distribution n'a pas de forme à lire.
 *
 * Exporté parce que le verdict de couverture pose la même question, et qu'un
 * second nombre écrit ailleurs finirait par diverger : la couverture
 * déclarerait la matière suffisante là où la séparation répondrait « trop peu ».
 */
export const MIN_SLOWDOWNS = 20

/**
 * Ce qu'un ralentissement doit valoir pour entrer dans la distribution.
 *
 * Sans ces deux bornes, deux relevés consécutifs sous le seuil — deux dixièmes
 * de seconde d'ondulation du GPS en croisière — pèsent autant qu'un freinage
 * d'urgence de dix secondes. Mesuré sur le trajet du 11 septembre 2026 : 424
 * ralentissements en trente-six minutes de roulage, soit un toutes les cinq
 * secondes, dont un pic de 305 dans la tranche la plus douce. C'est ce pic qui
 * faisait douter de la bimodalité, et il était en partie fabriqué.
 *
 * Les valeurs viennent du protocole : il n'accepte une étape de lever de pied
 * qu'au-dessus de cinquante kilomètres-heure et après cinq secondes. On garde
 * la vitesse d'entrée, qui écarte les manœuvres et les arrêts ; on abaisse la
 * durée, parce qu'un freinage franc est court par nature — le protocole lui
 * demande trois secondes, pas cinq.
 */
const SLOWDOWN_MIN_S = 1
const SLOWDOWN_MIN_FROM_KMH = 30

/**
 * Relève les ralentissements d'un trajet.
 *
 * Le seuil d'entrée est celui que le protocole emploie pour vérifier qu'un
 * lever de pied a bien eu lieu : en dessous, on ne ralentit pas, on flotte. Un
 * ralentissement se ferme dès que l'accélération repasse au-dessus, et l'on
 * garde sa crête — c'est elle qui le situe, pas sa moyenne, diluée par les
 * entrées et les sorties.
 */
export function findSlowdowns(points: readonly TracePoint[]): Slowdown[] {
  const slowdowns: Slowdown[] = []
  let start: TracePoint | null = null
  let peak = 0

  const close = (end: TracePoint): void => {
    if (start === null) return
    const durationS = end.t - start.t
    if (durationS >= SLOWDOWN_MIN_S && start.kmh >= SLOWDOWN_MIN_FROM_KMH) {
      slowdowns.push({ startS: start.t, durationS, peakDecelMs2: peak, fromKmh: start.kmh })
    }
    start = null
    peak = 0
  }

  for (let i = 0; i < points.length; i += 1) {
    const point = points[i]!
    const accel = point.accelMs2
    const slowing = accel !== null && accel <= COAST_MIN_DECEL_MS2

    if (slowing) {
      if (start === null) start = point
      peak = Math.min(peak, accel)
      if (i === points.length - 1) close(point)
      continue
    }
    close(point)
  }

  return slowdowns
}

/**
 * Cherche la frontière entre les deux façons de ralentir.
 *
 * Le partage retenu est celui qui **sépare le mieux** : parmi toutes les
 * coupures possibles, celle qui rend les deux tas les plus dissemblables
 * possible. C'est le procédé d'Otsu, employé d'ordinaire pour binariser une
 * image, et il convient ici pour la même raison — on cherche un seuil dans une
 * distribution dont on croit qu'elle a deux bosses, sans savoir où.
 *
 * Il rend toujours une coupure, même sur une distribution qui n'en a qu'une :
 * c'est pourquoi la séparation est **vérifiée ensuite**, et non supposée. Les
 * deux moyennes doivent s'écarter d'au moins ce que le protocole exige des deux
 * étapes qu'il fait enregistrer.
 *
 * **Ce que ce critère ne prouve pas**, et il faut le dire : sur le trajet du
 * 11 septembre 2026, la distribution des 115 ralentissements retenus a une
 * bosse nette autour de −0,8 m/s² et une queue qui s'étire jusqu'à −2,5, sans
 * seconde bosse visible. La coupure trouvée vaut −1,34 m/s², les deux moyennes
 * −0,74 et −1,78, et l'écart passe donc le critère. Mais une queue régulière le
 * passerait aussi : l'écart des moyennes dit que la coupure sépare quelque
 * chose, pas qu'il y avait deux tas.
 *
 * Un critère de **creux** entre les deux modes serait plus sûr, et plusieurs
 * trajets diront si la valeur tient. En attendant, ce qu'on livre est une
 * mesure dont on sait qu'elle peut couper une distribution qui n'a qu'une
 * bosse.
 *
 * Repère de prudence : le profil règle ce même seuil à −1 m/s², posé à la main.
 * Une première version de ce module, qui admettait n'importe quel soubresaut du
 * signal comme un ralentissement, tombait sur −1,04 — et l'on aurait pu y lire
 * une confirmation. Le filtrage a déplacé la réponse à −1,34 : ce que mesure ce
 * module dépend d'abord de ce qu'on y fait entrer.
 */
export function splitBraking(points: readonly TracePoint[]): BrakingSplit {
  const slowdowns = findSlowdowns(points)
  const none = { slowdowns, boundaryMs2: null, coastMs2: null, brakeMs2: null }

  if (slowdowns.length < MIN_SLOWDOWNS) return { ...none, why: 'trop-peu' }

  const split = otsuSplit(slowdowns.map((s) => s.peakDecelMs2))
  if (split === null || split.coastMs2 - split.brakeMs2 < DOWNSHIFT_SEPARATION_MS2) {
    return { ...none, why: 'pas-de-separation' }
  }

  return { slowdowns, ...split, why: 'ok' }
}

/** Les deux groupes d'une distribution de crêtes, et la coupure qui les sépare. */
export interface PeakSplit {
  boundaryMs2: number
  /** Moyenne du groupe doux. */
  coastMs2: number
  /** Moyenne du groupe franc. */
  brakeMs2: number
}

/**
 * Est-ce que ces ralentissements se séparent en deux façons de ralentir ?
 *
 * Une seule réponse, pour que la couverture et la mesure ne puissent pas se
 * contredire. Attention : partager le code ne partage pas les entrées — la
 * frontière d'un trajet et celle de vingt trajets réunis ne sont pas la même
 * chose, et le seuillage n'est pas stable par réunion. C'est voulu : on décide
 * sur ce dont on dispose.
 */
export function separates(peaks: readonly number[]): boolean {
  if (peaks.length < MIN_SLOWDOWNS) return false
  const split = otsuSplit(peaks)
  return split !== null && split.coastMs2 - split.brakeMs2 >= DOWNSHIFT_SEPARATION_MS2
}

/**
 * La séparation, sur des crêtes déjà relevées.
 *
 * Détachée de `splitBraking` pour que le cumul de plusieurs trajets puisse la
 * refaire sans avoir gardé les points : un agrégat retient les crêtes, pas le
 * signal. Une seule mise en œuvre, employée des deux côtés — le contraire
 * donnerait deux frontières pour la même voiture selon qu'on regarde un trajet
 * ou l'historique.
 *
 * Elle ne vérifie **pas** que les deux groupes s'écartent assez : c'est à
 * l'appelant de le faire, parce que le seuil dépend de ce qu'il en fera.
 */
export function otsuSplit(peaks: readonly number[]): PeakSplit | null {
  if (peaks.length < 2) return null
  const sorted = [...peaks].sort((a, b) => a - b)
  const cut = otsu(sorted)
  if (cut === null) return null

  const hard = sorted.filter((p) => p <= cut)
  const soft = sorted.filter((p) => p > cut)
  if (hard.length === 0 || soft.length === 0) return null

  return { boundaryMs2: cut, coastMs2: mean(soft), brakeMs2: mean(hard) }
}

/**
 * La coupure qui rend les deux groupes les plus dissemblables.
 *
 * On maximise la variance entre les groupes, ce qui revient à minimiser celle
 * qui reste à l'intérieur de chacun. Les valeurs sont déjà triées.
 */
function otsu(sorted: readonly number[]): number | null {
  const n = sorted.length
  if (n < 2) return null

  const total = sorted.reduce((sum, v) => sum + v, 0)
  let below = 0
  let sumBelow = 0
  let best: number | null = null
  let bestScore = 0

  for (let i = 0; i < n - 1; i += 1) {
    below += 1
    sumBelow += sorted[i]!
    // Une coupure ne se place pas au milieu de valeurs égales : les deux
    // groupes ne seraient pas définis par elle.
    if (sorted[i] === sorted[i + 1]) continue

    const above = n - below
    const meanBelow = sumBelow / below
    const meanAbove = (total - sumBelow) / above
    const gap = meanAbove - meanBelow
    const score = below * above * gap * gap
    if (score > bestScore) {
      bestScore = score
      best = (sorted[i]! + sorted[i + 1]!) / 2
    }
  }

  return best
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length
}
