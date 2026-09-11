import { beforeEach, describe, expect, it } from 'vitest'

import {
  applyGearbox,
  gearboxFromProfile,
  matchesGearbox,
  profilesUsingGearbox,
  refreshProfilesGearbox,
} from './gearbox-entity'
import {
  factoryGearboxes,
  gearboxFromFile,
  gearboxToFile,
  loadGearboxes,
  removeGearbox,
  saveGearboxes,
  upsertGearbox,
} from './gearbox-store'
import { createDefaultProfile, createRoadProfile } from './defaults'
import { ProfileImportError } from './store'
import type { Profile } from './schema'

/**
 * Tests de la boîte comme entité.
 *
 * Ce qui se vérifie : qu'une boîte emporte sa mécanique et ses gestes, et
 * **rien du moteur**. Le piège est le symétrique de celui du moteur — changer de
 * boîte ne doit pas changer la voix, sans quoi on croirait avoir changé de
 * moteur.
 *
 * Et que les régimes de passage soient **exclus** de la comparaison : ils
 * viennent du rupteur et du mode depuis le ticket 02, et une table qui traîne
 * encore une vieille valeur ne fait pas d'un profil une autre boîte.
 */

function fakeStorage() {
  const entries = new Map<string, string>()
  return {
    getItem: (key: string): string | null => entries.get(key) ?? null,
    setItem: (key: string, value: string): void => void entries.set(key, value),
    removeItem: (key: string): void => void entries.delete(key),
    clear: (): void => entries.clear(),
    key: () => null,
    length: 0,
  }
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    value: fakeStorage(),
    configurable: true,
    writable: true,
  })
})

describe('la boîte extraite d\'un profil', () => {
  it('emporte les rapports, le pont et la façon de passer', () => {
    const profil = createRoadProfile()
    const boite = gearboxFromProfile(profil)

    expect(boite.drivetrain).toEqual(profil.drivetrain)
    expect(boite.kickdown).toEqual(profil.feel.kickdown)
    expect(boite.shiftJolt).toEqual(profil.feel.shiftJolt)
  })

  it('ne prend ni le moteur, ni le mixage, ni les pétarades', () => {
    const boite = gearboxFromProfile(createRoadProfile()) as unknown as Record<string, unknown>
    expect(boite.engine).toBeUndefined()
    expect(boite.mix).toBeUndefined()
    expect(boite.layers).toBeUndefined()
    expect(boite.backfire).toBeUndefined()
  })

  it('recopie plutôt que de partager', () => {
    const profil = createRoadProfile()
    const boite = gearboxFromProfile(profil)
    boite.drivetrain.finalDrive = 9
    boite.shiftJolt.clack = 0.99
    expect(profil.drivetrain.finalDrive).not.toBe(9)
    expect(profil.feel.shiftJolt.clack).not.toBe(0.99)
  })
})

describe('appliquer une boîte à un profil', () => {
  it('pose ses valeurs et note laquelle', () => {
    const cible = createRoadProfile()
    const boite = gearboxFromProfile(createDefaultProfile(), 'Sport')

    const applique = applyGearbox(cible, boite)

    expect(applique.gearboxId).toBe(boite.id)
    expect(applique.drivetrain.finalDrive).toBe(boite.drivetrain.finalDrive)
    expect(applique.feel.shiftJolt).toEqual(boite.shiftJolt)
  })

  it('ne change pas la voix : ni moteur, ni banque, ni mixage', () => {
    // Le symétrique du piège du moteur. Sans ce verrou, changer de boîte
    // changerait le son et l'on croirait avoir changé de moteur.
    const cible = createRoadProfile()
    const applique = applyGearbox(cible, gearboxFromProfile(createDefaultProfile(), 'Sport'))

    expect(applique.engine).toEqual(cible.engine)
    expect(applique.mix).toEqual(cible.mix)
    expect(applique.layers).toEqual(cible.layers)
    expect(applique.sampleDir).toBe(cible.sampleDir)
  })

  it('garde les pétarades du profil : elles suivent le moteur', () => {
    const cible = createRoadProfile()
    const applique = applyGearbox(cible, gearboxFromProfile(createDefaultProfile(), 'Sport'))
    expect(applique.feel.backfire).toEqual(cible.feel.backfire)
  })

  it('ne change pas les réglages de mesure ni le nom', () => {
    const cible: Profile = { ...createRoadProfile(), favorite: true }
    const applique = applyGearbox(cible, gearboxFromProfile(createDefaultProfile(), 'Sport'))
    expect(applique.speed).toEqual(cible.speed)
    expect(applique.name).toBe('Route')
    expect(applique.favorite).toBe(true)
  })
})

