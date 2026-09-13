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

import { loadIdentity, saveIdentity, type LocalIdentity } from './store'

/** Le chemin sous lequel le serveur répond de l'identité. */
const IDENTITE = '/api/auth'

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
  if (gardee !== null) {
    await prolonger(fetchImpl)
    return { state: 'gardee', identity: gardee }
  }

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
  return { state: 'obtenue', identity }
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
 * Touche le serveur pour prolonger la session.
 *
 * Sans cela, un appareil qui garde son identité en local perdrait son témoin au
 * bout d'un an sans rouler, et n'aurait aucun moyen de le reprendre — un compte
 * anonyme n'a pas de mot de passe. Chaque passage repousse l'échéance.
 */
async function prolonger(fetchImpl: typeof fetch): Promise<void> {
  try {
    await fetchImpl(`${IDENTITE}/get-session`, { headers: { Accept: 'application/json' } })
  } catch {
    // Hors réseau : la session se prolongera au prochain passage.
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
