import { describe, expect, it } from 'vitest'
import { gzipSync } from 'node:zlib'

import { rebuild, updateWith, type Folder } from './profileur'
import { emptyAggregate, PROCEDURE_VERSION } from '../core/calibration/aggregate'

/**
 * Tests du profileur.
 *
 * Le dossier lui est donné plutôt que pris : ces tests en fabriquent un en
 * mémoire, avec de vraies tranches compressées, et vérifient ce que le service
 * en tire — sans conteneur, sans NAS, sans réseau.
 */

interface Releve {
  at: number
  src: number
  kmh: number
  acc: number | null
  der: boolean
  out: number
  ms2: number
  rpm: number
  gear: number
  load: number
}

function releve(at: number, kmh: number): Releve {
  return {
    at,
    src: at * 1000,
    kmh,
    acc: 5,
    der: false,
    out: kmh,
    ms2: 0,
    rpm: 2000,
    gear: 3,
    load: 0.5,
  }
}

/** Un trajet : arrêt, reprise franche, croisière, freinage. */
function trajet(seconds = 70): Releve[] {
  const lignes: Releve[] = []
  for (let ms = 0; ms <= seconds * 1000; ms += 100) {
    const t = ms / 1000
    const kmh = t < 12 ? Math.min(110, t * 9) : t < 60 ? 110 : Math.max(0, 110 - (t - 60) * 12)
    lignes.push(releve(ms, kmh))
  }
  return lignes
}

/** Un dossier en mémoire, dont les tranches sont compressées comme les vraies. */
function dossier(files: Record<string, string>): Folder {
  const bytes = new Map<string, Uint8Array>()
  for (const [name, body] of Object.entries(files)) {
    const raw = new TextEncoder().encode(body)
    bytes.set(name, name.endsWith('.gz') ? new Uint8Array(gzipSync(raw)) : raw)
  }
  return {
    list: () => Promise.resolve([...bytes.keys()]),
    read: (name) => {
      const found = bytes.get(name)
      if (found === undefined) return Promise.reject(new Error('absent'))
      return Promise.resolve(found)
    },
  }
}

/** Découpe un trajet en tranches nommées comme le tampon les nomme. */
function tranches(stamp: string, sessionId: string, lignes: Releve[], par = 200) {
  const files: Record<string, string> = {}
  for (let i = 0; i * par < lignes.length; i += 1) {
    const part = lignes.slice(i * par, (i + 1) * par)
    const entete = JSON.stringify({ kind: 'header', session: sessionId, startedAt: 1_700_000_000 })
    const corps = part.map((l) => JSON.stringify(l)).join('\n')
    const rang = String(i + 1).padStart(3, '0')
    files[`${stamp}_${sessionId}_${rang}.jsonl.gz`] = `${entete}\n${corps}\n`
  }
  return files
}

