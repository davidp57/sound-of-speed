/**
 * Se servir d'un compte tenu ailleurs — Tesla, Google, Apple.
 *
 * **En plus de l'adresse et du mot de passe, jamais à la place.** Perdre l'accès
 * à son fournisseur ne doit pas faire perdre le compte : c'est pourquoi ce
 * chemin arrive après celui du mot de passe, et ne le remplace pas.
 *
 * **Deux gestes, comme pour une adresse, et la même distinction.** *Rattacher*
 * ajoute une preuve au compte qu'on porte déjà : ses profils, ses moteurs et ses
 * trajets ne bougent pas. *Se connecter* ouvre ici un compte qui existe
 * ailleurs, et abandonne celui d'ici.
 *
 * **Tout se joue en deux temps, parce que le navigateur quitte le site.** On
 * part chez le fournisseur, on revient sur une adresse qu'on a choisie — et
 * plus rien ne se souvient d'où l'on venait. D'où le passage par le stockage de
 * session : l'appareil range l'identifiant du compte qu'il abandonne avant de
 * partir, et le rend au serveur au retour pour que celui-ci décide de son sort.
 */

import type { IdentityOptions, SortDeLAncien } from './client'
import { loadIdentity } from './store'

/** Le chemin sous lequel le serveur répond de l'identité. */
const IDENTITE = '/api/auth'

/**
 * Le paramètre qui dit, au retour, ce qui s'est passé.
 *
 * Dans la partie interrogeable de l'adresse et non dans le fragment, à
 * l'inverse du code de liaison : ce qui voyage ici n'ouvre rien — c'est un mot
 * parmi trois —, et c'est le fournisseur qui nous ramène, donc l'adresse de
 * retour lui est donnée entière.
 */
const RETOUR = 'compte'

/**
 * Ce qu'un aller-retour chez un fournisseur peut avoir donné.
 *
 * **Un refus dit lequel des deux gestes a échoué.** Les deux partageaient la
 * même valeur `refuse`, et l'écran affichait donc au rattachement le message de
 * la connexion — « ce compte n'a pas ouvert de session ici » alors qu'on venait
 * d'essayer d'en rattacher un. Le diagnostic partait dans le décor.
 *
 * `refuse` reste accepté : une page laissée ouverte peut encore en porter un, et
 * il vaut mieux un message vague qu'un retour ignoré.
 */
export type RetourDuTiers =
  | 'rattache'
  | 'connecte'
  | 'refus-rattachement'
  | 'refus-connexion'
  | 'refuse'

/** Où l'appareil range le compte qu'il s'apprête peut-être à abandonner. */
const CLE_ANCIEN = 'speed.compteAvantLeTiers.v1'

/** Ce que le départ a donné. Le succès ne rend rien : la page s'en va. */
export type Depart = { state: 'part' } | { state: 'sans-reseau' } | { state: 'refusee'; detail: string }

/**
 * Ajoute un compte tenu ailleurs à celui de cet appareil.
 *
 * Le compte ne change pas : c'est une preuve de plus. Rien n'est donc mis de
 * côté avant de partir — il n'y a pas d'ancien compte à régler.
 */
export async function rattacherUnTiers(
  fournisseur: string,
  options: IdentityOptions = {},
): Promise<Depart> {
  return partir(`${IDENTITE}/link-social`, fournisseur, 'rattache', 'refus-rattachement', options)
}

/**
 * Ouvre ici le compte que ce fournisseur désigne.
 *
 * **Il n'en crée jamais aucun** : le serveur refuse la connexion par un
 * fournisseur qui n'a jamais été rattaché — voir `server/tiers.ts`. Sans cela,
 * ce bouton fabriquerait depuis la voiture un compte neuf et vide, et
 * abandonnerait les réglages qu'on avait.
 */
export async function seConnecterAvecUnTiers(
  fournisseur: string,
  options: IdentityOptions = {},
): Promise<Depart> {
  // Avant de partir, parce qu'au retour l'identité rangée sera déjà l'autre.
  garderLAncien(loadIdentity()?.id)
  return partir(`${IDENTITE}/sign-in/social`, fournisseur, 'connecte', 'refus-connexion', options)
}

/**
 * Demande l'adresse du fournisseur, et y emmène le navigateur.
 *
 * Les deux routes de la bibliothèque répondent la même chose — une adresse — et
 * c'est la page qui s'y rend : elles ne redirigent pas d'elles-mêmes quand on
 * les appelle en arrière-plan.
 */
