/**
 * Ce qu'on fait d'un trajet : l'effacer, l'emporter, le retenir.
 *
 * Le relecteur est le seul endroit d'où ces gestes partent — on ne trie pas ses
 * archives au volant, et l'application de la voiture n'en gagne aucun écran.
 *
 * Ils vivent ici plutôt que dans le composant pour la même raison que le reste
 * du cœur : ils se vérifient sans navigateur, et une adresse mal composée se
 * voit dans un test au lieu de se découvrir devant un trajet qui ne part pas.
 *
 * `fetch` est injecté pour que tout ceci se vérifie sans réseau ni serveur.
 */

import { authHeader, hasCredentials, type DepositCredentials } from '../upload/put'

/** L'adresse d'un trajet. La clé porte des deux-points quand le dépôt est seul. */
function tripUrl(key: string): string {
  return `/sessions/${encodeURIComponent(key)}`
}

/**
 * Efface un trajet, et dit combien de tranches sont parties.
 *
 * Zéro est une réponse : le trajet était déjà parti, et rejouer la demande n'est
 * pas une erreur. `null` dit que le serveur n'a pas répondu — là, rien n'a été
 * effacé et il faut le montrer.
 */
export async function deleteTrip(
  key: string,
  credentials: DepositCredentials,
  fetchImpl: typeof fetch = fetch,
): Promise<number | null> {
  if (!hasCredentials(credentials)) return null

  try {
    const response = await fetchImpl(tripUrl(key), {
      method: 'DELETE',
      headers: { Authorization: authHeader(credentials) },
    })
    if (!response.ok) return null
    const rendu = (await response.json()) as { efface?: number }
    return typeof rendu.efface === 'number' ? rendu.efface : 0
  } catch {
    return null
  }
}
