/**
 * Les moteurs et les boîtes, servis depuis la base.
 *
 * Leurs tables existaient depuis le schéma initial et rien ne les remplissait :
 * elles n'avaient aucun chemin pour y aller. C'est le dernier morceau qui manque
 * avant que le stockage du navigateur cesse d'être le seul dépositaire des
 * réglages — un profil désigne un moteur et une boîte, et un profil qui remonte
 * seul désigne dans le vide.
 *
 * **Même forme que la bibliothèque de profils**, et c'est délibéré : mêmes
 * codes, même listage, même règle du nom de fichier qui fait l'identité. Le cœur
 * lit déjà cette forme à quatre endroits ; en inventer une seconde pour ces deux
 * dossiers-là donnerait deux façons de lire une liste.
 *
 * **Un moteur et une boîte ont la même forme en base** — un nom, un contenu, une
 * date — parce que ce sont deux groupes de réglages qu'un profil assemble. Le
 * code les traite donc ensemble plutôt qu'en double.
 */

import { and, eq, sql } from 'drizzle-orm'

import type { Base } from './base/base'
import { engines, gearboxes } from './base/schema'

/** Les deux registres, tels qu'ils s'écrivent dans une adresse. */
export const REGISTRES = ['engines', 'gearboxes'] as const
export type Registre = (typeof REGISTRES)[number]

export function estUnRegistre(nom: string): nom is Registre {
  return (REGISTRES as readonly string[]).includes(nom)
}

/** Ce qu'un listage rend, au format de l'autoindex que le cœur attend. */
export interface Entree {
  name: string
  type: 'file' | 'directory'
}

function tableDe(registre: Registre) {
  return registre === 'engines' ? engines : gearboxes
}

export async function listerEntites(
  base: Base,
  registre: Registre,
  compte: string,
): Promise<Entree[]> {
  const table = tableDe(registre)
  const lignes = await base.select({ id: table.id }).from(table).where(eq(table.accountId, compte))

  return lignes
    .map((ligne) => nomDeFichierDe(ligne.id, compte))
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ name, type: 'file' as const }))
}

/** Le contenu d'une entité, telle qu'elle a été déposée, ou rien. */
export async function lireEntite(
  base: Base,
  registre: Registre,
  compte: string,
  nomDeFichier: string,
): Promise<string | null> {
  const table = tableDe(registre)
  const [ligne] = await base
    .select({ content: table.content })
    .from(table)
    .where(and(eq(table.accountId, compte), eq(table.id, identifiantDe(nomDeFichier, compte))))
    .limit(1)

  if (ligne === undefined) return null
  return JSON.stringify(ligne.content)
}

/**
 * Écrit une entité, et remplace celle qui portait le même nom.
 *
 * Remplacer, et non ajouter : la voiture rejoue un envoi qu'elle croit perdu, et
 * elle le rejoue sous le même nom. C'est aussi ce que veut dire « corriger un
 * moteur une fois pour tous les profils qui le désignent ».
 *
 * **La date de modification est refaite à chaque écriture.** Sans elle, la règle
 * du plus récent n'arbitre rien : une colonne qui ne bouge jamais donne toujours
 * le même verdict.
 *
 * Le contenu est gardé tel qu'il arrive. Le cœur est la seule autorité sur la
 * forme d'un moteur ; un serveur qui validerait aussi ferait une seconde
 * description à tenir d'accord avec la première.
 */
export async function ecrireEntite(
  base: Base,
  registre: Registre,
  compte: string,
  nomDeFichier: string,
  contenu: string,
): Promise<'écrit' | 'illisible'> {
  let lu: unknown
  try {
    lu = JSON.parse(contenu)
  } catch {
    // Ce qui n'est pas du JSON ne se relira jamais. Le laisser entrer rendrait
    // le registre muet pour cette entrée, sans rien dire.
    return 'illisible'
  }

  const id = identifiantDe(nomDeFichier, compte)
  const nom = nomLisible(lu, nomDeFichier)
  const maintenant = sql`(unixepoch())`

  if (registre === 'engines') {
    await base
      .insert(engines)
      .values({ id, accountId: compte, name: nom, content: lu })
      .onConflictDoUpdate({
        target: engines.id,
        set: { name: nom, content: lu, updatedAt: maintenant },
      })
  } else {
    await base
      .insert(gearboxes)
      .values({ id, accountId: compte, name: nom, content: lu })
      .onConflictDoUpdate({
        target: gearboxes.id,
        set: { name: nom, content: lu, updatedAt: maintenant },
      })
  }

  return 'écrit'
}

/**
 * Le nom de fichier fait l'identité, comme pour un profil.
 *
 * L'identifiant en base porte le compte devant, parce qu'il est unique pour
 * toute la table ; le nom de fichier, lui, est ce que le client manipule et il
 * ne connaît pas les comptes. La conversion est donc un simple préfixe, et non
 * une dérivation qui renommerait le fichier dans le dos de celui qui l'a déposé.
 */
function identifiantDe(nomDeFichier: string, compte: string): string {
  return `${compte}:${nomDeFichier}`
}

function nomDeFichierDe(identifiant: string, compte: string): string {
  const prefixe = `${compte}:`
  return identifiant.startsWith(prefixe) ? identifiant.slice(prefixe.length) : identifiant
}

/** Le nom qui s'affichera, pris dans l'entité si elle en porte un. */
function nomLisible(entite: unknown, repli: string): string {
  if (typeof entite === 'object' && entite !== null && 'name' in entite) {
    const nom = (entite as { name?: unknown }).name
    if (typeof nom === 'string' && nom.trim() !== '') return nom
  }
  return repli.replace(/\.json$/i, '')
}
