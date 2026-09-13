import { mkdtempSync, rmSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { PROCEDURE_VERSION } from '../core/calibration/aggregate'

import { SOLO_ACCOUNT_ID, ouvrirBase, type Base } from './base/base'
import { deposits } from './base/schema'
import { ecrireDepot, type Dossier, type Exemption } from './depots'
import { lireProfilMesure, reprendreApresDepot } from './profil-mesure'
import { appliquerLaRegle, formaterPassage, verdictDuCompte, DELAIS_PAR_DEFAUT } from './retention'

const MIGRATIONS = 'src/server/base/migrations'
const JOUR = 24 * 60 * 60 * 1000
const MAINTENANT = Date.UTC(2026, 9, 15, 12, 0, 0)

let dossier: string
let base: Base
let fermer: () => void

beforeEach(async () => {
  dossier = mkdtempSync(join(tmpdir(), 'retention-'))
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

/** Un trajet déposé il y a tant de jours, analysé sauf mention contraire. */
async function trajet(
  jours: number,
  options: { dossiers?: Dossier[]; exemption?: Exemption; analyse?: boolean; id?: string } = {},
): Promise<string> {
  const quand = new Date(MAINTENANT - jours * JOUR)
  const stamp = quand.toISOString().slice(0, 19).replace(/[:T]/g, '-')
  const cle = `${stamp}_${options.id ?? `j${jours}`}`

  for (const ou of options.dossiers ?? ['traces']) {
    const nom = `${cle}_001.jsonl.gz`
    await ecrireDepot(base, SOLO_ACCOUNT_ID, ou, nom, Buffer.from('x'), options.exemption)
  }

  if (options.analyse !== false) {
    await base.update(deposits).set({ analyzedProcedure: PROCEDURE_VERSION })
  }

  return cle
}

describe('le verdict sur la base', () => {
  it('emporte une trace plus vieille que le délai, et rend ce qu’elle pèse', async () => {
    const vieux = await trajet(40)
    await trajet(2)

    const verdict = await verdictDuCompte(base, SOLO_ACCOUNT_ID, MAINTENANT)

    expect(verdict.aEffacer.map((t) => t.cle)).toEqual([vieux])
    expect(verdict.octets).toBe(1)
  })

  it('retient ce qui n’a pas été analysé, et le dit', async () => {
    await trajet(400, { analyse: false })

    const verdict = await verdictDuCompte(base, SOLO_ACCOUNT_ID, MAINTENANT)

    expect(verdict.aEffacer).toEqual([])
    expect(verdict.retenus[0]!.raison).toBe('pas encore analysé')
  })

  it('n’efface rien — c’est tout l’intérêt de ce verdict', async () => {
    await trajet(400)

    await verdictDuCompte(base, SOLO_ACCOUNT_ID, MAINTENANT)

    expect(await base.select().from(deposits)).toHaveLength(1)
  })

  it('est vide sur une base entièrement archivée, comme celle de production', async () => {
    // Les quatorze sessions reprises sont des archives. Un verdict non vide sur
    // ces données-là signalerait un défaut, pas un seuil à discuter.
    await trajet(300, { exemption: 'archive' })
    await trajet(200, { dossiers: ['journal'], exemption: 'archive' })

    const verdict = await verdictDuCompte(base, SOLO_ACCOUNT_ID, MAINTENANT)

    expect(verdict.aEffacer).toEqual([])
    expect(verdict.retenus.map((t) => t.raison)).toEqual(['archivé', 'archivé'])
  })

  it('nomme le dépôt seul plutôt que de le taire', async () => {
    await ecrireDepot(
      base,
      SOLO_ACCOUNT_ID,
      'traces',
      'traces.json',
      Buffer.from('x'),
      'archive',
    )

    const verdict = await verdictDuCompte(base, SOLO_ACCOUNT_ID, MAINTENANT)

    expect(verdict.retenus[0]!.isole).toBe(true)
    expect(verdict.retenus[0]!.cle).toBe('depot:traces:traces.json')
  })

  it('se fonde sur la date du trajet, jamais sur celle du dépôt', async () => {
    // Les quatre-vingt-quatorze dépôts repris portent tous la date de la reprise.
    // S'y fier retiendrait pendant un mois des trajets vieux de six.
    const nom = '2026-01-05-08-00-00_vieux_001.jsonl.gz'
    await ecrireDepot(base, SOLO_ACCOUNT_ID, 'traces', nom, Buffer.from('x'))
    await base.update(deposits).set({
      analyzedProcedure: PROCEDURE_VERSION,
      depositedAt: Math.floor(MAINTENANT / 1000),
    })

    const verdict = await verdictDuCompte(base, SOLO_ACCOUNT_ID, MAINTENANT)

    expect(verdict.aEffacer.map((t) => t.cle)).toEqual(['2026-01-05-08-00-00_vieux'])
  })

  it('applique le délai court au journal seul, et celui de la trace au reste', async () => {
    const journalSeul = await trajet(20, { dossiers: ['journal'], id: 'seul' })
    const avecTrace = await trajet(20, { dossiers: ['traces', 'journal'], id: 'trace' })

    const verdict = await verdictDuCompte(base, SOLO_ACCOUNT_ID, MAINTENANT)

    expect(verdict.aEffacer.map((t) => t.cle)).toEqual([journalSeul])
    expect(verdict.retenus.map((t) => t.cle)).toEqual([avecTrace])
  })

  it('suit les délais qu’on lui donne', async () => {
    await trajet(10)

    const verdict = await verdictDuCompte(base, SOLO_ACCOUNT_ID, MAINTENANT, {
      traces: 7,
      journal: 3,
    })

    expect(verdict.aEffacer).toHaveLength(1)
    expect(DELAIS_PAR_DEFAUT).toEqual({ traces: 30, journal: 14 })
  })
})

describe('ce qu’un passage écrit dans le journal du conteneur', () => {
  it('se tait quand il n’a rien effacé, ce qui est le cas normal', async () => {
    expect(
      formaterPassage({ verdict: { aEffacer: [], retenus: [], octets: 0 }, trajets: 0, tranches: 0 }),
    ).toBeNull()
  })

  it('dit ce qui est parti et ce qui a été retenu, avec les raisons', async () => {
    const ligne = formaterPassage({
      verdict: {
        aEffacer: [
          {
            cle: '2026-08-01-10-00-00_aaaa',
            isole: false,
            enregistreLe: Date.UTC(2026, 7, 1, 10, 0, 0),
            octets: 2048,
            tranches: 3,
            traces: 3,
            journal: 0,
            aVoir: 0,
            exemption: null,
          },
        ],
        retenus: [
          {
            cle: 'b',
            isole: false,
            enregistreLe: MAINTENANT,
            octets: 10,
            tranches: 1,
            traces: 1,
            journal: 0,
            aVoir: 0,
            exemption: 'archive',
            raison: 'archivé',
          },
        ],
        octets: 2048,
      },
      trajets: 1,
      tranches: 3,
    })

    expect(ligne).toContain('1 trajets effacés, 3 tranches, 2 Kio')
    expect(ligne).toContain('2026-08-01')
    expect(ligne).toContain('1 archivé')
  })
})

describe('le passage qui efface', () => {
  it('emporte ce que le verdict annonçait, et rien de plus', async () => {
    // Le verdict et l'exécution partagent la même décision : deux règles
    // écrites deux fois divergeraient, et celle qui efface ne serait pas celle
    // qu'on a relue.
    const vieux = await trajet(40)
    const recent = await trajet(2)
    const annonce = await verdictDuCompte(base, SOLO_ACCOUNT_ID, MAINTENANT)

    const passage = await appliquerLaRegle(base, SOLO_ACCOUNT_ID, MAINTENANT)

    expect(annonce.aEffacer.map((t) => t.cle)).toEqual([vieux])
    expect(passage.trajets).toBe(1)
    expect(passage.tranches).toBe(1)
    const restants = await base.select().from(deposits)
    expect(restants.map((ligne) => ligne.name)).toEqual([`${recent}_001.jsonl.gz`])
  })

  it('n’efface rien sur une base entièrement archivée, et reste discret', async () => {
    await trajet(300, { exemption: 'archive' })

    const passage = await appliquerLaRegle(base, SOLO_ACCOUNT_ID, MAINTENANT)

    expect(passage.trajets).toBe(0)
    expect(formaterPassage(passage)).toBeNull()
    expect(await base.select().from(deposits)).toHaveLength(1)
  })

  it('laisse le profil mesuré au chiffre près', async () => {
    // Ce que les trajets ont montré est déjà cumulé. Il faut le vérifier avant
    // et après un passage qui efface, pas le supposer.
    const nom = '2026-01-05-08-00-00_vieux_001.jsonl.gz'
    await ecrireDepot(base, SOLO_ACCOUNT_ID, 'traces', nom, uneTranche())
    await reprendreApresDepot(base, SOLO_ACCOUNT_ID, nom)
    const avant = await lireProfilMesure(base, SOLO_ACCOUNT_ID)

    const passage = await appliquerLaRegle(base, SOLO_ACCOUNT_ID, MAINTENANT)

    expect(passage.trajets).toBe(1)
    expect(await base.select().from(deposits)).toHaveLength(0)
    expect(await lireProfilMesure(base, SOLO_ACCOUNT_ID)).toBe(avant)
  })
})

/** Une tranche de capture, assez fournie pour que le profileur en tire un trajet. */
function uneTranche(): Buffer {
  const lignes = [JSON.stringify({ sessionId: 'vieux', startedAt: 1_757_000_000_000, profile: 'V8' })]
  for (let i = 0; i < 300; i += 1) {
    const kmh = Math.min(110, i * 0.4)
    lignes.push(
      JSON.stringify({
        at: i * 100,
        src: i * 100,
        kmh,
        acc: 5,
        der: false,
        out: kmh,
        ms2: 0.9,
        rpm: 1500 + kmh * 20,
        gear: 3,
        load: 0.7,
      }),
    )
  }
  return Buffer.from(gzipSync(Buffer.from(`${lignes.join('\n')}\n`)))
}
