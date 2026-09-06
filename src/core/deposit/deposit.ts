import { hasCredentials, putFile, slug, stamp, type DepositCredentials } from '../upload/put'
import { tracesToFile } from '../preset/store'
import type { Trace } from '../speed/replay'

/**
 * Dépôt d'une trace sur le serveur, à la demande.
 *
 * Le navigateur de la voiture refuse tout téléchargement : rien ne sort d'une
 * session d'enregistrement, alors que les traces naissent en roulant et ne
 * servent qu'ailleurs — au poste de travail, pour rejouer un trajet et régler
 * sans reprendre la route.
 *
 * **Ce module est le geste manuel.** La remontée automatique passe par la file
 * de `core/upload/`, qui garde ce qui n'a pas pu partir et le renvoie au retour
 * du réseau. Le bouton reste parce qu'il sert dans deux cas : quand l'accord de
 * remontée est coupé, et quand on ne veut pas attendre.
 *
 * L'écriture elle-même, l'authentification comprise, est dans
 * `core/upload/put.ts` : elle est commune à toutes les natures déposées.
 *
 * `fetch` est injecté pour que tout ceci se vérifie sans réseau ni serveur.
 */

/** Dossier servi en écriture. Voir `docker/nginx.conf`. */
export const TRACE_FOLDER = '/traces/'

export type { DepositCredentials } from '../upload/put'
export { authHeader } from '../upload/put'

export type DepositOutcome =
  | { ok: true; name: string }
  | { ok: false; reason: 'no-credentials' | 'refused' | 'exists' | 'network'; detail: string }

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

/**
 * Dépose une trace, et dit précisément ce qui a échoué.
 *
 * La distinction entre les motifs n'est pas cosmétique : « compte absent » se
 * corrige à l'écran de configuration, « refusé » veut dire que le mot de passe
 * ne correspond pas à celui du serveur, et « réseau » qu'on est hors couverture —
 * ce qui arrive en roulant, et n'est pas une erreur.
 */
export async function deposit(
  trace: Trace,
  credentials: DepositCredentials,
  fetchImpl: typeof fetch = fetch,
): Promise<DepositOutcome> {
  // Le compte se vérifie **avant** de toucher au réseau : sans lui, rien ne
  // partira, et interroger le dossier pour l'apprendre serait une requête pour
  // rien — hors couverture, elle coûterait en plus une attente.
  if (!hasCredentials(credentials)) {
    return {
      ok: false,
      reason: 'no-credentials',
      detail: "Aucun compte de dépôt : il se règle à l'écran de configuration.",
    }
  }

  const name = depositName(trace)

  // On regarde ensuite si le fichier est là : une trace déjà déposée ne se
  // réécrit pas en silence, sans quoi un second dépôt effacerait un
  // enregistrement qu'on croyait en sûreté.
  //
  // La question se pose au **dossier**, et non au fichier. Interroger le fichier
  // paraissait plus direct, et donnait un faux positif : un serveur qui replie
  // les chemins inconnus sur la page d'accueil — ce que fait le serveur de
  // développement, et ce que fait notre nginx hors du dossier des traces —
  // répond « oui » à tout. Le premier dépôt était donc refusé comme déjà fait.
  //
  // La liste du dossier, elle, est du JSON : si la réponse n'en est pas, on ne
  // sait pas, et l'on tente le dépôt plutôt que de refuser à tort.
  if (await alreadyThere(name, fetchImpl)) {
    return { ok: false, reason: 'exists', detail: `« ${name} » est déjà déposée.` }
  }

  const outcome = await putFile(TRACE_FOLDER, name, traceBody(trace), credentials, fetchImpl)
  if (outcome.ok) return { ok: true, name }
  return { ok: false, reason: outcome.reason, detail: outcome.detail }
}

/**
 * Le fichier est-il déjà dans le dossier ?
 *
 * Rend `false` au moindre doute : une liste illisible, un dossier injoignable ou
 * une réponse qui n'est pas du JSON ne doivent pas empêcher un dépôt. Le pire
 * qui puisse alors arriver est le refus du serveur, qui sera dit.
 */
export async function alreadyThere(name: string, fetchImpl: typeof fetch): Promise<boolean> {
  try {
    const response = await fetchImpl(TRACE_FOLDER, { method: 'GET' })
    if (!response.ok) return false
    const listing: unknown = await response.json()
    if (!Array.isArray(listing)) return false
    return listing.some(
      (entry) => typeof entry === 'object' && entry !== null && (entry as { name?: unknown }).name === name,
    )
  } catch {
    return false
  }
}
