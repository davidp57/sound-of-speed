/**
 * Le code qui relie un second appareil au compte de la voiture.
 *
 * **Tout est dans le fragment** — ce qui suit le `#` —, qui n'est jamais transmis
 * au serveur ni inscrit dans ses journaux. C'est le motif du partage de profil,
 * déjà en place, et ici il compte davantage : ce qui voyage ouvre un compte.
 *
 * **Un jeton, deux rendus.** Le lien porte le même code court que celui qu'on
 * recopie à la main sur un appareil sans caméra. Rien à encoder, donc : huit
 * caractères tiennent tels quels dans une adresse, et un code à scanner qui
 * porte peu se lit de plus loin.
 */

/** Ce qui ouvre le compte, une fois. */
export type CodeDeLiaison = string

/** La clé du fragment. Courte : elle se retrouve dans un code à scanner. */
const CLE = 'lier'

/** L'adresse complète à faire scanner, depuis l'origine où l'on se trouve. */
export function lienDeLiaison(origine: string, code: CodeDeLiaison): string {
  return `${origine}/#${CLE}=${encodeURIComponent(code)}`
}

/**
 * Le code éventuellement présent dans l'adresse courante.
 *
 * **Le fragment est effacé tout de suite**, avant même qu'on sache s'il vaut
 * quelque chose : il ouvre un compte, et il n'a rien à faire dans la barre
 * d'adresse d'une page qu'on laisse ouverte, ni dans l'historique du navigateur.
 */
export function lireLienDansUrl(): CodeDeLiaison | null {
  const trouve = new RegExp(`[#&]${CLE}=([^&]+)`).exec(window.location.hash)
  if (trouve?.[1] === undefined) return null
  history.replaceState(null, '', window.location.pathname + window.location.search)
  try {
    const code = decodeURIComponent(trouve[1])
    return code === '' ? null : code
  } catch {
    return null
  }
}
