import { describe, expect, it } from 'vitest'
import { captureHealth, type CaptureHealthInput } from './health'

const sain: CaptureHealthInput = {
  capturing: true,
  failure: '',
  journalFailure: '',
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

describe('le journal entre dans le témoin', () => {
  const verdict = (over: Partial<CaptureHealthInput> = {}) => captureHealth({ ...sain, ...over })

  it('passe à l’orange quand seul le journal ne part plus', () => {
    // Il n'avait aucun témoin : le 11 septembre 2026, il s'est répété sept cent
    // vingt-six fois sans que rien ne le dise à l'écran.
    expect(état({ journalFailure: 'network' })).toBe('warn')
  })

  it('dit que c’est le journal, pour qu’on ne cherche pas la capture', () => {
    expect(verdict({ journalFailure: 'network' }).why).toContain('le journal')
    expect(verdict({ failure: 'network' }).why).not.toContain('le journal')
  })

  it('prend le pire des deux dépôts', () => {
    expect(état({ failure: 'network', journalFailure: 'refused' })).toBe('bad')
    expect(état({ failure: 'refused', journalFailure: 'network' })).toBe('bad')
  })

  it('ne nomme pas le journal quand les deux sont en cause', () => {
    // Les deux dépôts passent par le même réseau : le nommer donnerait à croire
    // que la capture, elle, va bien.
    expect(verdict({ failure: 'network', journalFailure: 'network' }).why).not.toContain('le journal')
  })

  it('reste éteint quand rien n’est capturé, même si le journal cloche', () => {
    expect(état({ capturing: false, journalFailure: 'refused' })).toBe('off')
  })
})
