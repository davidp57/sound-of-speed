import { describe, expect, it } from 'vitest'
import { atLeastDurationMs, listSessions, loadSession } from './read'
import { gzip } from '../upload/compress'

const CREDENTIALS = { user: 'depot', password: 'motdepasse' }

/** Ce qu'une entrée porte en plus des fichiers, et qui ne joue ici aucun rôle. */
const RESTE = { bytes: 0, isolated: false, pending: 0, exemption: null } as const

function serveur(sessions: SessionDistante[] = [], contenus: Record<string, string | Blob> = {}) {
  const appels: string[] = []
  const impl = (async (url: string | URL) => {
    const chemin = decodeURIComponent(String(url))
    appels.push(chemin)
    if (chemin === '/sessions/') return Response.json(sessions)
    const corps = contenus[chemin]
    if (corps === undefined) return new Response('', { status: 404 })
    return new Response(corps, { status: 200 })
  }) as unknown as typeof fetch
  return { impl, appels }
}

/** Un trajet tel que le serveur le rend. */
interface SessionDistante {
  cle: string
  isole?: boolean
  enregistreLe: number
  tranches: { dossier: string; nom: string; octets: number }[]
  octets: number
  aVoir?: number
  exemption?: string | null
}

function distante(
  cle: string,
  tranches: { dossier: string; nom: string }[],
  reste: Partial<SessionDistante> = {},
): SessionDistante {
  return {
    cle,
    enregistreLe: Date.parse(`${cle.slice(0, 10)}T00:00:00Z`),
    tranches: tranches.map((t) => ({ ...t, octets: 10 })),
    octets: tranches.length * 10,
    ...reste,
  }
}

describe('la liste des sessions', () => {
  it('est vide sans compte, sans même interroger le serveur', async () => {
    const { impl, appels } = serveur()
    expect(await listSessions({ user: '', password: '' }, impl)).toEqual([])
    expect(appels).toHaveLength(0)
  })

  it('prend les trajets tels que le serveur les regroupe', async () => {
    // Le regroupement n'est plus refait ici : le serveur range les tranches et
    // sait les réunir, avec ce qu'il est seul à connaître — le poids, ce qui a
    // été regardé, ce qui est retenu.
    const { impl } = serveur([
      distante('2026-09-10-17-07-47_2geq', [
        { dossier: 'journal', nom: '2026-09-10-17-07-47_2geq_001.jsonl.gz' },
        { dossier: 'traces', nom: '2026-09-10-17-07-47_2geq_001.jsonl.gz' },
      ]),
      distante('2026-09-09-05-53-20_tyzp', [
        { dossier: 'journal', nom: '2026-09-09-05-53-20_tyzp_001.jsonl' },
      ]),
    ])

    const sessions = await listSessions(CREDENTIALS, impl)

    expect(sessions).toHaveLength(2)
    expect(sessions[0]?.id).toBe('2geq')
    expect(sessions[0]?.files.map((f) => f.kind)).toEqual(['journal', 'capture'])
    expect(sessions[1]?.id).toBe('tyzp')
  })

  it('montre un dépôt seul, faute de quoi rien ne pourrait l’enlever', async () => {
    // Deux traces anciennes portent un nom libre, d'avant la convention : le
    // regroupement ne les voit pas, et elles étaient jusqu'ici invisibles.
    const { impl } = serveur([
      distante('depot:traces:traces.json', [{ dossier: 'traces', nom: 'traces.json' }], {
        isole: true,
      }),
    ])

    const [session] = await listSessions(CREDENTIALS, impl)

    expect(session?.isolated).toBe(true)
    expect(session?.id).toBe('traces.json')
  })

  it('rend le poids, ce qui reste à regarder et ce qui retient', async () => {
    const { impl } = serveur([
      distante('2026-09-10-17-07-47_2geq', [
        { dossier: 'traces', nom: '2026-09-10-17-07-47_2geq_001.jsonl.gz' },
      ], { aVoir: 1, exemption: 'archive' }),
    ])

    const [session] = await listSessions(CREDENTIALS, impl)

    expect(session?.bytes).toBe(10)
    expect(session?.pending).toBe(1)
    expect(session?.exemption).toBe('archive')
  })

  it('s’annonce, le dossier n’étant plus lisible sans mot de passe', async () => {
    let entêtes: Record<string, string> = {}
    const impl = (async (_url: string, init?: RequestInit) => {
      entêtes = init?.headers as Record<string, string>
      return Response.json([])
    }) as unknown as typeof fetch

    await listSessions(CREDENTIALS, impl)
    expect(entêtes['Authorization']).toBe(`Basic ${btoa('depot:motdepasse')}`)
  })

  it('rend une liste vide devant un serveur qui ne connaît pas les trajets', async () => {
    const impl = (async () => new Response('', { status: 404 })) as unknown as typeof fetch
    expect(await listSessions(CREDENTIALS, impl)).toEqual([])
  })
})

