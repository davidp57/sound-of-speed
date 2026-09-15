/**
 * Les banques qu'on ne sert pas à tout le monde.
 *
 * Toutes les banques d'échantillons ne nous appartiennent pas. Celles-là ne
 * doivent atteindre qu'une poignée de comptes nommés, et c'est le serveur qui
 * doit le faire respecter — l'écran ne protège rien.
 *
 * **Ce qui est restreint et qui y a droit se déclare par l'environnement, jamais
 * par une route.** C'est ce qui rend le contrôle sûr : aucun appel ne peut
 * s'accorder un droit qui n'existe que dans la configuration de la pile. L'écran
 * qui gérera ça vit dans le lot RÉGIE ; il s'appuiera sur une table, et ce module
 * restera la façon de le faire sans écran.
 *
 * **Rien ici ne nomme une banque.** Les noms vivent dans la configuration du
 * serveur, et le dépôt ne doit pas dire laquelle est concernée.
 */

import { eq } from 'drizzle-orm'

import type { Base } from './base/base'
import { accounts } from './base/schema'

/**
 * Ce qui demande un droit pour descendre.
 *
 * Une liste de noms de dossiers séparés par des virgules. Absente ou vide :
 * aucune banque n'est restreinte, et c'est le cas de qui déploie chez lui.
 */
export function banquesRestreintes(brut: string | undefined): Set<string> {
  return new Set(decouper(brut))
}

/**
 * Qui a le droit de jouer quoi.
 *
 * `adresse=banque,banque;adresse=banque`. L'adresse plutôt que l'identifiant du
 * compte : un identifiant fait trente-deux caractères tirés au sort, et on le
 * recopierait de travers un jour sur deux. Une adresse se relit.
 *
 * `*` à la place des banques accorde toutes les banques restreintes — ce qui est
 * le cas ordinaire quand il n'y en a qu'une.
 */
export function banquesAccordees(brut: string | undefined): Map<string, Set<string>> {
  const accordees = new Map<string, Set<string>>()

  for (const entree of decouper(brut, ';')) {
    const separateur = entree.indexOf('=')
    if (separateur <= 0) continue

    const adresse = entree.slice(0, separateur).trim().toLowerCase()
    const banques = decouper(entree.slice(separateur + 1))
    if (adresse === '' || banques.length === 0) continue

    // Deux lignes pour la même adresse s'ajoutent plutôt que de s'écraser : une
    // configuration recopiée en deux fois ne doit pas en perdre la moitié.
    const deja = accordees.get(adresse) ?? new Set<string>()
    for (const banque of banques) deja.add(banque)
    accordees.set(adresse, deja)
  }

  return accordees
}

/** Les droits sur les banques, tels que la pile les déclare. */
export interface DroitsSurLesBanques {
  restreintes: ReadonlySet<string>
  accordees: ReadonlyMap<string, ReadonlySet<string>>
}

/**
 * Ce compte peut-il jouer cette banque ?
 *
 * **La banque non restreinte ne coûte rien** : on rend vrai sans rien demander à
 * la base. C'est le cas de presque toutes les requêtes, et les échantillons sont
 * le plus gros poste de trafic du serveur — y ajouter une requête par fichier se
 * paierait à chaque tour de roue.
 */
export async function peutJouer(
  base: Base,
  droits: DroitsSurLesBanques,
  compte: string,
  banque: string,
): Promise<boolean> {
  if (!droits.restreintes.has(banque)) return true
  if (droits.accordees.size === 0) return false

  const adresse = await adresseDuCompte(base, compte)
  if (adresse === null) return false

  const siennes = droits.accordees.get(adresse)
  if (siennes === undefined) return false
  return siennes.has('*') || siennes.has(banque)
}

/**
 * Les banques que ce compte n'a pas le droit de voir.
 *
 * Servent à retirer d'un listage ce qu'il ne peut pas jouer : **l'existence
 * d'une banque ne doit pas fuir plus que son contenu**. Cacher les octets en
 * laissant les noms ne cacherait rien.
 */
export async function banquesInterdites(
  base: Base,
  droits: DroitsSurLesBanques,
  compte: string,
): Promise<Set<string>> {
  if (droits.restreintes.size === 0) return new Set()

  const adresse = droits.accordees.size === 0 ? null : await adresseDuCompte(base, compte)
  const siennes = adresse === null ? undefined : droits.accordees.get(adresse)
  if (siennes?.has('*') === true) return new Set()

  return new Set([...droits.restreintes].filter((banque) => siennes?.has(banque) !== true))
}

async function adresseDuCompte(base: Base, compte: string): Promise<string | null> {
  const [ligne] = await base
    .select({ email: accounts.email })
    .from(accounts)
    .where(eq(accounts.id, compte))
    .limit(1)

  const adresse = ligne?.email
  return typeof adresse === 'string' && adresse !== '' ? adresse.toLowerCase() : null
}

function decouper(brut: string | undefined, separateur = ','): string[] {
  if (brut === undefined) return []
  return brut
    .split(separateur)
    .map((morceau) => morceau.trim())
    .filter((morceau) => morceau !== '')
}
