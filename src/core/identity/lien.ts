/**
 * Le code qui relie un second appareil au compte de la voiture.
 *
 * **Tout est dans le fragment** — ce qui suit le `#` —, qui n'est jamais transmis
 * au serveur ni inscrit dans ses journaux. C'est le motif du partage de profil,
 * déjà en place, et ici il compte davantage : ce qui voyage ouvre un compte.
 *
 * **Un lien, et non des identifiants à recopier.** L'adresse d'un compte anonyme
 * ressemble à `afwfxnmq…@anonymous.placeholder.invalid` ; la taper à la main sur
 * l'écran d'une voiture serait une punition. On scanne, ou on suit le lien.
 */

import { base64UrlDecode, base64UrlEncode } from '../base64url'

/** Ce qui ouvre le compte. */
export interface CoupleDeLiaison {
  email: string
  motDePasse: string
}

/** La clé du fragment. Courte : elle se retrouve dans un code à scanner. */
const CLE = 'lier'

export function encoderLien(couple: CoupleDeLiaison): string {
  const texte = JSON.stringify({ v: 1, e: couple.email, p: couple.motDePasse })
  return base64UrlEncode(new TextEncoder().encode(texte))
}

export function decoderLien(jeton: string): CoupleDeLiaison | null {
  try {
    const lu: unknown = JSON.parse(new TextDecoder().decode(base64UrlDecode(jeton)))
    if (typeof lu !== 'object' || lu === null) return null
    const champs = lu as Record<string, unknown>
    const email = champs['e']
    const motDePasse = champs['p']
    if (typeof email !== 'string' || email === '') return null
    if (typeof motDePasse !== 'string' || motDePasse === '') return null
    return { email, motDePasse }
  } catch {
    return null
  }
}

/** L'adresse complète à faire scanner, depuis l'origine où l'on se trouve. */
export function lienDeLiaison(origine: string, couple: CoupleDeLiaison): string {
  return `${origine}/#${CLE}=${encoderLien(couple)}`
}

/**
 * Le couple éventuellement présent dans l'adresse courante.
 *
 * **Le fragment est effacé tout de suite**, avant même qu'on sache s'il vaut
 * quelque chose : il ouvre un compte, et il n'a rien à faire dans la barre
 * d'adresse d'une page qu'on laisse ouverte, ni dans l'historique du navigateur.
 */
export function lireLienDansUrl(): CoupleDeLiaison | null {
  const trouve = new RegExp(`[#&]${CLE}=([^&]+)`).exec(window.location.hash)
  if (trouve?.[1] === undefined) return null
  history.replaceState(null, '', window.location.pathname + window.location.search)
  return decoderLien(trouve[1])
}
