import { describe, expect, it } from 'vitest'

import { analyzeSession, missingSteps, overridesFor, withCalibration } from './onboard'
import { createDefaultProfile, createRoadProfile } from '../preset/defaults'
import type { Trace } from '../speed/replay'
import type { SpeedSample } from '../speed/source'

/**
 * Tests de la composition d'un profil avec un étalonnage.
 *
 * Deux choses s'y vérifient. La **forme en couches** : le profil réglé n'est
 * jamais modifié, la mesure vaut pour tous les profils, et elle sert autant de
 * fois qu'on la consulte. Et la règle du **jeu complet** : une session à qui il
 * manque une étape ne s'applique pas du tout.
 */

const START = 1_700_000_000_000

function buildTrace(
  name: string,
  startedAt: number,
  durationS: number,
  kmhAt: (t: number) => number,
): Trace {
  const samples: SpeedSample[] = []
  for (let ms = 0; ms <= durationS * 1000; ms += 100) {
    samples.push({
      kmh: Math.max(0, kmhAt(ms / 1000)),
      at: startedAt + ms,
      accuracyM: 5,
      derived: false,
    })
  }
  return { name, startedAt, samples }
}

/** Reprise depuis l'arrêt à accélération constante, puis vitesse tenue. */
function launchTrace(startedAt: number, accelMs2: number, durationS = 8): Trace {
  const topKmh = accelMs2 * 3.6 * durationS
  return buildTrace('reprise', startedAt, durationS + 4, (t) =>
    Math.min(topKmh, accelMs2 * 3.6 * t),
  )
}

/** Ralentissement à taux constant depuis une vitesse donnée. */
function slowTrace(
  name: string,
  startedAt: number,
  fromKmh: number,
  decelMs2: number,
  durationS: number,
): Trace {
  return buildTrace(name, startedAt, durationS, (t) => fromKmh - Math.abs(decelMs2) * 3.6 * t)
}

/** Palier bas, rampe, palier haut : de quoi tenir une vitesse et en changer. */
const twoLevels =
  (low: number, high: number, holdS: number, rampS: number) =>
  (t: number): number => {
    if (t < holdS) return low
    if (t < holdS + rampS) return low + ((high - low) * (t - holdS)) / rampS
    return high
  }

/** Ville : feu, départ, palier à 45 km/h, arrêt. Cycle de soixante secondes. */
const cityShape = (t: number): number => {
  const cycle = t % 60
  if (cycle < 12) return 0
  if (cycle < 20) return Math.min(45, 2 * 3.6 * (cycle - 12))
  if (cycle < 50) return 45
  return Math.max(0, 45 - 2 * 3.6 * (cycle - 50))
}

/** Une étape à la fois, avec son horodatage : c'est lui qui relie trace et session. */
const STEP_AT = {
  city: START,
  road: START + 1_000_000,
  highway: START + 2_000_000,
  launch: START + 3_000_000,
  coast: START + 4_000_000,
  brake: START + 5_000_000,
}

const TRACES: Record<keyof typeof STEP_AT, Trace> = {
  city: buildTrace('ville', STEP_AT.city, 180, cityShape),
  road: buildTrace('route', STEP_AT.road, 180, twoLevels(70, 90, 80, 10)),
  highway: buildTrace('autoroute', STEP_AT.highway, 180, twoLevels(110, 130, 80, 12)),
  launch: launchTrace(STEP_AT.launch, 4),
  coast: slowTrace('lever de pied', STEP_AT.coast, 90, 1, 8),
  brake: slowTrace('freinage', STEP_AT.brake, 80, 3, 5),
}

/** Les six étapes du protocole, toutes valides. */
function fullSession() {
  return analyzeSession(STEP_AT, Object.values(TRACES))
}

/** Le jeu complet, moins les étapes nommées. */
function sessionWithout(...omitted: (keyof typeof STEP_AT)[]) {
  const session = { ...STEP_AT }
  for (const step of omitted) delete session[step]
  return analyzeSession(
    session,
    Object.entries(TRACES)
      .filter(([id]) => !omitted.includes(id as keyof typeof STEP_AT))
      .map(([, trace]) => trace),
  )
}

