/**
 * Reprendre ce qui dort dans les anciens dossiers du NAS.
 *
 * Le serveur de fichiers rangeait tout sur un disque : les traces, les tranches
 * de journal, les relevés, les profils. Ces fichiers sont toujours là et
 * personne ne les lit plus. Ce module les verse en base, une fois, au démarrage.
 *
 * **Elle ne touche pas à la source.** On ouvre en lecture, jamais en écriture,
 * et le dossier est monté en lecture seule — c'est le montage qui en est la
 * garantie, pas cette phrase. Une reprise qui efface au fur et à mesure est une
 * reprise qu'on ne peut pas relancer.
 *
 * **Elle n'écrase jamais ce qui est déjà en base.** Au premier passage la base
 * est vide et la règle ne se voit pas ; à tous les suivants, elle empêche un
 * profil du disque d'effacer celui qu'on aura réglé entre-temps dans la voiture.
 * C'est aussi ce qui la rend rejouable : relancée, elle n'écrit rien.
 *
 * **Ce qui entre est épinglé.** Les traces, mais aussi le journal et les
 * relevés : la raison vaut pour les trois. La règle de rétention effacerait un
 * mois plus tard ce qu'on vient de déplacer, et on aurait déménagé des données
 * pour les perdre. La spec du lot ne nommait que les traces ; l'argument ne les
 * distingue pas.
 *
 * **Le profil mesuré n'est pas repris.** Le serveur le recalcule depuis les
 * traces qu'il a en base, à chaque démarrage. Copier l'ancien fichier
 * installerait un cumul produit par un procédé qui a changé depuis — ce que le
 * profileur dit lui-même de l'ancien cumul.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import type { Base } from './base/base'
import { deposits, profiles } from './base/schema'
import { CHARGE_MAXIMALE, DOSSIERS, lireDepot, type Dossier } from './depots'
import { lireProfil } from './profils'

/** Le dossier des profils sur le disque, qui n'est pas un dossier de dépôts. */
const DOSSIER_DES_PROFILS = 'profiles'

/**
 * Le dossier qu'on laisse volontairement où il est.
 *
 * Il porte le cumul de mesure, qui se refait tout seul une fois les traces
 * entrées. Le nommer ici sert au décompte : « ignoré » est une réponse,
 * « absent » n'en est pas une.
 */
const DOSSIER_RECALCULE = 'mesure-voiture'

export interface RepriseDunDossier {
  dossier: string
  /** Fichiers vus sur le disque. */
  trouves: number
  /** Fichiers entrés en base à ce passage. */
  entres: number
  /**
   * Ceux que la base portait déjà, à l'identique.
   *
   * Comptés, pas nommés : c'est le cas normal d'une reprise relancée, et en
   * nommer quatre-vingt-quatorze noierait la seule ligne qui compte.
   */
  identiques: number
  /**
   * Ceux que la base portait déjà, **avec un autre contenu**, et qu'on n'a pas
   * écrasés.
   *
   * Nommés, eux : c'est le seul endroit où le disque et la base disent deux
   * choses différentes, et c'est là qu'on veut regarder.
   */
  differents: string[]
  /** Ceux qu'on n'a pas su prendre, et pourquoi. */
  ecartes: { nom: string; raison: string }[]
  /** Octets effectivement entrés. */
  octets: number
}

/**
 * Verse les anciens dossiers dans la base, et rend ce qu'elle a fait.
 *
 * Un dossier absent n'est pas une panne : les cinq n'ont pas tous servi, et
 * celui des relevés est vide sur le NAS. Il rend alors zéro trouvé, ce qui se
 * lit très bien au décompte.
 */
export async function reprendreLesDossiers(
  base: Base,
  compte: string,
  racine: string,
): Promise<RepriseDunDossier[]> {
  const reprises: RepriseDunDossier[] = []

  for (const dossier of DOSSIERS) {
    reprises.push(await reprendreDesDepots(base, compte, racine, dossier))
  }
  reprises.push(await reprendreDesProfils(base, compte, racine))

  const recalcule = vide(DOSSIER_RECALCULE)
  recalcule.trouves = fichiersDe(join(racine, DOSSIER_RECALCULE)).length
  if (recalcule.trouves > 0) {
    recalcule.ecartes.push({
      nom: 'tout le dossier',
      raison: 'ignoré, le cumul se recalcule depuis les traces',
    })
  }
  reprises.push(recalcule)

  return reprises
}

