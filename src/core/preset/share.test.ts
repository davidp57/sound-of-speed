import { describe, expect, it } from 'vitest'

import { decodeProfile, encodeProfile, isComfortable, isReachableOrigin, shareUrl } from './share'
import { createDefaultProfile, createRoadProfile } from './defaults'
import type { Profile } from './schema'

/**
 * Tests du partage de profil par lien.
 *
 * Le profil voyage dans l'adresse elle-même : ni serveur, ni compte, ni base.
 * Ce qui se vérifie ici est donc l'aller-retour complet — un profil encodé puis
 * décodé doit être le même — et les deux garde-fous qui évitent d'envoyer un
 * lien inutilisable : sa longueur, et son adresse.
 */

describe('encodeProfile et decodeProfile', () => {
  it('fait un aller-retour sans rien perdre, hors identifiant', async () => {
    const original = { ...createRoadProfile(), name: 'Partagé' }
    original.mix.crossfadeLowRpm = 2345

    const relu = await decodeProfile(await encodeProfile(original))

    // L'identifiant est renouvelé : un profil reçu ne doit pas écraser le sien.
    expect(relu.id).not.toBe(original.id)
    expect({ ...relu, id: original.id }).toEqual({ ...original, favorite: false })
  })

  it('ne fait pas voyager le statut de favori', async () => {
    const original = { ...createRoadProfile(), favorite: true }

    const relu = await decodeProfile(await encodeProfile(original))

    // Ce qui est mis en avant chez soi n'a pas à l'être chez le destinataire.
    expect(original.favorite).toBe(true)
    expect(relu.favorite).toBe(false)
  })

  it('conserve les couches, mais pas les échantillons', async () => {
    const original = createDefaultProfile()

    const relu = await decodeProfile(await encodeProfile(original))

    // Seuls les noms de fichiers suivent : le destinataire a déjà la banque.
    expect(relu.layers.map((l) => l.file)).toEqual(original.layers.map((l) => l.file))
    expect(relu.sampleDir).toBe(original.sampleDir)
  })

  it('annonce dans le jeton s’il est compressé ou non', async () => {
    const token = await encodeProfile(createRoadProfile())

    // `c` compressé, `u` brut : le décodage a besoin de le savoir.
    expect(token[0]).toMatch(/^[cu]$/)
  })

  it('produit un jeton sans caractère à réécrire dans une adresse', async () => {
    const token = await encodeProfile(createRoadProfile())

    // Base 64 adaptée aux adresses : les messageries réécrivent `+`, `/` et `=`.
    expect(token.slice(1)).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('refuse un jeton illisible', async () => {
    await expect(decodeProfile('c!!!pas-un-jeton!!!')).rejects.toThrow()
  })

  it('refuse un jeton qui ne contient pas de profil', async () => {
    const sansProfil = `u${btoa(JSON.stringify({ v: 1, autre: true }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')}`

    await expect(decodeProfile(sansProfil)).rejects.toThrow(/profil/i)
  })
})

describe('shareUrl', () => {
  it('place le profil dans le fragment de l’adresse', async () => {
    const url = await shareUrl(createRoadProfile(), 'https://speed.exemple.fr')

    // Le fragment n'est jamais transmis au serveur, ni inscrit dans ses
    // journaux : un profil n'a rien de secret, mais l'habitude est bonne.
    expect(url).toMatch(/^https:\/\/speed\.exemple\.fr\/#p=/)
    const token = url.split('#p=')[1] ?? ''
    expect((await decodeProfile(token)).name).toBe('Route')
  })
})

describe('isComfortable', () => {
  it('accepte un lien de longueur ordinaire', async () => {
    expect(isComfortable(await shareUrl(createRoadProfile(), 'https://speed.exemple.fr'))).toBe(
      true,
    )
  })

  it('refuse un lien devenu trop long', async () => {
    // Un profil chargé de couches finit par produire une adresse difficile à
    // manipuler : mieux vaut le dire avant l'envoi.
    const charge: Profile = {
      ...createDefaultProfile(),
      layers: Array.from({ length: 120 }, (_, index) => ({
        key: `couche-${index}`,
        file: `un-nom-de-fichier-plutot-long-numero-${index}-${'x'.repeat(40)}.wav`,
        role: 'on' as const,
        anchorRpm: 1000 + index * 37,
        gain: 1 + index / 1000,
        minRate: 0.25,
        maxRate: 2,
        enabled: true,
      })),
    }

    expect(isComfortable(await shareUrl(charge, 'https://speed.exemple.fr'))).toBe(false)
  })
})

describe('isReachableOrigin', () => {
  it('refuse une adresse qui ne mène nulle part ailleurs', () => {
    // Un lien produit depuis le poste de développement paraît valide, et l'on
    // ne comprend l'échec qu'une fois le téléphone en main.
    expect(isReachableOrigin('http://localhost:5173')).toBe(false)
    expect(isReachableOrigin('http://127.0.0.1:5173')).toBe(false)
    // Les crochets font partie du nom d'hôte rendu pour une adresse IPv6 :
    // la comparaison les ignore désormais.
    expect(isReachableOrigin('http://[::1]:5173')).toBe(false)
  })

  it('accepte une adresse IPv6 publique', () => {
    expect(isReachableOrigin('http://[2001:db8::1]')).toBe(true)
  })

  it('refuse une adresse de réseau local', () => {
    expect(isReachableOrigin('https://192.168.1.42')).toBe(false)
    expect(isReachableOrigin('https://10.0.0.7')).toBe(false)
    expect(isReachableOrigin('https://172.16.3.9')).toBe(false)
    expect(isReachableOrigin('https://172.31.255.1')).toBe(false)
  })

  it('accepte une adresse publique', () => {
    expect(isReachableOrigin('https://speed.exemple.fr')).toBe(true)
    // 172.32 sort de la plage privée.
    expect(isReachableOrigin('https://172.32.0.1')).toBe(true)
  })

  it('laisse passer ce qu’il ne sait pas lire', () => {
    // Faute de pouvoir trancher, on ne bloque pas l'utilisateur.
    expect(isReachableOrigin('pas une adresse')).toBe(true)
  })
})