describe('le chargement d’une session', () => {
  it('décompresse ce qui est compressé, et lit le reste tel quel', async () => {
    const clair = '{"at":100,"kind":"audio","data":{}}\n'
    const compressé = await gzip('{"at":200,"kind":"source","data":{}}\n')
    const { impl } = serveur(
      [],
      {
        '/journal/2026-09-10-17-07-47_2geq_001.jsonl': clair,
        '/journal/2026-09-10-17-07-47_2geq_002.jsonl.gz': compressé,
      },
    )

    const { session, failures } = await loadSession(
      {
        key: '2026-09-10-17-07-47_2geq',
        id: '2geq',
        startedAt: 0,
        files: [
          { name: '2026-09-10-17-07-47_2geq_001.jsonl', kind: 'journal' },
          { name: '2026-09-10-17-07-47_2geq_002.jsonl.gz', kind: 'journal' },
        ],
        ...RESTE,
      },
      CREDENTIALS,
      impl,
    )

    expect(failures).toEqual([])
    expect(session.events.map((e) => e.at)).toEqual([100, 200])
  })

  it('rend ce qu’il a pu lire, et nomme ce qui manque', async () => {
    const { impl } = serveur([], { '/journal/a_001.jsonl': '{"at":1,"kind":"audio","data":{}}\n' })
    const { session, failures } = await loadSession(
      {
        key: 'a',
        id: 'a',
        startedAt: 0,
        files: [
          { name: 'a_001.jsonl', kind: 'journal' },
          { name: 'a_002.jsonl', kind: 'journal' },
        ],
        ...RESTE,
      },
      CREDENTIALS,
      impl,
    )

    expect(session.events).toHaveLength(1)
    expect(failures).toEqual(['a_002.jsonl (404)'])
  })
})

describe('durée annoncée dans la liste', () => {
  function session(captures: number, journaux = 1) {
    const files = [
      ...Array.from({ length: journaux }, (_, i) => ({
        name: `j_${i}.jsonl`,
        kind: 'journal' as const,
      })),
      ...Array.from({ length: captures }, (_, i) => ({
        name: `c_${i}.jsonl`,
        kind: 'capture' as const,
      })),
    ]
    return { key: 'k', id: 'k', startedAt: 0, files, ...RESTE }
  }

  it('rend une borne basse, et non une estimation', () => {
    // Quatre tranches : trois intervalles pleins de cinq minutes, la quatrième
    // pouvant être partielle.
    expect(atLeastDurationMs(session(4))).toBe(15 * 60 * 1000)
  })

  it('ne promet rien au-delà de la première tranche', () => {
    expect(atLeastDurationMs(session(1))).toBe(0)
  })

  it('ne compte pas les tranches de journal, qui découpent à la taille', () => {
    expect(atLeastDurationMs(session(2, 9))).toBe(5 * 60 * 1000)
  })

  it('se tait sur une session sans capture', () => {
    expect(atLeastDurationMs(session(0, 3))).toBeNull()
  })
})
