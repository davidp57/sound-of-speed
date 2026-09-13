import { describe, expect, it } from 'vitest'

import { deleteTrip, downloadTrip, pinTrip, retentionVerdict } from './manage'


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
        auth: (init?.headers as Record<string, string> | undefined)?.['Authorization'],
      }
      return Response.json({ efface: 3 })
    }) as unknown as typeof fetch

    expect(await deleteTrip('2026-09-11-06-24-01_da2m', impl)).toBe(3)
    expect(vu.url).toBe('/sessions/2026-09-11-06-24-01_da2m')
    expect(vu.method).toBe('DELETE')
    // Rien à composer : le témoin de connexion voyage avec la requête.
    expect(vu.auth).toBeUndefined()
  })

  it('échappe la clé d’un dépôt seul, qui porte des deux-points', async () => {
    // Sans échappement, l'adresse reste valide et efface au mauvais endroit.
    let url = ''
    const impl = (async (adresse: string) => {
      url = String(adresse)
      return Response.json({ efface: 1 })
    }) as unknown as typeof fetch

    await deleteTrip('depot:traces:essai du samedi.jsonl', impl)

    expect(url).toBe('/sessions/depot%3Atraces%3Aessai%20du%20samedi.jsonl')
  })

  it('rend zéro sur un trajet déjà parti, et non une erreur', async () => {
    const impl = (async () => Response.json({ efface: 0 })) as unknown as typeof fetch
    expect(await deleteTrip('k', impl)).toBe(0)
  })

  it('rend null quand le serveur n’a pas répondu', async () => {
    // Rien n'a été effacé : l'écran doit le dire au lieu de retirer la ligne.
    const impl = (async () => {
      throw new Error('hors réseau')
    }) as unknown as typeof fetch

    expect(await deleteTrip('k', impl)).toBeNull()
  })

  it('demande l’effacement sans rien composer pour s’annoncer', async () => {
    // Le témoin de connexion voyage tout seul. Ce qui était « pas de compte
    // saisi, on ne demande rien » devient une requête ordinaire, que le serveur
    // refuse s'il ne reconnaît pas l'appareil.
    let entetes: Record<string, string> | undefined
    const impl = (async (_url: string, init?: RequestInit) => {
      entetes = init?.headers as Record<string, string> | undefined
      return Response.json({ efface: 1 })
    }) as unknown as typeof fetch

    expect(await deleteTrip('k', impl)).toBe(1)
    expect(entetes?.['Authorization']).toBeUndefined()
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

    const rendu = await downloadTrip('2026-09-11-06-24-01_da2m', impl)

    expect(url).toBe('/sessions/2026-09-11-06-24-01_da2m/archive.zip')
    expect(rendu?.filename).toBe('trajet-2026-09-11-06-24-01.zip')
    expect(await rendu?.blob.text()).toBe('PK')
  })

  it('se rabat sur un nom quelconque si le serveur n’en propose pas', async () => {
    const impl = (async () => new Response(new Blob(['PK']))) as unknown as typeof fetch

    expect((await downloadTrip('k', impl))?.filename).toBe('trajet.zip')
  })

  it('rend null quand le trajet n’est plus là', async () => {
    const impl = (async () => new Response('', { status: 404 })) as unknown as typeof fetch

    expect(await downloadTrip('k', impl)).toBeNull()
  })
})

describe('épingler un trajet', () => {
  it('pose l’épingle, et rend où l’on en est de la borne', async () => {
    let vu = { url: '', method: '' }
    const impl = (async (url: string, init?: RequestInit) => {
      vu = { url: String(url), method: init?.method ?? '' }
      return Response.json({ etat: 'épinglé', epinglees: 3, borne: 20 })
    }) as unknown as typeof fetch

    const rendu = await pinTrip('2026-09-11-06-24-01_da2m', true, impl)

    expect(vu).toEqual({ url: '/sessions/2026-09-11-06-24-01_da2m/epingle', method: 'PUT' })
    expect(rendu).toEqual({ etat: 'épinglé', epinglees: 3, borne: 20 })
  })

  it('décroche par la méthode inverse', async () => {
    let methode = ''
    const impl = (async (_url: string, init?: RequestInit) => {
      methode = init?.method ?? ''
      return Response.json({ etat: 'décroché', epinglees: 2, borne: 20 })
    }) as unknown as typeof fetch

    await pinTrip('k', false, impl)

    expect(methode).toBe('DELETE')
  })

  it('lit le refus de la borne, qui est une réponse et non une panne', async () => {
    const impl = (async () =>
      Response.json({ etat: 'borne atteinte', epinglees: 20, borne: 20 }, {
        status: 409,
      })) as unknown as typeof fetch

    const rendu = await pinTrip('k', true, impl)

    expect(rendu?.etat).toBe('borne atteinte')
    expect(rendu?.borne).toBe(20)
  })
})

describe('le verdict de la règle', () => {
  it('se lit sur le serveur, et n’est pas recalculé ici', async () => {
    // La règle qu'on relit doit être celle qui efface : deux calculs
    // divergeraient, et c'est l'autre qui emporterait les trajets.
    let url = ''
    const impl = (async (adresse: string) => {
      url = String(adresse)
      return Response.json({
        aEffacer: [],
        retenus: [{ cle: 'k', raison: 'archivé' }],
        octets: 0,
        delais: { traces: 30, journal: 14 },
      })
    }) as unknown as typeof fetch

    const verdict = await retentionVerdict(impl)

    expect(url).toBe('/retention')
    expect(verdict?.retenus[0]?.raison).toBe('archivé')
    expect(verdict?.delais).toEqual({ traces: 30, journal: 14 })
  })

  it('rend null devant un serveur qui ne connaît pas la règle', async () => {
    const impl = (async () => new Response('', { status: 404 })) as unknown as typeof fetch

    expect(await retentionVerdict(impl)).toBeNull()
  })
})
