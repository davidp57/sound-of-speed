import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { sql } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { SOLO_ACCOUNT_ID, ouvrirBase, type Base } from './base'
import { accounts, deposits, engines, profiles, rights } from './schema'

const MIGRATIONS = 'src/server/base/migrations'

let dossier: string
let aFermer: (() => void)[] = []

beforeEach(() => {
  dossier = mkdtempSync(join(tmpdir(), 'base-'))
  aFermer = []
})

afterEach(() => {
  for (const fermer of aFermer) fermer()
  try {
    rmSync(dossier, { recursive: true, force: true })
  } catch {
    // Le ménage n'est pas ce qu'on vérifie, et il échoue sous Windows : le
    // système garde un instant la main sur le fichier après la fermeture, et
    // `rmSync` refuse alors le dossier entier. Laisser l'exception remonter
    // ferait échouer des tests qui ont pourtant tout vérifié — c'est ce qui est
    // arrivé ici avant cette précaution. Ce qui reste est dans le dossier
    // temporaire du système, qui a déjà un balai.
  }
})

function chemin() {
  return join(dossier, 'sous-dossier', 'speed.db')
}

/** Ouvre une base, et retient sa fermeture pour la fin du test. */
async function ouvrir(fichier: string): Promise<Base> {
  const { base, fermer } = await ouvrirBase({ fichier, migrations: MIGRATIONS })
  aFermer.push(fermer)
  return base
}

async function tables(base: Base): Promise<string[]> {
  const lu = await base.all<{ name: string }>(
    sql`select name from sqlite_master where type = 'table' order by name`,
  )
  return lu.map((ligne) => ligne.name).filter((nom) => !nom.startsWith('sqlite_'))
}

describe('ouvrir la base', () => {
  it('crée le fichier, son dossier, et joue les migrations', async () => {
    // Le dossier n'existe pas : c'est le cas d'un volume qu'on vient de monter.
    // Le pilote ne crée pas l'arborescence, il échoue — d'où la vérification.
    const base = await ouvrir(chemin())

    expect(await tables(base)).toEqual(
      expect.arrayContaining([
        'accounts',
        'deposits',
        'engines',
        'gearboxes',
        'measured_cars',
        'profiles',
        'rights',
      ]),
    )
  })

  it('sème un compte unique, et un seul', async () => {
    const base = await ouvrir(chemin())

    const comptes = await base.select().from(accounts)
    expect(comptes).toHaveLength(1)
    expect(comptes[0]?.id).toBe(SOLO_ACCOUNT_ID)
  })

  it('ne change rien au second appel', async () => {
    // C'est la seule façon d'accepter qu'une base se migre toute seule au
    // démarrage : relancer le serveur ne doit rien produire de neuf.
    const fichier = chemin()
    const premiere = await ouvrir(fichier)
    const avant = await tables(premiere)

    const seconde = await ouvrir(fichier)

    expect(await tables(seconde)).toEqual(avant)
    expect(await seconde.select().from(accounts)).toHaveLength(1)
  })

  it('garde ce qui a été écrit quand on la rouvre', async () => {
    // Le fichier vit dans un volume et le conteneur, lui, se remplace. Ce test
    // est le plus proche qu'on puisse écrire de ce remplacement sans conteneur :
    // on ferme tout, on rouvre, et ce qu'on avait écrit est là.
    const fichier = chemin()
    const premiere = await ouvrir(fichier)
    await premiere.insert(engines).values({
      id: 'moteur-1',
      accountId: SOLO_ACCOUNT_ID,
      name: 'V8',
      content: { sampleDir: 'demo' },
    })

    const seconde = await ouvrir(fichier)
    const moteurs = await seconde.select().from(engines)

    expect(moteurs).toHaveLength(1)
    expect(moteurs[0]?.name).toBe('V8')
    expect(moteurs[0]?.content).toEqual({ sampleDir: 'demo' })
  })
})

describe('ce que le schéma garantit', () => {
  it('un dépôt de même nom remplace au lieu de s’ajouter', async () => {
    // C'est ce que faisait le dépôt de fichiers, et ce que la voiture attend
    // quand elle rejoue un envoi qu'elle croit perdu.
    const base = await ouvrir(chemin())
    const commun = {
      accountId: SOLO_ACCOUNT_ID,
      folder: 'traces',
      name: 'sortie.jsonl.gz',
    }

    await base.insert(deposits).values({ id: 'a', ...commun, content: 'un', bytes: 2 })
    await base
      .insert(deposits)
      .values({ id: 'a', ...commun, content: 'deux', bytes: 4 })
      .onConflictDoUpdate({ target: deposits.id, set: { content: 'deux', bytes: 4 } })

    const lignes = await base.select().from(deposits)
    expect(lignes).toHaveLength(1)
    expect(lignes[0]?.content).toBe('deux')
  })

  it('une trace naît non épinglée', async () => {
    const base = await ouvrir(chemin())
    await base.insert(deposits).values({
      id: 'b',
      accountId: SOLO_ACCOUNT_ID,
      folder: 'traces',
      name: 'autre.jsonl.gz',
      content: 'x',
      bytes: 1,
    })

    expect((await base.select().from(deposits))[0]?.pinned).toBe(false)
  })

  it('un profil peut désigner un moteur qui n’existe pas ici', async () => {
    // C'est ce qui fait marcher le partage : un profil reçu désigne le moteur de
    // celui qui l'a envoyé, introuvable chez nous. Une clé étrangère refuserait
    // l'enregistrement là où le cœur sait rendre un moteur d'ici.
    const base = await ouvrir(chemin())

    await base.insert(profiles).values({
      id: 'p1',
      accountId: SOLO_ACCOUNT_ID,
      name: 'Reçu d’ailleurs',
      engineId: 'un-moteur-de-chez-quelquun-dautre',
      content: {},
    })

    expect(await base.select().from(profiles)).toHaveLength(1)
  })

  it('ce qui appartient à un compte s’en va avec lui', async () => {
    const base = await ouvrir(chemin())
    await base.insert(rights).values({ id: 'd1', accountId: SOLO_ACCOUNT_ID, scope: 'atelier' })
    await base.insert(engines).values({
      id: 'm1',
      accountId: SOLO_ACCOUNT_ID,
      name: 'V8',
      content: {},
    })

    await base.delete(accounts)

    expect(await base.select().from(rights)).toHaveLength(0)
    expect(await base.select().from(engines)).toHaveLength(0)
  })

  it('un compte ne porte pas deux fois le même droit', async () => {
    const base = await ouvrir(chemin())
    await base.insert(rights).values({ id: 'd1', accountId: SOLO_ACCOUNT_ID, scope: 'atelier' })

    await expect(
      base.insert(rights).values({ id: 'd2', accountId: SOLO_ACCOUNT_ID, scope: 'atelier' }),
    ).rejects.toThrow()
  })
})
