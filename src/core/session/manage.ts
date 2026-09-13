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

import type { Delais, Verdict } from '../retention/regle'
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

/**
 * Tire l'archive d'un trajet, avec son nom.
 *
 * Passe par une requête plutôt que par un lien : les dossiers ne se lisent pas
 * sans mot de passe, et le navigateur ne compose l'en-tête d'annonce que sur une
 * navigation — un lien aurait reçu un refus sans que rien ne s'affiche.
 *
 * Le nom vient du serveur, qui le compose sur la date du trajet. Le recomposer
 * ici donnerait deux façons de nommer la même chose.
 */
export async function downloadTrip(
  key: string,
  credentials: DepositCredentials,
  fetchImpl: typeof fetch = fetch,
): Promise<{ blob: Blob; filename: string } | null> {
  if (!hasCredentials(credentials)) return null

  try {
    const response = await fetchImpl(`${tripUrl(key)}/archive.zip`, {
      headers: { Authorization: authHeader(credentials) },
    })
    if (!response.ok) return null
    return {
      blob: await response.blob(),
      filename: nomPropose(response.headers.get('content-disposition')) ?? 'trajet.zip',
    }
  } catch {
    return null
  }
}

/** Le nom que le serveur propose, tel que l'en-tête le porte. */
function nomPropose(disposition: string | null): string | null {
  if (disposition === null) return null
  const trouve = /filename="([^"]+)"/.exec(disposition)
  return trouve === null ? null : (trouve[1] ?? null)
}

/** Ce que l'épinglage a donné, tel que le serveur le dit. */
export interface Epinglage {
  etat: 'épinglé' | 'décroché' | 'borne atteinte' | 'archivé' | 'inconnu'
  epinglees: number
  borne: number
}

/**
 * Épingle un trajet, ou le décroche.
 *
 * Un refus n'est pas une panne : la borne atteinte est une réponse, et elle dit
 * où l'on en est pour que l'écran puisse proposer quoi faire.
 */
export async function pinTrip(
  key: string,
  wanted: boolean,
  credentials: DepositCredentials,
  fetchImpl: typeof fetch = fetch,
): Promise<Epinglage | null> {
  if (!hasCredentials(credentials)) return null

  try {
    const response = await fetchImpl(`${tripUrl(key)}/epingle`, {
      method: wanted ? 'PUT' : 'DELETE',
      headers: { Authorization: authHeader(credentials) },
    })
    // 409 porte le refus **et** son décompte : c'est une réponse à lire, pas un
    // échec à taire.
    if (!response.ok && response.status !== 409) return null
    return (await response.json()) as Epinglage
  } catch {
    return null
  }
}

/**
 * Ce que la règle emporterait, tel que le serveur le calcule.
 *
 * Lu et non recalculé ici : la règle qu'on relit doit être celle qui efface.
 */
export async function retentionVerdict(
  credentials: DepositCredentials,
  fetchImpl: typeof fetch = fetch,
): Promise<(Verdict & { delais: Delais }) | null> {
  if (!hasCredentials(credentials)) return null

  try {
    const response = await fetchImpl('/retention', {
      headers: { Accept: 'application/json', Authorization: authHeader(credentials) },
    })
    if (!response.ok) return null
    return (await response.json()) as Verdict & { delais: Delais }
  } catch {
    return null
  }
}
