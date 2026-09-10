import { describe, expect, it } from 'vitest'

import { JournalCollector, type JournalSnapshot } from './collect'
import { Journal } from './journal'

/**
 * Tests de la collecte.
 *
 * Trois promesses s'y vérifient, et la troisième est celle qui engage :
 * la collecte **se tait** quand rien ne change, elle **n'oublie pas** ce qui
 * change, et elle **n'inscrit jamais une position sans l'accord étendu**.
 *
 * La dernière est une promesse faite à l'utilisateur : elle mérite d'être
 * vérifiée par un test, et non confiée à une condition d'affichage.
 */

const BASE: JournalSnapshot = {
  at: 0,
  source: 'geolocation',
  sourceStatus: 'active',
  derived: false,
  kmh: 90,
  accelMs2: 0,
  rpm: 2400,
  gear: 5,
  load: 0.5,
  fixRestarts: 0,
  rejected: { implausible: 0, tooClose: 0, inaccurate: 0 },
  audioState: 'running',
  accuracyM: 8,
}

function snapshot(over: Partial<JournalSnapshot> = {}): JournalSnapshot {
  return { ...BASE, ...over }
}

function setup(consent: 'none' | 'minimal' | 'extended' = 'minimal') {
  const journal = new Journal({ sessionId: 'k7bq', startedAt: 0 })
  const collector = new JournalCollector(journal, consent)
  const events = () => {
    const slice = journal.takeSlice(1e9)
    if (!slice) return []
    return slice.body
      .split('\n')
      .filter((l) => l.length > 0)
      .map((l) => JSON.parse(l) as { at: number; kind: string; data: Record<string, unknown> })
  }
  return { journal, collector, events }
}

describe('la collecte se tait quand rien ne change', () => {
  it('n’inscrit rien pendant une minute de conduite étale', () => {
    // La boucle tourne soixante fois par seconde : inscrire l'état à chaque
    // tour donnerait deux cent seize mille lignes à l'heure.
    const { collector, events } = setup()
    for (let i = 0; i <= 60 * 60; i += 1) collector.observe(snapshot({ at: i * (1000 / 60) }))

    const lus = events()
    // L'état de départ, puis un relevé toutes les dix secondes : six lignes
    // pour une minute, et non trois mille six cents. Six et non sept, parce que
    // les instants ne tombent pas pile — une image dure 16,667 ms, et le seuil
    // des dix secondes est franchi juste après, ce qui décale la série.
    expect(lus.filter((e) => e.kind === 'sample')).toHaveLength(6)
    expect(lus.filter((e) => e.kind === 'source')).toHaveLength(1)
    expect(lus).toHaveLength(7)
  })

  it('inscrit l’état de départ, sans quoi la première transition serait orpheline', () => {
    const { collector, events } = setup()
    collector.observe(snapshot())

    const lus = events()
    expect(lus[0]).toMatchObject({ kind: 'source', data: { source: 'geolocation', status: 'active' } })
  })
})

