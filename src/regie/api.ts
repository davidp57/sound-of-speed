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

export type Comptes =
  | { etat: 'ouverte'; comptes: LigneDeCompte[] }
  | { etat: 'fermee' }
  | { etat: 'panne'; motif: string }

export async function chargerLesComptes(): Promise<Comptes> {
  try {
    const reponse = await fetch('/api/regie/comptes')
    if (reponse.status === 404) return { etat: 'fermee' }
    if (!reponse.ok) return { etat: 'panne', motif: `code ${reponse.status}` }
    return { etat: 'ouverte', comptes: (await reponse.json()) as LigneDeCompte[] }
  } catch (erreur) {
    return { etat: 'panne', motif: String(erreur) }
  }
}