describe('rebuild', () => {
  it('mesure un trajet déposé en plusieurs tranches', async () => {
    const folder = dossier(tranches('2026-09-11-06-24-01', 'da2m', trajet()))

    const { aggregate, skipped } = await rebuild(folder)

    expect(skipped).toEqual([])
    expect(aggregate.tripCount).toBe(1)
    expect(aggregate.capabilities.pushPeakMs2!).toBeGreaterThan(2)
    expect(aggregate.capabilities.practicedMaxKmh).toBeGreaterThan(100)
  })

  it('compte deux trajets comme deux', async () => {
    const folder = dossier({
      ...tranches('2026-09-10-17-07-47', '2geq', trajet()),
      ...tranches('2026-09-11-06-24-01', 'da2m', trajet()),
    })

    const { aggregate } = await rebuild(folder)

    expect(aggregate.tripCount).toBe(2)
  })

  it('rend un agrégat vide sur un dossier vide', async () => {
    const { aggregate, coverage } = await rebuild(dossier({}))

    expect(aggregate.tripCount).toBe(0)
    expect(coverage.complete).toBe(false)
  })

  it('ignore ce qui n’est pas une tranche', async () => {
    const folder = dossier({
      'lisez-moi.txt': 'bonjour',
      ...tranches('2026-09-11-06-24-01', 'da2m', trajet()),
    })

    const { aggregate, skipped } = await rebuild(folder)

    expect(skipped).toEqual([])
    expect(aggregate.tripCount).toBe(1)
  })

  /**
   * Un dépôt coupé au milieu d'une ligne est le cas normal d'un réseau qui
   * lâche. Le reste de la tranche vaut toujours, et un trajet à moitié lu reste
   * exploitable — c'est un trajet muet qui ne l'est pas.
   */
  it('survit à une ligne tronquée', async () => {
    const files = tranches('2026-09-11-06-24-01', 'da2m', trajet())
    const premier = Object.keys(files)[0]!
    files[premier] = `${files[premier]!}{"at": 99999, "kmh":`

    const { aggregate, skipped } = await rebuild(dossier(files))

    expect(skipped).toEqual([])
    expect(aggregate.tripCount).toBe(1)
  })

  it('nomme une tranche illisible sans perdre le trajet', async () => {
    const files = tranches('2026-09-11-06-24-01', 'da2m', trajet())
    const noms = Object.keys(files)
    const folder = dossier(files)
    const casse: Folder = {
      list: folder.list,
      read: (name) =>
        name === noms[1] ? Promise.reject(new Error('illisible')) : folder.read(name),
    }

    const { aggregate, skipped } = await rebuild(casse)

    expect(skipped).toEqual([noms[1]])
    expect(aggregate.tripCount).toBe(1)
  })
})

describe('updateWith', () => {
  it('ne relit que le trajet que la tranche complète', async () => {
    const files = {
      ...tranches('2026-09-10-17-07-47', '2geq', trajet()),
      ...tranches('2026-09-11-06-24-01', 'da2m', trajet()),
    }
    const lus: string[] = []
    const base = dossier(files)
    const folder: Folder = {
      list: base.list,
      read: (name) => {
        lus.push(name)
        return base.read(name)
      },
    }

    const { aggregate: premier } = await rebuild(base)
    const derniere = Object.keys(files).filter((n) => n.includes('da2m')).at(-1)!
    lus.length = 0
    const { aggregate } = await updateWith(folder, premier, derniere)

    expect(lus.every((name) => name.includes('da2m'))).toBe(true)
    expect(aggregate.tripCount).toBe(2)
  })

  /**
   * Le cas courant : le même trajet revient une douzaine de fois, un peu plus
   * long à chaque fois. Il ne doit compter qu'une.
   */
  it('remplace le trajet au lieu de l’ajouter', async () => {
    const files = tranches('2026-09-11-06-24-01', 'da2m', trajet())
    const folder = dossier(files)
    const premiere = Object.keys(files)[0]!

    let { aggregate } = await updateWith(folder, emptyAggregate(), premiere)
    expect(aggregate.tripCount).toBe(1)

    aggregate = (await updateWith(folder, aggregate, Object.keys(files).at(-1)!)).aggregate

    expect(aggregate.tripCount).toBe(1)
  })

  /**
   * Un agrégat produit par un procédé antérieur ne vaut plus rien : ses
   * capacités ont été cumulées sans retour possible.
   */
  it('reprend tout quand le procédé a changé', async () => {
    const folder = dossier({
      ...tranches('2026-09-10-17-07-47', '2geq', trajet()),
      ...tranches('2026-09-11-06-24-01', 'da2m', trajet()),
    })
    const perime = { ...emptyAggregate(), procedure: PROCEDURE_VERSION - 1 }

    const { aggregate } = await updateWith(folder, perime, 'peu importe')

    expect(aggregate.procedure).toBe(PROCEDURE_VERSION)
    expect(aggregate.tripCount).toBe(2)
  })

  it('ne casse pas sur une tranche qui n’existe plus', async () => {
    const folder = dossier(tranches('2026-09-11-06-24-01', 'da2m', trajet()))

    const { aggregate, skipped } = await updateWith(folder, emptyAggregate(), 'disparue.jsonl.gz')

    expect(aggregate.tripCount).toBe(0)
    expect(skipped).toEqual(['disparue.jsonl.gz'])
  })
})
