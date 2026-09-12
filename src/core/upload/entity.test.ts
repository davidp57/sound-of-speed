import { describe, expect, it } from 'vitest'

import { entityFileName, entityUploadId, ENGINE_FOLDER, GEARBOX_FOLDER } from './entity'
import { profileFileName } from './profile'
import { createRoadProfile } from '../preset/defaults'

/**
 * Ce qui se vérifie : le nom d'un moteur est lisible et stable, il ne bouge pas
 * d'un dépôt à l'autre, et deux moteurs du même nom ne se recouvrent pas.
 */

describe('le moteur ou la boîte qui remonte', () => {
  it('porte un nom lisible et stable', () => {
    const nom = entityFileName({ id: 'e-123456abcdef', name: 'V8 — atmo' })
    expect(nom).toBe('v8-atmo-abcdef.json')
    expect(entityFileName({ id: 'e-123456abcdef', name: 'V8 — atmo' })).toBe(nom)
  })

  it('ne répète pas un identifiant qui est déjà le nom', () => {
    expect(entityFileName({ id: 'v8', name: 'V8' })).toBe('v8.json')
  })

  it('distingue deux moteurs de même nom', () => {
    expect(entityFileName({ id: 'aaaaaa', name: 'V8' })).not.toBe(
      entityFileName({ id: 'bbbbbb', name: 'V8' }),
    )
  })

  it('garde le même identifiant de dépôt pour un moteur retouché', () => {
    expect(entityUploadId(ENGINE_FOLDER, { id: 'e-1', name: 'avant' })).toBe(
      entityUploadId(ENGINE_FOLDER, { id: 'e-1', name: 'après' })
    )
  })

  it('ne confond pas un moteur et une boîte de même identifiant', () => {
    // Les deux registres sont servis séparément : un identifiant de dépôt commun
    // ferait qu'un envoi en attente écraserait l'autre dans la file.
    expect(entityUploadId(ENGINE_FOLDER, { id: 'x', name: 'x' })).not.toBe(
      entityUploadId(GEARBOX_FOLDER, { id: 'x', name: 'x' }),
    )
  })

  it('nomme un profil comme avant, malgré la règle partagée', () => {
    // La règle a quitté le module des profils pour être tenue à un seul endroit.
    // Ce cas est là pour que le déplacement n'ait rien changé au passage.
    const profil = { ...createRoadProfile(), id: 'p-123456abcdef', name: 'Route — été' }
    expect(profileFileName(profil)).toBe('route-ete-abcdef.json')
  })
})
