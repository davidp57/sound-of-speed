import { createDefaultProfile } from './defaults'
import { PROFILE_FORMAT_VERSION, type Profile, type ProfileFile } from './schema'

/**
 * Persistance des profils.
 *
 * Le stockage local suffit : il n'y a pas de compte, pas de serveur, et un
 * profil se transporte très bien en JSON. L'export produit un fichier lisible et
 * modifiable à la main, l'import l'avale et le valide champ par champ — un
 * profil venu d'ailleurs ne doit pas pouvoir casser l'application avec une
 * valeur manquante.
 */

const STORAGE_KEY = 'speed.profiles.v1'
const SELECTED_KEY = 'speed.selectedProfile.v1'

export function loadProfiles(): Profile[] {
  const stored = readJson<Profile[]>(STORAGE_KEY)
  if (!stored || !Array.isArray(stored) || stored.length === 0) {
    return [createDefaultProfile()]
  }
  return stored.map((profile) => reconcile(profile))
}

export function saveProfiles(profiles: Profile[]): void {
  writeJson(STORAGE_KEY, profiles)
}

export function loadSelectedId(): string | null {
  try {
    return localStorage.getItem(SELECTED_KEY)
  } catch {
    return null
  }
}

export function saveSelectedId(id: string): void {
  try {
    localStorage.setItem(SELECTED_KEY, id)
  } catch {
    // Navigation privée, quota plein : ce n'est pas une raison pour tout arrêter.
  }
}

/** Copie profonde avec un nouvel identifiant. Sert au bouton « dupliquer ». */
export function duplicateProfile(profile: Profile, name: string): Profile {
  return { ...structuredClone(profile), id: newId(), name }
}

export function newId(): string {
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

/** Sérialise un profil dans le format de fichier, prêt à être téléchargé. */
export function toFile(profile: Profile): string {
  const payload: ProfileFile = { version: PROFILE_FORMAT_VERSION, profile }
  return JSON.stringify(payload, null, 2)
}

export class ProfileImportError extends Error {}

/**
 * Lit un fichier de profil. Chaque champ absent est remplacé par sa valeur par
 * défaut plutôt que de faire échouer l'import : un profil exporté par une
 * version antérieure reste utilisable.
 */
export function fromFile(text: string): Profile {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new ProfileImportError('Le fichier n’est pas du JSON valide.')
  }

  if (!isRecord(parsed)) throw new ProfileImportError('Le fichier est vide ou mal formé.')

  const candidate = isRecord(parsed['profile']) ? parsed['profile'] : parsed
  if (!isRecord(candidate)) throw new ProfileImportError('Aucun profil trouvé dans le fichier.')

  return reconcile({ ...(candidate as Partial<Profile>), id: newId() } as Profile)
}

/**
 * Complète un profil partiel avec les valeurs par défaut, section par section.
 * Les couches sont reprises telles quelles si elles existent, parce qu'elles
 * dépendent des fichiers présents et qu'aucune valeur par défaut n'y a de sens.
 */
function reconcile(profile: Partial<Profile>): Profile {
  const base = createDefaultProfile()
  return {
    id: typeof profile.id === 'string' && profile.id ? profile.id : newId(),
    name: typeof profile.name === 'string' && profile.name ? profile.name : base.name,
    sampleDir:
      typeof profile.sampleDir === 'string' && profile.sampleDir
        ? profile.sampleDir
        : base.sampleDir,
    engine: { ...base.engine, ...(profile.engine ?? {}) },
    drivetrain: { ...base.drivetrain, ...(profile.drivetrain ?? {}) },
    speed: { ...base.speed, ...(profile.speed ?? {}) },
    mix: { ...base.mix, ...(profile.mix ?? {}) },
    layers:
      Array.isArray(profile.layers) && profile.layers.length > 0
        ? profile.layers
        : base.layers,
  }
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
    // Idem : l'échec d'écriture ne doit pas interrompre la conduite.
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
