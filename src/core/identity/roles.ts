/**
 * Les rôles d'un compte : ce qu'il a le droit d'ouvrir.
 *
 * **Deux axes, et ceci est le premier.** Ce qu'un écran demande tient sur le
 * rôle — ce que la personne peut ouvrir — et sur l'appareil — ce qui a un sens
 * là où l'on est. Les deux se croisent par un et. L'appareil est un confort
 * d'affichage, local, que le serveur ignore ; le rôle, lui, vit dans la base et
 * le serveur refuse ce qu'il n'ouvre pas.
 *
 * **`conduite` et non `user`.** La bibliothèque d'identité appelle déjà `user`
 * ce que ce dépôt appelle un compte, et `CONTEXT.md` passe une section à démêler
 * cette collision ; un troisième sens du même mot achèverait de l'embrouiller.
 *
 * Ce module est pur : il ne parle ni au réseau ni au stockage. Le serveur le
 * lit pour décider d'un refus, l'écran pour décider d'un onglet.
 */

/** Ce qu'un compte peut porter. Ils se cumulent : zéro à trois. */
export type Role = 'conduite' | 'atelier' | 'synthese'

export const ROLES: readonly Role[] = ['conduite', 'atelier', 'synthese']

export function estUnRole(valeur: unknown): valeur is Role {
  return typeof valeur === 'string' && (ROLES as readonly string[]).includes(valeur)
}

/**
 * Un rôle, et jusqu'à quand.
 *
 * `expireLe` absent vaut **sans échéance** : c'est ce que porte tout le monde
 * aujourd'hui, rien n'étant encaissé.
 */
export interface Droit {
  role: Role
  expireLe: number | null
}

/**
 * Ce qu'un appareil a retenu de ses rôles, pour les savoir hors réseau.
 *
 * Elle est contournable par qui veut — le code est public — et c'est assumé :
 * l'objectif est de ne pas perdre d'argent, pas d'en gagner. Ce qui protège
 * reste le refus du serveur.
 */
export interface CopieDesRoles {
  /**
   * De quel compte elle parle.
   *
   * **Sans lui, une copie survit à un changement de compte** et referme ou
   * ouvre des écrans au nom de quelqu'un d'autre. Elle était bien effacée aux
   * trois endroits où le compte change — mais par discipline, dans un domaine
   * qui ajoute des chemins. Portée ici, la discordance se voit toute seule.
   */
  compte: string
  /** Ce que le compte portait au dernier relevé, échéances comprises. */
  droits: Droit[]
  /** Ce qui est offert à tout compte, et qui survit à la péremption de la copie. */
  offerts: Role[]
  /** Quand le relevé a été pris, en millisecondes. */
  releveLe: number
}

/**
 * Trente jours, au-delà desquels la copie ne dit plus rien de sûr.
 *
 * Assez long pour des vacances sans réseau, assez court pour qu'un droit
 * révoqué finisse par se refermer.
 */
export const VALIDITE_COPIE_MS = 30 * 24 * 60 * 60 * 1000

/**
 * L'échéance se juge sur l'horloge de l'appareil, et c'est accepté.
 *
 * Reculer l'horloge rouvre donc un droit expiré, et empêche la copie de périmer.
 * **Ça ne donne rien**, et c'est ce qui rend la question close : la copie ne
 * protège rien, le serveur relit les droits en base à chaque requête, et ce qui
 * s'ouvrirait est un écran dont toutes les routes répondront non.
 *
 * L'alternative — juger sur une heure rendue par le serveur — coûterait
 * précisément ce qu'on refuse de payer : il faudrait le réseau pour savoir ce
 * qu'on ouvre, dans une application dont la règle est de démarrer et de faire du
 * son sans lui.
 */

/**
 * Les rôles ouverts à cet instant.
 *
 * Trois situations, et trois conduites :
 *
 * - **Aucune copie** — premier lancement dans un tunnel : on n'interdit rien.
 *   Cacher un écran par prudence, ici, reviendrait à casser une application qui
 *   marchait, pour protéger ce que le serveur protège déjà.
 * - **Copie périmée** : on retombe sur ce qui est offert à tout le monde.
 * - **Copie valable** : les rôles qu'elle porte, moins ceux dont l'échéance est
 *   passée. C'est ce qui referme un droit expiré **sans redémarrage**, l'instant
 *   présent étant redonné à chaque appel.
 */
export function rolesOuverts(
  copie: CopieDesRoles | null,
  maintenant: number,
  /**
   * Le compte de cet appareil, quand on le sait déjà.
   *
   * **Une copie qui parle d'un autre compte ne vaut rien**, et elle se détecte
   * ici plutôt qu'à chaque endroit qui change de compte : le contrôle est sur le
   * chemin que tout le monde emprunte, au lieu d'être une consigne qu'on peut
   * oublier d'appliquer sur une route ajoutée plus tard.
   *
   * `null` au démarrage, avant que l'identité soit redescendue : on se sert alors
   * de ce qu'on avait retenu, ce qui est exactement le cas hors réseau.
   */
  compte: string | null = null,
): Role[] {
  if (copie === null) return [...ROLES]
  // Discordance : on se comporte comme sans copie, donc on n'interdit rien. Le
  // serveur, lui, refusera ce que ce compte n'ouvre pas.
  if (compte !== null && copie.compte !== compte) return [...ROLES]
  if (maintenant - copie.releveLe > VALIDITE_COPIE_MS) return trier(copie.offerts)

  const ouverts = copie.droits
    .filter((droit) => droit.expireLe === null || droit.expireLe > maintenant)
    .map((droit) => droit.role)
  return trier([...copie.offerts, ...ouverts])
}

/** Dans l'ordre de `ROLES`, sans doublon : deux listes égales se comparent. */
function trier(roles: Role[]): Role[] {
  return ROLES.filter((role) => roles.includes(role))
}

/**
 * Quand le prochain droit se referme, s'il y en a un.
 *
 * Sert à poser un réveil plutôt qu'à scruter : un droit daté est rare, et
 * l'écran n'a rien à réévaluer tant qu'aucune échéance n'approche.
 */
export function prochaineEcheance(copie: CopieDesRoles | null, maintenant: number): number | null {
  if (copie === null) return null
  const aVenir = copie.droits
    .map((droit) => droit.expireLe)
    .filter((quand): quand is number => quand !== null && quand > maintenant)
  return aVenir.length === 0 ? null : Math.min(...aVenir)
}
