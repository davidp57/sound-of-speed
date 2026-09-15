/**
 * Ce qu'on vérifie ici : le premier compte réel reçoit **tout** ce que portait le
 * compte d'avant l'identité, une seule fois, et le décompte le prouve.
 *
 * Le décompte n'est pas un ornement. C'est le seul contrôle qui vaille pour un
 * déménagement de données : le même nombre de dépôts, les mêmes octets, le même
 * profil mesuré — celui-ci ayant coûté quarante et une tranches de trace.
 */

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { eq, sql } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ouvrirBase, type Base } from './base/base'
import { accounts, deposits, engines, measuredCars, profiles } from './base/schema'
import { ecrireDepot } from './depots'
import {
  ANCIEN_COMPTE_UNIQUE,
  ceQuePorte,
  faireHeriter,
  formaterHeritage,
  semerLAncienCompte,
} from './heritage'

const MIGRATIONS = 'src/server/base/migrations'

let dossier: string
let base: Base
let fermer: () => void

beforeEach(async () => {
  dossier = mkdtempSync(join(tmpdir(), 'heritage-'))
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

/** Un compte d'avant bien garni : c'est ce qu'une vraie base porte. */
async function garnirLAncienCompte(): Promise<void> {
  await semerLAncienCompte(base)
  await base
    .insert(engines)
    .values({ id: 'm1', accountId: ANCIEN_COMPTE_UNIQUE, name: 'V8', content: {} })
  await base.insert(profiles).values({
    id: 'p1',
    accountId: ANCIEN_COMPTE_UNIQUE,
    name: 'Route',
    fileName: 'route.json',
    content: {},
  })
  await base
    .insert(measuredCars)
    .values({ accountId: ANCIEN_COMPTE_UNIQUE, content: { aggregate: { tripCount: 9 } } })
  await ecrireDepot(
    base,
    ANCIEN_COMPTE_UNIQUE,
    'traces',
    '2026-09-11-06-24-01_da2m_001.jsonl.gz',
    Buffer.from('douze octets'),
  )
}

/** Un héritier, tel que la bibliothèque d'identité en crée un. */
async function creerUnCompte(id: string): Promise<string> {
  await base.insert(accounts).values({ id, name: id, updatedAt: new Date() })
  return id
}

async function combien(table: typeof engines | typeof profiles): Promise<number> {
  return (await base.select({ n: sql<number>`count(*)` }).from(table))[0]?.n ?? 0
}

describe('ce que portait le compte d’avant', () => {
  it('change de mains en entier, et le décompte le dit', async () => {
    await garnirLAncienCompte()
    const heritier = await creerUnCompte('appareil-1')

    const heritage = await faireHeriter(base, heritier)

    expect(heritage).toEqual({
      profils: 1,
      moteurs: 1,
      boites: 0,
      depots: 1,
      octets: 12,
      profilMesure: true,
      trajetsMesures: 9,
      droits: 0,
    })
  })

  it('n’a rien perdu en route', async () => {
    // Le contrôle qui compte : autant de lignes après qu'avant, et elles
    // appartiennent toutes à l'héritier.
    await garnirLAncienCompte()
    const heritier = await creerUnCompte('appareil-1')

    await faireHeriter(base, heritier)

    expect(await combien(engines)).toBe(1)
    expect(await combien(profiles)).toBe(1)
    expect((await base.select().from(engines))[0]?.accountId).toBe(heritier)
    expect((await base.select().from(profiles))[0]?.accountId).toBe(heritier)
    expect((await base.select().from(measuredCars))[0]?.accountId).toBe(heritier)
    const tranche = (await base.select().from(deposits))[0]
    expect(tranche?.accountId).toBe(heritier)
    expect(tranche?.bytes).toBe(12)
  })

  it('emporte le compte d’avant avec lui', async () => {
    await garnirLAncienCompte()

    await faireHeriter(base, await creerUnCompte('appareil-1'))

    const restants = await base.select().from(accounts).where(eq(accounts.id, ANCIEN_COMPTE_UNIQUE))
    expect(restants).toHaveLength(0)
  })
})

describe('une seule fois', () => {
  it('ne donne rien au second compte', async () => {
    // Deux appareils font deux comptes ; le second part de zéro, et c'est le
    // comportement voulu tant que rien ne les relie.
    await garnirLAncienCompte()
    await faireHeriter(base, await creerUnCompte('appareil-1'))

    const second = await faireHeriter(base, await creerUnCompte('appareil-2'))

    expect(second).toBeNull()
    expect((await base.select().from(engines))[0]?.accountId).toBe('appareil-1')
  })

  it('ne fait rien sur une installation neuve', async () => {
    // Rien n'est semé au démarrage : une base neuve n'a pas de compte d'avant, et
    // l'héritage doit le dire au lieu de tourner à vide.
    expect(await faireHeriter(base, await creerUnCompte('appareil-1'))).toBeNull()
  })

  it('ne se donne rien à lui-même', async () => {
    await garnirLAncienCompte()

    expect(await faireHeriter(base, ANCIEN_COMPTE_UNIQUE)).toBeNull()
  })
})

describe('ce que le journal du conteneur en dira', () => {
  it('nomme ce qui a changé de mains', () => {
    // C'est le seul endroit où l'on verra que l'héritage a eu lieu : après coup,
    // il n'y a plus de compte d'avant à regarder.
    const ligne = formaterHeritage(
      {
        profils: 3,
        moteurs: 2,
        boites: 1,
        depots: 94,
        octets: 12345,
        profilMesure: true,
        trajetsMesures: 41,
        droits: 0,
      },
      'appareil-1',
    )

    expect(ligne).toContain('94 dépôts (12345 octets)')
    expect(ligne).toContain('le profil mesuré')
    expect(ligne).toContain('appareil-1')
  })
})

describe('un profil mesuré qu’on ne sait pas lire', () => {
  it('compte pour un trajet, et non pour zéro', () => {
    // Ce chiffre décide d'un effacement sans retour : le défaut doit pencher du
    // côté qui garde. Un contenu de forme inconnue est peut-être des mois de
    // conduite écrits par une version qu'on ne connaît plus.
    return (async () => {
      await semerLAncienCompte(base)
      await base
        .insert(measuredCars)
        .values({ accountId: ANCIEN_COMPTE_UNIQUE, content: { forme: 'inconnue' } })

      const porte = await ceQuePorte(base, ANCIEN_COMPTE_UNIQUE)

      expect(porte.profilMesure).toBe(true)
      expect(porte.trajetsMesures).toBe(1)
    })()
  })

  it('compte pour zéro quand il n’y a pas de profil du tout', () => {
    // La distinction qui compte : rien mesuré n'est pas la même chose qu'un
    // contenu qu'on ne sait pas lire. Trois tests de l'abandon de compte
    // l'avaient attrapée quand les deux cas ont été confondus.
    return (async () => {
      await semerLAncienCompte(base)
      expect((await ceQuePorte(base, ANCIEN_COMPTE_UNIQUE)).trajetsMesures).toBe(0)
    })()
  })

  it('compte pour zéro quand il dit lui-même n’avoir rien appris', () => {
    return (async () => {
      await semerLAncienCompte(base)
      await base
        .insert(measuredCars)
        .values({ accountId: ANCIEN_COMPTE_UNIQUE, content: { aggregate: { tripCount: 0 } } })

      expect((await ceQuePorte(base, ANCIEN_COMPTE_UNIQUE)).trajetsMesures).toBe(0)
    })()
  })
})
