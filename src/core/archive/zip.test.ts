import { describe, expect, it } from 'vitest'

import { crc32, readZip, zipBytes, zipStream, type ZipEntry } from './zip'

const octetsDe = (texte: string): Uint8Array => new TextEncoder().encode(texte)
const texteDe = (octets: Uint8Array): string => new TextDecoder().decode(octets)

/** Des octets qui ne sont pas du texte : une tranche déposée est compressée. */
function binaire(taille: number): Uint8Array {
  const octets = new Uint8Array(taille)
  for (let i = 0; i < taille; i += 1) octets[i] = (i * 37) % 256
  return octets
}

describe('l’aller-retour', () => {
  it('rend les octets à l’identique, tranche par tranche', async () => {
    // C'est la promesse qui compte : ce qui ressort de l'archive doit être
    // exactement ce qui était monté. Une tranche altérée ne se décompresse pas,
    // et le relecteur ne peut plus rien en faire.
    const tranches: ZipEntry[] = [
      { name: '2026-09-11-06-24-01_da2m_001.jsonl.gz', bytes: binaire(5000) },
      { name: '2026-09-11-06-24-01_da2m_002.jsonl.gz', bytes: binaire(731) },
    ]

    const { entries, failures } = await readZip(await zipBytes(tranches))

    expect(failures).toEqual([])
    expect(entries.map((entree) => entree.name)).toEqual(tranches.map((t) => t.name))
    expect([...entries[0]!.bytes]).toEqual([...tranches[0]!.bytes])
    expect([...entries[1]!.bytes]).toEqual([...tranches[1]!.bytes])
  })

  it('range sans recomprimer : l’archive pèse ce que pèsent les tranches', async () => {
    // Les tranches sont déjà compressées. Les recomprimer ne rendrait rien, et
    // les décompresser en chemin trahirait la promesse.
    const bytes = binaire(4096)

    const archive = await zipBytes([{ name: 'a.gz', bytes }])

    expect(archive.byteLength).toBeGreaterThan(bytes.byteLength)
    expect(archive.byteLength).toBeLessThan(bytes.byteLength + 200)
  })

  it('rend une archive valide pour une seule tranche', async () => {
    // Les six départs avortés de la base n'en ont qu'une : ce n'est pas un cas
    // particulier.
    const { entries } = await readZip(await zipBytes([{ name: 'seule.jsonl', bytes: octetsDe('{}') }]))

    expect(entries).toHaveLength(1)
    expect(texteDe(entries[0]!.bytes)).toBe('{}')
  })

  it('garde le découpage : deux tranches restent deux fichiers', async () => {
    // Concaténer serait plus simple à relire, mais irréversible — on perdrait
    // les rangs, donc la trace des tranches manquantes.
    const { entries } = await readZip(
      await zipBytes([
        { name: '..._019.jsonl.gz', bytes: octetsDe('dix-neuf') },
        { name: '..._021.jsonl.gz', bytes: octetsDe('vingt-et-un') },
      ]),
    )

    expect(entries.map((e) => e.name)).toEqual(['..._019.jsonl.gz', '..._021.jsonl.gz'])
  })
})

describe('ce que l’archive porte en plus des octets', () => {
  it('écrit la somme de contrôle, sans quoi un extracteur refuse le fichier', async () => {
    const bytes = binaire(300)

    const archive = await zipBytes([{ name: 'a', bytes }])
    const vue = new DataView(archive.buffer)

    // La somme est au quatorzième octet de l'en-tête local.
    expect(vue.getUint32(14, true)).toBe(crc32(bytes))
  })

  it('date les fichiers du trajet, pas de l’extraction', async () => {
    const at = Date.UTC(2026, 8, 11, 6, 24, 2)

    const archive = await zipBytes([{ name: 'a', bytes: octetsDe('x'), at }])
    const vue = new DataView(archive.buffer)

    // Format MS-DOS : année depuis 1980, secondes par deux.
    expect(vue.getUint16(12, true)).toBe(((2026 - 1980) << 9) | (9 << 5) | 11)
    expect(vue.getUint16(10, true)).toBe((6 << 11) | (24 << 5) | 1)
  })
})

