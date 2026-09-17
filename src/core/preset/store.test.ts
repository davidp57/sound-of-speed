import { beforeEach, describe, expect, it } from 'vitest'

import {
  ProfileImportError,
  deepCopy,
  duplicateProfile,
  fromFile,
  loadAdvancedMode,
  loadInheritedVolume,
  loadMasterVolume,
  loadProfiles,
  loadSelectedId,
  loadTraces,
  missingFactoryProfiles,
  newId,
  resetProfileSection,
  saveAdvancedMode,
  saveMasterVolume,
  saveProfiles,
  saveSelectedId,
  saveTraces,
  toFile,
  tracesToFile,
} from './store'
import {
  createDefaultProfile,
  createFactoryProfiles,
  createRoadProfile,
  createV8Profile,
  GM_LS_V8,
  SUBARU_EJ25,
} from './defaults'
import { buildProfile } from './wizard'
import { decodeProfile, encodeProfile } from './share'
import {
  PROFILE_FORMAT_VERSION,
  SOUND_SOURCES,
  needsSimulatedEngine,
  soundSourceOf,
  type Profile,
} from './schema'

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

    // Deux profils livrés : la démonstration, dont la banque vient avec
    // l'application, et le V8, dont la banque se dépose sur le serveur. La
    // démonstration est première, donc c'est elle qui sonne au premier
    // lancement de quelqu'un qui n'a encore rien déposé.
    expect(profiles.map((p) => p.id)).toEqual(['gm-ls', 'gm-ls-long-header', 'bmw-i6-3l', 'subaru-ej25'])
  })

  it('rend les profils d’usine quand le stockage est illisible', () => {
    install(fakeStorage({ failReads: true }))

    expect(loadProfiles().map((p) => p.id)).toEqual(['gm-ls', 'gm-ls-long-header', 'bmw-i6-3l', 'subaru-ej25'])
  })

  it('relit un profil enregistré à l’identique', () => {
    const original = { ...createRoadProfile(), name: 'Mon réglage', id: 'mien' }
    original.engine.redlineRpm = 5900
    original.drivetrain.upshiftRpm = [3100, 3200, 3300, 3400, 3500]

    saveProfiles([original])
    const [relu] = loadProfiles()

    expect(relu).toEqual(original)
  })

  it('rend un rendu complet à un profil enregistré avant la version 6', () => {
    // Le son du moteur simulé vivait dans les réglages du banc, en mémoire :
    // aucun profil enregistré avant cette version n'en porte.
    const ancien = { ...createRoadProfile(), id: 'ancien' } as Record<string, unknown>
    delete ancien.rendering
    saveProfiles([ancien as unknown as Profile])

    const relu = loadProfiles()[0]
    expect(relu?.rendering).toEqual(createRoadProfile().rendering)
  })

  it('borne un rendu venu d’une main', () => {
    const bricole = { ...createRoadProfile(), id: 'bricole' } as Record<string, unknown>
    bricole.rendering = { volume: 99, convolverMix: -1, levelerTarget: 'beaucoup' }
    saveProfiles([bricole as unknown as Profile])

    const relu = loadProfiles()[0]
    // Le volume a quitté le rendu : celui qu'un profil ancien porte encore est
    // ignoré, et ne ressort pas.
    expect(relu?.rendering).not.toHaveProperty('volume')
    expect(relu?.rendering?.convolverMix).toBe(0)
    // Une valeur qui n'est pas un nombre retombe sur la borne basse plutôt que
    // de propager un NaN jusque dans le graphe audio, où il fait taire la
    // sortie sans rien dire.
    expect(relu?.rendering?.levelerTarget).toBe(1000)
  })

  it('n’interrompt rien quand l’écriture échoue', () => {
    install(fakeStorage({ failWrites: true }))

    // Navigation privée, quota plein : la conduite continue.
    expect(() => saveProfiles([createDefaultProfile()])).not.toThrow()
    expect(() => saveSelectedId('v8-musclecar')).not.toThrow()
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
    const base = createV8Profile()
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
    original.mix.drive = 0.42

    const relu = fromFile(toFile(original))

    // L'identifiant est renouvelé exprès : un profil importé ne doit pas
    // écraser celui qui porte le même identifiant.
    expect(relu.id).not.toBe(original.id)
    expect({ ...relu, id: original.id }).toEqual(original)
  })

  it('peut garder son identifiant, quand c’est le mien qui redescend', () => {
    // Un profil qui revient de sa propre base est le même profil : un
    // identifiant neuf en ferait un double à chaque démarrage, et son prochain
    // dépôt un second fichier sur le serveur.
    const original = { ...createRoadProfile(), name: 'Essai routier' }

    expect(fromFile(toFile(original), (origine) => origine ?? 'sans').id).toBe(original.id)
  })

  it('sait quoi faire d’un fichier écrit à la main, sans identifiant', () => {
    const relu = fromFile('{"name":"À la main"}', (origine) => origine ?? 'de-repli')

    expect(relu.id).toBe('de-repli')
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
    // Un fichier sans identifiant connu se complète avec le repli générique,
    // qui est le V8 depuis le 10 septembre 2026 et non plus Sport.
    const base = createV8Profile()

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
    profile.mix.drive = 0.1

    const remis = resetProfileSection(profile, 'engine')

    expect(remis.engine).toEqual(createRoadProfile().engine)
    // Le reste est intact, identifiant et nom compris.
    expect(remis.mix.drive).toBe(0.1)
    expect(remis.id).toBe(profile.id)
    expect(remis.name).toBe('Mon réglage')
  })

  it('ramène tout le profil sans perdre son identité', () => {
    const profile = createRoadProfile()
    profile.name = 'Mon réglage'
    profile.engine.redlineRpm = 4200
    profile.mix.drive = 0.1

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

    // Le repli générique est le V8 depuis le 10 septembre 2026 : un profil dont
    // aucun calibrage connu ne porte l'identifiant retombe sur lui, et non plus
    // sur Sport.
    expect(remis.engine).toEqual(createV8Profile().engine)
  })

  it('ne partage aucune référence avec le profil d’usine', () => {
    const remis = resetProfileSection(createRoadProfile(), 'drivetrain')
    remis.drivetrain.gearRatios.push(0.5)

    expect(createRoadProfile().drivetrain.gearRatios).toHaveLength(7)
  })

  it('remet la banque en même temps que les couches', () => {
    const usine = createDefaultProfile()
    const ailleurs = {
      ...usine,
      sampleDir: 'une-autre-banque',
      layers: usine.layers.map((couche) => ({ ...couche, file: 'inconnu.wav' })),
    }

    const remis = resetProfileSection(ailleurs, 'layers')

    // Des noms de fichiers d'usine dans un autre dossier ne joueraient rien.
    expect(remis.sampleDir).toBe(usine.sampleDir)
    expect(remis.layers).toEqual(usine.layers)
  })

  it('ne touche pas à la banque quand on réinitialise une autre section', () => {
    const ailleurs = { ...createDefaultProfile(), sampleDir: 'une-autre-banque' }

    expect(resetProfileSection(ailleurs, 'engine').sampleDir).toBe('une-autre-banque')
  })
})

