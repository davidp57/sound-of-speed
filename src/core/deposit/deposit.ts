import { slug, stamp } from '../upload/put'
import { tracesToFile } from '../preset/store'
import type { Trace } from '../speed/replay'

/**
 * Le fichier que produit une trace : son nom et son corps.
 *
 * Les traces de l'étalonnage naissent en roulant et ne servent qu'ailleurs, au
 * poste de travail. Elles partent par la file de `core/upload/`, qui garde ce
 * qui n'a pas pu partir et le renvoie au retour du réseau ; ce module ne dit
 * plus que ce qu'un fichier de trace **est**.
 *
 * Le bouton de dépôt à la demande a disparu avec le panneau des traces : la
 * capture continue remonte toute seule, et un second chemin vers le même
 * dossier aurait fini par diverger du premier.
 */

/** Dossier servi en écriture. Voir `docker/nginx.conf`. */
export const TRACE_FOLDER = '/traces/'

/**
 * Nom du fichier déposé.
 *
 * Il doit permettre de retrouver une trace **sans l'ouvrir** : la date, la durée
 * et le nom donné à l'enregistrement. Tout ce qui n'est pas une lettre, un
 * chiffre ou un tiret est remplacé, parce que ce nom voyage dans une adresse et
 * atterrit sur un système de fichiers — deux endroits qui n'acceptent pas les
 * mêmes caractères, et dont l'intersection est étroite.
 */
export function depositName(trace: Trace): string {
  const seconds = Math.round(durationS(trace))
  const label = slug(trace.name) || 'trace'
  return `${stamp(trace.startedAt)}_${label}_${seconds}s.json`
}

/** Corps du fichier : celui que la fonction d'import sait relire. */
export function traceBody(trace: Trace): string {
  return tracesToFile([trace])
}

/** Durée couverte par la trace, en secondes. */
export function durationS(trace: Trace): number {
  const first = trace.samples[0]
  const last = trace.samples[trace.samples.length - 1]
  if (!first || !last) return 0
  return Math.max(0, (last.at - first.at) / 1000)
}
