/**
 * Lire un nom de tranche.
 *
 * Les tranches déposées portent tout ce qu'il faut pour les regrouper dans leur
 * nom : `2026-09-11-06-24-01_da2m_001.jsonl.gz` — la date de début de session,
 * l'identifiant de session, le rang, l'extension. C'est ce qui permet de les
 * trier ensemble et de les recoller dans l'ordre sans ouvrir un seul fichier.
 *
 * Le nom est produit par `SliceBuffer`, qui en est la source de vérité ; cette
 * pièce le relit, et les deux doivent rester d'accord. Un test le vérifie en
 * faisant l'aller-retour plutôt qu'en répétant le format.
 */

export interface SliceRef {
  /** Nom du fichier, tel qu'il est déposé. */
  name: string
  /** Horodatage de début de session, tel que le nom le porte. */
  stamp: string
  /** Identifiant de la session : ce qui réunit les tranches d'un trajet. */
  sessionId: string
  /** Rang de la tranche dans sa session. */
  index: number
}

/**
 * Le rang est sur au moins trois chiffres, et peut en porter davantage.
 *
 * Il saute quand un dépôt échoue — la tranche revient en file et rejoint la
 * suivante, mais son numéro reste consommé, pour qu'aucun fichier n'en écrase
 * un autre. Un lecteur ne doit donc jamais supposer les rangs contigus.
 */
const NAME = /^(.+)_([^_]+)_(\d{3,})\.(.+)$/

export function parseSliceName(name: string): SliceRef | null {
  const found = NAME.exec(name)
  if (found === null) return null
  const [, stamp, sessionId, index] = found
  return { name, stamp: stamp!, sessionId: sessionId!, index: Number(index) }
}

/**
 * Range des tranches par session, chacune dans l'ordre de ses rangs.
 *
 * Les sessions sortent de la plus ancienne à la plus récente, sur l'horodatage
 * que porte leur nom : c'est l'ordre dans lequel les trajets ont eu lieu, et
 * celui dans lequel il faut les cumuler.
 *
 * Ce qui ne se lit pas est ignoré sans bruit. Un dossier de dépôt contient ce
 * que le serveur y a laissé, y compris ce qu'on n'a pas écrit.
 */
export function groupBySession(names: readonly string[]): SliceRef[][] {
  const sessions = new Map<string, SliceRef[]>()

  for (const name of names) {
    const ref = parseSliceName(name)
    if (ref === null) continue
    const key = `${ref.stamp}_${ref.sessionId}`
    const slices = sessions.get(key)
    if (slices === undefined) sessions.set(key, [ref])
    else slices.push(ref)
  }

  return [...sessions.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, slices]) => slices.sort((a, b) => a.index - b.index))
}

/**
 * L'instant où le trajet a commencé, lu dans le nom de la tranche.
 *
 * Le nom porte l'horodatage en temps universel — `SliceBuffer` l'écrit avec
 * `toISOString` — donc la conversion se fait en universel, sans quoi une même
 * tranche daterait de deux heures différentes selon la machine qui la relit.
 *
 * Rend `null` sur un nom qui ne suit pas la convention : le dossier des traces
 * porte encore deux enregistrements manuels d'avant, au nom libre.
 */
export function recordedAtOf(name: string): number | null {
  const ref = parseSliceName(name)
  if (ref === null) return null

  const found = /^(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})$/.exec(ref.stamp)
  if (found === null) return null

  const [, y, mo, d, h, mi, s] = found
  const at = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s))
  return Number.isNaN(at) ? null : at
}
