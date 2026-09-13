import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ouvrirBase, type Base } from './base/base'
import { ANCIEN_COMPTE_UNIQUE as COMPTE, semerLAncienCompte } from './heritage'
import { ecrireDepot, lireDepot, listerDepots } from './depots'
import { ecrireProfil, lireProfil, listerProfils } from './profils'
import { formaterDecompte, reprendreLesDossiers } from './reprise'

const MIGRATIONS = 'src/server/base/migrations'

let travail: string
let ancien: string
let base: Base
let fermer: () => void

beforeEach(async () => {
  travail = mkdtempSync(join(tmpdir(), 'reprise-'))
  ancien = join(travail, 'ancien')
  for (const dossier of ['traces', 'journal', 'mesures', 'profiles', 'mesure-voiture']) {
    mkdirSync(join(ancien, dossier), { recursive: true })
  }

  const ouverte = await ouvrirBase({ fichier: join(travail, 'speed.db'), migrations: MIGRATIONS })
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
    rmSync(travail, { recursive: true, force: true })
  } catch {
    // Le ménage n'est pas ce qu'on vérifie.
  }
})

function deposer(dossier: string, nom: string, contenu: Buffer | string): void {
  writeFileSync(join(ancien, dossier, nom), contenu)
}

describe('la reprise des anciens dossiers', () => {
  it('verse les quatre dossiers en base', async () => {
    deposer('traces', 'sortie.jsonl.gz', Buffer.from(gzipSync(Buffer.from('{"t":0}\n'))))
    deposer('journal', 'bord_001.jsonl.gz', Buffer.from(gzipSync(Buffer.from('{"m":"go"}\n'))))
    deposer('mesures', 'releve.json', '{"v":1}')
    deposer('profiles', 'route.json', '{"name":"route"}')

    const reprises = await reprendreLesDossiers(base, COMPTE, ancien)

    expect(reprises.map((r) => [r.dossier, r.entres])).toEqual([
      ['traces', 1],
      ['journal', 1],
      ['mesures', 1],
      ['profiles', 1],
      ['mesure-voiture', 0],
    ])
    expect(nomsDe(await listerDepots(base, COMPTE, 'traces'))).toEqual([
      'sortie.jsonl.gz',
    ])
    expect(nomsDe(await listerProfils(base, COMPTE))).toEqual(['route.json'])
  })

  it('rend les octets **à l’identique**, compression comprise', async () => {
    // Une trace qui redescend altérée ne se décompresse plus, et le relecteur
    // n'en fait rien — sans que rien n'ait signalé quoi que ce soit en chemin.
    const octets = Buffer.from(gzipSync(Buffer.from('{"t":0}\n{"t":1}\n')))
    deposer('traces', 'sortie.jsonl.gz', octets)

    await reprendreLesDossiers(base, COMPTE, ancien)

    expect(await lireDepot(base, COMPTE, 'traces', 'sortie.jsonl.gz')).toEqual(octets)
  })

  it('archive ce qu’elle reprend, sinon la rétention l’effacerait un mois plus tard', async () => {
    deposer('traces', 'sortie.jsonl.gz', 'brut')
    deposer('journal', 'bord_001.jsonl', 'brut')

    await reprendreLesDossiers(base, COMPTE, ancien)

    const lignes = await base.query.deposits.findMany()
    // Archivé et non épinglé : l'épingle est un choix, et elle est bornée.
    expect(lignes.map((ligne) => ligne.exemption)).toEqual(['archive', 'archive'])
  })

  it('ne change rien au second passage', async () => {
    deposer('traces', 'sortie.jsonl.gz', 'brut')
    deposer('profiles', 'route.json', '{"name":"route"}')

    await reprendreLesDossiers(base, COMPTE, ancien)
    const second = await reprendreLesDossiers(base, COMPTE, ancien)

    expect(second.map((r) => r.entres)).toEqual([0, 0, 0, 0, 0])
    // Identiques, donc comptés et tus : un décompte qui nommerait les
    // quatre-vingt-quatorze fichiers d'un second passage noierait la seule
    // ligne qui compte.
    expect(second[0]?.identiques).toBe(1)
    expect(second[0]?.differents).toEqual([])
    expect(await listerDepots(base, COMPTE, 'traces')).toHaveLength(1)
    expect(await listerProfils(base, COMPTE)).toHaveLength(1)
  })

  it('n’écrase pas un profil que la voiture a réglé depuis', async () => {
    // C'est la vraie raison de la règle : le disque porte une version d'avant,
    // et la base celle qu'on vient de mettre au point en roulant.
    await ecrireProfil(base, COMPTE, 'route.json', '{"name":"route","gain":9}')
    deposer('profiles', 'route.json', '{"name":"route","gain":1}')

    const reprises = await reprendreLesDossiers(base, COMPTE, ancien)

    expect(await lireProfil(base, COMPTE, 'route.json')).toContain('"gain":9')
    expect(reprises.find((r) => r.dossier === 'profiles')?.differents).toEqual(['route.json'])
  })

  it('n’écrase pas une trace que le serveur porte déjà', async () => {
    await ecrireDepot(base, COMPTE, 'traces', 'sortie.jsonl.gz', Buffer.from('neuf'))
    deposer('traces', 'sortie.jsonl.gz', 'ancien')

    await reprendreLesDossiers(base, COMPTE, ancien)

    expect(await lireDepot(base, COMPTE, 'traces', 'sortie.jsonl.gz')).toEqual(
      Buffer.from('neuf'),
    )
  })

  it('laisse le profil mesuré là où il est, puisqu’il se recalcule', async () => {
    deposer('mesure-voiture', 'profil-voiture.json', '{"aggregate":{}}')

    const reprises = await reprendreLesDossiers(base, COMPTE, ancien)

    const recalcule = reprises.find((r) => r.dossier === 'mesure-voiture')
    expect(recalcule?.trouves).toBe(1)
    expect(recalcule?.entres).toBe(0)
    expect(recalcule?.ecartes[0]?.raison).toContain('recalcule')
  })

  it('écarte un profil illisible sans emporter les autres', async () => {
    deposer('profiles', 'casse.json', 'ceci n’est pas du JSON')
    deposer('profiles', 'route.json', '{"name":"route"}')

    const reprises = await reprendreLesDossiers(base, COMPTE, ancien)

    const profils = reprises.find((r) => r.dossier === 'profiles')
    expect(profils?.entres).toBe(1)
    expect(profils?.ecartes).toEqual([{ nom: 'casse.json', raison: 'illisible' }])
  })

  it('ne touche pas aux fichiers de la source', async () => {
    deposer('traces', 'sortie.jsonl.gz', 'brut')
    deposer('profiles', 'route.json', '{"name":"route"}')

    await reprendreLesDossiers(base, COMPTE, ancien)

    // Le montage en lecture seule est la vraie garantie ; ceci vérifie qu'on ne
    // s'appuie pas dessus pour un ménage qu'on ferait quand même.
    expect(fichiersRestants('traces')).toEqual(['sortie.jsonl.gz'])
    expect(fichiersRestants('profiles')).toEqual(['route.json'])
  })

  it('accepte une racine qui n’a pas tous ses dossiers', async () => {
    const nu = join(travail, 'nu')
    mkdirSync(join(nu, 'traces'), { recursive: true })
    writeFileSync(join(nu, 'traces', 'sortie.jsonl.gz'), 'brut')

    const reprises = await reprendreLesDossiers(base, COMPTE, nu)

    expect(reprises.map((r) => r.trouves)).toEqual([1, 0, 0, 0, 0])
  })
})

