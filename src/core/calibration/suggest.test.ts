import { describe, expect, it } from 'vitest'

import { analyzeStep } from './analyze'
import { measureTrace } from './measure'
import { readSetting, upshiftSpeeds, writeSetting, type SettingPath } from './settings'
import { round, suggest } from './suggest'
import { createRoadProfile } from '../preset/defaults'
import type { Trace } from '../speed/replay'
import type { SpeedSample } from '../speed/source'

/**
 * Tests de la proposition.
 *
 * Deux choses s'y vérifient, et la seconde est une règle plus qu'un calcul :
 * la valeur proposée est bien celle mesurée, et **rien n'est appliqué**. Le
 * profil rendu par `suggest` est le profil reçu, à l'identique — seul
 * `writeSetting`, appelé sur un geste, en produit un autre.
 */

function launchTrace(accelMs2: number, durationS = 8): Trace {
  const topKmh = accelMs2 * 3.6 * durationS
  const startedAt = 1_700_000_000_000
  const samples: SpeedSample[] = []
  for (let ms = 0; ms <= (durationS + 4) * 1000; ms += 100) {
    samples.push({
      kmh: Math.min(topKmh, (accelMs2 * 3.6 * ms) / 1000),
      at: startedAt + ms,
      accuracyM: 5,
      derived: false,
    })
  }
  return { name: 'reprise', startedAt, samples }
}

describe('suggest — charge pleine', () => {
  it('propose l’accélération mesurée face à celle du profil', () => {
    const profile = createRoadProfile()
    const analysis = analyzeStep('launch', launchTrace(3.6))

    const [suggestion] = suggest([analysis], profile)

    expect(suggestion?.key).toBe('mix.fullLoadAccelMs2')
    // 3,6 m/s² injectés, 3,6 proposés. Le profil Route est réglé à 2 m/s²,
    // valeur choisie par le calcul : l'écart de 1,6 est précisément ce que le
    // lot cherchait à faire voir.
    expect(suggestion?.measured?.value).toBeCloseTo(3.6, 2)
    expect(suggestion?.setting?.proposed).toBe(3.6)
    expect(suggestion?.setting?.current).toBe(2)
    expect(suggestion?.missing).toBeNull()
  })

  it('dit non mesuré quand l’étape n’a pas été faite', () => {
    const [suggestion] = suggest([], createRoadProfile())

    expect(suggestion?.measured).toBeNull()
    expect(suggestion?.setting).toBeNull()
    expect(suggestion?.missing).toContain('non enregistrée')
  })

  it('dit refusé, et pourquoi, quand l’étape a échoué', () => {
    const analysis = analyzeStep('launch', launchTrace(1, 20))

    const [suggestion] = suggest([analysis], createRoadProfile())

    expect(suggestion?.measured).toBeNull()
    expect(suggestion?.setting).toBeNull()
    expect(suggestion?.missing).toContain('refusée')
    expect(suggestion?.missing).toContain('reprise franche')
  })

  it('ne touche pas au profil', () => {
    const profile = createRoadProfile()
    const before = JSON.stringify(profile)

    suggest([analyzeStep('launch', launchTrace(4))], profile)

    expect(JSON.stringify(profile)).toBe(before)
    expect(profile.mix.fullLoadAccelMs2).toBe(2)
  })
})

function slowTrace(fromKmh: number, decelMs2: number, durationS: number): Trace {
  const startedAt = 1_700_000_000_000
  const samples: SpeedSample[] = []
  for (let ms = 0; ms <= durationS * 1000; ms += 100) {
    samples.push({
      kmh: Math.max(0, fromKmh - (Math.abs(decelMs2) * 3.6 * ms) / 1000),
      at: startedAt + ms,
      accuracyM: 5,
      derived: false,
    })
  }
  return { name: 'ralentissement', startedAt, samples }
}

/** Retrouve une ligne du récapitulatif par sa clé. */
function row(suggestions: ReturnType<typeof suggest>, key: string) {
  return suggestions.find((suggestion) => suggestion.key === key)
}

