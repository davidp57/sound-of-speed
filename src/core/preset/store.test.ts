import { beforeEach, describe, expect, it } from 'vitest'

import {
  ProfileImportError,
  deepCopy,
  duplicateProfile,
  fromFile,
  loadProfiles,
  loadSelectedId,
  loadTraces,
  missingFactoryProfiles,
  newId,
  resetProfileSection,
  saveProfiles,
  saveSelectedId,
  saveTraces,
  toFile,
  tracesFromFile,
  tracesToFile,
} from './store'
import { createDefaultProfile, createFactoryProfiles, createRoadProfile } from './defaults'
import { buildProfile } from './wizard'
import { decodeProfile, encodeProfile } from './share'
import { PROFILE_FORMAT_VERSION, type Profile } from './schema'

/**
 * Tests de la persistance des profils.
 *
 * C'est le seul endroit du projet où une régression coûte des données à
 * l'utilisateur, et pas seulement un son faux : un profil réglé à l'oreille
 * pendant des semaines ne doit pas disparaître à une mise à jour.
 *
 * Le stockage local est remplacé par un objet en mémoire — quelques lignes,
 * plutôt qu'un navigateur simulé tout entier. On peut ainsi aussi le faire
 * échouer à volonté, ce qu'aucun navigateur ne permet de commander.
 */

/** Faux stockage local, avec la possibilité de le faire échouer. */
function fakeStorage(options: { failWrites?: boolean; failReads?: boolean } = {}) {
  const entries = new Map<string, string>()
  return {
    getItem(key: string): string | null {
      if (options.failReads) throw new Error('lecture refusée')
      return entries.get(key) ?? null
    },
    setItem(key: string, value: string): void {
      if (options.failWrites) throw new Error('quota dépassé')
      entries.set(key, value)
    },
    removeItem(key: string): void {
      entries.delete(key)
    },
    clear(): void {
      entries.clear()
    },
    key: () => null,
    length: 0,
  }
}

function install(storage: ReturnType<typeof fakeStorage>): void {
  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    configurable: true,
    writable: true,
  })
}

beforeEach(() => {
  install(fakeStorage())
})

describe('loadProfiles', () => {
  it('rend les profils d’usine quand le stockage est vide', () => {
    const profiles = loadProfiles()

    expect(profiles.map((p) => p.id)).toEqual(['route', 'procar'])
  })

  it('rend les profils d’usine quand le stockage est illisible', () => {
    install(fakeStorage({ failReads: true }))

    expect(loadProfiles().map((p) => p.id)).toEqual(['route', 'procar'])
  })

  it('relit un profil enregistré à l’identique', () => {
    const original = { ...createRoadProfile(), name: 'Mon réglage', id: 'mien' }
    original.engine.redlineRpm = 5900
    original.drivetrain.upshiftRpm = [3100, 3200, 3300, 3400, 3500]

    saveProfiles([original])
    const [relu] = loadProfiles()

    expect(relu).toEqual(original)
  })

  it('n’interrompt rien quand l’écriture échoue', () => {
    install(fakeStorage({ failWrites: true }))

    // Navigation privée, quota plein : la conduite continue.
    expect(() => saveProfiles([createDefaultProfile()])).not.toThrow()
    expect(() => saveSelectedId('procar')).not.toThrow()
  })
})

describe('profil sélectionné', () => {
  it('se retient d’une session à l’autre', () => {
    saveSelectedId('route')

    expect(loadSelectedId()).toBe('route')
  })

  it('vaut null quand rien n’a été choisi', () => {
    expect(loadSelectedId()).toBeNull()
  })
})

