import { describe, expect, it } from 'vitest'

import { traceFromCapture } from './from-capture'
import type { CaptureLine, CaptureSample } from '../capture/capture'

/**
 * Tests de la lecture d'une capture de trajet par le code d'étalonnage.
 *
 * L'étalonnage sait mesurer une `Trace` — un nom, un début, des échantillons de
 * source. Les captures déposées depuis le 10 septembre 2026 ont un autre
 * format : des tranches numérotées, chacune précédée d'un en-tête, mêlant des
 * relevés et des faits datés. Cet adaptateur les met dans la forme attendue, et
 * rien de plus : il ne mesure pas, il ne juge pas.
 */

function releve(over: Partial<CaptureSample> = {}): CaptureSample {
  return {
    at: 0,
    src: 0,
    kmh: 0,
    acc: 5,
    der: false,
    out: 0,
    ms2: 0,
    rpm: 800,
    gear: 1,
    load: 0.5,
    ...over,
  }
}

describe('traceFromCapture', () => {
  it('ne garde que les relevés, et laisse les faits datés de côté', () => {
    const lignes: CaptureLine[] = [
      { at: 10, kind: 'capture', data: { running: true } },
      releve({ at: 100, kmh: 30 }),
      { at: 150, kind: 'profile', data: { driveMode: 'sport' } },
      releve({ at: 200, kmh: 32 }),
    ]

    const trace = traceFromCapture('da2m', lignes)

    expect(trace.samples).toHaveLength(2)
    expect(trace.samples.map((s) => s.kmh)).toEqual([30, 32])
  })

  /**
   * C'est le point de la conversion, et il se décide ici une fois pour toutes.
   *
   * Une capture porte les deux vitesses : celle que la source a donnée (`kmh`)
   * et celle que le conditionnement en a faite (`out`). L'étalonnage mesure des
   * pentes, et le conditionnement lisse — lui donner la vitesse conditionnée
   * rendrait des accélérations plus douces que la voiture, donc une voiture qui
   * paraît moins vive qu'elle n'est.
   *
   * Et c'est du brut que mesurent les enregistrements du protocole : sans cela
   * les deux chemins ne seraient pas comparables.
   */
  it('mesure la vitesse brute, pas la vitesse conditionnée', () => {
    const trace = traceFromCapture('da2m', [releve({ at: 100, kmh: 42, out: 38.5 })])

    expect(trace.samples[0]!.kmh).toBe(42)
  })

  it('reporte la précision annoncée et l’origine de la vitesse', () => {
    const trace = traceFromCapture('da2m', [
      releve({ at: 100, acc: 9999.99, der: true }),
      releve({ at: 200, acc: null, der: false }),
    ])

    expect(trace.samples[0]).toMatchObject({ accuracyM: 9999.99, derived: true })
    expect(trace.samples[1]).toMatchObject({ accuracyM: null, derived: false })
  })

  /**
   * Le commentaire de `CaptureSample` l'annonce : « plusieurs échantillons
   * peuvent partager le même `at` quand la boucle ralentit ». Deux points au
   * même instant donneraient un intervalle nul, donc une pente infinie.
   */
  it('écarte les relevés qui partagent un instant', () => {
    const trace = traceFromCapture('da2m', [
      releve({ at: 100, kmh: 30 }),
      releve({ at: 100, kmh: 31 }),
      releve({ at: 200, kmh: 32 }),
    ])

    expect(trace.samples.map((s) => s.at)).toEqual([100, 200])
    expect(trace.samples[0]!.kmh).toBe(30)
  })

  /**
   * Une capture note ce que la chaîne fait à chaque tour de boucle, pas à chaque
   * position reçue : la même position y revient tant que la suivante n'est pas
   * arrivée. Mesuré sur le trajet du 11 septembre 2026 : 23 988 relevés pour
   * 21 829 positions, et l'une d'elles répétée 370 fois, à l'arrêt.
   *
   * Ces répétitions portent la même vitesse au bit près : comptées comme des
   * mesures, elles s'écartent de zéro de la droite ajustée et font ressortir un
   * bruit de GPS plus faible qu'il n'est.
   */
  it('écarte une mesure réémise à l’identique', () => {
    const trace = traceFromCapture('da2m', [
      releve({ at: 100, src: 84241187000, kmh: 30 }),
      releve({ at: 183, src: 84241187000, kmh: 30 }),
      releve({ at: 266, src: 84241187000, kmh: 30 }),
      releve({ at: 350, src: 84241287000, kmh: 31 }),
    ])

    expect(trace.samples.map((s) => s.at)).toEqual([100, 350])
  })

  /**
   * L'horodatage de la source ne suffit pas à reconnaître une réémission : sa
   * résolution est plus grossière que la cadence, et le même horodatage porte
   * parfois deux vitesses — soixante-huit fois sur le trajet du 11 septembre.
   *
   * C'est décisif à l'arrêt : le premier relevé immobile hérite de l'horodatage
   * du dernier relevé en mouvement. S'en tenir à l'horodatage effaçait les 446
   * relevés à l'arrêt du trajet, et ses trois départs avec eux.
   */
  it('garde une vitesse neuve sous un horodatage déjà vu', () => {
    const trace = traceFromCapture('da2m', [
      releve({ at: 100, src: 84826458000, kmh: 1 }),
      releve({ at: 183, src: 84826458000, kmh: 0 }),
      releve({ at: 266, src: 84826458000, kmh: 0 }),
    ])

    expect(trace.samples.map((s) => s.kmh)).toEqual([1, 0])
  })

  it('garde tout quand la source n’horodate pas', () => {
    const trace = traceFromCapture('sim', [
      releve({ at: 100, src: 0, kmh: 30 }),
      releve({ at: 200, src: 0, kmh: 31 }),
      releve({ at: 300, src: 0, kmh: 32 }),
    ])

    expect(trace.samples).toHaveLength(3)
  })

  it('remet les relevés dans l’ordre, quel que soit celui des tranches', () => {
    const trace = traceFromCapture('da2m', [
      releve({ at: 300, kmh: 33 }),
      releve({ at: 100, kmh: 30 }),
      releve({ at: 200, kmh: 32 }),
    ])

    expect(trace.samples.map((s) => s.at)).toEqual([100, 200, 300])
  })

  /**
   * Une capture compte les millisecondes depuis le début de la session ; une
   * trace du protocole porte des horodatages absolus. Les mesures d'étalonnage
   * ne regardent que des **écarts**, donc l'origine n'a pas d'importance — mais
   * elle doit être cohérente, et `startedAt` doit dire quelque chose de vrai.
   */
  it('garde l’origine de la session et les instants relatifs', () => {
    const trace = traceFromCapture('da2m', [releve({ at: 1500 })], { startedAt: 1789107841182 })

    expect(trace.startedAt).toBe(1789107841182)
    expect(trace.samples[0]!.at).toBe(1500)
  })

  it('écarte un relevé dont la vitesse ou l’instant n’est pas un nombre', () => {
    const trace = traceFromCapture('da2m', [
      releve({ at: 100, kmh: Number.NaN }),
      releve({ at: Number.POSITIVE_INFINITY, kmh: 30 }),
      releve({ at: 300, kmh: 33 }),
    ])

    expect(trace.samples).toHaveLength(1)
    expect(trace.samples[0]!.at).toBe(300)
  })

  it('rend une trace vide plutôt que de jeter, sur une capture sans relevé', () => {
    const trace = traceFromCapture('da2m', [{ at: 10, kind: 'capture', data: {} }])

    expect(trace.samples).toEqual([])
    expect(trace.name).toBe('da2m')
  })
})
