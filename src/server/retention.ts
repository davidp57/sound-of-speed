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
import { rotationDeRetention, type Rotation } from '../core/retention/rotation'

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

/**
 * Ce que la rotation ferait, **avant** d'écrire le dépôt qui arrive.
 *
 * **Une seule lecture des trajets, et elle sert aux deux usages** : décider si
 * l'on refuse, puis effacer ce qu'elle a décidé. En faire deux doublerait le
 * parcours le plus coûteux du dépôt.
 *
 * **Ce qu'elle coûte, mesuré** : un dépôt ordinaire prend quelques dizaines de
 * millisecondes, celui qui déclenche la rotation environ le double. Mais il n'y
 * en a que **deux sur cent** — après un ménage le compte retombe à 90 %, et il
 * faut re-remplir cinq points avant que la lecture soit refaite. En moyenne, le
 * surcoût est de l'ordre de la milliseconde par dépôt, sur un dépôt toutes les
 * cinq minutes.
 *
 * **Et elle se fait avant l'écriture, ce qui protège le dépôt qui arrive.** Les
 * trajets sont classés par leur date d'enregistrement, lue dans le nom de la
 * tranche : une trace de mars remontée aujourd'hui — hors réseau, ou reprise
 * d'un ancien serveur — est le trajet le plus ancien du compte, donc la première
 * candidate de sa propre rotation. Mesuré : elle partait, et le client recevait
 * un 201. Ne lister qu'avant l'écriture l'exclut par construction, plutôt que par
 * une exception à ne pas oublier.
 *
 * `occupe` est la place **une fois ce dépôt écrit** : c'est bien elle qui décide
 * de ce qu'il faut libérer.
 */
export async function rotationAvantEcriture(
  base: Base,
  compte: string,
  occupe: number,
  plafond: number,
): Promise<Rotation> {
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

  return rotationDeRetention(trajets, occupe, plafond)
}

/**
 * Efface ce que la rotation a décidé.
 *
 * Rien n'est recalculé ici : ce qui efface applique ce qu'on a lu, sinon la
 * décision relue ne serait pas celle qui agit.
 */
export async function appliquerLaRotation(
  base: Base,
  compte: string,
  rotation: Rotation,
): Promise<{ trajets: number; octets: number }> {
  for (const trajet of rotation.aEffacer) {
    await effacerSession(base, compte, trajet.cle)
  }
  return { trajets: rotation.aEffacer.length, octets: rotation.octets }
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

/**
 * Le verdict, écrit pour être lu par quelqu'un.
 *
 * Les trajets qui partiraient, du plus ancien au plus récent, puis ce qui retient
 * les autres. On nomme ce qui part et on compte ce qui reste : c'est l'inverse
 * du journal d'un passage, où ce qui est parti n'existe plus.
 */
export function formaterVerdict(verdict: Verdict, delais: Delais): string {
  const lignes = [
    `Délais : ${delais.traces} jours pour un trajet à trace, ${delais.journal} pour un journal seul.`,
    '',
  ]

  if (verdict.aEffacer.length === 0) {
    lignes.push('Rien ne partirait.')
  } else {
    lignes.push(
      `${verdict.aEffacer.length} trajets partiraient, ${Math.round(verdict.octets / 1024)} Kio :`,
    )
    for (const trajet of verdict.aEffacer) {
      lignes.push(
        `  ${new Date(trajet.enregistreLe).toISOString().slice(0, 16).replace('T', ' ')}` +
          ` — ${trajet.tranches} tranches, ${Math.round(trajet.octets / 1024)} Kio` +
          ` — ${trajet.cle}${trajet.isole ? ' (dépôt seul)' : ''}`,
      )
    }
  }

  const raisons = new Map<string, number>()
  for (const retenu of verdict.retenus) {
    raisons.set(retenu.raison, (raisons.get(retenu.raison) ?? 0) + 1)
  }

  lignes.push('')
  lignes.push(
    verdict.retenus.length === 0
      ? 'Aucun trajet retenu.'
      : `${verdict.retenus.length} trajets retenus : ` +
          [...raisons].map(([raison, combien]) => `${combien} ${raison}`).join(', ') +
          '.',
  )

  // Les dépôts seuls ne se rangent nulle part : le verdict les nomme plutôt que
  // de les taire.
  const seuls = verdict.retenus.filter((retenu) => retenu.isole)
  for (const seul of seuls) {
    lignes.push(`  dépôt seul, retenu (${seul.raison}) : ${seul.cle}`)
  }

  return lignes.join('\n')
}
