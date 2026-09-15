/**
 * Écrire un fichier sur le serveur.
 *
 * Le seul endroit du projet qui parle au serveur en écriture. Les traces, le
 * journal et les profils passaient par deux modules qui se ressemblaient déjà ;
 * une troisième et une quatrième nature les auraient fait diverger, et un
 * encodage d'authentification qui diverge donne un refus qu'on met sur le compte
 * d'un mot de passe faux.
 *
 * **Il n'y a plus rien à composer pour s'annoncer.** L'appareil a un compte, le
 * témoin de connexion voyage tout seul — la page et le serveur sont sur la même
 * origine —, et le serveur en déduit à qui appartient ce qui arrive. Le couple
 * nom et mot de passe qu'il fallait saisir à l'écran de configuration a disparu
 * avec le mot de passe partagé.
 *
 * `fetch` est injecté pour que tout ceci se vérifie sans réseau ni serveur.
 */

/**
 * Ce qu'on dit quand le serveur est plein pour ce compte.
 *
 * Le message part vers l'écran de configuration, qui l'affiche tel quel : il
 * doit donc dire quoi faire, et non seulement ce qui s'est passé. Il vit ici
 * parce que les deux façons de déposer — un fichier, une tranche — le donnent.
 */
export const PLEIN =
  'Le serveur est plein pour ce compte : emportez vos trajets, ou effacez-en, depuis l’écran du compte.'

/**
 * Pourquoi cela n'est pas parti.
 *
 * La distinction n'est pas cosmétique : `refused` veut dire que cet appareil n'a
 * plus de compte reconnu — il faudra en reprendre un, et rejouer l'envoi n'y
 * changerait rien —, et `network` qu'on est hors couverture, ce qui arrive en
 * roulant et n'est **pas** une erreur. Seul ce dernier cas justifie de garder
 * pour plus tard.
 */
export type PutFailure = 'refused' | 'network'

export type PutOutcome =
  | { ok: true; bytes: number }
  | { ok: false; reason: PutFailure; detail: string; retry: boolean }

/**
 * Dépose un fichier, et dit précisément ce qui a échoué.
 *
 * `folder` finit par une barre oblique, `name` est un nom de fichier nu : il est
 * échappé ici, parce que l'oublier donnerait une adresse valide qui écrit au
 * mauvais endroit.
 */
export interface PutOptions {
  /**
   * Ce dépôt est une reprise, et non un envoi du jour.
   *
   * Le serveur l'épingle alors : une trace enregistrée il y a trois mois et
   * remontée aujourd'hui serait effacée un mois plus tard par la règle de
   * rétention, c'est-à-dire déplacée pour être perdue.
   */
  epingle?: boolean
  fetchImpl?: typeof fetch
}

export async function putFile(
  folder: string,
  name: string,
  /**
   * Le corps, texte ou binaire.
   *
   * Un `Blob` est passé tel quel : une capture de son fait un mégaoctet et demi
   * d'échantillons, et la faire transiter par une chaîne la doublerait en
   * mémoire pour rien.
   */
  body: string | Blob,
  options: PutOptions = {},
): Promise<PutOutcome> {
  const { epingle = false, fetchImpl = fetch } = options

  try {
    const adresse = folder + encodeURIComponent(name) + (epingle ? '?reprise=1' : '')
    const response = await fetchImpl(adresse, { method: 'PUT', body })
    if (response.ok) return { ok: true, bytes: byteLength(body) }
    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        reason: 'refused',
        detail:
          response.status === 401
            ? "Refusé : cet appareil n'a plus de compte reconnu par le serveur."
            : "Le serveur reconnaît cet appareil mais lui refuse l'écriture ici.",
        // Le même envoi échouera de la même façon tant que l'appareil n'aura pas
        // repris un compte. Réessayer en boucle ne ferait que masquer le message.
        retry: false,
      }
    }
    // Le compte est plein : ni une panne, ni une charge trop grosse. Réessayer
    // ne passera jamais tant que rien n'est libéré.
    if (response.status === 507) {
      return { ok: false, reason: 'refused', detail: PLEIN, retry: false }
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
export function byteLength(body: string | Blob): number {
  return typeof body === 'string' ? new TextEncoder().encode(body).length : body.size
}
