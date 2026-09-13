/**
 * Obtenir un compte, sans jamais faire attendre le démarrage.
 *
 * **C'est l'exigence qui commande tout le reste** : l'application part de ce
 * qu'elle a en local, fait du son, et se présente au serveur quand elle peut.
 * Une voiture qui attendrait une réponse avant d'afficher ses cadrans serait
 * inutilisable là où elle roule — et c'est là qu'elle roule.
 *
 * Rien ici n'est donc `await` par le chemin de démarrage : `startIdentity` rend
 * la main tout de suite, et le travail se fait derrière.
 */

import type { CoupleDeLiaison } from './lien'
import { loadIdentity, saveIdentity, type LocalIdentity } from './store'

/** Le chemin sous lequel le serveur répond de l'identité. */
const IDENTITE = '/api/auth'

/** Le chemin sous lequel il répond de la liaison entre appareils. */
const LIAISON = '/api/liaison'

export interface IdentityOptions {
  fetchImpl?: typeof fetch
  /** Pour les tests : l'instant présent. */
  now?: () => number
}

/**
 * Ce qu'une tentative a donné.
 *
 * `gardee` et `obtenue` se distinguent parce que la seconde est la seule qui
 * change quelque chose à l'écran : un appareil vient d'avoir un compte.
 */
export type IdentityOutcome =
  | { state: 'gardee'; identity: LocalIdentity }
  | { state: 'obtenue'; identity: LocalIdentity }
  /** L'appareil avait un compte, le serveur ne le connaît plus : il en a repris un neuf. */
  | { state: 'reprise'; identity: LocalIdentity }
  | { state: 'sans-reseau' }
  | { state: 'refusee'; detail: string }

/**
 * S'assure que cet appareil a un compte, et rend ce qui s'est passé.
 *
 * Quand il en a déjà un, le serveur est quand même touché — mais seulement pour
 * **prolonger** la session, qui se périmerait sinon au bout d'un an sans rouler.
 * L'échec de cet appel ne coûte rien : l'identité gardée reste bonne.
 */
export async function ensureIdentity(options: IdentityOptions = {}): Promise<IdentityOutcome> {
  const { fetchImpl = fetch, now = Date.now } = options
  const gardee = loadIdentity()

  // **Le serveur d'abord, toujours.** C'est lui qui sait quelle session le
  // navigateur porte, et lui seul : le témoin de connexion est fermé au code de
  // la page. Demander un compte sans avoir regardé donnait une erreur quand le
  // stockage local avait été vidé alors que le témoin, lui, était resté — et
  // l'application n'obtenait plus jamais d'identité. Mesuré dans un navigateur.
  const ouverte = await sessionOuverte(fetchImpl)
  if (ouverte === 'sans-reseau') {
    return gardee === null ? { state: 'sans-reseau' } : { state: 'gardee', identity: gardee }
  }
  if (ouverte !== null) {
    const identity: LocalIdentity = { ...ouverte, obtainedAt: gardee?.obtainedAt ?? now() }
    saveIdentity(identity)
    return { state: 'gardee', identity }
  }

  // Plus de session. Un compte anonyme n'a pas de mot de passe : ce que
  // l'appareil portait ne se reprend pas, et le seul geste utile est d'en
  // recommencer un. L'écran le dit — c'est pour cela que `reprise` existe.
  const repris = gardee !== null

  let reponse: Response
  try {
    reponse = await fetchImpl(`${IDENTITE}/sign-in/anonymous`, {
      method: 'POST',
      // Le type **et** le corps, alors que la demande n'a rien à porter : la
      // bibliothèque rend 415 sur un POST qui annonce une longueur sans annoncer
      // un type, ce que le navigateur fait de lui-même dès qu'on ne lui donne
      // pas de corps. Mesuré ici, contre le vrai serveur, après qu'un test
      // passait en vert sur une requête que le navigateur n'envoie jamais.
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: '{}',
    })
  } catch {
    // Hors réseau, ce qui est la situation ordinaire dans une voiture. On
    // réessaiera au retour du réseau, et l'application marche sans.
    return { state: 'sans-reseau' }
  }

  if (!reponse.ok) {
    return { state: 'refusee', detail: `Le serveur a répondu ${reponse.status}.` }
  }

  let charge: unknown
  try {
    charge = await reponse.json()
  } catch {
    return { state: 'refusee', detail: 'Le serveur a répondu autre chose que du JSON.' }
  }

  const compte = compteDe(charge)
  if (compte === null) {
    return { state: 'refusee', detail: "La réponse ne porte pas de compte." }
  }

  const identity: LocalIdentity = { ...compte, obtainedAt: now() }
  saveIdentity(identity)
  return repris ? { state: 'reprise', identity } : { state: 'obtenue', identity }
}

