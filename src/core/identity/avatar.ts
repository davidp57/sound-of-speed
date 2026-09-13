/**
 * Le portrait d'un compte : celui du fournisseur, celui de Gravatar, ou rien.
 *
 * **Trois sources, dans cet ordre.** Un compte tenu ailleurs rend souvent une
 * image, et c'est la meilleure : elle vient avec le compte, sans rien demander
 * à personne. Sinon, Gravatar en propose une à qui en a déposé une chez lui.
 * Sinon, l'initiale du nom suffit — et c'est ce qu'on voit dans la voiture, qui
 * est hors réseau et n'affichera aucune des deux.
 *
 * **Gravatar coûte quelque chose, et il faut le dire.** Demander l'image envoie
 * l'empreinte de l'adresse à un serveur qui n'est pas le nôtre, ce qui lui
 * apprend qu'un compte porteur de cette adresse existe ici. L'écran le dit, et
 * ne demande rien tant que le compte n'a pas d'adresse à lui.
 */

/** Où Gravatar sert les portraits. */
const GRAVATAR = 'https://www.gravatar.com/avatar'

/**
 * L'adresse, mise dans la forme que Gravatar attend : sans espaces, en
 * minuscules. Deux graphies de la même adresse doivent donner la même image.
 */
export function normaliserPourGravatar(adresse: string): string {
  return adresse.trim().toLowerCase()
}

/**
 * Le lien du portrait, pour une empreinte déjà calculée.
 *
 * `d=404` demande une erreur plutôt qu'une image inventée : sans lui, Gravatar
 * rend un motif géométrique pour tout le monde, et on ne saurait plus si la
 * personne a déposé un portrait ou non. L'écran retombe sur l'initiale.
 */
export function lienDeGravatar(empreinte: string, taille = 128): string {
  return `${GRAVATAR}/${empreinte}?s=${taille}&d=404`
}

/**
 * L'empreinte SHA-256 d'une adresse, en hexadécimal minuscule.
 *
 * Rend `null` quand le navigateur ne sait pas la calculer — `crypto.subtle`
 * n'existe qu'en contexte sécurisé, donc pas sur un `http://` de développement.
 * Ce n'est pas une panne : il n'y a simplement pas de portrait Gravatar, et
 * l'initiale prend la place.
 */
export async function empreinteDeLAdresse(
  adresse: string,
  // `null` et non `undefined` : passer `undefined` à un paramètre qui a une
  // valeur par défaut reprend cette valeur, et le cas « pas de crypto » serait
  // alors intestable.
  sujet: SubtleCrypto | null = globalThis.crypto?.subtle ?? null,
): Promise<string | null> {
  const normalisee = normaliserPourGravatar(adresse)
  if (normalisee === '' || sujet === null) return null

  try {
    const octets = await sujet.digest('SHA-256', new TextEncoder().encode(normalisee))
    return [...new Uint8Array(octets)].map((octet) => octet.toString(16).padStart(2, '0')).join('')
  } catch {
    return null
  }
}

/**
 * La lettre qui tient lieu de portrait.
 *
 * Prise sur le nom, ou sur l'adresse à défaut. Toujours une seule : deux
 * initiales demanderaient de deviner où coupe un nom, et `houle-paisible-47`
 * n'a pas de prénom.
 */
export function initialeDe(nom: string, adresse?: string): string {
  const source = (nom.trim() !== '' ? nom : (adresse ?? '')).trim()
  const premiere = [...source].find((lettre) => /\p{L}|\p{N}/u.test(lettre))
  return premiere === undefined ? '?' : premiere.toUpperCase()
}
