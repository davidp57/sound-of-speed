/**
 * La trace des gestes d'administration.
 *
 * Chaque geste de la régie écrit une ligne : quand, quel administrateur, quel
 * compte, quoi. Y compris la consultation de données sous accord — c'est ce qui
 * rend l'accord sérieux au lieu d'être une case à cocher, puisque celui qui
 * autorise peut voir ce qu'on en a fait.
 *
 * **La ligne ne porte que des identifiants.** Les noms et les adresses se
 * résolvent à la lecture, en joignant les comptes qui existent encore : un compte
 * effacé laisse donc une ligne qui dit toujours ce qui s'est passé, et qui ne
 * garde ni son nom ni son adresse. C'est la raison d'être des identifiants
 * opaques, et ce n'est pas une discipline mais une conséquence du schéma.
 */

import { and, desc, eq, inArray } from 'drizzle-orm'

import type { Base } from './base/base'
import { accounts, adminActions } from './base/schema'

/**
 * Ce qu'un geste peut être.
 *
 * Des valeurs courtes et stables : elles sont écrites en base, et les relire dans
 * six mois demande qu'elles n'aient pas changé de nom entre-temps.
 */
export const GESTES = [
  'role-donne',
  'role-repris',
  'banque-accordee',
  'banque-retiree',
  'assistance-ouverte',
  'assistance-fermee',
  'donnees-lues',
  'compte-efface',
  'retention-forcee',
  'abandon-regle',
  'plafond-pose',
  'plafond-retire',
] as const

export type Geste = (typeof GESTES)[number]

/** Une ligne de trace, telle qu'on la relit. */
export interface LigneDeTrace {
  quand: string
  geste: Geste | string
  detail: string | null
  /** L'administrateur : son identifiant, et son nom s'il existe encore. */
  admin: { id: string; nom: string | null }
  /** Le compte visé, de même. */
  cible: { id: string; nom: string | null }
}

/**
 * Inscrit un geste.
 *
 * **Appelée avant le geste quand celui-ci efface le compte visé.** Non parce que
 * la cascade emporterait la ligne — cette table n'a pas de clé étrangère, c'est
 * tout son intérêt —, mais parce qu'un serveur qui tombe entre les deux doit
 * laisser la trace d'un effacement qui n'a pas eu lieu plutôt qu'un effacement
 * dont il ne reste rien.
 */
export async function inscrire(
  base: Base,
  geste: Geste,
  admin: string,
  cible: string,
  detail?: string,
): Promise<void> {
  await base.insert(adminActions).values({
    id: crypto.randomUUID(),
    adminId: admin,
    targetId: cible,
    action: geste,
    ...(detail === undefined ? {} : { detail }),
    happenedAt: Date.now(),
  })
}

/**
 * Une consultation de données, inscrite **au plus une fois par quart d'heure**.
 *
 * Regarder un compte, c'est ouvrir son inventaire puis une dizaine de ses
 * fichiers : une ligne par requête noierait la trace, et le conducteur y
 * chercherait en vain ce qui s'est passé. Ce qu'il veut lire est « vos données
 * ont été consultées le 14 à 21 h », pas quarante lignes de la même minute.
 *
 * La fenêtre est volontairement large : deux séances vraiment distinctes sont
 * séparées de plus d'un quart d'heure, et deux clics de la même séance ne le
 * sont jamais.
 */
export const FENETRE_DE_CONSULTATION = 15 * 60 * 1000

export async function inscrireUneConsultation(
  base: Base,
  admin: string,
  cible: string,
  maintenant: number = Date.now(),
): Promise<void> {
  const [derniere] = await base
    .select({ quand: adminActions.happenedAt })
    .from(adminActions)
    .where(
      and(
        eq(adminActions.adminId, admin),
        eq(adminActions.targetId, cible),
        eq(adminActions.action, 'donnees-lues'),
      ),
    )
    .orderBy(desc(adminActions.happenedAt))
    .limit(1)

  if (derniere !== undefined && maintenant - derniere.quand < FENETRE_DE_CONSULTATION) return

  await inscrire(base, 'donnees-lues', admin, cible)
}

/**
 * La trace, la plus récente en haut.
 *
 * Sans `cible`, tout ce que la régie a fait ; avec, ce qui concerne ce compte —
 * et c'est ce que son titulaire lit sur son propre écran. **Un compte ne voit
 * jamais une ligne qui en concerne un autre** : le filtre est ici, pas dans
 * l'écran qui l'affiche.
 */
export async function lireLaTrace(
  base: Base,
  options: { cible?: string; combien?: number } = {},
): Promise<LigneDeTrace[]> {
  const lignes = await base
    .select({
      quand: adminActions.happenedAt,
      geste: adminActions.action,
      detail: adminActions.detail,
      admin: adminActions.adminId,
      cible: adminActions.targetId,
    })
    .from(adminActions)
    .where(options.cible === undefined ? undefined : eq(adminActions.targetId, options.cible))
    // À la milliseconde : les gestes arrivent en salve, et « la plus récente en
    // haut » ne veut rien dire si trois d'entre eux partagent la même seconde.
    .orderBy(desc(adminActions.happenedAt), desc(adminActions.id))
    .limit(options.combien ?? 500)

  return avecLesNoms(base, lignes)
}

/**
 * Les noms, quand les comptes existent encore.
 *
 * Un compte effacé rend `null` : la ligne dit toujours qu'un compte a été
 * effacé, par qui et quand, sans conserver l'identité de quelqu'un qu'on vient
 * d'effacer.
 */
async function avecLesNoms(
  base: Base,
  lignes: {
    quand: number
    geste: string
    detail: string | null
    admin: string
    cible: string
  }[],
): Promise<LigneDeTrace[]> {
  const cherches = [...new Set(lignes.flatMap((ligne) => [ligne.admin, ligne.cible]))]
  const noms = new Map<string, string>()

  if (cherches.length > 0) {
    const connus = await base
      .select({ id: accounts.id, nom: accounts.name })
      .from(accounts)
      .where(inArray(accounts.id, cherches))
    for (const connu of connus) noms.set(connu.id, connu.nom)
  }

  return lignes.map((ligne) => ({
    quand: new Date(ligne.quand).toISOString(),
    geste: ligne.geste,
    detail: ligne.detail,
    admin: { id: ligne.admin, nom: noms.get(ligne.admin) ?? null },
    cible: { id: ligne.cible, nom: noms.get(ligne.cible) ?? null },
  }))
}
