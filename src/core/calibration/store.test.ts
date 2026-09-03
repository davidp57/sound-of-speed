import { beforeEach, describe, expect, it } from 'vitest'

import { loadCalibration, saveCalibration } from './store'

/**
 * Tests de la persistance d'une session d'étalonnage.
 *
 * Une session ne garde que le lien entre une étape et sa trace. Le
 * récapitulatif se relit donc après un rechargement, et il se **recalcule** :
 * mémoriser les mesures en plus des traces donnerait deux vérités qui peuvent
 * diverger.
 */

function fakeStorage(options: { failWrites?: boolean; failReads?: boolean } = {}) {
  const entries = new Map<string, string>()
  return {
    getItem(key: string): string | null {
      if (options.failReads) throw new Error('lecture refusée')
      return entries.get(key) ?? null
    },
    setItem(key: string, value: string): void {
      if (options.failWrites) throw new Error('quota dépassé')
      entries.set(key, value)
    },
    removeItem(key: string): void {
      entries.delete(key)
    },
    clear(): void {
      entries.clear()
    },
    key: () => null,
    length: 0,
  }
}

function install(storage: ReturnType<typeof fakeStorage>): void {
  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    configurable: true,
    writable: true,
  })
}

beforeEach(() => {
  install(fakeStorage())
})

describe('loadCalibration', () => {
  it('rend une session vide quand il n’y a rien', () => {
    expect(loadCalibration()).toEqual({})
  })

  it('relit ce qui a été enregistré', () => {
    saveCalibration({ launch: 1_700_000_000_000 })

    expect(loadCalibration()).toEqual({ launch: 1_700_000_000_000 })
  })

  it('écarte une étape inconnue et une valeur qui n’est pas un horodatage', () => {
    localStorage.setItem(
      'speed.calibration.v1',
      JSON.stringify({ launch: 12, wheelie: 34, brake: 'hier' }),
    )

    expect(loadCalibration()).toEqual({ launch: 12 })
  })

  it('rend une session vide sur un contenu illisible', () => {
    localStorage.setItem('speed.calibration.v1', 'pas du JSON')

    expect(loadCalibration()).toEqual({})
  })

  it('rend une session vide quand le stockage refuse de lire', () => {
    install(fakeStorage({ failReads: true }))

    expect(loadCalibration()).toEqual({})
  })
})

describe('saveCalibration', () => {
  it('signale son échec sans lever', () => {
    install(fakeStorage({ failWrites: true }))

    expect(saveCalibration({ launch: 1 })).toBe(false)
  })
})
