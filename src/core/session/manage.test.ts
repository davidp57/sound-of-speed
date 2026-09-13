import { describe, expect, it } from 'vitest'

import { deleteTrip, downloadTrip } from './manage'

const CREDENTIALS = { user: 'depot', password: 'motdepasse' }

describe('effacer un trajet', () => {
  it('demande l’effacement du trajet désigné, en s’annonçant', async () => {
    let vu: { url: string; method: string | undefined; auth: string | undefined } = {
      url: '',
      method: undefined,
      auth: undefined,
    }
    const impl = (async (url: string, init?: RequestInit) => {
      vu = {
        url: String(url),
        method: init?.method,
        auth: (init?.headers as Record<string, string>)['Authorization'],
      }
      return Response.json({ efface: 3 })
    }) as unknown as typeof fetch

    expect(await deleteTrip('2026-09-11-06-24-01_da2m', CREDENTIALS, impl)).toBe(3)
    expect(vu.url).toBe('/sessions/2026-09-11-06-24-01_da2m')
    expect(vu.method).toBe('DELETE')
    expect(vu.auth).toBe(`Basic ${btoa('depot:motdepasse')}`)
  })

  it('échappe la clé d’un dépôt seul, qui porte des deux-points', async () => {
    // Sans échappement, l'adresse reste valide et efface au mauvais endroit.
    let url = ''
    const impl = (async (adresse: string) => {
      url = String(adresse)
      return Response.json({ efface: 1 })
    }) as unknown as typeof fetch

    await deleteTrip('depot:traces:essai du samedi.jsonl', CREDENTIALS, impl)

    expect(url).toBe('/sessions/depot%3Atraces%3Aessai%20du%20samedi.jsonl')
  })

  it('rend zéro sur un trajet déjà parti, et non une erreur', async () => {
    const impl = (async () => Response.json({ efface: 0 })) as unknown as typeof fetch
    expect(await deleteTrip('k', CREDENTIALS, impl)).toBe(0)
  })

  it('rend null quand le serveur n’a pas répondu', async () => {
    // Rien n'a été effacé : l'écran doit le dire au lieu de retirer la ligne.
    const impl = (async () => {
      throw new Error('hors réseau')
    }) as unknown as typeof fetch

    expect(await deleteTrip('k', CREDENTIALS, impl)).toBeNull()
  })

  it('ne demande rien sans compte', async () => {
    let appele = false
    const impl = (async () => {
      appele = true
      return Response.json({})
    }) as unknown as typeof fetch

    expect(await deleteTrip('k', { user: '', password: '' }, impl)).toBeNull()
    expect(appele).toBe(false)
  })
})

describe('emporter un trajet', () => {
  it('demande l’archive et rend le nom que le serveur propose', async () => {
    // Le recomposer ici donnerait deux façons de nommer la même chose, et elles
    // finiraient par ne plus dire la même date.
    let url = ''
    const impl = (async (adresse: string) => {
      url = String(adresse)
      return new Response(new Blob(['PK']), {
        headers: { 'Content-Disposition': 'attachment; filename="trajet-2026-09-11-06-24-01.zip"' },
      })
    }) as unknown as typeof fetch

    const rendu = await downloadTrip('2026-09-11-06-24-01_da2m', CREDENTIALS, impl)

    expect(url).toBe('/sessions/2026-09-11-06-24-01_da2m/archive.zip')
    expect(rendu?.filename).toBe('trajet-2026-09-11-06-24-01.zip')
    expect(await rendu?.blob.text()).toBe('PK')
  })

  it('se rabat sur un nom quelconque si le serveur n’en propose pas', async () => {
    const impl = (async () => new Response(new Blob(['PK']))) as unknown as typeof fetch

    expect((await downloadTrip('k', CREDENTIALS, impl))?.filename).toBe('trajet.zip')
  })

  it('rend null quand le trajet n’est plus là', async () => {
    const impl = (async () => new Response('', { status: 404 })) as unknown as typeof fetch

    expect(await downloadTrip('k', CREDENTIALS, impl)).toBeNull()
  })
})
