/**
 * Aller chercher ses rôles, et les retenir pour les savoir hors réseau.
 *
 * **Rien ici n'est un préalable au démarrage.** L'application part de ce qu'elle
 * a retenu, fait du son, et demande au serveur quand elle peut — c'est
 * l'exigence qui commande tout ce lot, et la voiture roule normalement sans
 * réseau.
 *
 * Ce qui est rangé n'ouvre rien : c'est une liste de rôles, que n'importe qui
 * peut réécrire dans son navigateur. Ce qui protège est le refus du serveur ;
 * cette copie ne sert qu'à ne pas afficher un écran qui répondra non.
 */

import { estUnRole, type CopieDesRoles, type Droit } from './roles'
import type { IdentityOptions } from './client'

/** Le chemin sous lequel le serveur dit ce qu'un compte ouvre. */
const DROITS = '/api/droits'

const CLE = 'speed.roles.v1'

export function lireLaCopie(): CopieDesRoles | null {
  try {
    const brut = localStorage.getItem(CLE)
    if (brut === null) return null
    const lu: unknown = JSON.parse(brut)
    return estUneCopie(lu) ? lu : null
  } catch {
    // Stockage fermé, ou contenu abîmé : on se comporte comme un appareil qui
    // n'a encore rien relevé, et qui n'interdit donc rien.
    return null
  }
}

export function rangerLaCopie(copie: CopieDesRoles): void {
  try {
    localStorage.setItem(CLE, JSON.stringify(copie))
  } catch {
    // Sans conséquence : on redemandera au prochain démarrage.
  }
}

/** Efface ce qui a été retenu — un autre compte n'a pas les mêmes rôles. */
export function oublierLaCopie(): void {
  try {
    localStorage.removeItem(CLE)
  } catch {
    // Rien à faire : il n'y avait rien, ou le stockage est fermé.
  }
}

/**
 * Demande au serveur ce que ce compte ouvre, et range la réponse.
 *
 * Rend `null` quand on n'a pas pu demander — hors réseau, ou pas encore de
 * compte. Ce n'est pas une erreur : la copie précédente reste bonne, et
 * l'absence de copie n'interdit rien.
 */
export async function releverLesRoles(
  options: IdentityOptions = {},
): Promise<CopieDesRoles | null> {
  const { fetchImpl = fetch, now = Date.now } = options

  let reponse: Response
  try {
    reponse = await fetchImpl(DROITS, { headers: { Accept: 'application/json' } })
  } catch {
    return null
  }
  if (!reponse.ok) return null

  let charge: unknown
  try {
    charge = await reponse.json()
  } catch {
    return null
  }
  if (typeof charge !== 'object' || charge === null) return null

  const champs = charge as Record<string, unknown>
  const droits = Array.isArray(champs['droits']) ? champs['droits'].map(unDroit) : []
  const offerts = Array.isArray(champs['offerts']) ? champs['offerts'].filter(estUnRole) : []

  const copie: CopieDesRoles = {
    droits: droits.filter((droit): droit is Droit => droit !== null),
    offerts,
    releveLe: now(),
  }
  rangerLaCopie(copie)
  return copie
}

/**
 * Un droit, tel qu'il arrive : une date lisible, ou rien.
 *
 * Une date illisible vaut **sans échéance** plutôt que « expiré » : un serveur
 * qui répond de travers ne doit pas fermer des écrans qui marchaient.
 */
function unDroit(valeur: unknown): Droit | null {
  if (typeof valeur !== 'object' || valeur === null) return null
  const champs = valeur as Record<string, unknown>
  if (!estUnRole(champs['role'])) return null

  const quand = Date.parse(typeof champs['expireLe'] === 'string' ? champs['expireLe'] : '')
  return { role: champs['role'], expireLe: Number.isFinite(quand) ? quand : null }
}

function estUneCopie(valeur: unknown): valeur is CopieDesRoles {
  if (typeof valeur !== 'object' || valeur === null) return false
  const entree = valeur as Record<string, unknown>
  if (typeof entree['releveLe'] !== 'number') return false
  if (!Array.isArray(entree['offerts']) || !entree['offerts'].every(estUnRole)) return false
  if (!Array.isArray(entree['droits'])) return false
  return entree['droits'].every((droit) => {
    if (typeof droit !== 'object' || droit === null) return false
    const champs = droit as Record<string, unknown>
    return estUnRole(champs['role']) && (champs['expireLe'] === null || typeof champs['expireLe'] === 'number')
  })
}
