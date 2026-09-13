import { gunzipSync } from 'node:zlib'

import { groupBySession, type SliceRef } from '../../core/upload/slice-name'
import { traceFromCapture } from '../../core/calibration/from-capture'
import { coverageOf, type Coverage } from '../../core/calibration/coverage'
import {
  digestOf,
  emptyAggregate,
  needsRebuild,
  withTrip,
  type CarAggregate,
} from '../../core/calibration/aggregate'
import type { CaptureLine } from '../../core/capture/capture'

/**
 * Le profileur : ce que le serveur fait des traces déposées.
 *
 * Il relit les tranches d'un trajet, les mesure avec le code d'étalonnage, et
 * complète ce qu'il sait de la voiture. Rien d'autre : il ne décide pas ce qu'on
 * en fait, il ne parle à personne, et il ne connaît ni le réseau ni l'horloge.
 *
 * Les accès au disque lui sont **donnés**, pas pris : c'est ce qui permet de
 * l'éprouver sur un dossier rapatrié, ou sur rien du tout, sans conteneur ni
 * NAS. La seule chose qu'il fait lui-même est de décompresser, parce que c'est
 * du calcul.
 *
 * Il importe le cœur tel quel — `from-capture`, `segments`, `braking`,
 * `aggregate`, `coverage`. C'est tout l'intérêt de le tenir en Node : **un seul
 * calcul**, celui que l'écran d'étalonnage emploie déjà. Un service écrit
 * ailleurs donnerait deux procédés pour la même grandeur, et ils divergeraient.
 */

/** Ce que le profileur a besoin de savoir faire du dossier. */
export interface Folder {
  /** Les noms des fichiers présents, dans n'importe quel ordre. */
  list: () => Promise<string[]>
  /** Le contenu brut d'un fichier. */
  read: (name: string) => Promise<Uint8Array>
}

export interface ProfileResult {
  aggregate: CarAggregate
  coverage: Coverage
  /** Ce qui n'a pas pu être lu, nommé. Une tranche perdue n'arrête pas le reste. */
  skipped: string[]
  /**
   * Les tranches que ce passage a regardées, quoi qu'il en ait tiré.
   *
   * Regardé n'est pas mesuré : une tranche illisible, une session trop courte
   * dont rien ne sort, un nom libre que le regroupement ne voit pas — toutes ont
   * été **vues**, et c'est ce que l'appelant a besoin de savoir pour ne pas
   * garder à jamais ce dont il n'y avait rien à tirer.
   */
  seen: string[]
}

/**
 * Reprend tout depuis le dossier.
 *
 * Employé au premier démarrage, et quand le procédé a changé : un agrégat
 * construit avec un procédé corrigé ne vaut plus rien, ses capacités ayant été
 * cumulées sans retour possible.
 */
export async function rebuild(folder: Folder): Promise<ProfileResult> {
  // Tout le dossier a été vu, y compris ce que le regroupement ne reconnaît pas :
  // deux traces anciennes portent un nom libre, et « rien à en tirer » est une
  // réponse.
  const seen = await folder.list()
  const sessions = groupBySession(seen)
  let aggregate = emptyAggregate()
  const skipped: string[] = []

  for (const slices of sessions) {
    const digest = await readSession(folder, slices, skipped)
    if (digest === null) continue
    aggregate = withTrip(aggregate, digest)
  }

  return { aggregate, coverage: coverageOf(aggregate), skipped, seen }
}

/**
 * Reprend le seul trajet qu'une tranche vient de compléter.
 *
 * C'est le chemin courant : une tranche arrive toutes les cinq minutes en
 * roulant, et relire l'historique entier à chaque fois tient aujourd'hui et ne
 * tiendra pas dans six mois. Seules les tranches de ce trajet sont relues, et
 * son résultat remplace sa version précédente dans l'agrégat.
 */
export async function updateWith(
  folder: Folder,
  aggregate: CarAggregate,
  sliceName: string,
): Promise<ProfileResult> {
  if (needsRebuild(aggregate)) return rebuild(folder)

  const sessions = groupBySession(await folder.list())
  const session = sessions.find((slices) => slices.some((slice) => slice.name === sliceName))
  if (session === undefined) {
    return { aggregate, coverage: coverageOf(aggregate), skipped: [sliceName], seen: [] }
  }

  const seen = session.map((slice) => slice.name)
  const skipped: string[] = []
  const digest = await readSession(folder, session, skipped)
  if (digest === null) return { aggregate, coverage: coverageOf(aggregate), skipped, seen }

  const next = withTrip(aggregate, digest)
  return { aggregate: next, coverage: coverageOf(next), skipped, seen }
}

/**
 * Lit et mesure une session entière.
 *
 * Une tranche illisible ne fait pas tomber le trajet : elle est écartée et
 * nommée. Un trajet à moitié lu reste exploitable ; c'est un trajet muet qui ne
 * l'est pas.
 */
async function readSession(
  folder: Folder,
  slices: readonly SliceRef[],
  skipped: string[],
): Promise<ReturnType<typeof digestOf> | null> {
  const lines: CaptureLine[] = []
  let startedAt = 0

  for (const slice of slices) {
    let text: string
    try {
      text = decode(await folder.read(slice.name), slice.name)
    } catch {
      skipped.push(slice.name)
      continue
    }
    for (const raw of text.split('\n')) {
      const trimmed = raw.trim()
      if (trimmed.length === 0) continue
      let parsed: unknown
      try {
        parsed = JSON.parse(trimmed)
      } catch {
        // Une ligne tronquée en fin de tranche : le reste du fichier vaut
        // toujours, et un dépôt coupé au milieu d'une ligne est le cas normal
        // d'un réseau qui lâche.
        continue
      }
      const line = parsed as { kind?: string; startedAt?: number }
      if (line.kind === 'header') {
        if (startedAt === 0 && typeof line.startedAt === 'number') startedAt = line.startedAt
        continue
      }
      lines.push(parsed as CaptureLine)
    }
  }

  if (lines.length === 0) return null

  const first = slices[0]!
  const trace = traceFromCapture(first.sessionId, lines, { startedAt })
  if (trace.samples.length === 0) return null

  return digestOf(first.sessionId, trace)
}

function decode(bytes: Uint8Array, name: string): string {
  const raw = name.endsWith('.gz') ? gunzipSync(bytes) : bytes
  return new TextDecoder().decode(raw)
}
