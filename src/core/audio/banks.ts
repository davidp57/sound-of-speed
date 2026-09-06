/**
 * Banques d'échantillons déposées sur le serveur.
 *
 * Une banque est un dossier de `/audio/` : les prises d'un moteur, et rien
 * d'autre. Un profil en désigne une par son `sampleDir`, et jusqu'ici il
 * fallait taper ce nom sans savoir s'il existait ni ce qu'il contenait.
 *
 * La liste vient de nginx lui-même, qui sait rendre le contenu d'un dossier en
 * JSON : c'est le mécanisme de la bibliothèque de profils (`preset/library.ts`)
 * pris à l'envers — on garde les dossiers au lieu de les écarter.
 *
 * **Rien n'est demandé au visiteur**, là où la bibliothèque de profils exige le
 * compte de dépôt : les échantillons se chargent sans compte, sinon aucun son
 * ne sortirait. Lister ne montre donc que ce qui est déjà servi.
 *
 * Un serveur qui ne sait pas lister — c'est le cas du serveur de développement,
 * et c'était celui de la production avant ce lot — rend une liste vide. Ce
 * n'est pas une panne : l'appelant s'en tient alors au nom déclaré par le
 * profil.
 */

/** Emplacement des banques, servi par le même hôte que l'application. */
const AUDIO_PATH = '/audio/'

/**
 * Ce qui compte comme fichier audio.
 *
 * La liste ne restreint pas ce que l'application sait lire — le décodage
 * travaille sur les octets bruts et accepte ce que le navigateur accepte. Elle
 * sert seulement à ne pas compter une note de licence ou un brouillon laissé
 * dans le dossier.
 */
const AUDIO_EXTENSIONS = ['.wav', '.flac', '.mp3', '.ogg', '.m4a', '.opus']

export interface Bank {
  /** Nom du dossier, tel qu'il s'écrit dans le `sampleDir` d'un profil. */
  name: string
  /** Fichiers audio qu'il contient, triés par nom. */
  files: string[]
}

/** Entrée du listage JSON produit par nginx. */
interface AutoIndexEntry {
  name?: string
  type?: string
}

/** Contenu d'un dossier, ou rien du tout si le serveur ne le dit pas. */
async function listDirectory(path: string, fetchImpl: typeof fetch): Promise<AutoIndexEntry[]> {
  try {
    const response = await fetchImpl(path, { headers: { Accept: 'application/json' } })
    if (!response.ok) return []
    const listing: unknown = await response.json()
    return Array.isArray(listing) ? (listing as AutoIndexEntry[]) : []
  } catch {
    return []
  }
}

/** Noms retenus d'un listage, dossiers ou fichiers selon `wantDirectories`. */
function names(entries: AutoIndexEntry[], wantDirectories: boolean): string[] {
  return entries
    .filter((entry) => (entry.type === 'directory') === wantDirectories)
    .map((entry) => entry.name ?? '')
    .filter((name) => name !== '')
}

function isAudioFile(name: string): boolean {
  const lower = name.toLowerCase()
  return AUDIO_EXTENSIONS.some((extension) => lower.endsWith(extension))
}

/** Banques présentes sur le serveur, triées par nom. */
export async function fetchBanks(fetchImpl: typeof fetch = fetch): Promise<Bank[]> {
  const directories = names(await listDirectory(AUDIO_PATH, fetchImpl), true)

  const banks = await Promise.all(
    directories.map(async (name) => {
      const entries = await listDirectory(`${AUDIO_PATH}${encodeURIComponent(name)}/`, fetchImpl)
      return { name, files: names(entries, false).filter(isAudioFile).sort(compareNames) }
    }),
  )

  return banks.sort((a, b) => compareNames(a.name, b.name))
}

function compareNames(a: string, b: string): number {
  return a.localeCompare(b, 'fr')
}
