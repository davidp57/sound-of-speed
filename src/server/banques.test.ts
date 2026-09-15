/**
 * Une banque qui n'est pas à nous ne descend que chez qui y a droit.
 *
 * Deux choses se vérifient ici, et la seconde compte autant que la première :
 * le fichier est refusé, **et** la banque disparaît du listage. Cacher les octets
 * en laissant les noms ne cacherait rien.
 *
 * **Aucun nom de ce fichier ne désigne une vraie banque.** Ce qui est restreint
 * se déclare dans la configuration de la pile, jamais dans le dépôt.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { banquesAccordees, banquesRestreintes } from './banques'
import { ouvrirBase, type Base } from './base/base'
import { creerIdentite, type Identite } from './identite'
import { creerServeur } from './serveur'

const SECRET = 'Bq4nV8mT2xL6pW0kR3zC9hY5dJ7sF1gA-essai-banques'
/** Le dossier d'une banque qu'on n'a pas le droit de servir à tout le monde. */
const RESTREINTE = 'banque-a-part'
/** Une banque ordinaire, qui descend chez tout le monde. */
const ORDINAIRE = 'banque-ouverte'

let racine: string
let application: string
let base: Base
let fermer: () => void
let identite: Identite

beforeEach(async () => {
  racine = mkdtempSync(join(tmpdir(), 'banques-'))
  application = join(racine, 'dist')
  for (const banque of [RESTREINTE, ORDINAIRE]) {
    mkdirSync(join(application, 'audio', banque), { recursive: true })
    writeFileSync(join(application, 'audio', banque, 'on-750.flac'), 'des octets')
  }
  writeFileSync(join(application, 'index.html'), '<!DOCTYPE html><title>Conduite</title>')

  const ouverte = await ouvrirBase({
    fichier: join(racine, 'speed.db'),
    migrations: 'src/server/base/migrations',
  })
  base = ouverte.base
  fermer = ouverte.fermer
  identite = creerIdentite({ base, secret: SECRET, adresse: 'http://essai' })
})

afterEach(() => {
  fermer()
  try {
    rmSync(racine, { recursive: true, force: true })
  } catch {
    // Le ménage n'est pas ce qu'on vérifie.
  }
})

/** Un serveur, avec la déclaration que la pile lui donnerait. */
function serveur(restreintes?: string, accordees?: string) {
  return creerServeur({
    application,
    base,
    identite,
    banques: {
      restreintes: banquesRestreintes(restreintes),
      accordees: banquesAccordees(accordees),
    },
  })
}

/** Un appareil, avec l'adresse qu'il se rattache — ou aucune. */
async function appareil(adresse?: string): Promise<Record<string, string>> {
  const creation = await serveur().request('/api/auth/sign-in/anonymous', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  })
  const annonce = { Cookie: (creation.headers.get('set-cookie') ?? '').split(';')[0] ?? '' }

  if (adresse !== undefined) {
    const rattache = await serveur().request('/api/auth/compte/rattacher', {
      method: 'POST',
      headers: { ...annonce, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adresse, motDePasse: 'un mot de passe assez long' }),
    })
    expect(rattache.status, 'rattachement de l’adresse').toBe(200)
  }

  return annonce
}

async function listage(app: ReturnType<typeof serveur>, annonce: Record<string, string>) {
  const reponse = await app.request('/audio/', { headers: annonce })
  return ((await reponse.json()) as { name: string }[]).map((entree) => entree.name)
}

describe('une banque restreinte', () => {
  it('ne descend pas chez un compte qui n’y a pas droit, et n’apparaît nulle part', async () => {
    const app = serveur(RESTREINTE, 'ayant-droit@exemple.test=*')
    const quidam = await appareil()

    expect((await app.request(`/audio/${RESTREINTE}/on-750.flac`, { headers: quidam })).status).toBe(
      404,
    )
    expect((await app.request(`/audio/${RESTREINTE}/`, { headers: quidam })).status).toBe(404)
    expect(await listage(app, quidam)).toEqual([ORDINAIRE])
  })

  it('descend chez le compte nommé, et il la voit', async () => {
    const app = serveur(RESTREINTE, 'ayant-droit@exemple.test=*')
    const ayantDroit = await appareil('ayant-droit@exemple.test')

    expect(
      (await app.request(`/audio/${RESTREINTE}/on-750.flac`, { headers: ayantDroit })).status,
    ).toBe(200)
    expect(await listage(app, ayantDroit)).toEqual([ORDINAIRE, RESTREINTE].sort())
  })

  it('se nomme, plutôt que de tout ouvrir : une autre banque reste fermée', async () => {
    // L'étoile accorde toutes les restreintes ; nommer une banque n'accorde
    // qu'elle. Sans ça, accorder la première reviendrait à accorder la suivante.
    const app = serveur(`${RESTREINTE},${ORDINAIRE}`, `ayant-droit@exemple.test=${ORDINAIRE}`)
    const ayantDroit = await appareil('ayant-droit@exemple.test')

    expect(
      (await app.request(`/audio/${ORDINAIRE}/on-750.flac`, { headers: ayantDroit })).status,
    ).toBe(200)
    expect(
      (await app.request(`/audio/${RESTREINTE}/on-750.flac`, { headers: ayantDroit })).status,
    ).toBe(404)
  })

  it('reste fermée quand personne n’est nommé', async () => {
    const app = serveur(RESTREINTE, undefined)

    expect(
      (await app.request(`/audio/${RESTREINTE}/on-750.flac`, { headers: await appareil() })).status,
    ).toBe(404)
  })

  it('ne change rien quand rien n’est déclaré restreint', async () => {
    const app = serveur(undefined, undefined)
    const quidam = await appareil()

    expect((await app.request(`/audio/${RESTREINTE}/on-750.flac`, { headers: quidam })).status).toBe(
      200,
    )
    expect(await listage(app, quidam)).toEqual([ORDINAIRE, RESTREINTE].sort())
  })
})

describe('la déclaration lue dans l’environnement', () => {
  it('accepte les espaces, et ignore ce qui n’a pas de forme', () => {
    expect([...banquesRestreintes(' une , autre ,, ')]).toEqual(['une', 'autre'])
    expect(banquesRestreintes(undefined).size).toBe(0)

    const accordees = banquesAccordees(' Un@Exemple.test = une , autre ; sans-egal ; =rien ')
    expect([...(accordees.get('un@exemple.test') ?? [])]).toEqual(['une', 'autre'])
    expect(accordees.size).toBe(1)
  })

  it('ajoute plutôt que d’écraser quand une adresse revient', () => {
    // Une configuration recopiée en deux fois ne doit pas en perdre la moitié.
    const accordees = banquesAccordees('moi@exemple.test=une;moi@exemple.test=autre')

    expect([...(accordees.get('moi@exemple.test') ?? [])]).toEqual(['une', 'autre'])
  })
})
