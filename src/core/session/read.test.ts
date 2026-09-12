import { describe, expect, it } from 'vitest'
import { atLeastDurationMs, listSessions, loadSession } from './read'
import { gzip } from '../upload/compress'

const CREDENTIALS = { user: 'depot', password: 'motdepasse' }

function serveur(dossiers: Record<string, string[]>, contenus: Record<string, string | Blob> = {}) {
  const appels: string[] = []
  const impl = (async (url: string | URL) => {
    const chemin = decodeURIComponent(String(url))
    appels.push(chemin)
    if (chemin.endsWith('/')) {
      const noms = dossiers[chemin]
      if (!noms) return new Response('', { status: 404 })
      return Response.json(noms.map((name) => ({ name, type: 'file' })))
    }
    const corps = contenus[chemin]
    if (corps === undefined) return new Response('', { status: 404 })
    return new Response(corps, { status: 200 })
  }) as unknown as typeof fetch
  return { impl, appels }
}

describe('la liste des sessions', () => {
  it('est vide sans compte, sans même interroger le serveur', async () => {
    const { impl, appels } = serveur({})
    expect(await listSessions({ user: '', password: '' }, impl)).toEqual([])
    expect(appels).toHaveLength(0)
  })

  it('regroupe les tranches d’un même trajet, la plus récente en tête', async () => {
    const { impl } = serveur({
      '/journal/': [
        '2026-09-09-05-53-20_tyzp_001.jsonl',
        '2026-09-10-17-07-47_2geq_001.jsonl.gz',
        '2026-09-10-17-07-47_2geq_002.jsonl.gz',
      ],
      '/traces/': ['2026-09-10-17-07-47_2geq_001.jsonl.gz'],
    })

    const sessions = await listSessions(CREDENTIALS, impl)

    expect(sessions).toHaveLength(2)
    expect(sessions[0]?.id).toBe('2geq')
    expect(sessions[0]?.files).toHaveLength(3)
    expect(sessions[1]?.id).toBe('tyzp')
  })

  it('ignore les enregistrements manuels d’avant, au nom libre', async () => {
    const { impl } = serveur({
      '/traces/': ['2026-09-09-06-25-28_test2_60700s.json', 'traces.json'],
    })
    expect(await listSessions(CREDENTIALS, impl)).toEqual([])
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

  it('passe outre un dossier absent, qui naît au premier dépôt', async () => {
    const { impl } = serveur({ '/journal/': ['2026-09-10-17-07-47_2geq_001.jsonl'] })
    const sessions = await listSessions(CREDENTIALS, impl)
    expect(sessions).toHaveLength(1)
  })
})

describe('le chargement d’une session', () => {
  it('décompresse ce qui est compressé, et lit le reste tel quel', async () => {
    const clair = '{"at":100,"kind":"audio","data":{}}\n'
    const compressé = await gzip('{"at":200,"kind":"source","data":{}}\n')
    const { impl } = serveur(
      {},
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
      },
      CREDENTIALS,
      impl,
    )

    expect(failures).toEqual([])
    expect(session.events.map((e) => e.at)).toEqual([100, 200])
  })

  it('rend ce qu’il a pu lire, et nomme ce qui manque', async () => {
    const { impl } = serveur({}, { '/journal/a_001.jsonl': '{"at":1,"kind":"audio","data":{}}\n' })
    const { session, failures } = await loadSession(
      {
        key: 'a',
        id: 'a',
        startedAt: 0,
        files: [
          { name: 'a_001.jsonl', kind: 'journal' },
          { name: 'a_002.jsonl', kind: 'journal' },
        ],
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
    return { key: 'k', id: 'k', startedAt: 0, files }
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
