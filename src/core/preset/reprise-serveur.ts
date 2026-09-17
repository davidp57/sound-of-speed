import type { EngineEntity } from './engine-entity'
import type { GearboxEntity } from './gearbox-entity'
import type { Profile } from './schema'
import { splitProfiles } from './split'

/**
 * Reprendre les profils du serveur, en remplaçant ceux de l'appareil.
 *
 * **C'est un remplacement, pas une fusion**, et c'est David qui l'a tranché le
 * 17 septembre 2026 : « un bouton unique qui efface tous les profils locaux et
 * récupère ceux du serveur à la place ; c'est l'équivalent de faire supprimer
 * sur tous les profils puis profils d'usine ». Le serveur fait foi, et il n'y a
 * donc ni arbitrage à rendre ni écart à montrer — ce qui est précisément ce qui
 * rend le geste compréhensible d'un coup d'œil.
 *
 * Le besoin venait de ce que la bibliothèque savait déjà faire : son bouton
 * « Ajouter » **dupliquait**. Reprendre un profil qu'on avait déjà laissait deux
 * entrées du même identifiant et du même nom, que rien ne distinguait à l'écran,
 * et la sélection prenait la première trouvée.
 *
 * Trois choses ne bougent pas, et chacune pour une raison :
 *
 * - **Les moteurs et les boîtes restent.** Supprimer un profil ne les a jamais
 *   emportés, et `splitProfiles` réutilise celui qui correspond plutôt que d'en
 *   créer un second : reprendre du serveur retrouve donc les entités d'ici au
 *   lieu d'en empiler des copies.
 * - **Les profils d'usine manquants reviennent**, comme le geste manuel qu'ils
 *   remplacent. Un serveur qui ne porte que deux profils réglés ne doit pas
 *   faire disparaître les banques livrées avec l'application.
 * - **Ce qui vient du serveur gagne.** Si le serveur porte sa version de `gm-ls`,
 *   le profil d'usine du même identifiant n'est pas réintroduit par-dessus.
 *
 * Cette fonction ne décide pas d'effacer : elle calcule ce que serait la liste
 * après reprise. C'est l'appelant qui refuse d'effacer quand le serveur n'a rien
 * rendu — un serveur muet, hors réseau ou sans compte rend une liste vide, et
 * une liste vide ne veut pas dire « efface tout ».
 */
export interface RepriseDuServeur {
  profiles: Profile[]
  engines: EngineEntity[]
  gearboxes: GearboxEntity[]
  /** Combien de profils viennent du serveur. */
  repris: number
  /** Combien de profils d'usine ont été réintroduits faute d'équivalent. */
  completes: number
  /**
   * Combien d'entrées du serveur ont été écartées parce qu'une autre portait
   * déjà leur identifiant.
   *
   * Le dossier peut porter deux fichiers pour un même profil — un export à la
   * main à côté du dépôt automatique, par exemple. Sans date pour les départager,
   * c'est le premier listé qui gagne ; le compte est rendu pour que l'écran
   * puisse le dire plutôt que de le taire.
   */
  ecartes: number
}

export function reprendreDuServeur(
  duServeur: readonly Profile[],
  usine: readonly Profile[],
  engines: readonly EngineEntity[],
  gearboxes: readonly GearboxEntity[],
  newId: () => string,
): RepriseDuServeur {
  const vus = new Set<string>()
  const gardes: Profile[] = []
  let ecartes = 0
  for (const profil of duServeur) {
    if (vus.has(profil.id)) {
      ecartes += 1
      continue
    }
    vus.add(profil.id)
    gardes.push(profil)
  }

  const manquants = usine.filter((profil) => !vus.has(profil.id))
  const scinde = splitProfiles([...gardes, ...manquants], engines, gearboxes, newId)

  return {
    profiles: scinde.profiles,
    engines: scinde.engines,
    gearboxes: scinde.gearboxes,
    repris: gardes.length,
    completes: manquants.length,
    ecartes,
  }
}
