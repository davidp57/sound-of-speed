/**
 * Se faire un vrai compte, et s'y reconnecter.
 *
 * Deux gestes que tout sépare, et qui se ressemblent à l'écran : **rattacher**
 * une adresse au compte qu'on porte déjà — ses réglages restent —, et **se
 * connecter** à un compte qui existe ailleurs, ce qui abandonne celui qu'on
 * porte.
 *
 * **La connexion passe par une route à nous**, et non par celle de la
 * bibliothèque : elle doit régler dans le même passage le sort du compte que
 * cet appareil abandonne. En deux appels, ça ne marche pas — effacer le compte
 * d'ici invalide sa session, et la connexion qui suit n'installe plus rien.
 * Mesuré dans un navigateur.
 */

import { saveIdentity, type LocalIdentity } from './store'
import type { IdentityOptions, SortDeLAncien } from './client'

/** Le chemin sous lequel le serveur répond de l'identité. */
const IDENTITE = '/api/auth'

export type Rattachement =
  | { state: 'rattachee'; email: string }
  | { state: 'sans-reseau' }
  | { state: 'refusee'; detail: string }

/**
 * Donne une adresse et un mot de passe au compte de cet appareil.
 *
 * Le compte ne change pas : ses profils, ses moteurs, ses trajets et son profil
 * mesuré restent exactement où ils sont. Ce qui bouge est son adresse.
 */
export async function rattacherUneAdresse(
  email: string,
  motDePasse: string,
  options: IdentityOptions = {},
): Promise<Rattachement> {
  const { fetchImpl = fetch } = options

  let reponse: Response
  try {
    reponse = await fetchImpl(`${IDENTITE}/compte/rattacher`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email, motDePasse }),
    })
  } catch {
    return { state: 'sans-reseau' }
  }

  if (reponse.ok) {
    const dit = await messageDe(reponse)
    return { state: 'rattachee', email: typeof dit['email'] === 'string' ? dit['email'] : email }
  }

  if (reponse.status === 401) {
    return {
      state: 'refusee',
      detail: "Cet appareil n'a pas encore de compte : il en prendra un au prochain passage.",
    }
  }
  const dit = await messageDe(reponse)
  return {
    state: 'refusee',
    detail: typeof dit['message'] === 'string' ? dit['message'] : `Le serveur a répondu ${reponse.status}.`,
  }
}

export type Connexion =
  | { state: 'connectee'; identity: LocalIdentity; ancien: SortDeLAncien }
  | { state: 'sans-reseau' }
  | { state: 'refusee'; detail: string }

/**
 * Ouvre ici un compte qui existe ailleurs.
 *
 * L'abandon d'abord, la connexion ensuite — voir l'en-tête de ce fichier. Un
 * appareil sans compte saute simplement la première étape : il n'a rien à
 * abandonner.
 */
export async function seConnecter(
  email: string,
  motDePasse: string,
  options: IdentityOptions = {},
): Promise<Connexion> {
  const { fetchImpl = fetch, now = Date.now } = options

  let reponse: Response
  try {
    reponse = await fetchImpl(`${IDENTITE}/compte/connexion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email, motDePasse }),
    })
  } catch {
    return { state: 'sans-reseau' }
  }

  if (reponse.status === 429) {
    return { state: 'refusee', detail: 'Trop d’essais de suite. Réessayer dans une minute.' }
  }
  if (!reponse.ok) {
    // Adresse inconnue et mot de passe faux se confondent, et c'est voulu : dire
    // lequel des deux apprendrait à qui cherche quelles adresses existent.
    return {
      state: 'refusee',
      detail: 'Cette adresse et ce mot de passe n’ouvrent aucun compte.',
    }
  }

  const dit = await messageDe(reponse)
  const compte = compteDe(dit)
  if (compte === null) {
    return { state: 'refusee', detail: 'La réponse ne porte pas de compte.' }
  }

  const ancien: SortDeLAncien =
    dit['ancien'] === 'efface' || dit['ancien'] === 'garde' ? dit['ancien'] : 'aucun'

  const identity: LocalIdentity = { ...compte, obtainedAt: now() }
  saveIdentity(identity)
  return { state: 'connectee', identity, ancien }
}

/** Le corps d'une réponse, quand il est du JSON — et un objet vide sinon. */
async function messageDe(reponse: Response): Promise<Record<string, unknown>> {
  try {
    const charge: unknown = await reponse.json()
    return typeof charge === 'object' && charge !== null
      ? (charge as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

function compteDe(charge: Record<string, unknown>): Omit<LocalIdentity, 'obtainedAt'> | null {
  const utilisateur = charge['user']
  if (typeof utilisateur !== 'object' || utilisateur === null) return null

  const champs = utilisateur as Record<string, unknown>
  const id = champs['id']
  if (typeof id !== 'string' || id === '') return null

  const anonymous = champs['isAnonymous'] === true
  const email = champs['email']
  return {
    id,
    name: typeof champs['name'] === 'string' ? champs['name'] : '',
    // Un compte auquel on se connecte par mot de passe n'est plus anonyme ;
    // c'est le serveur qui le dit, et on ne le suppose pas.
    anonymous,
    ...(anonymous || typeof email !== 'string' ? {} : { email }),
  }
}
