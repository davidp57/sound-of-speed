/**
 * Assembler un profil : ce que la chaîne consomme.
 *
 * Un profil enregistré ne porte plus de valeurs — un nom, un moteur, une boîte.
 * Mais la chaîne, elle, a besoin des sections complètes : le moteur veut un
 * `EnginePreset`, la boîte un `DrivetrainPreset`, le mixage un `MixPreset`. Ce
 * module fait le pont, et c'est **tout ce qu'il fait**.
 *
 * **Pourquoi cette forme-là.** Les sections assemblées portent exactement les
 * noms qu'elles avaient : `engine`, `drivetrain`, `speed`, `mix`, `feel`,
 * `layers`, `sampleDir`. C'est ce qui permet de vider le profil sans toucher aux
 * **trois cent trente-six points d'appel** qui les lisent — la chaîne, la boîte,
 * le mixage, l'audio et les écrans continuent de lire les mêmes noms. Seule
 * l'écriture change de destination, et elle est concentrée dans l'écran de
 * réglage.
 *
 * **Ce que l'assemblage fait disparaître.** Il n'y a plus rien à répercuter :
 * corriger un moteur se voit dans tous les profils qui le désignent, non parce
 * qu'on les a mis à jour, mais parce qu'ils le lisent. Les fonctions de
 * propagation des entités deviennent inutiles le jour où le profil est vidé.
 *
 * **L'ordre compte.** Le moteur pose sa banque, son mixage et ses réglages ; la
 * boîte pose ses rapports et ses gestes ; la voiture réelle pose le signal. Ils
 * ne se recouvrent pas — c'est le sens du découpage en cinq groupes — donc
 * l'ordre n'a d'effet que sur les pétarades, que le moteur porte et que la boîte
 * laisse.
 */

import { applyEngine, type EngineEntity } from './engine-entity'
import { applyGearbox, type GearboxEntity } from './gearbox-entity'
import type { RealCar } from './real-car'
import type { Profile } from './schema'

/** Les pièces qu'un profil désigne, quand elles sont trouvées. */
export interface ProfileParts {
  engine?: EngineEntity | undefined
  gearbox?: GearboxEntity | undefined
  /** Une seule par appareil : elle ne se désigne pas, elle est. */
  realCar?: RealCar | undefined
}

/**
 * Le profil que la chaîne consomme.
 *
 * Une pièce absente laisse la section du profil telle quelle. C'est ce qui rend
 * la transition possible : un profil qui ne désigne encore aucun moteur joue ses
 * propres valeurs, comme il l'a toujours fait.
 */
export function assembleProfile(profile: Profile, parts: ProfileParts): Profile {
  let assemble = profile
  if (parts.engine) assemble = applyEngine(assemble, parts.engine)
  if (parts.gearbox) assemble = applyGearbox(assemble, parts.gearbox)
  if (parts.realCar) {
    // Le signal de vitesse décrit la voiture, pas le profil : il écrase donc
    // toujours ce que le profil portait, et un profil reçu d'ailleurs n'impose
    // jamais sa mesure à celui qui le reçoit.
    const { model: _ignore, ...signal } = parts.realCar
    assemble = { ...assemble, speed: { ...signal } }
  }
  return assemble
}

/**
 * Les pièces qu'un profil désigne, cherchées dans les registres.
 *
 * Une désignation qui ne trouve rien est traitée comme une absence : un moteur
 * supprimé ne doit pas rendre le profil muet, il doit le laisser jouer ce qu'il
 * porte encore.
 */
export function partsFor(
  profile: Profile,
  engines: readonly EngineEntity[],
  gearboxes: readonly GearboxEntity[],
  realCar: RealCar,
): ProfileParts {
  return {
    engine: profile.engineId
      ? engines.find((moteur) => moteur.id === profile.engineId)
      : undefined,
    gearbox: profile.gearboxId
      ? gearboxes.find((boite) => boite.id === profile.gearboxId)
      : undefined,
    realCar,
  }
}
