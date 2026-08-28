#!/usr/bin/env node
/**
 * Compression des échantillons.
 *
 * Les prises brutes sont en flottant 32 bits : environ 5,7 Mo pour un seul
 * moteur, ce qui est inutilement lourd à charger en 4G dans une voiture.
 *
 * Le format retenu est FLAC, et ce choix n'est pas anodin. Les codecs avec
 * perte — AAC en particulier — insèrent un silence d'amorçage en tête de
 * fichier : sur une boucle, ce silence revient à chaque tour et s'entend comme
 * un hoquet. FLAC est sans perte et sans amorçage, donc la boucle reste
 * exactement celle qu'on a calée, pour à peu près la moitié du poids.
 *
 *   node scripts/transcode.mjs [dossier]
 *
 * Les fichiers d'origine ne sont pas touchés. Une fois converti, il reste à
 * changer l'extension dans l'écran de configuration, couche par couche.
 */

import { execFile } from 'node:child_process'
import { readdir, stat } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)
const root = process.argv[2] ?? 'public/audio'

/** Parcourt récursivement un dossier et retourne les fichiers WAV rencontrés. */
async function findWavs(directory) {
  const found = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) found.push(...(await findWavs(path)))
    else if (extname(entry.name).toLowerCase() === '.wav') found.push(path)
  }
  return found
}

function format(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} Mo`
}

const wavs = await findWavs(root).catch(() => [])
if (wavs.length === 0) {
  console.log(`Aucun fichier WAV sous ${root}.`)
  process.exit(0)
}

let before = 0
let after = 0

for (const source of wavs) {
  const target = join(
    source.slice(0, source.length - basename(source).length),
    `${basename(source, extname(source))}.flac`,
  )

  try {
    // -compression_level 8 : le meilleur rapport temps/taille du codeur. Le
    // décodage reste tout aussi rapide quel que soit le niveau.
    await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', source, '-compression_level', '8', target])
  } catch (error) {
    console.error(`Échec sur ${source} : ${error.message}`)
    continue
  }

  const from = (await stat(source)).size
  const to = (await stat(target)).size
  before += from
  after += to
  const saved = Math.round((1 - to / from) * 100)
  console.log(`${basename(source).padEnd(24)} ${format(from).padStart(9)} → ${format(to).padStart(9)}  (−${saved} %)`)
}

console.log(`\nTotal : ${format(before)} → ${format(after)} (−${Math.round((1 - after / before) * 100)} %)`)
console.log("Pensez à changer l'extension des couches dans l'écran de configuration.")
