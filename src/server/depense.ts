/**
 * Ce que le serveur dépense, pour que les bornes ne s'inventent pas.
 *
 * Les rôles existent pour limiter ce que coûte un compte, et personne ne sait ce
 * que le serveur coûte. Un seuil posé sans chiffre refuse des dépôts légitimes
 * ou laisse le disque se remplir, et ni l'un ni l'autre ne fait rougir quoi que
 * ce soit — c'est exactement le genre d'erreur que la porte de qualité ne voit
 * pas.
 *
 * **Un relevé est une différence, jamais un cumul.** Un compteur depuis le
 * démarrage divisé par une durée ne dit rien de ce qui se passe : un serveur
 * allumé depuis trois mois montrerait une moyenne où il faut une tendance. Le
 * relevé remet donc ses compteurs à zéro, et chaque ligne du journal parle de la
 * période qu'elle couvre.
 *
 * Ce module ne décide de rien. Il compte, et c'est le ticket suivant qui posera
 * une borne à partir de ce qu'il aura dit.
 */

import { statSync } from 'node:fs'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

import { desc, sql } from 'drizzle-orm'

import type { Base } from './base/base'
import { deposits, expenseReports } from './base/schema'

/** Ce qu'une période a coûté. Des différences, pas des totaux depuis toujours. */
export interface Depense {
  /** Depuis quand on compte, en millisecondes. */
  depuis: number
  /** Les octets d'échantillons offerts au réseau, et le nombre de demandes. */
  echantillons: { octets: number; demandes: number }
  /** Le temps passé à analyser des traces, et combien ont été analysées. */
  analyse: { millisecondes: number; traces: number }
}

export interface CompteurDeDepense {
  /** Un échantillon vient de partir. La taille est celle qu'on a annoncée. */
  echantillonServi: (octets: number) => void
  /** Une trace vient d'être analysée, et ça a pris ce temps-là. */
  traceAnalysee: (millisecondes: number) => void
  /** Ce que la période a coûté, et on repart de zéro. */
  releverEtRepartir: (maintenant?: number) => Depense
}

export function compteurDeDepense(maintenant = Date.now()): CompteurDeDepense {
  let depuis = maintenant
  let octets = 0
  let demandes = 0
  let millisecondes = 0
  let traces = 0

  return {
    echantillonServi: (combien) => {
      octets += combien
      demandes += 1
    },
    traceAnalysee: (combien) => {
      millisecondes += combien
      traces += 1
    },
    releverEtRepartir: (quand = Date.now()) => {
      const depense: Depense = {
        depuis,
        echantillons: { octets, demandes },
        analyse: { millisecondes, traces },
      }
      depuis = quand
      octets = 0
      demandes = 0
      millisecondes = 0
      traces = 0
      return depense
    },
  }
}

/** Ce que la base porte, compte par compte. */
export interface PoidsDesComptes {
  /** Le fichier de base lui-même, tel qu'il est sur le disque. */
  fichier: number
  /** Les octets déposés, par compte, du plus lourd au plus léger. */
  parCompte: { compte: string; octets: number }[]
}

export async function poidsDesComptes(base: Base, fichierDeBase: string): Promise<PoidsDesComptes> {
  const lignes = await base
    .select({
      compte: deposits.accountId,
      octets: sql<number>`coalesce(sum(${deposits.bytes}), 0)`,
    })
    .from(deposits)
    .groupBy(deposits.accountId)

  return {
    fichier: tailleDe(fichierDeBase),
    parCompte: [...lignes].sort((a, b) => b.octets - a.octets),
  }
}

/**
 * Ce que pèsent les banques d'échantillons sur le disque.
 *
 * Parcouru une fois par jour, et pas plus : c'est une arborescence de fichiers,
 * et la mesurer à chaque requête coûterait plus cher que ce qu'elle mesure.
 */
export function poidsDesBanques(racine: string | undefined): { octets: number; banques: number } {
  if (racine === undefined) return { octets: 0, banques: 0 }

  let octets = 0
  let banques = 0
  for (const entree of entreesDe(racine)) {
    if (!entree.isDirectory()) continue
    banques += 1
    octets += poidsDuDossier(join(racine, entree.name))
  }
  return { octets, banques }
}

/**
 * La ligne qu'on lira dans le journal du conteneur.
 *
 * Une seule, et elle porte les quatre chiffres : c'est ce qui la rend lisible
 * une semaine plus tard sans avoir à recoller des relevés épars.
 */
