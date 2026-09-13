/**
 * Relier un second appareil au compte d'un premier.
 *
 * L'écran de la voiture affiche un code, on le scanne avec son téléphone, et cet
 * appareil-là ouvre **le même compte** : les mêmes profils, les mêmes moteurs,
 * les mêmes trajets. Sans adresse, sans mot de passe à retenir, sans service
 * tiers — c'est ce qui en fait le chemin normal.
 *
 * **Le compte anonyme a déjà tout ce qu'il faut.** La bibliothèque d'identité
 * lui a fabriqué une adresse sous le domaine réservé `.invalid`, qui ne désigne
 * aucune boîte ; il suffit de lui poser un mot de passe, et le couple devient un
 * identifiant complet. Aucun courriel ne part, et il n'y en a pas à configurer.
 *
 * **Un code affiché donne le compte à qui le photographie.** C'est assumé : ce
 * qui est en jeu est une bibliothèque de réglages, pas de l'argent. Le code ne
 * reste pas à l'écran, et l'écran le dit. Une deuxième demande **remplace** le
 * mot de passe, ce qui périme le code d'avant : un écran photographié la semaine
 * dernière n'ouvre plus rien dès qu'on en affiche un nouveau.
 */

import { randomBytes } from 'node:crypto'

import { and, eq } from 'drizzle-orm'

import type { Base } from './base/base'
import { accounts, authIdentities } from './base/schema'
import { ceQuePorte } from './heritage'
import type { Identite } from './identite'

/** Le préfixe sous lequel ce module répond. */
export const CHEMIN_LIAISON = '/api/liaison'

/**
 * Le nom que la bibliothèque donne à la preuve « adresse et mot de passe ».
 *
 * Les autres valeurs de cette colonne sont des fournisseurs tiers ; c'est
 * celle-ci, et elle seule, qu'un code de liaison remplace.
 */
const PREUVE_PAR_MOT_DE_PASSE = 'credential'

/**
 * Assez long pour que deviner soit hors de question.
 *
 * Vingt-quatre octets font trente-deux caractères en base64url. Le mot de passe
 * n'est jamais tapé par personne : il voyage dans le code à scanner, et sa
 * longueur ne coûte donc rien à l'usage.
 */
const OCTETS_DU_MOT_DE_PASSE = 24

/** Ce qui ouvre le compte, et qui tient dans un code à scanner. */
export interface CoupleDeLiaison {
  email: string
  motDePasse: string
}

export type CodePose =
  | { etat: 'pose'; couple: CoupleDeLiaison }
  /** Personne n'est connecté : il n'y a pas de compte à relier. */
  | { etat: 'sans-compte' }
  /** Un compte sans adresse ne peut pas se rouvrir ailleurs — voir `solo`. */
  | { etat: 'sans-adresse' }

/**
 * Pose un mot de passe sur le compte de la session, et rend de quoi le rouvrir.
 *
 * `setPassword` est une route réservée au serveur : elle est appelée d'ici, pour
 * la session en cours, et jamais depuis la page. Elle refuse de remplacer un mot
 * de passe existant — d'où la preuve d'abord effacée, qui est aussi ce qui
 * périme le code précédent.
 *
 * **Le compte cesse d'être anonyme.** `is_anonymous` ne dirait plus la vérité :
 * un compte qui a un mot de passe est récupérable, c'est-à-dire exactement le
 * contraire de ce que ce drapeau annonce aux écrans.
 */
export async function poserUnCodeDeLiaison(
  base: Base,
  identite: Identite,
  entetes: Headers,
): Promise<CodePose> {
  const session = await identite.api.getSession({ headers: entetes })
  if (session === null) return { etat: 'sans-compte' }

  const email = session.user.email
  if (typeof email !== 'string' || email === '') return { etat: 'sans-adresse' }

  const motDePasse = randomBytes(OCTETS_DU_MOT_DE_PASSE).toString('base64url')

  await base
    .delete(authIdentities)
    .where(
      and(
        eq(authIdentities.accountId, session.user.id),
        eq(authIdentities.providerId, PREUVE_PAR_MOT_DE_PASSE),
      ),
    )

  await identite.api.setPassword({ body: { newPassword: motDePasse }, headers: entetes })

  await base
    .update(accounts)
    .set({ isAnonymous: false, updatedAt: new Date() })
    .where(eq(accounts.id, session.user.id))

  return { etat: 'pose', couple: { email, motDePasse } }
}

