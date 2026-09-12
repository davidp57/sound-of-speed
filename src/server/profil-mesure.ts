/**
 * Ce que le serveur apprend de la vraie voiture, sans plus scruter un disque.
 *
 * Un service séparé relisait le dossier des traces toutes les cinq secondes pour
 * découvrir ce qui s'y trouvait. Il était en Node précisément parce qu'il importe
 * cinq modules du cœur — son propre fichier de construction le donne pour raison
 * d'être. Une fois le serveur écrit dans le même langage et les dépôts rangés en
 * base, il n'y a plus rien à découvrir : **c'est le serveur qui écrit la trace,
 * donc il sait qu'elle est arrivée**.
 *
 * **Le calcul ne change pas.** Le profileur travaille sur deux méthodes — lister,
 * lire — et on lui en donne une version adossée à la base. Ce module déplace un
 * déclencheur ; il ne touche pas à une mesure.
 */

import { eq, and } from 'drizzle-orm'

import { emptyAggregate, type CarAggregate } from '../core/calibration/aggregate'

import type { Base } from './base/base'
import { deposits, measuredCars } from './base/schema'
import { rebuild, updateWith, type Folder, type ProfileResult } from './profileur/profileur'

/** Les traces, vues comme le dossier que le profileur sait lire. */
export function dossierDesTraces(base: Base, compte: string): Folder {
  return {
    list: async () => {
      const lignes = await base
        .select({ name: deposits.name })
        .from(deposits)
        .where(and(eq(deposits.accountId, compte), eq(deposits.folder, 'traces')))
      return lignes.map((ligne) => ligne.name)
    },
    read: async (nom) => {
      const [ligne] = await base
        .select({ content: deposits.content })
        .from(deposits)
        .where(
          and(
            eq(deposits.accountId, compte),
            eq(deposits.folder, 'traces'),
            eq(deposits.name, nom),
          ),
        )
        .limit(1)
      if (ligne === undefined) throw new Error(`trace absente : ${nom}`)
      return new Uint8Array(ligne.content)
    },
  }
}

/** Le profil mesuré d'un compte, tel qu'il a été cumulé, ou rien. */
export async function lireProfilMesure(base: Base, compte: string): Promise<string | null> {
  const [ligne] = await base
    .select({ content: measuredCars.content })
    .from(measuredCars)
    .where(eq(measuredCars.accountId, compte))
    .limit(1)

  if (ligne === undefined) return null
  return JSON.stringify(ligne.content)
}

async function agregatDe(base: Base, compte: string): Promise<CarAggregate> {
  const [ligne] = await base
    .select({ content: measuredCars.content })
    .from(measuredCars)
    .where(eq(measuredCars.accountId, compte))
    .limit(1)

  const contenu = ligne?.content as { aggregate?: CarAggregate } | undefined
  return contenu?.aggregate ?? emptyAggregate()
}

/**
 * Reprend ce qu'une trace vient d'apprendre, et le range.
 *
 * Appelé quand une tranche arrive, et non sur une horloge. Le profileur relit
 * alors le seul trajet que cette tranche complète — relire l'historique entier à
 * chaque dépôt tient aujourd'hui et ne tiendra pas dans six mois.
 */
export async function reprendreApresDepot(
  base: Base,
  compte: string,
  nomDeLaTranche: string,
): Promise<ProfileResult> {
  const dossier = dossierDesTraces(base, compte)
  const resultat = await updateWith(dossier, await agregatDe(base, compte), nomDeLaTranche)
  await ecrireProfilMesure(base, compte, resultat)
  return resultat
}

/**
 * Reprend tout depuis le début.
 *
 * Sert au démarrage : une trace déposée pendant que le serveur était arrêté n'a
 * déclenché aucune reprise, et serait perdue pour la mesure sans ce rattrapage.
 * Le profileur décide lui-même s'il doit tout relire — un procédé corrigé rend
 * l'ancien cumul sans valeur.
 */
export async function reprendreTout(base: Base, compte: string): Promise<ProfileResult> {
  const resultat = await rebuild(dossierDesTraces(base, compte))
  await ecrireProfilMesure(base, compte, resultat)
  return resultat
}

/**
 * Écrit le profil mesuré, dans la forme que le client lit déjà.
 *
 * Les quatre champs sont ceux que l'écran de proposition attend, et ce module
 * n'en invente aucun : il déplace l'endroit où ils sont écrits, pas ce qu'ils
 * contiennent.
 */
async function ecrireProfilMesure(
  base: Base,
  compte: string,
  resultat: ProfileResult,
): Promise<void> {
  const contenu = {
    procedure: resultat.aggregate.procedure,
    updatedAt: new Date().toISOString(),
    aggregate: resultat.aggregate,
    coverage: resultat.coverage,
  }

  await base
    .insert(measuredCars)
    .values({ accountId: compte, content: contenu })
    .onConflictDoUpdate({ target: measuredCars.accountId, set: { content: contenu } })
}
