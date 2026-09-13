import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gunzipSync, gzipSync } from 'node:zlib'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { SOLO_ACCOUNT_ID, ouvrirBase, type Base } from './base/base'
import {
  CHARGE_MAXIMALE,
  ecrireDepot,
  estUnDossier,
  lireDepot,
  listerDepots,
  remplirLesDatesDEnregistrement,
} from './depots'
import { deposits } from './base/schema'

const MIGRATIONS = 'src/server/base/migrations'
const TRANCHE = '2026-09-11-06-24-01_da2m_001.jsonl.gz'

let dossier: string
let base: Base
let fermer: () => void

beforeEach(async () => {
  dossier = mkdtempSync(join(tmpdir(), 'depots-'))
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

describe('ce que la voiture envoie en roulant', () => {
  it('rend une tranche compressée **à l’octet près**', async () => {
    // C'est la promesse qui compte. Une tranche qui redescend altérée ne se
    // décompresse pas, et le relecteur ne peut plus rien en faire — sans que
    // rien n'ait signalé quoi que ce soit en chemin.
    const octets = Buffer.from(gzipSync(Buffer.from('{"t":0}\n{"t":1}\n')))

    await ecrireDepot(base, SOLO_ACCOUNT_ID, 'traces', 'sortie.jsonl.gz', octets)
    const redescendu = await lireDepot(base, SOLO_ACCOUNT_ID, 'traces', 'sortie.jsonl.gz')

    expect(redescendu).not.toBeNull()
    expect(Buffer.from(redescendu!).equals(octets)).toBe(true)
    expect(gunzipSync(Buffer.from(redescendu!)).toString()).toBe('{"t":0}\n{"t":1}\n')
  })

  it('liste sous le nom exact, extension comprise', async () => {
    // Le client décide de décompresser **au nom du fichier**, jamais au type que
    // le serveur annonce. Renommer une tranche en chemin la rendrait illisible.
    await ecrireDepot(base, SOLO_ACCOUNT_ID, 'traces', 'sortie.jsonl.gz', Buffer.from('x'))

    expect(nomsDe(await listerDepots(base, SOLO_ACCOUNT_ID, 'traces'))).toEqual([
      'sortie.jsonl.gz',
    ])
  })

  it('ne mélange pas les trois dossiers', async () => {
    // Ils étaient séparés pour une raison de listage qui n'existe plus. Ils
    // restent distincts parce que le client les demande séparément.
    await ecrireDepot(base, SOLO_ACCOUNT_ID, 'traces', 'a.gz', Buffer.from('a'))
    await ecrireDepot(base, SOLO_ACCOUNT_ID, 'journal', 'b.gz', Buffer.from('b'))
    await ecrireDepot(base, SOLO_ACCOUNT_ID, 'mesures', 'c.json', Buffer.from('c'))

    expect(await listerDepots(base, SOLO_ACCOUNT_ID, 'traces')).toHaveLength(1)
    expect(await listerDepots(base, SOLO_ACCOUNT_ID, 'journal')).toHaveLength(1)
    expect(await listerDepots(base, SOLO_ACCOUNT_ID, 'mesures')).toHaveLength(1)
  })

  it('ne duplique pas une session qui repart', async () => {
    // La voiture rejoue un envoi qu'elle croit perdu, sous le même nom. Un
    // serveur qui empilerait ferait grossir la base à chaque reprise de réseau,
    // avec des copies identiques.
    await ecrireDepot(base, SOLO_ACCOUNT_ID, 'traces', 'sortie.gz', Buffer.from('premier'))
    await ecrireDepot(base, SOLO_ACCOUNT_ID, 'traces', 'sortie.gz', Buffer.from('second'))

    expect(await listerDepots(base, SOLO_ACCOUNT_ID, 'traces')).toHaveLength(1)
    const lu = await lireDepot(base, SOLO_ACCOUNT_ID, 'traces', 'sortie.gz')
    expect(Buffer.from(lu!).toString()).toBe('second')
  })

  it('refuse une charge trop grosse, et le dit comme un refus', async () => {
    // Le client ne rejoue pas ce refus. S'il était rendu par un code de panne,
    // la voiture réessaierait indéfiniment un envoi qui ne passera jamais.
    const trop = Buffer.alloc(CHARGE_MAXIMALE + 1)

    expect(await ecrireDepot(base, SOLO_ACCOUNT_ID, 'traces', 'enorme.gz', trop)).toBe('trop gros')
    expect(await listerDepots(base, SOLO_ACCOUNT_ID, 'traces')).toEqual([])
  })

  it('accepte une charge à la limite', async () => {
    const juste = Buffer.alloc(CHARGE_MAXIMALE)

    expect(await ecrireDepot(base, SOLO_ACCOUNT_ID, 'traces', 'limite.gz', juste)).toBe('écrit')
  })

  it('rend rien pour ce qui n’a pas été déposé', async () => {
    expect(await lireDepot(base, SOLO_ACCOUNT_ID, 'traces', 'jamais.gz')).toBeNull()
  })
})

describe('les dossiers que la voiture connaît', () => {
  it('reconnaît les trois, et rien d’autre', () => {
    expect(estUnDossier('traces')).toBe(true)
    expect(estUnDossier('journal')).toBe(true)
    expect(estUnDossier('mesures')).toBe(true)
    expect(estUnDossier('ailleurs')).toBe(false)
    expect(estUnDossier('../etc')).toBe(false)
  })
})

/** Les noms d'un listage : la date, elle, est vérifiée à part. */
function nomsDe(entrees: readonly { name: string; type: string }[]): string[] {
  return entrees.map((entree) => entree.name)
}

describe('la date du trajet', () => {
  it('vient du nom, pas de l’heure du dépôt', async () => {
    // Une trace enregistrée hors réseau et remontée trois jours plus tard porte
    // une date de dépôt postérieure au trajet. C'est la date du nom qui décide
    // de l'effacement.
    await ecrireDepot(base, SOLO_ACCOUNT_ID, 'traces', TRANCHE, Buffer.from('x'))

    const [ligne] = await base.select().from(deposits)

    expect(ligne!.recordedAt).toBe(Math.floor(Date.UTC(2026, 8, 11, 6, 24, 1) / 1000))
    expect(ligne!.recordedAt).not.toBe(ligne!.depositedAt)
  })

  it('se rattrape sur les dépôts entrés avant qu’elle existe', async () => {
    // Les quatre-vingt-quatorze dépôts de la production prétendent tous dater de
    // l'heure où la reprise a tourné.
    await ecrireDepot(base, SOLO_ACCOUNT_ID, 'traces', TRANCHE, Buffer.from('x'))
    await base.update(deposits).set({ recordedAt: null })

    expect(await remplirLesDatesDEnregistrement(base)).toBe(1)

    const [ligne] = await base.select().from(deposits)
    expect(ligne!.recordedAt).toBe(Math.floor(Date.UTC(2026, 8, 11, 6, 24, 1) / 1000))
  })

  it('donne sa date de dépôt à un nom libre, plutôt que rien', async () => {
    // Deux traces anciennes n'ont pas de date lisible dans leur nom. Une colonne
    // vide obligerait tout ce qui lit cette date à se demander ce qu'elle veut
    // dire.
    await ecrireDepot(base, SOLO_ACCOUNT_ID, 'traces', 'essai-manuel.jsonl', Buffer.from('x'))
    await base.update(deposits).set({ recordedAt: null })

    await remplirLesDatesDEnregistrement(base)

    const [ligne] = await base.select().from(deposits)
    expect(ligne!.recordedAt).toBe(ligne!.depositedAt)
  })

  it('ne perd rien et ne touche qu’une fois', async () => {
    // Le décompte avant et après doit montrer les mêmes dépôts et les mêmes
    // octets.
    await ecrireDepot(base, SOLO_ACCOUNT_ID, 'traces', TRANCHE, Buffer.from('douze octets'))
    await ecrireDepot(base, SOLO_ACCOUNT_ID, 'journal', TRANCHE, Buffer.from('x'))
    const avant = await base.select().from(deposits)

    await remplirLesDatesDEnregistrement(base)
    const apres = await base.select().from(deposits)

    expect(apres).toHaveLength(avant.length)
    expect(apres.map((l) => l.bytes)).toEqual(avant.map((l) => l.bytes))
    // Tout est déjà daté à l'écriture : le rattrapage n'a plus rien à faire.
    expect(await remplirLesDatesDEnregistrement(base)).toBe(0)
  })

  it('liste sur la date du trajet', async () => {
    await ecrireDepot(base, SOLO_ACCOUNT_ID, 'traces', TRANCHE, Buffer.from('x'))

    const [entree] = await listerDepots(base, SOLO_ACCOUNT_ID, 'traces')

    expect(new Date(entree!.mtime).getTime()).toBe(Date.UTC(2026, 8, 11, 6, 24, 1))
  })
})
