import { describe, expect, it, afterEach } from 'vitest'
import { canCompress, gunzip, gzip, pack } from './compress'

const ligne = (i: number) =>
  JSON.stringify({ at: i * 100, kind: 'sample', data: { kmh: 82.4, rpm: 2410, gear: 5 } })
const journal = Array.from({ length: 400 }, (_, i) => ligne(i)).join('\n')

describe('compression avant envoi', () => {
  const original = globalThis.CompressionStream

  afterEach(() => {
    globalThis.CompressionStream = original
  })

  it('rend un contenu qui se relit à l’identique', async () => {
    const packed = await gzip(journal)
    expect(await gunzip(packed)).toBe(journal)
  })

  it('gagne largement sur du journal réel', async () => {
    const packed = await gzip(journal)
    // La borne est lâche à dessein : ce qui est vérifié, c'est l'ordre de
    // grandeur du gain, pas la version de la bibliothèque du navigateur.
    expect(packed.size).toBeLessThan(journal.length / 4)
  })

  it('ajoute .gz au nom quand il compresse', async () => {
    const packed = await pack('2026-09-10-17-07-47_2geq_004.jsonl', journal)
    expect(packed.name).toBe('2026-09-10-17-07-47_2geq_004.jsonl.gz')
    expect(packed.compressed).toBe(true)
  })

  it('dépose en clair là où le navigateur ne sait pas compresser', async () => {
    // @ts-expect-error — on retire volontairement une capacité du navigateur.
    delete globalThis.CompressionStream
    expect(canCompress()).toBe(false)

    const packed = await pack('tranche.jsonl', journal)
    expect(packed.name).toBe('tranche.jsonl')
    expect(packed.body).toBe(journal)
    expect(packed.compressed).toBe(false)
  })
})