describe('reconciliation', () => {
  it('complète un champ manquant par sa valeur d’usine', () => {
    const base = createDefaultProfile()
    // Un profil amputé, comme en écrirait une version antérieure : on passe par
    // un enregistrement libre, puisque le type complet interdit justement de
    // retirer un champ obligatoire.
    const ampute = deepCopy(base) as unknown as Record<string, Record<string, unknown>>
    delete ampute['engine']!['redlineRpm']
    delete ampute['speed']

    saveProfiles([ampute as unknown as Profile])
    const [relu] = loadProfiles()

    expect(relu?.engine.redlineRpm).toBe(base.engine.redlineRpm)
    expect(relu?.speed).toEqual(base.speed)
    // Et ce qui était présent est conservé.
    expect(relu?.engine.idleRpm).toBe(base.engine.idleRpm)
  })

  it('garde les couches enregistrées plutôt que celles d’usine', () => {
    const profile = createDefaultProfile()
    profile.layers = [
      {
        key: 'mienne',
        file: 'a-moi.wav',
        role: 'on',
        anchorRpm: 4321,
        gain: 0.8,
        minRate: 0.3,
        maxRate: 1.8,
        enabled: true,
      },
    ]

    saveProfiles([profile])

    expect(loadProfiles()[0]?.layers).toEqual(profile.layers)
  })

  it('élargit vers le grave les couches restées à l’ancienne borne', () => {
    // La borne valait 0,5, ce qui rendait la prise haut régime injouable sous
    // la moitié de son ancrage. Un profil ancien doit en profiter.
    const profile = createDefaultProfile()
    profile.layers = profile.layers.map((l) => ({ ...l, minRate: 0.5 }))

    saveProfiles([profile])

    for (const layer of loadProfiles()[0]?.layers ?? []) {
      expect(layer.minRate).toBe(0.25)
    }
  })

  it('ne touche pas à une borne basse choisie exprès', () => {
    const profile = createDefaultProfile()
    profile.layers = profile.layers.map((l) => ({ ...l, minRate: 0.6 }))

    saveProfiles([profile])

    for (const layer of loadProfiles()[0]?.layers ?? []) {
      expect(layer.minRate).toBe(0.6)
    }
  })
})

describe('reprise d’une transmission ancienne', () => {
  it('convertit les deux anciennes fractions en table par rapport', () => {
    // Avant, deux fractions du rupteur valaient pour tous les rapports. On les
    // convertit plutôt que de les perdre : un profil réglé à l'oreille ne doit
    // pas être remis à zéro par une mise à jour.
    const base = createDefaultProfile()
    const ancien = deepCopy(base) as unknown as Record<string, Record<string, unknown>>
    delete ancien['drivetrain']!['upshiftRpm']
    ancien['drivetrain']!['upshiftAtRedlineRatio'] = 0.8
    ancien['drivetrain']!['upshiftAtLowLoadRatio'] = 0.4

    saveProfiles([ancien as unknown as Profile])
    const relu = loadProfiles()[0]

    const redline = base.engine.redlineRpm
    // Le seuil à mi-charge devient la référence, identique pour tous les
    // rapports : c'était exactement le comportement d'avant.
    const attendu = Math.round(redline * 0.6)
    expect(relu?.drivetrain.upshiftRpm).toEqual([attendu, attendu, attendu, attendu, attendu])
    // Et l'écart entre les deux fractions devient l'écart selon la charge.
    expect(relu?.drivetrain.upshiftLoadSpreadRpm).toBe(Math.round(redline * 0.4))
  })

  it('garde la table quand elle est déjà là', () => {
    const profile = createDefaultProfile()
    profile.drivetrain.upshiftRpm = [1111, 2222, 3333, 4444, 5555]

    saveProfiles([profile])

    expect(loadProfiles()[0]?.drivetrain.upshiftRpm).toEqual([1111, 2222, 3333, 4444, 5555])
  })
})

