import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { sql } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ouvrirBase, type Base } from './base/base'
import { ANCIEN_COMPTE_UNIQUE as COMPTE, semerLAncienCompte } from './heritage'
import { ecrireEntite, estUnRegistre, lireEntite, listerEntites } from './entites'

const MIGRATIONS = 'src/server/base/migrations'

let dossier: string
let base: Base
let fermer: () => void

beforeEach(async () => {
  dossier = mkdtempSync(join(tmpdir(), 'entites-'))
  const ouverte = await ouvrirBase({ fichier: join(dossier, 'speed.db'), migrations: MIGRATIONS })
  base = ouverte.base
  fermer = ouverte.fermer
  // Le compte d'avant l'identité sert ici de propriétaire : ces modules prennent
  // un compte en paramètre, et n'importe lequel ferait l'affaire. Il n'est plus
  // semé à l'ouverture de la base — c'est le premier appareil qui crée le sien.
  await semerLAncienCompte(base)
})

afterEach(() => {
  fermer()
  try {
    rmSync(dossier, { recursive: true, force: true })
  } catch {
    // Le ménage n'est pas ce qu'on vérifie.
  }
})

describe('les moteurs et les boîtes', () => {
  it('rend un moteur tel qu’il a été déposé', async () => {
    const contenu = JSON.stringify({ version: 1, engine: { id: 'v8', name: 'V8' } })

    expect(await ecrireEntite(base, 'engines', COMPTE, 'v8.json', contenu)).toBe('écrit')
    expect(await lireEntite(base, 'engines', COMPTE, 'v8.json')).toBe(contenu)
  })

  it('liste dans la forme que le cœur lit déjà', async () => {
    await ecrireEntite(base, 'engines', COMPTE, 'v8.json', '{"name":"V8"}')

    expect(nomsDe(await listerEntites(base, 'engines', COMPTE))).toEqual(['v8.json'])
  })

  it('date chaque entrée, comme l’autoindex le faisait', async () => {
    // Sans la date, la voiture ne peut pas savoir au lancement si la base porte
    // plus récent qu'elle sans télécharger chaque fichier pour le comparer.
    await ecrireEntite(base, 'engines', COMPTE, 'v8.json', '{"name":"V8"}')

    const [entree] = await listerEntites(base, 'engines', COMPTE)
    expect(Number.isNaN(Date.parse(entree?.mtime ?? ''))).toBe(false)
  })

  it('ne mélange pas les deux registres', async () => {
    // Deux tables de même forme : rien n'empêcherait de se tromper de table, et
    // le symptôme serait une boîte qui apparaît dans la liste des moteurs.
    await ecrireEntite(base, 'engines', COMPTE, 'v8.json', '{"name":"V8"}')
    await ecrireEntite(base, 'gearboxes', COMPTE, 'longue.json', '{"name":"Longue"}')

    expect(nomsDe(await listerEntites(base, 'engines', COMPTE))).toEqual(['v8.json'])
    expect(nomsDe(await listerEntites(base, 'gearboxes', COMPTE))).toEqual([
      'longue.json',
    ])
    expect(await lireEntite(base, 'engines', COMPTE, 'longue.json')).toBeNull()
  })

  it('remplace au lieu d’ajouter quand le nom revient', async () => {
    await ecrireEntite(base, 'engines', COMPTE, 'v8.json', '{"name":"V8","gain":1}')
    await ecrireEntite(base, 'engines', COMPTE, 'v8.json', '{"name":"V8","gain":9}')

    expect(await listerEntites(base, 'engines', COMPTE)).toHaveLength(1)
    expect(await lireEntite(base, 'engines', COMPTE, 'v8.json')).toContain('"gain":9')
  })

  it('refait la date de modification à chaque écriture', async () => {
    // Sans elle, la règle du plus récent n'arbitre rien : elle rendrait toujours
    // le même verdict, et un moteur réglé dans la voiture passerait pour ancien.
    await ecrireEntite(base, 'engines', COMPTE, 'v8.json', '{"name":"V8"}')

    // Reculée d'une seconde avant de relever : la date est en secondes entières,
    // et deux écritures dans la même seconde donneraient le même chiffre — le
    // test passerait ou non selon l'horloge.
    await base.run(sql`UPDATE engines SET updated_at = updated_at - 1`)
    const [avant] = await base.query.engines.findMany()

    await ecrireEntite(base, 'engines', COMPTE, 'v8.json', '{"name":"V8 bis"}')
    const [apres] = await base.query.engines.findMany()

    expect(apres?.updatedAt).toBeGreaterThan(avant?.updatedAt ?? 0)
  })

  it('refuse ce qui n’est pas du JSON, sans le ranger', async () => {
    expect(await ecrireEntite(base, 'engines', COMPTE, 'casse.json', 'pas du JSON')).toBe(
      'illisible',
    )
    expect(await listerEntites(base, 'engines', COMPTE)).toEqual([])
  })

  it('ne connaît que deux registres', () => {
    expect(estUnRegistre('engines')).toBe(true)
    expect(estUnRegistre('gearboxes')).toBe(true)
    expect(estUnRegistre('profiles')).toBe(false)
  })
})

/** Les noms d'un listage : la date, elle, est vérifiée à part. */
function nomsDe(entrees: readonly { name: string; type: string }[]): string[] {
  return entrees.map((entree) => entree.name)
}
