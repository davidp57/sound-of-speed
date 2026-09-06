/**
 * Écrire un fichier sur le serveur.
 *
 * Le seul endroit du projet qui parle au serveur en écriture. Les traces, le
 * journal et les profils passaient par deux modules qui se ressemblaient déjà ;
 * une troisième et une quatrième nature les auraient fait diverger, et un
 * encodage d'authentification qui diverge donne un refus qu'on met sur le compte
 * d'un mot de passe faux.
 *
 * **L'authentification est composée ici, et c'est un choix.** Le navigateur ne
 * fournit l'en-tête qu'après l'avoir demandée, et il ne la demande que sur une
 * navigation — jamais sur une requête lancée par une page. Un dépôt aurait donc
 * reçu un refus sans que rien ne s'affiche. L'application s'annonce elle-même,
 * avec un couple nom et mot de passe saisi une fois à l'écran de configuration.
 *
 * `fetch` est injecté pour que tout ceci se vérifie sans réseau ni serveur.
 */

export interface DepositCredentials {
  user: string
  password: string
}

/**
 * Pourquoi cela n'est pas parti.
 *
 * La distinction n'est pas cosmétique : `no-credentials` se corrige à l'écran de
 * configuration, `refused` veut dire que le compte ne correspond pas à celui du
 * serveur, et `network` qu'on est hors couverture — ce qui arrive en roulant et
 * n'est **pas** une erreur. Seul ce dernier cas justifie de garder pour plus
 * tard.
 */
export type PutFailure = 'no-credentials' | 'refused' | 'network'

export type PutOutcome =
  | { ok: true; bytes: number }
  | { ok: false; reason: PutFailure; detail: string; retry: boolean }

export function hasCredentials(credentials: DepositCredentials): boolean {
  return credentials.user.trim() !== '' && credentials.password !== ''
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
 * Dépose un fichier, et dit précisément ce qui a échoué.
 *
 * `folder` finit par une barre oblique, `name` est un nom de fichier nu : il est
 * échappé ici, parce que l'oublier donnerait une adresse valide qui écrit au
 * mauvais endroit.
 */
export async function putFile(
  folder: string,
  name: string,
  body: string,
  credentials: DepositCredentials,
  fetchImpl: typeof fetch = fetch,
): Promise<PutOutcome> {
  if (!hasCredentials(credentials)) {
    return {
      ok: false,
      reason: 'no-credentials',
      detail: "Aucun compte de dépôt : il se règle à l'écran de configuration.",
      // Rien ne sert de réessayer tout de suite : il manque un réglage, pas du
      // réseau. Mais ce qui attend est gardé, sans quoi un oubli de saisie
      // coûterait le fichier.
      retry: true,
    }
  }

  try {
    const response = await fetchImpl(folder + encodeURIComponent(name), {
      method: 'PUT',
      headers: { Authorization: authHeader(credentials) },
      body,
    })
    if (response.ok) return { ok: true, bytes: byteLength(body) }
    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        reason: 'refused',
        detail:
          response.status === 401
            ? 'Refusé : le nom ou le mot de passe ne correspond pas au fichier du serveur.'
            : "Le serveur s'est laissé convaincre mais n'a pas le droit d'écrire dans le dossier.",
        // Le même envoi échouera de la même façon tant que le compte n'aura pas
        // changé. Réessayer en boucle ne ferait que masquer le message.
        retry: false,
      }
    }
    return {
      ok: false,
      reason: 'network',
      detail: `Le serveur a répondu ${response.status}.`,
      retry: true,
    }
  } catch (error) {
    return {
      ok: false,
      reason: 'network',
      detail:
        error instanceof Error && error.message
          ? `Dépôt impossible : ${error.message}`
          : 'Dépôt impossible : le serveur est injoignable.',
      retry: true,
    }
  }
}

/** Nom de fichier sûr, et lisible. */
export function slug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .toLowerCase()
}

/** Horodatage lisible dans un nom de fichier, et acceptable partout. */
export function stamp(at: number): string {
  if (!Number.isFinite(at)) return 'sans-date'
  return new Date(at).toISOString().slice(0, 19).replace(/[:T]/g, '-')
}

/** Taille du corps en octets, et non en caractères — un accent en vaut deux. */
export function byteLength(body: string): number {
  return new TextEncoder().encode(body).length
}

/**
 * Base 64 d'une chaîne qui peut contenir des accents.
 *
 * `btoa` ne prend que des octets : un mot de passe contenant un caractère hors
 * ASCII le ferait échouer, et l'échec ressemblerait à un refus du serveur.
 */
function base64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}
