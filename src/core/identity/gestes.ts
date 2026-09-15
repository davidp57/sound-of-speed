/**
 * Ce qu'une ligne de trace dit, en français.
 *
 * La base garde des mots courts et stables ; l'écran les rend lisibles. Les deux
 * écrans qui montrent une trace — la régie, et l'écran du compte concerné — sont
 * dans deux paquets différents et passent par ici, pour ne pas en avoir deux
 * traductions qui finiraient par ne plus dire la même chose.
 */

/** Le geste, dit à quelqu'un qui le lit. Le détail complète, quand il y en a un. */
export function phraseDuGeste(geste: string, detail: string | null): string {
  const quoi = detail === null ? '' : ` ${detail}`
  switch (geste) {
    case 'role-donne':
      return `rôle${quoi} donné`
    case 'role-repris':
      return `rôle${quoi} repris`
    case 'banque-accordee':
      return `banque${quoi} accordée`
    case 'banque-retiree':
      return `banque${quoi} retirée`
    case 'assistance-ouverte':
      return detail === null ? 'assistance ouverte' : `assistance ouverte jusqu’au ${detail}`
    case 'assistance-fermee':
      return 'assistance refermée'
    case 'donnees-lues':
      return detail === null ? 'données consultées' : `données consultées : ${detail}`
    case 'compte-efface':
      return 'compte effacé'
    case 'retention-forcee':
      return detail === null ? 'passage de rétention forcé' : `passage de rétention forcé — ${detail}`
    case 'abandon-regle':
      return detail === null ? 'abandon réglé' : `abandon réglé — ${detail}`
    case 'plafond-pose':
      return `plafond posé à ${detail ?? '?'}`
    case 'plafond-retire':
      return 'plafond ramené au commun'
    default:
      // Une ligne écrite par une version plus récente se lit quand même : on ne
      // sait pas la dire joliment, on la dit telle quelle.
      return detail === null ? geste : `${geste} (${detail})`
  }
}