describe('export et import de fichier', () => {
  it('fait un aller-retour sans rien perdre, hors identifiant', () => {
    const original = { ...createRoadProfile(), name: 'Essai routier' }
    original.mix.masterGain = 0.42

    const relu = fromFile(toFile(original))

    // L'identifiant est renouvelé exprès : un profil importé ne doit pas
    // écraser celui qui porte le même identifiant.
    expect(relu.id).not.toBe(original.id)
    expect({ ...relu, id: original.id }).toEqual(original)
  })

  it('écrit un fichier lisible, avec sa version de format', () => {
    const parsed: unknown = JSON.parse(toFile(createDefaultProfile()))

    expect(parsed).toMatchObject({ version: PROFILE_FORMAT_VERSION })
    // Indenté : le fichier se modifie à la main, c'est une promesse du module.
    expect(toFile(createDefaultProfile())).toContain('\n  ')
  })

  it('accepte un profil nu, sans enveloppe de version', () => {
    const profile = createRoadProfile()

    const relu = fromFile(JSON.stringify(profile))

    expect(relu.name).toBe(profile.name)
    expect(relu.engine.redlineRpm).toBe(profile.engine.redlineRpm)
  })

  it('complète un fichier incomplet au lieu de le refuser', () => {
    const base = createDefaultProfile()

    const relu = fromFile(JSON.stringify({ profile: { name: 'Presque vide' } }))

    expect(relu.name).toBe('Presque vide')
    expect(relu.engine).toEqual(base.engine)
    expect(relu.layers).toEqual(base.layers)
  })

  it('refuse un fichier qui n’est pas du JSON', () => {
    expect(() => fromFile('ceci n’est pas un profil')).toThrow(ProfileImportError)
  })

  it('refuse un fichier vide ou mal formé', () => {
    expect(() => fromFile('null')).toThrow(ProfileImportError)
    expect(() => fromFile('"une chaîne"')).toThrow(ProfileImportError)
  })
})

describe('réinitialisation par section', () => {
  it('ramène une section à l’usine sans toucher aux autres', () => {
    const profile = createRoadProfile()
    profile.name = 'Mon réglage'
    profile.engine.redlineRpm = 4200
    profile.mix.masterGain = 0.1

    const remis = resetProfileSection(profile, 'engine')

    expect(remis.engine).toEqual(createRoadProfile().engine)
    // Le reste est intact, identifiant et nom compris.
    expect(remis.mix.masterGain).toBe(0.1)
    expect(remis.id).toBe(profile.id)
    expect(remis.name).toBe('Mon réglage')
  })

  it('ramène tout le profil sans perdre son identité', () => {
    const profile = createRoadProfile()
    profile.name = 'Mon réglage'
    profile.engine.redlineRpm = 4200
    profile.mix.masterGain = 0.1

    const remis = resetProfileSection(profile, 'all')

    expect(remis.engine).toEqual(createRoadProfile().engine)
    expect(remis.mix).toEqual(createRoadProfile().mix)
    expect(remis.id).toBe(profile.id)
    expect(remis.name).toBe('Mon réglage')
  })

  it('part des valeurs génériques pour un profil créé de toutes pièces', () => {
    const profile = { ...createDefaultProfile(), id: 'inconnu-de-lusine', name: 'Bricolé' }
    profile.engine.redlineRpm = 3000

    const remis = resetProfileSection(profile, 'engine')

    expect(remis.engine).toEqual(createDefaultProfile().engine)
  })

  it('ne partage aucune référence avec le profil d’usine', () => {
    const remis = resetProfileSection(createRoadProfile(), 'drivetrain')
    remis.drivetrain.gearRatios.push(0.5)

    expect(createRoadProfile().drivetrain.gearRatios).toHaveLength(6)
  })
})

