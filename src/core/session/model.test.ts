import { describe, expect, it } from 'vitest'
import { buildSession, sessionKeyOf, stateAt, trackAt, type SessionFile } from './model'

const journal = (lignes: unknown[]): string => lignes.map((l) => JSON.stringify(l)).join('\n') + '\n'

function fichier(name: string, kind: 'journal' | 'capture', lignes: unknown[]): SessionFile {
  return { name, kind, text: journal(lignes) }
}

describe('le nom d’un fichier de session', () => {
  it('donne la session, sa date et le rang de la tranche', () => {
    const clé = sessionKeyOf('2026-09-10-17-07-47_2geq_004.jsonl')
    expect(clé?.key).toBe('2026-09-10-17-07-47_2geq')
    expect(clé?.rank).toBe(4)
    expect(new Date(clé!.startedAt).toISOString()).toBe('2026-09-10T17:07:47.000Z')
  })

  it('reconnaît un fichier compressé', () => {
    expect(sessionKeyOf('2026-09-10-17-07-47_2geq_004.jsonl.gz')?.rank).toBe(4)
  })

  it('ignore ce qui ne suit pas la convention', () => {
    expect(sessionKeyOf('traces.json')).toBeNull()
    expect(sessionKeyOf('2026-09-09-06-25-28_test2_60700s.json')).toBeNull()
  })
})

describe('l’assemblage d’une session', () => {
  it('recolle les tranches dans l’ordre du rang, pas de l’arrivée', () => {
    const session = buildSession('2geq', 0, [
      fichier('2026-09-10-17-07-47_2geq_002.jsonl', 'journal', [
        { at: 2000, kind: 'audio', data: {} },
      ]),
      fichier('2026-09-10-17-07-47_2geq_001.jsonl', 'journal', [
        { at: 1000, kind: 'audio', data: {} },
      ]),
    ])
    expect(session.events.map((e) => e.at)).toEqual([1000, 2000])
  })

  it('lit un journal, ses deux formes de relevé et ses faits', () => {
    // Le format est celui des fichiers réels du serveur : le journal enveloppe
    // ses relevés dans `data`, la capture écrit à plat. Écrire ce test sur une
    // forme supposée avait laissé passer une session entièrement vide.
    const session = buildSession('tyzp', 0, [
      fichier('2026-09-09-05-53-20_tyzp_001.jsonl', 'journal', [
        { at: 0, kind: 'source', data: { source: 'geolocation', status: 'active' } },
        {
          at: 100,
          kind: 'sample',
          data: { kmh: 50.2, accel: 0.4, rpm: 2100, gear: 4, load: 0.5, accuracyM: 5 },
        },
        { at: 200, kind: 'sample', data: { lat: 45.75, lon: 4.85, kmh: 51 } },
        { at: 300, kind: 'reject', data: { motif: 'inaccurate', count: 3 } },
      ]),
    ])

    expect(session.states).toHaveLength(1)
    expect(session.states[0]).toMatchObject({ at: 100, kmh: 50.2, rpm: 2100, gear: 4 })
    expect(session.track).toHaveLength(1)
    expect(session.events.map((e) => e.kind)).toEqual(['source', 'reject'])
    expect(session.sources).toEqual({ journal: 1, capture: 0 })
  })

  it('lit une capture, dont l’en-tête et la vitesse conditionnée', () => {
    const session = buildSession('2geq', 0, [
      fichier('2026-09-10-19-00-00_2geq_001.jsonl', 'capture', [
        { kind: 'header', app: '0.1.92', profile: { name: 'V8' } },
        { at: 100, src: 1e12, kmh: 50.2, acc: 5, der: false, out: 49.8, ms2: 0.4, rpm: 2100, gear: 4, load: 0.6 },
      ]),
    ])

    expect(session.header).toMatchObject({ app: '0.1.92' })
    // C'est la vitesse conditionnée qui a piloté le son, donc celle qu'on montre.
    expect(session.states[0]?.kmh).toBe(49.8)
    expect(session.states[0]?.load).toBe(0.6)
  })

  it('ne garde qu’un en-tête, réécrit à chaque tranche', () => {
    const session = buildSession('2geq', 0, [
      fichier('2026-09-10-19-00-00_2geq_001.jsonl', 'capture', [{ kind: 'header', app: 'a' }]),
      fichier('2026-09-10-19-00-00_2geq_002.jsonl', 'capture', [{ kind: 'header', app: 'a' }]),
    ])
    expect(session.header).toMatchObject({ app: 'a' })
    expect(session.events).toHaveLength(0)
  })

  it('ignore une ligne illisible sans perdre le reste', () => {
    // Un fichier déposé depuis une voiture peut l'être en plein milieu d'une ligne.
    const session = buildSession('2geq', 0, [
      {
        name: '2026-09-10-19-00-00_2geq_001.jsonl',
        kind: 'journal',
        text: '{"at":1,"kind":"source","data":{}}\n{"at":2,"kind":\n{"at":3,"kind":"audio","data":{}}\n',
      },
    ])
    expect(session.events.map((e) => e.at)).toEqual([1, 3])
  })

  it('mesure la durée sur le dernier point, quelle que soit sa nature', () => {
    const session = buildSession('2geq', 0, [
      fichier('2026-09-10-19-00-00_2geq_001.jsonl', 'journal', [
        { at: 100, kind: 'sample', data: { kmh: 10, rpm: 900, gear: 1 } },
        { at: 5000, kind: 'sample', data: { lat: 1, lon: 2, kmh: 20 } },
        { at: 900, kind: 'audio', data: {} },
      ]),
    ])
    expect(session.durationMs).toBe(5000)
  })
})

describe('la lecture à un instant', () => {
  const states = [
    { at: 0, kmh: 0, rpm: 800, gear: 1, load: 0.2, accelMs2: 0 },
    { at: 10_000, kmh: 100, rpm: 3000, gear: 5, load: 0.8, accelMs2: 2 },
  ]

  it('rend la valeur mesurée quand elle tombe juste', () => {
    const lu = stateAt(states, 10_000)
    expect(lu?.measured).toBe(true)
    expect(lu?.value.kmh).toBe(100)
  })

  it('interpole entre deux relevés, et le dit', () => {
    const lu = stateAt(states, 5000)
    expect(lu?.measured).toBe(false)
    expect(lu?.value.kmh).toBeCloseTo(50)
    expect(lu?.value.rpm).toBeCloseTo(1900)
  })

  it('n’interpole pas le rapport, qui n’a pas de demi', () => {
    // Entre la première et la cinquième il n'y a pas de troisième : un chiffre
    // qui n'existe pas se lirait comme une mesure.
    expect(stateAt(states, 5000)?.value.gear).toBe(1)
  })

  it('dit l’écart au relevé le plus proche', () => {
    expect(stateAt(states, 9000)?.offsetMs).toBe(1000)
  })

  it('tient au-delà du dernier relevé', () => {
    const lu = stateAt(states, 30_000)
    expect(lu?.value.kmh).toBe(100)
    expect(lu?.measured).toBe(false)
  })

  it('rend null sans relevé', () => {
    expect(stateAt([], 0)).toBeNull()
  })

  it('interpole la position', () => {
    const track = [
      { at: 0, lat: 45, lon: 4, kmh: 0 },
      { at: 1000, lat: 46, lon: 6, kmh: 50 },
    ]
    expect(trackAt(track, 500)?.lat).toBeCloseTo(45.5)
    expect(trackAt(track, 500)?.lon).toBeCloseTo(5)
  })
})