/**
 * Lance l'obtention, et rend la main **tout de suite**.
 *
 * La forme compte autant que le fond : c'est la seule que le démarrage a le
 * droit d'appeler, et elle ne rend rien qu'on puisse attendre par mégarde.
 */
export function startIdentity(
  options: IdentityOptions = {},
  onOutcome?: (outcome: IdentityOutcome) => void,
): void {
  void ensureIdentity(options).then(onOutcome, () => {
    // Une identité qu'on n'a pas obtenue n'est pas une panne de l'application :
    // elle continue de rouler et de faire du son.
  })
}

/**
 * Quel compte ce navigateur ouvre-t-il, si tant est qu'il en ouvre un ?
 *
 * Rend le compte de la session, `null` quand il n'y en a pas, et `'sans-reseau'`
 * quand on n'a pas pu demander — trois réponses qui appellent trois conduites
 * différentes, et les confondre en coûterait une.
 *
 * Ce passage **prolonge** aussi la session : sans lui, un appareil qui garde son
 * identité en local perdrait son témoin au bout d'un an sans rouler, et un compte
 * anonyme ne se reprend pas.
 */
async function sessionOuverte(
  fetchImpl: typeof fetch,
): Promise<Omit<LocalIdentity, 'obtainedAt'> | null | 'sans-reseau'> {
  let reponse: Response
  try {
    reponse = await fetchImpl(`${IDENTITE}/get-session`, {
      headers: { Accept: 'application/json' },
    })
  } catch {
    return 'sans-reseau'
  }

  if (!reponse.ok) return null
  try {
    return compteDe(await reponse.json())
  } catch {
    return null
  }
}

function compteDe(charge: unknown): Omit<LocalIdentity, 'obtainedAt'> | null {
  if (typeof charge !== 'object' || charge === null) return null
  const utilisateur = (charge as Record<string, unknown>)['user']
  if (typeof utilisateur !== 'object' || utilisateur === null) return null

  const champs = utilisateur as Record<string, unknown>
  const id = champs['id']
  if (typeof id !== 'string' || id === '') return null

  return {
    id,
    name: typeof champs['name'] === 'string' ? champs['name'] : '',
    // Absent vaut anonyme : la seule façon d'arriver ici sans l'avoir demandé
    // est la création d'un compte qui n'a rien saisi.
    anonymous: champs['isAnonymous'] !== false,
  }
}


/**
 * Relier un second appareil au compte de la voiture.
 *
 * Deux gestes symétriques : la voiture **demande un code**, l'autre appareil
 * **s'y relie**. Le premier se fait depuis l'écran de configuration, le second
 * en ouvrant le lien que le code porte.
 *
 * **Hors réseau, on ne relie pas.** C'est acceptable — on ne relie pas un
 * appareil en roulant —, mais l'écran doit le dire au lieu d'attendre : c'est
 * pour cela que `sans-reseau` est une réponse à part entière, et non une erreur.
 */

export type CodeDemande =
  | { state: 'pose'; couple: CoupleDeLiaison }
  | { state: 'sans-reseau' }
  | { state: 'refusee'; detail: string }

/**
 * Demande au serveur de quoi faire un code.
 *
 * Ce qui revient ouvre le compte : ça ne se range nulle part, ça s'affiche et
 * ça disparaît.
 */
