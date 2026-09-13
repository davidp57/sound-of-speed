/**
 * Ce qu'on vérifie ici : ce que le serveur accorde, et ce qu'il retire.
 *
 * Un droit daté disparaît de lui-même quand l'heure passe — personne n'efface
 * la ligne, c'est la lecture qui l'écarte. Et la valeur par défaut est bien une
 * valeur : la vider ferme tout, ce qui est ce qu'on fera le jour où l'on ouvre.
 */

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ouvrirBase, type Base } from './base/base'
import { rights } from './base/schema'
import { ANCIEN_COMPTE_UNIQUE as COMPTE, semerLAncienCompte } from './heritage'
import { droitsDuCompte, offertsDeLEnvironnement, rolesDe } from './roles'

const MIGRATIONS = 'src/server/base/migrations'
const MIDI = Date.parse('2026-09-13T12:00:00Z')
const UNE_HEURE = 60 * 60 * 1000

let dossier: string
let base: Base
let fermer: () => void

beforeEach(async () => {
  dossier = mkdtempSync(join(tmpdir(), 'roles-'))
  const ouverte = await ouvrirBase({ fichier: join(dossier, 'speed.db'), migrations: MIGRATIONS })
  base = ouverte.base
  fermer = ouverte.fermer
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

/** Un droit en base, daté ou non. L'échéance est en secondes, comme la colonne. */
async function accorder(role: string, expireLe: number | null = null): Promise<void> {
  await base.insert(rights).values({
    id: `${role}-${String(expireLe)}`,
    accountId: COMPTE,
    scope: role,
    ...(expireLe === null ? {} : { expiresAt: Math.floor(expireLe / 1000) }),
  })
}

describe('les droits d’un compte', () => {
  it('donne les trois rôles à qui n’a rien, tant que rien n’est encaissé', async () => {
    const droits = await droitsDuCompte(base, COMPTE, MIDI)
    expect(rolesDe(droits)).toEqual(['conduite', 'atelier', 'synthese'])
    // Sans échéance : ce qui est offert ne se referme pas.
    expect(droits.every((droit) => droit.expireLe === null)).toBe(true)
  })

  it('ne donne que ce qui est offert quand le compte n’a rien en propre', async () => {
    const droits = await droitsDuCompte(base, COMPTE, MIDI, ['conduite'])
    expect(rolesDe(droits)).toEqual(['conduite'])
  })

  it('ajoute au compte ce qu’il porte en propre, avec son échéance', async () => {
    await accorder('atelier', MIDI + UNE_HEURE)

    const droits = await droitsDuCompte(base, COMPTE, MIDI, ['conduite'])
    expect(droits).toEqual([
      { role: 'conduite', expireLe: null },
      { role: 'atelier', expireLe: MIDI + UNE_HEURE },
    ])
  })

  it('retire un droit dont l’échéance est passée, sans que rien ne l’efface', async () => {
    await accorder('atelier', MIDI + UNE_HEURE)

    expect(rolesDe(await droitsDuCompte(base, COMPTE, MIDI, []))).toEqual(['atelier'])
    expect(rolesDe(await droitsDuCompte(base, COMPTE, MIDI + 2 * UNE_HEURE, []))).toEqual([])

    // La ligne est toujours là : c'est la lecture qui l'écarte, et un droit
    // repris se rendrait en repoussant sa date.
    const restantes = await base.select({ scope: rights.scope }).from(rights)
    expect(restantes).toHaveLength(1)
  })

  it('laisse sans échéance un rôle à la fois offert et acheté', async () => {
    await accorder('synthese', MIDI + UNE_HEURE)

    const droits = await droitsDuCompte(base, COMPTE, MIDI, ['synthese'])
    // Le faire expirer refermerait, le jour dit, quelque chose qui reste gratuit.
    expect(droits).toEqual([{ role: 'synthese', expireLe: null }])
  })

  it('ignore une portée qui ne désigne aucun rôle connu', async () => {
    await accorder('banc-d-essai')
    expect(rolesDe(await droitsDuCompte(base, COMPTE, MIDI, []))).toEqual([])
  })

  it('ne donne rien à un compte qui n’existe pas', async () => {
    expect(rolesDe(await droitsDuCompte(base, 'personne', MIDI, []))).toEqual([])
  })
})

describe('les rôles offerts par l’environnement', () => {
  it('vaut les trois quand la variable est absente', () => {
    expect(offertsDeLEnvironnement(undefined)).toEqual(['conduite', 'atelier', 'synthese'])
  })

  it('vaut aucun quand elle est vide, ce qui ferme tout', () => {
    expect(offertsDeLEnvironnement('')).toEqual([])
    expect(offertsDeLEnvironnement('   ')).toEqual([])
  })

  it('lit une liste, dans l’ordre des rôles et sans les inconnus', () => {
    expect(offertsDeLEnvironnement('synthese, conduite, banc')).toEqual(['conduite', 'synthese'])
  })
})
