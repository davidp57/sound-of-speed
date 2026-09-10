/**
 * Les boîtes enregistrées, et celles qui sont livrées.
 *
 * Le pendant du registre des moteurs — voir `engine-store.ts` —, et il suit les
 * mêmes règles : les boîtes livrées sont celles des deux profils d'usine, une
 * boîte corrigée remplace la sienne au lieu de s'ajouter à côté, et une boîte
 * reçue de quelqu'un d'autre reçoit un identifiant neuf.
 *
 * **Deux boîtes livrées et non une** : Route et Sport ne partagent que leurs
 * rapports. Leur pont diffère — 3,7 contre 4,5 —, donc le régime à une vitesse
 * donnée aussi, et leurs durées de passage ne sont pas les mêmes. Ce sont bien
 * deux boîtes.
 */

import { createFactoryProfiles } from './defaults'
import { gearboxFromProfile, type GearboxEntity } from './gearbox-entity'
import { ProfileImportError } from './store'

const GEARBOXES_KEY = 'speed.gearboxes.v1'

/** Version du fichier d'export d'une boîte. */
export const GEARBOX_FILE_VERSION = 1

/** Les boîtes livrées : une par profil d'usine. */
export function factoryGearboxes(): GearboxEntity[] {
  return createFactoryProfiles().map((profil) => ({
    ...gearboxFromProfile(profil),
    source: `livrée avec l'application (profil « ${profil.name} »)`,
  }))
}

/**
 * Toutes les boîtes disponibles : les enregistrées, puis les livrées qui
 * restent.
 *
 * Une boîte enregistrée qui porte l'identifiant d'une boîte livrée la
 * **remplace** : c'est la même, qu'on a corrigée.
 */
export function loadGearboxes(): GearboxEntity[] {
  const stored = readJson<GearboxEntity[]>(GEARBOXES_KEY)
  const enregistrees = Array.isArray(stored) ? stored.filter(isGearbox) : []
  const connues = new Set(enregistrees.map((boite) => boite.id))
  return [...enregistrees, ...factoryGearboxes().filter((boite) => !connues.has(boite.id))]
}

/** N'enregistre que ce qui n'est pas livré tel quel : le reste se reconstruit. */
export function saveGearboxes(gearboxes: readonly GearboxEntity[]): void {
  const livrees = new Map(factoryGearboxes().map((boite) => [boite.id, boite]))
  const aGarder = gearboxes.filter((boite) => {
    const livree = livrees.get(boite.id)
    return livree === undefined || JSON.stringify(livree) !== JSON.stringify(boite)
  })
  writeJson(GEARBOXES_KEY, aGarder)
}

/** Ajoute ou remplace une boîte, et rend la liste à enregistrer. */
export function upsertGearbox(
  gearboxes: readonly GearboxEntity[],
  gearbox: GearboxEntity,
): GearboxEntity[] {
  const index = gearboxes.findIndex((connue) => connue.id === gearbox.id)
  if (index < 0) return [...gearboxes, gearbox]
  return gearboxes.map((connue, i) => (i === index ? gearbox : connue))
}

/**
 * Retire une boîte.
 *
 * Les profils qui la désignaient gardent leurs valeurs : ils ne perdent pas
 * leurs rapports, ils cessent seulement d'être rattachés.
 */
export function removeGearbox(
  gearboxes: readonly GearboxEntity[],
  id: string,
): GearboxEntity[] {
  return gearboxes.filter((boite) => boite.id !== id)
}

/** Une boîte, seule, dans un fichier lisible. */
export function gearboxToFile(gearbox: GearboxEntity): string {
  return JSON.stringify({ version: GEARBOX_FILE_VERSION, gearbox }, null, 2)
}

/** Relit une boîte exportée, sous un identifiant neuf. */
export function gearboxFromFile(text: string, newId: () => string): GearboxEntity {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new ProfileImportError('Le fichier n’est pas du JSON valide.')
  }
  // Les deux formes sont essayées et non devinées, comme pour un moteur : le
  // piège y était qu'une entité nue porte un champ du même nom que l'enveloppe.
  if (isGearbox(parsed)) return { ...parsed, id: newId() }
  const dansEnveloppe = isRecord(parsed) ? parsed['gearbox'] : undefined
  if (isGearbox(dansEnveloppe)) return { ...dansEnveloppe, id: newId() }
  throw new ProfileImportError('Ce fichier ne contient pas de boîte exploitable.')
}

/**
 * Reconnaît une boîte.
 *
 * Le contrôle porte sur ce sans quoi elle ne pourrait pas passer un rapport :
 * un nom, des rapports, et les deux gestes qu'elle commande.
 */
function isGearbox(value: unknown): value is GearboxEntity {
  if (!isRecord(value)) return false
  const drivetrain = value['drivetrain']
  return (
    typeof value['id'] === 'string' &&
    typeof value['name'] === 'string' &&
    isRecord(drivetrain) &&
    Array.isArray(drivetrain['gearRatios']) &&
    isRecord(value['kickdown']) &&
    isRecord(value['shiftJolt'])
  )
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Comme pour les profils : l'échec d'écriture n'interrompt pas la conduite.
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
