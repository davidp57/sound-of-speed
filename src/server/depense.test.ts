/**
 * Ce qu'on relève de la dépense du serveur.
 *
 * Le point qui compte : **un relevé est une différence**. Un compteur depuis le
 * démarrage divisé par une durée montre une moyenne là où il faut une tendance,
 * et c'est ainsi qu'on désigne un coupable qui ne consomme plus rien.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ouvrirBase, type Base } from './base/base'
import {
  compteurDeDepense,
  formaterDepense,
  poidsDesBanques,
  poidsDesComptes,
} from './depense'
import { ecrireDepot } from './depots'
import { ANCIEN_COMPTE_UNIQUE, semerLAncienCompte } from './heritage'

let racine: string
let base: Base
let fermer: () => void

beforeEach(async () => {
  racine = mkdtempSync(join(tmpdir(), 'depense-'))
  const ouverte = await ouvrirBase({
    fichier: join(racine, 'speed.db'),
    migrations: 'src/server/base/migrations',
  })
  base = ouverte.base
  fermer = ouverte.fermer
  await semerLAncienCompte(base)
})

afterEach(() => {
  fermer()
  try {
    rmSync(racine, { recursive: true, force: true })
  } catch {
    // Le ménage n'est pas ce qu'on vérifie.
  }
})

describe('le compteur', () => {
  it('rend ce que la période a coûté, puis repart de zéro', () => {
    const compteur = compteurDeDepense(1000)
    compteur.echantillonServi(500)
    compteur.echantillonServi(300)
    compteur.traceAnalysee(40)

    const premier = compteur.releverEtRepartir(2000)
    expect(premier).toEqual({
      depuis: 1000,
      echantillons: { octets: 800, demandes: 2 },
      analyse: { millisecondes: 40, traces: 1 },
    })

    // Le second relevé ne doit rien traîner du premier : sans ça, un serveur
    // allumé depuis trois mois montrerait une moyenne au lieu d'une tendance.
    const second = compteur.releverEtRepartir(3000)
    expect(second).toEqual({
      depuis: 2000,
      echantillons: { octets: 0, demandes: 0 },
      analyse: { millisecondes: 0, traces: 0 },
    })
  })
})

describe('le poids des banques', () => {
  it('compte les octets dossier par dossier, sous-dossiers compris', () => {
    const audio = join(racine, 'audio')
    mkdirSync(join(audio, 'une', 'dedans'), { recursive: true })
    mkdirSync(join(audio, 'autre'), { recursive: true })
    writeFileSync(join(audio, 'une', 'a.flac'), 'x'.repeat(100))
    writeFileSync(join(audio, 'une', 'dedans', 'b.flac'), 'x'.repeat(50))
    writeFileSync(join(audio, 'autre', 'c.flac'), 'x'.repeat(10))

    expect(poidsDesBanques(audio)).toEqual({ octets: 160, banques: 2 })
  })

  it('ne se plaint pas d’un dossier absent : il n’y a rien à dire', () => {
    expect(poidsDesBanques(join(racine, 'nulle-part'))).toEqual({ octets: 0, banques: 0 })
    expect(poidsDesBanques(undefined)).toEqual({ octets: 0, banques: 0 })
  })
})

describe('le poids des comptes', () => {
  it('range les comptes du plus lourd au plus léger', async () => {
    await ecrireDepot(base, ANCIEN_COMPTE_UNIQUE, 'traces', 'a.jsonl', Buffer.alloc(300))
    await ecrireDepot(base, ANCIEN_COMPTE_UNIQUE, 'journal', 'b.jsonl', Buffer.alloc(200))

    const poids = await poidsDesComptes(base, join(racine, 'speed.db'))

    expect(poids.parCompte).toEqual([{ compte: ANCIEN_COMPTE_UNIQUE, octets: 500 }])
    expect(poids.fichier).toBeGreaterThan(0)
  })
})

describe('la ligne du journal', () => {
  it('porte les quatre chiffres, et la durée qu’elle couvre', () => {
    const ligne = formaterDepense(
      {
        depuis: 0,
        echantillons: { octets: 2 * 1024 * 1024, demandes: 12 },
        analyse: { millisecondes: 900, traces: 3 },
      },
      { octets: 5 * 1024 * 1024, banques: 4 },
      { fichier: 1024 * 1024, parCompte: [{ compte: 'abcdefghij', octets: 512 * 1024 }] },
      3_600_000,
    )

    expect(ligne).toContain('sur 1.0 h')
    expect(ligne).toContain('échantillons 2.0 Mio en 12 demandes')
    expect(ligne).toContain('banques 5.0 Mio en 4 dossiers')
    expect(ligne).toContain('base 1.0 Mio')
    expect(ligne).toContain('300 ms par trace sur 3')
  })

  it('le dit franchement quand aucune trace n’a été analysée', () => {
    const ligne = formaterDepense(
      { depuis: 0, echantillons: { octets: 0, demandes: 0 }, analyse: { millisecondes: 0, traces: 0 } },
      { octets: 0, banques: 0 },
      { fichier: 0, parCompte: [] },
      3_600_000,
    )

    // Zéro divisé par zéro donnerait « NaN ms par trace », ce qui se lit comme
    // une panne alors que c'est le cas normal d'une journée sans trajet.
    expect(ligne).toContain('aucune trace')
    expect(ligne).not.toContain('NaN')
  })
})
