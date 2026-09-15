/**
 * Les banques qu'on ne sert pas à tout le monde.
 *
 * Toutes les banques d'échantillons ne nous appartiennent pas. Celles-là ne
 * doivent atteindre qu'une poignée de comptes nommés, et c'est le serveur qui
 * doit le faire respecter — l'écran ne protège rien.
 *
 * **Ce qui est restreint se déclare par l'environnement, jamais par une route.**
 * C'est la défaillance qui commande : une table de drapeaux vide — base neuve,
 * migration ratée — ouvrirait tout à tout le monde, alors qu'une table d'accords
 * vide ne fait que refuser. Le drapeau reste donc dans la pile, et les accords
 * sont en base, posés par l'écran de régie.
 *
 * **La variable d'accords reste, et se cumule avec la table.** C'est la façon
 * d'accorder sans écran, comme les rôles offerts se cumulent déjà avec la table
 * des droits.
 *
 * **Rien ici ne nomme une banque.** Les noms vivent dans la configuration du
 * serveur, et le dépôt ne doit pas dire laquelle est concernée.
 */

import { and, eq } from 'drizzle-orm'

import type { Base } from './base/base'
import { accounts, bankGrants } from './base/schema'

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
 *
 * Deux sources d'accord, et elles **se cumulent** : la table, que l'écran de
 * régie écrit, et la variable d'environnement, qui reste la façon d'accorder sans
 * écran. La table d'abord, parce qu'elle se lit par identifiant de compte et que
 * l'autre demande d'aller chercher l'adresse.
 */
export async function peutJouer(
  base: Base,
  droits: DroitsSurLesBanques,
  compte: string,
  banque: string,
): Promise<boolean> {
  if (!droits.restreintes.has(banque)) return true

  if (await accordeeEnBase(base, compte, banque)) return true
  if (droits.accordees.size === 0) return false

  const adresse = await adresseDuCompte(base, compte)
  if (adresse === null) return false

  const siennes = droits.accordees.get(adresse)
  if (siennes === undefined) return false
  return siennes.has('*') || siennes.has(banque)
}

/** Les banques que la table accorde à ce compte. */
export async function accordsDuCompte(base: Base, compte: string): Promise<Set<string>> {
  const lignes = await base
    .select({ banque: bankGrants.bank })
    .from(bankGrants)
    .where(eq(bankGrants.accountId, compte))
  return new Set(lignes.map((ligne) => ligne.banque))
}

async function accordeeEnBase(base: Base, compte: string, banque: string): Promise<boolean> {
  const [ligne] = await base
    .select({ id: bankGrants.id })
    .from(bankGrants)
    .where(and(eq(bankGrants.accountId, compte), eq(bankGrants.bank, banque)))
    .limit(1)
  return ligne !== undefined
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

  const enBase = await accordsDuCompte(base, compte)

  const adresse = droits.accordees.size === 0 ? null : await adresseDuCompte(base, compte)
  const siennes = adresse === null ? undefined : droits.accordees.get(adresse)
  if (siennes?.has('*') === true) return new Set()

  return new Set(
    [...droits.restreintes].filter(
      (banque) => !enBase.has(banque) && siennes?.has(banque) !== true,
    ),
  )
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