describe('étalonnage en couche', () => {
  it('corrige ce que la voiture a exprimé', () => {
    // 4 m/s² injectés : au-delà des 2 que porte le profil Route, et plausible
    // pour une électrique. C'est tout l'intérêt de mesurer plutôt que déduire.
    const profil = createRoadProfile()

    const effectif = withCalibration(profil, overridesFor(profil, fullSession()))

    expect(effectif.mix.fullLoadAccelMs2).toBeGreaterThan(3.5)
    expect(effectif.mix.fullLoadAccelMs2).toBeLessThan(4.5)
  })

  it('ne modifie jamais le profil réglé', () => {
    // Le point de la forme en couches : ce qu'on a réglé reste intact, et l'on
    // peut refaire ou retirer l'étalonnage sans avoir rien perdu.
    const profil = createRoadProfile()

    withCalibration(profil, overridesFor(profil, fullSession()))

    expect(profil.mix.fullLoadAccelMs2).toBe(createRoadProfile().mix.fullLoadAccelMs2)
  })

  it('vaut pour tous les profils, livrés compris', () => {
    // Une mesure de la voiture n'a pas de raison de ne profiter qu'au profil
    // ouvert le jour où on l'a prise.
    const analyses = fullSession()
    const route = createRoadProfile()
    const sport = createDefaultProfile()

    const routeEffectif = withCalibration(route, overridesFor(route, analyses))
    const sportEffectif = withCalibration(sport, overridesFor(sport, analyses))

    expect(routeEffectif.mix.fullLoadAccelMs2).toBe(sportEffectif.mix.fullLoadAccelMs2)
    // Et le caractère de chacun est conservé : seule la capacité mesurée bouge.
    expect(routeEffectif.engine.redlineRpm).toBe(route.engine.redlineRpm)
    expect(sportEffectif.engine.redlineRpm).toBe(sport.engine.redlineRpm)
  })

  it('se compose autant de fois qu on le demande', () => {
    // Une couche ne se consomme pas. Composer deux fois donne le même résultat,
    // contrairement à une recopie qui n'aurait servi qu'une fois.
    const profil = createRoadProfile()
    const overrides = overridesFor(profil, fullSession())

    const premier = withCalibration(profil, overrides)
    const second = withCalibration(profil, overrides)

    expect(second.mix.fullLoadAccelMs2).toBe(premier.mix.fullLoadAccelMs2)
    expect(withCalibration(premier, overrides).mix.fullLoadAccelMs2).toBe(
      premier.mix.fullLoadAccelMs2,
    )
  })

  it('laisse le profil décider de ce que la voiture n a pas exprimé', () => {
    const profil = createRoadProfile()

    const effectif = withCalibration(profil, overridesFor(profil, fullSession()))

    expect(effectif.mix.loadReliefDb).toBe(profil.mix.loadReliefDb)
    expect(effectif.engine.idleRpm).toBe(profil.engine.idleRpm)
  })

  it('rend le profil tel quel sans étalonnage', () => {
    const profil = createRoadProfile()

    expect(analyzeSession({}, [])).toEqual([])
    expect(overridesFor(profil, [])).toEqual([])
    // La même référence, et non une copie : le profil traverse la boucle
    // soixante fois par seconde.
    expect(withCalibration(profil, [])).toBe(profil)
  })

  it('ignore une étape dont la trace a été supprimée', () => {
    // La session ne garde qu'un horodatage.
    expect(analyzeSession({ launch: START }, [])).toEqual([])
  })
})

describe('étalonnage — le jeu complet', () => {
  it('n applique rien tant qu une étape manque', () => {
    // Le cas relevé en roulant le 4 septembre 2026 : la seule étape de ville,
    // enregistrée dans un bouchon, cale la vitesse plausible maximale sur ce
    // qu'on y a roulé. Le profil livré est à 260 km/h ; la borne tombait à 40, et
    // au-delà la source rejetait chaque mesure comme aberrante.
    const profil = createRoadProfile()
    const bouchon = analyzeSession({ city: STEP_AT.city }, [
      buildTrace('bouchon', STEP_AT.city, 180, (t) => 12 + 8 * Math.sin(t / 7)),
    ])

    const effectif = withCalibration(profil, overridesFor(profil, bouchon))

    expect(overridesFor(profil, bouchon)).toEqual([])
    expect(effectif.speed.maxPlausibleKmh).toBe(profil.speed.maxPlausibleKmh)
    expect(effectif).toBe(profil)
  })

  it('n applique rien quand il ne manque qu une seule étape', () => {
    // La règle ne tolère pas le presque-complet : c'est précisément l'étape
    // absente qui déforme les bornes tirées de la distribution.
    const profil = createRoadProfile()

    expect(overridesFor(profil, sessionWithout('highway'))).toEqual([])
    expect(overridesFor(profil, sessionWithout('brake'))).toEqual([])
  })

  it('n applique rien quand une étape a été refusée', () => {
    // Une reprise molle est enregistrée mais refusée : elle n'a rien mesuré, et
    // le jeu n'est pas complet pour autant.
    const profil = createRoadProfile()
    const molle = { ...STEP_AT }
    const analyses = analyzeSession(molle, [
      ...Object.entries(TRACES)
        .filter(([id]) => id !== 'launch')
        .map(([, trace]) => trace),
      launchTrace(STEP_AT.launch, 0.8, 20),
    ])

    expect(analyses).toHaveLength(6)
    expect(missingSteps(analyses)).toEqual(['launch'])
    expect(overridesFor(profil, analyses)).toEqual([])
  })

  it('applique tout dès que le jeu est complet', () => {
    const profil = createRoadProfile()
    const analyses = fullSession()

    expect(missingSteps(analyses)).toEqual([])
    const effectif = withCalibration(profil, overridesFor(profil, analyses))

    // 130 km/h pratiqués sur l'autoroute : la borne se cale au-dessus, et non
    // sous la vitesse à laquelle on roule.
    expect(effectif.speed.maxPlausibleKmh).toBeGreaterThan(130)
    expect(effectif.mix.fullLoadAccelMs2).toBeGreaterThan(3.5)
  })

  it('dit quelles étapes manquent, dans l ordre du protocole', () => {
    expect(missingSteps(sessionWithout('city', 'coast'))).toEqual(['city', 'coast'])
    expect(missingSteps([])).toHaveLength(6)
  })
})
