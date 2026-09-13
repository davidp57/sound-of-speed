/**
 * Ce qu'on vérifie ici : le code à scanner porte le code de liaison, il le rend
 * intact à l'arrivée, et **le fragment disparaît de l'adresse dès qu'il est
 * lu**.
 *
 * Ce dernier point est le seul qui ne se rattrape pas : un lien qui ouvre un
 * compte n'a rien à faire dans la barre d'adresse d'une page qu'on laisse
 * ouverte, ni dans l'historique du navigateur.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { lienDeLiaison, lireLienDansUrl } from './lien'

const CODE = 'K7M4-PQ2R'

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

describe('le lien à scanner', () => {
  it('porte le code, dans le fragment', () => {
    // Le fragment n'est jamais transmis au serveur ni inscrit dans ses journaux.
    // C'est ce qui vaut à ce lien d'être un lien plutôt qu'un appel.
    const url = lienDeLiaison('https://speed.exemple.fr', CODE)

    expect(url).toBe('https://speed.exemple.fr/#lier=K7M4-PQ2R')
  })

  it('reste court, donc lisible de loin', () => {
    // Un code à scanner qui porte peu se lit à bout de bras sur l'écran d'une
    // voiture. La version d'avant portait cent quatre-vingt-six caractères.
    expect(lienDeLiaison('https://speed.exemple.fr', CODE).length).toBeLessThan(50)
  })
})

describe('la lecture de l’adresse', () => {
  it('rend le code et efface le fragment', () => {
    adresse(`#lier=${CODE}`)

    expect(lireLienDansUrl()).toBe(CODE)
    expect(history.replaceState).toHaveBeenCalledWith(null, '', '/')
  })

  it('efface le fragment même quand il ne vaut rien', () => {
    // Sinon un lien mal recopié resterait affiché, et serait rejoué à chaque
    // rechargement de la page.
    adresse('#lier=%%%')

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
