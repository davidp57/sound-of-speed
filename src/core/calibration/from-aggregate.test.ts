import { describe, expect, it } from 'vitest'

import { overridesFromAggregate, stepsFromAggregate } from './from-aggregate'
import { digestOf, emptyAggregate, withTrip } from './aggregate'
import { createDefaultProfile } from '../preset/defaults'
import type { Trace } from '../speed/replay'
import type { SpeedSample } from '../speed/source'

/**
 * Tests de la conversion de l'agrégat en réglages.
 *
 * Ce qu'il faut prouver n'est pas que les formules sont justes — elles vivent
 * dans `suggest.ts` et y sont éprouvées — mais que **l'agrégat leur donne ce
 * qu'elles attendent**, et qu'il refuse de conclure quand il lui manque quelque
 * chose.
 */

/** Un trajet varié : ville, route, autoroute, reprises et freinages. */
function trajetComplet(at: number): Trace {
  const samples: SpeedSample[] = []
  let ms = 0
  const pousse = (kmh: number, seconds: number) => {
    for (let i = 0; i < seconds * 10; i += 1) {
      samples.push({ kmh, at: ms, accuracyM: 5, derived: false })
      ms += 100
    }
  }
  const rampe = (de: number, a: number, seconds: number) => {
    const pas = (a - de) / (seconds * 10)
    for (let i = 0; i < seconds * 10; i += 1) {
      samples.push({ kmh: de + pas * i, at: ms, accuracyM: 5, derived: false })
      ms += 100
    }
  }

  for (let tour = 0; tour < 3; tour += 1) {
    pousse(0, 3)
    rampe(0, 40, 5) // départ franc
    pousse(40, 20) // ville
    rampe(40, 75, 6)
    pousse(75, 25) // route
    rampe(75, 125, 8) // relance franche
    pousse(125, 40) // autoroute
    rampe(125, 60, 6) // freinage
    pousse(60, 15)
    rampe(60, 0, 12) // pied levé, long
  }

  return { name: 'complet', startedAt: at, samples }
}

function agregatComplet() {
  let a = emptyAggregate()
  for (let i = 1; i <= 3; i += 1) {
    a = withTrip(a, digestOf(`t${i}`, trajetComplet(i * 1000)))
  }
  return a
}

describe('stepsFromAggregate', () => {
  it('reconstitue les six étapes du protocole', () => {
    const steps = stepsFromAggregate(agregatComplet())

    expect(steps).not.toBeNull()
    expect(steps!.map((s) => s.step)).toEqual([
      'city',
      'road',
      'highway',
      'launch',
      'coast',
      'brake',
    ])
    expect(steps!.every((s) => s.valid)).toBe(true)
  })

  it('range les paliers dans l’étape de leur régime', () => {
    const steps = stepsFromAggregate(agregatComplet())!
    const par = new Map(steps.map((s) => [s.step, s.measure]))

    expect(par.get('city')!.plateaus.length).toBeGreaterThan(0)
    expect(par.get('highway')!.plateaus.length).toBeGreaterThan(0)
    expect(par.get('city')!.plateaus.every((p) => p.kmh < 50)).toBe(true)
    expect(par.get('highway')!.plateaus.every((p) => p.kmh >= 90)).toBe(true)
  })

  it('met les départs sur l’étape de ville, comme le protocole', () => {
    const steps = stepsFromAggregate(agregatComplet())!
    const par = new Map(steps.map((s) => [s.step, s.measure]))

    expect(par.get('city')!.departureKmh.length).toBeGreaterThan(0)
    expect(par.get('highway')!.departureKmh).toEqual([])
  })

  /**
   * Le freinage doit être plus franc que le lever de pied, sans quoi le seuil
   * de rétrogradage n'a pas de sens — c'est leur milieu qu'on retient.
   */
  it('sépare le lever de pied du freinage', () => {
    const steps = stepsFromAggregate(agregatComplet())!
    const par = new Map(steps.map((s) => [s.step, s.measure]))

    expect(par.get('brake')!.peakDecelMs2!).toBeLessThan(par.get('coast')!.peakDecelMs2!)
  })

  /**
   * Sans séparation, deux des six étapes n'existent pas. Un étalonnage ne
   * s'applique qu'entier : une seule mesure absente et les bornes proposées
   * amputeraient le signal — c'est ce qui avait figé la vitesse le 4 septembre.
   */
  it('refuse de conclure quand les ralentissements ne se séparent pas', () => {
    expect(stepsFromAggregate(emptyAggregate())).toBeNull()
  })
})

describe('overridesFromAggregate', () => {
  it('produit des réglages depuis un agrégat complet', () => {
    const overrides = overridesFromAggregate(createDefaultProfile(), agregatComplet())

    expect(overrides.length).toBeGreaterThan(0)
    for (const override of overrides) {
      expect(override.path).toBeTruthy()
      expect(override.label).toBeTruthy()
    }
  })

  it('ne propose rien depuis un agrégat vide', () => {
    expect(overridesFromAggregate(createDefaultProfile(), emptyAggregate())).toEqual([])
  })

  /**
   * Les réglages atteignables sont une liste fermée : la mesure ne peut pas
   * toucher au son, seulement à ce que la voiture sait faire.
   */
  it('ne touche qu’aux réglages que l’étalonnage sait atteindre', () => {
    const overrides = overridesFromAggregate(createDefaultProfile(), agregatComplet())

    for (const override of overrides) {
      expect(override.path.startsWith('speed.') || override.path.startsWith('drivetrain.') || override.path.startsWith('mix.')).toBe(true)
    }
  })
})
