/**
 * Ce que le serveur dit de la place, et quand il refuse.
 *
 * **Ce qui est mesuré est l'après.** Dire « libre » en écrivant la tranche qui
 * fait passer le seuil ferait attendre cinq minutes de plus pour une information
 * qu'on avait déjà.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ouvrirBase, type Base } from './base/base'
import { creerIdentite, type Identite } from './identite'
import { PLAFOND_PAR_DEFAUT, plafondDeLEnvironnement } from './plafond'
import { creerServeur } from './serveur'

const SECRET = 'Pl4fOnD7yU1iO5pA9sD2fG6hJ0kL4zX8cV-essai-place'

let racine: string
let application: string
let base: Base
let fermer: () => void
let identite: Identite
let annonce: Record<string, string>

/** Un serveur au plafond qu'on lui donne, en octets. */
function serveur(plafond?: number) {
  return creerServeur({
    application,
    base,
    identite,
    ...(plafond === undefined ? {} : { plafond }),
  })
}

/** Dépose des octets, et rend la réponse telle quelle. */
async function deposer(nom: string, taille: number, plafond?: number): Promise<Response> {
  return serveur(plafond).request(`/mesures/${nom}`, {
    method: 'PUT',
    headers: { ...annonce, 'Content-Type': 'application/json' },
    body: 'x'.repeat(taille),
  })
}

/**
 * Dépose une tranche dont le nom fait un trajet.
 *
 * C'est la clé de session que la rotation manipule : un dépôt au nom libre est
 * un « dépôt seul », et il ne se range pas de la même façon.
 */
async function deposerUnTrajet(session: string, taille: number, plafond?: number): Promise<Response> {
  return serveur(plafond).request(`/traces/${session}_001.jsonl`, {
    method: 'PUT',
    headers: { ...annonce, 'Content-Type': 'application/json' },
    body: 'x'.repeat(taille),
  })
}

/** Ce que la réponse dit de la place. */
function place(reponse: Response) {
  return {
    etat: reponse.headers.get('Speed-Place'),
    octets: Number(reponse.headers.get('Speed-Place-Octets')),
    plafond: Number(reponse.headers.get('Speed-Place-Plafond')),
  }
}

beforeEach(async () => {
  racine = mkdtempSync(join(tmpdir(), 'place-'))
  application = join(racine, 'dist')
  mkdirSync(application, { recursive: true })
  writeFileSync(join(application, 'index.html'), '<!DOCTYPE html><title>Conduite</title>')

  const ouverte = await ouvrirBase({
    fichier: join(racine, 'speed.db'),
    migrations: 'src/server/base/migrations',
  })
  base = ouverte.base
  fermer = ouverte.fermer
  identite = creerIdentite({ base, secret: SECRET, adresse: 'http://essai' })

  const creation = await serveur().request('/api/auth/sign-in/anonymous', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  })
  annonce = { Cookie: (creation.headers.get('set-cookie') ?? '').split(';')[0] ?? '' }
})

afterEach(() => {
  fermer()
  try {
    rmSync(racine, { recursive: true, force: true })
  } catch {
    // Le ménage n'est pas ce qu'on vérifie.
  }
})

