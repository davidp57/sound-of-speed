import { normalize } from 'node:path'

import { describe, expect, it } from 'vitest'

import { cheminSur, plageDemandee, typeDe } from './fichiers'

describe('les types que le navigateur exige', () => {
  it('annonce le binaire du moteur simulé en application/wasm', () => {
    // `instantiateStreaming` **refuse** tout autre type : le moteur simulé ne
    // démarre alors pas du tout, et rien ne dit pourquoi.
    expect(typeDe('/sonde/probe.wasm')).toBe('application/wasm')
  })

  it('annonce son module de façon qu’« import » l’accepte', () => {
    expect(typeDe('/sonde/probe.mjs')).toContain('javascript')
  })

  it('ne devine pas : ce qu’il ne connaît pas sort en octets', () => {
    expect(typeDe('/quelque-chose.inconnu')).toBe('application/octet-stream')
  })
})

describe('un chemin d’URL devient un chemin de fichier', () => {
  it('rend le fichier demandé', () => {
    expect(cheminSur('/racine', '/audio/demo/on-800.flac')).toContain('on-800.flac')
  })

  it('ne laisse jamais sortir du dossier servi', () => {
    // La propriété qui compte n'est pas « refuser », c'est « ne pas sortir ».
    // Une remontée est d'abord **neutralisée** par la normalisation, qui absorbe
    // les « .. » arrivés en tête ; ce qui en ressort reste sous la racine, et le
    // refus n'est que la ceinture pour ce qui passerait au travers.
    //
    // Sans cette propriété, un serveur de fichiers sert la base de données, les
    // clés, et tout ce que le processus peut lire.
    for (const attaque of [
      '/../../etc/passwd',
      '/%2e%2e/%2e%2e/etc/passwd',
      '/audio/../../secret',
      '/audio/..%2f..%2fsecret',
      '/....//....//etc/passwd',
    ]) {
      const obtenu = cheminSur('/racine', attaque)
      if (obtenu === null) continue
      expect(normalize(obtenu).startsWith(normalize('/racine')), attaque).toBe(true)
    }
  })

  it('refuse un octet nul et un encodage impossible', () => {
    expect(cheminSur('/racine', '/fichier%00.txt')).toBeNull()
    expect(cheminSur('/racine', '/%ZZ')).toBeNull()
  })
})

describe('la demande de plage d’octets', () => {
  it('rend la plage demandée', () => {
    expect(plageDemandee('bytes=0-99', 1000)).toEqual({ debut: 0, fin: 99 })
  })

  it('borne une fin au-delà du fichier, plutôt que de refuser', () => {
    // C'est ce que la norme demande, et ce que fait un navigateur qui réclame
    // « à partir d'ici » sans connaître la taille.
    expect(plageDemandee('bytes=900-99999', 1000)).toEqual({ debut: 900, fin: 999 })
  })

  it('comprend une plage comptée depuis la fin', () => {
    expect(plageDemandee('bytes=-100', 1000)).toEqual({ debut: 900, fin: 999 })
  })

  it('refuse une plage qui commence après le fichier', () => {
    // Refuser importe : servir autre chose donnerait au client des octets qu'il
    // n'a pas demandés, et il les croirait à leur place.
    expect(plageDemandee('bytes=2000-', 1000)).toBe('invalide')
    expect(plageDemandee('bytes=500-100', 1000)).toBe('invalide')
  })

  it('laisse servir le fichier entier quand il n’y a rien à honorer', () => {
    expect(plageDemandee(null, 1000)).toBeNull()
    expect(plageDemandee('bytes=0-10, 20-30', 1000)).toBeNull()
    expect(plageDemandee('octets=0-10', 1000)).toBeNull()
  })
})