describe('savoir si un profil joue encore sa boîte', () => {
  it('reconnaît un profil qui vient de la charger', () => {
    const boite = gearboxFromProfile(createDefaultProfile(), 'Sport')
    expect(matchesGearbox(applyGearbox(createRoadProfile(), boite), boite)).toBe(true)
  })

  it('voit un pont changé', () => {
    const boite = gearboxFromProfile(createDefaultProfile(), 'Sport')
    const affine = applyGearbox(createRoadProfile(), boite)
    affine.drivetrain.finalDrive += 0.5
    expect(matchesGearbox(affine, boite)).toBe(false)
  })

  it('voit un rapport ajouté', () => {
    const boite = gearboxFromProfile(createDefaultProfile(), 'Sport')
    const affine = applyGearbox(createRoadProfile(), boite)
    affine.drivetrain.gearRatios = [...affine.drivetrain.gearRatios, 0.6]
    expect(matchesGearbox(affine, boite)).toBe(false)
  })

  it('ignore les régimes de passage, qui ne viennent plus de la boîte', () => {
    // Ils se déduisent du rupteur et du mode depuis le ticket 02 : une table qui
    // traîne encore une vieille valeur ne fait pas une autre boîte.
    const boite = gearboxFromProfile(createDefaultProfile(), 'Sport')
    const applique = applyGearbox(createRoadProfile(), boite)
    applique.drivetrain.upshiftRpm = [1, 2, 3, 4, 5]
    expect(matchesGearbox(applique, boite)).toBe(true)
  })
})

describe('la correction d\'une boîte se répercute', () => {
  it('touche les profils qui la désignent, et eux seuls', () => {
    const boite = gearboxFromProfile(createDefaultProfile(), 'Sport')
    const designant = applyGearbox({ ...createRoadProfile(), id: 'a' }, boite)
    const autre = { ...createRoadProfile(), id: 'b' }

    const corrigee = {
      ...boite,
      drivetrain: { ...boite.drivetrain, shiftTimeMs: 999 },
    }
    const [premier, second] = refreshProfilesGearbox([designant, autre], corrigee)

    expect(premier?.drivetrain.shiftTimeMs).toBe(999)
    expect(second?.drivetrain.shiftTimeMs).toBe(autre.drivetrain.shiftTimeMs)
  })

  it('liste les profils qui désignent une boîte', () => {
    const boite = gearboxFromProfile(createDefaultProfile(), 'Sport')
    const a = applyGearbox({ ...createRoadProfile(), id: 'a' }, boite)
    const c = { ...createRoadProfile(), id: 'c' }
    expect(profilesUsingGearbox([a, c], boite.id).map((p) => p.id)).toEqual(['a'])
  })
})

