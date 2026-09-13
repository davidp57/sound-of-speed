/**
 * Ce qu'on vérifie ici : ce qu'on devine, et surtout que le choix de
 * l'utilisateur passe devant.
 *
 * Reconnaître un navigateur à sa chaîne d'agent est un pari, et ce pari doit
 * pouvoir être défait : c'est la correction manuelle qui rattrape une voiture
 * prise pour un poste de travail, pas une règle plus fine.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import {
  appareilCourant,
  devinerLAppareil,
  entreeDAppareil,
  lireLAppareilChoisi,
  oublierLAppareilChoisi,
  rangerLAppareilChoisi,
  type IndicesDAppareil,
} from './appareil'

/** Une Tesla, telle que son navigateur embarqué s'annonce — à confirmer en voiture. */
const TESLA =
  'Mozilla/5.0 (X11; GNU/Linux) AppleWebKit/537.36 (KHTML, like Gecko) Chromium/79.0.3945.130 Chrome/79.0.3945.130 Safari/537.36 Tesla/2026.8.1'
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36'
const BUREAU =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

function indices(partiels: Partial<IndicesDAppareil> = {}): IndicesDAppareil {
  return { agent: BUREAU, largeur: 1920, tactile: false, ...partiels }
}

describe('deviner l’appareil', () => {
  it('reconnaît le navigateur de la voiture', () => {
    expect(devinerLAppareil(indices({ agent: TESLA, largeur: 1200, tactile: true }))).toBe('voiture')
  })

  it('reconnaît un téléphone à ce qu’il annonce', () => {
    expect(devinerLAppareil(indices({ agent: ANDROID, largeur: 412, tactile: true }))).toBe(
      'telephone',
    )
  })

  it('prend un écran tactile et étroit pour un téléphone', () => {
    // Se tromper ici n'ouvre qu'un écran de trop ; l'inverse fermerait le banc à
    // qui règle son son, garé.
    expect(devinerLAppareil(indices({ agent: 'un navigateur discret', largeur: 500, tactile: true }))).toBe(
      'telephone',
    )
  })

  it('laisse un poste de travail tactile être un poste', () => {
    // Un écran tactile branché sur un poste répond `fine` tant qu'il y a une
    // souris ; et large, il n'est de toute façon pas un téléphone.
    expect(devinerLAppareil(indices({ largeur: 2560, tactile: true }))).toBe('poste')
  })

  it('retombe sur le poste de travail quand rien ne se distingue', () => {
    expect(devinerLAppareil(indices({ agent: '' }))).toBe('poste')
  })
})

describe('ce que le journal retient du navigateur', () => {
  it('porte la chaîne d’agent, l’écran et le pointeur', () => {
    const entree = entreeDAppareil(
      { agent: TESLA, largeur: 1200, tactile: true },
      'voiture',
      824,
    )

    expect(entree).toEqual({
      agent: TESLA,
      largeur: 1200,
      hauteur: 824,
      tactile: true,
      devine: 'voiture',
      appareil: 'voiture',
    })
  })

  it('garde l’écart entre ce qu’on devine et ce qui s’applique', () => {
    // C'est le fait qu'on vient chercher : une détection ratée, corrigée à la
    // main. Les confondre rendrait le journal muet sur la seule question posée.
    const entree = entreeDAppareil({ agent: BUREAU, largeur: 1920, tactile: false }, 'voiture', 1080)

    expect(entree['devine']).toBe('poste')
    expect(entree['appareil']).toBe('voiture')
  })
})

describe('le choix corrigé', () => {
  beforeEach(() => {
    const entrees = new Map<string, string>()
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: (cle: string): string | null => entrees.get(cle) ?? null,
        setItem: (cle: string, valeur: string): void => void entrees.set(cle, valeur),
        removeItem: (cle: string): void => void entrees.delete(cle),
        clear: (): void => entrees.clear(),
        key: () => null,
        length: 0,
      },
      configurable: true,
      writable: true,
    })
  })

  it('survit à une réouverture', () => {
    rangerLAppareilChoisi('voiture')
    expect(lireLAppareilChoisi()).toBe('voiture')
  })

  it('passe devant ce qu’on devine', () => {
    installerUnNavigateur(BUREAU)
    expect(appareilCourant()).toBe('poste')

    rangerLAppareilChoisi('voiture')
    expect(appareilCourant()).toBe('voiture')
  })

  it('rend la main à la détection quand on l’oublie', () => {
    installerUnNavigateur(ANDROID)
    rangerLAppareilChoisi('poste')
    oublierLAppareilChoisi()

    expect(appareilCourant()).toBe('telephone')
  })

  it('ignore un choix qui ne désigne aucun appareil connu', () => {
    localStorage.setItem('speed.appareil.v1', 'sous-marin')
    expect(lireLAppareilChoisi()).toBeNull()
  })
})

function installerUnNavigateur(agent: string): void {
  Object.defineProperty(globalThis, 'navigator', {
    value: { userAgent: agent },
    configurable: true,
    writable: true,
  })
  Object.defineProperty(globalThis, 'window', {
    value: {
      screen: { width: agent === ANDROID ? 412 : 1920 },
      innerWidth: 1920,
      matchMedia: () => ({ matches: agent === ANDROID }),
    },
    configurable: true,
    writable: true,
  })
}
