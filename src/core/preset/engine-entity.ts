/**
 * Un moteur, comme entité qu'on nomme et qu'on partage.
 *
 * Jusqu'ici, un moteur n'existait pas : ses valeurs étaient éparpillées dans un
 * profil — le ralenti et le rupteur d'un côté, la banque d'échantillons et son
 * mixage de l'autre, les cotes du moteur simulé ailleurs — et rien ne disait
 * qu'elles allaient ensemble. La bibliothèque des neuf moteurs livrés en portait
 * la trace : pour savoir lequel un profil utilisait, elle **devinait**, en
 * comptant les écarts entre ses valeurs et celles de chaque entrée. Personne ne
 * le lui disait, parce que le profil ne le savait pas.
 *
 * Décidé par David le 10 septembre 2026 : « je penche pour une séparation nette
 * des groupes de paramètres, moteur / boîte / mode de conduite / fonctions de
 * l'app ». Un moteur devient donc une chose entière, qui a un nom, qu'on
 * enregistre, qu'on corrige une fois pour tous les profils qui la désignent, et
 * qu'on envoie seule — sans avoir à faire suivre tout un profil pour faire
 * essayer un V8.
 *
 * **Ce qu'un moteur porte**, et pourquoi c'est ce découpage-là :
 *
 * - ses **réglages** — ralenti, rupteur, inertie, frein moteur, tremblement ;
 * - sa **banque** et ses couches : c'est d'elle que vient le son, maintenant que
 *   la synthèse en direct quitte le produit ;
 * - son **mixage** : la même banque jouée avec un autre relief de charge n'est
 *   pas le même moteur ;
 * - ses **cotes** et son **échappement**, quand il en a : ils ne servent qu'à
 *   l'atelier, qui fabrique les banques, mais ils décrivent bien ce moteur-ci.
 *
 * Ce qu'il ne porte pas : les rapports et le pont, qui sont la boîte ; le
 * tempérament, qui est le mode de conduite ; le signal de vitesse, qui décrit la
 * vraie voiture. Les pétarades et l'à-coup de passage, aujourd'hui mêlés dans le
 * même bloc de réglages, se rangeront avec la boîte et le moteur au ticket 04 :
 * les séparer maintenant toucherait cinquante points d'appel pour un gain nul.
 *
 * **Le profil garde ses sections pour l'instant.** Ce module ajoute le moteur à
 * côté ; désigner un moteur applique ses valeurs au profil, comme le fait déjà
 * la bibliothèque. Vider le profil de ces sections toucherait environ trois
 * cent cinq points d'appel et ne pourrait pas rester vert : c'est le ticket 04
 * qui contracte, une fois les cinq groupes en place.
 */

import type { SynthRendering } from '../synth/rendering'
import type {
  EngineDefinition,
  EnginePreset,
  LayerPreset,
  MixPreset,
  Profile,
} from './schema'

export interface EngineEntity {
  /** Identifiant stable. Celui d'une entrée d'usine est son identifiant à elle. */
  id: string
  /** Ce qui s'affiche, et ce que David lit dans une liste. */
  name: string
  /**
   * D'où il vient, quand on le sait.
   *
   * Une entrée d'usine cite sa source — le fichier de définition dont elle est
   * tirée. Un moteur né d'un profil cite le profil. C'est ce qui permet, six
   * mois plus tard, de savoir ce qu'on écoute.
   */
  source?: string
  engine: EnginePreset
  /** Dossier de la banque, relatif à la racine des échantillons. */
  sampleDir: string
  layers: LayerPreset[]
  mix: MixPreset
  /** Les cotes du moteur simulé. Atelier seulement, et facultatives. */
  definition?: EngineDefinition
  /** Échappement et point d'écoute. Facultatifs pour la même raison. */
  rendering?: SynthRendering
}

/**
 * Le moteur que porte un profil, extrait tel quel.
 *
 * C'est ce qui permet de reprendre les profils déjà enregistrés sans rien leur
 * demander : chacun donne son moteur, et le désigne ensuite.
 */
