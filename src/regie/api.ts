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
  banquesReservees: string[]
  assistance: { ouverte: boolean; jusquau: string | null }
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

/** Une ligne de trace, telle que le serveur la rend. */
export interface LigneDeTrace {
  quand: string
  geste: string
  detail: string | null
  admin: { id: string; nom: string | null }
  cible: { id: string; nom: string | null }
}

export function chargerLaTrace(): Promise<Rendu<LigneDeTrace[]>> {
  return demander<LigneDeTrace[]>('/api/regie/trace')
}

/**
 * Un geste qui change quelque chose.
 *
 * Rend le motif quand le serveur refuse : un bouton qui ne fait rien sans rien
 * dire envoie chercher la panne au mauvais endroit.
 */
export async function agir(
  chemin: string,
  methode: 'PUT' | 'DELETE' | 'POST',
  corps?: unknown,
): Promise<{ fait: true } | { fait: false; motif: string }> {
  try {
    const reponse = await fetch(chemin, {
      method: methode,
      ...(corps === undefined
        ? {}
        : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) }),
    })
    if (!reponse.ok) return { fait: false, motif: `le serveur a répondu ${reponse.status}` }
    return { fait: true }
  } catch (erreur) {
    return { fait: false, motif: String(erreur) }
  }
}

export function donnerUnRole(compte: string, role: string) {
  return agir(`/api/regie/comptes/${encodeURIComponent(compte)}/roles/${role}`, 'PUT')
}

export function reprendreUnRole(compte: string, role: string) {
  return agir(`/api/regie/comptes/${encodeURIComponent(compte)}/roles/${role}`, 'DELETE')
}

export function accorderUneBanque(compte: string, banque: string) {
  return agir(
    `/api/regie/comptes/${encodeURIComponent(compte)}/banques/${encodeURIComponent(banque)}`,
    'PUT',
  )
}

export function retirerUneBanque(compte: string, banque: string) {
  return agir(
    `/api/regie/comptes/${encodeURIComponent(compte)}/banques/${encodeURIComponent(banque)}`,
    'DELETE',
  )
}
