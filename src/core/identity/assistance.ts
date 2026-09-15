/**
 * Autoriser l'assistance, et la refermer.
 *
 * Quand on signale un défaut, celui qui administre le serveur ne peut rien
 * regarder de ce compte : il n'y a aucune porte pour ça, et c'est délibéré. Ce
 * réglage en ouvre une, **pour une durée qui expire toute seule**.
 *
 * Il n'y a aucun canal de demande : le serveur ne sait pas parler à une voiture,
 * et la voiture roule souvent hors réseau. On demande de vive voix, et le
 * conducteur ouvre de lui-même.
 */

import type { IdentityOptions } from './client'

/** Le chemin de l'accord, du côté du serveur. */
export const CHEMIN_ASSISTANCE = '/mon-compte/assistance'

/** L'état de l'accord, tel que l'écran le montre. */
export interface Assistance {
  ouverte: boolean
  /** L'échéance en ISO, ou `null` quand rien n'est ouvert. */
  jusquau: string | null
}

/**
 * L'état de l'accord, ou `null` quand le serveur n'a pas répondu.
 *
 * `null` plutôt que « fermé » : hors réseau, l'écran ne doit pas affirmer que
 * rien n'est ouvert alors qu'il n'en sait rien.
 */
export async function lireLAssistance(options: IdentityOptions = {}): Promise<Assistance | null> {
  return appeler('GET', options)
}

export async function ouvrirLAssistance(options: IdentityOptions = {}): Promise<Assistance | null> {
  return appeler('PUT', options)
}

export async function fermerLAssistance(options: IdentityOptions = {}): Promise<Assistance | null> {
  return appeler('DELETE', options)
}

async function appeler(
  methode: 'GET' | 'PUT' | 'DELETE',
  options: IdentityOptions,
): Promise<Assistance | null> {
  const { fetchImpl = fetch } = options
  try {
    const reponse = await fetchImpl(CHEMIN_ASSISTANCE, {
      method: methode,
      headers: { Accept: 'application/json' },
    })
    if (!reponse.ok) return null
    const dit = (await reponse.json()) as Partial<Assistance>
    return {
      ouverte: dit.ouverte === true,
      jusquau: typeof dit.jusquau === 'string' ? dit.jusquau : null,
    }
  } catch {
    // Sans réseau, on ne sait pas : l'écran le dira plutôt que d'inventer.
    return null
  }
}
