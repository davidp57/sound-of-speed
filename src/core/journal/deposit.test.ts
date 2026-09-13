import { describe, expect, it } from 'vitest'

import { gunzip } from '../upload/compress'
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


function tranche() {
  const journal = new Journal({ sessionId: 'k7bq', startedAt: Date.parse('2026-09-04T14:32:11Z') })
  journal.add(0, 'source', { kind: 'geolocation' })
  journal.add(120, 'reject', { motif: 'imprécise' })
  return journal.takeSlice(1000)!
}

/** Un `fetch` de comptoir : retient l'appel et rend ce qu'on lui dit. */
function fakeFetch(reply: Response | Error) {
  // `init` est déclaré présent mais possiblement indéfini : le projet active
  // `exactOptionalPropertyTypes`, où une propriété optionnelle refuse `undefined`.
  const calls: { url: string; init: RequestInit | undefined }[] = []
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
    const outcome = await depositSlice(slice, impl)

    expect(outcome.ok).toBe(true)
    expect(calls[0]?.url).toBe(`/journal/${slice.name}.gz`)
    expect(calls[0]?.init?.method).toBe('PUT')
  })

  it('ne compose aucune authentification : le témoin voyage tout seul', async () => {
    // Il fallait s'annoncer soi-même tant que la porte était un mot de passe
    // partagé, le navigateur ne le faisant que sur une navigation. L'appareil a
    // maintenant son compte, et son témoin part avec la requête sans qu'on ait
    // rien à composer.
    const { impl, calls } = fakeFetch(ok())
    await depositSlice(tranche(), impl)

    const headers = calls[0]?.init?.headers as Record<string, string> | undefined
    expect(headers?.['Authorization']).toBeUndefined()
  })

  it('envoie le corps compressé, et il se relit à l’identique', async () => {
    // Compresser vaut d'abord pour la 4G : une tranche part d'une voiture en
    // mouvement, et ce qui compte est qu'elle tienne dans la fenêtre de réseau
    // qu'on a.
    const { impl, calls } = fakeFetch(ok())
    const slice = tranche()
    await depositSlice(slice, impl)

    const body = calls[0]?.init?.body
    expect(body).toBeInstanceOf(Blob)
    expect(await gunzip(body as Blob)).toBe(slice.body)
    expect((calls[0]?.init?.headers as Record<string, string>)['Content-Type']).toBe(
      'application/gzip',
    )
  })

  it('dépose en clair là où le navigateur ne sait pas compresser', async () => {
    const original = globalThis.CompressionStream
    // @ts-expect-error — on retire volontairement une capacité du navigateur.
    delete globalThis.CompressionStream
    try {
      const { impl, calls } = fakeFetch(ok())
      const slice = tranche()
      await depositSlice(slice, impl)

      expect(calls[0]?.url).toBe(`/journal/${slice.name}`)
      expect(calls[0]?.init?.body).toBe(slice.body)
    } finally {
      globalThis.CompressionStream = original
    }
  })

  it('ne demande pas au serveur si le fichier est déjà là', async () => {
    // Le nom est unique par construction — session plus rang, jamais réemployé —
    // et la question coûterait une requête toutes les cinq minutes.
    const { impl, calls } = fakeFetch(ok())
    await depositSlice(tranche(), impl)

    expect(calls).toHaveLength(1)
  })
})

describe('chaque échec dit s’il faut réessayer', () => {
  it('garde la tranche quand il n’y a pas de réseau', async () => {
    // Le cas qui arrive en roulant, et qui n'est pas une erreur.
    const { impl } = fakeFetch(new TypeError('Failed to fetch'))
    const outcome = await depositSlice(tranche(), impl)

    expect(outcome).toMatchObject({ ok: false, reason: 'network', retry: true })
  })

  it('garde la tranche sur une indisponibilité du serveur', async () => {
    const { impl } = fakeFetch(new Response('', { status: 503 }))
    const outcome = await depositSlice(tranche(), impl)

    expect(outcome).toMatchObject({ ok: false, reason: 'network', retry: true })
  })

  it('renonce quand le compte est refusé', async () => {
    // Réessayer avec le même compte donnerait le même refus : insister
    // remplirait le journal de tentatives au lieu d'événements.
    const { impl } = fakeFetch(new Response('', { status: 401 }))
    const outcome = await depositSlice(tranche(), impl)

    expect(outcome).toMatchObject({ ok: false, reason: 'refused', retry: false })
  })

  it('renonce quand la tranche est trop grosse pour le serveur', async () => {
    // Réessayer à l'identique échouerait autant. C'est au plafond de tranche
    // d'éviter ce cas, pas au dépôt de s'entêter.
    const { impl } = fakeFetch(new Response('', { status: 413 }))
    const outcome = await depositSlice(tranche(), impl)

    expect(outcome).toMatchObject({ ok: false, reason: 'network', retry: false })
  })

  it('envoie la tranche sans rien attendre d’un réglage', async () => {
    // Le cas « aucun compte saisi » a disparu avec le mot de passe partagé : la
    // tranche part, et c'est le serveur qui dira s'il reconnaît cet appareil.
    const { impl, calls } = fakeFetch(ok())
    const outcome = await depositSlice(tranche(), impl)

    expect(outcome).toMatchObject({ ok: true })
    expect(calls).toHaveLength(1)
  })
})
