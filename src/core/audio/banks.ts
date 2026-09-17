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

/**
 * Fichiers qu'un profil déclare et que la banque n'a pas.
 *
 * Une banque nouvelle a rarement les mêmes noms de fichiers que l'ancienne :
 * c'est le premier écueil quand on en change, et il se découvrait jusqu'ici à
 * l'activation du son, sous la forme d'un silence.
 *
 * Sans banque connue — serveur qui ne liste pas, banque tapée à la main — rien
 * n'est signalé : ne rien savoir n'est pas savoir qu'il manque quelque chose.
 */
export function missingFiles(bank: Bank | undefined, declared: string[]): string[] {
  if (bank === undefined) return []
  const present = new Set(bank.files)
  return declared.filter((file) => file !== '' && !present.has(file))
}

/**
 * Banques qu'au moins un profil utilise.
 *
 * Sert à libérer le cache : les échantillons y restent indéfiniment, par
 * construction — ils ne dépendent pas de la version du code, et c'est ce qui
 * évite de retélécharger plusieurs mégaoctets à chaque mise à jour. Essayer
 * trois banques en laisse donc trois dans le cache d'un téléphone.
 */
export function usedBanks(profiles: { sampleDir: string }[]): string[] {
  return [...new Set(profiles.map((profile) => profile.sampleDir).filter((name) => name !== ''))]
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

/**
 * Ce qu'on dit quand une banque ne se charge pas, et si relancer peut aboutir.
 *
 * Le message affiché était le nom du fichier suivi du code HTTP —
 * `on-1021.flac : 404`. Il ne disait ni de quelle banque il s'agissait (le même
 * nom de prise existe dans plusieurs), ni que le profil n'était pas jouable
 * ici, ni quoi faire. Le diagnostic a demandé une conversation le 17 septembre
 * 2026 ; il tenait dans une phrase.
 *
 * Les quatre cas ne mènent pas au même geste, et c'est pourquoi ils ne
 * partagent pas une phrase :
 *
 * - **Absente** — 404. Changer de profil rend le son tout de suite. C'est aussi
 *   ce que rend une banque réservée à d'autres comptes, et c'est voulu : dire
 *   « interdit » confirmerait son existence (`serveur.ts`, route `/audio/*`).
 * - **Sans compte** — 401. Le serveur ferme les échantillons depuis DURCIR ;
 *   l'application s'ouvre un compte toute seule, donc ce cas veut dire que
 *   l'ouverture a échoué, pas qu'il faut s'inscrire.
 * - **Injoignable** — le `fetch` n'aboutit pas. Dans un tunnel, ce n'est pas
 *   une panne : le cache sert les banques déjà écoutées, et seule une banque
 *   jamais chargée manque à l'appel.
 * - **Autre** — un 5xx. Réessayer a du sens, on ne sait pas plus.
 */
export interface BankLoadFailure {
  /** Une phrase, qui nomme la banque et dit le geste. */
  message: string
  /** Vrai quand relancer le chargement peut aboutir sans rien changer d'autre. */
  canRetry: boolean
}

/** Cause d'un chargement manqué : le code HTTP, ou l'absence de réponse. */
export type BankLoadCause = number | 'unreachable'

export function describeBankLoadFailure(bank: string, cause: BankLoadCause): BankLoadFailure {
  const nom = bank === '' ? 'demandée' : bank
  if (cause === 'unreachable') {
    return {
      message: `Pas de réseau, et la banque ${nom} n’a jamais été chargée ici.`,
      canRetry: true,
    }
  }
  if (cause === 404) {
    return {
      message: `Banque ${nom} absente de ce serveur : choisissez un autre profil.`,
      canRetry: false,
    }
  }
  if (cause === 401 || cause === 403) {
    return {
      message: `La banque ${nom} demande un compte : ouvrez l’écran Compte.`,
      canRetry: false,
    }
  }
  return { message: `La banque ${nom} n’a pas pu être chargée (erreur ${cause}).`, canRetry: true }
}
