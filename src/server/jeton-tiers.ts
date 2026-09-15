/**
 * Ce qu'un fournisseur dit de la personne, lu dans le jeton qu'il a signé.
 *
 * **On ne vérifie pas la signature ici, et c'est délibéré.** Ce jeton vient
 * d'être validé par la bibliothèque avant d'être écrit en base : il a servi à
 * ouvrir la session. Le revérifier demanderait les clés publiques du
 * fournisseur, donc un appel réseau, pour rejouer un contrôle déjà passé.
 *
 * Ce module ne sert donc **qu'à lire ce qui est déjà acquis**, jamais à décider
 * d'un accès. Si un jour on lit un jeton dont l'origine n'est pas établie, cette
 * fonction n'est pas la bonne.
 */

export interface DitDuFournisseur {
  /** L'adresse, en minuscules. `null` si le jeton n'en porte pas. */
  email: string | null
  /** L'adresse du portrait, s'il y en a un. */
  image: string | null
}

const RIEN: DitDuFournisseur = { email: null, image: null }

/**
 * Lit la charge utile d'un jeton d'identité.
 *
 * Rend des champs vides sur tout ce qui n'a pas la forme attendue : un jeton
 * absent, tronqué, ou dont la charge n'est pas un objet. Un fournisseur qui
 * répond de travers ne doit pas empêcher un rattachement de se faire.
 */
export function lireLeJeton(jeton: string | null | undefined): DitDuFournisseur {
  if (typeof jeton !== 'string') return RIEN

  const morceaux = jeton.split('.')
  if (morceaux.length < 2) return RIEN

  let charge: unknown
  try {
    charge = JSON.parse(base64UrlEnTexte(morceaux[1] ?? ''))
  } catch {
    return RIEN
  }
  if (typeof charge !== 'object' || charge === null) return RIEN

  const champs = charge as Record<string, unknown>
  return {
    email: uneAdresse(champs['email']),
    image: uneAdresseWeb(champs['picture']),
  }
}

/**
 * L'adresse qu'un compte doit porter après ce rattachement.
 *
 * `null` quand il n'y a rien à changer — le compte a déjà une vraie adresse, ou
 * le fournisseur n'en donne pas. **Une adresse choisie ne se fait jamais
 * remplacer** : quelqu'un qui s'est enregistré avec son adresse puis rattache un
 * compte tiers garde la sienne, le tiers n'étant qu'une preuve de plus.
 */
export function adresseARetenir(
  adresseActuelle: string | null | undefined,
  ditLeFournisseur: DitDuFournisseur,
): string | null {
  if (ditLeFournisseur.email === null) return null
  if (!estUneAdresseDeRemplacement(adresseActuelle)) return null
  return ditLeFournisseur.email
}

/**
 * L'adresse que le greffon anonyme fabrique, faute d'en avoir une.
 *
 * Elle se reconnaît à son domaine réservé : `.invalid` ne peut pas exister sur
 * Internet, c'est ce que sa réservation garantit. `compte.ts` s'appuie déjà
 * dessus pour refuser qu'on s'enregistre avec.
 */
export function estUneAdresseDeRemplacement(adresse: string | null | undefined): boolean {
  return typeof adresse === 'string' && adresse.toLowerCase().endsWith('.invalid')
}

function uneAdresse(valeur: unknown): string | null {
  if (typeof valeur !== 'string') return null
  const nette = valeur.trim().toLowerCase()
  // Une adresse de remplacement rendue par un fournisseur n'en est pas une :
  // la retenir remplacerait un faux par un autre.
  if (!nette.includes('@') || nette.endsWith('.invalid')) return null
  return nette
}

function uneAdresseWeb(valeur: unknown): string | null {
  if (typeof valeur !== 'string') return null
  const nette = valeur.trim()
  return nette.startsWith('https://') ? nette : null
}

/** Base64 URL — celui des jetons — vers le texte qu'il porte. */
function base64UrlEnTexte(morceau: string): string {
  const base64 = morceau.replace(/-/g, '+').replace(/_/g, '/')
  const complet = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
  return Buffer.from(complet, 'base64').toString('utf8')
}
