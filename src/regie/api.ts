/**
 * Ce que la régie demande au serveur.
 *
 * **Un 404 n'est pas une panne ici** : c'est la réponse normale à qui
 * n'administre pas, et l'écran doit alors se taire plutôt qu'expliquer. Les deux
 * cas sont donc séparés dès la lecture de la réponse.
 */

/** Une ligne de la liste des comptes, telle que le serveur la rend. */
export interface LigneDeCompte {
  id: string
  nom: string
  adresse: string | null
  anonyme: boolean
  creeLe: string
  roles: string[]
  octets: number
}

/** Tout ce que le serveur sait d'un compte, sauf ce qu'il a déposé. */
export interface Fiche {
  id: string
  nom: string
  adresse: string | null
  portrait: string | null
  anonyme: boolean
  creeLe: string
  fournisseurs: { id: string; nom: string }[]
  motDePasse: boolean
  sessions: { ouverteLe: string; expireLe: string }[]
  roles: { role: string; expireLe: string | null }[]
  banques: string[]
  porte: {
    profils: number
    moteurs: number
    boites: number
    depots: number
    octets: number
    trajetsMesures: number
  }
}

/** Ce qu'une demande rend : ce qu'on cherchait, un refus muet, ou une panne. */
export type Rendu<T> = { etat: 'ouverte'; valeur: T } | { etat: 'fermee' } | { etat: 'panne'; motif: string }

async function demander<T>(chemin: string): Promise<Rendu<T>> {
  try {
    const reponse = await fetch(chemin)
    if (reponse.status === 404) return { etat: 'fermee' }
    if (!reponse.ok) return { etat: 'panne', motif: `code ${reponse.status}` }
    return { etat: 'ouverte', valeur: (await reponse.json()) as T }
  } catch (erreur) {
    return { etat: 'panne', motif: String(erreur) }
  }
}

export function chargerLesComptes(): Promise<Rendu<LigneDeCompte[]>> {
  return demander<LigneDeCompte[]>('/api/regie/comptes')
}

export function chargerLaFiche(compte: string): Promise<Rendu<Fiche>> {
  return demander<Fiche>(`/api/regie/comptes/${encodeURIComponent(compte)}`)
}