/** Ce qu'est devenu le compte que l'appareil portait avant de se relier. */
export type SortDeLAncien =
  /** Il était vide : effacé, et personne ne le regrettera. */
  | 'efface'
  /** Il portait quelque chose : gardé, et l'écran le dit. */
  | 'garde'
  /** Il n'y en avait pas, ou c'était déjà le même compte. */
  | 'aucun'

export type Liaison =
  | {
      etat: 'reliee'
      /** Les en-têtes de la bibliothèque, témoin de connexion compris. */
      entetes: Headers
      compte: { id: string; name: string; anonymous: boolean }
      ancien: SortDeLAncien
    }
  /** Le couple ne vaut rien : code périmé, ou mal lu. */
  | { etat: 'refusee' }

/**
 * Ouvre le compte désigné par le couple, et règle le sort de celui d'avant.
 *
 * **L'ordre est le sujet.** L'appareil qui se relie porte déjà un compte anonyme
 * — il s'en est créé un au démarrage, comme tout appareil neuf. La preuve qu'il
 * le possède est son témoin de connexion, et ce témoin est remplacé par la
 * connexion : il faut donc décider du sort de l'ancien **dans le même passage**,
 * pendant qu'on tient encore les deux bouts.
 *
 * Un compte vide s'efface : le garder laisserait traîner un compte que personne
 * ne rouvrira jamais. Un compte qui porte quelque chose se garde, et l'écran le
 * dit — c'est à son propriétaire de décider ce qu'il en fait, pas à ce code.
 */
export async function relierAuCompte(
  base: Base,
  identite: Identite,
  entetes: Headers,
  couple: CoupleDeLiaison,
): Promise<Liaison> {
  const avant = await identite.api.getSession({ headers: entetes })

  let ouverture: { headers: Headers; response: { user: { id: string; name: string } } }
  try {
    ouverture = await identite.api.signInEmail({
      body: { email: couple.email, password: couple.motDePasse },
      headers: entetes,
      returnHeaders: true,
    })
  } catch {
    // Un couple refusé n'est pas une panne : c'est un code périmé, le cas
    // ordinaire dès qu'on en a affiché un plus récent.
    return { etat: 'refusee' }
  }

  const compte = ouverture.response.user
  const ancien = await reglerLAncien(base, avant?.user, compte.id)

  const relu = await base.select().from(accounts).where(eq(accounts.id, compte.id))

  return {
    etat: 'reliee',
    entetes: ouverture.headers,
    compte: {
      id: compte.id,
      name: relu[0]?.name ?? compte.name,
      anonymous: relu[0]?.isAnonymous ?? false,
    },
    ancien,
  }
}

async function reglerLAncien(
  base: Base,
  avant: { id: string; isAnonymous?: boolean | null | undefined } | undefined,
  desormais: string,
): Promise<SortDeLAncien> {
  if (avant === undefined || avant.id === desormais) return 'aucun'

  // Un compte qu'on n'a pas créé tout seul ne s'efface pas au passage : il a une
  // adresse, ou un mot de passe, donc quelqu'un peut y revenir.
  if (avant.isAnonymous !== true) return 'garde'

  const porte = await ceQuePorte(base, avant.id)
  const vide =
    porte.profils === 0 &&
    porte.moteurs === 0 &&
    porte.boites === 0 &&
    porte.depots === 0 &&
    porte.droits === 0 &&
    !porte.profilMesure
  if (!vide) return 'garde'

  // La cascade emporte ses sessions et ses preuves. Rien d'autre ne pend à ce
  // compte, puisqu'on vient de vérifier qu'il ne porte rien.
  await base.delete(accounts).where(eq(accounts.id, avant.id))
  return 'efface'
}