async function reprendreDesDepots(
  base: Base,
  compte: string,
  racine: string,
  dossier: Dossier,
): Promise<RepriseDunDossier> {
  const reprise = vide(dossier)

  for (const nom of fichiersDe(join(racine, dossier))) {
    reprise.trouves += 1
    const octets = readFileSync(join(racine, dossier, nom))

    if (octets.byteLength > CHARGE_MAXIMALE) {
      reprise.ecartes.push({ nom, raison: 'plus gros que la charge maximale' })
      continue
    }

    const dejaLa = await lireDepot(base, compte, dossier, nom)
    if (dejaLa !== null) {
      if (dejaLa.equals(octets)) reprise.identiques += 1
      else reprise.differents.push(nom)
      continue
    }

    await base.insert(deposits).values({
      id: `${compte}:${dossier}:${nom}`,
      accountId: compte,
      folder: dossier,
      name: nom,
      content: octets,
      bytes: octets.byteLength,
      pinned: true,
    })

    reprise.entres += 1
    reprise.octets += octets.byteLength
  }

  return reprise
}

/**
 * Les profils, qui ne sont pas des dépôts.
 *
 * Le nom de fichier reste l'identité : c'est par lui que la bibliothèque les
 * désigne, et leur donner un nom dérivé d'autre chose reviendrait à renommer
 * leur fichier dans leur dos.
 */
async function reprendreDesProfils(
  base: Base,
  compte: string,
  racine: string,
): Promise<RepriseDunDossier> {
  const reprise = vide(DOSSIER_DES_PROFILS)

  for (const nom of fichiersDe(join(racine, DOSSIER_DES_PROFILS))) {
    reprise.trouves += 1
    const brut = readFileSync(join(racine, DOSSIER_DES_PROFILS, nom))

    let lu: unknown
    try {
      lu = JSON.parse(brut.toString('utf8'))
    } catch {
      // Un fichier qui n'est pas du JSON ne se relira jamais. L'entrer rendrait
      // la bibliothèque muette pour lui, sans rien dire.
      reprise.ecartes.push({ nom, raison: 'illisible' })
      continue
    }

    const dejaLa = await lireProfil(base, compte, nom)
    if (dejaLa !== null) {
      // Comparés sur leur forme rangée, et non sur les octets du fichier : un
      // JSON réindenté est le même profil, et le signaler comme un désaccord
      // enverrait regarder là où il n'y a rien.
      if (dejaLa === JSON.stringify(lu)) reprise.identiques += 1
      else reprise.differents.push(nom)
      continue
    }

    await base.insert(profiles).values({
      id: `${compte}:${nom}`,
      accountId: compte,
      name: nomLisible(lu, nom),
      fileName: nom,
      content: lu,
    })

    reprise.entres += 1
    reprise.octets += brut.byteLength
  }

  return reprise
}

/**
 * Le décompte, tel qu'il s'imprime au démarrage.
 *
 * C'est la seule trace qu'il restera de la reprise : elle se joue une fois, sur
 * un serveur que personne ne regarde, et ce texte est ce qui permet de dire
 * qu'elle a bien tout pris.
 */
export function formaterDecompte(racine: string, reprises: RepriseDunDossier[]): string {
  const lignes = [`reprise des anciens dossiers : ${racine}`]

  for (const reprise of reprises) {
    const details = [`${reprise.trouves} trouvé(s)`, `${reprise.entres} entré(s)`]
    if (reprise.identiques > 0) details.push(`${reprise.identiques} déjà en base, identique(s)`)
    if (reprise.differents.length > 0) details.push(`${reprise.differents.length} en désaccord`)
    if (reprise.ecartes.length > 0) details.push(`${reprise.ecartes.length} écarté(s)`)
    if (reprise.octets > 0) details.push(`${Math.round(reprise.octets / 1024)} Kio`)
    lignes.push(`  ${reprise.dossier} : ${details.join(', ')}`)

    // Nommés, et pas seulement comptés : ce sont les seuls endroits où le disque
    // et la base disent deux choses différentes, et c'est là qu'on veut
    // regarder. Le reste se compte et se tait.
    for (const nom of reprise.differents) {
      lignes.push(`    en base avec un autre contenu, laissé tel quel : ${nom}`)
    }
    for (const { nom, raison } of reprise.ecartes) lignes.push(`    écarté (${raison}) : ${nom}`)
  }

  return lignes.join('\n')
}

function vide(dossier: string): RepriseDunDossier {
  return { dossier, trouves: 0, entres: 0, identiques: 0, differents: [], ecartes: [], octets: 0 }
}

/** Les fichiers d'un dossier, ou rien s'il n'existe pas. */
function fichiersDe(chemin: string): string[] {
  let noms: string[]
  try {
    noms = readdirSync(chemin)
  } catch {
    return []
  }

  return noms
    .filter((nom) => {
      try {
        return statSync(join(chemin, nom)).isFile()
      } catch {
        return false
      }
    })
    .sort((a, b) => a.localeCompare(b))
}

/** Le nom qui s'affichera, pris dans le profil s'il en porte un. */
function nomLisible(profil: unknown, repli: string): string {
  if (typeof profil === 'object' && profil !== null && 'name' in profil) {
    const nom = (profil as { name?: unknown }).name
    if (typeof nom === 'string' && nom.trim() !== '') return nom
  }
  return repli.replace(/\.json$/i, '')
}
