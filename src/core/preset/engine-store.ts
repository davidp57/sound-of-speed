/**
 * Les moteurs enregistrés, et ceux qui sont livrés.
 *
 * Un moteur est devenu une entité qu'on nomme — voir `engine-entity.ts`. Il lui
 * faut un endroit pour vivre en dehors du profil qui l'a fait naître, sans quoi
 * « partager un moteur seul » et « corriger un moteur pour tous les profils qui
 * le désignent » restent des mots.
 *
 * **Ce qui est livré, ce sont les deux profils d'usine**, et non les neuf
 * entrées de la bibliothèque de définitions. C'est un choix, et il tient à ce
 * qu'un moteur est ici : ces neuf entrées portent des cotes et un échappement,
 * pas de banque — elles ne sonnent pas. En faire des moteurs prétendrait qu'on
 * peut les écouter. Elles restent ce qu'elles sont : un catalogue de définitions
 * pour l'atelier, qu'on applique à un moteur qui, lui, a un son.
 *
 * Le stockage suit le modèle des profils : lecture et écriture tolérantes à
 * l'échec, parce qu'un navigateur peut refuser son stockage local et que cela ne
 * doit jamais interrompre la conduite.
 */

import { createFactoryProfiles } from './defaults'
import { engineFromProfile, type EngineEntity } from './engine-entity'
import { ProfileImportError } from './store'

const ENGINES_KEY = 'speed.engines.v1'

/** Version du fichier d'export d'un moteur. */
export const ENGINE_FILE_VERSION = 1

/**
 * Les moteurs livrés : un par profil d'usine.
 *
 * Route et Sport ne sont pas le même moteur — leurs rupteurs sont à 6 500 et
 * 8 500 tours, et leurs banques diffèrent —, donc deux entrées et non une.
 */
export function factoryEngines(): EngineEntity[] {
  return createFactoryProfiles().map((profil) => ({
    ...engineFromProfile(profil),
    source: `livré avec l'application (profil « ${profil.name} »)`,
  }))
}

/**
 * Tous les moteurs disponibles : les enregistrés, puis les livrés qui restent.
 *
 * Un moteur enregistré qui porte l'identifiant d'un moteur livré **remplace**
 * celui-ci au lieu de s'ajouter à côté : c'est le même moteur, qu'on a corrigé.
 * Deux entrées du même nom dans la liste seraient le plus sûr moyen de choisir
 * la mauvaise.
 */
export function loadEngines(): EngineEntity[] {
  const stored = readJson<EngineEntity[]>(ENGINES_KEY)
  const enregistres = Array.isArray(stored) ? stored.filter(isEngine) : []
  const connus = new Set(enregistres.map((moteur) => moteur.id))
  return [...enregistres, ...factoryEngines().filter((moteur) => !connus.has(moteur.id))]
}

/** N'enregistre que ce qui n'est pas livré tel quel : le reste se reconstruit. */
export function saveEngines(engines: readonly EngineEntity[]): void {
  const livres = new Map(factoryEngines().map((moteur) => [moteur.id, moteur]))
  const aGarder = engines.filter((moteur) => {
    const livre = livres.get(moteur.id)
    return livre === undefined || JSON.stringify(livre) !== JSON.stringify(moteur)
  })
  writeJson(ENGINES_KEY, aGarder)
}

/**
 * Ajoute ou remplace un moteur, et rend la liste à enregistrer.
 *
 * Remplace quand l'identifiant est déjà connu : enregistrer deux fois le même
 * moteur après l'avoir affiné doit donner une entrée corrigée, pas une
 * deuxième.
 */
export function upsertEngine(
  engines: readonly EngineEntity[],
  engine: EngineEntity,
): EngineEntity[] {
  const index = engines.findIndex((connu) => connu.id === engine.id)
  if (index < 0) return [...engines, engine]
  return engines.map((connu, i) => (i === index ? engine : connu))
}

/**
 * Retire un moteur.
 *
 * Les profils qui le désignaient gardent leurs valeurs : ils ne deviennent pas
 * muets, ils cessent seulement d'être rattachés. C'est le comportement d'avant
 * l'entité, et c'est le seul qui ne fasse rien perdre.
 */
export function removeEngine(
  engines: readonly EngineEntity[],
  id: string,
): EngineEntity[] {
  return engines.filter((moteur) => moteur.id !== id)
}

/** Un moteur, seul, dans un fichier lisible. */
export function engineToFile(engine: EngineEntity): string {
  return JSON.stringify({ version: ENGINE_FILE_VERSION, engine }, null, 2)
}

/**
 * Relit un moteur exporté.
 *
 * Il reçoit un identifiant neuf : recevoir le moteur de quelqu'un d'autre ne
 * doit pas écraser le sien parce que les deux sont nés du même profil d'usine.
 */
export function engineFromFile(text: string, newId: () => string): EngineEntity {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new ProfileImportError('Le fichier n’est pas du JSON valide.')
  }
  // Les deux formes sont essayées, et non devinées : un moteur porte lui-même un
  // champ `engine` — ses réglages —, si bien qu'un moteur écrit nu ressemblait à
  // l'enveloppe `{ version, engine }` et qu'on en lisait les réglages à la place
  // du moteur entier.
  if (isEngine(parsed)) return { ...parsed, id: newId() }
  const dansEnveloppe = isRecord(parsed) ? parsed['engine'] : undefined
  if (isEngine(dansEnveloppe)) return { ...dansEnveloppe, id: newId() }
  throw new ProfileImportError('Ce fichier ne contient pas de moteur exploitable.')
}

/**
 * Reconnaît un moteur.
 *
 * Le contrôle porte sur ce sans quoi il ne sonnerait pas : un nom, des réglages,
 * une banque, des couches, un mixage. Les cotes et l'échappement sont
 * facultatifs — un moteur à échantillons n'en a pas besoin, et c'est le cas de
 * tous ceux qui roulent.
 */
function isEngine(value: unknown): value is EngineEntity {
  if (!isRecord(value)) return false
  return (
    typeof value['id'] === 'string' &&
    typeof value['name'] === 'string' &&
    isRecord(value['engine']) &&
    typeof value['sampleDir'] === 'string' &&
    Array.isArray(value['layers']) &&
    isRecord(value['mix'])
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
    // Comme pour les profils : l'échec d'écriture ne doit pas interrompre la
    // conduite.
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
