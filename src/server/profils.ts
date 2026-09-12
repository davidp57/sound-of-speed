/**
 * La bibliothèque de profils, servie depuis la base.
 *
 * Vu du client, **rien n'a changé** : mêmes adresses, même forme de listage,
 * mêmes codes. C'est la première tranche où une donnée quitte le disque, et
 * c'est la plus sûre pour commencer — un profil est petit, il se relit à l'œil,
 * et le cœur sait déjà le valider.
 *
 * **Le nom de fichier est l'identité.** La bibliothèque dépose « mon-v8.json »,
 * liste, et se sert du nom comme clé. Le serveur le rend donc tel qu'il l'a
 * reçu, sans le dériver du nom du profil : ce serait renommer son fichier dans
 * son dos.
 */

import { and, eq, sql } from 'drizzle-orm'

import type { Base } from './base/base'
import { profiles } from './base/schema'

/**
 * Ce qu'un listage rend, au format de l'autoindex que le cœur attend.
 *
 * **`mtime` n'est pas un ajout, c'est un retour.** L'autoindex JSON de nginx
 * rendait quatre champs — nom, type, date, taille — et la réécriture n'en avait
 * gardé que deux, faute d'en avoir l'usage. L'usage est arrivé : la voiture doit
 * savoir, au lancement, si la base porte plus récent qu'elle sans télécharger
 * chaque fichier pour le comparer. La date est écrite comme nginx l'écrivait.
 */
export interface Entree {
  name: string
  type: 'file' | 'directory'
  mtime: string
}

/** La date, dans la forme que l'autoindex de nginx rendait. */
export function dateHttp(secondes: number): string {
  return new Date(secondes * 1000).toUTCString()
}

export async function listerProfils(base: Base, compte: string): Promise<Entree[]> {
  const lignes = await base
    .select({ fileName: profiles.fileName, updatedAt: profiles.updatedAt })
    .from(profiles)
    .where(eq(profiles.accountId, compte))

  return lignes
    .flatMap((ligne) => (ligne.fileName === null ? [] : [ligne]))
    .sort((a, b) => (a.fileName ?? '').localeCompare(b.fileName ?? ''))
    .map((ligne) => ({
      name: ligne.fileName ?? '',
      type: 'file' as const,
      mtime: dateHttp(ligne.updatedAt),
    }))
}

/** Le contenu d'un profil, tel qu'il a été déposé, ou rien. */
export async function lireProfil(
  base: Base,
  compte: string,
  nomDeFichier: string,
): Promise<string | null> {
  const [ligne] = await base
    .select({ content: profiles.content })
    .from(profiles)
    .where(and(eq(profiles.accountId, compte), eq(profiles.fileName, nomDeFichier)))
    .limit(1)

  if (ligne === undefined) return null
  return JSON.stringify(ligne.content)
}

/**
 * Écrit un profil, et remplace celui qui portait le même nom.
 *
 * Remplacer, et non ajouter : c'est ce que faisait le dépôt de fichiers, et ce
 * que la bibliothèque attend quand elle renvoie un profil qu'elle a modifié.
 *
 * Le contenu est gardé tel qu'il arrive. On ne le valide pas ici : le cœur le
 * fait déjà à la lecture, chez celui qui s'en sert, et il est la seule autorité
 * sur la forme d'un profil. Un serveur qui validerait aussi ferait une seconde
 * description à tenir d'accord avec la première.
 */
export async function ecrireProfil(
  base: Base,
  compte: string,
  nomDeFichier: string,
  contenu: string,
): Promise<'écrit' | 'illisible'> {
  let lu: unknown
  try {
    lu = JSON.parse(contenu)
  } catch {
    // Le seul refus : ce qui n'est pas du JSON ne se relira jamais. Le laisser
    // entrer rendrait la bibliothèque muette pour un fichier, sans rien dire.
    return 'illisible'
  }

  const nom = nomLisible(lu, nomDeFichier)

  await base
    .insert(profiles)
    .values({
      id: `${compte}:${nomDeFichier}`,
      accountId: compte,
      name: nom,
      fileName: nomDeFichier,
      content: lu,
    })
    .onConflictDoUpdate({
      target: [profiles.accountId, profiles.fileName],
      // La date est refaite à chaque écriture. Sans elle, la règle du plus
      // récent n'arbitre rien : une colonne qui ne bouge jamais rend toujours le
      // même verdict, et un profil réglé dans la voiture passerait pour ancien.
      set: { name: nom, content: lu, updatedAt: sql`(unixepoch())` },
    })

  return 'écrit'
}

/** Le nom qui s'affichera, pris dans le profil s'il en porte un. */
function nomLisible(profil: unknown, repli: string): string {
  if (typeof profil === 'object' && profil !== null && 'name' in profil) {
    const nom = (profil as { name?: unknown }).name
    if (typeof nom === 'string' && nom.trim() !== '') return nom
  }
  return repli.replace(/\.json$/i, '')
}
