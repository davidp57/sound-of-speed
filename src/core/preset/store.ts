import { createDefaultProfile, createFactoryProfiles } from './defaults'
import { PROFILE_FORMAT_VERSION, type Profile, type ProfileFile } from './schema'
import type { Trace } from '../speed/replay'

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
const TRACES_KEY = 'speed.traces.v1'

/**
 * Traces conservées d'une session à l'autre.
 *
 * Elles ne vivaient qu'en mémoire : un trajet enregistré en roulant disparaissait
 * au premier rechargement, c'est-à-dire avant même d'avoir pu servir. Or c'est
 * justement pour les rejouer plus tard, ailleurs, qu'on les enregistre.
 */
export function loadTraces(): Trace[] {
  const stored = readJson<Trace[]>(TRACES_KEY)
  return Array.isArray(stored) ? stored.filter(isTrace) : []
}

export function saveTraces(traces: Trace[]): boolean {
  try {
    localStorage.setItem(TRACES_KEY, JSON.stringify(traces))
    return true
  } catch {
    // Quota dépassé : les traces longues pèsent lourd. On le signale plutôt que
    // de laisser croire que l'enregistrement est conservé.
    return false
  }
}

function isTrace(value: unknown): value is Trace {
  if (typeof value !== 'object' || value === null) return false
  const t = value as Partial<Trace>
  return typeof t.name === 'string' && Array.isArray(t.samples)
}

/** Sérialise des traces pour un fichier, lisible et réimportable. */
export function tracesToFile(traces: Trace[]): string {
  return JSON.stringify({ version: 1, traces }, null, 2)
}

export function tracesFromFile(text: string): Trace[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new ProfileImportError('Le fichier n’est pas du JSON valide.')
  }
  const list = isRecord(parsed) && Array.isArray(parsed['traces']) ? parsed['traces'] : parsed
  if (!Array.isArray(list)) throw new ProfileImportError('Aucune trace trouvée dans le fichier.')
  const traces = list.filter(isTrace)
  if (traces.length === 0) throw new ProfileImportError('Aucune trace exploitable dans le fichier.')
  return traces
}

