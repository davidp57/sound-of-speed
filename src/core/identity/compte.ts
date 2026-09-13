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

import { forgetIdentity, saveIdentity, type LocalIdentity } from './store'
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

/**
 * Tenir son compte : changer son mot de passe, l'emporter, le supprimer.
 *
 * Trois gestes de nature différente, et qui se tiennent : on change un mot de
 * passe parce qu'on garde le compte, on emporte parce qu'on va peut-être le
 * quitter, on supprime parce qu'on le quitte pour de bon.
 */

/** Un compte tenu ailleurs, tel que l'écran doit le présenter. */
export interface Fournisseur {
  /** L'identifiant que les routes du serveur attendent. */
  id: string
  /** Ce qui s'écrit sur le bouton. */
  nom: string
}

/** Ce que ce serveur-ci sait faire. Ce qu'il ne sait pas ne s'affiche pas. */
export interface PossibilitesDuServeur {
  /** Un relais de courriel est configuré : « j'ai oublié » devient possible. */
  relaisCourriel: boolean
  /** Les comptes tenus ailleurs, quand il y en a de montés. */
  fournisseurs: Fournisseur[]
}

/**
 * Ce que le serveur d'en face sait faire.
 *
 * Hors réseau, on ne sait rien : on rend le minimum plutôt que de faire croire
 * à des possibilités qu'on ne pourra pas honorer.
 */
export async function possibilitesDuServeur(
  options: IdentityOptions = {},
): Promise<PossibilitesDuServeur> {
  const { fetchImpl = fetch } = options
  const rien: PossibilitesDuServeur = { relaisCourriel: false, fournisseurs: [] }

  try {
    const reponse = await fetchImpl(`${IDENTITE}/compte/possibilites`, {
      headers: { Accept: 'application/json' },
    })
    if (!reponse.ok) return rien
    const dit = await messageDe(reponse)
    return {
      relaisCourriel: dit['relaisCourriel'] === true,
      fournisseurs: Array.isArray(dit['fournisseurs'])
        ? dit['fournisseurs'].filter(estUnFournisseur)
        : [],
    }
  } catch {
    return rien
  }
}

/** Ce qu'un compte porte déjà comme preuves de qui le tient. */
export interface PreuvesDuCompte {
  /** Un mot de passe est rattaché à ce compte. */
  motDePasse: boolean
  /** Les comptes tenus ailleurs déjà rattachés à celui-ci. */
  fournisseurs: Fournisseur[]
}

/**
 * Ce que **ce compte-ci** porte, et non ce que le serveur propose.
 *
 * Rend `null` quand on ne sait pas : hors réseau, ou sans compte. L'écran s'en
 * sert pour ne rien affirmer — proposer de s'approprier un compte qui l'est
 * déjà est aussi faux que réclamer son mot de passe à un compte qui n'en a pas.
 */
export async function preuvesDuCompte(
  options: IdentityOptions = {},
): Promise<PreuvesDuCompte | null> {
  const { fetchImpl = fetch } = options

  try {
    const reponse = await fetchImpl(`${IDENTITE}/compte/preuves`, {
      headers: { Accept: 'application/json' },
    })
    if (!reponse.ok) return null
    const dit = await messageDe(reponse)
    return {
      motDePasse: dit['motDePasse'] === true,
      fournisseurs: Array.isArray(dit['fournisseurs'])
        ? dit['fournisseurs'].filter(estUnFournisseur)
        : [],
    }
  } catch {
    return null
  }
}

/**
 * Un fournisseur n'est retenu que s'il porte les deux champs.
 *
 * Le serveur est celui d'en face et non forcément de la même version : une
 * entrée qu'on ne sait pas afficher vaut mieux écartée qu'affichée en « undefined ».
 */
function estUnFournisseur(valeur: unknown): valeur is Fournisseur {
  if (typeof valeur !== 'object' || valeur === null) return false
  const entree = valeur as Record<string, unknown>
  return (
    typeof entree['id'] === 'string' &&
    entree['id'] !== '' &&
    typeof entree['nom'] === 'string' &&
    entree['nom'] !== ''
  )
}

export type Changement =
  | { state: 'change' }
  | { state: 'sans-reseau' }
  | { state: 'refusee'; detail: string }

/**
 * Change le mot de passe, l'ancien à l'appui.
 *
 * C'est la route de la bibliothèque, sans rien autour : elle fait exactement ce
 * qu'il faut, y compris exiger l'ancien mot de passe — sans quoi un appareil
 * laissé déverrouillé suffirait à verrouiller le compte de quelqu'un d'autre.
 */
export async function changerLeMotDePasse(
  ancien: string,
  nouveau: string,
  options: IdentityOptions = {},
): Promise<Changement> {
  const { fetchImpl = fetch } = options

  let reponse: Response
  try {
    reponse = await fetchImpl(`${IDENTITE}/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ currentPassword: ancien, newPassword: nouveau }),
    })
  } catch {
    return { state: 'sans-reseau' }
  }

  if (reponse.ok) return { state: 'change' }
  if (reponse.status === 400 || reponse.status === 401) {
    return { state: 'refusee', detail: 'Le mot de passe actuel n’est pas celui-là.' }
  }
  return { state: 'refusee', detail: `Le serveur a répondu ${reponse.status}.` }
}

export type Suppression =
  | { state: 'supprime' }
  | { state: 'sans-reseau' }
  | { state: 'refusee'; detail: string }

/**
 * Supprime le compte, et tout ce qu'il porte.
 *
 * Le mot de passe n'est exigé que par les comptes qui en ont un ; le passer à
 * vide est donc normal pour un compte anonyme, et le serveur tranche.
 */
export async function supprimerSonCompte(
  motDePasse = '',
  options: IdentityOptions = {},
): Promise<Suppression> {
  const { fetchImpl = fetch } = options

  let reponse: Response
  try {
    reponse = await fetchImpl(`${IDENTITE}/compte/supprimer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(motDePasse === '' ? {} : { motDePasse }),
    })
  } catch {
    return { state: 'sans-reseau' }
  }

  if (reponse.ok) {
    // L'identité gardée ici ne désigne plus rien. La laisser ferait afficher un
    // compte qui n'existe plus, jusqu'à la prochaine question au serveur.
    forgetIdentity()
    return { state: 'supprime' }
  }

  const dit = await messageDe(reponse)
  return {
    state: 'refusee',
    detail:
      typeof dit['message'] === 'string' ? dit['message'] : `Le serveur a répondu ${reponse.status}.`,
  }
}

/** L'adresse où le navigateur va chercher l'archive du compte. */
export const ARCHIVE_DU_COMPTE = '/mon-compte/archive.zip'
