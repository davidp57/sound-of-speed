/**
 * Ouvrir la base, la mettre à jour, et s'assurer qu'un compte existe.
 *
 * Tout passe par ici : le serveur n'ouvre pas SQLite lui-même et ne joue aucune
 * migration à la main. Une seule porte, donc un seul endroit où l'ordre des
 * opérations est décidé — la base est migrée **avant** que quoi que ce soit la
 * lise.
 *
 * **Pourquoi libSQL.** L'image est construite pour deux architectures, dont
 * celle d'un NAS, et sur une base Alpine — donc musl et non glibc. Le pilote
 * habituel de SQLite est un module C++ qu'il faut compiler quand aucun binaire
 * ne correspond, ce qui est le cas courant sous musl : il faudrait une chaîne de
 * compilation dans l'image, ou changer sa base. libSQL publie des binaires
 * **par plateforme, musl compris** pour les deux architectures visées ; une
 * installation ordinaire prend le bon et ne compile rien.
 *
 * Le fichier reste un fichier SQLite. libSQL en est un dérivé, et il accepte
 * davantage de modifications de schéma en place — ce qui rendra les migrations
 * suivantes plus simples, sur une base qui portera les données d'un vrai
 * serveur.
 *
 * Le module SQLite intégré à Node ferait aussi bien et sans aucune dépendance,
 * mais l'adaptateur qui le relie à l'ORM n'existe que dans une version encore
 * non publiée. À rejuger quand elle sortira.
 */

import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { pathToFileURL } from 'node:url'

import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'

import { accounts } from './schema'
import * as schema from './schema'

export type Base = ReturnType<typeof drizzle<typeof schema>>

/** La base, et de quoi la refermer. */
export interface BaseOuverte {
  base: Base
  /**
   * Referme la connexion.
   *
   * Un serveur qui s'arrête doit rendre le fichier : tant qu'une connexion le
   * tient, le fichier reste verrouillé sur les systèmes qui le font — et un test
   * qui nettoie derrière lui échoue sur une permission refusée plutôt que sur ce
   * qu'il vérifiait.
   */
  fermer: () => void
}

export interface OuvertureOptions {
  /** Chemin du fichier, ou `:memory:` pour une base qui ne survit à rien. */
  fichier: string
  /** Dossier des migrations produites par `npm run base:migrations`. */
  migrations: string
}

/**
 * Ouvre la base, joue ce qui manque, et rend de quoi l'interroger.
 *
 * **Sans effet au second appel.** Les migrations déjà jouées sont reconnues à
 * leur empreinte. Relancer le serveur deux fois de suite ne change donc rien à la
 * base — ce qui est la seule façon d'accepter qu'elle se migre toute seule au
 * démarrage.
 *
 * **Aucun compte n'est semé ici.** Il n'y en avait qu'un, écrit en dur, tant que
 * l'identité n'était pas ouverte ; maintenant c'est le premier appareil qui se
 * présente qui crée le sien. Ce que l'ancien portait lui revient — voir
 * `heritage.ts`.
 */
export async function ouvrirBase({ fichier, migrations }: OuvertureOptions): Promise<BaseOuverte> {
  // Le dossier d'accueil, quand la base vit dans un volume qu'on vient de
  // monter. Le pilote ne crée pas l'arborescence, il échoue.
  if (!fichier.includes(':memory:')) mkdirSync(dirname(fichier), { recursive: true })

  const client = createClient({ url: adresseDe(fichier) })

  // Les clés étrangères sont **désactivées par défaut** dans SQLite, et le
  // réglage vaut par connexion, pas par base. Sans cette ligne, les cascades
  // déclarées au schéma ne s'appliqueraient jamais et des enfants survivraient à
  // leur compte.
  await client.execute('PRAGMA foreign_keys = ON')

  const base = drizzle({ client, schema })
  await migrate(base, { migrationsFolder: migrations })

  return { base, fermer: () => client.close() }
}

/**
 * Un chemin de fichier devient l'adresse que le pilote attend.
 *
 * Le passage par `pathToFileURL` n'est pas une précaution de style : coller
 * « file: » devant un chemin Windows produit une adresse que le pilote refuse,
 * et l'erreur parle de permissions plutôt que de forme. Le développement se fait
 * sous Windows, le service tourne sous Linux ; la conversion doit valoir pour
 * les deux.
 */
function adresseDe(fichier: string): string {
  if (fichier.startsWith('file:')) return fichier
  if (fichier === ':memory:') return 'file::memory:'
  return pathToFileURL(fichier).href
}

/**
 * Les comptes de cette base.
 *
 * Tout ce qui passe sur les données — le ménage de rétention, le rattrapage du
 * profil mesuré — travaille **compte par compte**, et il y en a maintenant
 * plusieurs. Ce qui se faisait sur un compte écrit en dur se fait donc sur cette
 * liste ; une base sans aucun compte rend une liste vide, et rien ne tourne, ce
 * qui est exact.
 */
export async function listerLesComptes(base: Base): Promise<string[]> {
  return (await base.select({ id: accounts.id }).from(accounts)).map((compte) => compte.id)
}
