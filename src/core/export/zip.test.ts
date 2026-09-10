import { describe, expect, it } from 'vitest'

import { buildZip, crc32, dosDateTime, type ZipEntry } from './zip'

const encodeur = new TextEncoder()
const decodeur = new TextDecoder()

/**
 * Un lecteur de ZIP, écrit pour le test seulement.
 *
 * Il lit le répertoire central plutôt que d'enchaîner les en-têtes locaux :
 * c'est ce que font les vrais lecteurs, donc c'est la partie qu'il faut
 * vérifier. Un paquet dont les en-têtes locaux seraient justes mais le
 * répertoire faux passerait un test naïf et refuserait de s'ouvrir.
 */
function relire(paquet: Uint8Array): { path: string; texte: string }[] {
  const vue = new DataView(paquet.buffer, paquet.byteOffset, paquet.byteLength)

  // La fin du répertoire central est en queue, taille fixe ici puisqu'on
  // n'écrit jamais de commentaire d'archive.
  const fin = paquet.length - 22
  expect(vue.getUint32(fin, true)).toBe(0x06054b50)
  const nombre = vue.getUint16(fin + 10, true)
  const tailleCentrale = vue.getUint32(fin + 12, true)
  const debutCentral = vue.getUint32(fin + 16, true)
  expect(debutCentral + tailleCentrale).toBe(fin)

  const entrees: { path: string; texte: string }[] = []
  let position = debutCentral
  for (let i = 0; i < nombre; i += 1) {
    expect(vue.getUint32(position, true)).toBe(0x02014b50)
    const crc = vue.getUint32(position + 16, true)
    const taille = vue.getUint32(position + 24, true)
    const longueurNom = vue.getUint16(position + 28, true)
    const offsetLocal = vue.getUint32(position + 42, true)
    const nom = decodeur.decode(paquet.subarray(position + 46, position + 46 + longueurNom))

    // L'en-tête local doit annoncer le même nom, sans quoi le lecteur cherche
    // les données au mauvais endroit.
    expect(vue.getUint32(offsetLocal, true)).toBe(0x04034b50)
    expect(vue.getUint16(offsetLocal + 26, true)).toBe(longueurNom)
    const debutDonnees = offsetLocal + 30 + longueurNom
    const donnees = paquet.subarray(debutDonnees, debutDonnees + taille)
    expect(crc32(donnees)).toBe(crc)

    entrees.push({ path: nom, texte: decodeur.decode(donnees) })
    position += 46 + longueurNom
  }
  return entrees
}

function entree(path: string, texte: string): ZipEntry {
  return { path, bytes: encodeur.encode(texte) }
}

describe('crc32', () => {
  it('donne la valeur de référence du format', () => {
    // Valeur publiée pour « hello » : c'est le seul moyen de vérifier la table
    // sans réimplémenter l'algorithme dans le test.
    expect(crc32(encodeur.encode('hello'))).toBe(0x3610a686)
  })

  it('rend zéro sur un contenu vide', () => {
    expect(crc32(new Uint8Array(0))).toBe(0)
  })

  it("change dès qu'un octet change", () => {
    expect(crc32(encodeur.encode('trace-a'))).not.toBe(crc32(encodeur.encode('trace-b')))
  })
})

describe('dosDateTime', () => {
  it('encode une date après 1980', () => {
    const { time, date } = dosDateTime(new Date(2026, 8, 10, 14, 35, 20))
    expect((date >> 9) + 1980).toBe(2026)
    expect((date >> 5) & 0x0f).toBe(9)
    expect(date & 0x1f).toBe(10)
    expect(time >> 11).toBe(14)
    expect((time >> 5) & 0x3f).toBe(35)
    // Les secondes tiennent sur cinq bits, donc par pas de deux.
    expect((time & 0x1f) * 2).toBe(20)
  })

  it("ramène une date antérieure à 1980, plutôt que d'écrire une année négative", () => {
    const { date } = dosDateTime(new Date(1970, 0, 1))
    expect(date >> 9).toBe(0)
  })
})

describe('buildZip', () => {
  it("rend un paquet vide lisible quand il n'y a rien à emporter", () => {
    const paquet = buildZip([])
    expect(paquet.length).toBe(22)
    expect(relire(paquet)).toEqual([])
  })

  it("rend chaque entrée telle qu'elle est entrée", () => {
    const paquet = buildZip([
      entree('journal/2026-09-09_001.jsonl', '{"kmh":110}\n{"kmh":109}'),
      entree('traces/route.json', '[[0,0],[1,12]]'),
    ])
    expect(relire(paquet)).toEqual([
      { path: 'journal/2026-09-09_001.jsonl', texte: '{"kmh":110}\n{"kmh":109}' },
      { path: 'traces/route.json', texte: '[[0,0],[1,12]]' },
    ])
  })

  it("garde l'ordre des entrées", () => {
    const noms = ['a.txt', 'b.txt', 'c.txt']
    const paquet = buildZip(noms.map((n) => entree(n, n)))
    expect(relire(paquet).map((e) => e.path)).toEqual(noms)
  })

  it("déclare les noms en UTF-8, pour qu'un accent ne devienne pas du charabia", () => {
    const paquet = buildZip([entree('mesures/relevé-étalonnage.json', '{}')])
    const vue = new DataView(paquet.buffer)
    // Le drapeau 0x0800 doit être posé dans l'en-tête local comme dans le
    // répertoire central : les lecteurs ne regardent pas toujours le même.
    expect(vue.getUint16(6, true) & 0x0800).toBe(0x0800)
    expect(relire(paquet)[0]?.path).toBe('mesures/relevé-étalonnage.json')
  })

  it("normalise les antislashs, qui feraient un nom de fichier au lieu d'un dossier", () => {
    const paquet = buildZip([{ path: 'journal\\tranche.jsonl', bytes: encodeur.encode('x') }])
    expect(relire(paquet)[0]?.path).toBe('journal/tranche.jsonl')
  })

  it('supporte un contenu vide sans casser les tailles annoncées', () => {
    const paquet = buildZip([entree('vide.txt', ''), entree('plein.txt', 'x')])
    expect(relire(paquet)).toEqual([
      { path: 'vide.txt', texte: '' },
      { path: 'plein.txt', texte: 'x' },
    ])
  })

  it('supporte des octets qui ne sont pas du texte', () => {
    const bytes = new Uint8Array([0, 255, 128, 10, 13, 26])
    const paquet = buildZip([{ path: 'son.wav', bytes }])
    const vue = new DataView(paquet.buffer)
    const longueurNom = vue.getUint16(26, true)
    expect(paquet.subarray(30 + longueurNom, 30 + longueurNom + bytes.length)).toEqual(bytes)
  })
})
