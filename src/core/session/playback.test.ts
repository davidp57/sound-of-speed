import { describe, expect, it } from 'vitest'

import { SessionPlayback, type PlaybackFrame } from './playback'
import { profileFromHeader, whyNoSound } from './header'
import { createRoadProfile } from '../preset/defaults'
import type { Session, StatePoint } from './model'

function session(states: StatePoint[], header: Record<string, unknown> | null = null): Session {
  return {
    id: 'essai',
    startedAt: 0,
    durationMs: states.length === 0 ? 0 : (states[states.length - 1] as StatePoint).at,
    header,
    states,
    track: [],
    events: [],
    sources: { journal: 0, capture: 1 },
  }
}

/** Une montée en vitesse régulière, à la cadence d'une capture. */
function rampe(secondes: number, kmhParSeconde: number): StatePoint[] {
  const points: StatePoint[] = []
  for (let i = 0; i * 0.1 <= secondes; i += 1) {
    const t = i * 0.1
    points.push({
      at: t * 1000,
      kmh: t * kmhParSeconde,
      rpm: 0,
      gear: 0,
      load: 0,
      accelMs2: kmhParSeconde / 3.6,
    })
  }
  return points
}

describe('profileFromHeader', () => {
  it('rend le profil que la capture a inscrit', () => {
    const profil = createRoadProfile()
    const lu = profileFromHeader({ runtime: profil as unknown as Record<string, unknown> })

    expect(lu?.drivetrain.gearRatios).toEqual(profil.drivetrain.gearRatios)
    expect(lu?.sampleDir).toBe(profil.sampleDir)
  })

  /**
   * Une capture se rejoue **telle qu'elle a été vécue** : ses six rapports
   * restent six, là où un profil enregistré en gagnerait un septième.
   */
  it('ne reprend pas le profil au format courant', () => {
    const ancien = {
      ...createRoadProfile(),
      drivetrain: {
        ...createRoadProfile().drivetrain,
        gearRatios: [3.55, 2.04, 1.36, 1.03, 0.86, 0.72],
      },
    }

    const lu = profileFromHeader({ runtime: ancien as unknown as Record<string, unknown> })

    expect(lu?.drivetrain.gearRatios).toHaveLength(6)
  })

  it('rend null quand il n’y a pas de quoi jouer', () => {
    expect(profileFromHeader(null)).toBeNull()
    expect(profileFromHeader({})).toBeNull()
    expect(profileFromHeader({ runtime: {} })).toBeNull()
    // Une configuration complète, mais sans couche ni banque.
    const nu = { ...createRoadProfile(), layers: [] }
    expect(profileFromHeader({ runtime: nu as unknown as Record<string, unknown> })).toBeNull()
  })

  it('dit pourquoi une session ne s’entend pas', () => {
    expect(whyNoSound(null)).toContain('journal')
    expect(whyNoSound({ runtime: {} })).toContain('configuration')
    expect(whyNoSound({ runtime: createRoadProfile() as unknown as Record<string, unknown> })).toBe('')
  })
})

describe('SessionPlayback', () => {
  const profil = createRoadProfile()

  it('fait monter le régime et les rapports en suivant la vitesse', () => {
    const jeu = session(rampe(30, 5))
    const lecture = new SessionPlayback(profil, jeu)
    lecture.seek(0)

    let dernier = lecture.tick(1 / 60, 0)
    for (let f = 1; f * (1000 / 60) < 30000; f += 1) {
      dernier = lecture.tick(1 / 60, f * (1000 / 60))
    }

    expect(dernier).not.toBeNull()
    // 150 km/h au bout de trente secondes : la boîte est dans le haut.
    expect(dernier!.kmh).toBeGreaterThan(140)
    expect(dernier!.gearbox.gear).toBeGreaterThan(3)
    expect(dernier!.engine.rpm).toBeGreaterThan(profil.engine.idleRpm)
  })

  /**
   * Un saut dans la timeline ne doit pas faire repartir la boîte en première :
   * elle se cale d'emblée sur le rapport qui convient à la vitesse d'arrivée.
   */
  it('se cale sur le bon rapport après un saut', () => {
    const jeu = session(rampe(60, 2.5))
    const lecture = new SessionPlayback(profil, jeu)

    lecture.seek(50000)
    const frame = lecture.tick(1 / 60, 50000)

    expect(frame).not.toBeNull()
    expect(frame!.kmh).toBeGreaterThan(100)
    expect(frame!.gearbox.gear).toBeGreaterThanOrEqual(4)
  })

  it('rend ce que la capture portait, pour le comparer', () => {
    const points = rampe(5, 10)
    points.forEach((point, i) => {
      point.rpm = 2000 + i
      point.gear = 2
    })
    const lecture = new SessionPlayback(profil, session(points))
    lecture.seek(0)

    const frame = lecture.tick(1 / 60, 2000)

    // Le fichier porte `2`, qui se lit « deuxième » ; la boîte compte à partir
    // de zéro, donc `1`.
    expect(frame?.recorded?.gear).toBe(1)
    expect(SessionPlayback.drift(frame!)).not.toBeNull()
    expect(SessionPlayback.drift(frame!)!.rpm).toBeCloseTo(
      frame!.engine.rpm - frame!.recorded!.rpm,
      6,
    )
  })

  it('rend null au-delà de ce que la session couvre', () => {
    const lecture = new SessionPlayback(profil, session([]))
    lecture.seek(0)

    expect(lecture.tick(1 / 60, 0)).toBeNull()
  })
})

describe('SessionPlayback — le tempérament du trajet', () => {
  const profil = createRoadProfile()

  /**
   * Un trajet en porte souvent deux : celui du 11 septembre 2026 est passé en
   * Sport à la vingt-deuxième minute. Le rejouer d'un bout à l'autre dans le
   * mode du départ ferait entendre une conduite qui n'a pas eu lieu.
   */
  it('suit les bascules Route et Sport inscrites dans la session', () => {
    // Le tirage au sort est neutralisé : sans cela, deux lectures du même
    // trajet ne cèdent pas leurs rapports au même tour, et la comparaison ne
    // dit plus rien du tempérament.
    const p = { ...profil, drivetrain: { ...profil.drivetrain, upshiftJitterRpm: 0 } }
    const points = rampe(40, 3)

    /** Le même trajet, au même instant, sous deux tempéraments. */
    function régime(mode: 'road' | 'sport'): number {
      const jeu = session(points)
      jeu.events = [{ at: 0, kind: 'profile', data: { driveMode: mode } }]
      const lecture = new SessionPlayback(p, jeu)
      lecture.seek(0)
      let frame: PlaybackFrame | null = null
      for (let i = 0; i * (1000 / 60) < 30000; i += 1) {
        frame = lecture.tick(1 / 60, i * (1000 / 60))
      }
      return frame?.engine.rpm ?? 0
    }

    // Sport garde ses rapports plus longtemps, donc tourne plus haut à la même
    // vitesse et au même instant du trajet.
    expect(régime('sport')).toBeGreaterThan(régime('road'))
  })

  it('se rabat sur le profil quand la session ne dit rien', () => {
    const jeu = session(rampe(20, 3))
    const lecture = new SessionPlayback(profil, jeu)
    lecture.seek(0)

    expect(lecture.tick(1 / 60, 0)).not.toBeNull()
  })
})
