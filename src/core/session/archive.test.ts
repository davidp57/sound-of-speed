import { describe, expect, it } from 'vitest'

import { zipBytes, type ZipEntry } from '../archive/zip'
import { gzip } from '../upload/compress'

import { sessionFromArchive } from './archive'

const NOM = '2026-09-11-06-24-01_da2m'

/** Une tranche de journal, telle que la voiture la dépose. */
const RELEVE = `${JSON.stringify({ at: 1000, kind: 'sample', data: { kmh: 50, rpm: 2000, gear: 3, load: 0.5 } })}\n`
const POSITION = `${JSON.stringify({ at: 2000, kind: 'sample', data: { lat: 41.9, lon: 41.7, kmh: 52 } })}\n`

async function octetsGz(texte: string): Promise<Uint8Array> {
  return new Uint8Array(await (await gzip(texte)).arrayBuffer())
}

function octets(texte: string): Uint8Array {
  return new TextEncoder().encode(texte)
}

async function archive(entrees: ZipEntry[]): Promise<Uint8Array> {
  return await zipBytes(entrees)
}

describe('rouvrir une archive prise sur le disque', () => {
  it('relit le trajet entier, sans passer par le serveur', async () => {
    const zip = await archive([
      { name: `traces/${NOM}_001.jsonl.gz`, bytes: await octetsGz(RELEVE) },
      { name: `journal/${NOM}_001.jsonl`, bytes: octets(POSITION) },
    ])

    const { session, failures } = await sessionFromArchive(zip)

    expect(failures).toEqual([])
    expect(session.id).toBe('da2m')
    expect(session.startedAt).toBe(Date.UTC(2026, 8, 11, 6, 24, 1))
    expect(session.states).toHaveLength(1)
    expect(session.track).toHaveLength(1)
    expect(session.sources).toEqual({ capture: 1, journal: 1 })
  })

  it('recolle les tranches dans l’ordre de leur rang, pas de l’archive', async () => {
    const zip = await archive([
      { name: `traces/${NOM}_002.jsonl`, bytes: octets(POSITION) },
      { name: `traces/${NOM}_001.jsonl`, bytes: octets(RELEVE) },
    ])

    const { session } = await sessionFromArchive(zip)

    expect(session.states.map((etat) => etat.at)).toEqual([1000])
    expect(session.durationMs).toBe(2000)
  })

  it('relit une archive à qui il manque des tranches, et le dit', async () => {
    // Un trajet à moitié lu répond souvent à la question ; c'est déjà ce que
    // fait le chargement depuis le serveur.
    const zip = await archive([
      { name: `traces/${NOM}_001.jsonl`, bytes: octets(RELEVE) },
      // Une tranche annoncée compressée qui ne l'est pas : illisible.
      { name: `traces/${NOM}_002.jsonl.gz`, bytes: octets('ceci n’est pas du gzip') },
    ])

    const { session, failures } = await sessionFromArchive(zip)

    expect(session.states).toHaveLength(1)
    expect(failures).toEqual([`${NOM}_002.jsonl.gz`])
  })

  it('dit clairement qu’un fichier n’est pas une archive', async () => {
    await expect(sessionFromArchive(octets('un fichier texte quelconque'))).rejects.toThrow(
      /archive zip/,
    )
  })

  it('dit clairement qu’une archive ne porte aucune tranche', async () => {
    const zip = await archive([{ name: 'notes.pdf', bytes: octets('%PDF') }])

    await expect(sessionFromArchive(zip)).rejects.toThrow(/aucune tranche/)
  })

  it('se relit à plat, si l’archive a été refaite à la main', async () => {
    const zip = await archive([{ name: `${NOM}_001.jsonl`, bytes: octets(RELEVE) }])

    const { session } = await sessionFromArchive(zip)

    expect(session.id).toBe('da2m')
    expect(session.states).toHaveLength(1)
  })

  it('relit une archive dont les noms sont libres, sans prétendre en tirer une date', async () => {
    // Les enregistrements manuels d'avant la convention : ils n'ont ni rang ni
    // horodatage, et ils se relisent quand même.
    const zip = await archive([{ name: 'traces/essai-du-samedi.jsonl', bytes: octets(RELEVE) }])

    const { session } = await sessionFromArchive(zip)

    expect(session.id).toBe('essai-du-samedi.jsonl')
    expect(session.startedAt).toBe(0)
    expect(session.states).toHaveLength(1)
  })
})
