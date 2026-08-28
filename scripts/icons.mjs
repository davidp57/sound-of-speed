#!/usr/bin/env node
/**
 * Génère les icônes de l'application.
 *
 *   npm run icons
 *
 * Elles sont dessinées plutôt que dessinées puis importées : le motif est un arc
 * de compteur, quelques dizaines de lignes de géométrie, et le produire par le
 * code évite de trimballer des binaires dans un dépôt qui n'en contient aucun.
 * Changer la couleur ou la forme se fait ici, et les quatre tailles suivent.
 *
 * L'encodeur PNG est écrit à la main pour la même raison : il tient en une
 * cinquantaine de lignes avec le zlib de Node, contre une dépendance de plus.
 */

import { deflateSync } from 'node:zlib'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const BACKGROUND = [0x15, 0x18, 0x1d]
const ACCENT = [0xe8, 0xb0, 0x4b]
const DIM = [0x3a, 0x42, 0x50]

/** Échantillons par axe pour le lissage des bords. */
const SUPERSAMPLE = 3

/**
 * Un arc de compteur : la graduation complète en gris, la portion parcourue en
 * doré, et l'aiguille au bout.
 *
 * @param scale Fraction du côté occupée par le motif. Réduite pour les icônes
 *              masquables, dont le système peut rogner les bords jusqu'à 20 %.
 */
function draw(size, scale) {
  const pixels = Buffer.alloc(size * size * 4)
  const centre = size / 2
  const radius = size * scale * 0.5
  const thickness = radius * 0.22

  // De sept heures à cinq heures, comme un compteur de voiture.
  const startAngle = Math.PI * 0.75
  const sweep = Math.PI * 1.5
  const filled = sweep * 0.68

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0
      let g = 0
      let b = 0

      for (let sy = 0; sy < SUPERSAMPLE; sy += 1) {
        for (let sx = 0; sx < SUPERSAMPLE; sx += 1) {
          const px = x + (sx + 0.5) / SUPERSAMPLE - centre
          const py = y + (sy + 0.5) / SUPERSAMPLE - centre
          const colour = shade(px, py, radius, thickness, startAngle, sweep, filled)
          r += colour[0]
          g += colour[1]
          b += colour[2]
        }
      }

      const samples = SUPERSAMPLE * SUPERSAMPLE
      const offset = (y * size + x) * 4
      pixels[offset] = Math.round(r / samples)
      pixels[offset + 1] = Math.round(g / samples)
      pixels[offset + 2] = Math.round(b / samples)
      pixels[offset + 3] = 255
    }
  }

  return pixels
}

function shade(px, py, radius, thickness, startAngle, sweep, filled) {
  const distance = Math.hypot(px, py)
  if (Math.abs(distance - radius) > thickness / 2) return BACKGROUND

  // Angle ramené dans l'intervalle de l'arc, sens horaire depuis son départ.
  let angle = Math.atan2(py, px) - startAngle
  while (angle < 0) angle += Math.PI * 2
  while (angle > Math.PI * 2) angle -= Math.PI * 2
  if (angle > sweep) return BACKGROUND

  return angle <= filled ? ACCENT : DIM
}

/** Assemble un PNG en couleurs vraies, sans transparence utile. */
function encodePng(size, pixels) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // huit bits par canal
  header[9] = 6 // rouge, vert, bleu, alpha
  header[10] = 0
  header[11] = 0
  header[12] = 0

  // Chaque ligne est précédée de son octet de filtre ; zéro, aucun filtre.
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y += 1) {
    const from = y * size * 4
    const to = y * (size * 4 + 1)
    raw[to] = 0
    pixels.copy(raw, to + 1, from, from + size * 4)
  }

  return Buffer.concat([
    signature,
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([length, body, crc])
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

const targets = [
  { file: 'icon-192.png', size: 192, scale: 0.78 },
  { file: 'icon-512.png', size: 512, scale: 0.78 },
  // Le système peut rogner jusqu'à 20 % des bords d'une icône masquable pour la
  // découper à sa forme : le motif est resserré en conséquence.
  { file: 'icon-maskable-512.png', size: 512, scale: 0.56 },
  { file: 'apple-touch-icon.png', size: 180, scale: 0.78 },
]

const directory = 'public/icons'
await mkdir(directory, { recursive: true })

for (const { file, size, scale } of targets) {
  const png = encodePng(size, draw(size, scale))
  await writeFile(join(directory, file), png)
  console.log(`${file.padEnd(26)} ${size}×${size}  ${(png.length / 1024).toFixed(1)} ko`)
}
