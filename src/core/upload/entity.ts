import type { EngineEntity } from '../preset/engine-entity'
import { engineToFile } from '../preset/engine-store'
import type { GearboxEntity } from '../preset/gearbox-entity'
import { gearboxToFile } from '../preset/gearbox-store'
import { slug } from './put'

/**
 * Un moteur ou une boîte qui remonte, comme un profil le fait déjà.
 *
 * Un profil ne porte plus de valeurs depuis la refonte du 10 septembre 2026 : il
 * **désigne** un moteur et une boîte. Faire remonter le profil seul revenait donc
 * à faire remonter une désignation qui ne mène nulle part — un autre appareil
 * recevait un profil qui parlait d'un moteur qu'il n'avait pas.
 *
 * **Le nom de fichier suit la même règle que celui d'un profil** : lisible
 * d'abord, stable ensuite par la fin de l'identifiant. Deux moteurs du même nom
 * ne se recouvrent donc pas, et un moteur redéposé remplace sa version
 * précédente au lieu d'accumuler des copies.
 */

/** Les deux registres, servis en écriture comme la bibliothèque de profils. */
export const ENGINE_FOLDER = '/engines/'
export const GEARBOX_FOLDER = '/gearboxes/'

/** Ce qu'il faut d'une entité pour la nommer : le reste ne regarde pas le nom. */
export interface NamedEntity {
  id: string
  name: string
}

/**
 * Nom du fichier d'une entité nommée.
 *
 * La règle est celle des profils, et elle est ici plutôt que recopiée : deux
 * implémentations d'une même notion finissent par diverger, et ce dépôt a déjà
 * payé pour le savoir.
 */
export function entityFileName(entity: NamedEntity, repli = 'entite'): string {
  const label = slug(entity.name) || repli
  const tail = slug(entity.id).slice(-6) || 'x'
  // Une entrée livrée porte un identifiant qui est déjà son nom : sans cette
  // garde, le fichier du moteur V8 s'appellerait « v8-v8.json ».
  return label.endsWith(tail) ? `${label}.json` : `${label}-${tail}.json`
}

export function engineBody(engine: EngineEntity): string {
  return engineToFile(engine)
}

export function gearboxBody(gearbox: GearboxEntity): string {
  return gearboxToFile(gearbox)
}

/**
 * Identifiant du dépôt en attente.
 *
 * Il porte le registre et l'identifiant de l'entité, et rien d'autre : une
 * correction de plus pendant que la précédente attend son tour remplace ce qui
 * attend, au lieu d'ajouter un fichier de plus à envoyer.
 */
export function entityUploadId(folder: string, entity: NamedEntity): string {
  return `${folder}${entity.id}`
}