describe('profils d’usine et duplication', () => {
  it('repère un profil livré absent de la liste', () => {
    const manquants = missingFactoryProfiles([createRoadProfile()])

    expect(manquants.map((p) => p.id)).toEqual(['procar'])
  })

  it('n’en repère aucun quand ils sont tous là', () => {
    expect(missingFactoryProfiles(createFactoryProfiles())).toHaveLength(0)
  })

  it('duplique un profil avec un identifiant neuf', () => {
    const original = createRoadProfile()

    const copie = duplicateProfile(original, 'Copie')

    expect(copie.id).not.toBe(original.id)
    expect(copie.name).toBe('Copie')
    // Tout est repris, à l'identité près — et à l'origine près, que la copie
    // gagne : voir « valeurs d'origine » plus bas.
    const { origin, ...reste } = copie
    expect(origin).toBeDefined()
    expect({ ...reste, id: original.id, name: original.name }).toEqual(original)
  })

  it('duplique en profondeur, sans lien avec l’original', () => {
    const original = createRoadProfile()
    const copie = duplicateProfile(original, 'Copie')

    copie.drivetrain.upshiftRpm[0] = 9999
    copie.layers[0]!.gain = 0.01

    expect(original.drivetrain.upshiftRpm[0]).not.toBe(9999)
    expect(original.layers[0]?.gain).not.toBe(0.01)
  })

  it('produit des identifiants distincts', () => {
    const ids = new Set(Array.from({ length: 200 }, () => newId()))

    expect(ids.size).toBe(200)
  })
})

describe('traces', () => {
  it('conserve une trace d’une session à l’autre', () => {
    const trace = {
      name: 'Tour du lac',
      startedAt: 1_700_000_000_000,
      samples: [{ kmh: 12, at: 1000, accuracyM: 5, derived: false }],
    }

    expect(saveTraces([trace])).toBe(true)
    expect(loadTraces()).toEqual([trace])
  })

  it('signale un échec d’écriture au lieu de le taire', () => {
    install(fakeStorage({ failWrites: true }))

    // Les traces longues pèsent lourd : mieux vaut le dire que laisser croire
    // que l'enregistrement est conservé.
    expect(saveTraces([{ name: 'Longue', startedAt: 0, samples: [] }])).toBe(false)
  })

  it('écarte ce qui n’est pas une trace', () => {
    saveTraces([
      { name: 'Bonne', startedAt: 0, samples: [] },
      { pas: 'une trace' },
      null,
    ] as never)

    expect(loadTraces()).toEqual([{ name: 'Bonne', startedAt: 0, samples: [] }])
  })

  it('fait un aller-retour par fichier', () => {
    const traces = [
      {
        name: 'Aller',
        startedAt: 1_700_000_000_000,
        samples: [{ kmh: 30, at: 0, accuracyM: null, derived: true }],
      },
    ]

    expect(tracesFromFile(tracesToFile(traces))).toEqual(traces)
  })

  it('accepte un fichier qui n’est qu’un tableau de traces', () => {
    const traces = [{ name: 'Nue', startedAt: 0, samples: [] }]

    expect(tracesFromFile(JSON.stringify(traces))).toEqual(traces)
  })

  it('refuse un fichier de traces inexploitable', () => {
    expect(() => tracesFromFile('pas du json')).toThrow(ProfileImportError)
    expect(() => tracesFromFile('{"traces":[]}')).toThrow(ProfileImportError)
    expect(() => tracesFromFile('{"autre":1}')).toThrow(ProfileImportError)
  })
})

