/**
 * L'accord d'assistance : « regardez ce qui cloche chez moi, jusqu'à ce soir ».
 *
 * **Il n'y a aucun canal de demande.** Le serveur ne sait pas parler à une
 * voiture — pas de sondage, pas de connexion ouverte, les rôles sont relevés une
 * fois au démarrage — et la voiture roule souvent hors réseau. Construire ce
 * canal coûterait du trafic permanent dans l'application qui en veut le moins. On
 * demande donc de vive voix, et le conducteur ouvre lui-même depuis son écran.
 *
 * **Un seul interrupteur, tout ou rien.** Pas de crans par nature de donnée :
 * celui qui accorde n'a alors aucun choix à faire, donc aucun mauvais choix à
 * faire.
 *
 * **L'accord est une date d'échéance, et rien d'autre.** Le droit tombe dès
 * qu'elle est dépassée, sans qu'aucun passage périodique n'ait à s'exécuter.
 */

import { eq } from 'drizzle-orm'

import type { Base } from './base/base'
import { assistanceGrants } from './base/schema'

/** Ce que vaut un accord quand personne ne choisit : vingt-quatre heures. */
export const DUREE_DE_L_ASSISTANCE = 24 * 60 * 60 * 1000

/** L'état de l'accord, tel que les deux écrans le montrent. */
export interface Assistance {
  ouverte: boolean
  /** L'échéance, ou `null` quand il n'y a pas d'accord. */
  jusquau: string | null
}

/**
 * Ouvre l'assistance, pour une durée.
 *
 * Rouvrir remplace l'échéance : c'est le geste qu'on fait quand la première
 * heure n'a pas suffi.
 */
export async function ouvrirLAssistance(
  base: Base,
  compte: string,
  maintenant: number = Date.now(),
  duree: number = DUREE_DE_L_ASSISTANCE,
): Promise<Assistance> {
  const echeance = Math.floor((maintenant + duree) / 1000)

  await base
    .insert(assistanceGrants)
    .values({ accountId: compte, expiresAt: echeance })
    .onConflictDoUpdate({ target: assistanceGrants.accountId, set: { expiresAt: echeance } })

  return { ouverte: true, jusquau: new Date(echeance * 1000).toISOString() }
}

/**
 * Referme avant l'échéance.
 *
 * On efface la ligne plutôt que de dater le passé : l'absence est l'état normal,
 * et une échéance dépassée qui traîne se lirait comme un accord ancien.
 */
export async function fermerLAssistance(base: Base, compte: string): Promise<void> {
  await base.delete(assistanceGrants).where(eq(assistanceGrants.accountId, compte))
}

/**
 * L'accord de ce compte, à cet instant.
 *
 * Une échéance passée vaut fermé, **sans qu'on efface quoi que ce soit** : c'est
 * la lecture qui écarte, et aucune tâche périodique n'a à tourner pour ça.
 */
export async function assistanceDuCompte(
  base: Base,
  compte: string,
  maintenant: number = Date.now(),
): Promise<Assistance> {
  const [ligne] = await base
    .select({ expiresAt: assistanceGrants.expiresAt })
    .from(assistanceGrants)
    .where(eq(assistanceGrants.accountId, compte))
    .limit(1)

  if (ligne === undefined) return { ouverte: false, jusquau: null }
  if (ligne.expiresAt * 1000 <= maintenant) return { ouverte: false, jusquau: null }

  return { ouverte: true, jusquau: new Date(ligne.expiresAt * 1000).toISOString() }
}
