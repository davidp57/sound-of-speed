/**
 * Ce que la rotation emporte, et ce qu'elle ne touche pas.
 *
 * Le cas qui compte est le dernier : un compte qui n'a plus que des épingles
 * reste plein, et c'est le seul moment où un dépôt se refuse encore.
 */

import { describe, expect, it } from 'vitest'

import type { TrajetJuge } from './regle'
import {
  CIBLE_APRES_ROTATION,
  etatDeLaPlace,
  rotationDeRetention,
  SEUIL_DE_ROTATION,
} from './rotation'

const JOUR = 24 * 60 * 60 * 1000

/** Un trajet réduit à ce que la rotation regarde : sa date, son poids, son épingle. */
function trajet(cle: string, jours: number, octets: number, epingle = false): TrajetJuge {
  return {
    cle,
    isole: false,
    enregistreLe: Date.parse('2026-09-15T00:00:00Z') - jours * JOUR,
    octets,
    tranches: 1,
    traces: 1,
    journal: 0,
    aVoir: 0,
    exemption: epingle ? 'epingle' : null,
  }
}

const PLAFOND = 1000

describe('la rotation', () => {
  it('ne fait rien tant qu’on est sous le seuil', () => {
    const rendu = rotationDeRetention([trajet('a', 30, 400)], 940, PLAFOND)

    expect(rendu.aEffacer).toEqual([])
    expect(rendu.bloque).toBe(false)
  })

  it('prend le plus ancien d’abord, et s’arrête à la cible', () => {
    const trajets = [trajet('recent', 1, 200), trajet('vieux', 30, 200), trajet('moyen', 10, 200)]

    // 960 occupés : il faut descendre à 900, donc un seul trajet suffit.
    const rendu = rotationDeRetention(trajets, 960, PLAFOND)

    expect(rendu.aEffacer.map((t) => t.cle)).toEqual(['vieux'])
    expect(rendu.octets).toBe(200)
  })

  it('en prend autant qu’il faut, et pas un de plus', () => {
    const trajets = [trajet('a', 40, 50), trajet('b', 30, 50), trajet('c', 20, 50), trajet('d', 10, 50)]

    // 1000 occupés, cible 900 : deux trajets de cinquante suffisent.
    const rendu = rotationDeRetention(trajets, 1000, PLAFOND)

    expect(rendu.aEffacer.map((t) => t.cle)).toEqual(['a', 'b'])
  })

  it('ne prend jamais un trajet épinglé, même le plus ancien', () => {
    const trajets = [trajet('vieux-epingle', 40, 200, true), trajet('moins-vieux', 20, 200)]

    const rendu = rotationDeRetention(trajets, 960, PLAFOND)

    expect(rendu.aEffacer.map((t) => t.cle)).toEqual(['moins-vieux'])
  })

  it('prend un trajet repris de l’ancien serveur : seule l’épingle protège', () => {
    const archive = { ...trajet('repris', 90, 200), exemption: 'archive' as const }

    const rendu = rotationDeRetention([archive, trajet('recent', 1, 200)], 960, PLAFOND)

    expect(rendu.aEffacer.map((t) => t.cle)).toEqual(['repris'])
  })

  it('dit qu’elle est bloquée quand il ne reste que des épingles au-dessus du plafond', () => {
    const trajets = [trajet('a', 40, 600, true), trajet('b', 30, 500, true)]

    const rendu = rotationDeRetention(trajets, 1100, PLAFOND)

    expect(rendu.aEffacer).toEqual([])
    expect(rendu.bloque).toBe(true)
  })

  it('n’est pas bloquée quand elle libère assez pour repasser sous le plafond', () => {
    // Elle n'atteint pas la cible de 900 — il n'y a pas assez d'effaçable —,
    // mais elle repasse sous le plafond, et c'est cela qui décide du refus.
    const trajets = [trajet('a', 40, 150), trajet('epingle', 30, 900, true)]

    const rendu = rotationDeRetention(trajets, 1050, PLAFOND)

    expect(rendu.aEffacer.map((t) => t.cle)).toEqual(['a'])
    expect(rendu.bloque).toBe(false)
  })
})

describe('l’état annoncé', () => {
  it('suit les deux seuils', () => {
    expect(etatDeLaPlace(740, PLAFOND)).toBe('libre')
    expect(etatDeLaPlace(750, PLAFOND)).toBe('bientot')
    expect(etatDeLaPlace(940, PLAFOND)).toBe('bientot')
    expect(etatDeLaPlace(950, PLAFOND)).toBe('rotation')
    expect(etatDeLaPlace(1200, PLAFOND)).toBe('rotation')
  })

  it('garde la cible sous le seuil qui la déclenche', () => {
    // Sans cela, la rotation se relancerait à chaque dépôt : elle descendrait
    // juste assez pour repasser au-dessus au suivant.
    expect(CIBLE_APRES_ROTATION).toBeLessThan(SEUIL_DE_ROTATION)
  })
})
