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

import { and, eq, inArray, isNull } from 'drizzle-orm'

import { recordedAtOf } from '../core/upload/slice-name'

import type { Base } from './base/base'
import { deposits } from './base/schema'
import { dateHttp, type Entree } from './profils'

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

/** La même forme que les autres listages, date comprise. */
export type { Entree } from './profils'

export async function listerDepots(
  base: Base,
  compte: string,
  dossier: Dossier,
): Promise<Entree[]> {
  const lignes = await base
    .select({
      name: deposits.name,
      depositedAt: deposits.depositedAt,
      recordedAt: deposits.recordedAt,
    })
    .from(deposits)
    .where(and(eq(deposits.accountId, compte), eq(deposits.folder, dossier)))

  return lignes
    .map((ligne) => ({
      name: ligne.name,
      type: 'file' as const,
      // La date du trajet, pas celle de l'arrivée : les quatre-vingt-quatorze
      // dépôts de la reprise prétendent tous dater de l'heure où elle a tourné,
      // et un listage qui le répéterait ferait croire à quatre-vingt-quatorze
      // trajets du même soir.
      mtime: dateHttp(ligne.recordedAt ?? ligne.depositedAt),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
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
 * Ce qui exempte un dépôt de l'effacement.
 *
 * `epingle` est un choix de l'utilisateur, et il est borné. `archive` est un
 * fait — ces trajets viennent d'un ancien serveur — et il ne l'est pas.
 */
export type Exemption = 'epingle' | 'archive'

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
  /**
   * Ce qui remonte d'une reprise entre **archivé**.
   *
   * Une trace enregistrée il y a trois mois et remontée aujourd'hui n'est pas un
   * dépôt ordinaire : c'est un déménagement. Sans exemption, la règle de
   * rétention l'effacerait un mois plus tard, et on l'aurait déplacée pour la
   * perdre. Archivée, et non épinglée : l'épingle est un choix, et elle est
   * bornée — quatorze sessions déménagées rempliraient la borne avant la
   * première épingle.
   *
   * Un dépôt ordinaire, lui, n'exempte rien et ne **dés**exempte rien :
   * redéposer une trace reprise ne doit pas lui retirer sa protection, pas plus
   * qu'un nouvel envoi ne doit décrocher une épingle posée à la main.
   */
  exemption?: Exemption,
): Promise<Ecriture> {
  if (octets.byteLength > CHARGE_MAXIMALE) return 'trop gros'

  const enregistreLe = dateDEnregistrement(nom)

  await base
    .insert(deposits)
    .values({
      id: `${compte}:${dossier}:${nom}`,
      accountId: compte,
      folder: dossier,
      name: nom,
      content: octets,
      bytes: octets.byteLength,
      ...(enregistreLe === null ? {} : { recordedAt: enregistreLe }),
      ...(exemption === undefined ? {} : { exemption }),
    })
    .onConflictDoUpdate({
      target: [deposits.accountId, deposits.folder, deposits.name],
      set: {
        content: octets,
        bytes: octets.byteLength,
        ...(enregistreLe === null ? {} : { recordedAt: enregistreLe }),
        ...(exemption === undefined ? {} : { exemption }),
        // Une trace qu'on redépose repart à l'analyse : ce n'est plus la même,
        // et la marque de l'ancienne ne dit plus rien de celle-ci.
        analyzedProcedure: null,
      },
    })

  return 'écrit'
}

/**
 * La date du trajet, en secondes, tirée du nom de la tranche.
 *
 * Le cœur sait lire le nom ; il rend des millisecondes, la base compte en
 * secondes comme toutes ses autres dates. Rend `null` sur un nom libre — la
 * date de dépôt prendra le relais.
 */
function dateDEnregistrement(nom: string): number | null {
  const ms = recordedAtOf(nom)
  return ms === null ? null : Math.floor(ms / 1000)
}

/**
 * Donne sa date de trajet à ce qui est entré avant qu'elle existe.
 *
 * Les dépôts déjà en base n'ont que leur date d'arrivée, et les
 * quatre-vingt-quatorze de la reprise prétendent tous dater de l'heure où elle a
 * tourné. On la relit dans leur nom, une fois, au démarrage.
 *
 * **Un nom libre reçoit sa date de dépôt**, et c'est un choix plutôt qu'un trou :
 * deux traces anciennes n'ont pas de date lisible, elles sont archivées, et rien
 * ne les effacera. Une colonne laissée vide obligerait tout ce qui lit cette
 * date à se demander ce que veut dire « pas de date ».
 *
 * Sans effet au second appel : seules les lignes sans date sont touchées.
 */
export async function remplirLesDatesDEnregistrement(base: Base): Promise<number> {
  const lignes = await base
    .select({ id: deposits.id, name: deposits.name, depositedAt: deposits.depositedAt })
    .from(deposits)
    .where(isNull(deposits.recordedAt))

  for (const ligne of lignes) {
    await base
      .update(deposits)
      .set({ recordedAt: dateDEnregistrement(ligne.name) ?? ligne.depositedAt })
      .where(eq(deposits.id, ligne.id))
  }

  return lignes.length
}

/**
 * Marque des dépôts comme regardés par le profileur.
 *
 * Le numéro du procédé, et non un simple oui : le profileur relit tout quand son
 * procédé change, et une marque posée par l'ancien ne dit plus la vérité. C'est
 * ce numéro qui la rend caduque toute seule, sans qu'il faille repasser effacer
 * quoi que ce soit.
 *
 * Ce qui a été **écarté** est marqué comme le reste : une session trop courte a
 * été regardée, elle ne montre rien, et elle est effaçable. C'est une session
 * jamais soumise au profileur qui ne l'est pas.
 */
export async function marquerAnalyses(
  base: Base,
  compte: string,
  noms: readonly string[],
  procede: number,
): Promise<void> {
  if (noms.length === 0) return

  // Par paquets : SQLite plafonne le nombre de paramètres d'une requête, et un
  // rattrapage au démarrage passe ici avec tout ce que la base porte.
  for (let debut = 0; debut < noms.length; debut += 200) {
    await base
      .update(deposits)
      .set({ analyzedProcedure: procede })
      .where(
        and(
          eq(deposits.accountId, compte),
          eq(deposits.folder, 'traces'),
          inArray(deposits.name, noms.slice(debut, debut + 200)),
        ),
      )
  }
}