describe('suggest — rétrogradage au freinage', () => {
  it('place le seuil au milieu du lever de pied et du freinage', () => {
    const coast = analyzeStep('coast', slowTrace(80, 1, 12))
    const brake = analyzeStep('brake', slowTrace(90, 4.4, 5))

    const line = row(suggest([coast, brake], createRoadProfile()), 'drivetrain.brakeDownshiftAccelMs2')

    // −1,00 pied levé, −4,40 au freinage : le milieu est à −2,70. Le profil
    // Route est réglé à −1, c'est-à-dire exactement sur la valeur du lever de
    // pied — donc la boîte y rétrograde dès qu'on lève le pied.
    expect(line?.measured?.value).toBeCloseTo(-2.7, 2)
    expect(line?.setting?.proposed).toBe(-2.7)
    expect(line?.setting?.current).toBe(-1)
  })

  it('ne propose rien quand les deux étapes se touchent', () => {
    // Le cas d'une électrique qui récupère fort : lever le pied et freiner
    // donnent la même chose, et il n'y a pas de frontière entre les deux.
    const coast = analyzeStep('coast', slowTrace(80, 2.3, 8))
    const brake = analyzeStep('brake', slowTrace(90, 2.5, 8))

    const line = row(suggest([coast, brake], createRoadProfile()), 'drivetrain.brakeDownshiftAccelMs2')

    expect(line?.setting).toBeNull()
    expect(line?.missing).toContain('la même décélération')
    expect(line?.missing).toContain('récupération')
  })

  it('dit laquelle des deux étapes manque', () => {
    const brake = analyzeStep('brake', slowTrace(90, 4.4, 5))

    const line = row(suggest([brake], createRoadProfile()), 'drivetrain.brakeDownshiftAccelMs2')

    expect(line?.missing).toContain('décélération pied levé')
  })
})

describe('suggest — bornes de l’accélération', () => {
  it('borne sur la valeur relevée, plus la moitié en marge', () => {
    const launch = analyzeStep('launch', launchTrace(3.4))
    const brake = analyzeStep('brake', slowTrace(90, 4.4, 5))

    const suggestions = suggest([launch, brake], createRoadProfile())

    // −4,40 relevé × 1,5 = −6,60, arrondi vers l'extérieur au demi : −7,0.
    // 3,40 relevé × 1,5 = 5,10, arrondi vers l'extérieur : 5,5.
    expect(row(suggestions, 'speed.minAccelMs2')?.setting?.proposed).toBe(-7)
    expect(row(suggestions, 'speed.maxAccelMs2')?.setting?.proposed).toBe(5.5)
    // Les bornes du profil livré, jamais atteintes.
    expect(row(suggestions, 'speed.minAccelMs2')?.setting?.current).toBe(-14)
    expect(row(suggestions, 'speed.maxAccelMs2')?.setting?.current).toBe(14)
  })

  it('ignore une étape refusée dans le calcul des bornes', () => {
    // Un freinage mou est refusé : il ne doit pas servir de borne, sans quoi
    // une étape ratée resserrerait l'écrêtage sur une valeur trop faible.
    const launch = analyzeStep('launch', launchTrace(3.4))
    const soft = analyzeStep('brake', slowTrace(90, 1.2, 8))

    const suggestions = suggest([launch, soft], createRoadProfile())

    expect(soft.valid).toBe(false)
    // Seule la reprise compte : sa propre décélération est nulle, donc la borne
    // basse tombe à zéro plutôt qu'à −1,8.
    expect(row(suggestions, 'speed.minAccelMs2')?.measured?.value).toBeCloseTo(0, 2)
  })

  it('ne borne rien sans aucune étape valide', () => {
    const suggestions = suggest([], createRoadProfile())

    expect(row(suggestions, 'speed.minAccelMs2')?.missing).toContain('rien à borner')
    expect(row(suggestions, 'speed.maxAccelMs2')?.missing).toContain('rien à borner')
  })
})

/**
 * Générateur pseudo-aléatoire à graine : le bruit des traces synthétiques doit
 * être le même à chaque exécution, sinon les bornes de ces tests bougeraient.
 */
function rng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shaped(
  name: string,
  durationS: number,
  cadenceMs: number,
  kmhAt: (t: number) => number,
  noiseKmh = 0,
  seed = 5,
): Trace {
  const random = rng(seed)
  const startedAt = 1_700_000_000_000
  const samples: SpeedSample[] = []
  for (let ms = 0; ms <= durationS * 1000; ms += cadenceMs) {
    const noise = noiseKmh ? (random() * 2 - 1) * noiseKmh * Math.sqrt(3) : 0
    samples.push({
      kmh: Math.max(0, kmhAt(ms / 1000) + noise),
      at: startedAt + ms,
      accuracyM: 5,
      derived: false,
    })
  }
  return { name, startedAt, samples }
}

