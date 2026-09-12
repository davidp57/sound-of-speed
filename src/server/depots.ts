/**
 * Ce que la voiture envoie en roulant : traces, tranches de journal, relevés.
 *
 * C'est le gros du trafic, et c'est là que le modèle de fichiers montrait sa
 * limite. Quand le journal s'est mis à déposer une tranche toutes les cinq
 * minutes, il a fallu l'écarter des traces pour ne pas alourdir leur listage —
 * un contournement d'architecture, déjà payé. Une base n'a pas ce problème, et
 * les quatre dossiers redeviennent une seule chose : un nom, des octets, une
 * date.
 *
 * **Le nom est rendu tel qu'il a été déposé**, extension comprise. Le client
 * décide de décompresser **au nom du fichier**, jamais au type que le serveur
 * annonce : renommer une tranche en chemin la rendrait illisible sans que rien
 * ne le dise.
 */

import { and, eq } from 'drizzle-orm'

import type { Base } from './base/base'
import { deposits } from './base/schema'

/** Les dossiers que la voiture connaît. Tout autre nom n'existe pas. */
export const DOSSIERS = ['traces', 'journal', 'mesures'] as const
export type Dossier = (typeof DOSSIERS)[number]

export function estUnDossier(nom: string): nom is Dossier {
  return (DOSSIERS as readonly string[]).includes(nom)
}

/**
 * Au-delà, une tranche est refusée et **ne doit pas être rejouée**.
 *
 * Le client distingue ce refus d'une panne : sur une panne il réessaie, parfois
 * longtemps. Une tranche trop grosse qu'on refuserait par un code de panne
 * ferait donc réessayer la voiture indéfiniment, pour un envoi qui ne passera
 * jamais.
 *
 * Seize mébioctets : une tranche de journal compressée pèse quelques dizaines de
 * kilo-octets, une trace de trajet entier quelques mégaoctets. La limite protège
 * d'un envoi qui a mal tourné, pas d'un usage ordinaire.
 */
export const CHARGE_MAXIMALE = 16 * 1024 * 1024

export interface Entree {
  name: string
  type: 'file' | 'directory'
}

export async function listerDepots(
  base: Base,
  compte: string,
  dossier: Dossier,
): Promise<Entree[]> {
  const lignes = await base
    .select({ name: deposits.name })
    .from(deposits)
    .where(and(eq(deposits.accountId, compte), eq(deposits.folder, dossier)))

  return lignes
    .map((ligne) => ligne.name)
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ name, type: 'file' as const }))
}

/** Les octets déposés, tels qu'ils sont montés, ou rien. */
export async function lireDepot(
  base: Base,
  compte: string,
  dossier: Dossier,
  nom: string,
): Promise<Buffer | null> {
  const [ligne] = await base
    .select({ content: deposits.content })
    .from(deposits)
    .where(
      and(
        eq(deposits.accountId, compte),
        eq(deposits.folder, dossier),
        eq(deposits.name, nom),
      ),
    )
    .limit(1)

  return ligne?.content ?? null
}

export type Ecriture = 'écrit' | 'trop gros'

/**
 * Range ce qui arrive, et remplace ce qui portait le même nom.
 *
 * Remplacer, et non ajouter : la voiture rejoue un envoi qu'elle croit perdu, et
 * elle le rejoue sous le même nom. Un serveur qui empilerait ferait grossir la
 * base à chaque reprise de réseau, avec des copies identiques.
 *
 * C'est aussi ce qui tient la promesse du ticket : une session déjà déposée
 * n'est pas dupliquée si elle repart.
 */
export async function ecrireDepot(
  base: Base,
  compte: string,
  dossier: Dossier,
  nom: string,
  octets: Buffer,
): Promise<Ecriture> {
  if (octets.byteLength > CHARGE_MAXIMALE) return 'trop gros'

  await base
    .insert(deposits)
    .values({
      id: `${compte}:${dossier}:${nom}`,
      accountId: compte,
      folder: dossier,
      name: nom,
      content: octets,
      bytes: octets.byteLength,
    })
    .onConflictDoUpdate({
      target: [deposits.accountId, deposits.folder, deposits.name],
      set: { content: octets, bytes: octets.byteLength },
    })

  return 'écrit'
}
