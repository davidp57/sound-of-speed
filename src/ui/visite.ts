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
