/**
 * Rouvrir un trajet pris sur le disque.
 *
 * C'est ce qui ferme la boucle de l'archive : tant que le relecteur ne sait
 * relire que le serveur, télécharger ne sert à rien et effacer revient à perdre.
 *
 * **Le chemin de lecture est le même.** Une fois les tranches en main, la
 * session s'assemble avec `buildSession`, comme pour celles qui viennent du
 * serveur. Deux procédés pour la même chose finiraient par ne plus rendre le
 * même trajet.
 *
 * **Aucun compte n'est requis.** Relire un fichier du disque ne demande pas
 * l'identité de dépôt : un relecteur ouvert sans compte, qui ne peut rien
 * lister, doit pouvoir servir à ça.
 */

import { readZip } from '../archive/zip'
import { gunzip } from '../upload/compress'

import { buildSession, sessionKeyOf, type Session, type SessionFile } from './model'

/** Ce que porte le nom d'une entrée d'archive : son dossier d'origine. */
const DOSSIER_DU_JOURNAL = 'journal/'
const DOSSIER_DES_TRACES = 'traces/'

/**
 * Une session relue depuis une archive.
 *
 * `failures` nomme ce qui manque — une entrée illisible, une tranche que
 * l'archive ne porte pas. Un trajet à moitié lu répond souvent à la question,
 * et c'est déjà ce que fait le chargement depuis le serveur.
 */
export async function sessionFromArchive(
  octets: Uint8Array,
): Promise<{ session: Session; failures: string[] }> {
  const { entries, failures } = await readZip(octets)

  const files: SessionFile[] = []
  for (const entree of entries) {
    const nom = nomNu(entree.name)
    // Ce qui n'est pas une tranche : un fichier joint à l'archive après coup, un
    // dossier système. On le laisse sans bruit plutôt que de le compter perdu.
    if (nom === null) continue
    try {
      files.push({ name: nom, kind: natureDe(entree.name), text: await texteDe(entree, nom) })
    } catch {
      failures.push(nom)
    }
  }

  if (files.length === 0) {
    throw new Error("Cette archive ne porte aucune tranche de trajet.")
  }

  const repere = files.map((file) => sessionKeyOf(file.name)).find((clé) => clé !== null) ?? null
  const premier = files[0]!.name
  const id = repere === null ? premier : repere.key.slice(repere.key.lastIndexOf('_') + 1)

  return { session: buildSession(id, repere?.startedAt ?? 0, files), failures }
}

/**
 * Le nom de la tranche, sans le dossier que l'archive a conservé.
 *
 * L'archive range sous `traces/` et `journal/` parce qu'une trace et un journal
 * portent le même nom ; tout le reste du projet lit ce nom nu.
 */
function nomNu(nom: string): string | null {
  const nu = nom.slice(nom.lastIndexOf('/') + 1)
  if (nu === '' || nu.startsWith('.')) return null
  // On relit du texte ligne à ligne : une image ou un PDF glissés dans l'archive
  // n'ont rien à faire ici.
  return /\.(jsonl|json|txt)(\.gz)?$/.test(nu) ? nu : null
}

/**
 * D'où vient la tranche.
 *
 * Le dossier le dit quand l'archive vient d'ici. Sans dossier — une archive
 * refaite à la main, mise à plat —, on la compte comme capture : la lecture des
 * lignes est la même, seul le résumé affiché s'en trouve approximatif.
 */
function natureDe(nom: string): 'journal' | 'capture' {
  if (nom.startsWith(DOSSIER_DU_JOURNAL)) return 'journal'
  if (nom.startsWith(DOSSIER_DES_TRACES)) return 'capture'
  return 'capture'
}

/**
 * Le contenu d'une tranche, décompressé s'il l'était.
 *
 * Au nom du fichier, comme partout ailleurs : c'est l'application qui l'a écrit,
 * et c'est la seule indication sûre.
 */
async function texteDe(entree: { bytes: Uint8Array }, nom: string): Promise<string> {
  if (!nom.endsWith('.gz')) return new TextDecoder().decode(entree.bytes)
  return await gunzip(new Blob([entree.bytes as BlobPart]))
}
