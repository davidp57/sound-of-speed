/**
 * Ce qu'on vérifie ici : les deux gestes ne se confondent pas.
 *
 * **Rattacher** garde le compte de cet appareil et lui donne une adresse ;
 * **se connecter** ouvre un compte d'ailleurs et abandonne celui d'ici. Les
 * confondre ferait perdre des réglages sans rien dire, ce qui est la seule
 * faute qui ne se rattrape pas.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { preuvesDuCompte, rattacherUneAdresse, seConnecter } from './compte'
import { loadIdentity, saveIdentity, type LocalIdentity } from './store'

function fauxStockage() {
  const entrees = new Map<string, string>()
  return {
    getItem: (cle: string): string | null => entrees.get(cle) ?? null,
    setItem: (cle: string, valeur: string): void => void entrees.set(cle, valeur),
    removeItem: (cle: string): void => void entrees.delete(cle),
    clear: (): void => entrees.clear(),
    key: () => null,
    length: 0,
    entrees,
  }
}

const GARDEE: LocalIdentity = {
  id: 'c-ici',
  name: 'houle-paisible-47',
  anonymous: true,
  obtainedAt: 1_700_000_000_000,
}

/** Un serveur qui répond ce qu'on lui dit, et note les chemins demandés. */
function serveur(reponses: Record<string, { statut: number; charge?: unknown }>) {
  const appels: string[] = []
  const fetchImpl = vi.fn(async (adresse: string | URL | Request) => {
    const chemin = String(adresse)
    appels.push(chemin)
    const cle = Object.keys(reponses).find((motif) => chemin.includes(motif)) ?? ''
    const reponse = reponses[cle] ?? { statut: 404 }
    return new Response(JSON.stringify(reponse.charge ?? null), {
      status: reponse.statut,
      headers: { 'Content-Type': 'application/json' },
    })
  }) as unknown as typeof fetch
  return { fetchImpl, appels }
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    value: fauxStockage(),
    configurable: true,
    writable: true,
  })
})

describe('rattacher une adresse', () => {
  it('rend l’adresse telle que le serveur l’a rangée', async () => {
    // Le serveur la met en minuscules ; s'en remettre à lui évite d'afficher
    // autre chose que ce qui ouvre le compte.
    const { fetchImpl } = serveur({
      'compte/rattacher': { statut: 200, charge: { email: 'david@exemple.fr' } },
    })

    const rendu = await rattacherUneAdresse('David@Exemple.fr', 'assez-long-pour-passer', {
      fetchImpl,
    })

    expect(rendu).toEqual({ state: 'rattachee', email: 'david@exemple.fr' })
  })

  it('redit ce que le serveur reproche, plutôt qu’un code', async () => {
    const { fetchImpl } = serveur({
      'compte/rattacher': {
        statut: 409,
        charge: { message: 'Cette adresse est déjà celle d’un autre compte.' },
      },
    })

    const rendu = await rattacherUneAdresse('pris@exemple.fr', 'assez-long-pour-passer', {
      fetchImpl,
    })

    expect(rendu).toEqual({
      state: 'refusee',
      detail: 'Cette adresse est déjà celle d’un autre compte.',
    })
  })

  it('ne touche pas à l’identité gardée', async () => {
    // Rattacher ne change pas de compte : c'est tout l'intérêt. Ce qui change
    // est son état, et c'est l'assemblage qui le range.
    saveIdentity(GARDEE)
    const { fetchImpl } = serveur({
      'compte/rattacher': { statut: 200, charge: { email: 'david@exemple.fr' } },
    })

    await rattacherUneAdresse('david@exemple.fr', 'assez-long-pour-passer', { fetchImpl })

    expect(loadIdentity()).toEqual(GARDEE)
  })

  it('dit qu’on ne rattache rien hors réseau', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }) as unknown as typeof fetch

    expect(await rattacherUneAdresse('a@b.fr', 'assez-long-pour-passer', { fetchImpl })).toEqual({
      state: 'sans-reseau',
    })
  })
})

