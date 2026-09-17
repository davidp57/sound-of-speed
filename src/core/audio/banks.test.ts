import { describe, expect, it } from 'vitest'

import { describeBankLoadFailure, fetchBanks, missingFiles, usedBanks } from './banks'

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
        { name: 'v8-musclecar', type: 'directory' },
        { name: 'v8-crossplane', type: 'directory' },
      ]),
      '/audio/v8-musclecar/': listage([
        { name: 'on-low.wav', type: 'file' },
        { name: 'on-high.wav', type: 'file' },
      ]),
      '/audio/v8-crossplane/': listage([{ name: 'v8-on-low.flac', type: 'file' }]),
    })

    const banques = await fetchBanks(impl)

    // Triés : la liste s'affiche, et un ordre qui bouge d'un chargement à
    // l'autre se lit mal.
    expect(banques.map((banque) => banque.name)).toEqual(['v8-crossplane', 'v8-musclecar'])
    expect(banques[0]?.files).toEqual(['v8-on-low.flac'])
    expect(banques[1]?.files).toEqual(['on-high.wav', 'on-low.wav'])
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
        { name: 'v8-musclecar', type: 'directory' },
      ]),
      '/audio/v8-musclecar/': listage([{ name: 'on-low.wav', type: 'file' }]),
    })

    const banques = await fetchBanks(impl)

    expect(banques.map((banque) => banque.name)).toEqual(['v8-musclecar'])
  })

  it('ne compte que les fichiers audio d’une banque', async () => {
    const { impl } = reseau({
      '/audio/': listage([{ name: 'v8-musclecar', type: 'directory' }]),
      '/audio/v8-musclecar/': listage([
        { name: 'on-low.wav', type: 'file' },
        { name: 'on-low.flac', type: 'file' },
        { name: 'notes.md', type: 'file' },
        { name: 'brouillons', type: 'directory' },
      ]),
    })

    const banques = await fetchBanks(impl)

    expect(banques[0]?.files).toEqual(['on-low.flac', 'on-low.wav'])
  })

  it('n’est pas emportée par une banque qui ne se liste pas', async () => {
    const { impl } = reseau({
      '/audio/': listage([
        { name: 'ferme', type: 'directory' },
        { name: 'v8-musclecar', type: 'directory' },
      ]),
      '/audio/v8-musclecar/': listage([{ name: 'on-low.wav', type: 'file' }]),
    })

    const banques = await fetchBanks(impl)

    // La banque muette reste dans la liste, vide : son dossier existe, c'est son
    // contenu qu'on ignore.
    expect(banques.map((banque) => banque.name)).toEqual(['ferme', 'v8-musclecar'])
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
  const banque = { name: 'v8-musclecar', files: ['a.wav', 'b.wav'] }

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
      usedBanks([{ sampleDir: 'v8-musclecar' }, { sampleDir: 'v8' }, { sampleDir: 'v8-musclecar' }]),
    ).toEqual(['v8-musclecar', 'v8'])
  })

  it('ignore un profil sans banque', () => {
    expect(usedBanks([{ sampleDir: '' }, { sampleDir: 'v8-musclecar' }])).toEqual(['v8-musclecar'])
  })

  it('rend une liste vide sans profil', () => {
    expect(usedBanks([])).toEqual([])
  })
})

describe('ce qu’on dit d’une banque qui ne charge pas', () => {
  it('nomme la banque, et non le fichier qui a échoué', () => {
    const { message } = describeBankLoadFailure('gm-ls-adouci', 404)
    expect(message).toContain('gm-ls-adouci')
    expect(message).not.toContain('.flac')
  })

  it('dit le geste qui rend le son, quand la banque n’est pas là', () => {
    const { message, canRetry } = describeBankLoadFailure('gm-ls-adouci', 404)
    expect(message).toContain('autre profil')
    // Relancer le chargement ne changerait rien : le bouton ne doit pas l'offrir.
    expect(canRetry).toBe(false)
  })

  it('distingue un refus faute de compte d’une banque absente', () => {
    const absente = describeBankLoadFailure('gm-ls', 404)
    const sansCompte = describeBankLoadFailure('gm-ls', 401)
    expect(sansCompte.message).not.toBe(absente.message)
    expect(sansCompte.message).toContain('compte')
  })

  it('ne crie pas à la panne dans un tunnel, et laisse réessayer', () => {
    const { message, canRetry } = describeBankLoadFailure('bmw-i6-3l', 'unreachable')
    expect(message).toContain('réseau')
    expect(message).toContain('bmw-i6-3l')
    expect(canRetry).toBe(true)
  })

  it('rend le code sur une panne de serveur, qu’on peut réessayer', () => {
    const { message, canRetry } = describeBankLoadFailure('gm-ls', 503)
    expect(message).toContain('503')
    expect(canRetry).toBe(true)
  })

  it('tient sur une ligne à la largeur de l’écran de la voiture', () => {
    // 773 px utiles, et le message s'affiche à peu près à 16 px : au-delà de
    // quatre-vingts caractères, il passe à la ligne et pousse les cadrans.
    for (const cause of [404, 401, 503, 'unreachable'] as const) {
      expect(describeBankLoadFailure('gm-ls-long-header', cause).message.length).toBeLessThan(80)
    }
  })
})
