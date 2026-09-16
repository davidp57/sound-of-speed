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
  roles: { role: string; expireLe: string | null; source: 'pile' | 'compte' }[]
  banques: { banque: string; source: 'pile' | 'compte' }[]
  banquesReservees: string[]
  assistance: { ouverte: boolean; jusquau: string | null }
  plafond: { octets: number; particulier: boolean }
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

/** Une entrée nommée, comme les listages du serveur les rendent. */
export interface Entree {
  name: string
  mtime?: string
}

/** Ce qu'un compte porte, quand il a autorisé qu'on le regarde. */
export interface Donnees {
  profils: Entree[]
  moteurs: Entree[]
  boites: Entree[]
  trajets: { cle: string; octets: number; tranches: unknown[] }[]
  journal: Entree[]
  mesures: Entree[]
}

export function chargerLesDonnees(compte: string): Promise<Rendu<Donnees>> {
  return demander<Donnees>(`/api/regie/comptes/${encodeURIComponent(compte)}/donnees`)
}

/**
 * Le contenu d'un profil, d'un moteur ou d'une boîte du compte visé.
 *
 * C'est ce pour quoi l'accord existe : comprendre un défaut sans demander à
 * quelqu'un de nous envoyer toute son archive.
 */
export async function chargerUnContenu(
  compte: string,
  registre: 'profils' | 'moteurs' | 'boites',
  nom: string,
): Promise<Rendu<string>> {
  try {
    const reponse = await fetch(
      `/api/regie/comptes/${encodeURIComponent(compte)}/donnees/${registre}/${encodeURIComponent(nom)}`,
    )
    if (reponse.status === 404) return { etat: 'fermee' }
    if (!reponse.ok) return { etat: 'panne', motif: `code ${reponse.status}` }
    return { etat: 'ouverte', valeur: await reponse.text() }
  } catch (erreur) {
    return { etat: 'panne', motif: String(erreur) }
  }
}

/** Ce que la règle de rétention emporterait, sans rien effacer. */
export interface Verdict {
  aEffacer: { cle: string; octets: number; enregistreLe: number }[]
  retenus: { cle: string; raison: string }[]
  octets: number
}

export function chargerLeVerdict(compte: string): Promise<Rendu<Verdict>> {
  return demander<Verdict>(`/api/regie/comptes/${encodeURIComponent(compte)}/retention`)
}

const surLeCompte = (compte: string) => `/api/regie/comptes/${encodeURIComponent(compte)}`

export function effacerLeCompte(compte: string) {
  return agir(surLeCompte(compte), 'DELETE')
}

export function forcerLaRetention(compte: string) {
  return agir<{ trajets: number; tranches: number }>(`${surLeCompte(compte)}/retention`, 'POST')
}

/** Ce que l'abandon a fait : le compte était vide et part, ou il est gardé. */
export type SortDeLAbandon = 'efface' | 'garde' | 'aucun'

export function reglerLAbandon(compte: string) {
  return agir<{ sort: SortDeLAbandon }>(`${surLeCompte(compte)}/abandon`, 'POST')
}

export function poserUnPlafond(compte: string, mio: number) {
  return agir<{ octets: number }>(`${surLeCompte(compte)}/plafond/${mio}`, 'PUT')
}

export function retirerLePlafond(compte: string) {
  return agir(`${surLeCompte(compte)}/plafond`, 'DELETE')
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
 * **Rend ce que le serveur a répondu**, et pas seulement qu'il a répondu. Les
 * routes de régie disent ce que le geste a vraiment fait — un rôle repris qui
 * reste offert à tout le monde, une banque encore jouable par la configuration,
 * un compte gardé plutôt qu'effacé —, et jeter cette réponse fait des boutons
 * qui semblent agir sans agir.
 *
 * Le motif sort quand le serveur refuse : un bouton qui ne fait rien sans rien
 * dire envoie chercher la panne au mauvais endroit.
 */
export type Geste<T> = { fait: true; rendu: T } | { fait: false; motif: string }

export async function agir<T = unknown>(
  chemin: string,
  methode: 'PUT' | 'DELETE' | 'POST',
  corps?: unknown,
): Promise<Geste<T>> {
  try {
    const reponse = await fetch(chemin, {
      method: methode,
      ...(corps === undefined
        ? {}
        : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) }),
    })
    if (!reponse.ok) return { fait: false, motif: `le serveur a répondu ${reponse.status}` }
    return { fait: true, rendu: (await reponse.json()) as T }
  } catch (erreur) {
    return { fait: false, motif: String(erreur) }
  }
}

export function donnerUnRole(compte: string, role: string) {
  return agir<{ donne: boolean }>(
    `/api/regie/comptes/${encodeURIComponent(compte)}/roles/${role}`,
    'PUT',
  )
}

export function reprendreUnRole(compte: string, role: string) {
  return agir<{ repris: boolean; offertAtous: boolean }>(
    `/api/regie/comptes/${encodeURIComponent(compte)}/roles/${role}`,
    'DELETE',
  )
}

export function accorderUneBanque(compte: string, banque: string) {
  return agir<{ accordee: boolean }>(
    `/api/regie/comptes/${encodeURIComponent(compte)}/banques/${encodeURIComponent(banque)}`,
    'PUT',
  )
}

export function retirerUneBanque(compte: string, banque: string) {
  return agir<{ retiree: boolean; peutEncore: boolean }>(
    `/api/regie/comptes/${encodeURIComponent(compte)}/banques/${encodeURIComponent(banque)}`,
    'DELETE',
  )
}
