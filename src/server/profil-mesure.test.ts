import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { SOLO_ACCOUNT_ID, ouvrirBase, type Base } from './base/base'
import { ecrireDepot } from './depots'
import {
  dossierDesTraces,
  lireProfilMesure,
  reprendreApresDepot,
  reprendreTout,
  tracesNonAnalysees,
} from './profil-mesure'
import { deposits } from './base/schema'
import { effacerSession } from './sessions'
import { PROCEDURE_VERSION } from '../core/calibration/aggregate'

const MIGRATIONS = 'src/server/base/migrations'

let dossier: string
let base: Base
let fermer: () => void

beforeEach(async () => {
  dossier = mkdtempSync(join(tmpdir(), 'mesure-'))
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

/** Une tranche de capture, telle que la voiture la dépose : en-tête puis relevés. */
function uneTranche(sessionId: string, combien = 300): Buffer {
  const lignes = [JSON.stringify({ sessionId, startedAt: 1_757_000_000_000, profile: 'V8' })]
  for (let i = 0; i < combien; i += 1) {
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

async function deposer(nom: string, octets: Buffer): Promise<void> {
  await ecrireDepot(base, SOLO_ACCOUNT_ID, 'traces', nom, octets)
}

describe('le dossier des traces, vu par le profileur', () => {
  it('liste ce qui a été déposé, et rien d’autre', async () => {
    await deposer('2026-09-12-19-00-00_a_001.jsonl.gz', uneTranche('a'))
    await ecrireDepot(base, SOLO_ACCOUNT_ID, 'journal', 'autre.gz', Buffer.from('x'))

    expect(await dossierDesTraces(base, SOLO_ACCOUNT_ID).list()).toEqual([
      '2026-09-12-19-00-00_a_001.jsonl.gz',
    ])
  })

  it('rend les octets tels qu’ils ont été déposés', async () => {
    const octets = uneTranche('a')
    await deposer('2026-09-12-19-00-00_a_001.jsonl.gz', octets)

    const lus = await dossierDesTraces(base, SOLO_ACCOUNT_ID).read('2026-09-12-19-00-00_a_001.jsonl.gz')
    expect(Buffer.from(lus).equals(octets)).toBe(true)
  })
})

describe('la reprise du profil mesuré', () => {
  it('n’a rien à dire tant qu’aucune trace n’est arrivée', async () => {
    // « Pas encore mesuré » est une situation normale, que le client distingue
    // déjà d'un serveur cassé.
    expect(await lireProfilMesure(base, SOLO_ACCOUNT_ID)).toBeNull()
  })

  it('produit le profil mesuré au dépôt d’une trace', async () => {
    // Plus aucune scrutation : c'est le serveur qui écrit la trace, donc il sait
    // qu'elle est arrivée.
    await deposer('2026-09-12_essai_001.jsonl.gz', uneTranche('essai'))
    await reprendreApresDepot(base, SOLO_ACCOUNT_ID, '2026-09-12_essai_001.jsonl.gz')

    const lu = JSON.parse((await lireProfilMesure(base, SOLO_ACCOUNT_ID)) ?? '{}')
    expect(Object.keys(lu).sort()).toEqual(['aggregate', 'coverage', 'procedure', 'updatedAt'])
  })

  it('rattrape ce qui est arrivé pendant que le serveur était arrêté', async () => {
    // Une trace déposée hors ligne n'a déclenché aucune reprise : sans ce
    // rattrapage au démarrage, elle serait perdue pour la mesure.
    await deposer('2026-09-12_hors-ligne_001.jsonl.gz', uneTranche('hors-ligne'))

    await reprendreTout(base, SOLO_ACCOUNT_ID)

    expect(await lireProfilMesure(base, SOLO_ACCOUNT_ID)).not.toBeNull()
  })

  it('cesse de grossir une fois sa fenêtre pleine', async () => {
    // Mesuré le 12 septembre 2026 : 1 199 octets pour un trajet, 6 309 pour
    // vingt-cinq, 6 910 pour cent. La fenêtre des trajets gardés entiers sature
    // à vingt ; au-delà, il ne reste que huit octets par trajet — l'identifiant
    // de ce qui a été compté et ne doit pas l'être deux fois.
    //
    // La spec annonçait « quelques kilo-octets qui ne grossissent pas ». C'est
    // presque vrai, et le presque a son importance : à mille trajets on serait
    // vers quatorze kilo-octets, ce qui reste sans commune mesure avec les
    // traces elles-mêmes. C'est ce qui permettra de les effacer sans rien perdre
    // de ce qu'elles ont montré.
    for (let n = 1; n <= 22; n += 1) {
      const nom = `2026-09-12-19-00-00_s${String(n).padStart(3, '0')}_001.jsonl.gz`
      await deposer(nom, uneTranche(`s${n}`))
      await reprendreApresDepot(base, SOLO_ACCOUNT_ID, nom)
    }
    const aLaSaturation = ((await lireProfilMesure(base, SOLO_ACCOUNT_ID)) ?? '').length

    for (let n = 23; n <= 32; n += 1) {
      const nom = `2026-09-12-19-00-00_s${String(n).padStart(3, '0')}_001.jsonl.gz`
      await deposer(nom, uneTranche(`s${n}`))
      await reprendreApresDepot(base, SOLO_ACCOUNT_ID, nom)
    }
    const lu = JSON.parse((await lireProfilMesure(base, SOLO_ACCOUNT_ID)) ?? '{}')
    const dixDePlus = JSON.stringify(lu).length

    // La fenêtre ne s'élargit plus...
    expect(lu.aggregate.recent.length).toBeLessThanOrEqual(20)
    // ...et dix trajets de plus ne coûtent que quelques dizaines d'octets.
    expect(dixDePlus - aLaSaturation).toBeLessThan(400)
  }, 30_000)

  it('écarte une tranche illisible sans perdre le reste', async () => {
    // Une tranche perdue n'arrête pas la mesure : elle est nommée et écartée.
    await deposer('2026-09-12-19-00-00_bonne_001.jsonl.gz', uneTranche('bonne'))
    await deposer('2026-09-12-19-01-00_cassee_001.jsonl.gz', Buffer.from('ceci n’est pas du gzip'))

    const resultat = await reprendreTout(base, SOLO_ACCOUNT_ID)

    expect(resultat.skipped).toContain('2026-09-12-19-01-00_cassee_001.jsonl.gz')
    expect(await lireProfilMesure(base, SOLO_ACCOUNT_ID)).not.toBeNull()
  })
})

describe('la marque d’analyse', () => {
  it('se pose sur les tranches que le dépôt fait regarder', async () => {
    await deposer('2026-09-12-19-00-00_a_001.jsonl.gz', uneTranche('a'))

    await reprendreApresDepot(base, SOLO_ACCOUNT_ID, '2026-09-12-19-00-00_a_001.jsonl.gz')

    const [ligne] = await base.select().from(deposits)
    expect(ligne!.analyzedProcedure).toBe(PROCEDURE_VERSION)
    expect(await tracesNonAnalysees(base, SOLO_ACCOUNT_ID)).toBe(0)
  })

  it('marque aussi ce dont il n’y avait rien à tirer', async () => {
    // Une session trop courte a été **regardée** : elle ne montre rien, et elle
    // est effaçable. C'est une session jamais soumise au profileur qui ne l'est
    // pas — les six départs avortés de la base sont du premier cas.
    await deposer('2026-09-12-19-00-00_court_001.jsonl.gz', Buffer.from('x'))

    await reprendreTout(base, SOLO_ACCOUNT_ID)

    const [ligne] = await base.select().from(deposits)
    expect(ligne!.analyzedProcedure).toBe(PROCEDURE_VERSION)
  })

  it('marque au rattrapage du démarrage ce qui est arrivé serveur arrêté', async () => {
    // Rien n'a déclenché de reprise pour cette trace-là : elle est entrée
    // pendant que le serveur ne tournait pas.
    await deposer('2026-09-12-19-00-00_a_001.jsonl.gz', uneTranche('a'))
    await base.update(deposits).set({ analyzedProcedure: null })

    expect(await tracesNonAnalysees(base, SOLO_ACCOUNT_ID)).toBe(1)
    await reprendreTout(base, SOLO_ACCOUNT_ID)

    expect(await tracesNonAnalysees(base, SOLO_ACCOUNT_ID)).toBe(0)
  })

  it('ne vaut plus rien quand le procédé du profileur a changé', async () => {
    // Le décompte le dit : ce qui a été vu par un procédé qui ne vaut plus est à
    // revoir, exactement comme ce qui n'a jamais été vu.
    await deposer('2026-09-12-19-00-00_a_001.jsonl.gz', uneTranche('a'))
    await reprendreApresDepot(base, SOLO_ACCOUNT_ID, '2026-09-12-19-00-00_a_001.jsonl.gz')

    await base.update(deposits).set({ analyzedProcedure: PROCEDURE_VERSION - 1 })

    expect(await tracesNonAnalysees(base, SOLO_ACCOUNT_ID)).toBe(1)
  })

  it('repart à zéro quand la tranche est redéposée', async () => {
    // La voiture rejoue un envoi : ce n'est plus la même tranche, et la marque de
    // l'ancienne ne dit plus rien de celle-ci.
    await deposer('2026-09-12-19-00-00_a_001.jsonl.gz', uneTranche('a'))
    await reprendreApresDepot(base, SOLO_ACCOUNT_ID, '2026-09-12-19-00-00_a_001.jsonl.gz')

    await deposer('2026-09-12-19-00-00_a_001.jsonl.gz', uneTranche('a', 400))

    expect(await tracesNonAnalysees(base, SOLO_ACCOUNT_ID)).toBe(1)
  })

  it('ne touche pas le journal, qui ne passe pas par le profileur', async () => {
    await ecrireDepot(base, SOLO_ACCOUNT_ID, 'journal', '2026-09-12-19-00-00_a_001.jsonl', Buffer.from('x'))

    await reprendreTout(base, SOLO_ACCOUNT_ID)

    const [ligne] = await base.select().from(deposits)
    expect(ligne!.analyzedProcedure).toBeNull()
  })
})

describe('effacer une trace ne défait pas ce qu’elle a montré', () => {
  it('laisse le profil mesuré au chiffre près', async () => {
    // C'est toute la promesse du lot : le serveur garde ce que les trajets
    // montrent, pas les trajets. Le cumul ne se défait pas.
    await deposer('2026-09-12-19-00-00_a_001.jsonl.gz', uneTranche('a'))
    await reprendreApresDepot(base, SOLO_ACCOUNT_ID, '2026-09-12-19-00-00_a_001.jsonl.gz')
    const avant = await lireProfilMesure(base, SOLO_ACCOUNT_ID)

    expect(await effacerSession(base, SOLO_ACCOUNT_ID, '2026-09-12-19-00-00_a')).toBe(1)

    const apres = await lireProfilMesure(base, SOLO_ACCOUNT_ID)
    expect(apres).not.toBeNull()
    expect(apres).toBe(avant)
    expect(await base.select().from(deposits)).toHaveLength(0)
  })
})