export function loadProfiles(): Profile[] {
  const stored = readJson<Profile[]>(STORAGE_KEY)
  if (!stored || !Array.isArray(stored) || stored.length === 0) {
    return createFactoryProfiles()
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

/**
 * Profils d'usine absents de la liste, repérés par leur identifiant.
 *
 * Sert à récupérer un profil livré après coup : celui qui a commencé avec une
 * seule voix n'a aucune raison d'être privé de la suivante, ni de devoir tout
 * ressaisir.
 */
export function missingFactoryProfiles(existing: Profile[]): Profile[] {
  const known = new Set(existing.map((p) => p.id))
  return createFactoryProfiles().filter((p) => !known.has(p.id))
}

/** Sections d'un profil que l'on peut ramener séparément à leur état d'usine. */
export type ProfileSection = 'engine' | 'drivetrain' | 'speed' | 'mix' | 'feel' | 'layers'

/**
 * Profil d'usine dont un profil donné est issu, reconnu à son identifiant.
 *
 * Retourne les valeurs par défaut génériques pour un profil créé de toutes
 * pièces : il vaut mieux une base saine que pas de retour possible.
 */
function factoryOrigin(id: string): Profile {
  return createFactoryProfiles().find((p) => p.id === id) ?? createDefaultProfile()
}

/**
 * Ramène une section — ou le profil entier — à son état d'usine.
 *
 * Un réglage se cherche en tâtonnant, et rien ne permettait jusqu'ici de revenir
 * en arrière : une valeur mal saisie dans la transmission obligeait à supprimer
 * le profil, donc à perdre aussi tout ce qui avait été trouvé ailleurs. La
 * réinitialisation se fait donc section par section, l'identifiant et le nom
 * étant toujours conservés.
 */
export function resetProfileSection(profile: Profile, section: ProfileSection | 'all'): Profile {
  const origin = factoryOrigin(profile.id)
  const kept = { id: profile.id, name: profile.name }
  if (section === 'all') return { ...deepCopy(origin), ...kept }
  return { ...profile, [section]: deepCopy(origin[section]) }
}

/**
 * Copie profonde, sans lien avec l'original.
 *
 * `structuredClone` échoue ici : les profils manipulés par l'interface sont
 * enveloppés dans les mandataires de réactivité de Vue, qu'il refuse de cloner.
 * Un aller-retour par JSON les traverse sans difficulté, un profil ne contenant
 * que des nombres, des chaînes et des booléens.
 */
export function deepCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

/** Copie profonde avec un nouvel identifiant. Sert au bouton « dupliquer ». */
export function duplicateProfile(profile: Profile, name: string): Profile {
  return { ...deepCopy(profile), id: newId(), name }
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
    favorite: profile.favorite === true,
    sampleDir:
      typeof profile.sampleDir === 'string' && profile.sampleDir
        ? profile.sampleDir
        : base.sampleDir,
    engine: { ...base.engine, ...(profile.engine ?? {}) },
    drivetrain: migrateDrivetrain(base, profile.drivetrain),
    speed: { ...base.speed, ...(profile.speed ?? {}) },
    mix: { ...base.mix, ...(profile.mix ?? {}) },
    feel: {
      kickdown: { ...base.feel.kickdown, ...(profile.feel?.kickdown ?? {}) },
      backfire: { ...base.feel.backfire, ...(profile.feel?.backfire ?? {}) },
      shiftJolt: { ...base.feel.shiftJolt, ...(profile.feel?.shiftJolt ?? {}) },
    },
    layers:
      Array.isArray(profile.layers) && profile.layers.length > 0
        ? profile.layers.map(widenNarrowLayer)
        : base.layers,
  }
}

/**
 * Élargit vers le grave les couches restées à l'ancienne borne de lecture.
 *
 * Cette borne valait la moitié de la vitesse nominale, ce qui rendait
 * l'enregistrement haut régime injouable en dessous de la moitié de son régime
 * d'ancrage — soit la majeure partie du domaine sur un moteur de série. Sa
 * hauteur s'y figeait, et on entendait un second moteur tourner à régime
 * constant derrière le premier.
 */
function widenNarrowLayer<T extends { minRate: number }>(layer: T): T {
  return layer.minRate === 0.5 ? { ...layer, minRate: 0.25 } : layer
}

/**
 * Reprend une transmission enregistrée par une version antérieure.
 *
 * Les régimes de passage étaient exprimés par deux fractions du rupteur valables
 * pour tous les rapports. On les convertit en une table par rapport plutôt que
 * de les perdre : un profil réglé à l'oreille ne doit pas être remis à zéro par
 * une mise à jour.
 */
function migrateDrivetrain(
  base: Profile,
  stored: Partial<Profile['drivetrain']> | undefined,
): Profile['drivetrain'] {
  const merged = { ...base.drivetrain, ...(stored ?? {}) }
  if (Array.isArray(stored?.upshiftRpm) && stored.upshiftRpm.length > 0) return merged

  const legacy = stored as { upshiftAtRedlineRatio?: number; upshiftAtLowLoadRatio?: number }
  const full = legacy?.upshiftAtRedlineRatio
  const light = legacy?.upshiftAtLowLoadRatio
  if (typeof full !== 'number' || typeof light !== 'number') return merged

  const redline = base.engine.redlineRpm
  const count = Math.max(1, merged.gearRatios.length - 1)
  // L'ancien seuil à mi-charge devient la valeur de référence, identique pour
  // tous les rapports : c'était précisément le comportement d'avant.
  const middle = redline * ((full + light) / 2)
  merged.upshiftRpm = Array.from({ length: count }, () => Math.round(middle))
  merged.upshiftLoadSpreadRpm = Math.round(redline * (full - light))
  return merged
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
