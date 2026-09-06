import type { UploadKind } from './consent'
import type { QueuedUpload } from './queue'

/**
 * La file gardée d'une session à l'autre.
 *
 * Sans cela, un rechargement de page — ou le navigateur de la voiture qui reprend
 * la main — perdrait ce qui n'était pas encore parti, c'est-à-dire précisément ce
 * qui a été enregistré hors réseau.
 */

const QUEUE_KEY = 'speed.uploads.v1'

const KINDS: UploadKind[] = ['journal', 'measurement', 'profile', 'trace']

export function loadQueue(): QueuedUpload[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // Filtrées une par une : une entrée corrompue ne doit pas emporter celles
    // qui sont saines.
    return parsed.filter(isQueued)
  } catch {
    return []
  }
}

/** Rend faux quand l'écriture a échoué, pour que l'écran puisse le dire. */
export function saveQueue(items: readonly QueuedUpload[]): boolean {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items))
    return true
  } catch {
    return false
  }
}

function isQueued(value: unknown): value is QueuedUpload {
  if (typeof value !== 'object' || value === null) return false
  const entry = value as Record<string, unknown>
  return (
    typeof entry['id'] === 'string' &&
    typeof entry['folder'] === 'string' &&
    typeof entry['name'] === 'string' &&
    typeof entry['body'] === 'string' &&
    typeof entry['queuedAt'] === 'number' &&
    KINDS.includes(entry['kind'] as UploadKind)
  )
}
