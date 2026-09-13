/**
 * Ce qu'on vérifie ici : ce qui revient du serveur est retenu tel quel, et ce
 * qui n'en revient pas ne casse rien.
 *
 * Le cas qui compte est le second. Hors réseau — la situation ordinaire d'une
 * voiture —, la copie précédente reste bonne ; et une réponse de travers vaut
 * mieux ignorée qu'obéie, un serveur qui bafouille n'ayant pas à refermer des
 * écrans qui marchaient.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { lireLaCopie, oublierLaCopie, rangerLaCopie, releverLesRoles } from './roles-client'

const MIDI = Date.parse('2026-09-13T12:00:00Z')
const UNE_HEURE = 60 * 60 * 1000

function fauxStockage() {
  const entrees = new Map<string, string>()
  return {
    getItem: (cle: string): string | null => entrees.get(cle) ?? null,
    setItem: (cle: string, valeur: string): void => void entrees.set(cle, valeur),
    removeItem: (cle: string): void => void entrees.delete(cle),
    clear: (): void => entrees.clear(),
    key: () => null,
    length: 0,
  }
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    value: fauxStockage(),
    configurable: true,
    writable: true,
  })
})

/** Un serveur qui répond ce qu'on lui dit de répondre. */
function serveur(charge: unknown, status = 200) {
  return vi.fn(async () =>
    Promise.resolve(
      new Response(typeof charge === 'string' ? charge : JSON.stringify(charge), { status }),
    ),
  ) as unknown as typeof fetch
}

describe('relever les rôles', () => {
  it('retient ce que le serveur accorde, échéances comprises', async () => {
    const fetchImpl = serveur({
      droits: [
        { role: 'conduite', expireLe: null },
        { role: 'atelier', expireLe: new Date(MIDI + UNE_HEURE).toISOString() },
      ],
      offerts: ['conduite'],
    })

    const copie = await releverLesRoles({ fetchImpl, now: () => MIDI })

    expect(copie).toEqual({
      droits: [
        { role: 'conduite', expireLe: null },
        { role: 'atelier', expireLe: MIDI + UNE_HEURE },
      ],
      offerts: ['conduite'],
      releveLe: MIDI,
    })
    expect(lireLaCopie()).toEqual(copie)
  })

  it('ne rend rien hors réseau, et laisse la copie d’avant intacte', async () => {
    rangerLaCopie({ droits: [{ role: 'conduite', expireLe: null }], offerts: [], releveLe: MIDI })

    const fetchImpl = vi.fn(async () => Promise.reject(new Error('réseau'))) as unknown as typeof fetch
    expect(await releverLesRoles({ fetchImpl })).toBeNull()

    expect(lireLaCopie()?.droits).toEqual([{ role: 'conduite', expireLe: null }])
  })

  it('ne rend rien quand l’appareil n’a pas encore de compte', async () => {
    // Le premier démarrage demande un compte et ses rôles dans cet ordre ; le
    // 401 est ici normal, et ne doit rien effacer.
    expect(await releverLesRoles({ fetchImpl: serveur('compte requis', 401) })).toBeNull()
  })

  it('écarte un rôle inconnu plutôt que de le retenir', async () => {
    const fetchImpl = serveur({
      droits: [{ role: 'pilote-d-essai', expireLe: null }, { role: 'synthese', expireLe: null }],
      offerts: ['conduite', 'banc'],
    })

    const copie = await releverLesRoles({ fetchImpl, now: () => MIDI })

    expect(copie?.droits).toEqual([{ role: 'synthese', expireLe: null }])
    expect(copie?.offerts).toEqual(['conduite'])
  })

  it('prend une date illisible pour une absence d’échéance', async () => {
    // Un droit qui se refermerait sur une date de travers serait un écran perdu
    // pour une faute de frappe côté serveur.
    const fetchImpl = serveur({ droits: [{ role: 'atelier', expireLe: 'demain' }], offerts: [] })

    expect((await releverLesRoles({ fetchImpl, now: () => MIDI }))?.droits).toEqual([
      { role: 'atelier', expireLe: null },
    ])
  })

  it('ignore une copie abîmée, et se comporte comme s’il n’y en avait pas', () => {
    localStorage.setItem('speed.roles.v1', '{"droits":[{"role":42}],"offerts":[],"releveLe":0}')
    expect(lireLaCopie()).toBeNull()
  })

  it('oublie ce qui a été retenu, un autre compte n’ayant pas les mêmes rôles', () => {
    rangerLaCopie({ droits: [], offerts: ['conduite'], releveLe: MIDI })
    oublierLaCopie()
    expect(lireLaCopie()).toBeNull()
  })
})
