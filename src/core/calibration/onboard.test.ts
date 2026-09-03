import { describe, expect, it } from 'vitest'

import { analyzeSession, overridesFor, withCalibration } from './onboard'
import { createDefaultProfile, createRoadProfile } from '../preset/defaults'
import type { Trace } from '../speed/replay'
import type { SpeedSample } from '../speed/source'

/**
 * Tests de la composition d'un profil avec un étalonnage.
 *
 * Ce qui est vérifié ici est la **forme en couches** : le profil réglé n'est
 * jamais modifié, la mesure vaut pour tous les profils, et elle sert autant de
 * fois qu'on la consulte. Une recopie destructive aurait tenu le premier essai
 * et manqué les deux autres.
 */

const START = 1_700_000_000_000

function buildTrace(startedAt: number, durationS: number, kmhAt: (t: number) => number): Trace {
  const samples: SpeedSample[] = []
  for (let ms = 0; ms <= durationS * 1000; ms += 100) {
    samples.push({
      kmh: Math.max(0, kmhAt(ms / 1000)),
      at: startedAt + ms,
      accuracyM: 5,
      derived: false,
    })
  }
  return { name: 'étape', startedAt, samples }
}

/** Reprise depuis l'arrêt à accélération constante, puis vitesse tenue. */
function launch(startedAt: number, accelMs2: number, durationS = 8): Trace {
  const topKmh = accelMs2 * 3.6 * durationS
  return buildTrace(startedAt, durationS + 4, (t) => Math.min(topKmh, accelMs2 * 3.6 * t))
}

describe('étalonnage en couche', () => {
  it('corrige ce que la voiture a exprimé', () => {
    // 4 m/s² injectés : au-delà des 2 que porte le profil Route, et plausible
    // pour une électrique. C'est tout l'intérêt de mesurer plutôt que déduire.
    const analyses = analyzeSession({ launch: START }, [launch(START, 4)])
    const profil = createRoadProfile()

    const effectif = withCalibration(profil, overridesFor(profil, analyses))

    expect(effectif.mix.fullLoadAccelMs2).toBeGreaterThan(3.5)
    expect(effectif.mix.fullLoadAccelMs2).toBeLessThan(4.5)
  })

  it('ne modifie jamais le profil réglé', () => {
    // Le point de la forme en couches : ce qu'on a réglé reste intact, et l'on
    // peut refaire ou retirer l'étalonnage sans avoir rien perdu.
    const analyses = analyzeSession({ launch: START }, [launch(START, 4)])
    const profil = createRoadProfile()

    withCalibration(profil, overridesFor(profil, analyses))

    expect(profil.mix.fullLoadAccelMs2).toBe(createRoadProfile().mix.fullLoadAccelMs2)
  })

  it('vaut pour tous les profils, livrés compris', () => {
    // Une mesure de la voiture n'a pas de raison de ne profiter qu'au profil
    // ouvert le jour où on l'a prise.
    const analyses = analyzeSession({ launch: START }, [launch(START, 4)])
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
    const analyses = analyzeSession({ launch: START }, [launch(START, 4)])
    const profil = createRoadProfile()
    const overrides = overridesFor(profil, analyses)

    const premier = withCalibration(profil, overrides)
    const second = withCalibration(profil, overrides)

    expect(second.mix.fullLoadAccelMs2).toBe(premier.mix.fullLoadAccelMs2)
    expect(withCalibration(premier, overrides).mix.fullLoadAccelMs2).toBe(
      premier.mix.fullLoadAccelMs2,
    )
  })

  it('laisse le profil décider de ce que la voiture n a pas exprimé', () => {
    const analyses = analyzeSession({ launch: START }, [launch(START, 4)])
    const profil = createRoadProfile()

    const effectif = withCalibration(profil, overridesFor(profil, analyses))

    expect(effectif.drivetrain.cruiseUpshiftAfterS).toBe(profil.drivetrain.cruiseUpshiftAfterS)
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

  it('ne resserre pas les bornes sur une étape qui n a pas ralenti', () => {
    // Mesuré en éprouvant la composition : avec la seule reprise enregistrée,
    // la plus forte décélération relevée vaut presque zéro, et la borne basse
    // proposée valait −0,5 m/s². Écrite dans un profil, elle aurait écrêté tout
    // freinage réel — la charge et la boîte auraient vu un ralentissement
    // minuscule là où l'on plante les freins.
    const analyses = analyzeSession({ launch: START }, [launch(START, 4)])
    const profil = createRoadProfile()

    const effectif = withCalibration(profil, overridesFor(profil, analyses))

    expect(effectif.speed.minAccelMs2).toBe(profil.speed.minAccelMs2)
  })
})
