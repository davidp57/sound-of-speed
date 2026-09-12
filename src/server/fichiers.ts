/**
 * Servir des fichiers : l'application, ses ressources, les échantillons.
 *
 * C'est le métier que nginx faisait, et les pièges qu'il faut reprendre avec.
 * Ils ne sont pas décoratifs : chacun, perdu, casse quelque chose de silencieux,
 * et le jeu de requêtes de `scripts/accord/` les tient tous.
 */

import { createReadStream, statSync } from 'node:fs'
import { join, normalize, sep } from 'node:path'
import { Readable } from 'node:stream'

/**
 * Les types que le navigateur **exige**, et que personne ne devine.
 *
 * `instantiateStreaming` refuse un binaire WebAssembly annoncé autrement
 * qu'en `application/wasm` : le moteur simulé ne démarre alors pas du tout. Un
 * module annoncé en texte ou en octets ne s'importe pas davantage. Le FLAC, lui,
 * est sans conséquence pour la lecture — le décodage travaille sur les octets —
 * mais autant annoncer le bon.
 */
const TYPES: Record<string, string> = {
  css: 'text/css; charset=utf-8',
  flac: 'audio/flac',
  html: 'text/html; charset=utf-8',
  js: 'application/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8',
  mjs: 'application/javascript; charset=utf-8',
  mp3: 'audio/mpeg',
  png: 'image/png',
  svg: 'image/svg+xml',
  wasm: 'application/wasm',
  wav: 'audio/wav',
  webmanifest: 'application/manifest+json',
  gz: 'application/gzip',
  jsonl: 'application/x-ndjson',
  ico: 'image/x-icon',
  woff2: 'font/woff2',
}

export function typeDe(chemin: string): string {
  const extension = chemin.split('.').pop()?.toLowerCase() ?? ''
  return TYPES[extension] ?? 'application/octet-stream'
}

/**
 * Un chemin d'URL devient un chemin de fichier, ou rien.
 *
 * Rien, c'est ce qu'on rend dès qu'une adresse cherche à sortir du dossier
 * qu'on sert. Un serveur de fichiers qui ne fait pas ce contrôle sert la base de
 * données, les clés, et tout ce que le processus peut lire.
 */
export function cheminSur(racine: string, chemin: string): string | null {
  let decode: string
  try {
    decode = decodeURIComponent(chemin)
  } catch {
    return null
  }
  if (decode.includes('\0')) return null

  const relatif = normalize(decode).replace(/^[\\/]+/, '')
  if (relatif === '..' || relatif.startsWith(`..${sep}`)) return null

  return join(racine, relatif)
}

/** Ce qu'on sait d'un fichier, ou rien s'il n'en est pas un. */
export function fichierOuRien(chemin: string): { taille: number } | null {
  try {
    const info = statSync(chemin)
    return info.isFile() ? { taille: info.size } : null
  } catch {
    return null
  }
}

export interface OptionsDeService {
  /** Ce que l'on met dans `Cache-Control`, quand on met quelque chose. */
  cache?: string
}

/**
 * Rend un fichier, en honorant une demande de plage d'octets.
 *
 * **Les plages ne sont pas une option.** Le navigateur les demande de lui-même
 * sur les médias, et le média silencieux qui tient la session audio en est un :
 * il tourne en boucle pendant toute la conduite. Un serveur qui rend tout le
 * fichier à chaque demande de plage marche, mais transfère sans raison — sur une
 * banque de vingt-trois mégaoctets, à travers un réseau de téléphone, la raison
 * devient visible.
 */
export function servirFichier(
  chemin: string,
  taille: number,
  entetes: Headers,
  options: OptionsDeService = {},
): Response {
  const base: Record<string, string> = {
    'Content-Type': typeDe(chemin),
    // Sans cela, aucun client ne sait qu'il peut demander une plage, et le
    // navigateur télécharge le média entier avant de le jouer.
    'Accept-Ranges': 'bytes',
  }
  if (options.cache !== undefined) base['Cache-Control'] = options.cache

  const plage = plageDemandee(entetes.get('range'), taille)

  if (plage === 'invalide') {
    return new Response(null, {
      status: 416,
      headers: { ...base, 'Content-Range': `bytes */${taille}` },
    })
  }

  if (plage === null) {
    return new Response(fluxDe(chemin), {
      status: 200,
      headers: { ...base, 'Content-Length': String(taille) },
    })
  }

  const { debut, fin } = plage
  return new Response(fluxDe(chemin, debut, fin), {
    status: 206,
    headers: {
      ...base,
      'Content-Length': String(fin - debut + 1),
      'Content-Range': `bytes ${debut}-${fin}/${taille}`,
    },
  })
}

function fluxDe(chemin: string, debut?: number, fin?: number): ReadableStream {
  const flux = createReadStream(chemin, debut === undefined ? {} : { start: debut, end: fin })
  return Readable.toWeb(flux) as ReadableStream
}

/**
 * Lit un en-tête de plage, et dit ce qu'il faut en faire.
 *
 * Rend `null` quand il n'y a rien à honorer — pas d'en-tête, ou une forme qu'on
 * ne traite pas —, auquel cas on sert le fichier entier, ce que la norme permet.
 * Rend `'invalide'` quand la plage est bien formée mais hors du fichier : là il
 * faut refuser, sinon le client reçoit des octets qu'il n'a pas demandés et
 * croit les avoir.
 *
 * Une seule plage est traitée. Les plages multiples existent, le client de ce
 * projet n'en demande pas, et les servir demanderait un corps en plusieurs
 * parties — du travail pour personne.
 */
export function plageDemandee(
  entete: string | null,
  taille: number,
): { debut: number; fin: number } | null | 'invalide' {
  if (entete === null) return null

  const lu = /^bytes=(\d*)-(\d*)$/.exec(entete.trim())
  if (lu === null) return null

  const [, brutDebut, brutFin] = lu
  if (brutDebut === '' && brutFin === '') return null

  // `bytes=-500` : les cinq cents derniers octets.
  if (brutDebut === '') {
    const combien = Number(brutFin)
    if (combien === 0) return 'invalide'
    return { debut: Math.max(0, taille - combien), fin: taille - 1 }
  }

  const debut = Number(brutDebut)
  if (debut >= taille) return 'invalide'

  const fin = brutFin === '' ? taille - 1 : Math.min(Number(brutFin), taille - 1)
  if (fin < debut) return 'invalide'

  return { debut, fin }
}