async function partir(
  route: string,
  fournisseur: string,
  issue: RetourDuTiers,
  refus: RetourDuTiers,
  { fetchImpl = fetch }: IdentityOptions,
): Promise<Depart> {
  const origine = typeof window === 'undefined' ? '' : window.location.origin

  let reponse: Response
  try {
    reponse = await fetchImpl(route, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        provider: fournisseur,
        callbackURL: `${origine}/?${RETOUR}=${issue}`,
        // Sans cela, un refus laisse le navigateur sur une page d'erreur de la
        // bibliothèque, hors de l'application — dans une voiture, sans clavier
        // ni bouton de retour commode.
        errorCallbackURL: `${origine}/?${RETOUR}=${refus}`,
      }),
    })
  } catch {
    return { state: 'sans-reseau' }
  }

  if (!reponse.ok) {
    return { state: 'refusee', detail: `Le serveur a répondu ${reponse.status}.` }
  }

  let adresse: unknown
  try {
    adresse = ((await reponse.json()) as Record<string, unknown>)['url']
  } catch {
    return { state: 'refusee', detail: 'Le serveur a répondu autre chose que du JSON.' }
  }
  if (typeof adresse !== 'string' || adresse === '') {
    return { state: 'refusee', detail: 'La réponse ne porte pas d’adresse où aller.' }
  }

  window.location.assign(adresse)
  return { state: 'part' }
}

/**
 * Ce que l'adresse courante dit du retour, s'il y en a un.
 *
 * **Le paramètre est effacé au passage**, comme le code de liaison : une page
 * qu'on laisse ouverte et qu'on recharge rejouerait sinon le retour à chaque
 * fois.
 */
export function lireLeRetourDuTiers(): RetourDuTiers | null {
  if (typeof window === 'undefined') return null
  const parametres = new URLSearchParams(window.location.search)
  const lu = parametres.get(RETOUR)
  if (lu === null) return null

  parametres.delete(RETOUR)
  const reste = parametres.toString()
  history.replaceState(
    null,
    '',
    window.location.pathname + (reste === '' ? '' : `?${reste}`) + window.location.hash,
  )

  const connus: RetourDuTiers[] = [
    'rattache',
    'connecte',
    'refus-rattachement',
    'refus-connexion',
    'refuse',
  ]
  return connus.includes(lu as RetourDuTiers) ? (lu as RetourDuTiers) : null
}

/** Range le compte qu'on s'apprête à abandonner, le temps de l'aller-retour. */
function garderLAncien(id: string | undefined): void {
  if (id === undefined) return
  try {
    sessionStorage.setItem(CLE_ANCIEN, id)
  } catch {
    // Stockage fermé : l'ancien compte restera, vide, sur le serveur. C'est le
    // moindre mal — et la règle de rétention ne le ramassera pas, puisqu'elle
    // ne parle que des trajets.
  }
}

/** Le compte abandonné avant de partir, lu **et oublié**. */
export function reprendreLAncien(): string | null {
  try {
    const garde = sessionStorage.getItem(CLE_ANCIEN)
    sessionStorage.removeItem(CLE_ANCIEN)
    return garde
  } catch {
    return null
  }
}

/**
 * Dit au serveur quel compte cet appareil vient d'abandonner.
 *
 * Le serveur décide : effacé s'il était vide, gardé sinon. Ce qui revient est ce
 * que l'écran doit annoncer — un compte gardé est un compte auquel plus rien ne
 * ramène, et le taire le ferait découvrir bien plus tard.
 */
export async function reglerLAncienCompte(
  ancien: string,
  options: IdentityOptions = {},
): Promise<SortDeLAncien> {
  const { fetchImpl = fetch } = options
  try {
    const reponse = await fetchImpl(`${IDENTITE}/compte/regler-l-ancien`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ ancien }),
    })
    if (!reponse.ok) return 'aucun'
    const dit = (await reponse.json()) as Record<string, unknown>
    return dit['ancien'] === 'efface' || dit['ancien'] === 'garde' ? dit['ancien'] : 'aucun'
  } catch {
    // Hors réseau au retour d'un aller-retour qui a traversé le réseau : rare,
    // et sans conséquence — l'ancien compte reste, vide, et personne ne le
    // rouvrira.
    return 'aucun'
  }
}