describe('la lecture de ce qu’on n’a pas écrit', () => {
  it('sait relire une entrée compressée', async () => {
    // Une archive peut avoir été refaite par un autre outil entre-temps.
    const clair = octetsDe('{"at":1}\n{"at":2}\n{"at":3}\n')
    const archive = await zipDegonfle('trajet.jsonl', clair)

    const { entries, failures } = await readZip(archive)

    expect(failures).toEqual([])
    expect(texteDe(entries[0]!.bytes)).toBe(texteDe(clair))
  })

  it('refuse clairement ce qui n’est pas une archive', async () => {
    await expect(readZip(octetsDe('ceci est un fichier texte'))).rejects.toThrow(/archive zip/)
  })

  it('laisse de côté l’entrée illisible et nomme ce qui manque', async () => {
    // Une archive amputée se relit quand même : un trajet à moitié lu répond
    // souvent à la question.
    const archive = await zipBytes([
      { name: 'bonne.jsonl', bytes: octetsDe('{"at":1}') },
      { name: 'cassee.jsonl', bytes: octetsDe('{"at":2}') },
    ])
    // On casse la signature de l'en-tête local de la seconde entrée.
    const vue = new DataView(archive.buffer)
    const debutSeconde = 30 + 'bonne.jsonl'.length + 8
    vue.setUint32(debutSeconde, 0, true)

    const { entries, failures } = await readZip(archive)

    expect(entries.map((e) => e.name)).toEqual(['bonne.jsonl'])
    expect(failures).toEqual(['cassee.jsonl'])
  })
})

describe('le flux', () => {
  it('produit la même archive que d’un bloc', async () => {
    // Une session lourde n'a pas à tenir en mémoire entière ; ce qui sort doit
    // être identique pour autant.
    const tranches: ZipEntry[] = [
      { name: 'a.gz', bytes: binaire(1000) },
      { name: 'b.gz', bytes: binaire(2000) },
    ]

    const flux = zipStream(
      (async function* () {
        for (const tranche of tranches) yield tranche
      })(),
    )
    const enFlux = new Uint8Array(await new Response(flux).arrayBuffer())

    expect([...enFlux]).toEqual([...(await zipBytes(tranches))])
  })
})

/** Une archive dont l'entrée est dégonflée, comme un autre outil l'écrirait. */
async function zipDegonfle(nom: string, clair: Uint8Array): Promise<Uint8Array> {
  const compresse = new Uint8Array(
    await new Response(
      new Blob([clair as BlobPart]).stream().pipeThrough(new CompressionStream('deflate-raw')),
    ).arrayBuffer(),
  )

  const nomOctets = new TextEncoder().encode(nom)
  const local = new Uint8Array(30 + nomOctets.byteLength)
  const vueLocale = new DataView(local.buffer)
  vueLocale.setUint32(0, 0x04034b50, true)
  vueLocale.setUint16(4, 20, true)
  vueLocale.setUint16(8, 8, true)
  vueLocale.setUint32(14, crc32(clair), true)
  vueLocale.setUint32(18, compresse.byteLength, true)
  vueLocale.setUint32(22, clair.byteLength, true)
  vueLocale.setUint16(26, nomOctets.byteLength, true)
  local.set(nomOctets, 30)

  const central = new Uint8Array(46 + nomOctets.byteLength)
  const vueCentrale = new DataView(central.buffer)
  vueCentrale.setUint32(0, 0x02014b50, true)
  vueCentrale.setUint16(10, 8, true)
  vueCentrale.setUint32(16, crc32(clair), true)
  vueCentrale.setUint32(20, compresse.byteLength, true)
  vueCentrale.setUint32(24, clair.byteLength, true)
  vueCentrale.setUint16(28, nomOctets.byteLength, true)
  vueCentrale.setUint32(42, 0, true)
  central.set(nomOctets, 46)

  const fin = new Uint8Array(22)
  const vueFin = new DataView(fin.buffer)
  vueFin.setUint32(0, 0x06054b50, true)
  vueFin.setUint16(8, 1, true)
  vueFin.setUint16(10, 1, true)
  vueFin.setUint32(12, central.byteLength, true)
  vueFin.setUint32(16, local.byteLength + compresse.byteLength, true)

  const tout = new Uint8Array(
    local.byteLength + compresse.byteLength + central.byteLength + fin.byteLength,
  )
  tout.set(local, 0)
  tout.set(compresse, local.byteLength)
  tout.set(central, local.byteLength + compresse.byteLength)
  tout.set(fin, local.byteLength + compresse.byteLength + central.byteLength)
  return tout
}
