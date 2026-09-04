import { tracesToFile } from '../preset/store'
import type { Trace } from '../speed/replay'

/**
 * Dépôt d'une trace sur le serveur.
 *
 * Le navigateur de la voiture refuse tout téléchargement : rien ne sort d'une
 * session d'enregistrement, alors que les traces naissent en roulant et ne
 * servent qu'ailleurs — au poste de travail, pour rejouer un trajet et régler
 * sans reprendre la route.
 *
 * **L'authentification est composée ici, et c'est un choix.** Le navigateur ne
 * fournit l'en-tête qu'après l'avoir demandée, et il ne la demande que sur une
 * navigation — jamais sur une requête lancée par une page. Un dépôt aurait donc
 * reçu un refus sans que rien ne s'affiche. L'application s'annonce elle-même,
 * avec un couple nom et mot de passe saisi une fois à l'écran de configuration.
 *
 * Une version antérieure faisait voyager ce secret dans l'adresse, pour éviter
 * de le saisir dans la voiture. C'était **moins sûr et plus long** : moins sûr
 * parce que le navigateur mémorise les adresses tapées et ressortait le secret
 * en autocomplétion, plus long parce que l'adresse entière fait plus de
 * caractères que le secret seul. Retiré.
 *
 * `fetch` est injecté pour que tout ceci se vérifie sans réseau ni serveur.
 */

/** Dossier servi en écriture. Voir `docker/nginx.conf`. */
const FOLDER = '/traces/'

export interface DepositCredentials {
  user: string
  password: string
}

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
  const date = new Date(trace.startedAt)
  const stamp = Number.isFinite(trace.startedAt)
    ? date.toISOString().slice(0, 19).replace(/[:T]/g, '-')
    : 'sans-date'
  const seconds = Math.round(durationS(trace))
  const label = slug(trace.name) || 'trace'
  return `${stamp}_${label}_${seconds}s.json`
}

/** Durée couverte par la trace, en secondes. */
export function durationS(trace: Trace): number {
  const first = trace.samples[0]
  const last = trace.samples[trace.samples.length - 1]
  if (!first || !last) return 0
  return Math.max(0, (last.at - first.at) / 1000)
}

/**
 * En-tête d'authentification.
 *
 * Séparé pour être vérifiable : une erreur d'encodage ici donnerait un refus
 * qu'on mettrait sur le compte d'un mot de passe faux.
 */
export function authHeader(credentials: DepositCredentials): string {
  return `Basic ${base64(`${credentials.user}:${credentials.password}`)}`
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
  if (!credentials.user.trim() || !credentials.password) {
    return {
      ok: false,
      reason: 'no-credentials',
      detail: "Aucun compte de dépôt : il se règle à l'écran de configuration.",
    }
  }

  const name = depositName(trace)
  const url = FOLDER + encodeURIComponent(name)
  const headers = { Authorization: authHeader(credentials) }

  // On regarde d'abord si le fichier est là : une trace déjà déposée ne se
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

  try {
    const response = await fetchImpl(url, {
      method: 'PUT',
      headers,
      body: tracesToFile([trace]),
    })
    if (response.ok) return { ok: true, name }
    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        reason: 'refused',
        detail:
          response.status === 401
            ? "Refusé : le nom ou le mot de passe ne correspond pas au fichier du serveur."
            : "Le serveur s'est laissé convaincre mais n'a pas le droit d'écrire dans le dossier.",
      }
    }
    return {
      ok: false,
      reason: 'network',
      detail: `Le serveur a répondu ${response.status}.`,
    }
  } catch (error) {
    return {
      ok: false,
      reason: 'network',
      detail:
        error instanceof Error && error.message
          ? `Dépôt impossible : ${error.message}`
          : 'Dépôt impossible : le serveur est injoignable.',
    }
  }
}

/**
 * Le fichier est-il déjà dans le dossier ?
 *
 * Rend `false` au moindre doute : une liste illisible, un dossier injoignable ou
 * une réponse qui n'est pas du JSON ne doivent pas empêcher un dépôt. Le pire
 * qui puisse alors arriver est le refus du serveur, qui sera dit.
 */
async function alreadyThere(name: string, fetchImpl: typeof fetch): Promise<boolean> {
  try {
    const response = await fetchImpl(FOLDER, { method: 'GET' })
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

/** Nom de fichier sûr, et lisible. */
function slug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .toLowerCase()
}

/**
 * Base 64 d'une chaîne qui peut contenir des accents.
 *
 * `btoa` ne prend que des octets : un mot de passe contenant un caractère hors ASCII le
 * ferait échouer, et l'échec ressemblerait à un refus du serveur.
 */
function base64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}
