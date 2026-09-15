import { putSlice, type SliceOutcome } from '../upload/slice-put'
import type { JournalSlice } from './journal'

/**
 * Dépôt d'une tranche de journal.
 *
 * **Un autre dossier que les traces**, et ce n'est pas cosmétique : le dossier
 * des traces est listé pour retrouver un trajet, et y verser une tranche de
 * journal par cinq minutes de conduite alourdirait cette liste à chaque sortie.
 *
 * L'envoi lui-même est commun à toutes les tranches — voir
 * `core/upload/slice-put.ts`.
 */

/** Dossier servi en écriture pour les journaux. Voir `docker/nginx.conf`. */
const FOLDER = '/journal/'

export type { SliceOutcome } from '../upload/slice-put'

export function depositSlice(
  slice: JournalSlice,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<SliceOutcome> {
  return putSlice(FOLDER, slice, fetchImpl, signal)
}