export function formaterDepense(
  depense: Depense,
  banques: { octets: number; banques: number },
  comptes: PoidsDesComptes,
  maintenant = Date.now(),
): string {
  const heures = Math.max((maintenant - depense.depuis) / 3_600_000, 0.001)
  const parTrace =
    depense.analyse.traces === 0
      ? 'aucune trace'
      : `${Math.round(depense.analyse.millisecondes / depense.analyse.traces)} ms par trace sur ${depense.analyse.traces}`

  const lourds = comptes.parCompte
    .slice(0, 3)
    .map(({ compte, octets }) => `${compte.slice(0, 8)}… ${enMio(octets)}`)
    .join(', ')

  return [
    `dépense sur ${heures.toFixed(1)} h :`,
    `échantillons ${enMio(depense.echantillons.octets)} en ${depense.echantillons.demandes} demandes`,
    `| banques ${enMio(banques.octets)} en ${banques.banques} dossiers`,
    `| base ${enMio(comptes.fichier)}${lourds === '' ? '' : ` (${lourds})`}`,
    `| analyse ${parTrace}`,
  ].join(' ')
}

function enMio(octets: number): string {
  return `${(octets / (1024 * 1024)).toFixed(1)} Mio`
}

function tailleDe(chemin: string): number {
  try {
    return statSync(chemin).size
  } catch {
    // Un fichier absent n'est pas une panne : on ne sait pas, on dit zéro.
    return 0
  }
}

function entreesDe(chemin: string) {
  try {
    return readdirSync(chemin, { withFileTypes: true })
  } catch {
    return []
  }
}

function poidsDuDossier(chemin: string): number {
  let octets = 0
  for (const entree of entreesDe(chemin)) {
    const dedans = join(chemin, entree.name)
    octets += entree.isDirectory() ? poidsDuDossier(dedans) : tailleDe(dedans)
  }
  return octets
}

/**
 * Un relevé écrit en base, pour qu'il survive au conteneur.
 *
 * Le journal du conteneur était le seul endroit où la ligne partait, et il
 * disparaît avec lui. Le 17 septembre 2026, David a constaté que `docker logs`
 * ne rendait rien : la pile est redéployée plusieurs fois par jour, donc les
 * vingt-quatre heures ne sont jamais atteintes, et le relevé d'adieu meurt dans
 * le journal du conteneur qu'on remplace. La ligne reste écrite au journal — elle
 * est commode quand on regarde un conteneur qui tourne — mais ce n'est plus elle
 * qui porte la mémoire.
 */
export type MotifDuReleve = 'periodique' | 'arret'

export interface ReleveEnregistre {
  /** Bornes de la période, en millisecondes. */
  depuis: number
  jusqua: number
  echantillons: { octets: number; demandes: number }
  analyse: { millisecondes: number; traces: number }
  banques: { octets: number; banques: number }
  base: { octets: number }
  motif: MotifDuReleve
}

export async function enregistrerLaDepense(
  base: Base,
  depense: Depense,
  banques: { octets: number; banques: number },
  comptes: PoidsDesComptes,
  motif: MotifDuReleve,
  maintenant = Date.now(),
): Promise<void> {
  await base.insert(expenseReports).values({
    id: crypto.randomUUID(),
    since: depense.depuis,
    until: maintenant,
    sampleBytes: depense.echantillons.octets,
    sampleRequests: depense.echantillons.demandes,
    analysisMs: Math.round(depense.analyse.millisecondes),
    analysisTraces: depense.analyse.traces,
    bankBytes: banques.octets,
    bankCount: banques.banques,
    databaseBytes: comptes.fichier,
    reason: motif,
  })
}

/**
 * Les derniers relevés, le plus récent en tête.
 *
 * Borné par défaut : on lit une tendance sur quelques jours, pas l'histoire du
 * serveur. Une ligne par heure fait vingt-quatre lignes par jour.
 */
export async function lireLesDepenses(base: Base, limite = 72): Promise<ReleveEnregistre[]> {
  const lignes = await base
    .select()
    .from(expenseReports)
    .orderBy(desc(expenseReports.until))
    .limit(limite)

  return lignes.map((l) => ({
    depuis: l.since,
    jusqua: l.until,
    echantillons: { octets: l.sampleBytes, demandes: l.sampleRequests },
    analyse: { millisecondes: l.analysisMs, traces: l.analysisTraces },
    banques: { octets: l.bankBytes, banques: l.bankCount },
    base: { octets: l.databaseBytes },
    motif: l.reason === 'arret' ? 'arret' : 'periodique',
  }))
}
