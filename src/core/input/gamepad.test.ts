import { describe, expect, it } from 'vitest'

import {
  AXIS_LEFT_Y,
  BUTTON,
  GamepadReader,
  STICK_DEADZONE,
  TRIGGER_DEADZONE,
  VOLUME_PER_S,
  type PadSnapshot,
} from './gamepad'

/**
 * Ce que ces tests tiennent : les gâchettes rendent bien zéro au repos, une
 * bascule ne se déclenche qu'une fois par appui, et une manette qui disparaît
 * ne laisse pas le simulateur accélérer tout seul.
 */

function pad(overrides: { buttons?: Record<number, number>; axes?: Record<number, number> } = {}) {
  const buttons = new Array<number>(16).fill(0)
  const axes = new Array<number>(4).fill(0)
  for (const [index, value] of Object.entries(overrides.buttons ?? {})) {
    buttons[Number(index)] = value
  }
  for (const [index, value] of Object.entries(overrides.axes ?? {})) {
    axes[Number(index)] = value
  }
  return { buttons, axes } satisfies PadSnapshot
}

const DT = 1 / 60

describe('GamepadReader — gâchettes', () => {
  it('rend zéro au repos, zone morte comprise', () => {
    const reader = new GamepadReader()

    const idle = reader.read(pad(), DT)
    const creeping = reader.read(
      pad({ buttons: { [BUTTON.rightTrigger]: TRIGGER_DEADZONE * 0.9 } }),
      DT,
    )

    expect(idle.throttle).toBe(0)
    expect(idle.brake).toBe(0)
    expect(creeping.throttle).toBe(0)
  })

  it('redresse la course pour garder le plein gaz atteignable', () => {
    // Retirer la zone morte sans redresser plafonnerait l'accélérateur juste en
    // dessous de un : le simulateur n'atteindrait jamais sa poussée maximale.
    const reader = new GamepadReader()

    const full = reader.read(pad({ buttons: { [BUTTON.rightTrigger]: 1 } }), DT)
    const half = reader.read(
      pad({ buttons: { [BUTTON.rightTrigger]: TRIGGER_DEADZONE + (1 - TRIGGER_DEADZONE) / 2 } }),
      DT,
    )

    expect(full.throttle).toBe(1)
    expect(half.throttle).toBeCloseTo(0.5, 6)
  })

  it('sépare accélérateur et frein', () => {
    const reader = new GamepadReader()

    const both = reader.read(
      pad({ buttons: { [BUTTON.rightTrigger]: 0.8, [BUTTON.leftTrigger]: 0.4 } }),
      DT,
    )

    expect(both.throttle).toBeGreaterThan(0.7)
    expect(both.brake).toBeGreaterThan(0.3)
  })
})

describe('GamepadReader — boutons', () => {
  it('ne passe qu un rapport par appui, même maintenu', () => {
    const reader = new GamepadReader()
    const pressing = pad({ buttons: { [BUTTON.a]: 1 } })

    const first = reader.read(pressing, DT)
    const held = [0, 1, 2].map(() => reader.read(pressing, DT))

    expect(first.shiftUp).toBe(true)
    expect(held.every((intent) => intent.shiftUp)).toBe(false)
  })

  it('repasse un rapport après relâchement', () => {
    const reader = new GamepadReader()
    reader.read(pad({ buttons: { [BUTTON.a]: 1 } }), DT)
    reader.read(pad(), DT)

    expect(reader.read(pad({ buttons: { [BUTTON.a]: 1 } }), DT).shiftUp).toBe(true)
  })

  it('donne à chaque bouton son intention', () => {
    const reader = new GamepadReader()

    const down = reader.read(pad({ buttons: { [BUTTON.b]: 1 } }), DT)
    reader.read(pad(), DT)
    const mode = reader.read(pad({ buttons: { [BUTTON.x]: 1 } }), DT)
    reader.read(pad(), DT)
    const cruise = reader.read(pad({ buttons: { [BUTTON.y]: 1 } }), DT)

    expect(down.shiftDown).toBe(true)
    expect(mode.toggleMode).toBe(true)
    expect(cruise.toggleCruise).toBe(true)
  })
})

describe('GamepadReader — volume', () => {
  it('monte le volume quand le stick va vers le haut', () => {
    // Le navigateur annonce l'axe vertical négatif vers le haut.
    const reader = new GamepadReader()

    const up = reader.read(pad({ axes: { [AXIS_LEFT_Y]: -1 } }), DT)
    const down = reader.read(pad({ axes: { [AXIS_LEFT_Y]: 1 } }), DT)

    expect(up.volumeDelta).toBeCloseTo(VOLUME_PER_S * DT, 6)
    expect(down.volumeDelta).toBeCloseTo(-VOLUME_PER_S * DT, 6)
  })

  it('ignore un stick qui ne revient pas tout à fait au centre', () => {
    const reader = new GamepadReader()

    const drifting = reader.read(pad({ axes: { [AXIS_LEFT_Y]: STICK_DEADZONE * 0.9 } }), DT)

    expect(drifting.volumeDelta).toBe(0)
  })

  it('parcourt la course en deux secondes, quelle que soit la cadence', () => {
    // Le pas dépend du temps écoulé et non de l'image : à 30 comme à 120 images
    // par seconde, le volume met le même temps à traverser.
    const reader = new GamepadReader()
    const stick = pad({ axes: { [AXIS_LEFT_Y]: -1 } })

    let slow = 0
    for (let i = 0; i < 30; i += 1) slow += reader.read(stick, 1 / 30).volumeDelta
    let fast = 0
    for (let i = 0; i < 120; i += 1) fast += reader.read(stick, 1 / 120).volumeDelta

    expect(slow).toBeCloseTo(VOLUME_PER_S, 6)
    expect(fast).toBeCloseTo(VOLUME_PER_S, 6)
  })
})

describe('GamepadReader — manette absente', () => {
  it('rend le repos, et non le dernier état connu', () => {
    // Une manette débranchée en pleine accélération laisserait sinon la gâchette
    // enfoncée pour toujours.
    const reader = new GamepadReader()
    reader.read(pad({ buttons: { [BUTTON.rightTrigger]: 1 } }), DT)

    const gone = reader.read(null, DT)

    expect(gone.throttle).toBe(0)
    expect(gone.volumeDelta).toBe(0)
  })

  it('repart d un état propre au rebranchement', () => {
    // L'appui en cours est oublié avec le reste : au retour, le bouton enfoncé
    // compte pour un appui neuf plutôt que d'attendre un relâchement qu'on n'a
    // pas vu.
    const reader = new GamepadReader()
    reader.read(pad({ buttons: { [BUTTON.a]: 1 } }), DT)
    reader.read(null, DT)

    const back = reader.read(pad({ buttons: { [BUTTON.a]: 1 } }), DT)

    expect(back.shiftUp).toBe(true)
  })
})