describe('la collecte n’oublie pas ce qui change', () => {
  it('voit la bascule de l’origine de la vitesse', () => {
    // C'est le drapeau qui a manqué une semaine : sa bascule est exactement ce
    // qu'on veut voir arriver.
    const { collector, events } = setup()
    collector.observe(snapshot({ at: 0 }))
    collector.observe(snapshot({ at: 100, derived: true }))

    expect(events().filter((e) => e.kind === 'speed-origin')).toMatchObject([
      { data: { derived: true, kmh: 90 } },
    ])
  })

  it('voit une relance du suivi, et son total', () => {
    const { collector, events } = setup()
    collector.observe(snapshot({ at: 0 }))
    collector.observe(snapshot({ at: 100, fixRestarts: 1 }))
    collector.observe(snapshot({ at: 200, fixRestarts: 3 }))

    const relances = events().filter((e) => e.kind === 'fix-restart')
    expect(relances.map((e) => e.data.total)).toEqual([1, 3])
  })

  it('inscrit l’écart des rejets, et non leur total', () => {
    // Un cumul divisé par une durée ne dit rien : c'est l'écart qui permet de
    // répondre à « combien entre telle et telle minute ».
    const { collector, events } = setup()
    collector.observe(snapshot({ at: 0, rejected: { implausible: 5, tooClose: 0, inaccurate: 0 } }))
    collector.observe(snapshot({ at: 100, rejected: { implausible: 8, tooClose: 0, inaccurate: 2 } }))

    const rejets = events().filter((e) => e.kind === 'reject')
    expect(rejets).toMatchObject([
      { data: { motif: 'implausible', count: 3 } },
      { data: { motif: 'inaccurate', count: 2 } },
    ])
  })

  it('voit le contexte audio se suspendre', () => {
    const { collector, events } = setup()
    collector.observe(snapshot({ at: 0 }))
    collector.observe(snapshot({ at: 100, audioState: 'suspended' }))

    expect(events().filter((e) => e.kind === 'audio')).toMatchObject([
      { data: { state: 'suspended' } },
    ])
  })

  it('voit le changement de source', () => {
    const { collector, events } = setup()
    collector.observe(snapshot({ at: 0 }))
    collector.observe(snapshot({ at: 100, source: 'simulator', sourceStatus: 'active' }))

    expect(events().filter((e) => e.kind === 'source')).toHaveLength(2)
  })
})

describe('le cran d’accord décide de ce qui peut être inscrit', () => {
  const avecPosition = { latitude: 49.61234567, longitude: 6.13098765 }

  it('n’inscrit rien du tout sans accord', () => {
    // Pas même en local : un journal qu'on n'enverra pas n'a pas de raison
    // d'occuper la mémoire.
    const { collector, journal } = setup('none')
    for (let i = 0; i < 100; i += 1) {
      collector.observe(snapshot({ at: i * 1000, derived: i % 2 === 0, ...avecPosition }))
    }

    expect(journal.pendingCount).toBe(0)
  })

  it('n’inscrit aucune position au cran minimum', () => {
    // La promesse qui engage. Elle se vérifie sur le contenu, et non sur
    // l'absence d'un appel : c'est ce qui partirait qui compte.
    const { collector, events } = setup('minimal')
    for (let i = 0; i < 60; i += 1) {
      collector.observe(snapshot({ at: i * 1000, ...avecPosition }))
    }

    const corps = JSON.stringify(events())
    expect(corps).not.toContain('lat')
    expect(corps).not.toContain('lon')
    expect(corps).not.toContain('49.6')
    expect(corps).not.toContain('6.13')
  })

  it('inscrit la position au cran étendu, un point par seconde', () => {
    // Décimée : à la cadence réelle du GPS, une demi-heure ferait soixante
    // mille points et cinq mégaoctets.
    const { collector, events } = setup('extended')
    for (let i = 0; i <= 60 * 10; i += 1) {
      collector.observe(snapshot({ at: i * (1000 / 60), ...avecPosition }))
    }

    const positions = events().filter((e) => 'lat' in e.data)
    expect(positions.length).toBeGreaterThanOrEqual(10)
    expect(positions.length).toBeLessThanOrEqual(11)
    // Cinq décimales valent le mètre : dix n'ajouteraient que du poids.
    expect(positions[0]?.data.lat).toBe(49.61235)
  })

  it('n’invente pas une position absente', () => {
    // Une ligne qui ne dit rien coûte autant qu'une qui dit quelque chose.
    const { collector, events } = setup('extended')
    for (let i = 0; i < 10; i += 1) {
      collector.observe(snapshot({ at: i * 1000, latitude: null, longitude: null }))
    }

    expect(JSON.stringify(events())).not.toContain('lat')
  })

  it('cesse d’inscrire la position dès que l’accord est retiré', () => {
    // Un accord se retire, et le retrait vaut tout de suite : c'est le sens
    // même du réglage.
    const { collector, events } = setup('extended')
    collector.observe(snapshot({ at: 0, ...avecPosition }))
    collector.observe(snapshot({ at: 1000, ...avecPosition }))
    collector.setConsent('minimal')
    for (let i = 2; i < 12; i += 1) {
      collector.observe(snapshot({ at: i * 1000, ...avecPosition }))
    }

    const positions = events().filter((e) => 'lat' in e.data)
    expect(positions).toHaveLength(2)
  })
})

