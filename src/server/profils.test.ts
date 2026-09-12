import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { sql } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { SOLO_ACCOUNT_ID, ouvrirBase, type Base } from './base/base'
import { ecrireProfil, lireProfil, listerProfils } from './profils'

const MIGRATIONS = 'src/server/base/migrations'

let dossier: string
let base: Base
let fermer: () => void

beforeEach(async () => {
  dossier = mkdtempSync(join(tmpdir(), 'profils-'))
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

const UN_PROFIL = JSON.stringify({ name: 'Mon V8', sampleDir: 'procar', layers: [] })

describe('la bibliothèque de profils', () => {
  it('part vide, sans que ce soit une anomalie', async () => {
    // Le dossier était facultatif, et son absence n'avait rien d'anormal : le
    // client le traite déjà comme une liste vide.
    expect(await listerProfils(base, SOLO_ACCOUNT_ID)).toEqual([])
  })

  it('rend le profil déposé, tel qu’il a été déposé', async () => {
    await ecrireProfil(base, SOLO_ACCOUNT_ID, 'mon-v8.json', UN_PROFIL)

    expect(JSON.parse((await lireProfil(base, SOLO_ACCOUNT_ID, 'mon-v8.json')) ?? '')).toEqual(
      JSON.parse(UN_PROFIL),
    )
  })

  it('liste au format que le cœur attend', async () => {
    // Un tableau d'entrées `{ name, type, mtime }` : la bibliothèque filtre sur
    // le type puis sur l'extension, et se sert du nom comme clé. La date est
    // celle que l'autoindex de nginx rendait, et que la réécriture avait perdue.
    await ecrireProfil(base, SOLO_ACCOUNT_ID, 'mon-v8.json', UN_PROFIL)

    const [entree] = await listerProfils(base, SOLO_ACCOUNT_ID)
    expect(entree?.name).toBe('mon-v8.json')
    expect(entree?.type).toBe('file')
    expect(Number.isNaN(Date.parse(entree?.mtime ?? ''))).toBe(false)
  })

  it('avance la date quand on redépose', async () => {
    // Sans cela, la règle du plus récent n'arbitre rien : elle rendrait toujours
    // le même verdict, et un profil réglé dans la voiture passerait pour ancien.
    await ecrireProfil(base, SOLO_ACCOUNT_ID, 'mon-v8.json', UN_PROFIL)
    await base.run(sql`UPDATE profiles SET updated_at = updated_at - 1`)
    const [avant] = await listerProfils(base, SOLO_ACCOUNT_ID)

    await ecrireProfil(base, SOLO_ACCOUNT_ID, 'mon-v8.json', UN_PROFIL)
    const [apres] = await listerProfils(base, SOLO_ACCOUNT_ID)

    expect(Date.parse(apres?.mtime ?? '')).toBeGreaterThan(Date.parse(avant?.mtime ?? ''))
  })

  it('rend le nom de fichier déposé, et non un nom dérivé du profil', async () => {
    // Le profil s'appelle « Mon V8 » et le fichier « autre-chose.json ». C'est le
    // fichier que la bibliothèque manipule : lui rendre un nom dérivé du profil
    // reviendrait à le renommer dans son dos.
    await ecrireProfil(base, SOLO_ACCOUNT_ID, 'autre-chose.json', UN_PROFIL)

    expect(nomsDe(await listerProfils(base, SOLO_ACCOUNT_ID))).toEqual(['autre-chose.json'])
  })

  it('remplace quand on redépose le même nom', async () => {
    // C'est ce que faisait le dépôt de fichiers, et ce que la bibliothèque
    // attend quand elle renvoie un profil qu'elle a modifié.
    await ecrireProfil(base, SOLO_ACCOUNT_ID, 'mon-v8.json', UN_PROFIL)
    await ecrireProfil(
      base,
      SOLO_ACCOUNT_ID,
      'mon-v8.json',
      JSON.stringify({ name: 'Mon V8 retouché' }),
    )

    const liste = await listerProfils(base, SOLO_ACCOUNT_ID)
    expect(liste).toHaveLength(1)
    expect(JSON.parse((await lireProfil(base, SOLO_ACCOUNT_ID, 'mon-v8.json')) ?? '')).toEqual({
      name: 'Mon V8 retouché',
    })
  })

  it('garde deux profils sous deux noms', async () => {
    await ecrireProfil(base, SOLO_ACCOUNT_ID, 'un.json', UN_PROFIL)
    await ecrireProfil(base, SOLO_ACCOUNT_ID, 'deux.json', UN_PROFIL)

    expect(nomsDe(await listerProfils(base, SOLO_ACCOUNT_ID))).toEqual(['deux.json', 'un.json'])
  })

  it('rend rien pour un profil qu’on n’a pas déposé', async () => {
    expect(await lireProfil(base, SOLO_ACCOUNT_ID, 'jamais-vu.json')).toBeNull()
  })

  it('refuse ce qui n’est pas du JSON, plutôt que de le ranger', async () => {
    // Le laisser entrer rendrait la bibliothèque muette pour ce fichier, sans
    // rien dire : elle abandonne un profil illisible sans le signaler.
    expect(await ecrireProfil(base, SOLO_ACCOUNT_ID, 'bancal.json', 'ceci{ n’est pas')).toBe(
      'illisible',
    )
    expect(await listerProfils(base, SOLO_ACCOUNT_ID)).toEqual([])
  })

  it('ne valide pas la forme du profil, et c’est voulu', async () => {
    // Le cœur est la seule autorité sur la forme d'un profil, et il la vérifie
    // déjà à la lecture. Un serveur qui validerait aussi ferait une seconde
    // description à tenir d'accord avec la première — le travers que le dépôt a
    // déjà payé ailleurs.
    expect(await ecrireProfil(base, SOLO_ACCOUNT_ID, 'etrange.json', '{"rien":"de connu"}')).toBe(
      'écrit',
    )
  })
})

/** Les noms d'un listage : la date, elle, est vérifiée à part. */
function nomsDe(entrees: readonly { name: string; type: string }[]): string[] {
  return entrees.map((entree) => entree.name)
}
