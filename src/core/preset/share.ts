import { deepCopy, newId } from './store'
import type { Profile } from './schema'

/**
 * Partage d'un profil par lien.
 *
 * Le profil voyage dans l'adresse elle-même, compressé : ni serveur, ni compte,
 * ni base de données. Le lien s'envoie par n'importe quel moyen, et fonctionne
 * même en dehors du réseau où l'application est hébergée.
 *
 * Le fragment — ce qui suit le `#` — est choisi à dessein : il n'est jamais
 * transmis au serveur, ni inscrit dans ses journaux. Un profil n'a rien de
 * secret, mais l'habitude est bonne.
 */

/** Longueur au-delà de laquelle un lien devient difficile à manipuler. */
const COMFORTABLE_LENGTH = 1800

export interface SharedProfile {
  profile: Profile
  /** Vrai si le lien a dû être produit sans compression. */
  uncompressed: boolean
}

/**
 * Encode un profil pour une adresse.
 *
 * Les échantillons ne voyagent pas : ce sont des fichiers, parfois plusieurs
 * mégaoctets, et le destinataire les a déjà s'il utilise la même banque. Seuls
 * leurs noms suivent, ce qui suffit à retrouver le réglage.
 */
export async function encodeProfile(profile: Profile): Promise<string> {
  const payload = JSON.stringify({ v: 1, p: stripForSharing(profile) })
  const compressed = await compress(payload)
  return compressed ?? `u${base64UrlEncode(new TextEncoder().encode(payload))}`
}

export async function decodeProfile(token: string): Promise<Profile> {
  const body = token.slice(1)
  const bytes = base64UrlDecode(body)
  const text =
    token.startsWith('c') ? await decompress(bytes) : new TextDecoder().decode(bytes)
  if (text === null) throw new Error('Lien illisible.')

  const parsed: unknown = JSON.parse(text)
  if (typeof parsed !== 'object' || parsed === null || !('p' in parsed)) {
    throw new Error('Ce lien ne contient pas de profil.')
  }
  // L'identifiant est renouvelé : un profil reçu ne doit pas écraser le sien.
  return { ...(parsed as { p: Profile }).p, id: newId() }
}

/** Adresse complète, prête à être envoyée ou transformée en code. */
export async function shareUrl(profile: Profile, origin: string): Promise<string> {
  return `${origin}/#p=${await encodeProfile(profile)}`
}

export function isComfortable(url: string): boolean {
  return url.length <= COMFORTABLE_LENGTH
}

/**
 * L'adresse est-elle joignable depuis un autre appareil ?
 *
 * Un lien produit depuis le poste de développement porte l'adresse de ce poste :
 * il ne mènera nulle part ailleurs. Le code à scanner paraît pourtant valide, et
 * l'on ne comprend l'échec qu'une fois le téléphone en main.
 */
export function isReachableOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return false
    // Adresses de réseau local : joignables du wifi de la maison, pas au-delà.
    return !/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)
  } catch {
    return true
  }
}

/** Retire du profil ce qui n'a pas de sens à voyager. */
function stripForSharing(profile: Profile): Profile {
  const copy = deepCopy(profile)
  copy.favorite = false
  return copy
}

async function compress(text: string): Promise<string | null> {
  if (typeof CompressionStream === 'undefined') return null
  try {
    const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('deflate-raw'))
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer())
    return `c${base64UrlEncode(bytes)}`
  } catch {
    return null
  }
}

async function decompress(bytes: Uint8Array): Promise<string | null> {
  if (typeof DecompressionStream === 'undefined') return null
  try {
    const stream = new Blob([bytes as BlobPart])
      .stream()
      .pipeThrough(new DecompressionStream('deflate-raw'))
    return await new Response(stream).text()
  } catch {
    return null
  }
}

/**
 * Base 64 adaptée aux adresses : sans `+`, `/` ni `=`, qui y seraient réécrits
 * par les messageries et les navigateurs.
 */
function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(text: string): Uint8Array {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/**
 * Profil éventuellement présent dans l'adresse courante.
 *
 * Le fragment est effacé après lecture : recharger la page ne doit pas réimporter
 * indéfiniment le même profil.
 */
export async function readProfileFromUrl(): Promise<Profile | null> {
  const match = /[#&]p=([^&]+)/.exec(window.location.hash)
  if (!match?.[1]) return null
  try {
    const profile = await decodeProfile(match[1])
    history.replaceState(null, '', window.location.pathname + window.location.search)
    return profile
  } catch {
    history.replaceState(null, '', window.location.pathname + window.location.search)
    return null
  }
}