describe('le décompte imprimé', () => {
  it('nomme ce qu’il a laissé de côté', async () => {
    await ecrireProfil(base, COMPTE, 'route.json', '{"name":"route","gain":9}')
    await ecrireProfil(base, COMPTE, 'v8.json', '{"name":"v8"}')
    deposer('traces', 'sortie.jsonl.gz', 'brut')
    deposer('profiles', 'route.json', '{"name":"route","gain":1}')
    deposer('profiles', 'v8.json', '{"name":"v8"}')

    const texte = formaterDecompte(ancien, await reprendreLesDossiers(base, COMPTE, ancien))

    expect(texte).toContain('traces : 1 trouvé(s), 1 entré(s)')
    // Celui qui est identique se compte ; celui qui diffère se nomme. C'est
    // toute la différence entre un décompte qu'on lit et un décompte qu'on
    // survole.
    expect(texte).toContain('1 déjà en base, identique(s)')
    expect(texte).toContain('en base avec un autre contenu, laissé tel quel : route.json')
    expect(texte).not.toContain('laissé tel quel : v8.json')
  })
})

function fichiersRestants(dossier: string): string[] {
  return readdirSync(join(ancien, dossier))
}

/** Les noms d'un listage : la date, elle, est vérifiée à part. */
function nomsDe(entrees: readonly { name: string; type: string }[]): string[] {
  return entrees.map((entree) => entree.name)
}