/** Palier bas, rampe, palier haut. */
const twoLevels =
  (low: number, high: number, holdS: number, rampS: number) =>
  (t: number): number => {
    if (t < holdS) return low
    if (t < holdS + rampS) return low + ((high - low) * (t - holdS)) / rampS
    return high
  }

/** Ville : feu, départ à 2 m/s², palier à 45 km/h, arrêt. Cycle de 60 s. */
const cityShape = (t: number): number => {
  const cycle = t % 60
  if (cycle < 12) return 0
  if (cycle < 20) return Math.min(45, 2 * 3.6 * (cycle - 12))
  if (cycle < 50) return 45
  return Math.max(0, 45 - 2 * 3.6 * (cycle - 50))
}

/** Les trois étapes de conduite ordinaire, mesurées et jugées. */
function ordinarySession() {
  const city = shaped('ville', 180, 200, cityShape)
  const road = shaped('route', 180, 100, twoLevels(70, 90, 80, 10), 0.5, 9)
  const highway = shaped('autoroute', 180, 30, twoLevels(110, 130, 80, 12), 0.6, 11)
  return [
    analyzeStep('city', city),
    analyzeStep('road', road),
    analyzeStep('highway', highway),
  ]
}

describe('suggest — conduite ordinaire', () => {
  it('propose la vitesse plausible depuis la plus haute vitesse pratiquée', () => {
    const suggestions = suggest(ordinarySession(), createRoadProfile())

    // 131,0 km/h pratiqués × 1,15 = 150,6, arrondis à la dizaine supérieure.
    // Le profil livré est à 260, une valeur sans rapport avec la route.
    expect(row(suggestions, 'speed.maxPlausibleKmh')?.measured?.value).toBeCloseTo(131, 0)
    expect(row(suggestions, 'speed.maxPlausibleKmh')?.setting?.proposed).toBe(160)
    expect(row(suggestions, 'speed.maxPlausibleKmh')?.setting?.current).toBe(260)
  })

  it('propose la vitesse de fin de première depuis les départs arrêtés', () => {
    const line = row(suggest(ordinarySession(), createRoadProfile()), 'drivetrain.launchUpshiftKmh')

    // 8,6 km/h une seconde après le départ, sur les trois feux de la trace.
    // Le profil Route est à 5.
    expect(line?.measured?.value).toBeCloseTo(8.6, 1)
    expect(line?.setting?.proposed).toBe(9)
    expect(line?.setting?.current).toBe(5)
  })

  it('propose des seuils de passage en km/h, et les convertit avec la boîte du profil', () => {
    const profile = createRoadProfile()
    const line = row(suggest(ordinarySession(), profile), 'drivetrain.upshiftRpm')

    // Les paliers de la session : 45 km/h (3 × 31 s), 70 (80 s), 90 (90 s),
    // 110 (80 s), 130 (88 s). La première ne servant qu'à s'élancer, son seuil
    // est la vitesse de fin de première ; les quatre autres découpent le temps
    // tenu en cinq parts égales.
    expect(line?.setting?.unit).toBe('km/h')
    expect(line?.setting?.proposed).toEqual([9, 45, 70, 90, 130])
    // Les seuils du profil Route, exprimés dans la même unité : c'est la seule
    // façon de les comparer sans parler de régime.
    expect(line?.setting?.current).toEqual([35, 55, 75, 96, 115])
    // Ce qui est écrit dans le profil, en tr/min, converti avec le pont et les
    // démultiplications. Non monotone, et c'est normal : un rapport plus long
    // tourne moins vite à une vitesse plus haute.
    expect(line?.setting?.write).toEqual([950, 2730, 2831, 2757, 3325])
    expect(line?.setting?.conversion).toContain('tr/min')
  })

  it('rend le plancher de croisière en vitesse, sans le convertir en régime', () => {
    const line = row(suggest(ordinarySession(), createRoadProfile()), 'cruise.floor')

    // 45 km/h : le dixième centile des vitesses tenues, pondéré par la durée.
    expect(line?.measured?.value).toBe(45)
    // Rien à recopier : déduire un régime de cette vitesse demanderait de
    // choisir un rapport, ce qu'aucune mesure ne dit.
    expect(line?.setting).toBeNull()
    expect(line?.note).toContain('n’a pas de rapports')
  })

  it('chiffre le bruit du GPS et la cadence, sans proposer la raideur du lissage', () => {
    const line = row(suggest(ordinarySession(), createRoadProfile()), 'gps.noise')

    // 0,6 km/h injectés dans la trace d'autoroute, 0,63 mesurés.
    expect(line?.measured?.value).toBeCloseTo(0.63, 2)
    expect(line?.note).toContain('30 ms de cadence')
    expect(line?.note).toContain('à l’oreille')
    expect(line?.setting).toBeNull()
  })

  it('déduit la fenêtre d’accélération du bruit et de la cadence', () => {
    const line = row(suggest(ordinarySession(), createRoadProfile()), 'speed.accelWindowMs')

    // 0,63 km/h de bruit à 30 ms de cadence : ∛(12 σ² Δ / cible²) = 1050 ms
    // pour une cible de 0,1 m/s². Le profil est à 1000, ce qui se trouve être
    // presque juste — mais ce n'était pas mesuré.
    expect(line?.setting?.proposed).toBe(1050)
    expect(line?.setting?.current).toBe(1000)
  })

  it('dit non mesuré partout quand aucune étape ordinaire n’est faite', () => {
    const suggestions = suggest([], createRoadProfile())

    for (const key of [
      'speed.maxPlausibleKmh',
      'drivetrain.launchUpshiftKmh',
      'drivetrain.upshiftRpm',
      'cruise.floor',
      'drivetrain.cruiseUpshiftAfterS',
      'gps.noise',
      'speed.accelWindowMs',
    ]) {
      expect(row(suggestions, key)?.missing, key).toBeTruthy()
      expect(row(suggestions, key)?.setting, key).toBeNull()
    }
  })
})

