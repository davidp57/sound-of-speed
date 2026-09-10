import type { DepositCredentials } from '../upload/put'
import { putSlice, type SliceOutcome } from '../upload/slice-put'
import type { Slice } from '../upload/slicing'

/**
 * Dépôt d'une tranche de capture.
 *
 * Dans le dossier des traces, qui est celui d'où l'on rapatrie un trajet pour
 * le rejouer. La capture **est** la trace, désormais : c'est le même contenu à
 * la même place, produit sans qu'on ait à le demander.
 *
 * L'envoi lui-même est commun à toutes les tranches — voir
 * `core/upload/slice-put.ts`.
 */

/** Dossier servi en écriture pour les traces. Voir `docker/nginx.conf`. */
const FOLDER = '/traces/'

export function depositCaptureSlice(
  slice: Slice,
  credentials: DepositCredentials,
  fetchImpl: typeof fetch = fetch,
): Promise<SliceOutcome> {
  return putSlice(FOLDER, slice, credentials, fetchImpl)
}
