import { describe, expect, it } from 'vitest'

import { createFactoryProfiles, createGmLsProfile, createSubaruEj25Profile } from './defaults'
import { reprendreDuServeur } from './reprise-serveur'
import type { Profile } from './schema'

/**
 * Reprendre les profils du serveur.
 *
 * Le geste que David a demandé le 17 septembre 2026 : un bouton qui efface les
 * profils de l'appareil et prend ceux du serveur à la place. Ce qui se vérifie
 * ici est qu'il **remplace** — l'ancien bouton de la bibliothèque, lui,
 * dupliquait, et c'est tout le défaut qu'on corrige.
 */

let compteur = 0
const newId = () => `id-${(compteur += 1)}`

/** Un profil du serveur : le même identifiant qu'ici, un réglage différent. */
function duServeur(base: Profile, over: Partial<Profile['engine']> = {}): Profile {
  return { ...base, engine: { ...base.engine, ...over } }
}

describe('reprendreDuServeur', () => {
  it('ne laisse jamais deux profils du même identifiant', () => {
    const local = createGmLsProfile()
    const distant = duServeur(local, { redlineRpm: 7777 })

    const reprise = reprendreDuServeur([distant], createFactoryProfiles(), [], [], newId)

    const parId = reprise.profiles.filter((profil) => profil.id === local.id)
    expect(parId).toHaveLength(1)
    // Et c'est la version du serveur qui reste : c'est lui qui fait foi.
    expect(parId[0]?.engine.redlineRpm).toBe(7777)
  })

  it('remplace ce que l’appareil portait au lieu de s’y ajouter', () => {
    // Les profils de l'appareil ne sont pas même passés en entrée : la liste
    // rendue ne part que du serveur et de l'usine. C'est ce qui distingue ce
    // geste de l'ancien « Ajouter ».
    const distant = duServeur(createSubaruEj25Profile(), { redlineRpm: 6111 })

    const reprise = reprendreDuServeur([distant], [], [], [], newId)

    expect(reprise.profiles).toHaveLength(1)
    expect(reprise.repris).toBe(1)
    expect(reprise.completes).toBe(0)
  })

  it('réintroduit les profils d’usine que le serveur ne porte pas', () => {
    const usine = createFactoryProfiles()
    const distant = duServeur(createGmLsProfile(), { redlineRpm: 7777 })

    const reprise = reprendreDuServeur([distant], usine, [], [], newId)

    expect(reprise.repris).toBe(1)
    expect(reprise.completes).toBe(usine.length - 1)
    expect(reprise.profiles).toHaveLength(usine.length)
    // Celui du serveur n'est pas recouvert par son homonyme d'usine.
    expect(reprise.profiles.find((p) => p.id === distant.id)?.engine.redlineRpm).toBe(7777)
  })

  it('écarte les doublons du dossier, et les compte', () => {
    const premier = duServeur(createGmLsProfile(), { redlineRpm: 7000 })
    const second = duServeur(createGmLsProfile(), { redlineRpm: 8000 })

    const reprise = reprendreDuServeur([premier, second], [], [], [], newId)

    expect(reprise.profiles).toHaveLength(1)
    expect(reprise.ecartes).toBe(1)
    // Le premier listé gagne, faute de date pour départager.
    expect(reprise.profiles[0]?.engine.redlineRpm).toBe(7000)
  })

  it('rattache chaque profil repris à un moteur et à une boîte', () => {
    const distant = duServeur(createGmLsProfile(), { redlineRpm: 7777 })

    const reprise = reprendreDuServeur([distant], [], [], [], newId)

    for (const profil of reprise.profiles) {
      expect(reprise.engines.some((moteur) => moteur.id === profil.engineId)).toBe(true)
      expect(reprise.gearboxes.some((boite) => boite.id === profil.gearboxId)).toBe(true)
    }
  })

  it('réutilise les moteurs de l’appareil plutôt que d’en empiler des copies', () => {
    // Les moteurs et les boîtes survivent au remplacement — supprimer un profil
    // ne les a jamais emportés. Reprendre deux fois de suite ne doit donc pas
    // faire grossir la liste des moteurs.
    const distant = duServeur(createGmLsProfile(), { redlineRpm: 7777 })

    const une = reprendreDuServeur([distant], [], [], [], newId)
    const deux = reprendreDuServeur([distant], [], une.engines, une.gearboxes, newId)

    expect(deux.engines).toHaveLength(une.engines.length)
    expect(deux.gearboxes).toHaveLength(une.gearboxes.length)
  })

  it('rend une liste vide quand le serveur et l’usine n’ont rien', () => {
    // L'appelant s'en sert pour refuser d'effacer : un serveur muet, hors réseau
    // ou sans compte rend une liste vide, et une liste vide ne veut pas dire
    // « efface tout ».
    const reprise = reprendreDuServeur([], [], [], [], newId)

    expect(reprise.profiles).toEqual([])
    expect(reprise.repris).toBe(0)
  })
})