describe('valeurs d’origine', () => {
  it('ramène un profil du guide à ce qu’il était, et non au profil Sport', () => {
    // Le défaut : `factoryOrigin` reconnaissait un profil à son identifiant et
    // retombait sur les valeurs par défaut — celles de Sport — pour tous les
    // autres. Réinitialiser une section d'un profil fabriqué rendait donc les
    // réglages d'un profil qu'on n'avait jamais choisi.
    const fabrique = buildProfile(
      { name: 'Mien', temperament: 'calme', usage: 'ville', gearCount: 5, engine: 'diesel' },
      createDefaultProfile(),
    )
    const ancien = deepCopy(fabrique.engine)

    const tatonne = { ...fabrique, engine: { ...fabrique.engine, redlineRpm: 3000 } }
    const remis = resetProfileSection(tatonne, 'engine')

    expect(remis.engine).toEqual(ancien)
    // Et surtout : pas les valeurs de Sport.
    expect(remis.engine.redlineRpm).not.toBe(createDefaultProfile().engine.redlineRpm)
  })

  it('garde son origine après réinitialisation, pour pouvoir y revenir encore', () => {
    const fabrique = buildProfile(
      { name: 'Mien', temperament: 'sportif', usage: 'route', gearCount: 6, engine: 'essence' },
      createDefaultProfile(),
    )

    const remis = resetProfileSection(
      { ...fabrique, mix: { ...fabrique.mix, masterGain: 0.05 } },
      'all',
    )

    expect(remis.origin).toEqual(fabrique.origin)
    expect(remis.mix).toEqual(fabrique.mix)
  })

  it('ne réinitialise pas l’identité', () => {
    const fabrique = buildProfile(
      { name: 'Mien', temperament: 'equilibre', usage: 'route', gearCount: 6, engine: 'essence' },
      createDefaultProfile(),
    )
    const modifie = { ...fabrique, name: 'Renommé', favorite: true }

    const remis = resetProfileSection(modifie, 'all')

    expect(remis.id).toBe(fabrique.id)
    expect(remis.name).toBe('Renommé')
    expect(remis.favorite).toBe(true)
  })

  it('donne une origine à une duplication, héritée ou relevée', () => {
    // Une duplication d'un profil livré prend ses valeurs du moment comme
    // origine : avant, elle revenait à celles de Sport.
    const copieDeRoute = duplicateProfile(createRoadProfile(), 'Ma Route')
    expect(copieDeRoute.origin?.engine).toEqual(createRoadProfile().engine)

    // Une duplication d'un profil fabriqué hérite de l'origine de son modèle.
    const fabrique = buildProfile(
      { name: 'Mien', temperament: 'calme', usage: 'ville', gearCount: 4, engine: 'diesel' },
      createDefaultProfile(),
    )
    const copie = duplicateProfile({ ...fabrique, mix: { ...fabrique.mix, drive: 0.9 } }, 'Copie')
    expect(copie.origin).toEqual(fabrique.origin)
  })

  it('ne partage pas l’origine dans un lien, mais la garde dans un fichier', async () => {
    const fabrique = buildProfile(
      { name: 'Mien', temperament: 'sportif', usage: 'autoroute', gearCount: 6, engine: 'sportif' },
      createDefaultProfile(),
    )

    // Le fichier garde tout : la taille n'y importe pas.
    expect(fromFile(toFile(fabrique)).origin).toEqual(fabrique.origin)

    // Le lien, non : il doublerait de longueur, et le destinataire n'a que
    // faire de l'état initial d'un profil qui n'est pas le sien.
    const recu = await decodeProfile(await encodeProfile(fabrique))
    expect(recu.origin).toBeUndefined()
  })

  it('laisse les profils livrés se retrouver par leur identifiant', () => {
    // Ils n'ont pas d'origine enregistrée, et n'en ont pas besoin.
    for (const livre of createFactoryProfiles()) {
      expect(livre.origin).toBeUndefined()
      const remis = resetProfileSection({ ...livre, mix: { ...livre.mix, masterGain: 9 } }, 'mix')
      expect(remis.mix).toEqual(livre.mix)
    }
  })

  it('garde le repli d’avant pour un profil sans origine', () => {
    // Un profil venu d'une version antérieure n'a pas d'origine : on ne lui en
    // invente pas une, et il retombe sur le comportement documenté d'avant.
    const ancien = { ...createDefaultProfile(), id: 'venu-d-avant', name: 'Ancien' }
    delete (ancien as Partial<Profile>).origin

    const remis = resetProfileSection({ ...ancien, speed: { ...ancien.speed, springOmega: 1 } }, 'speed')

    expect(remis.speed).toEqual(createDefaultProfile().speed)
  })

  it('relit une origine enregistrée', () => {
    const fabrique = buildProfile(
      { name: 'Mien', temperament: 'calme', usage: 'route', gearCount: 6, engine: 'essence' },
      createDefaultProfile(),
    )

    saveProfiles([fabrique])

    expect(loadProfiles()[0]?.origin).toEqual(fabrique.origin)
  })
})
