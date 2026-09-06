import { describe, expect, it } from 'vitest'

import { profileBody, profileFileName, profileUploadId } from './profile'
import { fromFile } from '../preset/store'
import { createRoadProfile } from '../preset/defaults'
import type { Profile } from '../preset/schema'

/**
 * Tests du profil qui remonte.
 *
 * Ce qui se vérifie : le fichier se relit à l'identique, le favori ne voyage
 * pas, et le nom reste le même d'un dépôt à l'autre — sans quoi la bibliothèque
 * accumulerait une copie par curseur déplacé.
 */

function profile(extra: Partial<Profile> = {}): Profile {
  return { ...createRoadProfile(), id: 'p-123456abcdef', favorite: true, ...extra }
}

describe('le profil qui remonte', () => {
  it('porte un nom lisible et stable', () => {
    const name = profileFileName(profile({ name: 'Route — été' }))
    expect(name).toBe('route-ete-abcdef.json')
    expect(profileFileName(profile({ name: 'Route — été' }))).toBe(name)
  })

  it('ne répète pas un identifiant qui est déjà le nom', () => {
    // Les profils d'usine s'appellent « route », « procar » : leur fichier
    // s'appelait « route-route.json ».
    expect(profileFileName(profile({ id: 'route', name: 'Route' }))).toBe('route.json')
  })

  it('distingue deux profils de même nom', () => {
    expect(profileFileName(profile({ id: 'aaaaaa' }))).not.toBe(
      profileFileName(profile({ id: 'bbbbbb' })),
    )
  })

  it('ne fait pas voyager le favori', () => {
    expect(fromFile(profileBody(profile({ favorite: true }))).favorite).toBe(false)
  })

  it('se relit avec ses réglages', () => {
    const original = profile()
    const relu = fromFile(profileBody(original))
    expect(relu.name).toBe(original.name)
    expect(relu.engine).toEqual(original.engine)
    expect(relu.drivetrain).toEqual(original.drivetrain)
  })

  it('garde le même identifiant de dépôt pour un profil retouché', () => {
    expect(profileUploadId(profile({ name: 'avant' }))).toBe(
      profileUploadId(profile({ name: 'après' })),
    )
  })
})
