import { describe, expect, it } from 'vitest'

import { fetchBanks, missingFiles, usedBanks } from './banks'

/**
 * Tests de la découverte des banques.
 *
 * Ce qui se vérifie : un serveur qui ne sait pas lister, ou pas de dossier du
 * tout, ne sont pas des pannes. L'application retombe alors sur le nom que le
 * profil déclare, comme avant ce lot — donc une liste vide doit sortir sans
 * bruit.
 */

/** Un `fetch` de comptoir : répond selon le chemin, retient les appels. */
function reseau(dossiers: Record<string, string>) {
  const appels: string[] = []
  const impl = ((url: string) => {
    appels.push(url)
    const corps = dossiers[url]
    if (corps === undefined) return Promise.resolve(new Response('', { status: 404 }))
    return Promise.resolve(new Response(corps, { status: 200 }))
  }) as unknown as typeof fetch
  return { impl, appels }
}

/** Le listage JSON que produit nginx. */
function listage(entrees: { name: string; type: 'file' | 'directory' }[]) {
  return JSON.stringify(entrees)
}

describe('la découverte des banques', () => {
  it('rend les dossiers de /audio/ et ce qu’ils contiennent', async () => {
    const { impl } = reseau({
      '/audio/': listage([
        { name: 'procar', type: 'directory' },
        { name: 'v8-crossplane', type: 'directory' },
      ]),
      '/audio/procar/': listage([
        { name: 'procar-on-low.wav', type: 'file' },
        { name: 'procar-on-high.wav', type: 'file' },
      ]),
      '/audio/v8-crossplane/': listage([{ name: 'v8-on-low.flac', type: 'file' }]),
    })

    const banques = await fetchBanks(impl)

    expect(banques.map((banque) => banque.name)).toEqual(['procar', 'v8-crossplane'])
    // Triés : la liste s'affiche, et un ordre qui bouge d'un chargement à
    // l'autre se lit mal.
    expect(banques[0]?.files).toEqual(['procar-on-high.wav', 'procar-on-low.wav'])
    expect(banques[1]?.files).toEqual(['v8-on-low.flac'])
  })

  it('rend une liste vide quand /audio/ ne se liste pas', async () => {
    // 403 est ce que rend nginx sur un dossier sans listage : c'est l'état du
    // serveur avant ce lot, et celui du serveur de développement.
    const impl = (() => Promise.resolve(new Response('', { status: 403 }))) as unknown as typeof fetch

    expect(await fetchBanks(impl)).toEqual([])
  })

  it('rend une liste vide quand le dossier est absent', async () => {
    const { impl } = reseau({})

    expect(await fetchBanks(impl)).toEqual([])
  })

  it('rend une liste vide quand le listage est illisible', async () => {
    const { impl } = reseau({ '/audio/': 'ce n’est pas du JSON' })

    expect(await fetchBanks(impl)).toEqual([])
  })

  it('ignore les fichiers déposés à la racine : une banque est un dossier', async () => {
    const { impl } = reseau({
      '/audio/': listage([
        { name: 'note.txt', type: 'file' },
        { name: 'egare.wav', type: 'file' },
        { name: 'procar', type: 'directory' },
      ]),
      '/audio/procar/': listage([{ name: 'procar-on-low.wav', type: 'file' }]),
    })

    const banques = await fetchBanks(impl)

    expect(banques.map((banque) => banque.name)).toEqual(['procar'])
  })

  it('ne compte que les fichiers audio d’une banque', async () => {
    const { impl } = reseau({
      '/audio/': listage([{ name: 'procar', type: 'directory' }]),
      '/audio/procar/': listage([
        { name: 'procar-on-low.wav', type: 'file' },
        { name: 'procar-on-low.flac', type: 'file' },
        { name: 'notes.md', type: 'file' },
        { name: 'brouillons', type: 'directory' },
      ]),
    })

    const banques = await fetchBanks(impl)

    expect(banques[0]?.files).toEqual(['procar-on-low.flac', 'procar-on-low.wav'])
  })

  it('n’est pas emportée par une banque qui ne se liste pas', async () => {
    const { impl } = reseau({
      '/audio/': listage([
        { name: 'ferme', type: 'directory' },
        { name: 'procar', type: 'directory' },
      ]),
      '/audio/procar/': listage([{ name: 'procar-on-low.wav', type: 'file' }]),
    })

    const banques = await fetchBanks(impl)

    // La banque muette reste dans la liste, vide : son dossier existe, c'est son
    // contenu qu'on ignore.
    expect(banques.map((banque) => banque.name)).toEqual(['ferme', 'procar'])
    expect(banques[0]?.files).toEqual([])
  })

  it('échappe le nom du dossier dans l’adresse', async () => {
    const { impl, appels } = reseau({
      '/audio/': listage([{ name: 'moteur essence', type: 'directory' }]),
    })

    await fetchBanks(impl)

    expect(appels).toContain('/audio/moteur%20essence/')
  })
})

describe('les fichiers qu’une banque n’a pas', () => {
  const banque = { name: 'procar', files: ['a.wav', 'b.wav'] }

  it('nomme ceux que le profil déclare en vain', () => {
    expect(missingFiles(banque, ['a.wav', 'c.wav', 'd.wav'])).toEqual(['c.wav', 'd.wav'])
  })

  it('ne signale rien quand tout est là', () => {
    expect(missingFiles(banque, ['a.wav', 'b.wav'])).toEqual([])
  })

  it('ne signale rien quand la banque est inconnue', () => {
    // Ne rien savoir n'est pas savoir qu'il manque quelque chose : le serveur
    // peut refuser de lister une banque qui existe.
    expect(missingFiles(undefined, ['a.wav'])).toEqual([])
  })

  it('ignore une couche sans fichier déclaré', () => {
    expect(missingFiles(banque, ['a.wav', ''])).toEqual([])
  })
})

describe('les banques qu’un profil utilise', () => {
  it('les rend sans doublon', () => {
    expect(
      usedBanks([{ sampleDir: 'procar' }, { sampleDir: 'v8' }, { sampleDir: 'procar' }]),
    ).toEqual(['procar', 'v8'])
  })

  it('ignore un profil sans banque', () => {
    expect(usedBanks([{ sampleDir: '' }, { sampleDir: 'procar' }])).toEqual(['procar'])
  })

  it('rend une liste vide sans profil', () => {
    expect(usedBanks([])).toEqual([])
  })
})
