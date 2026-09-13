/**
 * Base 64 adaptée aux adresses : sans `+`, `/` ni `=`, qui y seraient réécrits
 * par les messageries et les navigateurs.
 *
 * Deux choses voyagent aujourd'hui dans le fragment d'une adresse — un profil
 * partagé, et le code qui relie un second appareil à un compte. Elles se codent
 * de la même façon, et c'est la même fonction.
 */

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function base64UrlDecode(text: string): Uint8Array {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}
