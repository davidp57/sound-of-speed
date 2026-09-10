import { describe, expect, it } from 'vitest'

import { splitProfiles } from './split'
import { createDefaultProfile, createRoadProfile, createV8Profile } from './defaults'
import { engineFromProfile } from './engine-entity'
import { gearboxFromProfile } from './gearbox-entity'

/**
 * Tests de la reprise des profils en groupes.
 *
 * Ce qui se vérifie : qu'aucun profil ne reste sans moteur ni boîte — sinon il
 * jouerait des valeurs que plus rien n'édite —, et qu'un moteur déjà connu soit
 * reconnu au lieu d'être recopié. Le second point est celui qui se voit : cinq
 * profils tirés du V8 donneraient cinq V8 dans la liste.
 */

let compteur = 0
const newId = (): string => `neuf-${(compteur += 1)}`

describe('la reprise des profils', () => {
  it('donne un moteur et une boîte à chaque profil', () => {
    const { profiles } = splitProfiles([createRoadProfile()], [], [], newId)
    expect(profiles[0]?.engineId).toBeTruthy()
    expect(profiles[0]?.gearboxId).toBeTruthy()
  })

  it('reconnaît un moteur déjà enregistré plutôt que d\'en créer un deuxième', () => {
    const v8 = createV8Profile()
    const moteur = engineFromProfile(v8)
    const boite = gearboxFromProfile(v8)

    const { profiles, engines, gearboxes } = splitProfiles([v8], [moteur], [boite], newId)

    expect(engines).toHaveLength(1)
    expect(gearboxes).toHaveLength(1)
    expect(profiles[0]?.engineId).toBe(moteur.id)
    expect(profiles[0]?.gearboxId).toBe(boite.id)
  })

  it('ne fabrique qu\'un moteur pour cinq profils identiques', () => {
    // Le cas courant : on duplique un profil pour essayer autre chose, puis on
    // ne change que la boîte. Le moteur reste le même — et corriger un ancrage
    // de couche ne doit pas devenir un travail à faire cinq fois.
    const copies = Array.from({ length: 5 }, (_, i) => ({
      ...createV8Profile(),
      id: `copie-${i}`,
      name: `Copie ${i}`,
    }))

    const { engines } = splitProfiles(copies, [], [], newId)

    expect(engines).toHaveLength(1)
  })

  it('sépare en revanche deux moteurs qui ne sonnent pas pareil', () => {
    const { engines } = splitProfiles(
      [createRoadProfile(), createDefaultProfile()],
      [],
      [],
      newId,
    )
    expect(engines).toHaveLength(2)
  })

  it('laisse tel quel un profil qui désigne déjà : la reprise ne se refait pas', () => {
    const premier = splitProfiles([createRoadProfile()], [], [], newId)
    const second = splitProfiles(premier.profiles, premier.engines, premier.gearboxes, newId)

    expect(second.engines).toHaveLength(premier.engines.length)
    expect(second.gearboxes).toHaveLength(premier.gearboxes.length)
    expect(second.profiles[0]?.engineId).toBe(premier.profiles[0]?.engineId)
  })

  it('ne défait pas un rattachement choisi à la main', () => {
    // Un profil qui désigne un moteur dont il ne joue plus tout à fait les
    // valeurs le désigne quand même : c'est un choix, pas un accident.
    const autre = engineFromProfile(createDefaultProfile())
    const profil = { ...createRoadProfile(), engineId: autre.id }

    const { profiles, engines } = splitProfiles([profil], [autre], [], newId)

    expect(profiles[0]?.engineId).toBe(autre.id)
    expect(engines).toHaveLength(1)
  })

  it('rend un moteur d’ici à un profil reçu qui désigne celui d’ailleurs', () => {
    // Le partage : la référence ne mène à rien ici, mais le profil arrive avec
    // ses valeurs. Sans ce rattrapage il jouerait bien et ne se réglerait plus.
    const recu = { ...createV8Profile(), engineId: 'chez-quelqu-un-d-autre' }
    const { profiles, engines } = splitProfiles([recu], [], [], newId)

    expect(profiles[0]?.engineId).not.toBe('chez-quelqu-un-d-autre')
    expect(engines).toHaveLength(1)
  })

  it('évite deux entités sous le même identifiant', () => {
    // Un profil dupliqué garde son nom mais pas son identifiant ; rien
    // n'interdit non plus qu'un fichier importé arrive avec un identifiant
    // déjà pris. Le doublon rendrait l'une des deux entités inatteignable.
    const dejaPris = engineFromProfile(createDefaultProfile())
    const profil = { ...createRoadProfile(), id: dejaPris.id }

    const { profiles, engines } = splitProfiles([profil], [dejaPris], [], newId)

    expect(profiles[0]?.engineId).not.toBe(dejaPris.id)
    expect(new Set(engines.map((moteur) => moteur.id)).size).toBe(engines.length)
  })
})