export async function demanderUnCode(options: IdentityOptions = {}): Promise<CodeDemande> {
  const { fetchImpl = fetch } = options

  let reponse: Response
  try {
    reponse = await fetchImpl(`${LIAISON}/code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: '{}',
    })
  } catch {
    return { state: 'sans-reseau' }
  }

  if (reponse.status === 401) {
    return {
      state: 'refusee',
      detail: "Cet appareil n'a pas encore de compte : il en prendra un au prochain passage.",
    }
  }
  if (!reponse.ok) {
    return { state: 'refusee', detail: `Le serveur a répondu ${reponse.status}.` }
  }

  let charge: unknown
  try {
    charge = await reponse.json()
  } catch {
    return { state: 'refusee', detail: 'Le serveur a répondu autre chose que du JSON.' }
  }

  const couple = coupleDe(charge)
  if (couple === null) {
    return { state: 'refusee', detail: "La réponse ne porte pas de quoi relier." }
  }
  return { state: 'pose', couple }
}

/** Ce qu'est devenu le compte que cet appareil portait avant de se relier. */
export type SortDeLAncien = 'efface' | 'garde' | 'aucun'

export type LiaisonFaite =
  | { state: 'reliee'; identity: LocalIdentity; ancien: SortDeLAncien }
  | { state: 'sans-reseau' }
  | { state: 'refusee'; detail: string }

/**
 * Ouvre ici le compte que le code désigne.
 *
 * Le serveur décide du sort du compte que cet appareil portait : effacé s'il
 * était vide, gardé sinon — voir `server/liaison.ts`, où l'ordre est expliqué.
 * Ici, on range la nouvelle identité et on rend ce qui s'est passé, pour que
 * l'écran puisse le dire.
 */
export async function relierCetAppareil(
  couple: CoupleDeLiaison,
  options: IdentityOptions = {},
): Promise<LiaisonFaite> {
  const { fetchImpl = fetch, now = Date.now } = options

  let reponse: Response
  try {
    reponse = await fetchImpl(`${LIAISON}/relier`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(couple),
    })
  } catch {
    return { state: 'sans-reseau' }
  }

  if (reponse.status === 401) {
    return { state: 'refusee', detail: "Ce code n'ouvre plus rien : en afficher un nouveau." }
  }
  if (!reponse.ok) {
    return { state: 'refusee', detail: `Le serveur a répondu ${reponse.status}.` }
  }

  let charge: unknown
  try {
    charge = await reponse.json()
  } catch {
    return { state: 'refusee', detail: 'Le serveur a répondu autre chose que du JSON.' }
  }

  const compte = compteRelie(charge)
  if (compte === null) {
    return { state: 'refusee', detail: "La réponse ne porte pas de compte." }
  }

  const identity: LocalIdentity = { ...compte.identity, obtainedAt: now() }
  saveIdentity(identity)
  return { state: 'reliee', identity, ancien: compte.ancien }
}

function coupleDe(charge: unknown): CoupleDeLiaison | null {
  if (typeof charge !== 'object' || charge === null) return null
  const champs = charge as Record<string, unknown>
  const email = champs['email']
  const motDePasse = champs['motDePasse']
  if (typeof email !== 'string' || email === '') return null
  if (typeof motDePasse !== 'string' || motDePasse === '') return null
  return { email, motDePasse }
}

function compteRelie(
  charge: unknown,
): { identity: Omit<LocalIdentity, 'obtainedAt'>; ancien: SortDeLAncien } | null {
  if (typeof charge !== 'object' || charge === null) return null
  const champs = charge as Record<string, unknown>
  const compte = champs['compte']
  if (typeof compte !== 'object' || compte === null) return null

  const decrit = compte as Record<string, unknown>
  const id = decrit['id']
  if (typeof id !== 'string' || id === '') return null

  const ancien = champs['ancien']
  return {
    identity: {
      id,
      name: typeof decrit['name'] === 'string' ? decrit['name'] : '',
      anonymous: decrit['anonymous'] === true,
    },
    ancien: ancien === 'efface' || ancien === 'garde' ? ancien : 'aucun',
  }
}
