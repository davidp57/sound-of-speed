/**
 * L'identité de cet appareil, gardée d'une ouverture à l'autre.
 *
 * **Elle vit dans le stockage local, et non dans le témoin de connexion.** Le
 * témoin est fermé au code de la page — c'est ce qui le rend sûr — donc
 * l'application ne peut rien en lire. Or elle doit savoir qui elle est **avant**
 * d'avoir parlé au serveur, et parfois sans jamais pouvoir lui parler : la
 * voiture roule hors réseau.
 *
 * Ce qui est rangé ici n'ouvre rien. C'est un nom et un identifiant, de quoi
 * afficher « ce compte est le vôtre » ; ce qui ouvre, c'est le témoin, et il
 * reste au navigateur.
 */

const CLE = 'speed.identity.v1'

export interface LocalIdentity {
  /** L'identifiant du compte, tel que le serveur l'a donné. */
  id: string
  /** Ce qui s'affiche. */
  name: string
  /** Vrai tant qu'aucune adresse n'y est rattachée. */
  anonymous: boolean
  /**
   * L'adresse du compte, quand il en a une **vraie**.
   *
   * Absente d'un compte anonyme : celle que la bibliothèque lui fabrique sous
   * `.invalid` ne désigne aucune boîte, et l'afficher ferait croire à une
   * adresse. Elle est gardée ici pour que l'écran puisse dire à qui le compte
   * est rattaché **sans réseau**, ce qui est la situation ordinaire.
   */
  email?: string
  /**
   * Le portrait que le fournisseur d'un compte tenu ailleurs a rendu.
   *
   * Absent partout ailleurs : rien d'autre n'en fournit. Gardé ici pour que
   * l'écran l'affiche sans redemander, comme l'adresse — mais l'image, elle,
   * vient d'un serveur qui n'est pas le nôtre, et ne s'affichera pas hors
   * réseau. L'écran retombe alors sur l'initiale.
   */
  image?: string
  /** Quand cet appareil a obtenu son compte, en millisecondes. */
  obtainedAt: number
}

export function loadIdentity(): LocalIdentity | null {
  try {
    const brut = localStorage.getItem(CLE)
    if (brut === null) return null
    const lu: unknown = JSON.parse(brut)
    return estUneIdentite(lu) ? lu : null
  } catch {
    // Stockage fermé — navigation privée sur certains navigateurs — ou contenu
    // abîmé. Dans les deux cas l'appareil se comporte comme s'il n'avait pas
    // encore de compte, ce qui est récupérable ; lever ici ne le serait pas.
    return null
  }
}

/** Rend faux quand l'écriture a échoué, pour que l'écran puisse le dire. */
export function saveIdentity(identity: LocalIdentity): boolean {
  try {
    localStorage.setItem(CLE, JSON.stringify(identity))
    return true
  } catch {
    return false
  }
}

/**
 * Efface l'identité de cet appareil.
 *
 * **La remise à zéro des réglages n'appelle pas ceci**, et c'est délibéré : ce
 * bouton remet des réglages à leurs valeurs d'usine, il n'efface ni les données
 * ni le compte. Un bouton qui déconnecterait en remettant le volume à zéro
 * serait un piège.
 */
export function forgetIdentity(): void {
  try {
    localStorage.removeItem(CLE)
  } catch {
    // Rien à faire : il n'y avait rien à effacer, ou le stockage est fermé.
  }
}

function estUneIdentite(valeur: unknown): valeur is LocalIdentity {
  if (typeof valeur !== 'object' || valeur === null) return false
  const entree = valeur as Record<string, unknown>
  return (
    typeof entree['id'] === 'string' &&
    entree['id'] !== '' &&
    typeof entree['name'] === 'string' &&
    typeof entree['anonymous'] === 'boolean' &&
    typeof entree['obtainedAt'] === 'number' &&
    (entree['email'] === undefined || typeof entree['email'] === 'string') &&
    (entree['image'] === undefined || typeof entree['image'] === 'string')
  )
}
