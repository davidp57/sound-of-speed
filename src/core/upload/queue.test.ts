import { describe, expect, it } from 'vitest'

import { DEFAULT_LIMITS, UploadQueue, type QueuedUpload } from './queue'
import type { PutOutcome } from './put'

/**
 * Tests de la file de dépôt.
 *
 * Ce qui se vérifie : ce qui est parti quitte la file, ce qui a échoué pour
 * cause de réseau y reste, un refus n'y boucle pas, et la borne sacrifie le plus
 * ancien plutôt que d'enfler jusqu'au quota.
 */

function item(id: string, extra: Partial<QueuedUpload> = {}): QueuedUpload {
  return {
    id,
    kind: 'trace',
    folder: '/traces/',
    name: `${id}.json`,
    body: '{}',
    queuedAt: 0,
    ...extra,
  }
}

const SENT: PutOutcome = { ok: true, bytes: 2 }
const OFFLINE: PutOutcome = {
  ok: false,
  reason: 'network',
  detail: 'Dépôt impossible : le serveur est injoignable.',
  retry: true,
}
const REFUSED: PutOutcome = {
  ok: false,
  reason: 'refused',
  detail: 'Refusé : le nom ou le mot de passe ne correspond pas.',
  retry: false,
}

describe('la file de dépôt', () => {
  it('envoie dans l’ordre et vide ce qui est parti', async () => {
    const queue = new UploadQueue()
    queue.add(item('a'))
    queue.add(item('b'))

    const seen: string[] = []
    const sent = await queue.flush(0, (entry) => {
      seen.push(entry.id)
      return Promise.resolve(SENT)
    })

    expect(sent).toBe(2)
    expect(seen).toEqual(['a', 'b'])
    expect(queue.size).toBe(0)
  })

  it('garde ce qui n’est pas parti faute de réseau, et s’arrête là', async () => {
    const queue = new UploadQueue()
    queue.add(item('a'))
    queue.add(item('b'))

    let calls = 0
    const sent = await queue.flush(0, () => {
      calls += 1
      return Promise.resolve(OFFLINE)
    })

    expect(sent).toBe(0)
    // Le second n'est pas tenté : il échouerait de la même façon, et chaque
    // tentative coûte le temps d'une requête.
    expect(calls).toBe(1)
    expect(queue.size).toBe(2)
    expect(queue.lastError).toContain('injoignable')
  })

  it('attend avant de réessayer, puis laisse repartir', async () => {
    const queue = new UploadQueue()
    queue.add(item('a'))

    await queue.flush(0, () => Promise.resolve(OFFLINE))
    expect(queue.ready(DEFAULT_LIMITS.retryMs - 1)).toBe(false)
    expect(queue.ready(DEFAULT_LIMITS.retryMs)).toBe(true)
  })

  it('espace davantage à chaque échec', async () => {
    const queue = new UploadQueue()
    queue.add(item('a'))

    await queue.flush(0, () => Promise.resolve(OFFLINE))
    await queue.flush(DEFAULT_LIMITS.retryMs, () => Promise.resolve(OFFLINE))

    const second = DEFAULT_LIMITS.retryMs + DEFAULT_LIMITS.retryMs * 2
    expect(queue.ready(second - 1)).toBe(false)
    expect(queue.ready(second)).toBe(true)
  })

  it('ne boucle pas sur un refus', async () => {
    const queue = new UploadQueue()
    queue.add(item('a'))

    await queue.flush(0, () => Promise.resolve(REFUSED))

    expect(queue.size).toBe(1)
    expect(queue.ready(DEFAULT_LIMITS.retryMs)).toBe(false)
    expect(queue.ready(DEFAULT_LIMITS.maxRetryMs)).toBe(true)
  })

  it('repart tout de suite quand on le demande', async () => {
    const queue = new UploadQueue()
    queue.add(item('a'))
    await queue.flush(0, () => Promise.resolve(REFUSED))

    queue.retryNow()

    expect(queue.ready(0)).toBe(true)
  })

  it('remplace un dépôt de même identifiant sans changer son rang', () => {
    const queue = new UploadQueue()
    queue.add(item('profil-1', { kind: 'profile', body: 'avant' }))
    queue.add(item('b'))
    expect(queue.add(item('profil-1', { kind: 'profile', body: 'après' }))).toBe('duplicate')

    expect(queue.size).toBe(2)
    expect(queue.list()[0]?.body).toBe('après')
  })

  it('abandonne le plus ancien quand la file déborde, et le dit', () => {
    const queue = new UploadQueue({ ...DEFAULT_LIMITS, maxItems: 2 })
    queue.add(item('a'))
    queue.add(item('b'))
    queue.add(item('c'))

    expect(queue.list().map((entry) => entry.id)).toEqual(['b', 'c'])
    expect(queue.evicted).toBe(1)
    expect(queue.lastError).toContain('faute de place')
  })

  it('garde le dernier dépôt même s’il dépasse la borne de poids à lui seul', () => {
    const queue = new UploadQueue({ ...DEFAULT_LIMITS, maxBytes: 10 })
    queue.add(item('gros', { body: 'x'.repeat(100) }))

    // Le sacrifier n'aurait servi à rien : la file serait vide et la trace
    // perdue, alors que le serveur, lui, accepte des corps bien plus gros.
    expect(queue.size).toBe(1)
  })

  it('ne réessaie pas quand rien n’attend', async () => {
    const queue = new UploadQueue()
    expect(queue.ready(0)).toBe(false)
    expect(await queue.flush(0, () => Promise.resolve(SENT))).toBe(0)
  })
})