describe('le registre des boîtes', () => {
  it('livre une boîte par profil d\'usine', () => {
    // Un seul profil livré depuis le 10 septembre 2026 — le V8 —, donc une
    // seule boîte livrée.
    expect(factoryGearboxes().map((b) => b.name)).toEqual(['V8'])
  })

  it('livre le calibrage de la route : pont long, sept rapports', () => {
    const livree = factoryGearboxes()[0]!
    expect(livree.drivetrain.finalDrive).toBe(3.7)
    // Sept depuis la sortie du 11 septembre 2026, la septième étant un rapport
    // d'autoroute : 130 km/h à 1508 tr/min.
    expect(livree.drivetrain.gearRatios).toHaveLength(7)
  })

  it("rend la livrée quand rien n'est enregistré", () => {
    expect(loadGearboxes()).toHaveLength(1)
  })

  it('remplace une livrée qu\'on a corrigée, au lieu d\'en montrer deux', () => {
    const livree = factoryGearboxes()[0]!
    saveGearboxes(upsertGearbox(factoryGearboxes(), { ...livree, name: 'V8 long' }))

    const noms = loadGearboxes().map((b) => b.name)
    expect(noms).toContain('V8 long')
    expect(noms).not.toContain('V8')
    expect(loadGearboxes()).toHaveLength(1)
  })

  it('retire une boîte', () => {
    const mienne = { ...gearboxFromProfile(createRoadProfile(), 'La mienne'), id: 'x' }
    const avec = upsertGearbox(factoryGearboxes(), mienne)
    expect(removeGearbox(avec, 'x').map((b) => b.name)).not.toContain('La mienne')
  })

  it('survit à un stockage illisible', () => {
    localStorage.setItem('speed.gearboxes.v1', 'pas du json')
    expect(loadGearboxes()).toHaveLength(1)
  })

  it('écarte une entrée qui n\'est pas une boîte', () => {
    localStorage.setItem('speed.gearboxes.v1', JSON.stringify([{ name: 'sans rapports' }]))
    expect(loadGearboxes()).toHaveLength(1)
  })
})

describe('une boîte dans un fichier', () => {
  it('fait l\'aller-retour sans rien perdre', () => {
    const mienne = gearboxFromProfile(createRoadProfile(), 'La mienne')
    const relue = gearboxFromFile(gearboxToFile(mienne), () => 'neuf')

    expect(relue.name).toBe('La mienne')
    expect(relue.drivetrain).toEqual(mienne.drivetrain)
    expect(relue.shiftJolt).toEqual(mienne.shiftJolt)
  })

  it('reçoit un identifiant neuf', () => {
    const mienne = gearboxFromProfile(createRoadProfile(), 'La mienne')
    expect(gearboxFromFile(gearboxToFile(mienne), () => 'neuf').id).toBe('neuf')
  })

  it('accepte une boîte écrite sans son enveloppe', () => {
    const mienne = gearboxFromProfile(createRoadProfile(), 'La mienne')
    expect(gearboxFromFile(JSON.stringify(mienne), () => 'x').name).toBe('La mienne')
  })

  it('refuse un fichier qui ne décrit pas une boîte', () => {
    expect(() => gearboxFromFile('{"version":1,"gearbox":{"name":"vide"}}', () => 'x')).toThrow(
      ProfileImportError,
    )
  })
})

describe('la reprise des boîtes enregistrées', () => {
  /**
   * La boîte de David vit dans le stockage local du téléphone, pas dans le
   * code : sans cette reprise, changer les valeurs livrées ne se verrait pas
   * dans sa voiture.
   */
  it('donne sa septième à une boîte de route enregistrée à six rapports', () => {
    const livree = factoryGearboxes()[0]!
    const ancienne = {
      ...livree,
      id: 'boite-de-david',
      name: 'V8',
      drivetrain: {
        ...livree.drivetrain,
        gearRatios: [3.55, 2.04, 1.36, 1.03, 0.86, 0.72],
        upshiftRpm: [3700, 3350, 3050, 2950, 2950],
        shiftDelaysS: [0.3, 0.55, 0.4, 0.6, 0.35, 0.5],
      },
    }

    saveGearboxes([ancienne])
    const relue = loadGearboxes().find((boite) => boite.id === 'boite-de-david')

    expect(relue?.drivetrain.gearRatios).toHaveLength(7)
    expect(relue?.drivetrain.upshiftRpm).toHaveLength(6)
    expect(relue?.drivetrain.shiftDelaysS).toHaveLength(7)
  })

  it('laisse à six rapports une boîte qu’on a réglée', () => {
    const livree = factoryGearboxes()[0]!
    const reglee = {
      ...livree,
      id: 'sur-mesure',
      drivetrain: { ...livree.drivetrain, gearRatios: [3.2, 1.9, 1.3, 1.0, 0.8, 0.66] },
    }

    saveGearboxes([reglee])

    expect(
      loadGearboxes().find((boite) => boite.id === 'sur-mesure')?.drivetrain.gearRatios,
    ).toHaveLength(6)
  })
})
