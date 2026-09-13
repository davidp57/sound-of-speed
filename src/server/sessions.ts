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

import { zipStream, type ZipEntry } from '../core/archive/zip'
import { PROCEDURE_VERSION } from '../core/calibration/aggregate'
import { sessionKeyOf } from '../core/session/model'

import type { Base } from './base/base'
import { deposits } from './base/schema'
import { lireDepot, type Dossier, type Exemption } from './depots'

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

/**
 * Un trajet en une archive, prête à descendre.
 *
 * **Un fichier, pas quarante-deux.** La plus grosse session de la base porte
 * vingt-deux tranches de trace et vingt de journal ; rendre quarante-deux
 * téléchargements n'est pas une porte de sortie.
 *
 * Les tranches y entrent **telles qu'elles ont été déposées** : elles sont déjà
 * compressées, et ce qui ressort doit être exactement ce qui était monté.
 *
 * En flux, et lues une par une : une session lourde n'a pas à tenir en mémoire
 * entière, et rien ne dit que le mégaoctet d'aujourd'hui restera la limite.
 */
export async function archiveDeLaSession(
  base: Base,
  compte: string,
  cle: string,
): Promise<{ nom: string; flux: ReadableStream<Uint8Array> } | null> {
  const session = await lireSession(base, compte, cle)
  if (session === null) return null

  const tranches = session.tranches
  const enregistreLe = session.enregistreLe

  async function* entrees(): AsyncGenerator<ZipEntry> {
    for (const tranche of tranches) {
      const octets = await lireDepot(base, compte, tranche.dossier, tranche.nom)
      // Une tranche disparue entre le listage et la lecture : l'archive porte ce
      // qui reste, et le rang manquant se voit — c'est déjà ce que fait le
      // chargement depuis le serveur.
      if (octets === null) continue
      yield {
        // Le dossier d'origine est conservé : une tranche de trace et une
        // tranche de journal portent le même nom, et les mettre à plat en
        // écraserait une.
        name: `${tranche.dossier}/${tranche.nom}`,
        bytes: new Uint8Array(octets),
        at: enregistreLe,
      }
    }
  }

  return { nom: nomDArchive(session), flux: zipStream(entrees()) }
}

/**
 * Le nom du fichier qui descend.
 *
 * La date du trajet, et non celle du téléchargement : c'est ce qu'on cherchera
 * dans un dossier six mois plus tard.
 */
function nomDArchive(session: SessionEnBase): string {
  const quand = new Date(session.enregistreLe).toISOString().slice(0, 19).replace(/[:T]/g, '-')
  return `trajet-${quand}.zip`
}

/**
 * Combien d'épingles un compte peut poser, par défaut.
 *
 * Sans effet aujourd'hui : il y a un seul compte, et ses quatorze sessions
 * reprises sont des archives, qui ne comptent pas. La borne existe pour le jour
 * où les comptes ne sont plus un seul — c'est pourquoi elle est vérifiée par un
 * test plutôt que par l'usage. Même ordre de grandeur que les vingt trajets que
 * le profil mesuré garde en détail.
 */
export const EPINGLES_PAR_DEFAUT = 20

/** Ce que l'épinglage a donné. */
export type Epinglage = 'épinglé' | 'décroché' | 'borne atteinte' | 'archivé' | 'inconnu'

/**
 * Pose ou retire l'épingle sur un trajet entier.
 *
 * **Sur le trajet, pas sur une tranche** : on ne choisit pas une tranche de
 * journal, on garde un trajet.
 *
 * **L'archive ne s'épingle pas et ne compte pas.** Elle retient déjà, à un titre
 * qui n'est pas un choix ; la faire entrer dans la borne remplirait celle-ci
 * avant la première épingle.
 */
export async function epingler(
  base: Base,
  compte: string,
  cle: string,
  voulu: boolean,
  borne = EPINGLES_PAR_DEFAUT,
): Promise<{ etat: Epinglage; epinglees: number; borne: number }> {
  const sessions = await listerSessions(base, compte)
  const session = sessions.find((candidate) => candidate.cle === cle)
  const epinglees = sessions.filter((candidate) => candidate.exemption === 'epingle').length

  if (session === undefined) return { etat: 'inconnu', epinglees, borne }
  if (session.exemption === 'archive') return { etat: 'archivé', epinglees, borne }

  if (voulu && session.exemption !== 'epingle' && epinglees >= borne) {
    return { etat: 'borne atteinte', epinglees, borne }
  }

  const ids = session.tranches.map((tranche) => `${compte}:${tranche.dossier}:${tranche.nom}`)
  for (let debut = 0; debut < ids.length; debut += 200) {
    await base
      .update(deposits)
      .set({ exemption: voulu ? 'epingle' : null })
      .where(inArray(deposits.id, ids.slice(debut, debut + 200)))
  }

  const apres = epinglees + (voulu ? (session.exemption === 'epingle' ? 0 : 1) : -1)
  return { etat: voulu ? 'épinglé' : 'décroché', epinglees: Math.max(0, apres), borne }
}