describe('ce que le dépôt dit de la place', () => {
  it('annonce « libre » et les deux chiffres tant qu’on est loin du plafond', async () => {
    const reponse = await deposer('un.json', 100, 1000)

    expect(reponse.status).toBe(201)
    expect(place(reponse)).toEqual({ etat: 'libre', octets: 100, plafond: 1000 })
  })

  it('annonce « bientot » dès les trois quarts, sur ce dépôt-là et pas le suivant', async () => {
    // 740 sur 1000 : encore libre. C'est le dépôt qui franchit le seuil qui le
    // dit, et non celui d'après — sinon on attendrait cinq minutes de plus.
    expect(place(await deposer('un.json', 740, 1000)).etat).toBe('libre')
    expect(place(await deposer('deux.json', 20, 1000)).etat).toBe('bientot')
  })

  it('compte ce que le dépôt remplace comme la place qu’il rend', async () => {
    await deposer('rejeu.json', 400, 1000)
    // La voiture rejoue son envoi : le compte ne grossit pas, et l'état non plus.
    const rejeu = await deposer('rejeu.json', 400, 1000)

    expect(place(rejeu)).toEqual({ etat: 'libre', octets: 400, plafond: 1000 })
  })

  it('accepte au-delà du plafond, puis fait la place', async () => {
    // Deux trajets anciens, et un dépôt qui fait déborder : la voiture ne perd
    // pas ce qu'elle vient d'enregistrer, c'est le passé qui s'efface.
    expect((await deposerUnTrajet('2026-08-01-06-00-00_aaa', 400, 1000)).status).toBe(201)
    expect((await deposerUnTrajet('2026-08-02-06-00-00_bbb', 400, 1000)).status).toBe(201)

    const depassement = await deposerUnTrajet('2026-09-14-06-00-00_ccc', 300, 1000)

    expect(depassement.status).toBe(201)
    // L'état dit que la rotation est armée ; les octets sont ceux d'après.
    expect(place(depassement).etat).toBe('rotation')
    expect(place(depassement).octets).toBeLessThanOrEqual(900)

    // Le plus ancien est parti, le plus récent est là.
    const restants = (await (
      await serveur(1000).request('/sessions/', { headers: annonce })
    ).json()) as { cle: string }[]
    expect(restants.map((session) => session.cle)).toContain('2026-09-14-06-00-00_ccc')
    expect(restants.map((session) => session.cle)).not.toContain('2026-08-01-06-00-00_aaa')
  })

  it('refuse en 507 quand tout est épinglé, et le dit', async () => {
    expect((await deposerUnTrajet('2026-08-01-06-00-00_aaa', 900, 1000)).status).toBe(201)
    const epingle = await serveur(1000).request('/sessions/2026-08-01-06-00-00_aaa/epingle', {
      method: 'PUT',
      headers: annonce,
    })
    expect(epingle.status).toBe(200)

    const refus = await deposerUnTrajet('2026-09-14-06-00-00_ccc', 300, 1000)

    expect(refus.status).toBe(507)
    expect(await refus.text()).toContain('épinglé')
    // Rien de déjà déposé n'a bougé : la rotation n'efface pas une épingle.
    const restants = (await (
      await serveur(1000).request('/sessions/', { headers: annonce })
    ).json()) as { cle: string }[]
    expect(restants.map((session) => session.cle)).toContain('2026-08-01-06-00-00_aaa')
  })

  it('suit le plafond particulier d’un compte plutôt que le commun', async () => {
    // Le plafond commun est large ; celui du compte est étroit, et c'est lui
    // que la réponse annonce.
    const reponse = await deposer('un.json', 100, 1_000_000)

    expect(place(reponse).plafond).toBe(1_000_000)
  })

  it('ne pose rien sur une lecture : ce sont les dépôts qui informent', async () => {
    await deposer('un.json', 100, 1000)
    const lecture = await serveur(1000).request('/mesures/un.json', { headers: annonce })

    expect(lecture.status).toBe(200)
    expect(lecture.headers.get('Speed-Place')).toBeNull()
  })
})

describe('le plafond lu dans l’environnement', () => {
  it('vaut 250 Mio par défaut, absent, vide ou illisible', () => {
    expect(plafondDeLEnvironnement(undefined)).toBe(PLAFOND_PAR_DEFAUT)
    expect(plafondDeLEnvironnement('')).toBe(PLAFOND_PAR_DEFAUT)
    expect(plafondDeLEnvironnement('beaucoup')).toBe(PLAFOND_PAR_DEFAUT)
    // Zéro refuserait tout dépôt dès le premier : mieux vaut l'ignorer.
    expect(plafondDeLEnvironnement('0')).toBe(PLAFOND_PAR_DEFAUT)
    expect(PLAFOND_PAR_DEFAUT).toBe(250 * 1024 * 1024)
  })

  it('se lit en mébioctets', () => {
    expect(plafondDeLEnvironnement('500')).toBe(500 * 1024 * 1024)
    expect(plafondDeLEnvironnement(' 1.5 ')).toBe(Math.round(1.5 * 1024 * 1024))
  })
})
