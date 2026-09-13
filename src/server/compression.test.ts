/**
 * Ce qu'on vérifie ici : le serveur compresse ce qui se compresse, et **rien
 * d'autre**.
 *
 * nginx le faisait, le serveur qui l'a remplacé ne le faisait plus, et personne
 * ne l'avait vu : la voiture tirait trois cents kilo-octets de JavaScript là où
 * gzip en fait cent. C'est de loin le premier poste de ce qu'elle charge au
 * démarrage — bien avant le découpage des écrans.
 *
 * Les deux bords comptent autant que le cas nominal : une plage d'octets ne se
 * compresse pas — le client demande des octets d'un fichier, pas d'un flux —, et
 * `gzip;q=0` est un refus explicite qui contient le mot « gzip ».
 */

import { statSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { servirFichier } from './fichiers'

/** Un vrai fichier de texte du dépôt : gros, et compressible. */
const TEXTE = 'package-lock.json'

let dossier: string
/** Un faux échantillon : le poids d'un média, et son extension. */
let media: string

beforeAll(() => {
  dossier = mkdtempSync(join(tmpdir(), 'compression-'))
  media = join(dossier, 'on-800.flac')
  writeFileSync(media, Buffer.alloc(64 * 1024, 7))
})

afterAll(() => {
  try {
    rmSync(dossier, { recursive: true, force: true })
  } catch {
    // Le ménage n'est pas ce qu'on vérifie.
  }
})

function servir(chemin: string, entetes: Record<string, string> = {}): Response {
  return servirFichier(chemin, statSync(chemin).size, new Headers(entetes))
}

describe('la compression', () => {
  it('compresse un fichier de texte, et le dit', async () => {
    const taille = statSync(TEXTE).size
    const reponse = servir(TEXTE, { 'accept-encoding': 'gzip, deflate, br' })

    expect(reponse.headers.get('Content-Encoding')).toBe('gzip')
    // Sans quoi un cache intermédiaire resservirait la version compressée à un
    // client qui ne l'accepte pas.
    expect(reponse.headers.get('Vary')).toBe('Accept-Encoding')
    // La taille finale n'est pas connue avant d'avoir tout compressé.
    expect(reponse.headers.get('Content-Length')).toBeNull()

    const octets = new Uint8Array(await reponse.arrayBuffer())
    expect(octets.length).toBeLessThan(taille / 2)
  })

  it('ne compresse pas pour un client qui n’en demande pas', () => {
    expect(servir(TEXTE).headers.get('Content-Encoding')).toBeNull()
    expect(servir(TEXTE).headers.get('Content-Length')).toBe(String(statSync(TEXTE).size))
  })

  it('ne compresse pas quand le client refuse par `q=0`', () => {
    // Le refus contient le mot qu'on cherchait : une recherche de sous-chaîne
    // dirait oui à qui vient de dire non.
    const reponse = servir(TEXTE, { 'accept-encoding': 'br, gzip;q=0' })
    expect(reponse.headers.get('Content-Encoding')).toBeNull()
  })

  it('ne recompresse pas un échantillon', () => {
    // Du FLAC est déjà compressé : le repasser au gzip coûte du temps pour
    // rien, parfois pour plus gros.
    const reponse = servir(media, { 'accept-encoding': 'gzip' })
    expect(reponse.headers.get('Content-Encoding')).toBeNull()
  })

  it('ne compresse jamais une plage d’octets', () => {
    // Le client demande les octets d'un fichier, pas d'un flux compressé — et
    // c'est ainsi que le média silencieux tient la session audio.
    const reponse = servir(TEXTE, { 'accept-encoding': 'gzip', range: 'bytes=0-1023' })

    expect(reponse.status).toBe(206)
    expect(reponse.headers.get('Content-Encoding')).toBeNull()
    expect(reponse.headers.get('Content-Length')).toBe('1024')
  })

  it('laisse tel quel ce qui est trop petit pour y gagner', () => {
    const petit = join(dossier, 'court.json')
    writeFileSync(petit, '{"a":1}')

    expect(servir(petit, { 'accept-encoding': 'gzip' }).headers.get('Content-Encoding')).toBeNull()
  })
})
