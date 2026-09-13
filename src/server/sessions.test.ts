import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { PROCEDURE_VERSION } from '../core/calibration/aggregate'

import { SOLO_ACCOUNT_ID, ouvrirBase, type Base } from './base/base'
import { deposits } from './base/schema'
import { ecrireDepot } from './depots'
import { gzipSync } from 'node:zlib'

import { sessionFromArchive } from '../core/session/archive'
import { readZip } from '../core/archive/zip'

import {
  archiveDeLaSession,
  effacerSession,
  epingler,
  lireSession,
  listerSessions,
} from './sessions'

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

describe('emporter un trajet', () => {
  async function archive(cle: string): Promise<{ nom: string; octets: Uint8Array }> {
    const rendu = await archiveDeLaSession(base, SOLO_ACCOUNT_ID, cle)
    expect(rendu).not.toBeNull()
    return {
      nom: rendu!.nom,
      octets: new Uint8Array(await new Response(rendu!.flux).arrayBuffer()),
    }
  }

  it('rend un fichier, pas quarante-deux', async () => {
    await deposer('traces', '2026-09-11-06-24-01_da2m_001.jsonl.gz', 'trace une')
    await deposer('traces', '2026-09-11-06-24-01_da2m_002.jsonl.gz', 'trace deux')
    await deposer('journal', '2026-09-11-06-24-01_da2m_001.jsonl.gz', 'journal un')

    const { entries } = await readZip((await archive('2026-09-11-06-24-01_da2m')).octets)

    expect(entries.map((entree) => entree.name)).toEqual([
      'journal/2026-09-11-06-24-01_da2m_001.jsonl.gz',
      'traces/2026-09-11-06-24-01_da2m_001.jsonl.gz',
      'traces/2026-09-11-06-24-01_da2m_002.jsonl.gz',
    ])
  })

  it('rend les octets déposés, tranche par tranche', async () => {
    // Ce qui ressort doit être exactement ce qui était monté : une tranche
    // altérée ne se décompresse pas, et le relecteur ne peut plus rien en faire.
    await deposer('traces', '2026-09-11-06-24-01_da2m_001.jsonl.gz', 'des octets précis')

    const { entries } = await readZip((await archive('2026-09-11-06-24-01_da2m')).octets)

    expect(new TextDecoder().decode(entries[0]!.bytes)).toBe('des octets précis')
  })

  it('ne mélange pas une trace et un journal de même nom', async () => {
    // Ils portent le même nom dans deux dossiers. À plat, l'un écraserait
    // l'autre à l'extraction.
    await deposer('traces', '2026-09-11-06-24-01_da2m_001.jsonl.gz', 'la trace')
    await deposer('journal', '2026-09-11-06-24-01_da2m_001.jsonl.gz', 'le journal')

    const { entries } = await readZip((await archive('2026-09-11-06-24-01_da2m')).octets)
    const lus = Object.fromEntries(
      entries.map((entree) => [entree.name, new TextDecoder().decode(entree.bytes)]),
    )

    expect(lus['traces/2026-09-11-06-24-01_da2m_001.jsonl.gz']).toBe('la trace')
    expect(lus['journal/2026-09-11-06-24-01_da2m_001.jsonl.gz']).toBe('le journal')
  })

  it('nomme l’archive par la date du trajet', async () => {
    await deposer('traces', '2026-09-11-06-24-01_da2m_001.jsonl.gz')

    expect((await archive('2026-09-11-06-24-01_da2m')).nom).toBe('trajet-2026-09-11-06-24-01.zip')
  })

  it('rend une archive valide pour une session d’une seule tranche', async () => {
    await deposer('traces', '2026-09-11-06-24-01_da2m_001.jsonl.gz', 'seule')

    const { entries, failures } = await readZip((await archive('2026-09-11-06-24-01_da2m')).octets)

    expect(failures).toEqual([])
    expect(entries).toHaveLength(1)
  })

  it('rend rien sur un trajet qui n’existe pas', async () => {
    expect(await archiveDeLaSession(base, SOLO_ACCOUNT_ID, 'inconnu')).toBeNull()
  })
})

describe('le parcours complet', () => {
  it('télécharger, effacer, relire depuis le disque', async () => {
    // C'est le seul endroit où les trois gestes se vérifient ensemble, et c'est
    // ce qui rend l'effacement acceptable : ce qui part du serveur se retrouve
    // à l'identique dans l'archive.
    const releve = `${JSON.stringify({ at: 1000, kind: 'sample', data: { kmh: 50, rpm: 2000, gear: 3 } })}
`
    await ecrireDepot(
      base,
      SOLO_ACCOUNT_ID,
      'traces',
      '2026-09-11-06-24-01_da2m_001.jsonl.gz',
      Buffer.from(gzipSync(Buffer.from(releve))),
    )

    const archive = await archiveDeLaSession(base, SOLO_ACCOUNT_ID, '2026-09-11-06-24-01_da2m')
    const octets = new Uint8Array(await new Response(archive!.flux).arrayBuffer())

    expect(await effacerSession(base, SOLO_ACCOUNT_ID, '2026-09-11-06-24-01_da2m')).toBe(1)
    expect(await listerSessions(base, SOLO_ACCOUNT_ID)).toHaveLength(0)

    const { session, failures } = await sessionFromArchive(octets)

    expect(failures).toEqual([])
    expect(session.id).toBe('da2m')
    expect(session.startedAt).toBe(Date.UTC(2026, 8, 11, 6, 24, 1))
    expect(session.states.map((etat) => etat.kmh)).toEqual([50])
  })
})

