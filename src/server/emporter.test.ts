/**
 * Ce qu'on vérifie ici : ce qu'un compte emporte est **tout** ce qu'il porte, et
 * rien de ce que portent les autres.
 *
 * Le second point est celui qui compte : une archive qui emporterait les
 * trajets du voisin serait une fuite, et elle ne se verrait pas — l'archive est
 * un fichier qu'on ouvre six mois plus tard.
 */

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { readZip } from '../core/archive/zip'
import { ouvrirBase, type Base } from './base/base'
import { ecrireDepot } from './depots'
import { archiveDuCompte } from './emporter'
import { ecrireEntite } from './entites'
import { semerLAncienCompte } from './heritage'
import { reprendreTout } from './profil-mesure'
import { ecrireProfil } from './profils'

const MIGRATIONS = 'src/server/base/migrations'

let dossier: string
let base: Base
let fermer: () => void

beforeEach(async () => {
  dossier = mkdtempSync(join(tmpdir(), 'emporter-'))
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
    // Sous Windows, le système garde un instant la main sur le fichier.
  }
})

/** Les noms rangés dans l'archive d'un compte. */
async function nomsDe(compte: string): Promise<string[]> {
  const { flux } = archiveDuCompte(base, compte)
  const octets = new Uint8Array(await new Response(flux).arrayBuffer())
  return (await readZip(octets)).entries.map((entree) => entree.name).sort()
}

describe('emporter ce qu’un compte porte', () => {
  it('range chaque chose dans le dossier où elle vivait', async () => {
    // L'arborescence du serveur est gardée : ce qui sort se reverse tel quel,
    // sans avoir à deviner quel fichier allait où.
    await ecrireProfil(base, 'solo', 'route.json', '{"name":"Route"}')
    await ecrireEntite(base, 'engines', 'solo', 'ej25.json', '{"version":1}')
    await ecrireEntite(base, 'gearboxes', 'solo', 'six.json', '{"version":1}')
    await ecrireDepot(base, 'solo', 'traces', '2026-09-13_001.jsonl.gz', Buffer.from([1, 2, 3]))
    await ecrireDepot(base, 'solo', 'journal', 'bord.jsonl.gz', Buffer.from([4, 5]))
    await ecrireDepot(base, 'solo', 'mesures', 'sonde.json', Buffer.from([6]))

    expect(await nomsDe('solo')).toEqual([
      'engines/ej25.json',
      'gearboxes/six.json',
      'journal/bord.jsonl.gz',
      'mesures/sonde.json',
      'profiles/route.json',
      'traces/2026-09-13_001.jsonl.gz',
    ])
  })

  it('emporte le profil mesuré, qui n’a pas de dossier', async () => {
    // Il est rendu sous `/mesure-voiture/`, au singulier, et il n'y en a qu'un
    // par compte : il ne pouvait pas se ranger comme les autres.
    await reprendreTout(base, 'solo')

    expect(await nomsDe('solo')).toEqual(['mesure-voiture.json'])
  })

  it('n’invente pas de profil mesuré à un compte qui n’en a pas', async () => {
    await ecrireProfil(base, 'solo', 'seul.json', '{"name":"Seul"}')

    expect(await nomsDe('solo')).toEqual(['profiles/seul.json'])
  })

  it('n’emporte rien de ce que porte un autre compte', async () => {
    await ecrireProfil(base, 'solo', 'a-moi.json', '{"name":"À moi"}')

    // Un compte qui n'existe pas porte forcément moins encore qu'un compte vide.
    expect(await nomsDe('quelqu-un-d-autre')).toEqual([])
  })

  it('rend les octets déposés tels quels', async () => {
    // Les tranches sont déjà compressées : ce qui ressort doit être exactement
    // ce qui était monté, sans passer par un décodage qui n'a pas de sens.
    const octets = Buffer.from([31, 139, 8, 0, 0, 0, 0, 0])
    await ecrireDepot(base, 'solo', 'traces', 'tranche.jsonl.gz', octets)

    const { flux } = archiveDuCompte(base, 'solo')
    const archive = new Uint8Array(await new Response(flux).arrayBuffer())
    const dedans = (await readZip(archive)).entries.find(
      (e) => e.name === 'traces/tranche.jsonl.gz',
    )

    expect(dedans?.bytes).toEqual(new Uint8Array(octets))
  })

  it('porte la date du jour dans son nom', async () => {
    const quand = new Date('2026-09-13T15:30:00Z')
    expect(archiveDuCompte(base, 'solo', quand).nom).toBe('sound-of-speed-2026-09-13-15-30-00.zip')
  })

  it('écarte un nom qui remonte l’arborescence, d’où qu’il vienne', async () => {
    // L'adresse refuse désormais un tel nom, mais la base peut en porter un :
    // versé avant ce contrôle, ou remonté par la reprise d'un ancien dossier.
    // L'entrée `traces/../../dehors.txt` s'écrit hors du dossier désigné chez
    // celui qui extrait — et il extrait sur son poste de travail, pas ici.
    await ecrireDepot(base, 'solo', 'traces', '../../dehors.txt', Buffer.from('charge'))
    await ecrireProfil(base, 'solo', 'reste.json', '{"name":"Reste"}')

    const noms = await nomsDe('solo')

    expect(noms).not.toContain('traces/../../dehors.txt')
    expect(noms.some((nom) => nom.includes('..'))).toBe(false)
    // Le reste de l'archive est intact : on écarte une entrée, pas l'archive.
    expect(noms).toContain('profiles/reste.json')
  })
})