export function engineFromProfile(profile: Profile, name = profile.name): EngineEntity {
  const entity: EngineEntity = {
    id: profile.id,
    name,
    source: `profil « ${profile.name} »`,
    engine: { ...profile.engine },
    sampleDir: profile.sampleDir,
    layers: profile.layers.map((layer) => ({ ...layer })),
    mix: { ...profile.mix },
  }
  if (profile.engineDefinition) entity.definition = { ...profile.engineDefinition }
  if (profile.rendering) entity.rendering = { ...profile.rendering }
  return entity
}

/**
 * Applique un moteur à un profil, et note lequel.
 *
 * Les deux ensemble et non l'un sans l'autre : appliquer sans noter laisserait
 * le profil dans l'état qu'on cherche à quitter — celui où il faut deviner ce
 * qu'il joue.
 *
 * Ce qui n'est pas touché est aussi important que ce qui l'est : le nom du
 * profil, son statut d'épinglé, sa boîte, son signal de vitesse. Charger un
 * moteur ne renomme pas le profil et ne change pas sa façon de passer les
 * rapports.
 */
export function applyEngine(profile: Profile, engine: EngineEntity): Profile {
  const applied: Profile = {
    ...profile,
    engineId: engine.id,
    engine: { ...engine.engine },
    sampleDir: engine.sampleDir,
    layers: engine.layers.map((layer) => ({ ...layer })),
    mix: { ...engine.mix },
  }
  if (engine.definition) applied.engineDefinition = { ...engine.definition }
  if (engine.rendering) applied.rendering = { ...engine.rendering }
  return applied
}

/**
 * Vrai si le profil joue ce moteur-là, aux valeurs près.
 *
 * Sert à repérer un profil qui a été affiné après avoir chargé son moteur : il
 * le désigne toujours, mais il ne sonne plus comme lui. On le dit plutôt que de
 * le corriger dans son dos — c'est son réglage.
 */
export function matchesEngine(profile: Profile, engine: EngineEntity): boolean {
  if (profile.sampleDir !== engine.sampleDir) return false
  if (profile.layers.length !== engine.layers.length) return false
  // Comparaison à la tolérance près sur les nombres : un profil qui a fait
  // l'aller-retour par un lien de partage porte des valeurs arrondies, et un
  // écart de l'ordre du milliardième ne veut pas dire qu'on a changé de moteur.
  const memeNombre = <T extends object>(a: T, b: T): boolean => {
    for (const cle of Object.keys(a) as (keyof T)[]) {
      const gauche = a[cle]
      const droite = b[cle]
      if (typeof gauche === 'number' && typeof droite === 'number') {
        if (Math.abs(gauche - droite) > 1e-9) return false
      } else if (gauche !== droite) return false
    }
    return true
  }
  if (!memeNombre(profile.engine, engine.engine)) return false
  if (!memeNombre(profile.mix, engine.mix)) return false
  return profile.layers.every((layer, index) => {
    const attendue = engine.layers[index]
    return attendue !== undefined && memeNombre(layer, attendue)
  })
}

/** Les profils qui désignent ce moteur. */
export function profilesUsing(profiles: readonly Profile[], engineId: string): Profile[] {
  return profiles.filter((profile) => profile.engineId === engineId)
}

/**
 * Répercute la correction d'un moteur sur les profils qui le désignent.
 *
 * C'est la raison d'être de l'entité : corriger un ancrage de couche une fois,
 * et que les trois profils qui jouent ce moteur en profitent. Un profil qui ne
 * le désigne pas n'est pas touché, même s'il joue la même banque.
 */
export function refreshProfiles(profiles: readonly Profile[], engine: EngineEntity): Profile[] {
  return profiles.map((profile) =>
    profile.engineId === engine.id ? applyEngine(profile, engine) : profile,
  )
}
