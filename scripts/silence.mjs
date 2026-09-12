/**
 * Produit le fichier de silence qui maintient la session audio du système.
 *
 * Pourquoi un fichier, et non quelques octets fabriqués en mémoire : sur mobile
 * et sur les navigateurs de bord, le droit de continuer à jouer en arrière-plan
 * dépend de ce que le navigateur compte comme une lecture véritable. Un fichier
 * réel, servi à une adresse fixe et porté par un élément inséré dans le
 * document, en est une ; une adresse `blob:` sur un élément détaché, rien ne le
 * garantit — et le navigateur de la Tesla, un Chromium ancien, la refusait.
 *
 * Pourquoi long : chaque passage de boucle est une occasion de perdre la
 * lecture. Deux minutes valent mieux que quatre secondes, et 8 kbit/s en mono
 * suffisent largement pour du silence — le fichier pèse alors de l'ordre de
 * 120 Ko, ce qui reste acceptable dans le cache hors réseau.
 *
 * Pourquoi dans `public/` et non dans `public/audio/` : cette arborescence
 * n'est pas versionnée, c'est celle des échantillons, qui sont déposés dans un
 * volume du NAS. Le silence, lui, appartient à l'application.
 *
 *   node scripts/silence.mjs
 */

import { execFile } from 'node:child_process'
import { mkdir, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const target = resolve(root, 'public/silence.mp3')

/** Durée, en secondes. */
const SECONDS = 120
/** Débit, en kbit/s. Le plus bas que produise l'encodeur. */
const BITRATE = '8k'
/** Fréquence d'échantillonnage : la plus basse admise par le format. */
const SAMPLE_RATE = 8000

await mkdir(dirname(target), { recursive: true })

await run('ffmpeg', [
  '-hide_banner',
  '-loglevel',
  'error',
  '-y',
  '-f',
  'lavfi',
  '-i',
  `anullsrc=r=${SAMPLE_RATE}:cl=mono`,
  '-t',
  String(SECONDS),
  '-c:a',
  'libmp3lame',
  '-b:a',
  BITRATE,
  target,
])

const { size } = await stat(target)
console.log(`public/silence.mp3 — ${SECONDS} s, ${Math.round(size / 1024)} Ko`)
