import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { PROCEDURE_VERSION } from '../core/calibration/aggregate'

import { SOLO_ACCOUNT_ID, ouvrirBase, type Base } from './base/base'
import { deposits } from './base/schema'
import { ecrireDepot } from './depots'
import { effacerSession, lireSession, listerSessions } from './sessions'

const MIGRATIONS = 'src/server/base/migrations'

let dossier: string
let base: Base
let fermer: () => void

beforeEach(async () => {
  dossier = mkdtempSync(join(tmpdir(), 'sessions-'))
  const ouverte = await ouvrirBase({ fichier: join(dossier, 'speed.db'), migrations: MIGRATIONS })
  base = ouverte.base
  fermer = ouverte.fermer
})

afterEach(() => {
  fermer()
  try {
    rmSync(dossier, { recursive: true, force: true })
  } catch {
    // Le ménage n'est pas ce qu'on vérifie.
  }
})

async function deposer(
  dossierDeDepot: 'traces' | 'journal',
  nom: string,
  octets = 'x',
): Promise<void> {
  await ecrireDepot(base, SOLO_ACCOUNT_ID, dossierDeDepot, nom, Buffer.from(octets))
}

describe('les dépôts vus comme des trajets', () => {
  it('réunit les tranches d’une session, trace et journal ensemble', async () => {
    // Le relecteur réunit déjà les deux sous un même trajet, et il en tire les
    // faits marquants. Les séparer ici donnerait deux trajets là où il y en a un.
    await deposer('traces', '2026-09-11-06-24-01_da2m_001.jsonl.gz')
    await deposer('traces', '2026-09-11-06-24-01_da2m_002.jsonl.gz')
    await deposer('journal', '2026-09-11-06-24-01_da2m_001.jsonl.gz')

    const sessions = await listerSessions(base, SOLO_ACCOUNT_ID)

    expect(sessions).toHaveLength(1)
    expect(sessions[0]!.traces).toBe(2)
    expect(sessions[0]!.journal).toBe(1)
    expect(sessions[0]!.enregistreLe).toBe(Date.UTC(2026, 8, 11, 6, 24, 1))
  })

  it('ne confond pas deux sessions de même identifiant', async () => {
    await deposer('traces', '2026-09-11-06-24-01_da2m_001.jsonl.gz')
    await deposer('traces', '2026-09-12-08-00-00_da2m_001.jsonl.gz')

    expect(await listerSessions(base, SOLO_ACCOUNT_ID)).toHaveLength(2)
  })

  it('rend le plus récent en tête', async () => {
    await deposer('traces', '2026-09-11-06-24-01_da2m_001.jsonl.gz')
    await deposer('traces', '2026-09-12-08-00-00_zzzz_001.jsonl.gz')

    const sessions = await listerSessions(base, SOLO_ACCOUNT_ID)

    expect(sessions[0]!.cle).toBe('2026-09-12-08-00-00_zzzz')
  })

  it('fait un trajet d’un dépôt qui n’appartient à aucune session', async () => {
    // Deux traces anciennes portent un nom libre, d'avant la convention. Sans
    // cette porte, rien ne pourrait jamais les enlever.
    await deposer('traces', 'essai-du-samedi.jsonl')

    const [session] = await listerSessions(base, SOLO_ACCOUNT_ID)

    expect(session!.isole).toBe(true)
    expect(session!.cle).toBe('depot:traces:essai-du-samedi.jsonl')
  })

  it('ne compte pas les relevés, qui ne font pas de trajet', async () => {
    await ecrireDepot(base, SOLO_ACCOUNT_ID, 'mesures', 'releve.json', Buffer.from('{}'))

    expect(await listerSessions(base, SOLO_ACCOUNT_ID)).toHaveLength(0)
  })

  it('retient le titre le plus fort quand les tranches n’en portent pas le même', async () => {
    // La reprise a archivé la trace ; le journal est arrivé après, sans
    // exemption. Une tranche ne décide pas pour tout le trajet, et l'archive —
    // qui ne compte pas dans la borne des épingles — l'emporte.
    await ecrireDepot(
      base,
      SOLO_ACCOUNT_ID,
      'traces',
      '2026-09-11-06-24-01_da2m_001.jsonl.gz',
      Buffer.from('x'),
      'archive',
    )
    await deposer('journal', '2026-09-11-06-24-01_da2m_001.jsonl.gz')

    const [session] = await listerSessions(base, SOLO_ACCOUNT_ID)

    expect(session!.exemption).toBe('archive')
  })

  it('compte ce qui reste à regarder, et le journal n’y entre pas', async () => {
    await deposer('traces', '2026-09-11-06-24-01_da2m_001.jsonl.gz')
    await deposer('journal', '2026-09-11-06-24-01_da2m_001.jsonl.gz')

    expect((await listerSessions(base, SOLO_ACCOUNT_ID))[0]!.aVoir).toBe(1)

    await base.update(deposits).set({ analyzedProcedure: PROCEDURE_VERSION })

    expect((await listerSessions(base, SOLO_ACCOUNT_ID))[0]!.aVoir).toBe(0)
  })
})

describe('effacer un trajet', () => {
  it('emporte toutes ses tranches, trace et journal', async () => {
    await deposer('traces', '2026-09-11-06-24-01_da2m_001.jsonl.gz')
    await deposer('traces', '2026-09-11-06-24-01_da2m_002.jsonl.gz')
    await deposer('journal', '2026-09-11-06-24-01_da2m_001.jsonl.gz')

    expect(await effacerSession(base, SOLO_ACCOUNT_ID, '2026-09-11-06-24-01_da2m')).toBe(3)

    expect(await base.select().from(deposits)).toHaveLength(0)
  })

  it('n’emporte pas le trajet d’à côté', async () => {
    await deposer('traces', '2026-09-11-06-24-01_da2m_001.jsonl.gz')
    await deposer('traces', '2026-09-12-08-00-00_zzzz_001.jsonl.gz')

    await effacerSession(base, SOLO_ACCOUNT_ID, '2026-09-11-06-24-01_da2m')

    expect((await listerSessions(base, SOLO_ACCOUNT_ID)).map((s) => s.cle)).toEqual([
      '2026-09-12-08-00-00_zzzz',
    ])
  })

  it('efface un dépôt isolé', async () => {
    await deposer('traces', 'essai-du-samedi.jsonl')

    expect(await effacerSession(base, SOLO_ACCOUNT_ID, 'depot:traces:essai-du-samedi.jsonl')).toBe(1)

    expect(await base.select().from(deposits)).toHaveLength(0)
  })

  it('effacer deux fois ne rend pas d’erreur', async () => {
    // La voiture rejoue une demande ; la seconde doit répondre comme la
    // première, et zéro tranche effacée est une réponse.
    await deposer('traces', '2026-09-11-06-24-01_da2m_001.jsonl.gz')

    await effacerSession(base, SOLO_ACCOUNT_ID, '2026-09-11-06-24-01_da2m')

    expect(await effacerSession(base, SOLO_ACCOUNT_ID, '2026-09-11-06-24-01_da2m')).toBe(0)
    expect(await lireSession(base, SOLO_ACCOUNT_ID, '2026-09-11-06-24-01_da2m')).toBeNull()
  })
})
