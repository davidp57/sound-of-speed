import { describe, expect, it } from 'vitest'

import { clampSynthSettings, DEFAULT_SYNTH, needsRebuild } from './settings'

describe('clampSynthSettings', () => {
  it('garde le silencieux dans une plage qui s’entend', () => {
    // Au-dessus de 22 kHz le filtre ne retire plus rien d'audible. Le plancher
    // est bas exprès : le premier réglage jugé correct à l'oreille était à
    // 500 Hz, et il faut pouvoir descendre en dessous de ce qu'on croit juste.
    expect(clampSynthSettings({ ...DEFAULT_SYNTH, mufflerHz: 10 }).mufflerHz).toBe(120)
    expect(clampSynthSettings({ ...DEFAULT_SYNTH, mufflerHz: 96000 }).mufflerHz).toBe(22000)
    expect(clampSynthSettings({ ...DEFAULT_SYNTH, mufflerHz: Number.NaN }).mufflerHz).toBe(120)
  })

  it('règle le silencieux sans reconstruire le moteur', () => {
    // C'est un nœud de Web Audio, pas un paramètre du modèle : le tourner en
    // écoutant ne doit pas couper le son une seconde à chaque cran.
    expect(needsRebuild(DEFAULT_SYNTH, { ...DEFAULT_SYNTH, mufflerHz: 1200 })).toBe(false)
  })

  it('garde les valeurs par défaut telles quelles', () => {
    expect(clampSynthSettings(DEFAULT_SYNTH)).toEqual(DEFAULT_SYNTH)
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

  it('borne la crête visée par le niveleur', () => {
    // Le plafond dur d'engine-sim est à 32 767 : au-dessus, plus de marge du
    // tout et l'écrêtage constaté par David redevient systématique.
    expect(clampSynthSettings({ ...DEFAULT_SYNTH, levelerTarget: 500 }).levelerTarget).toBe(1000)
    expect(clampSynthSettings({ ...DEFAULT_SYNTH, levelerTarget: 40000 }).levelerTarget).toBe(
      32000,
    )
  })
})

describe('needsRebuild', () => {
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

  it('ne reconstruit pas pour la crête du niveleur, elle est hot', () => {
    // `synth_set_leveler_target` l'écrit à chaud, contrairement aux deux bornes
    // de gain : la régler ne coupe plus le son une seconde.
    expect(needsRebuild(DEFAULT_SYNTH, { ...DEFAULT_SYNTH, levelerTarget: 8000 })).toBe(false)
  })
})

describe('le bruit qui délisse le régime', () => {
  it('accepte de le couper, et borne son amplitude', () => {
    // Zéro est un réglage à part entière : c'est le comportement d'avant, un
    // vilebrequin qui tourne à vitesse rigoureusement constante.
    expect(clampSynthSettings({ ...DEFAULT_SYNTH, rippleRpm: 0 }).rippleRpm).toBe(0)
    expect(clampSynthSettings({ ...DEFAULT_SYNTH, rippleRpm: -5 }).rippleRpm).toBe(0)
    expect(clampSynthSettings({ ...DEFAULT_SYNTH, rippleRpm: 500 }).rippleRpm).toBe(120)
  })

  it('ne laisse pas la dérive tomber à zéro hertz', () => {
    // À zéro le filtre ne laisserait plus rien passer, et le réglage
    // d'amplitude annoncerait des tours qu'il ne produit pas.
    expect(clampSynthSettings({ ...DEFAULT_SYNTH, rippleHz: 0 }).rippleHz).toBe(0.5)
    expect(clampSynthSettings({ ...DEFAULT_SYNTH, rippleHz: 9000 }).rippleHz).toBe(200)
  })

  it('s’écrit à chaud, sans rebâtir le moteur', () => {
    // Le moteur se rebâtit en une seconde de silence : un réglage qu'on cherche
    // à l'oreille ne peut pas le payer à chaque mouvement du curseur.
    expect(needsRebuild(DEFAULT_SYNTH, { ...DEFAULT_SYNTH, rippleRpm: 40 })).toBe(false)
    expect(needsRebuild(DEFAULT_SYNTH, { ...DEFAULT_SYNTH, rippleHz: 40 })).toBe(false)
  })
})
