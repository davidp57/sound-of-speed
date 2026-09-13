/**
 * Ce qu'on vérifie ici : un droit daté se referme **tout seul** quand l'heure
 * passe, sans qu'on ait rien rechargé ni redémarré.
 *
 * Et les deux bords qui l'encadrent : sans copie locale on n'interdit rien —
 * c'est le serveur qui protège —, et une copie trop vieille retombe sur ce qui
 * est offert à tout le monde plutôt que de croire ce qu'elle a retenu.
 */

import { describe, expect, it } from 'vitest'

import {
  prochaineEcheance,
  rolesOuverts,
  VALIDITE_COPIE_MS,
  type CopieDesRoles,
} from './roles'

const MIDI = Date.parse('2026-09-13T12:00:00Z')
const UNE_HEURE = 60 * 60 * 1000

function copie(partielle: Partial<CopieDesRoles> = {}): CopieDesRoles {
  return { droits: [], offerts: [], releveLe: MIDI, ...partielle }
}

describe('les rôles ouverts', () => {
  it('n’interdit rien tant qu’aucune copie n’a été relevée', () => {
    // Premier lancement dans un tunnel : refermer des écrans ici casserait une
    // application qui marchait, pour protéger ce que le serveur protège déjà.
    expect(rolesOuverts(null, MIDI)).toEqual(['conduite', 'atelier', 'synthese'])
  })

  it('rend ce qui est offert à tout le monde, plus ce que le compte porte', () => {
    const lus = rolesOuverts(
      copie({ offerts: ['conduite'], droits: [{ role: 'synthese', expireLe: null }] }),
      MIDI,
    )
    expect(lus).toEqual(['conduite', 'synthese'])
  })

  it('referme un droit dont l’échéance vient de passer, sans rien recharger', () => {
    const avec = copie({
      offerts: ['conduite'],
      droits: [{ role: 'atelier', expireLe: MIDI + UNE_HEURE }],
    })

    expect(rolesOuverts(avec, MIDI)).toEqual(['conduite', 'atelier'])
    // La même copie, une seconde après l'échéance : l'atelier s'est refermé.
    expect(rolesOuverts(avec, MIDI + UNE_HEURE + 1000)).toEqual(['conduite'])
  })

  it('garde un droit sans échéance tant que la copie vaut', () => {
    const avec = copie({ droits: [{ role: 'atelier', expireLe: null }] })
    expect(rolesOuverts(avec, MIDI + VALIDITE_COPIE_MS)).toContain('atelier')
  })

  it('retombe sur ce qui est offert quand la copie a passé sa validité', () => {
    const avec = copie({
      offerts: ['conduite'],
      droits: [{ role: 'synthese', expireLe: null }],
    })

    expect(rolesOuverts(avec, MIDI + VALIDITE_COPIE_MS)).toEqual(['conduite', 'synthese'])
    expect(rolesOuverts(avec, MIDI + VALIDITE_COPIE_MS + 1)).toEqual(['conduite'])
  })

  it('rend les rôles dans le même ordre, quelle que soit la copie', () => {
    const desordre = copie({
      offerts: ['synthese'],
      droits: [
        { role: 'atelier', expireLe: null },
        { role: 'conduite', expireLe: null },
        { role: 'atelier', expireLe: null },
      ],
    })
    expect(rolesOuverts(desordre, MIDI)).toEqual(['conduite', 'atelier', 'synthese'])
  })
})

describe('la prochaine échéance', () => {
  it('rend la plus proche de celles qui restent à venir', () => {
    const avec = copie({
      droits: [
        { role: 'atelier', expireLe: MIDI + 3 * UNE_HEURE },
        { role: 'synthese', expireLe: MIDI + UNE_HEURE },
        { role: 'conduite', expireLe: null },
      ],
    })
    expect(prochaineEcheance(avec, MIDI)).toBe(MIDI + UNE_HEURE)
  })

  it('ne rend rien quand aucun droit n’est daté', () => {
    expect(prochaineEcheance(copie({ droits: [{ role: 'conduite', expireLe: null }] }), MIDI)).toBeNull()
    expect(prochaineEcheance(null, MIDI)).toBeNull()
  })

  it('ignore une échéance déjà passée, qui n’a plus rien à refermer', () => {
    const avec = copie({ droits: [{ role: 'atelier', expireLe: MIDI - UNE_HEURE }] })
    expect(prochaineEcheance(avec, MIDI)).toBeNull()
  })
})