describe('suggest — la fenêtre proposée atteint la précision visée', () => {
  /**
   * La vérification qui compte : on propose une fenêtre, puis on remesure la
   * **même trace** avec elle et on regarde l'écart-type de la pente obtenue.
   * C'est le seul moyen de savoir si la formule tient, plutôt que de la relire.
   */
  it('tient la cible de 0,1 m/s² à trois bruits et deux cadences', () => {
    const cases: [number, number, number, number][] = [
      // bruit injecté, cadence, fenêtre attendue, écart-type obtenu
      [0.3, 30, 650, 0.1038],
      [0.6, 30, 1050, 0.1005],
      [1, 100, 2000, 0.1034],
    ]

    for (const [sigma, cadenceMs, expectedWindow, expectedDeviation] of cases) {
      const highway = shaped(
        'autoroute',
        180,
        cadenceMs,
        twoLevels(110, 130, 80, 12),
        sigma,
        13,
      )
      const proposed = Number(
        row(suggest([analyzeStep('highway', highway)], createRoadProfile()), 'speed.accelWindowMs')
          ?.setting?.proposed ?? 0,
      )
      expect(proposed, `bruit ${sigma}, cadence ${cadenceMs}`).toBe(expectedWindow)

      // Sur la portion tenue à 110 km/h, la pente vraie est nulle : la
      // dispersion mesurée est donc exactement le bruit de l'estimateur.
      const slopes = measureTrace(highway, proposed)
        .points.filter((point) => point.t < 70)
        .map((point) => point.accelMs2)
        .filter((value): value is number => value !== null)
      const mean = slopes.reduce((sum, value) => sum + value, 0) / slopes.length
      const deviation = Math.sqrt(
        slopes.reduce((sum, value) => sum + (value - mean) ** 2, 0) / slopes.length,
      )

      expect(deviation, `bruit ${sigma}, cadence ${cadenceMs}`).toBeCloseTo(
        expectedDeviation,
        3,
      )
    }
  })
})