describe('les profils d’usine d’une banque déposée', () => {
  // Un profil réglé sur une banque déposée ne part pas avec l'application : ses
  // échantillons sont une prise sur une vraie voiture. Mais chez qui a la
  // banque, il doit exister — sinon il faudrait le ressaisir couche par couche.
  it('ne se propose pas quand le serveur ne liste pas sa banque', () => {
    const manquants = missingFactoryProfiles([], [])

    expect(manquants.map((p) => p.id)).toEqual(['gm-ls', 'gm-ls-long-header', 'bmw-i6-3l', 'subaru-ej25'])
  })

  it('se propose quand la banque est là', () => {
    const manquants = missingFactoryProfiles([], ['v8-musclecar'])

    expect(manquants.map((p) => p.id)).toEqual([
      'gm-ls',
      'gm-ls-long-header',
      'bmw-i6-3l',
      'subaru-ej25',
      'v8',
    ])
    expect(manquants.find((p) => p.id === 'v8')?.sampleDir).toBe('v8-musclecar')
  })

  it('ne le propose pas deux fois', () => {
    const deja = missingFactoryProfiles([], ['v8-musclecar'])

    expect(missingFactoryProfiles(deja, ['v8-musclecar'])).toEqual([])
  })

  it('ignore une banque listée qu’aucun profil d’usine ne réclame', () => {
    // Une banque déposée sans profil connu ne fabrique rien : on ne devine pas
    // les ancrages ni les gains d'échantillons qu'on n'a jamais mesurés.
    const manquants = missingFactoryProfiles([], ['une-banque-a-nous'])

    expect(manquants.map((p) => p.id)).toEqual(['gm-ls', 'gm-ls-long-header', 'bmw-i6-3l', 'subaru-ej25'])
  })
})

