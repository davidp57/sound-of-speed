import { byteLength, PLEIN } from './put'
import { pack } from './compress'
import type { Slice } from './slicing'

/**
 * Déposer une tranche sur le serveur.
 *
 * Le journal et la capture continue déposent de la même façon : un `PUT` par
 * tranche, un nom unique par construction, et un corps compressé. Seul le
 * dossier change.
 *
 * **La compression s'arrête à ce qui ne se relit pas depuis l'application.** Les
 * tranches partent compressées ; les profils et les relevés de mesure restent en
 * clair, parce que l'application les retélécharge et les lit — la bibliothèque
 * de profils cesserait de fonctionner.
 *
 * **On ne demande pas au serveur si le fichier est déjà là.** Le nom d'une
 * tranche est unique par construction — session plus rang, et un rang n'est
 * jamais réemployé —, et cette question coûterait une requête toutes les cinq
 * minutes pour une réponse qu'on connaît.
 *
 * `fetch` est injecté pour que tout ceci se vérifie sans réseau ni serveur.
 */

export type SliceOutcome =
  | { ok: true; name: string; bytes: number }
  | {
      ok: false
      /**
       * Pourquoi cela n'est pas parti.
       *
       * La distinction n'est pas cosmétique : `refused` veut dire que cet
       * appareil n'a plus de compte reconnu, et `network` qu'on est hors
       * couverture — ce qui arrive en roulant et n'est **pas** une erreur.
       * Seul ce dernier cas justifie de garder la tranche pour plus tard.
       */
      reason: 'refused' | 'network'
      detail: string
      /** Vrai quand il vaut la peine de réessayer avec la même tranche. */
      retry: boolean
    }

/**
 * Dépose une tranche, et dit précisément ce qui a échoué.
 *
 * Contrairement au dépôt d'une trace, on ne demande pas au serveur si le fichier
 * est déjà là. Deux raisons : le nom d'une tranche est unique par construction —
 * session plus rang, et un rang n'est jamais réemployé —, et cette question
 * coûterait une requête toutes les cinq minutes pour une réponse qu'on connaît.
 */
export async function putSlice(
  /** Dossier servi en écriture, barre oblique finale comprise. */
  folder: string,
  slice: Slice,
  fetchImpl: typeof fetch = fetch,
  /**
   * De quoi renoncer à une requête qui ne rend pas la main.
   *
   * Un abandon rejette le `fetch` : il ressort d'ici comme une indisponibilité
   * ordinaire, avec `retry`, et la tranche revient en attente. Voir
   * `core/upload/inflight.ts` pour le pourquoi de l'échéance.
   */
  signal?: AbortSignal,
): Promise<SliceOutcome> {
  const packed = await pack(slice.name, slice.body)

  try {
    const response = await fetchImpl(folder + encodeURIComponent(packed.name), {
      method: 'PUT',
      headers: {
        'Content-Type': packed.compressed ? 'application/gzip' : 'application/x-ndjson',
      },
      body: packed.body,
      // `null` et non `undefined` : le dépôt compile avec
      // `exactOptionalPropertyTypes`, qui refuse l'absence sur une propriété
      // dont le type ne la prévoit pas.
      signal: signal ?? null,
    })

    if (response.ok) {
      return { ok: true, name: packed.name, bytes: byteLength(packed.body) }
    }

    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        reason: 'refused',
        detail:
          response.status === 401
            ? "Refusé : cet appareil n'a plus de compte reconnu par le serveur."
            : "Le serveur reconnaît cet appareil mais lui refuse l'écriture ici.",
        // Réessayer donnerait le même refus tant qu'aucun compte n'est repris.
        retry: false,
      }
    }

    // **507 : le compte est plein sur le serveur.** Ni une panne, ni une tranche
    // trop grosse : le total déposé a atteint son plafond. Réessayer ne passera
    // jamais tant que rien n'est libéré — et c'est exactement le cas qui a
    // produit 726 tentatives en 137 secondes le 11 septembre 2026. On le dit en
    // clair, avec ce qu'il y a à faire.
    if (response.status === 507) {
      return {
        ok: false,
        reason: 'refused',
        detail: PLEIN,
        retry: false,
      }
    }

    // Tout le reste est traité comme une indisponibilité : un 503 derrière un
    // proxy, un 502 pendant un redémarrage du NAS, un 413 sur une tranche trop
    // grosse. Aucun n'est de la faute du journal, et la tranche vaut d'être
    // gardée — sauf le dernier, où réessayer à l'identique échouerait autant.
    return {
      ok: false,
      reason: 'network',
      detail: `Le serveur a répondu ${response.status}.`,
      retry: response.status !== 413,
    }
  } catch (error) {
    return {
      ok: false,
      reason: 'network',
      detail: error instanceof Error ? error.message : 'Dépôt impossible.',
      retry: true,
    }
  }
}
