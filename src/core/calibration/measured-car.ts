import { PROCEDURE_VERSION, type CarAggregate } from './aggregate'
import type { Coverage } from './coverage'

/**
 * Ce que le serveur a mesuré de la voiture, tel qu'il le dépose.
 *
 * Le profileur écrit un fichier dans le dossier des profils ; l'application le
 * lit comme elle lit la bibliothèque, par le même hôte et avec le même compte.
 * Cette pièce ne fait que le chercher et vérifier qu'il dit ce qu'on attend —
 * elle ne mesure rien, elle ne décide rien.
 *
 * **Presque rien n'est une erreur ici.** Pas de fichier, pas de compte, un
 * dossier qui n'existe pas : ce sont les cas ordinaires d'une application qui a
 * roulé avant que le serveur n'ait eu de quoi conclure, et l'écran n'a rien à
 * montrer.
 *
 * Mais tous les échecs se valaient, et c'était un défaut. Le 11 septembre 2026,
 * l'emplacement `/profils/` manquait à nginx : la requête tombait sur le
 * `try_files … /index.html`, donc sur une réponse **200 qui portait la page
 * d'accueil**. Le code voyait une réponse valable, échouait à la lire, et
 * rendait la même absence qu'un serveur qui n'a rien à dire. David a attendu
 * une proposition qui ne pouvait pas venir, sans un signe à l'écran.
 *
 * Le motif de l'échec est donc rendu avec le résultat. Il ne change rien à ce
 * que l'écran de conduite montre — c'est-à-dire rien — mais la télémétrie le
 * dit, et une panne de plomberie cesse de ressembler à une absence de mesure.
 */

/** Emplacement, servi par le même hôte que l'application. */
const MEASURED_PATH = '/profils/profil-voiture.json'

/**
 * Ce qui s'est passé au dernier essai.
 *
 * `absente` est le cas ordinaire ; les trois autres disent une plomberie qui ne
 * marche pas.
 */
export type MeasuredCarStatus =
  /** Un fichier, lisible, du bon procédé. */
  | 'trouvee'
  /** Le serveur n'a rien écrit, ou le dossier n'existe pas encore. */
  | 'absente'
  /** Aucune réponse : hors réseau, ou serveur éteint. */
  | 'injoignable'
  /** Une réponse est venue, mais ce n'était pas la mesure attendue. */
  | 'illisible'
  /** Un fichier d'un procédé antérieur, que le profileur refera. */
  | 'perimee'

export interface MeasuredCarProbe {
  status: MeasuredCarStatus
  car: MeasuredCar | null
}

export interface MeasuredCar {
  /** Version du procédé qui l'a produit. */
  procedure: number
  /** Quand le serveur l'a écrit, en millisecondes. */
  updatedAt: number
  aggregate: CarAggregate
  coverage: Coverage
}

/**
 * Va chercher ce que le serveur a mesuré.
 *
 * Un fichier produit par un **procédé plus ancien** est écarté comme s'il
 * n'existait pas : ses grandeurs ont été cumulées par des règles qu'on a
 * corrigées depuis, et rien ne permet de les rattraper. Le profileur le refera
 * de lui-même, puisqu'il tient la même version.
 */
export async function fetchMeasuredCar(
  fetchImpl: typeof fetch = fetch,
  path = MEASURED_PATH,
): Promise<MeasuredCarProbe> {
  let response: Response
  try {
    response = await fetchImpl(path, { cache: 'no-store' })
  } catch {
    return { status: 'injoignable', car: null }
  }
  if (!response.ok) return { status: 'absente', car: null }

  let parsed: unknown
  try {
    parsed = await response.json()
  } catch {
    // Une réponse qui n'est pas du JSON. C'est le cas du 11 septembre : nginx
    // rendait la page d'accueil faute d'emplacement pour le fichier.
    return { status: 'illisible', car: null }
  }

  const measured = parsed as Partial<MeasuredCar>
  if (
    typeof measured !== 'object' ||
    measured === null ||
    measured.aggregate === undefined ||
    measured.coverage === undefined
  ) {
    return { status: 'illisible', car: null }
  }
  if (measured.procedure !== PROCEDURE_VERSION) return { status: 'perimee', car: null }
  return {
    status: 'trouvee',
    car: {
      procedure: measured.procedure,
      updatedAt: typeof measured.updatedAt === 'number' ? measured.updatedAt : 0,
      aggregate: measured.aggregate,
      coverage: measured.coverage,
    },
  }
}

/**
 * Ce que le conducteur a répondu à une proposition, et pour quelle mesure.
 *
 * L'horodatage est ce qui distingue « j'ai refusé » de « je n'ai pas encore
 * vu » : une mesure refusée ne revient pas, mais la suivante, elle, se propose.
 * Sans cela, un refus vaudrait pour toujours — et le profil s'affine trajet
 * après trajet, donc refuser une fois n'est pas refuser le principe.
 */
export type CarAnswer = 'accepted' | 'later'

export interface CarDecision {
  answer: CarAnswer
  /** L'horodatage de la mesure sur laquelle on a répondu. */
  forUpdatedAt: number
}

/**
 * Faut-il proposer cette mesure ?
 *
 * Oui quand elle est complète et qu'on n'a pas déjà répondu pour elle. Un
 * « plus tard » ne vaut que pour la mesure qu'on avait alors sous les yeux ; un
 * « oui », lui, vaut pour la suite — la couche s'affine sans redemander.
 */
export function shouldPropose(measured: MeasuredCar | null, decision: CarDecision | null): boolean {
  if (measured === null || !measured.coverage.complete) return false
  if (decision === null) return true
  if (decision.answer === 'accepted') return false
  return measured.updatedAt !== decision.forUpdatedAt
}

/** L'écart relatif le plus fort entre deux jeux de capacités, ou zéro. */
export function largestShift(before: CarAggregate, after: CarAggregate): number {
  const pairs: [number | null, number | null][] = [
    [before.capabilities.pushPeakMs2, after.capabilities.pushPeakMs2],
    [before.capabilities.slowdownPeakMs2, after.capabilities.slowdownPeakMs2],
    [before.capabilities.practicedMaxKmh, after.capabilities.practicedMaxKmh],
  ]

  let largest = 0
  for (const [a, b] of pairs) {
    if (a === null || b === null || a === 0) continue
    largest = Math.max(largest, Math.abs((b - a) / a))
  }
  return largest
}
