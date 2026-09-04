import { describe, expect, it } from 'vitest'

import { depositSlice } from './deposit'
import { Journal } from './journal'

/**
 * Tests du dépôt d'une tranche.
 *
 * Ce qui se vérifie : la tranche part au bon endroit, avec la bonne
 * authentification, et **chaque échec dit s'il vaut la peine de réessayer**.
 * C'est ce dernier point qui décide si un journal survit à un tunnel ou s'il
 * est perdu.
 */

const CREDENTIALS = { user: 'depot', password: 'motdepasse' }

function tranche() {
  const journal = new Journal({ sessionId: 'k7bq', startedAt: Date.parse('2026-09-04T14:32:11Z') })
  journal.add(0, 'source', { kind: 'geolocation' })
  journal.add(120, 'reject', { motif: 'imprécise' })
  return journal.takeSlice(1000)!
}

/** Un `fetch` de comptoir : retient l'appel et rend ce qu'on lui dit. */
function fakeFetch(reply: Response | Error) {
  const calls: { url: string; init?: RequestInit }[] = []
  const impl = ((url: string, init?: RequestInit) => {
    calls.push({ url, init })
    return reply instanceof Error ? Promise.reject(reply) : Promise.resolve(reply)
  }) as unknown as typeof fetch
  return { impl, calls }
}

function ok(): Response {
  return new Response('', { status: 201 })
}

describe('le dépôt d’une tranche', () => {
  it('la met dans le dossier du journal, et non celui des traces', async () => {
    // Le dossier des traces est servi en index JSON, et l'application le
    // télécharge pour lister les traces : une tranche toutes les cinq minutes y
    // alourdirait cette liste à chaque sortie.
    const { impl, calls } = fakeFetch(ok())
    const slice = tranche()
    const outcome = await depositSlice(slice, CREDENTIALS, impl)

    expect(outcome.ok).toBe(true)
    expect(calls[0]?.url).toBe(`/journal/${slice.name}`)
    expect(calls[0]?.init?.method).toBe('PUT')
  })

  it('s’annonce elle-même, le navigateur ne le faisant pas', async () => {
    // Le navigateur ne demande l'authentification que sur une navigation, jamais
    // sur une requête lancée par une page : sans cet en-tête, le dépôt reçoit un
    // refus sans que rien ne s'affiche.
    const { impl, calls } = fakeFetch(ok())
    await depositSlice(tranche(), CREDENTIALS, impl)

    const headers = calls[0]?.init?.headers as Record<string, string>
    expect(headers.Authorization).toBe(`Basic ${btoa('depot:motdepasse')}`)
  })

  it('envoie le corps tel quel, une ligne par événement', async () => {
    const { impl, calls } = fakeFetch(ok())
    const slice = tranche()
    await depositSlice(slice, CREDENTIALS, impl)

    expect(calls[0]?.init?.body).toBe(slice.body)
    expect(String(calls[0]?.init?.body).trimEnd().split('\n')).toHaveLength(2)
  })

  it('ne demande pas au serveur si le fichier est déjà là', async () => {
    // Le nom est unique par construction — session plus rang, jamais réemployé —
    // et la question coûterait une requête toutes les cinq minutes.
    const { impl, calls } = fakeFetch(ok())
    await depositSlice(tranche(), CREDENTIALS, impl)

    expect(calls).toHaveLength(1)
  })
})

describe('chaque échec dit s’il faut réessayer', () => {
  it('garde la tranche quand il n’y a pas de réseau', async () => {
    // Le cas qui arrive en roulant, et qui n'est pas une erreur.
    const { impl } = fakeFetch(new TypeError('Failed to fetch'))
    const outcome = await depositSlice(tranche(), CREDENTIALS, impl)

    expect(outcome).toMatchObject({ ok: false, reason: 'network', retry: true })
  })

  it('garde la tranche sur une indisponibilité du serveur', async () => {
    const { impl } = fakeFetch(new Response('', { status: 503 }))
    const outcome = await depositSlice(tranche(), CREDENTIALS, impl)

    expect(outcome).toMatchObject({ ok: false, reason: 'network', retry: true })
  })

  it('renonce quand le compte est refusé', async () => {
    // Réessayer avec le même compte donnerait le même refus : insister
    // remplirait le journal de tentatives au lieu d'événements.
    const { impl } = fakeFetch(new Response('', { status: 401 }))
    const outcome = await depositSlice(tranche(), CREDENTIALS, impl)

    expect(outcome).toMatchObject({ ok: false, reason: 'refused', retry: false })
  })

  it('renonce quand la tranche est trop grosse pour le serveur', async () => {
    // Réessayer à l'identique échouerait autant. C'est au plafond de tranche
    // d'éviter ce cas, pas au dépôt de s'entêter.
    const { impl } = fakeFetch(new Response('', { status: 413 }))
    const outcome = await depositSlice(tranche(), CREDENTIALS, impl)

    expect(outcome).toMatchObject({ ok: false, reason: 'network', retry: false })
  })

  it('garde la tranche quand aucun compte n’est réglé', async () => {
    // Le journal d'un trajet ne doit pas être perdu par le seul fait qu'on a
    // oublié de saisir un compte : la tranche attend qu'il le soit.
    const { impl, calls } = fakeFetch(ok())
    const outcome = await depositSlice(tranche(), { user: '  ', password: '' }, impl)

    expect(outcome).toMatchObject({ ok: false, reason: 'no-credentials', retry: true })
    expect(calls).toHaveLength(0)
  })
})
