import { describe, expect, it } from 'vitest'
import { captureHealth, type CaptureHealthInput } from './health'

const sain: CaptureHealthInput = {
  capturing: true,
  failure: '',
  gpsActive: true,
  rejecting: false,
}

const état = (over: Partial<CaptureHealthInput> = {}) => captureHealth({ ...sain, ...over }).state

describe('le témoin de session', () => {
  it('est vert quand la capture tourne et que tout part', () => {
    expect(état()).toBe('ok')
  })

  it('est absent quand rien n’est capturé', () => {
    // Un rouge permanent pour un choix délibéré est une alarme qu'on apprend à
    // ignorer, et le jour où elle compte on ne la voit plus.
    expect(état({ capturing: false })).toBe('off')
  })

  it('est orange quand le réseau manque, parce que rien n’est perdu', () => {
    expect(état({ failure: 'network' })).toBe('warn')
  })

  it('est orange quand le GPS rejette ses positions', () => {
    expect(état({ rejecting: true })).toBe('warn')
  })

  it('est rouge quand le compte est refusé, même si tout le reste va bien', () => {
    expect(état({ failure: 'refused' })).toBe('bad')
  })

  it('est rouge quand aucun compte n’est réglé', () => {
    expect(état({ failure: 'no-credentials' })).toBe('bad')
  })

  it('est rouge quand le GPS ne livre plus rien', () => {
    expect(état({ gpsActive: false })).toBe('bad')
  })

  it('montre le pire des états quand plusieurs soucis se cumulent', () => {
    expect(état({ failure: 'refused', rejecting: true })).toBe('bad')
    expect(état({ gpsActive: false, failure: 'network' })).toBe('bad')
  })

  it('dit en toutes lettres ce que la couleur résume', () => {
    for (const cas of [
      {},
      { capturing: false },
      { failure: 'network' as const },
      { failure: 'refused' as const },
      { gpsActive: false },
      { rejecting: true },
    ]) {
      expect(captureHealth({ ...sain, ...cas }).why.length).toBeGreaterThan(20)
    }
  })
})