describe('ce que le son a coûté', () => {
  it('entre dans le relevé périodique quand le son est synthétisé', () => {
    const { collector, events } = setup()
    collector.observe(
      snapshot({
        sound: {
          realtime: 3.246,
          cpuLoad: 0.31,
          underruns: 2,
          underrunMs: 41.6,
          peak: 0.9994,
          clipping: 0.0123,
        },
      }),
    )

    const releve = events().find((e) => e.kind === 'sample')
    expect(releve?.data).toMatchObject({
      realtime: 3.25,
      cpu: 0.31,
      underruns: 2,
      underrunMs: 42,
      peak: 0.999,
      clipping: 0.0123,
    })
  })

  it('n’inscrit rien quand le profil joue des échantillons', () => {
    // Un zéro se lirait comme une mesure : « le son n'a rien coûté » au lieu de
    // « il n'y avait pas de synthèse ».
    const { collector, events } = setup()
    collector.observe(snapshot())

    const releve = events().find((e) => e.kind === 'sample')
    expect(releve?.data).not.toHaveProperty('realtime')
    expect(releve?.data).not.toHaveProperty('clipping')
  })
})

describe('le rapport est inscrit à l’instant où il change', () => {
  it('inscrit un passage, avec ce qu’on faisait à ce moment-là', () => {
    const { collector, events } = setup()
    collector.observe(snapshot({ at: 0, gear: 4, kmh: 70, rpm: 2800, load: 0.82 }))
    collector.observe(snapshot({ at: 1200, gear: 5, kmh: 72, rpm: 2310, load: 0.79 }))

    const passage = events().find((e) => e.kind === 'shift')
    expect(passage?.at).toBe(1200)
    expect(passage?.data).toMatchObject({ from: 4, to: 5, kmh: 72, rpm: 2310, load: 0.79 })
  })

  it('inscrit aussi les rétrogradages', () => {
    const { collector, events } = setup()
    collector.observe(snapshot({ at: 0, gear: 6 }))
    collector.observe(snapshot({ at: 800, gear: 4 }))

    const passage = events().find((e) => e.kind === 'shift')
    expect(passage?.data).toMatchObject({ from: 6, to: 4 })
  })

  it('distingue deux allers-retours de ce qu’un relevé décennal montrerait', () => {
    // C'est le cas qui a manqué le 10 septembre : entre deux relevés espacés de
    // dix secondes, quatre passages se voyaient comme un seul changement.
    const { collector, events } = setup()
    collector.observe(snapshot({ at: 0, gear: 5 }))
    for (const [at, gear] of [
      [1000, 6],
      [2000, 5],
      [3000, 6],
      [4000, 5],
    ] as const) {
      collector.observe(snapshot({ at, gear }))
    }

    const passages = events().filter((e) => e.kind === 'shift')
    expect(passages).toHaveLength(4)
    expect(passages.map((e) => e.at)).toEqual([1000, 2000, 3000, 4000])
  })

  it('ne dit rien quand le rapport ne bouge pas', () => {
    const { collector, events } = setup()
    collector.observe(snapshot({ at: 0, gear: 5 }))
    collector.observe(snapshot({ at: 500, gear: 5, kmh: 91 }))

    expect(events().filter((e) => e.kind === 'shift')).toHaveLength(0)
  })

  it('n’inscrit rien sans accord de dépôt', () => {
    const { collector, events } = setup('none')
    collector.observe(snapshot({ at: 0, gear: 4 }))
    collector.observe(snapshot({ at: 900, gear: 5 }))

    expect(events()).toHaveLength(0)
  })
})
