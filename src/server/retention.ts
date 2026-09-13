/**
 * La règle de rétention, appliquée aux trajets de la base.
 *
 * Le calcul est celui du cœur : ce module lui donne l'état des trajets et range
 * ce qu'il rend. La règle n'est pas réécrite ici — celle qui efface doit être
 * exactement celle qu'on a pu relire avant.
 *
 * Le verdict n'efface rien. C'est ce qui permet de juger les seuils sur les
 * vraies données : aucun contrôle ne dira qu'un délai est trop court, un
 * mauvais seuil efface des données et rien ne rougit.
 */

import {
  DELAIS_PAR_DEFAUT,
  verdictDeRetention,
  type Delais,
  type TrajetJuge,
  type Verdict,
} from '../core/retention/regle'

import type { Base } from './base/base'
import { effacerSession, listerSessions } from './sessions'

export { DELAIS_PAR_DEFAUT } from '../core/retention/regle'
export type { Delais, Verdict } from '../core/retention/regle'

/** Ce que la règle emporterait, sans rien toucher. */
export async function verdictDuCompte(
  base: Base,
  compte: string,
  maintenant: number = Date.now(),
  delais: Delais = DELAIS_PAR_DEFAUT,
): Promise<Verdict> {
  const trajets: TrajetJuge[] = (await listerSessions(base, compte)).map((session) => ({
    cle: session.cle,
    isole: session.isole,
    enregistreLe: session.enregistreLe,
    octets: session.octets,
    tranches: session.tranches.length,
    traces: session.traces,
    journal: session.journal,
    aVoir: session.aVoir,
    exemption: session.exemption,
  }))

  return verdictDeRetention(trajets, maintenant, delais)
}

/** Ce qu'un passage de la règle a fait. */
export interface Passage {
  verdict: Verdict
  /** Trajets effacés, et tranches parties. */
  trajets: number
  tranches: number
}

/**
 * Applique le verdict.
 *
 * Il n'est pas recalculé autrement : deux règles écrites deux fois
 * divergeraient, et celle qui efface ne serait pas celle qu'on a relue.
 */
export async function appliquerLaRegle(
  base: Base,
  compte: string,
  maintenant: number = Date.now(),
  delais: Delais = DELAIS_PAR_DEFAUT,
): Promise<Passage> {
  const verdict = await verdictDuCompte(base, compte, maintenant, delais)

  let tranches = 0
  for (const trajet of verdict.aEffacer) {
    tranches += await effacerSession(base, compte, trajet.cle)
  }

  return { verdict, trajets: verdict.aEffacer.length, tranches }
}

/**
 * Ce qu'un passage écrit dans le journal du conteneur.
 *
 * C'est le seul endroit où l'on verra ce qui a disparu, puisque après coup il
 * n'y a plus rien à regarder. Un passage qui n'efface rien est le cas normal —
 * sur la base d'aujourd'hui, tout est archivé — et il se tait.
 */
export function formaterPassage(passage: Passage): string | null {
  if (passage.trajets === 0) return null

  const emportes = passage.verdict.aEffacer
    .map((trajet) => `${new Date(trajet.enregistreLe).toISOString().slice(0, 10)} (${trajet.cle})`)
    .join(', ')

  const raisons = new Map<string, number>()
  for (const retenu of passage.verdict.retenus) {
    raisons.set(retenu.raison, (raisons.get(retenu.raison) ?? 0) + 1)
  }
  const retenus = [...raisons].map(([raison, combien]) => `${combien} ${raison}`).join(', ')

  return (
    `rétention : ${passage.trajets} trajets effacés, ${passage.tranches} tranches, ` +
    `${Math.round(passage.verdict.octets / 1024)} Kio — ${emportes}` +
    (retenus === '' ? '' : ` ; retenus : ${retenus}`)
  )
}
