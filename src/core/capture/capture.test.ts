import { describe, expect, it } from 'vitest'
import { Capture, type CaptureOptions, type CaptureSample } from './capture'

const HEADER = { app: '0.1.88', profile: 'V8', redlineRpm: 6500 }

function capture(overrides: Partial<CaptureOptions> = {}) {
  return new Capture({
    sessionId: '2geq',
    startedAt: Date.UTC(2026, 8, 10, 17, 7, 47),
    header: () => HEADER,
    ...overrides,
  })
}

function releve(at: number, kmh = 82.4): CaptureSample {
  return { at, kmh, acc: 5, der: false, out: kmh - 0.5, ms2: 0.4, rpm: 2410, gear: 5, load: 0.62 }
}

function lignes(body: string): Record<string, unknown>[] {
  return body
    .trimEnd()
    .split('\n')
    .map((ligne) => JSON.parse(ligne) as Record<string, unknown>)
}

describe('la capture continue', () => {
  it('nomme ses tranches comme le journal, session et rang compris', () => {
    const c = capture()
    c.add(releve(0))
    expect(c.takeSlice(1000)?.name).toBe('2026-09-10-17-07-47_2geq_001.jsonl')
    c.add(releve(1000))
    expect(c.takeSlice(2000)?.name).toBe('2026-09-10-17-07-47_2geq_002.jsonl')
  })

  it('écrit l’en-tête en tête de chaque tranche', () => {
    // Une tranche isolée doit se relire seule : sans en-tête, la deuxième moitié
    // d'un trajet ne dirait pas dans quelle configuration elle a été faite.
    const c = capture()
    c.add(releve(0))
    const premiere = lignes(c.takeSlice(1000)!.body)
    c.add(releve(1000))
    const seconde = lignes(c.takeSlice(2000)!.body)

    expect(premiere[0]).toMatchObject({ kind: 'header', app: '0.1.88', profile: 'V8' })
    expect(seconde[0]).toMatchObject({ kind: 'header', app: '0.1.88' })
  })

  it('garde l’entrée et la sortie du même instant', () => {
    const c = capture()
    c.add(releve(1200, 91.2))
    const [, releveEcrit] = lignes(c.takeSlice(2000)!.body)

    expect(releveEcrit).toMatchObject({
      at: 1200,
      kmh: 91.2,
      out: 90.7,
      rpm: 2410,
      gear: 5,
      load: 0.62,
    })
  })

  it('retient un changement de profil comme un fait daté', () => {
    const c = capture()
    c.add(releve(0))
    c.note(5000, 'profile', { name: 'V8' })
    const écrites = lignes(c.takeSlice(6000)!.body)

    expect(écrites.at(-1)).toMatchObject({ at: 5000, kind: 'profile', data: { name: 'V8' } })
  })

  it('découpe sur la durée, et non sur la taille d’une poignée de relevés', () => {
    // À dix relevés par seconde, le seuil du journal produirait un fichier
    // toutes les trente secondes.
    const c = capture()
    for (let i = 0; i < 3000; i += 1) c.add(releve(i * 100))
    expect(c.shouldSlice(4 * 60_000)).toBe(false)
    expect(c.shouldSlice(5 * 60_000)).toBe(true)
  })

  it('rend une tranche qui n’a pas pu partir, sans dupliquer son en-tête', () => {
    const c = capture()
    c.add(releve(0))
    c.add(releve(100))
    const slice = c.takeSlice(1000)!
    c.restore(slice)
    c.add(releve(200))

    const reprise = lignes(c.takeSlice(2000)!.body)
    expect(reprise.filter((ligne) => ligne.kind === 'header')).toHaveLength(1)
    expect(reprise.filter((ligne) => ligne.kind === undefined)).toHaveLength(3)
    expect(reprise[1]).toMatchObject({ at: 0 })
    expect(reprise.at(-1)).toMatchObject({ at: 200 })
  })

  it('dit qu’elle a été trouée plutôt que de le taire', () => {
    const c = capture({ maxPending: 3 })
    for (let i = 0; i < 6; i += 1) c.add(releve(i * 100))

    const écrites = lignes(c.takeSlice(1000)!.body)
    expect(écrites[1]).toMatchObject({ kind: 'error', data: { dropped: 3 } })
    expect(écrites).toHaveLength(5)
  })
})
