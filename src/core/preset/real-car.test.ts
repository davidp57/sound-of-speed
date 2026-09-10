import { describe, expect, it } from 'vitest'

import { clampRealCar, DEFAULT_REAL_CAR, realCarFromProfile } from './real-car'
import { createRoadProfile } from './defaults'

/**
 * Tests de la voiture réelle.
 *
 * Ce qui se vérifie : que les valeurs d'un profil déjà réglé soient reprises
 * plutôt qu'écrasées par les valeurs d'usine — c'est la seule chose que la
 * reprise puisse mal faire —, et qu'un stockage local trafiqué à la main ne
 * puisse pas rendre la mesure inexploitable.
 */

describe('les valeurs par défaut', () => {
  it('sont celles qui ont roulé', () => {
    // Elles viennent des profils livrés : les déplacer ne doit pas les changer.
    expect(DEFAULT_REAL_CAR.springOmega).toBe(createRoadProfile().speed.springOmega)
    expect(DEFAULT_REAL_CAR.accelWindowMs).toBe(createRoadProfile().speed.accelWindowMs)
    expect(DEFAULT_REAL_CAR.maxAccuracyM).toBe(createRoadProfile().speed.maxAccuracyM)
  })

  it('ne nomment aucun modèle : on ne suppose pas la voiture de quelqu\'un', () => {
    expect(DEFAULT_REAL_CAR.model).toBeUndefined()
  })
})

describe('la reprise depuis un profil', () => {
  it('garde les valeurs que le profil portait', () => {
    const profil = createRoadProfile()
    profil.speed.accelWindowMs = 750
    profil.speed.springOmega = 22

    const voiture = realCarFromProfile(profil)

    expect(voiture.accelWindowMs).toBe(750)
    expect(voiture.springOmega).toBe(22)
  })

  it('rend les valeurs d\'usine quand le profil n\'en portait pas', () => {
    expect(realCarFromProfile({})).toEqual(DEFAULT_REAL_CAR)
  })

  it('complète une section incomplète sans rien inventer d\'autre', () => {
    const voiture = realCarFromProfile({ speed: { accelWindowMs: 500 } })
    expect(voiture.accelWindowMs).toBe(500)
    expect(voiture.springOmega).toBe(DEFAULT_REAL_CAR.springOmega)
  })
})

describe('le nettoyage des valeurs', () => {
  it('refuse une fenêtre d\'accélération nulle, qui rendrait la pente indéfinie', () => {
    expect(clampRealCar({ accelWindowMs: 0 }).accelWindowMs).toBeGreaterThanOrEqual(100)
  })

  it('refuse une raideur négative', () => {
    expect(clampRealCar({ springOmega: -5 }).springOmega).toBeGreaterThan(0)
  })

  it('empêche les deux bornes d\'accélération de se croiser', () => {
    // Une décélération maximale positive, ou une accélération maximale
    // négative, arrêterait tout net le signal.
    expect(clampRealCar({ minAccelMs2: 3 }).minAccelMs2).toBeLessThan(0)
    expect(clampRealCar({ maxAccelMs2: -3 }).maxAccelMs2).toBeGreaterThan(0)
  })

  it('écarte ce qui n\'est pas un nombre', () => {
    const voiture = clampRealCar({ springOmega: Number.NaN, accelWindowMs: undefined })
    expect(voiture.springOmega).toBe(DEFAULT_REAL_CAR.springOmega)
    expect(voiture.accelWindowMs).toBe(DEFAULT_REAL_CAR.accelWindowMs)
  })

  it('garde un modèle nommé, et ignore un modèle vide', () => {
    expect(clampRealCar({ model: '  Tesla Model 3  ' }).model).toBe('Tesla Model 3')
    expect(clampRealCar({ model: '   ' }).model).toBeUndefined()
  })

  it('rend les valeurs d\'usine sur une entrée absente', () => {
    expect(clampRealCar(undefined)).toEqual(DEFAULT_REAL_CAR)
  })
})
