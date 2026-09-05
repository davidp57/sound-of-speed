import { describe, expect, it } from 'vitest'

import { clampSynthSettings, DEFAULT_SYNTH, needsRebuild } from './settings'

describe('clampSynthSettings', () => {
  it('garde les valeurs par défaut telles quelles', () => {
    expect(clampSynthSettings(DEFAULT_SYNTH)).toEqual(DEFAULT_SYNTH)
  })

  it('ramène un nombre de cylindres inconnu au V8', () => {
    const out = clampSynthSettings({ ...DEFAULT_SYNTH, cylinders: 6 as 4 | 8 })
    expect(out.cylinders).toBe(8)
  })

  it('empêche un papillon inversé, qui rendrait l’effort silencieux', () => {
    const out = clampSynthSettings({ ...DEFAULT_SYNTH, throttleIdle: 0.8, throttleFull: 0.2 })
    expect(out.throttleFull).toBe(0.8)
  })

  it('rejette une valeur non finie sur la borne basse', () => {
    const out = clampSynthSettings({ ...DEFAULT_SYNTH, volume: Number.NaN })
    expect(out.volume).toBe(0)
  })

  it('borne la réserve et la taille de bloc', () => {
    const out = clampSynthSettings({ ...DEFAULT_SYNTH, reserveMs: 5000, blockFrames: 1 })
    expect(out.reserveMs).toBe(1000)
    expect(out.blockFrames).toBe(128)
  })
})

describe('needsRebuild', () => {
  it('reconstruit quand le moteur change', () => {
    expect(needsRebuild(DEFAULT_SYNTH, { ...DEFAULT_SYNTH, cylinders: 4 })).toBe(true)
  })

  it('reconstruit quand la fréquence de simulation change', () => {
    expect(needsRebuild(DEFAULT_SYNTH, { ...DEFAULT_SYNTH, simulationHz: 12000 })).toBe(true)
  })

  it('ne reconstruit pas pour le papillon, le volume ni la réverbération', () => {
    const next = {
      ...DEFAULT_SYNTH,
      throttleIdle: 0.2,
      throttleFull: 0.7,
      volume: 0.4,
      reserveMs: 400,
      convolverMix: 0.9,
    }
    expect(needsRebuild(DEFAULT_SYNTH, next)).toBe(false)
  })
})
