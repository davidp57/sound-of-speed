/**
 * Ce que la visite guidée du premier lancement désigne, et ce qu'elle en dit.
 *
 * Les textes vivent ici plutôt que dans `App.vue` : ce sont des phrases, elles
 * se relisent mieux à la file, et l'assemblage de l'application n'a pas à porter
 * un manuel.
 */

/**
 * Une étape : la cible, et ce qu'on en dit.
 *
 * `cible` est la valeur d'un attribut `data-visite` posé dans l'interface. La
 * visite ne connaît donc aucun composant, et un écran peut déplacer ses boutons
 * sans rien casser tant qu'il garde l'attribut.
 */
export interface EtapeDeVisite {
  cible: string
  titre: string
  texte: string
}

/**
 * L'ordre est celui dans lequel on s'en sert : on démarre, on arrête, on choisit
 * la boîte, on règle le volume.
 *
 * **Le volume n'est pas toujours là** — il n'apparaît qu'une fois le son prêt,
 * donc jamais au premier lancement, où l'on n'a encore rien démarré. Sa bulle se
 * saute alors toute seule ; c'est pour ce cas que l'aide de référence garde sa
 * section « Le son est trop faible ? ».
 */
export const ETAPES_DE_CONDUITE: readonly EtapeDeVisite[] = [
  {
    cible: 'marche',
    titre: 'D démarre',
    texte:
      'Un appui met en route la localisation, le son et l’enregistrement du trajet. Une fois en route, la même touche affiche S : le mode sport, qui tient les rapports plus haut dans les tours.',
  },
  {
    cible: 'repos',
    titre: 'P met tout au repos',
    texte:
      'Il fonctionne aussi en roulant : c’est le bouton d’arrêt de l’application, et c’est lui qui envoie le trajet au serveur.',
  },
  {
    cible: 'boite',
    titre: 'AUTO ou MAN',
    texte:
      'Les deux colonnes montrent les deux boîtes. Les commandes de chacune sont au-dessus de son étiquette : la touche de marche pour l’automatique, + et − pour la manuelle. Les touches qui ne commandent plus rien sont estompées.',
  },
  {
    cible: 'volume',
    titre: 'Le volume',
    texte:
      'Il monte au-delà du maximum habituel, ce qui sert quand le volume de la voiture reste bas pour la musique.',
  },
]

/**
 * La barre du haut : la navigation à gauche, les commandes d'appareil à droite.
 *
 * **Ce qui est ouvert dépend du compte et de l'appareil**, et la bulle des
 * onglets le dit plutôt que de nommer des écrans que la voiture ne montre pas.
 * Le verrou n'existe pas sur tous les navigateurs et le plein écran n'apparaît
 * qu'avec le rôle de conduite : leurs bulles se sautent alors.
 *
 * L'aide ferme la marche : c'est la bulle qui dit comment revenir.
 */
export const ETAPES_DE_LA_BARRE: readonly EtapeDeVisite[] = [
  {
    cible: 'onglets',
    titre: 'Les écrans',
    texte:
      'On change d’écran ici. Il y en a plus ou moins selon le compte et selon l’appareil : la voiture n’a pas besoin de ceux qu’on regarde à l’arrêt, un moteur à la main.',
  },
  {
    cible: 'son',
    titre: 'Couper et rendre le son',
    texte:
      'Sans rien arrêter d’autre. Si une autre application le prend — la musique de la voiture, un appel —, c’est le même bouton qui le récupère.',
  },
  {
    cible: 'verrou',
    titre: 'Garder l’écran allumé',
    texte:
      'Sans lui, l’écran s’éteint au bout d’une minute et vous perdez la vitesse de vue.',
  },
  {
    cible: 'plein-ecran',
    titre: 'Plein écran',
    texte:
      'La barre disparaît : les chiffres prennent toute la hauteur et les commandes deviennent quatre grandes touches. On en sort par la croix, en haut à droite.',
  },
  {
    cible: 'aide',
    titre: 'Et pour le reste',
    texte:
      'Ce bouton ouvre l’aide, à tout moment. On y retrouve ce qui n’est pas montré ici, et de quoi revoir cette visite.',
  },
]

/** La visite entière : l'écran de conduite, puis la barre. */
export const ETAPES_DE_VISITE: readonly EtapeDeVisite[] = [
  ...ETAPES_DE_CONDUITE,
  ...ETAPES_DE_LA_BARRE,
]