describe('se connecter à un compte', () => {
  it('range l’identité du compte rejoint, et dit le sort de l’ancien', async () => {
    saveIdentity(GARDEE)
    const { fetchImpl, appels } = serveur({
      'compte/connexion': {
        statut: 200,
        charge: {
          user: {
            id: 'c-ailleurs',
            name: 'granit-nocturne-12',
            email: 'david@exemple.fr',
            isAnonymous: false,
          },
          ancien: 'efface',
        },
      },
    })

    const rendu = await seConnecter('david@exemple.fr', 'assez-long-pour-passer', {
      fetchImpl,
      now: () => 1_800_000_000_000,
    })

    expect(rendu).toEqual({
      state: 'connectee',
      ancien: 'efface',
      identity: {
        id: 'c-ailleurs',
        name: 'granit-nocturne-12',
        email: 'david@exemple.fr',
        anonymous: false,
        obtainedAt: 1_800_000_000_000,
      },
    })
    // Un seul passage : c'est ce qui permet au serveur de régler le sort du
    // compte d'ici pendant que son témoin le prouve encore.
    expect(appels).toHaveLength(1)
    expect(loadIdentity()?.id).toBe('c-ailleurs')
  })

  it('ne garde rien d’un refus, et ne dit pas lequel des deux était faux', async () => {
    saveIdentity(GARDEE)
    const { fetchImpl } = serveur({ 'compte/connexion': { statut: 401 } })

    const rendu = await seConnecter('david@exemple.fr', 'mauvais', { fetchImpl })

    expect(rendu).toEqual({
      state: 'refusee',
      detail: 'Cette adresse et ce mot de passe n’ouvrent aucun compte.',
    })
    expect(loadIdentity()).toEqual(GARDEE)
  })

  it('distingue le refoulement des essais trop rapprochés', async () => {
    const { fetchImpl } = serveur({ 'compte/connexion': { statut: 429 } })

    const rendu = await seConnecter('david@exemple.fr', 'assez-long-pour-passer', { fetchImpl })

    expect(rendu).toEqual({
      state: 'refusee',
      detail: 'Trop d’essais de suite. Réessayer dans une minute.',
    })
  })

  it('n’invente pas d’adresse pour un compte anonyme', async () => {
    // Celle que la bibliothèque fabrique sous `.invalid` ne désigne aucune
    // boîte : l'afficher ferait croire à une adresse.
    const { fetchImpl } = serveur({
      'compte/connexion': {
        statut: 200,
        charge: {
          user: { id: 'c-x', name: 'X', email: 'zz@anonymous.placeholder.invalid', isAnonymous: true },
          ancien: 'aucun',
        },
      },
    })

    const rendu = await seConnecter('x@exemple.fr', 'assez-long-pour-passer', { fetchImpl })

    expect(rendu.state).toBe('connectee')
    expect(loadIdentity()?.email).toBeUndefined()
  })
})

describe('ce que le compte porte déjà', () => {
  it('sépare le mot de passe des comptes tenus ailleurs', async () => {
    const { fetchImpl } = serveur({
      'compte/preuves': {
        statut: 200,
        charge: { motDePasse: true, fournisseurs: [{ id: 'google', nom: 'Google' }] },
      },
    })

    expect(await preuvesDuCompte({ fetchImpl })).toEqual({
      motDePasse: true,
      fournisseurs: [{ id: 'google', nom: 'Google' }],
    })
  })

  it('ne sait rien plutôt que de deviner, hors réseau', async () => {
    // Le cas courant dans la voiture. Répondre « pas de mot de passe » ferait
    // proposer de s'approprier un compte qui l'est peut-être déjà.
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }) as unknown as typeof fetch

    expect(await preuvesDuCompte({ fetchImpl })).toBeNull()
  })

  it('écarte un fournisseur qu’il ne saurait pas afficher', async () => {
    const { fetchImpl } = serveur({
      'compte/preuves': {
        statut: 200,
        charge: { motDePasse: false, fournisseurs: [{ id: 'sans-nom' }, { nom: 'Sans identifiant' }] },
      },
    })

    expect(await preuvesDuCompte({ fetchImpl })).toEqual({ motDePasse: false, fournisseurs: [] })
  })
})