describe('épingler un trajet', () => {
  const DA2M = '2026-09-11-06-24-01_da2m'

  it('pose l’épingle sur le trajet entier, trace et journal', async () => {
    // On ne choisit pas une tranche de journal, on garde un trajet.
    await deposer('traces', `${DA2M}_001.jsonl.gz`)
    await deposer('journal', `${DA2M}_001.jsonl.gz`)

    expect((await epingler(base, SOLO_ACCOUNT_ID, DA2M, true)).etat).toBe('épinglé')

    const lignes = await base.select().from(deposits)
    expect(lignes.map((ligne) => ligne.exemption)).toEqual(['epingle', 'epingle'])
  })

  it('décroche', async () => {
    await deposer('traces', `${DA2M}_001.jsonl.gz`)
    await epingler(base, SOLO_ACCOUNT_ID, DA2M, true)

    expect((await epingler(base, SOLO_ACCOUNT_ID, DA2M, false)).etat).toBe('décroché')
    expect((await lireSession(base, SOLO_ACCOUNT_ID, DA2M))!.exemption).toBeNull()
  })

  it('garde l’épingle quand la voiture redépose la même tranche', async () => {
    // La voiture rejoue un envoi sous le même nom ; le redéposer ne doit pas
    // retirer une épingle posée à la main.
    await deposer('traces', `${DA2M}_001.jsonl.gz`)
    await epingler(base, SOLO_ACCOUNT_ID, DA2M, true)

    await deposer('traces', `${DA2M}_001.jsonl.gz`, 'les mêmes octets, rejoués')

    expect((await lireSession(base, SOLO_ACCOUNT_ID, DA2M))!.exemption).toBe('epingle')
  })

  it('refuse au-delà de la borne, et dit où l’on en est', async () => {
    // Sans effet aujourd'hui — un seul compte, quatorze sessions archivées —,
    // donc vérifiée ici plutôt que par l'usage.
    await deposer('traces', '2026-09-11-06-24-01_aaaa_001.jsonl.gz')
    await deposer('traces', '2026-09-12-06-24-01_bbbb_001.jsonl.gz')
    await epingler(base, SOLO_ACCOUNT_ID, '2026-09-11-06-24-01_aaaa', true, 1)

    const refus = await epingler(base, SOLO_ACCOUNT_ID, '2026-09-12-06-24-01_bbbb', true, 1)

    expect(refus).toEqual({ etat: 'borne atteinte', epinglees: 1, borne: 1 })
    expect(
      (await lireSession(base, SOLO_ACCOUNT_ID, '2026-09-12-06-24-01_bbbb'))!.exemption,
    ).toBeNull()
  })

  it('laisse réépingler ce qui l’est déjà, même borne atteinte', async () => {
    await deposer('traces', `${DA2M}_001.jsonl.gz`)
    await epingler(base, SOLO_ACCOUNT_ID, DA2M, true, 1)

    expect((await epingler(base, SOLO_ACCOUNT_ID, DA2M, true, 1)).etat).toBe('épinglé')
  })

  it('ne compte pas les archives dans la borne', async () => {
    // Les quatorze sessions reprises sont des archives, pas des choix : les
    // faire entrer dans le compte remplirait la borne avant la première épingle.
    await ecrireDepot(
      base,
      SOLO_ACCOUNT_ID,
      'traces',
      '2026-09-01-06-24-01_vieux_001.jsonl.gz',
      Buffer.from('x'),
      'archive',
    )
    await deposer('traces', `${DA2M}_001.jsonl.gz`)

    expect((await epingler(base, SOLO_ACCOUNT_ID, DA2M, true, 1)).etat).toBe('épinglé')
  })

  it('ne pose pas d’épingle sur une archive, qui retient déjà', async () => {
    await ecrireDepot(
      base,
      SOLO_ACCOUNT_ID,
      'traces',
      `${DA2M}_001.jsonl.gz`,
      Buffer.from('x'),
      'archive',
    )

    expect((await epingler(base, SOLO_ACCOUNT_ID, DA2M, true)).etat).toBe('archivé')
    expect((await lireSession(base, SOLO_ACCOUNT_ID, DA2M))!.exemption).toBe('archive')
  })

  it('dit qu’un trajet inconnu est inconnu', async () => {
    expect((await epingler(base, SOLO_ACCOUNT_ID, 'nulle-part', true)).etat).toBe('inconnu')
  })
})
