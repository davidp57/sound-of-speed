import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { rebuild, updateWith, type Folder, type ProfileResult } from './profileur'
import { PROCEDURE_VERSION, emptyAggregate, type CarAggregate } from '../core/calibration/aggregate'

/**
 * Le service qui profile la voiture, sur le serveur.
 *
 * Il regarde le dossier des traces, et refait la mesure dès qu'une tranche
 * arrive. Rien de plus : pas de port ouvert, pas d'interface, pas de base. Ce
 * qu'il produit est un fichier que l'application lit comme elle lit un profil.
 *
 * **Il scrute plutôt qu'il n'écoute.** Le dossier est un volume monté, et la
 * notification de changement d'un système de fichiers distant n'est pas fiable —
 * elle rate des événements ou les invente. Un relevé du dossier toutes les
 * quelques secondes coûte la lecture d'une liste de noms, et ne ment pas.
 *
 * Ce fichier est le seul du service à toucher au disque et à l'horloge : tout
 * le reste est du calcul, éprouvable sans conteneur ni serveur.
 */

/** Ce qu'on relit entre deux tours, pour ne pas repartir de zéro. */
const STATE_FILE = 'profil-voiture.json'
/** Ce qu'on publie, et que l'application lit. */
const RESULT_FILE = 'profil-voiture.json'

/** Intervalle entre deux relevés du dossier, en millisecondes. */
const SCAN_MS = 5000

interface Options {
  traces: string
  out: string
  scanMs: number
}

function options(env: NodeJS.ProcessEnv): Options {
  return {
    traces: env.SPEED_TRACES ?? '/data/traces',
    out: env.SPEED_PROFILES ?? '/data/profils',
    scanMs: Number(env.SPEED_SCAN_MS ?? SCAN_MS),
  }
}

function folderAt(path: string): Folder {
  return {
    list: () => readdir(path),
    read: async (name) => new Uint8Array(await readFile(join(path, name))),
  }
}

/**
 * Écrit le résultat sans jamais le laisser à moitié.
 *
 * L'application peut lire ce fichier à l'instant où on l'écrit. On écrit donc à
 * côté, puis on renomme : un renommage est atomique, une écriture ne l'est pas.
 */
async function publish(dir: string, result: ProfileResult): Promise<void> {
  await mkdir(dir, { recursive: true })
  const body = JSON.stringify(
    {
      procedure: PROCEDURE_VERSION,
      updatedAt: Date.now(),
      aggregate: result.aggregate,
      coverage: result.coverage,
      skipped: result.skipped,
    },
    null,
    2,
  )
  const tmp = join(dir, `${RESULT_FILE}.tmp`)
  await writeFile(tmp, body, 'utf8')
  await rename(tmp, join(dir, RESULT_FILE))
}

async function loadState(dir: string): Promise<CarAggregate> {
  try {
    const raw = await readFile(join(dir, STATE_FILE), 'utf8')
    const parsed = JSON.parse(raw) as { aggregate?: CarAggregate }
    return parsed.aggregate ?? emptyAggregate()
  } catch {
    // Premier démarrage, ou état illisible : on repart du dossier, qui est la
    // source de vérité. L'agrégat n'est qu'un raccourci.
    return emptyAggregate()
  }
}

/**
 * Un tour : voir ce qui est arrivé, et remesurer ce qu'il faut.
 *
 * Rend l'agrégat suivant et la liste des noms connus, que le tour d'après
 * comparera. Séparé de la boucle pour être appelable une fois, dans un test ou
 * à la main.
 */
export async function tick(
  folder: Folder,
  aggregate: CarAggregate,
  known: ReadonlySet<string>,
): Promise<{ result: ProfileResult; names: Set<string> } | null> {
  const names = new Set(await folder.list())
  const fresh = [...names].filter((name) => !known.has(name)).sort()
  if (fresh.length === 0) return null

  // Au premier tour, tout est neuf : on reprend le dossier entier plutôt que de
  // le parcourir tranche par tranche.
  if (known.size === 0) return { result: await rebuild(folder), names }

  let result: ProfileResult | null = null
  let current = aggregate
  for (const name of fresh) {
    result = await updateWith(folder, current, name)
    current = result.aggregate
  }
  return result === null ? null : { result, names }
}

async function main(): Promise<void> {
  const { traces, out, scanMs } = options(process.env)
  const folder = folderAt(traces)
  let aggregate = await loadState(out)
  let known = new Set<string>()

  console.log(`profileur : ${traces} vers ${out}, toutes les ${scanMs} ms`)

  for (;;) {
    try {
      const step = await tick(folder, aggregate, known)
      if (step !== null) {
        aggregate = step.result.aggregate
        known = step.names
        await publish(out, step.result)
        console.log(
          `profil mis à jour : ${aggregate.tripCount} trajets, ` +
            `${step.result.coverage.complete ? 'complet' : 'incomplet'}`,
        )
      }
    } catch (error) {
      // Un dossier absent ou un disque qui hoquette ne doit pas arrêter le
      // service : il réessaiera au tour suivant.
      console.error('profileur :', error instanceof Error ? error.message : error)
    }
    await new Promise((resolve) => setTimeout(resolve, scanMs))
  }
}

// Lancé comme programme, pas comme module : un test importe `tick` sans
// démarrer la boucle.
if (process.argv[1]?.includes('profileur')) void main()
