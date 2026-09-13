/**
 * Ce qu'on vérifie ici : le code à scanner porte de quoi ouvrir un compte, il
 * le rend intact à l'arrivée, et **le fragment disparaît de l'adresse dès qu'il
 * est lu**.
 *
 * Ce dernier point est le seul qui ne se rattrape pas : un lien qui ouvre un
 * compte n'a rien à faire dans la barre d'adresse d'une page qu'on laisse
 * ouverte, ni dans l'historique du navigateur.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { decoderLien, encoderLien, lienDeLiaison, lireLienDansUrl } from './lien'

const COUPLE = {
  email: 'afwfxnmq7a@anonymous.placeholder.invalid',
  motDePasse: 'JDxU1qTt-k3ZGm0Nn8bVw2y7LhSc4pEr',
}

function adresse(hash: string): void {
  Object.defineProperty(globalThis, 'window', {
    value: { location: { hash, pathname: '/', search: '' } },
    configurable: true,
    writable: true,
  })
  Object.defineProperty(globalThis, 'history', {
    value: { replaceState: vi.fn() },
    configurable: true,
    writable: true,
  })
}

beforeEach(() => {
  adresse('')
})

describe('le code à scanner', () => {
  it('rend le couple intact', () => {
    expect(decoderLien(encoderLien(COUPLE))).toEqual(COUPLE)
  })

  it('tient tout entier dans le fragment', () => {
    // Le fragment n'est jamais transmis au serveur ni inscrit dans ses journaux.
    // C'est ce qui vaut à ce lien d'être un lien plutôt qu'un appel.
    const url = lienDeLiaison('https://speed.exemple.fr', COUPLE)

    expect(url.startsWith('https://speed.exemple.fr/#lier=')).toBe(true)
    expect(url).not.toContain(COUPLE.motDePasse)
    expect(url).not.toContain('@')
  })

  it('ne rend rien d’un jeton abîmé', () => {
    expect(decoderLien('ceci-n-est-pas-un-jeton')).toBeNull()
    expect(decoderLien(encoderLien(COUPLE).slice(4))).toBeNull()
  })
})

describe('la lecture de l’adresse', () => {
  it('rend le couple et efface le fragment', () => {
    adresse(`#lier=${encoderLien(COUPLE)}`)

    expect(lireLienDansUrl()).toEqual(COUPLE)
    expect(history.replaceState).toHaveBeenCalledWith(null, '', '/')
  })

  it('efface le fragment même quand il ne vaut rien', () => {
    // Sinon un lien mal recopié resterait affiché, et serait rejoué à chaque
    // rechargement de la page.
    adresse('#lier=abime')

    expect(lireLienDansUrl()).toBeNull()
    expect(history.replaceState).toHaveBeenCalled()
  })

  it('ne touche pas à une adresse qui ne porte pas de code', () => {
    // Un profil partagé voyage dans le même fragment, sous une autre clé : lui
    // couper l'herbe sous le pied ferait perdre le profil.
    adresse('#p=cQWERTY')

    expect(lireLienDansUrl()).toBeNull()
    expect(history.replaceState).not.toHaveBeenCalled()
  })
})
