
/**
 * Ce que la base rend à la voiture au lancement.
 *
 * Le pendant de la remontée : une fois que les réglages vivent en base, le
 * navigateur de la voiture peut perdre son stockage sans que rien ne se perde,
 * et ce qu'on règle au bureau se retrouve au volant.
 *
 * **La voiture reste le patron.** Elle garde sa copie et écrit dedans tout de
 * suite, y compris hors réseau ; ce module ne fait qu'un geste, au lancement :
 * prendre ce que la base a de plus récent. Il ne synchronise rien en continu, et
 * un profil qu'on est en train de régler ne se fait donc pas remplacer sous les
 * doigts.
 *
 * **Comment on sait ce qui est plus récent.** Le listage porte la date de chaque
 * entrée — celle que l'autoindex de nginx rendait déjà. On garde ici, par
 * fichier, la date de la dernière version qu'on a vue ; ce qui porte une date
 * plus grande est nouveau pour nous. Comparer les dates de deux horloges
 * différentes serait faux : ici, les deux dates viennent du serveur.
 *
 * **Ce qui attend de partir ne se fait pas écraser.** Un réglage fait dans un
 * tunnel dort dans la file de dépôt ; le rapatrier reviendrait à le remplacer
 * par la version d'avant, c'est-à-dire à perdre exactement ce que la file
 * servait à garder.
 */

/** Les clés de stockage gardent le préfixe `speed.`, comme toutes les autres. */
const VU_KEY = 'speed.vu.v1'

/** Une entrée de listage, dans la forme de l'autoindex. */
export interface EntreeDistante {
  name: string
  type?: string
  mtime?: string
}

/** Ce qu'on a déjà vu : par fichier, la date de la version appliquée. */
export type DejaVu = Record<string, number>

export function cle(folder: string, name: string): string {
  return `${folder}${name}`
}

export function loadDejaVu(): DejaVu {
  try {
    const brut = localStorage.getItem(VU_KEY)
    if (brut === null) return {}
    const lu: unknown = JSON.parse(brut)
    if (typeof lu !== 'object' || lu === null) return {}
    const vu: DejaVu = {}
    for (const [k, v] of Object.entries(lu as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v)) vu[k] = v
    }
    return vu
  } catch {
    return {}
  }
}

/** Rend faux quand l'écriture a échoué, comme le reste du stockage. */
export function saveDejaVu(vu: DejaVu): boolean {
  try {
    localStorage.setItem(VU_KEY, JSON.stringify(vu))
    return true
  } catch {
    return false
  }
}

export interface ARapatrier {
  name: string
  /** La date rendue par le serveur, en millisecondes. */
  quand: number
}

/**
 * Ce qu'il y a à prendre dans un listage.
 *
 * Une entrée sans date est prise **une fois** puis retenue : mieux vaut la lire
 * pour rien que la manquer parce qu'un serveur ne date pas ses listages.
 */
export function aRapatrier(
  folder: string,
  entrees: readonly EntreeDistante[],
  vu: DejaVu,
  enAttente: readonly string[],
): ARapatrier[] {
  const attendus = new Set(enAttente)

  return entrees.flatMap((entree) => {
    if (typeof entree.name !== 'string' || entree.name === '') return []
    if (entree.type !== undefined && entree.type !== 'file') return []

    const clef = cle(folder, entree.name)
    // Ce qui attend de partir est plus récent que tout ce que la base peut
    // rendre : c'est la modification qu'on vient de faire.
    if (attendus.has(clef)) return []

    const quand = entree.mtime === undefined ? 0 : Date.parse(entree.mtime)
    const connu = vu[clef]
    if (Number.isNaN(quand)) return []
    if (connu !== undefined && quand <= connu) return []

    return [{ name: entree.name, quand }]
  })
}

/**
 * Le listage d'un dossier, ou rien.
 *
 * Rien plutôt qu'une erreur : hors réseau, sans compte, ou sur un dossier vide,
 * il n'y a simplement pas de nouvelle à prendre — et le lancement ne doit ni
 * attendre ni se plaindre.
 */
export async function listerDistant(
  folder: string,
  fetchImpl: typeof fetch = fetch,
): Promise<EntreeDistante[]> {
  try {
    const reponse = await fetchImpl(folder, {
      headers: { Accept: 'application/json' },
    })
    if (!reponse.ok) return []
    const lu: unknown = await reponse.json()
    return Array.isArray(lu) ? (lu as EntreeDistante[]) : []
  } catch {
    return []
  }
}

/** Le contenu d'un fichier distant, ou rien. */
export async function lireDistant(
  folder: string,
  name: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  try {
    const reponse = await fetchImpl(folder + encodeURIComponent(name), {
    })
    if (!reponse.ok) return null
    return await reponse.text()
  } catch {
    return null
  }
}
