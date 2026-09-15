/**
 * Le journal détaillé : un réglage de mise au point qui s'éteint tout seul.
 *
 * **Ce n'est pas un quatrième cran de remontée, et c'est la décision qui compte
 * ici.** Les trois crans forment une échelle de **vie privée** — ce qu'on accepte
 * de laisser partir. La finesse du journal est une échelle **technique**. Les
 * mettre sur la même rangée forcerait qui veut du détail à accepter aussi sa
 * position, et le module de consentement l'interdit dans son propre commentaire.
 *
 * Ce réglage densifie donc ce qui part **au cran déjà choisi**, et n'ouvre
 * aucune nature de fichier nouvelle : à « Le minimum », toujours ni position ni
 * trace. Il ne demande pas de consentement supplémentaire, puisqu'il n'élargit
 * rien.
 *
 * **Il s'éteint vingt-quatre heures après son activation, à l'heure près.** Et
 * non à la fin de la journée : activé à 23 h 30, on roule jusqu'à 0 h 30, et une
 * expiration au changement de date couperait en plein essai.
 */

/** Durée de vie du réglage, en millisecondes. */
export const DETAIL_DUREE_MS = 24 * 60 * 60 * 1000

/**
 * L'instant où le réglage a été activé, ou `null` s'il ne l'est pas.
 *
 * Ce qui est rangé, et non un booléen : c'est la date qui porte l'extinction, et
 * un booléen obligerait à écrire quelque part *quand* le remettre à faux.
 */
export type DetailActiveA = number | null

/** Le réglage est-il actif à cet instant ? */
export function detailActif(activeA: DetailActiveA, maintenantMs: number): boolean {
  return resteMs(activeA, maintenantMs) > 0
}

/**
 * Ce qu'il reste avant extinction, en millisecondes. Zéro s'il est éteint.
 *
 * **Une date d'activation dans le futur éteint le réglage** au lieu de lui
 * donner une vie plus longue : l'horloge d'un navigateur se règle, parfois de
 * plusieurs heures, et un réglage de mise au point ne doit pas pouvoir se rendre
 * permanent par un changement d'heure.
 */
export function resteMs(activeA: DetailActiveA, maintenantMs: number): number {
  if (activeA === null || !Number.isFinite(activeA)) return 0
  const ecoule = maintenantMs - activeA
  if (ecoule < 0) return 0
  return Math.max(0, DETAIL_DUREE_MS - ecoule)
}

/** L'instant où le réglage s'éteindra, ou `null` s'il est déjà éteint. */
export function eteintA(activeA: DetailActiveA, maintenantMs: number): number | null {
  const reste = resteMs(activeA, maintenantMs)
  return reste > 0 ? maintenantMs + reste : null
}
