/**
 * Qui administre ce serveur.
 *
 * **Une liste d'adresses dans l'environnement, et rien d'autre.** Aucune route de
 * régie n'accorde ni ne retire l'administration : même un défaut dans la régie
 * ne peut pas fabriquer un administrateur. C'est le principe déjà retenu pour
 * les banques restreintes, qui vivent elles aussi dans la configuration.
 *
 * **Ce que ça ne garantit pas, et il faut le dire.** L'adresse d'un compte n'est
 * pas vérifiée — aucun courriel ne part — et `/api/auth/compte/rattacher` laisse
 * un compte anonyme s'en donner une, tant qu'aucun autre ne la porte. Déclarer
 * ici une adresse **dont le titulaire n'a pas encore ouvert son compte sur ce
 * serveur** laisse donc un inconnu la revendiquer, et devenir administrateur avec
 * elle. L'ordre à tenir est l'inverse : que la personne ouvre son compte et
 * rattache son adresse, puis qu'on la déclare ici.
 *
 * La même faiblesse vaut depuis toujours pour les banques restreintes, qui se
 * nomment aussi par adresse ; ce qui change est ce qu'elle ouvre. La refermer
 * demanderait d'exiger une adresse prouvée — donc un relais de courriel, ou un
 * compte tenu ailleurs —, et c'est un arbitrage, pas un correctif.
 *
 * Conséquence assumée : un compte sans adresse enregistrée ne peut pas
 * administrer. C'était déjà vrai des banques restreintes.
 */

import { eq } from 'drizzle-orm'

import type { Base } from './base/base'
import { accounts } from './base/schema'

/**
 * Ce que `SPEED_ADMINS` désigne : des adresses séparées par des virgules.
 *
 * Absente ou vide, personne n'administre — et c'est le cas de qui déploie chez
 * lui sans jamais ouvrir la régie. Les adresses sont rangées en minuscules,
 * parce que c'est ainsi qu'un compte enregistre la sienne.
 */
export function administrateursDeLEnvironnement(brut: string | undefined): Set<string> {
  if (brut === undefined) return new Set()
  return new Set(
    brut
      .split(',')
      .map((adresse) => adresse.trim().toLowerCase())
      .filter((adresse) => adresse !== ''),
  )
}

/**
 * Ce compte administre-t-il ?
 *
 * **Relu à chaque requête**, et non rangé dans la session : une adresse retirée
 * de la pile doit refermer la régie au redémarrage suivant, sans qu'on ait à
 * expulser qui que ce soit.
 */
export async function estAdministrateur(
  base: Base,
  admins: ReadonlySet<string>,
  compte: string,
): Promise<boolean> {
  if (admins.size === 0) return false

  const [ligne] = await base
    .select({ email: accounts.email })
    .from(accounts)
    .where(eq(accounts.id, compte))
    .limit(1)

  const adresse = ligne?.email
  if (typeof adresse !== 'string' || adresse === '') return false
  return admins.has(adresse.toLowerCase())
}
