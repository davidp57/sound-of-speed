/**
 * Ce qu'un refus fait de la tranche qu'on n'a pas pu envoyer.
 *
 * **Deux questions, et les confondre perd des données** : « faut-il réessayer
 * tout de suite ? » et « faut-il garder ce qu'on n'a pas pu envoyer ? ». Elles
 * ont la même réponse pour un compte disparu, et des réponses opposées pour un
 * serveur plein — où rejouer ne passera pas, mais où le conducteur peut faire de
 * la place.
 *
 * Le cas qui compte est le 507 : sans `garder`, la tranche prise par
 * `takeSlice` n'existe plus nulle part, et le journal de tout ce qui suit est
 * perdu pour de bon — y compris une fois la place faite.
 */

import { describe, expect, it } from 'vitest'

import { putSlice } from './slice-put'

const TRANCHE = { name: 'tranche.jsonl', body: 'une ligne\n', count: 1, bytes: 10 }

/** Un serveur qui répond toujours ce code-là. */
function serveurQuiRepond(code: number): typeof fetch {
  return (async () => new Response('', { status: code })) as unknown as typeof fetch
}

describe('un dépôt de tranche refusé', () => {
  it('garde la tranche quand il ne reste que des épingles, sans la rejouer tout de suite', async () => {
    const rendu = await putSlice('/journal/', TRANCHE, serveurQuiRepond(507))

    expect(rendu.ok).toBe(false)
    if (rendu.ok) return
    // Pas de rejeu serré — c'est ce qui a produit 726 tentatives en 137 s.
    expect(rendu.retry).toBe(false)
    // Mais la tranche reste : effacer deux trajets suffit à tout faire repartir.
    expect(rendu.garder).toBe(true)
    // Le message ne dit plus d'effacer : le serveur vient justement de ne pas
    // pouvoir le faire, et il ne reste que des trajets épinglés.
    expect(rendu.detail).toContain('épinglés')
    expect(rendu.detail).toContain('décrochez')
  })

  it('jette la tranche quand l’appareil n’a plus de compte', async () => {
    for (const code of [401, 403]) {
      const rendu = await putSlice('/journal/', TRANCHE, serveurQuiRepond(code))

      expect(rendu.ok, `code ${code}`).toBe(false)
      if (rendu.ok) continue
      expect(rendu.retry, `code ${code}`).toBe(false)
      // Rien ne repartira jamais sous ce compte : la garder ferait grossir une
      // file qui ne se videra pas.
      expect(rendu.garder, `code ${code}`).toBe(false)
    }
  })

  it('jette une tranche que le serveur refuse par sa taille', async () => {
    const rendu = await putSlice('/journal/', TRANCHE, serveurQuiRepond(413))

    expect(rendu.ok).toBe(false)
    if (rendu.ok) return
    expect(rendu.retry).toBe(false)
    expect(rendu.garder).toBe(false)
  })

  it('garde et rejoue quand le serveur est seulement indisponible', async () => {
    for (const code of [500, 502, 503]) {
      const rendu = await putSlice('/journal/', TRANCHE, serveurQuiRepond(code))

      expect(rendu.ok, `code ${code}`).toBe(false)
      if (rendu.ok) continue
      expect(rendu.retry, `code ${code}`).toBe(true)
      expect(rendu.garder, `code ${code}`).toBe(true)
    }
  })

  it('garde et rejoue quand le réseau manque, ce qui arrive en roulant', async () => {
    const sansReseau = (async () => {
      throw new Error('hors couverture')
    }) as unknown as typeof fetch

    const rendu = await putSlice('/journal/', TRANCHE, sansReseau)

    expect(rendu.ok).toBe(false)
    if (rendu.ok) return
    expect(rendu.retry).toBe(true)
    expect(rendu.garder).toBe(true)
  })
})
