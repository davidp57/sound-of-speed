import { sendsAutomatically, type UploadConsent, type UploadKind } from './consent'

/**
 * Ce que le navigateur de la voiture porte depuis des mois, et qui doit rejoindre
 * la base.
 *
 * Les profils, les moteurs, les boîtes et les traces ont vécu jusqu'ici dans le
 * stockage local, qui n'est sauvegardé nulle part et disparaît avec le
 * navigateur qui le porte — un cache vidé, une mise à jour. Ce module tient la
 * liste de ce qui reste à faire remonter, et rien d'autre : l'envoi lui-même
 * passe par la file de dépôt, qui sait déjà survivre à une coupure de réseau.
 *
 * **Elle se fait une fois, et par petites poignées.** La file garde au plus
 * vingt-quatre dépôts et quatre mégaoctets ; y verser d'un coup toutes les
 * traces d'un stockage plein en ferait tomber la moitié. Ce qui reste est donc
 * gardé ici, et repris au démarrage suivant si l'envoi s'est interrompu.
 *
 * **Elle n'efface rien.** Le stockage local reste ce qu'il est ; c'est le ticket
 * suivant qui décide ce que la voiture relit, et l'effacement des anciennes
 * sources ne se fera qu'après vérification.
 */

/** Les clés de stockage gardent le préfixe `speed.`, comme toutes les autres. */
const REPRISE_KEY = 'speed.reprise.v1'

/** Ce qui remonte, et sous quel accord. */
export type SorteReprise = 'profile' | 'engine' | 'gearbox' | 'trace'

/** Un élément à faire remonter, désigné par son identifiant dans sa liste. */
export interface ARemonter {
  sorte: SorteReprise
  id: string
}

/**
 * L'accord exigé par sorte.
 *
 * Une trace demande le cran étendu, comme un dépôt ordinaire : elle porte la
 * conduite à la cadence du GPS, et une reprise n'est pas une raison de passer
 * outre ce que l'utilisateur a accepté.
 */
const ACCORD: Record<SorteReprise, UploadKind> = {
  profile: 'profile',
  engine: 'profile',
  gearbox: 'profile',
  trace: 'trace',
}

export function accordePour(sorte: SorteReprise, consent: UploadConsent): boolean {
  return sendsAutomatically(consent, ACCORD[sorte])
}

/** Ce qu'il y a à reprendre, dans l'ordre où on le fera. */
export function planDeReprise(sources: {
  profiles: readonly { id: string }[]
  engines: readonly { id: string }[]
  gearboxes: readonly { id: string }[]
  traces: readonly { startedAt: number }[]
}): ARemonter[] {
  return [
    // Les réglages d'abord : ils sont petits, ils partent en un souffle, et ce
    // sont eux qu'on perdrait le plus bêtement. Les traces ensuite, qui pèsent
    // mille fois plus et peuvent attendre le trajet suivant.
    ...sources.profiles.map((entree) => ({ sorte: 'profile' as const, id: entree.id })),
    ...sources.engines.map((entree) => ({ sorte: 'engine' as const, id: entree.id })),
    ...sources.gearboxes.map((entree) => ({ sorte: 'gearbox' as const, id: entree.id })),
    ...sources.traces.map((trace) => ({ sorte: 'trace' as const, id: String(trace.startedAt) })),
  ]
}

/**
 * Ce qui reste à remonter, ou `null` si la reprise n'a jamais commencé.
 *
 * La distinction compte : une liste vide veut dire « tout est parti », et une
 * absence « on n'a pas encore regardé ». Les confondre relancerait la reprise à
 * chaque démarrage, sur un stockage qui a peut-être changé entre-temps.
 */
export function loadReprise(): ARemonter[] | null {
  try {
    const brut = localStorage.getItem(REPRISE_KEY)
    if (brut === null) return null
    const lu: unknown = JSON.parse(brut)
    if (!Array.isArray(lu)) return null
    return lu.filter(estARemonter)
  } catch {
    return null
  }
}

/** Rend faux quand l'écriture a échoué, comme le reste du stockage. */
export function saveReprise(restant: readonly ARemonter[]): boolean {
  try {
    localStorage.setItem(REPRISE_KEY, JSON.stringify(restant))
    return true
  } catch {
    return false
  }
}

/**
 * Ce qu'on peut envoyer maintenant : le début de la liste, filtré par l'accord.
 *
 * Ce que l'accord ne couvre pas **reste dans la liste** au lieu d'être écarté :
 * une trace refusée aujourd'hui partira le jour où le cran étendu sera donné, et
 * la jeter reviendrait à décider à la place de l'utilisateur qu'il ne changera
 * pas d'avis.
 */
export function prochains(
  restant: readonly ARemonter[],
  consent: UploadConsent,
  combien: number,
): ARemonter[] {
  if (combien <= 0) return []
  return restant.filter((entree) => accordePour(entree.sorte, consent)).slice(0, combien)
}

/** Reste-t-il quelque chose que l'accord d'aujourd'hui laisserait partir ? */
export function resteAFaire(restant: readonly ARemonter[], consent: UploadConsent): boolean {
  return restant.some((entree) => accordePour(entree.sorte, consent))
}

/** Retire de la liste ce qui vient de partir. */
export function sansCeuxLa(
  restant: readonly ARemonter[],
  partis: readonly ARemonter[],
): ARemonter[] {
  const cles = new Set(partis.map((entree) => `${entree.sorte}:${entree.id}`))
  return restant.filter((entree) => !cles.has(`${entree.sorte}:${entree.id}`))
}

function estARemonter(valeur: unknown): valeur is ARemonter {
  if (typeof valeur !== 'object' || valeur === null) return false
  const entree = valeur as Record<string, unknown>
  return (
    typeof entree['id'] === 'string' &&
    typeof entree['sorte'] === 'string' &&
    entree['sorte'] in ACCORD
  )
}
