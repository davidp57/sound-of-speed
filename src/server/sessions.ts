/**
 * Les dépôts, vus comme des trajets.
 *
 * La base range des tranches ; on n'efface pas une tranche, on efface un trajet.
 * Effacer tranche par tranche rendrait des sessions à trous, que le relecteur
 * afficherait comme des trajets amputés sans le dire.
 *
 * Le regroupement n'est pas réécrit ici : c'est celui du cœur, sur le nom des
 * tranches, le même que le relecteur emploie pour recoller un trajet. Deux règles
 * de regroupement finiraient par ne plus dire la même chose.
 *
 * **Un dépôt qui n'appartient à aucune session en est une quand même.** Deux
 * traces anciennes portent un nom libre, d'avant la convention : le regroupement
 * ne les voit pas, le profileur non plus. Sans cette porte, rien ne pourrait
 * jamais les enlever.
 */

import { and, eq, inArray } from 'drizzle-orm'

import { PROCEDURE_VERSION } from '../core/calibration/aggregate'
import { sessionKeyOf } from '../core/session/model'

import type { Base } from './base/base'
import { deposits } from './base/schema'
import type { Dossier, Exemption } from './depots'

/** Ce qu'une tranche apporte à son trajet. */
export interface TrancheDeSession {
  dossier: Dossier
  nom: string
  octets: number
}

/** Un trajet tel que la base le porte. */
export interface SessionEnBase {
  /**
   * Ce qui désigne le trajet dans une adresse.
   *
   * `<date>_<identifiant>` pour une session, `depot:<dossier>:<nom>` pour un
   * dépôt isolé. Deux formes, parce qu'un dépôt isolé n'a pas de session à
   * nommer — et qu'il faut quand même pouvoir le désigner pour l'effacer.
   */
  cle: string
  /** Vrai quand la clé désigne un dépôt seul, hors de toute session. */
  isole: boolean
  /** Quand le trajet a été enregistré, en millisecondes. */
  enregistreLe: number
  tranches: TrancheDeSession[]
  octets: number
  /** Tranches de trace, et tranches de journal. */
  traces: number
  journal: number
  /**
   * Tranches de trace que le profileur n'a pas encore regardées.
   *
   * Zéro veut dire « vu », y compris quand il n'y avait rien à en tirer. Une
   * session de journal seul vaut zéro elle aussi : le journal ne passe pas par
   * le profileur, et sa règle est ailleurs.
   */
  aVoir: number
  exemption: Exemption | null
}

/** Les deux dossiers qui font des trajets. Les relevés n'en font pas. */
const DOSSIERS_DE_SESSION: Dossier[] = ['traces', 'journal']

/**
 * Les trajets d'un compte, du plus récent au plus ancien.
 *
 * L'ordre est celui du relecteur : on cherche le trajet de tout à l'heure, pas
 * celui d'il y a trois semaines.
 */
export async function listerSessions(base: Base, compte: string): Promise<SessionEnBase[]> {
  const lignes = await base
    .select({
      folder: deposits.folder,
      name: deposits.name,
      bytes: deposits.bytes,
      depositedAt: deposits.depositedAt,
      recordedAt: deposits.recordedAt,
      exemption: deposits.exemption,
      analyzedProcedure: deposits.analyzedProcedure,
    })
    .from(deposits)
    .where(and(eq(deposits.accountId, compte), inArray(deposits.folder, DOSSIERS_DE_SESSION)))

  const sessions = new Map<string, SessionEnBase>()

  for (const ligne of lignes) {
    const dossier = ligne.folder as Dossier
    const repere = sessionKeyOf(ligne.name)
    const cle = repere === null ? `depot:${dossier}:${ligne.name}` : repere.key
    const enregistreLe = (ligne.recordedAt ?? ligne.depositedAt) * 1000

    const session =
      sessions.get(cle) ??
      ({
        cle,
        isole: repere === null,
        enregistreLe,
        tranches: [],
        octets: 0,
        traces: 0,
        journal: 0,
        aVoir: 0,
        exemption: null,
      } satisfies SessionEnBase)

    session.tranches.push({ dossier, nom: ligne.name, octets: ligne.bytes })
    session.octets += ligne.bytes
    if (dossier === 'traces') {
      session.traces += 1
      if (ligne.analyzedProcedure !== PROCEDURE_VERSION) session.aVoir += 1
    } else {
      session.journal += 1
    }
    // La date du trajet est celle de sa première tranche : les suivantes portent
    // le même horodatage, sauf pour un dépôt isolé où il n'y en a qu'une.
    session.enregistreLe = Math.min(session.enregistreLe, enregistreLe)
    session.exemption = laPlusProtectrice(session.exemption, ligne.exemption)

    sessions.set(cle, session)
  }

  for (const session of sessions.values()) {
    session.tranches.sort((a, b) => a.nom.localeCompare(b.nom))
  }

  return [...sessions.values()].sort((a, b) => b.enregistreLe - a.enregistreLe)
}

/**
 * De deux exemptions, celle qui retient le plus.
 *
 * Une session peut porter les deux : la reprise a archivé sa trace, et son
 * journal est arrivé après. La retenir au titre le plus fort évite qu'une
 * tranche décide pour tout le trajet — et l'archive, qui ne compte pas dans la
 * borne, l'emporte sur l'épingle, qui y compte.
 */
function laPlusProtectrice(a: Exemption | null, b: Exemption | null): Exemption | null {
  if (a === 'archive' || b === 'archive') return 'archive'
  if (a === 'epingle' || b === 'epingle') return 'epingle'
  return null
}

/** Un trajet désigné, ou rien. */
export async function lireSession(
  base: Base,
  compte: string,
  cle: string,
): Promise<SessionEnBase | null> {
  return (await listerSessions(base, compte)).find((session) => session.cle === cle) ?? null
}

/**
 * Efface un trajet entier, et dit combien de tranches sont parties.
 *
 * **Zéro n'est pas une panne.** La voiture rejoue une demande, et un effacement
 * qu'on rejoue trouve un trajet déjà parti : c'est le résultat attendu, pas une
 * erreur à rendre.
 */
export async function effacerSession(base: Base, compte: string, cle: string): Promise<number> {
  const session = await lireSession(base, compte, cle)
  if (session === null) return 0

  const ids = session.tranches.map((tranche) => `${compte}:${tranche.dossier}:${tranche.nom}`)
  for (let debut = 0; debut < ids.length; debut += 200) {
    await base.delete(deposits).where(inArray(deposits.id, ids.slice(debut, debut + 200)))
  }

  return session.tranches.length
}