describe('profils d’usine et duplication', () => {
  it('repère un profil livré absent de la liste', () => {
    const manquants = missingFactoryProfiles([createRoadProfile()])

    expect(manquants.map((p) => p.id)).toEqual(['gm-ls', 'gm-ls-long-header', 'bmw-i6-3l', 'subaru-ej25'])
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

  it('produit des identifiants distincts, même tirés d’affilée', () => {
    // Deux cents identifiants tombent dans la même milliseconde : seul le hasard
    // les distingue. Le test rougissait une fois sur cinq mille cinq cents avec
    // cinq caractères ; il en faut dix pour qu'il cesse d'être un tirage.
    const ids = new Set(Array.from({ length: 5000 }, () => newId()))

    expect(ids.size).toBe(5000)
  })

  it('donne toujours un suffixe de la même longueur', () => {
    // `Math.random().toString(36)` rend parfois trop peu de décimales, et le
    // suffixe raccourcissait sans prévenir : mesuré entre sept et dix caractères
    // sur deux cent mille tirages. Ce qui décide de l'unicité ne doit pas varier.
    const longueurs = new Set(
      Array.from({ length: 2000 }, () => newId().split('-')[2]?.length),
    )

    expect([...longueurs]).toEqual([10])
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

  it('sérialise une trace dans un fichier relisible', () => {
    const traces = [
      {
        name: 'Aller',
        startedAt: 1_700_000_000_000,
        samples: [{ kmh: 30, at: 0, accuracyM: null, derived: true }],
      },
    ]

    expect(JSON.parse(tracesToFile(traces))).toEqual({ version: 1, traces })
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
      { ...fabrique, mix: { ...fabrique.mix, drive: 0.05 } },
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
      const remis = resetProfileSection({ ...livre, mix: { ...livre.mix, drive: 0.9 } }, 'mix')
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

describe('mode avancé', () => {
  it('s ouvre sur la vue courte quand rien n a été choisi', () => {
    // Le mode simplifié est le défaut : c'est tout l'objet de la bascule.
    expect(loadAdvancedMode()).toBe(false)
  })

  it('se retient d une session à l autre, dans les deux sens', () => {
    saveAdvancedMode(true)
    expect(loadAdvancedMode()).toBe(true)

    saveAdvancedMode(false)
    expect(loadAdvancedMode()).toBe(false)
  })

  it('ne fait pas partie du profil, donc ne voyage pas', () => {
    saveAdvancedMode(true)

    // Le profil exporté ne porte rien du mode : c'est une préférence de
    // l'appareil, comme le volume général.
    expect(toFile(createRoadProfile())).not.toContain('advanced')
    expect(loadProfiles().some((p) => 'advancedMode' in p)).toBe(false)
  })

  it('survit à un stockage qui refuse d écrire ou de lire', () => {
    install(fakeStorage({ failWrites: true }))
    expect(() => saveAdvancedMode(true)).not.toThrow()

    install(fakeStorage({ failReads: true }))
    expect(loadAdvancedMode()).toBe(false)
  })
})

describe('volume général', () => {
  it('se retient d une session à l autre', () => {
    saveMasterVolume(0.42)

    expect(loadMasterVolume()).toBe(0.42)
  })

  it('dit qu il n a rien à dire plutôt que d inventer une valeur', () => {
    // Le repli n'appartient pas au stockage : c'est à l'appelant de reprendre
    // le volume du profil actif, une fois, à la première ouverture. Rendre un
    // nombre ici priverait la reprise de son signal.
    expect(loadMasterVolume()).toBeNull()
  })

  it('écarte une valeur illisible', () => {
    localStorage.setItem('speed.masterVolume.v1', 'beaucoup')

    expect(loadMasterVolume()).toBeNull()
  })

  it('écarte une valeur négative', () => {
    saveMasterVolume(-3)

    expect(loadMasterVolume()).toBeNull()
  })

  it('survit à un stockage qui refuse d écrire', () => {
    install(fakeStorage({ failWrites: true }))

    expect(() => saveMasterVolume(0.5)).not.toThrow()
  })

  it('ne fait plus partie du profil enregistré', () => {
    // Un profil de la version précédente porte le champ. Il a servi une fois à
    // initialiser la préférence d'appareil ; il est ensuite retiré, sans quoi le
    // schéma mentirait à qui le lit.
    const ancien = { ...createRoadProfile() } as Profile & { mix: { masterGain?: number } }
    ancien.mix = { ...ancien.mix, masterGain: 0.33 }
    saveProfiles([ancien as Profile])

    const relu = loadProfiles()[0] as Profile & { mix: { masterGain?: number } }

    expect(relu.mix.masterGain).toBeUndefined()
    // Le reste du mixage est intact : on ne retire que ce champ.
    expect(relu.mix.drive).toBe(createRoadProfile().mix.drive)
  })

  it('ne voyage ni par fichier ni par lien', async () => {
    const original = { ...createRoadProfile() } as Profile & { mix: { masterGain?: number } }
    original.mix = { ...original.mix, masterGain: 0.33 }

    const parFichier = fromFile(toFile(original as Profile)) as Profile & {
      mix: { masterGain?: number }
    }
    const parLien = (await decodeProfile(await encodeProfile(original as Profile))) as Profile & {
      mix: { masterGain?: number }
    }

    expect(parFichier.mix.masterGain).toBeUndefined()
    expect(parLien.mix.masterGain).toBeUndefined()
  })
})

describe('reprise du volume hérité', () => {
  it('lit le volume du profil actif dans le stockage brut', () => {
    // Le point délicat, et il a été manqué une première fois : charger les
    // profils les nettoie de ce champ. Une reprise qui passerait par la liste
    // chargée trouverait donc toujours un profil déjà nettoyé, et perdrait en
    // silence le niveau réglé par l'utilisateur. La lecture se fait sur le JSON.
    const ancien = { ...createRoadProfile() } as Profile & { mix: { masterGain?: number } }
    ancien.mix = { ...ancien.mix, masterGain: 0.33 }
    const autre = { ...createDefaultProfile() } as Profile & { mix: { masterGain?: number } }
    autre.mix = { ...autre.mix, masterGain: 0.9 }
    saveProfiles([autre as Profile, ancien as Profile])

    expect(loadInheritedVolume('route')).toBe(0.33)
    expect(loadInheritedVolume('v8-musclecar')).toBe(0.9)
  })

  it('retombe sur le premier profil quand l identifiant est inconnu', () => {
    const ancien = { ...createRoadProfile() } as Profile & { mix: { masterGain?: number } }
    ancien.mix = { ...ancien.mix, masterGain: 0.25 }
    saveProfiles([ancien as Profile])

    expect(loadInheritedVolume('disparu')).toBe(0.25)
  })

  it('dit qu il n y a rien à reprendre sur un appareil neuf', () => {
    expect(loadInheritedVolume('route')).toBeNull()
  })

  it('dit qu il n y a rien à reprendre quand le profil est déjà au format courant', () => {
    saveProfiles([createRoadProfile()])

    expect(loadInheritedVolume('route')).toBeNull()
  })
})

describe('reprise par identifiant', () => {
  it('complète un profil Route avec les valeurs de Route, non celles de Sport', () => {
    // Le défaut corrigé : la base de complétion était le profil Sport pour tout
    // le monde. Un champ ajouté au schéma arrivait donc dans le Route de
    // l'utilisateur avec la valeur de Sport, et les essais sur route portaient
    // sur des valeurs que personne n'avait choisies.
    //
    // On simule un profil Route enregistré par une version antérieure : il porte
    // son identité et une seule section, les autres manquent.
    const partiel = { id: 'route', name: 'Route', sampleDir: 'v8-musclecar' }
    saveProfiles([partiel as unknown as Profile])

    const relu = loadProfiles()[0] as Profile
    const route = createRoadProfile()
    const sport = createDefaultProfile()

    // Mesuré sur les réglages où les deux profils livrés diffèrent le plus.
    expect(relu.drivetrain.cruiseMinRpm).toBe(route.drivetrain.cruiseMinRpm)
    expect(relu.drivetrain.cruiseMinRpm).not.toBe(sport.drivetrain.cruiseMinRpm)
    expect(relu.drivetrain.cruiseUpshiftAfterS).toBe(route.drivetrain.cruiseUpshiftAfterS)
    expect(relu.mix.loadReliefDb).toBe(route.mix.loadReliefDb)
    expect(relu.mix.loadReliefDb).not.toBe(sport.mix.loadReliefDb)
    expect(relu.engine.redlineRpm).toBe(route.engine.redlineRpm)
  })

  it('complète un profil Sport avec les valeurs de Sport', () => {
    const partiel = { id: 'procar', name: 'Sport', sampleDir: 'v8-musclecar' }
    saveProfiles([partiel as unknown as Profile])

    const relu = loadProfiles()[0] as Profile

    // Sport n'est plus livré, mais son calibrage reste connu : un profil
    // enregistré garde **sa** base, sinon il se verrait complété avec les
    // valeurs d'un autre profil — le défaut que la reprise par identifiant avait
    // corrigé, et qui avait fait porter les essais sur route sur des valeurs que
    // personne n'avait choisies.
    expect(relu.drivetrain.cruiseMinRpm).toBe(createDefaultProfile().drivetrain.cruiseMinRpm)
    expect(relu.engine.redlineRpm).toBe(createDefaultProfile().engine.redlineRpm)
  })

  it('retombe sur les valeurs génériques pour un profil fabriqué', () => {
    // Un profil sorti du guide de création porte un identifiant tiré au sort :
    // aucun profil livré ne lui correspond, et le repli d'avant reste le bon.
    const partiel = { id: 'un-identifiant-a-nous', name: 'Le mien', sampleDir: 'v8-musclecar' }
    saveProfiles([partiel as unknown as Profile])

    const relu = loadProfiles()[0] as Profile

    // Le repli générique est le V8 depuis le 10 septembre 2026, et non plus
    // Sport : tout profil fabriqué se voyait complété avec les valeurs d'un
    // profil taillé pour une plage qu'on n'atteint jamais sur route.
    expect(relu.engine.redlineRpm).toBe(createV8Profile().engine.redlineRpm)
    expect(relu.name).toBe('Le mien')
  })

  it('ne touche pas aux valeurs que le profil porte déjà', () => {
    const enregistre = createRoadProfile()
    enregistre.drivetrain.cruiseMinRpm = 1234
    saveProfiles([enregistre])

    const relu = loadProfiles()[0] as Profile

    expect(relu.drivetrain.cruiseMinRpm).toBe(1234)
  })
})

describe('reprise — arrivée de l’effort', () => {
  it('remonte le niveau de ralenti d’un profil d’avant le repère de traînée', () => {
    // Le ralenti perd le relief de charge que la charge à un demi lui laissait
    // sans raison. Les profils livrés ont été recalés ; un profil enregistré
    // porte l'ancienne valeur, et sonnerait d'autant plus bas qu'hier.
    const ancien = createRoadProfile()
    const mix = { ...ancien.mix, idleLevelDb: -5, loadReliefDb: 4 } as Record<string, unknown>
    delete mix.dragRefKmh

    // Par le stockage et non par l'import : c'est le chemin des profils déjà
    // enregistrés, et le seul où la base est retrouvée par identifiant.
    localStorage.setItem('speed.profiles.v1', JSON.stringify([{ ...ancien, mix }]))
    const repris = loadProfiles().find((profil) => profil.id === ancien.id)

    expect(repris?.mix.idleLevelDb).toBe(-1)
    expect(repris?.mix.dragRefKmh).toBe(createRoadProfile().mix.dragRefKmh)
  })

  it('ne touche pas au ralenti d’un profil qui a déjà le repère', () => {
    const recent = createRoadProfile()
    localStorage.setItem(
      'speed.profiles.v1',
      JSON.stringify([{ ...recent, mix: { ...recent.mix, idleLevelDb: -3 } }]),
    )

    const repris = loadProfiles().find((profil) => profil.id === recent.id)

    expect(repris?.mix.idleLevelDb).toBe(-3)
  })
})

describe('origine du son', () => {
  it('reprend en « enregistré » un profil qui n’a pas le champ', () => {
    // Le cas de tous les profils déjà réglés sur les appareils : ils sonnent par
    // échantillons depuis toujours, et une mise à jour ne doit ni les priver de
    // leur son ni leur inventer une nature.
    const ancien = deepCopy(createRoadProfile()) as unknown as Record<string, unknown>
    delete ancien['soundSource']

    saveProfiles([ancien as unknown as Profile])

    expect(loadProfiles()[0]?.soundSource).toBe('recorded')
  })

  it('garde l’origine choisie d’un rechargement à l’autre', () => {
    const profile: Profile = { ...createRoadProfile(), soundSource: 'live' }

    saveProfiles([profile])

    expect(loadProfiles()[0]?.soundSource).toBe('live')
  })

  it('écarte une valeur qu’il ne connaît pas', () => {
    const bancal = { ...createRoadProfile(), soundSource: 'magique' } as unknown as Profile

    saveProfiles([bancal])

    expect(loadProfiles()[0]?.soundSource).toBe('recorded')
  })

  it('lit une origine absente comme « enregistré », sans passer par le stockage', () => {
    // Un profil reçu par lien ne repasse pas par la reprise : la lecture doit
    // être tolérante partout, pas seulement au chargement.
    expect(soundSourceOf({})).toBe('recorded')
    expect(soundSourceOf({ soundSource: 'prerendered' })).toBe('prerendered')
    expect(soundSourceOf({ soundSource: 42 })).toBe('recorded')
  })

  it('donne un régime de décollage aux profils qui n’en avaient pas', () => {
    // Le champ est né avec la version 4 du format. Un profil enregistré avant
    // doit recevoir celui de son profil d'usine, sans quoi le moteur resterait
    // collé au ralenti à très basse vitesse et sonnerait comme à l'arrêt.
    const ancien = createRoadProfile() as unknown as {
      engine: Partial<Record<string, unknown>>
    }
    delete ancien.engine['launchRpm']

    const relu = fromFile(JSON.stringify(ancien))

    expect(relu.engine.launchRpm).toBeGreaterThan(relu.engine.idleRpm)
  })

  it('ne demande un moteur simulé que pour le direct', () => {
    expect(SOUND_SOURCES).toEqual(['recorded', 'live', 'prerendered'])
    // Une banque produite à l'avance se joue comme une banque enregistrée : même
    // moteur de lecture, mêmes exigences. Seul le direct a besoin de simuler.
    expect(needsSimulatedEngine('recorded')).toBe(false)
    expect(needsSimulatedEngine('prerendered')).toBe(false)
    expect(needsSimulatedEngine('live')).toBe(true)
  })

  it('suit le profil par fichier et par lien', async () => {
    const original: Profile = { ...createRoadProfile(), soundSource: 'prerendered' }

    expect(fromFile(toFile(original)).soundSource).toBe('prerendered')
    expect((await decodeProfile(await encodeProfile(original))).soundSource).toBe('prerendered')
  })

  it('ne change pas quand on réinitialise le profil entier', () => {
    // Réinitialiser rend les réglages d'usine, pas une autre nature de son : un
    // profil synthétisé qu'on remet à plat reste synthétisé.
    const profile: Profile = { ...createRoadProfile(), soundSource: 'live' }
    profile.mix = { ...profile.mix, drive: 0.9 }

    const remis = resetProfileSection(profile, 'all')

    expect(remis.soundSource).toBe('live')
    expect(remis.mix.drive).toBe(createRoadProfile().mix.drive)
  })

  it('garde la définition de moteur attachée au profil', () => {
    // Elle ne doit pas se perdre, sans quoi la banque qu'elle a produite
    // deviendrait une boîte noire qu'on ne saurait plus refaire.
    const definition = { ...SUBARU_EJ25 }
    const profile: Profile = {
      ...createRoadProfile(),
      soundSource: 'prerendered',
      engineDefinition: definition,
    }

    saveProfiles([profile])

    expect(loadProfiles()[0]?.engineDefinition).toEqual(definition)
    expect(fromFile(toFile(profile)).engineDefinition).toEqual(definition)
    expect(duplicateProfile(profile, 'Copie').engineDefinition).toEqual(definition)
  })

  it('donne une définition de moteur à un profil qui n’en avait pas', () => {
    // Le champ est né sans forme à la version 4 : un profil enregistré avant la
    // version 5 n'en porte pas. Il reçoit celle de son profil d'usine, comme
    // tout autre réglage ajouté au schéma — sinon basculer son origine en
    // direct ne donnerait aucun son.
    const ancien = createRoadProfile() as unknown as Record<string, unknown>
    delete ancien['engineDefinition']

    saveProfiles([ancien as unknown as Profile])

    expect(loadProfiles()[0]?.engineDefinition).toEqual(GM_LS_V8)
  })

  it('complète et borne une définition de moteur écrite à la main', () => {
    // Un profil s'exporte en JSON lisible, et se modifie donc à la main. Une
    // valeur aberrante ne doit pas partir telle quelle dans la mémoire du
    // module WebAssembly.
    const bricole = {
      ...createRoadProfile(),
      engineDefinition: { cylinders: 4, chamberVolume: -50 },
    }

    const relu = fromFile(JSON.stringify(bricole))

    expect(relu.engineDefinition?.cylinders).toBe(4)
    expect(relu.engineDefinition?.chamberVolume).toBe(15)
    // Ce qui manquait vient du profil d'usine, pas d'un zéro.
    expect(relu.engineDefinition?.bore).toBe(GM_LS_V8.bore)
  })
})

describe('reprise de la boîte à sept rapports', () => {
  /**
   * Le cas réel : le profil « V8 » de David, enregistré en version 9 avec six
   * rapports, tel qu'il dort dans le stockage de son téléphone et sur le NAS.
   * S'il ne gagnait pas sa septième en s'ouvrant, le lot ne se verrait pas dans
   * sa voiture.
   */
  it('donne sa septième à un profil de route enregistré à six rapports', () => {
    const ancien = deepCopy(createRoadProfile())
    ancien.drivetrain.gearRatios = [3.55, 2.04, 1.36, 1.03, 0.86, 0.72]
    ancien.drivetrain.upshiftRpm = [3700, 3350, 3050, 2950, 2950]
    ancien.drivetrain.shiftDelaysS = [0.3, 0.55, 0.4, 0.6, 0.35, 0.5]

    saveProfiles([ancien])
    const relu = loadProfiles()[0]

    expect(relu?.drivetrain.gearRatios).toEqual([3.55, 2.04, 1.36, 1.0, 0.73, 0.53, 0.39])
    expect(relu?.drivetrain.upshiftRpm).toHaveLength(6)
    expect(relu?.drivetrain.shiftDelaysS).toHaveLength(7)
  })

  it('laisse à six rapports un profil dont la boîte a été réglée', () => {
    const regle = deepCopy(createRoadProfile())
    regle.drivetrain.gearRatios = [3.2, 1.9, 1.3, 1.0, 0.8, 0.66]

    saveProfiles([regle])

    expect(loadProfiles()[0]?.drivetrain.gearRatios).toHaveLength(6)
  })

  it('donne sa septième à un profil reçu par un lien ancien', async () => {
    const ancien = deepCopy(createRoadProfile())
    ancien.drivetrain.gearRatios = [3.55, 2.04, 1.36, 1.03, 0.86, 0.72]
    ancien.drivetrain.upshiftRpm = [3700, 3350, 3050, 2950, 2950]
    ancien.drivetrain.shiftDelaysS = [0.3, 0.55, 0.4, 0.6, 0.35, 0.5]

    const reçu = await decodeProfile(await encodeProfile(ancien))

    expect(reçu.drivetrain.gearRatios).toHaveLength(7)
    expect(reçu.drivetrain.shiftDelaysS).toHaveLength(7)
  })

  it('retire le seuil du rétrogradage forcé d’un profil enregistré', () => {
    // La boîte ne le lisait plus depuis le lot PLANCHER : il appartient au mode
    // de conduite. Un profil de la version précédente le porte encore ; il est
    // retiré, sans quoi le schéma mentirait à qui le lit.
    type AvecSeuil = Profile & { feel: { kickdown: { loadThreshold?: number } } }
    const ancien = { ...createRoadProfile() } as AvecSeuil
    ancien.feel = {
      ...ancien.feel,
      kickdown: { ...ancien.feel.kickdown, loadThreshold: 0.75 },
    }
    saveProfiles([ancien as Profile])

    const relu = loadProfiles()[0] as AvecSeuil

    expect(relu.feel.kickdown.loadThreshold).toBeUndefined()
    // Le reste du rétrogradage est intact : on ne retire que ce champ.
    expect(relu.feel.kickdown.enabled).toBe(createRoadProfile().feel.kickdown.enabled)
    expect(relu.feel.kickdown.maxGears).toBe(createRoadProfile().feel.kickdown.maxGears)
  })

  it('monte la version du format, pour que la reprise soit datée', () => {
    expect(PROFILE_FORMAT_VERSION).toBe(11)
  })
})
