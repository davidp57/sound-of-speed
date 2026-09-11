import { describe, expect, it } from 'vitest'

import { tick } from './main'
import { emptyAggregate } from '../core/calibration/aggregate'
import type { Folder } from './profileur'

/**
 * Tests du tour de boucle.
 *
 * Tout ce qui touche au disque et à l'horloge tient dans `main.ts` ; `tick` en
 * est la seule part calculable, et c'est elle qui décide quoi remesurer. Le
 * reste — lire un dossier, écrire un fichier, attendre — n'a rien à prouver
 * qu'un test pourrait montrer.
 */

function dossier(files: Record<string, string>): Folder {
  const bytes = new Map<string, Uint8Array>()
  for (const [name, body] of Object.entries(files)) {
    bytes.set(name, new TextEncoder().encode(body))
  }
  return {
    list: () => Promise.resolve([...bytes.keys()]),
    read: (name) => {
      const found = bytes.get(name)
      return found === undefined ? Promise.reject(new Error('absent')) : Promise.resolve(found)
    },
  }
}

function trancheDe(stamp: string, session: string, rang: string, seconds: number): string {
  const lignes: string[] = [JSON.stringify({ kind: 'header', session, startedAt: 1_700_000_000 })]
  for (let ms = 0; ms <= seconds * 1000; ms += 100) {
    const t = ms / 1000
    const kmh = t < 12 ? Math.min(110, t * 9) : t < 60 ? 110 : Math.max(0, 110 - (t - 60) * 12)
    lignes.push(
      JSON.stringify({
        at: ms,
        src: ms * 1000,
        kmh,
        acc: 5,
        der: false,
        out: kmh,
        ms2: 0,
        rpm: 2000,
        gear: 3,
        load: 0.5,
      }),
    )
  }
  void stamp
  void rang
  return `${lignes.join('\n')}\n`
}

describe('tick', () => {
  it('ne fait rien quand rien n’est arrivé', async () => {
    const folder = dossier({ 'a_x_001.jsonl': trancheDe('a', 'x', '001', 70) })
    const known = new Set(await folder.list())

    expect(await tick(folder, emptyAggregate(), known)).toBeNull()
  })

  it('reprend tout au premier tour', async () => {
    const folder = dossier({
      '2026-09-10-17-07-47_2geq_001.jsonl': trancheDe('a', '2geq', '001', 70),
      '2026-09-11-06-24-01_da2m_001.jsonl': trancheDe('b', 'da2m', '001', 70),
    })

    const step = await tick(folder, emptyAggregate(), new Set())

    expect(step).not.toBeNull()
    expect(step!.result.aggregate.tripCount).toBe(2)
    expect(step!.names.size).toBe(2)
  })

  /**
   * Le cas courant : une tranche arrive, et elle ne concerne qu'un trajet. Rien
   * d'autre n'a besoin d'être relu.
   */
  it('ne remesure que ce qu’une tranche neuve complète', async () => {
    const files = {
      '2026-09-10-17-07-47_2geq_001.jsonl': trancheDe('a', '2geq', '001', 70),
      '2026-09-11-06-24-01_da2m_001.jsonl': trancheDe('b', 'da2m', '001', 70),
    }
    const folder = dossier(files)
    const premier = await tick(folder, emptyAggregate(), new Set())

    const lus: string[] = []
    const espion: Folder = {
      list: folder.list,
      read: (name) => {
        lus.push(name)
        return folder.read(name)
      },
    }
    const known = new Set(['2026-09-10-17-07-47_2geq_001.jsonl'])
    await tick(espion, premier!.result.aggregate, known)

    expect(lus.every((name) => name.includes('da2m'))).toBe(true)
  })

  it('avale plusieurs tranches neuves d’un même tour', async () => {
    const folder = dossier({
      '2026-09-10-17-07-47_2geq_001.jsonl': trancheDe('a', '2geq', '001', 70),
      '2026-09-11-06-24-01_da2m_001.jsonl': trancheDe('b', 'da2m', '001', 70),
      '2026-09-12-08-00-00_zzzz_001.jsonl': trancheDe('c', 'zzzz', '001', 70),
    })
    const known = new Set(['2026-09-10-17-07-47_2geq_001.jsonl'])
    const premier = await tick(folder, emptyAggregate(), new Set(await folder.list()))
    expect(premier).toBeNull()

    const step = await tick(folder, emptyAggregate(), known)

    expect(step!.result.aggregate.tripCount).toBe(2)
  })
})