describe('writeSetting', () => {
  it('recopie un réglage et laisse le reste intact', () => {
    const profile = createRoadProfile()

    const updated = writeSetting(profile, 'mix.fullLoadAccelMs2', 3.6)

    expect(readSetting(updated, 'mix.fullLoadAccelMs2')).toBe(3.6)
    // Le profil d'origine est inchangé : c'est ce qui permet à
    // « réinitialiser » de revenir à ce qu'il était.
    expect(profile.mix.fullLoadAccelMs2).toBe(2)
    // Et rien d'autre n'a bougé dans le mixage.
    expect({ ...updated.mix, fullLoadAccelMs2: 0 }).toEqual({
      ...profile.mix,
      fullLoadAccelMs2: 0,
    })
  })

  it('refuse une valeur du mauvais genre plutôt que d’écrire n’importe quoi', () => {
    const profile = createRoadProfile()

    const updated = writeSetting(profile, 'mix.fullLoadAccelMs2', [1, 2])

    expect(updated).toBe(profile)
  })

  /**
   * Chaque chemin, lu puis écrit puis relu.
   *
   * Un aiguillage de neuf branches où une erreur de recopie écrirait dans le
   * champ voisin, en silence : la valeur proposée irait dans le mauvais réglage
   * et l'écran continuerait d'afficher le bon écart. Aucun autre test ne
   * l'attraperait.
   */
  it('écrit chaque réglage dans son propre champ', () => {
    const profile = createRoadProfile()
    const cases: [SettingPath, number, (p: typeof profile) => number][] = [
      ['mix.fullLoadAccelMs2', 3.3, (p) => p.mix.fullLoadAccelMs2],
      ['drivetrain.brakeDownshiftAccelMs2', -2.6, (p) => p.drivetrain.brakeDownshiftAccelMs2],
      ['speed.minAccelMs2', -7.5, (p) => p.speed.minAccelMs2],
      ['speed.maxAccelMs2', 6.5, (p) => p.speed.maxAccelMs2],
      ['speed.maxPlausibleKmh', 170, (p) => p.speed.maxPlausibleKmh],
      ['speed.accelWindowMs', 750, (p) => p.speed.accelWindowMs],
      ['drivetrain.launchUpshiftKmh', 11, (p) => p.drivetrain.launchUpshiftKmh],
      ['drivetrain.cruiseUpshiftAfterS', 3.4, (p) => p.drivetrain.cruiseUpshiftAfterS],
    ]

    for (const [path, value, read] of cases) {
      const updated = writeSetting(profile, path, value)
      expect(readSetting(updated, path), path).toBe(value)
      expect(read(updated), path).toBe(value)
      // Et le profil de départ n'a pas bougé.
      expect(read(profile), path).not.toBe(value)
    }
  })

  it('écrit la table des seuils, et refuse une table de mauvaise longueur', () => {
    const profile = createRoadProfile()
    const table = [900, 2700, 2800, 2750, 3300]

    const updated = writeSetting(profile, 'drivetrain.upshiftRpm', table)
    expect(updated.drivetrain.upshiftRpm).toEqual(table)
    expect(readSetting(updated, 'drivetrain.upshiftRpm')).toEqual(table)
    // Une copie, non la même référence : la table écrite ne doit pas rester liée
    // à celle de l'appelant.
    expect(updated.drivetrain.upshiftRpm).not.toBe(table)

    // Trop courte, elle laisserait des rapports sans seuil ; trop longue, elle
    // porterait des entrées que rien ne lit.
    expect(writeSetting(profile, 'drivetrain.upshiftRpm', [900, 2700])).toBe(profile)
    expect(writeSetting(profile, 'drivetrain.upshiftRpm', 3000)).toBe(profile)
  })
})

describe('upshiftSpeeds', () => {
  it('exprime les seuils du profil en km/h', () => {
    // Le profil Route déclare ses passages à 3700, 3350, 3050, 2950 et
    // 2950 tr/min. Ses commentaires disent qu'ils tombent « à 35, 55, 75, 96 et
    // 115 km/h » : la conversion le confirme, et c'est ce qui permet de
    // comparer un seuil mesuré à un seuil réglé sans parler de régime.
    const speeds = upshiftSpeeds(createRoadProfile()).map((kmh) => Math.round(kmh))

    expect(speeds).toEqual([35, 55, 75, 96, 115])
  })

  it('rend zéro sur une démultiplication absurde plutôt que l’infini', () => {
    const profile = createRoadProfile()
    profile.drivetrain.finalDrive = 0

    expect(upshiftSpeeds(profile)).toEqual([0, 0, 0, 0, 0])
  })
})

describe('round', () => {
  it('arrondit au nombre de décimales demandé', () => {
    expect(round(3.5551, 1)).toBe(3.6)
    expect(round(-1.049, 1)).toBe(-1)
    expect(round(117.4, 0)).toBe(117)
  })
})
