/**
 * Scinder les profils enregistrés en groupes de réglages.
 *
 * La reprise du ticket 04, et la dernière : un profil enregistré avant les
 * entités porte toutes ses valeurs et n'en désigne aucune. Après ce passage,
 * chaque profil désigne un moteur et une boîte, et ses valeurs vivent là.
 *
 * **Ce qui évite les doublons.** Un profil dont le moteur est déjà enregistré —
 * le V8 livré, ou celui d'un profil qu'on a dupliqué — le **désigne** au lieu
 * d'en créer une copie sous un autre nom. Sans cette reconnaissance, cinq
 * profils tirés du V8 donneraient cinq moteurs identiques dans la liste, et
 * corriger l'ancrage d'une couche redeviendrait un travail à faire cinq fois.
 *
 * La comparaison est celle des entités — `matchesEngine`, `matchesGearbox` —,
 * donc à la tolérance près sur les nombres : un profil qui a fait l'aller-retour
 * par un lien de partage porte des valeurs arrondies, et cela ne fait pas de lui
 * un autre moteur.
 *
 * **Une référence qui ne mène à rien vaut une absence.** C'est ce qui fait
 * marcher le partage : un profil reçu désigne le moteur de celui qui l'a envoyé,
 * introuvable ici, mais il arrive avec ses valeurs — on lui rend donc un moteur
 * d'ici, le même s'il existe déjà. C'est aussi ce qui répare un profil dont le
 * moteur a été oublié.
 */

import {
  engineFromProfile,
  matchesEngine,
  type EngineEntity,
} from './engine-entity'
import {
  gearboxFromProfile,
  matchesGearbox,
  type GearboxEntity,
} from './gearbox-entity'
import type { Profile } from './schema'

/** L'état des trois listes après la reprise. */
export interface SplitOutcome {
  profiles: Profile[]
  engines: EngineEntity[]
  gearboxes: GearboxEntity[]
}

/**
 * Donne à chaque profil un moteur et une boîte, en créant ce qui manque.
 *
 * Un profil dont les deux références mènent à une entité connue est laissé tel
 * quel : la reprise ne se refait pas à chaque lancement, et elle ne défait pas
 * un rattachement choisi à la main. Elle est donc sans effet au deuxième
 * passage.
 */
export function splitProfiles(
  profiles: readonly Profile[],
  engines: readonly EngineEntity[],
  gearboxes: readonly GearboxEntity[],
  newId: () => string,
): SplitOutcome {
  const moteurs = [...engines]
  const boites = [...gearboxes]

  const repris = profiles.map((profile) => {
    let repris = profile

    if (!moteurs.some((moteur) => moteur.id === profile.engineId)) {
      const connu = moteurs.find((moteur) => matchesEngine(profile, moteur))
      const moteur = connu ?? nomme(engineFromProfile(profile), moteurs, newId)
      if (!connu) moteurs.push(moteur)
      repris = { ...repris, engineId: moteur.id }
    }

    if (!boites.some((boite) => boite.id === profile.gearboxId)) {
      const connue = boites.find((boite) => matchesGearbox(profile, boite))
      const boite = connue ?? nomme(gearboxFromProfile(profile), boites, newId)
      if (!connue) boites.push(boite)
      repris = { ...repris, gearboxId: boite.id }
    }

    return repris
  })

  return { profiles: repris, engines: moteurs, gearboxes: boites }
}

/**
 * Donne à une entité neuve un identifiant libre.
 *
 * Une entité tirée d'un profil reprend l'identifiant de celui-ci — c'est ce qui
 * fait que le V8 livré et le profil V8 se retrouvent. Mais deux profils peuvent
 * porter deux moteurs différents sous des identifiants qui se croisent : un
 * profil dupliqué garde son nom, pas son identifiant, et rien n'interdit qu'un
 * fichier importé arrive avec un identifiant déjà pris. Un doublon
 * d'identifiant rendrait l'une des deux entités inatteignable.
 */
function nomme<T extends { id: string }>(
  entity: T,
  connues: readonly T[],
  newId: () => string,
): T {
  if (!connues.some((connue) => connue.id === entity.id)) return entity
  return { ...entity, id: newId() }
}
