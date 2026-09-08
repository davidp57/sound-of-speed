import { describe, expect, it } from 'vitest'

import { computeMix } from './mix'
import { createDefaultProfile, createRoadProfile } from '../preset/defaults'
import type { EngineState } from '../engine/engine'
import type { LayerPreset, Profile } from '../preset/schema'

/**
 * Tests du mixage.
 *
 * `computeMix` est une fonction pure : on lui donne un régime, une charge et un
 * jeu de couches, elle rend des gains et des vitesses de lecture. C'est donc le
 * module le plus facile à couvrir, et celui dont les règles sont les plus
 * faciles à casser en croyant les améliorer.
 *
 * Trois règles à tenir : les fondus se font à puissance constante, une couche
 * hors de son domaine jouable est réduite au silence, et le ralenti s'efface.
 */

const profile = createDefaultProfile()

/**
 * Le régime entendu suit le régime demandé, sauf mention contraire : l'écart
 * entre les deux est le tremblement, et il se vérifie à part, dans les tests du
 * moteur. Ici on veut mesurer le mixage à hauteur connue.
 */
function state(over: Partial<EngineState> = {}): EngineState {
  const rpm = over.rpm ?? 3000
  return {
    rpm,
    audibleRpm: rpm,
    kinematicRpm: rpm,
    load: 0.5,
    // L'effort suit la charge par défaut : les tests qui ne parlent que de
    // timbre n'ont pas à connaître la traînée, et ceux qui la mesurent le
    // disent explicitement.
    effort: over.effort ?? over.load ?? 0.5,
    rpmFraction: rpm / profile.engine.redlineRpm,
    firingHz: (rpm / 120) * profile.engine.cylinders,
    limiterActive: false,
    idling: false,
    ...over,
  }
}

function gainOf(layers: { key: string; gain: number }[], key: string): number {
  return layers.find((layer) => layer.key === key)?.gain ?? 0
}

/** Énergie d'une famille : la racine de la somme des carrés des gains. */
function energy(layers: { role: string; gain: number }[], role: string): number {
  return Math.sqrt(
    layers.filter((l) => l.role === role).reduce((total, l) => total + l.gain * l.gain, 0),
  )
}

/** Couche minimale, pour les cas où le profil livré ne convient pas. */
function layer(over: Partial<LayerPreset> & Pick<LayerPreset, 'key' | 'role'>): LayerPreset {
  return {
    file: `${over.key}.wav`,
    anchorRpm: 3000,
    gain: 1,
    minRate: 0.25,
    maxRate: 2,
    enabled: true,
    ...over,
  }
}

describe('computeMix — fondu de régime', () => {
  it('joue la couche basse seule sous le début de bascule', () => {
    const { layers } = computeMix(profile, state({ rpm: profile.mix.crossfadeLowRpm - 400 }))

    expect(gainOf(layers, 'on_low')).toBeGreaterThan(0)
    expect(gainOf(layers, 'on_high')).toBeCloseTo(0, 6)
  })

  it('joue la couche haute seule au-delà de la fin de bascule', () => {
    // Au-dessus de 7000 tr/min, la couche basse est de toute façon hors de son
    // domaine ; ce qui se vérifie ici, c'est que le fondu l'a déjà effacée.
    const { layers } = computeMix(profile, state({ rpm: profile.mix.crossfadeHighRpm + 200 }))

    expect(gainOf(layers, 'on_high')).toBeGreaterThan(0)
    expect(gainOf(layers, 'on_low')).toBeCloseTo(0, 6)
  })

  it('conserve l’énergie tout au long de la bascule', () => {
    // Deux couches ancrées au même régime, aux bornes larges : le seul effet
    // mesuré est alors celui du fondu, sans effacement de justesse.
    const p: Profile = {
      ...profile,
      layers: [
        layer({ key: 'basse', role: 'on', anchorRpm: 4000, minRate: 0.1, maxRate: 8 }),
        layer({ key: 'haute', role: 'on', anchorRpm: 4000, minRate: 0.1, maxRate: 8 }),
      ],
      // Relief neutralisé : le sujet de ce test est la conservation d'énergie
      // du fondu, qui se juge à relief égal. Le relief, lui, fait varier le
      // niveau avec le régime — c'est sa raison d'être, et il est vérifié à
      // part.
      mix: { ...profile.mix, loadContrast: 0, rpmReliefDb: 0, loadReliefDb: 0 },
    }

    const low = p.mix.crossfadeLowRpm
    const high = p.mix.crossfadeHighRpm
    const energies: number[] = []
    for (let step = 0; step <= 10; step += 1) {
      const rpm = low + ((high - low) * step) / 10
      energies.push(energy(computeMix(p, state({ rpm })).layers, 'on'))
    }

    // Fondu à puissance constante : l'énergie ne creuse pas à mi-course. Avec
    // une rampe linéaire, le milieu tomberait à environ 0,71 du bord.
    const reference = energies[0] ?? 0
    expect(reference).toBeGreaterThan(0)
    for (const value of energies) {
      expect(value / reference).toBeGreaterThan(0.99)
      expect(value / reference).toBeLessThan(1.01)
    }
  })

  it('fond entre les deux voisines quand il y a plus de deux couches', () => {
    const p: Profile = {
      ...profile,
      layers: [
        layer({ key: 'a', role: 'on', anchorRpm: 2000, minRate: 0.1, maxRate: 8 }),
        layer({ key: 'b', role: 'on', anchorRpm: 4000, minRate: 0.1, maxRate: 8 }),
        layer({ key: 'c', role: 'on', anchorRpm: 6000, minRate: 0.1, maxRate: 8 }),
      ],
    }

    // À 3000 tr/min, entre a et b : les deux jouent, c est muette.
    const { layers } = computeMix(p, state({ rpm: 3000 }))

    expect(gainOf(layers, 'a')).toBeGreaterThan(0)
    expect(gainOf(layers, 'b')).toBeGreaterThan(0)
    expect(gainOf(layers, 'c')).toBeCloseTo(0, 6)
  })

  it('ne joue qu’une couche quand la famille n’en a qu’une', () => {
    const p: Profile = {
      ...profile,
      layers: [layer({ key: 'seule', role: 'on', minRate: 0.1, maxRate: 8 })],
      mix: { ...profile.mix },
    }

    const { layers } = computeMix(p, state({ rpm: 5000 }))

    expect(layers).toHaveLength(1)
    expect(gainOf(layers, 'seule')).toBeGreaterThan(0)
  })
})

describe('computeMix — fondu de charge', () => {
  it('donne la main aux couches en charge quand on accélère', () => {
    const { layers, onWeight, offWeight } = computeMix(profile, state({ load: 1 }))

    expect(onWeight).toBeGreaterThan(offWeight / Math.max(1, profile.mix.offLoadGain))
    expect(energy(layers, 'on')).toBeGreaterThan(0)
  })

  it('donne la main aux couches pied levé quand on décélère', () => {
    const charge = computeMix(profile, state({ load: 1 }))
    const leve = computeMix(profile, state({ load: 0 }))

    expect(leve.onWeight).toBeLessThan(charge.onWeight)
    expect(leve.offWeight).toBeGreaterThan(charge.offWeight)
  })

  it('conserve l’énergie tout au long du fondu de charge', () => {
    // Le gain propre aux couches pied levé est un facteur de rattrapage du
    // niveau d'enregistrement : on le neutralise pour mesurer le fondu seul.
    const p: Profile = { ...profile, mix: { ...profile.mix, offLoadGain: 1, loadContrast: 1 } }

    for (let step = 0; step <= 10; step += 1) {
      const { onWeight, offWeight } = computeMix(p, state({ load: step / 10 }))
      expect(Math.hypot(onWeight, offWeight)).toBeCloseTo(1, 6)
    }
  })

  it('mélange les deux familles en permanence quand le contraste est nul', () => {
    const p: Profile = { ...profile, mix: { ...profile.mix, loadContrast: 0 } }

    const charge = computeMix(p, state({ load: 1 }))
    const leve = computeMix(p, state({ load: 0 }))

    // À contraste nul, la charge n'a plus de prise : les deux familles restent
    // au même niveau, et le moteur ne disparaît jamais.
    expect(charge.onWeight).toBeCloseTo(leve.onWeight, 6)
    expect(charge.offWeight).toBeCloseTo(leve.offWeight, 6)
  })

  it('sépare complètement les deux familles quand le contraste est à un', () => {
    const p: Profile = { ...profile, mix: { ...profile.mix, loadContrast: 1 } }

    expect(computeMix(p, state({ load: 1 })).offWeight).toBeCloseTo(0, 6)
    expect(computeMix(p, state({ load: 0 })).onWeight).toBeCloseTo(0, 6)
  })
})

describe('computeMix — domaine jouable', () => {
  it('borne la vitesse de lecture aux limites de la couche', () => {
    const p: Profile = {
      ...profile,
      layers: [layer({ key: 'etroite', role: 'on', anchorRpm: 4000, minRate: 0.8, maxRate: 1.25 })],
    }

    const bas = computeMix(p, state({ rpm: 1000 })).layers[0]
    const haut = computeMix(p, state({ rpm: 9000 })).layers[0]

    expect(bas?.rate).toBe(0.8)
    expect(haut?.rate).toBe(1.25)
  })

  it('efface une couche à mesure qu’elle sort de son domaine', () => {
    const p: Profile = {
      ...profile,
      layers: [layer({ key: 'etroite', role: 'on', anchorRpm: 4000, minRate: 0.9, maxRate: 1.1 })],
      // Relief neutralisé : on compare deux régimes, et le relief du régime
      // déplacerait le rapport qu'on mesure.
      mix: { ...profile.mix, loadContrast: 0, rpmReliefDb: 0, loadReliefDb: 0 },
    }

    // À l'ancrage, la couche est pleinement jouable.
    const juste = computeMix(p, state({ rpm: 4000 })).layers[0]

    // L'effacement est linéaire en octaves d'écart, et la tolérance est d'une
    // demi-octave : à un quart d'octave de bornage, il reste exactement la
    // moitié du gain. On vise donc le régime pour lequel la vitesse demandée
    // est un quart d'octave sous la borne basse.
    const rpmMoitie = 4000 * 0.9 * Math.pow(2, -0.25)
    const moitie = computeMix(p, state({ rpm: rpmMoitie })).layers[0]

    expect(juste?.gain).toBeGreaterThan(0)
    expect(moitie?.gain).toBeCloseTo((juste?.gain ?? 0) * 0.5, 6)
  })

  it('réduit au silence au-delà d’une demi-octave', () => {
    const p: Profile = {
      ...profile,
      layers: [layer({ key: 'etroite', role: 'on', anchorRpm: 4000, minRate: 0.99, maxRate: 1.01 })],
    }

    // Une octave plus bas : bien au-delà de la tolérance d'une demi-octave.
    const muette = computeMix(p, state({ rpm: 2000 })).layers[0]

    expect(muette?.gain).toBe(0)
  })

  it('signale le bornage seulement quand la couche est audible', () => {
    const p: Profile = {
      ...profile,
      layers: [layer({ key: 'etroite', role: 'on', anchorRpm: 4000, minRate: 0.9, maxRate: 1.1 })],
      mix: { ...profile.mix, loadContrast: 0 },
    }

    // Légèrement hors bornes mais encore bien audible : on veut le savoir.
    const audible = computeMix(p, state({ rpm: 4000 * 0.85 })).layers[0]
    expect(audible?.rateClamped).toBe(true)

    // Très loin, donc muette : inutile de faire clignoter le tableau.
    const muette = computeMix(p, state({ rpm: 1000 })).layers[0]
    expect(muette?.rateClamped).toBe(false)
  })

  it('lit à la vitesse exacte du rapport entre régime et ancrage', () => {
    const p: Profile = {
      ...profile,
      layers: [layer({ key: 'large', role: 'on', anchorRpm: 3000, minRate: 0.1, maxRate: 8 })],
    }

    expect(computeMix(p, state({ rpm: 6000 })).layers[0]?.rate).toBeCloseTo(2, 6)
    expect(computeMix(p, state({ rpm: 1500 })).layers[0]?.rate).toBeCloseTo(0.5, 6)
  })
})

describe('computeMix — régime entendu', () => {
  it('lit à la hauteur du régime entendu, non du régime net', () => {
    const p: Profile = {
      ...profile,
      layers: [layer({ key: 'large', role: 'on', anchorRpm: 3000, minRate: 0.1, maxRate: 8 })],
    }

    // C'est le tremblement qui sépare les deux : la couche doit suivre le régime
    // entendu, sans quoi le tremblement ne s'entendrait pas du tout.
    const r = computeMix(p, state({ rpm: 3000, audibleRpm: 3030 })).layers[0]

    expect(r?.rate).toBeCloseTo(1.01, 6)
  })
})

describe('computeMix — désaccord des couches', () => {
  /** Écart de hauteur entre deux vitesses de lecture, en centièmes de demi-ton. */
  const ecartCents = (a: number, b: number) => 1200 * Math.log2(b / a)

  /** Deux couches d'une même famille, ancrées au même régime et aux bornes larges. */
  const paire = (cents: number): Profile => ({
    ...profile,
    layers: [
      layer({ key: 'basse', role: 'on', anchorRpm: 3000, minRate: 0.1, maxRate: 8 }),
      layer({ key: 'haute', role: 'on', anchorRpm: 3000, minRate: 0.1, maxRate: 8 }),
    ],
    mix: { ...profile.mix, layerDetuneCents: cents },
  })

  it('désaccorde les deux couches d’une même famille', () => {
    const [basse, haute] = computeMix(paire(12), state({ rpm: 3000 })).layers

    // Douze centièmes de demi-ton, répartis de part et d'autre : la basse
    // descend de six, la haute monte de six.
    expect(ecartCents(basse?.rate ?? 0, haute?.rate ?? 0)).toBeCloseTo(12, 6)
    expect(ecartCents(1, basse?.rate ?? 0)).toBeCloseTo(-6, 6)
    expect(ecartCents(1, haute?.rate ?? 0)).toBeCloseTo(6, 6)
  })

  it('ne déplace pas la hauteur moyenne de la famille', () => {
    const [basse, haute] = computeMix(paire(12), state({ rpm: 3000 })).layers

    // La moyenne géométrique des deux vitesses reste celle du rapport exact :
    // le désaccord élargit le son, il ne fausse pas la justesse.
    expect(Math.sqrt((basse?.rate ?? 0) * (haute?.rate ?? 0))).toBeCloseTo(1, 9)
  })

  it('donne les vitesses d’avant à réglage nul', () => {
    const { layers } = computeMix(paire(0), state({ rpm: 4500 }))

    // Exactement le rapport entre régime et ancrage, au bit près : un profil
    // laissé à zéro sonne comme avant ce réglage.
    for (const entry of layers) expect(entry.rate).toBe(4500 / 3000)
  })

  it('produit un battement lent aux réglages livrés', () => {
    // Le battement entre deux couches désaccordées vaut la fréquence
    // d'allumage multipliée par l'écart relatif de hauteur. Mesuré sur Sport,
    // douze centièmes au milieu de la bascule — 5100 tr/min, 340 Hz
    // d'allumage : 2,4 Hz. Sur Route, huit centièmes à 3900 tr/min — 260 Hz :
    // 1,2 Hz.
    for (const [p, attendu] of [
      [createRoadProfile(), 1.2],
      [createDefaultProfile(), 2.4],
    ] as const) {
      const rpm = (p.mix.crossfadeLowRpm + p.mix.crossfadeHighRpm) / 2
      const on = computeMix(p, {
        ...state({ rpm, load: 0.8 }),
        firingHz: (rpm / 120) * p.engine.cylinders,
      }).layers.filter((l) => l.role === 'on')

      // Les deux couches sont ancrées à des régimes différents : leur rapport de
      // vitesses vaut donc le rapport des ancrages, au désaccord près.
      const anchors = p.layers
        .filter((l) => l.role === 'on')
        .map((l) => l.anchorRpm)
        .sort((a, b) => a - b)
      const exact = (anchors[0] ?? 1) / (anchors[1] ?? 1)
      const cents = ecartCents(exact, (on[1]?.rate ?? 0) / (on[0]?.rate ?? 1))
      expect(cents).toBeCloseTo(p.mix.layerDetuneCents, 6)

      const firing = (rpm / 120) * p.engine.cylinders
      const battement = firing * (Math.pow(2, p.mix.layerDetuneCents / 1200) - 1)
      expect(battement).toBeCloseTo(attendu, 1)
    }
  })

  it('donne toujours le même mixage pour la même situation', () => {
    // Le désaccord est constant par couche, il ne dépend pas du temps : sans
    // cela, l'écran de télémétrie afficherait deux valeurs différentes pour une
    // même situation et deviendrait illisible.
    const p = createDefaultProfile()
    const situation = state({ rpm: 4200, load: 0.7 })

    expect(computeMix(p, situation).layers).toEqual(computeMix(p, situation).layers)
  })

  it('ne sort pas une couche de son domaine jouable', () => {
    const p: Profile = {
      ...profile,
      layers: [
        layer({ key: 'basse', role: 'on', anchorRpm: 4000, minRate: 0.8, maxRate: 1.25 }),
        layer({ key: 'haute', role: 'on', anchorRpm: 4000, minRate: 0.8, maxRate: 1.25 }),
      ],
      mix: { ...profile.mix, layerDetuneCents: 50 },
    }

    // Aux deux bornes, un désaccord même large ne les franchit pas : il
    // s'applique après la décision de domaine et se borne aux mêmes limites.
    for (const rpm of [1000, 9000]) {
      for (const entry of computeMix(p, state({ rpm })).layers) {
        expect(entry.rate).toBeGreaterThanOrEqual(0.8)
        expect(entry.rate).toBeLessThanOrEqual(1.25)
      }
    }
  })

  it('ne touche à aucun gain', () => {
    // Le domaine jouable, et donc l'effacement qu'il commande, se décide sur la
    // hauteur que demande le régime — avant désaccord. Régler ce curseur ne peut
    // donc pas faire varier un niveau. Mesuré sur toute la plage du profil
    // Sport : écart de gain maximal nul, au bit près.
    const p = createDefaultProfile()
    const nul: Profile = { ...p, mix: { ...p.mix, layerDetuneCents: 0 } }

    for (let rpm = 600; rpm <= 8500; rpm += 25) {
      for (const load of [0, 0.5, 1]) {
        const avec = computeMix(p, state({ rpm, load })).layers
        const sans = computeMix(nul, state({ rpm, load })).layers
        expect(avec.map((l) => l.gain)).toEqual(sans.map((l) => l.gain))
      }
    }
  })

  it('n’applique aucun désaccord à une famille d’une seule couche', () => {
    const p: Profile = {
      ...profile,
      layers: [layer({ key: 'seule', role: 'on', anchorRpm: 3000, minRate: 0.1, maxRate: 8 })],
      mix: { ...profile.mix, layerDetuneCents: 25 },
    }

    // Il n'y a personne avec qui battre : la couche reste juste.
    expect(computeMix(p, state({ rpm: 3000 })).layers[0]?.rate).toBe(1)
  })

  it('donne aux profils livrés un désaccord qui suit leur caractère', () => {
    expect(createDefaultProfile().mix.layerDetuneCents).toBeGreaterThan(
      createRoadProfile().mix.layerDetuneCents,
    )
  })
})

describe('computeMix — ralenti et rupteur', () => {
  it('fait jouer le ralenti quand le moteur n’est pas entraîné', () => {
    const p: Profile = {
      ...profile,
      layers: [layer({ key: 'ralenti', role: 'idle', anchorRpm: profile.engine.idleRpm })],
    }

    const { idleWeight } = computeMix(p, state({ rpm: profile.engine.idleRpm, idling: true }))

    expect(idleWeight).toBeCloseTo(1, 2)
  })

  it('efface le ralenti au-delà de son régime d’effacement', () => {
    const p: Profile = {
      ...profile,
      layers: [layer({ key: 'ralenti', role: 'idle', anchorRpm: profile.engine.idleRpm })],
    }

    const efface = computeMix(p, state({ rpm: profile.mix.idleFadeOutRpm + 100, idling: true }))
    expect(efface.idleWeight).toBe(0)
    expect(gainOf(efface.layers, 'ralenti')).toBe(0)

    // Et à mi-chemin, il est en cours d'effacement.
    const milieu = computeMix(
      p,
      state({ rpm: (profile.engine.idleRpm + profile.mix.idleFadeOutRpm) / 2, idling: true }),
    )
    expect(milieu.idleWeight).toBeGreaterThan(0)
    expect(milieu.idleWeight).toBeLessThan(1)
  })

  it('coupe le ralenti dès que les roues mènent le moteur', () => {
    const p: Profile = {
      ...profile,
      layers: [layer({ key: 'ralenti', role: 'idle', anchorRpm: profile.engine.idleRpm })],
    }

    const { idleWeight } = computeMix(p, state({ rpm: profile.engine.idleRpm, idling: false }))

    expect(idleWeight).toBe(0)
  })

  it('ne fait jouer le rupteur que lorsqu’il coupe', () => {
    const muet = computeMix(profile, state({ rpm: 8300, limiterActive: false }))
    const actif = computeMix(profile, state({ rpm: 8300, limiterActive: true }))

    expect(muet.limiterWeight).toBe(0)
    expect(gainOf(muet.layers, 'limiter')).toBe(0)
    expect(actif.limiterWeight).toBe(1)
    expect(gainOf(actif.layers, 'limiter')).toBeGreaterThan(0)
  })
})

describe('computeMix — à-coup de passage', () => {
  it('creuse le niveau au milieu du passage, puis le rend', () => {
    const debut = computeMix(profile, state(), { isShifting: true, progress: 0 })
    const milieu = computeMix(profile, state(), { isShifting: true, progress: 0.5 })
    const fin = computeMix(profile, state(), { isShifting: true, progress: 1 })

    const niveau = (r: ReturnType<typeof computeMix>) => energy(r.layers, 'on')
    expect(niveau(milieu)).toBeLessThan(niveau(debut) * 0.9)
    expect(niveau(fin)).toBeCloseTo(niveau(debut), 6)
  })

  it('laisse le rupteur intact pendant le passage', () => {
    const sansPassage = computeMix(profile, state({ limiterActive: true }))
    const pendant = computeMix(profile, state({ limiterActive: true }), {
      isShifting: true,
      progress: 0.5,
    })

    expect(gainOf(pendant.layers, 'limiter')).toBeCloseTo(
      gainOf(sansPassage.layers, 'limiter'),
      6,
    )
  })

  it('ne creuse rien quand l’à-coup est désactivé', () => {
    const p: Profile = {
      ...profile,
      feel: { ...profile.feel, shiftJolt: { enabled: false, depth: 0.55, cutDepth: 0.8, dipRpm: 450, blipRpm: 550, clack: 0.6, clackDownshift: 0.55, crackle: 0.35 } },
    }

    const milieu = computeMix(p, state(), { isShifting: true, progress: 0.5 })
    const repos = computeMix(p, state())

    expect(energy(milieu.layers, 'on')).toBeCloseTo(energy(repos.layers, 'on'), 6)
  })
})

describe('computeMix — couches désactivées', () => {
  it('ne fait jamais jouer une couche désactivée', () => {
    const p: Profile = {
      ...profile,
      layers: profile.layers.map((l) => ({ ...l, enabled: l.key !== 'on_high' })),
    }

    for (const rpm of [1000, 3000, 5000, 8000]) {
      const { layers } = computeMix(p, state({ rpm }))
      expect(layers.some((l) => l.key === 'on_high')).toBe(false)
    }
  })

  it('reste silencieux quand toutes les couches sont désactivées', () => {
    const p: Profile = { ...profile, layers: profile.layers.map((l) => ({ ...l, enabled: false })) }

    expect(computeMix(p, state()).layers).toHaveLength(0)
  })
})

// Le volume général n'est plus ici : c'est un niveau de sortie, appliqué sur le
// bus du graphe audio et non une règle de mixage. Il n'y a donc plus rien à en
// vérifier dans cette fonction — et c'est le but : les gains rendus décrivent
// l'équilibre entre les couches, que le volume ne déplace pas.

describe('computeMix — relief', () => {
  /** Niveau d'ensemble, toutes couches confondues. */
  const total = (r: ReturnType<typeof computeMix>) =>
    Math.sqrt(r.layers.reduce((a, l) => a + l.gain * l.gain, 0))
  /** Écart entre deux niveaux, en décibels. */
  const ecartDb = (a: number, b: number) => 20 * Math.log10(a / b)

  /** Un profil dont on ne garde qu'une couche : le relief seul est mesurable. */
  const nu = (mix: Partial<Profile['mix']> = {}): Profile => ({
    ...profile,
    layers: [layer({ key: 'seule', role: 'on', anchorRpm: 3000, minRate: 0.1, maxRate: 8 })],
    // Contraste nul : le fondu de charge ne bouge plus, seul le relief varie.
    // Les deux sont indépendants, et c'est ce qui permet de les régler l'un
    // après l'autre.
    mix: { ...profile.mix, loadContrast: 0, ...mix },
  })

  it('fait entendre l’effort, ce que les fondus ne font pas', () => {
    // Le fondu de charge est à puissance constante : sans relief, écraser et
    // lever le pied donnent le même niveau. Mesuré sur le profil livré avant ce
    // réglage : ralenti, croisière, reprise douce et reprise franche tenaient
    // dans 1,3 dB.
    const p = nu({ loadReliefDb: 4, rpmReliefDb: 0 })

    const ecrase = total(computeMix(p, state({ load: 1 })))
    const leve = total(computeMix(p, state({ load: 0 })))

    // Quatre décibels de part et d'autre, donc huit d'écart.
    expect(ecartDb(ecrase, leve)).toBeCloseTo(8, 1)
  })

  it('ne touche à rien en croisière', () => {
    // La charge à mi-course est le point neutre : c'est autour d'elle que le
    // relief se déploie, pour que le réglage ne change pas le niveau moyen.
    const avec = total(computeMix(nu({ loadReliefDb: 6 }), state({ load: 0.5 })))
    const sans = total(computeMix(nu({ loadReliefDb: 0 }), state({ load: 0.5 })))

    expect(ecartDb(avec, sans)).toBeCloseTo(0, 6)
  })

  it('fait rugir le moteur à mesure qu’il monte', () => {
    const p = nu({ rpmReliefDb: 6, loadReliefDb: 0 })

    const bas = total(computeMix(p, state({ rpm: profile.engine.idleRpm })))
    const haut = total(computeMix(p, state({ rpm: profile.engine.redlineRpm })))

    expect(ecartDb(haut, bas)).toBeCloseTo(6, 1)
  })

  it('monte régulièrement du ralenti au rupteur', () => {
    const p = nu({ rpmReliefDb: 6, loadReliefDb: 0 })
    const { idleRpm, redlineRpm } = profile.engine

    let precedent = 0
    for (let part = 0; part <= 10; part += 1) {
      const rpm = idleRpm + ((redlineRpm - idleRpm) * part) / 10
      const niveau = total(computeMix(p, state({ rpm })))
      expect(niveau).toBeGreaterThan(precedent)
      precedent = niveau
    }
  })

  it('baisse le ralenti, et lui seul', () => {
    const p = nu({ idleLevelDb: -6, rpmReliefDb: 0, loadReliefDb: 0 })

    const auRalenti = total(computeMix(p, state({ rpm: 1200, idling: true })))
    const entraine = total(computeMix(p, state({ rpm: 1200, idling: false })))

    expect(ecartDb(auRalenti, entraine)).toBeCloseTo(-6, 1)
  })

  it('ne change rien quand les trois reliefs sont à zéro', () => {
    // Un profil venu d'une version antérieure les recevra à zéro par défaut si
    // rien ne les renseigne : le son doit alors être exactement celui d'avant.
    const neutre = nu({ loadReliefDb: 0, rpmReliefDb: 0, idleLevelDb: 0 })

    for (const load of [0, 0.5, 1]) {
      for (const rpm of [800, 3000, 7000]) {
        const r = computeMix(neutre, state({ rpm, load }))
        const attendu = computeMix(neutre, state({ rpm, load }))
        expect(total(r)).toBeCloseTo(total(attendu), 9)
      }
    }
    // Et le niveau ne dépend alors plus du régime.
    const bas = total(computeMix(neutre, state({ rpm: 3000, load: 0.5 })))
    const haut = total(computeMix(neutre, state({ rpm: 3200, load: 0.5 })))
    expect(ecartDb(haut, bas)).toBeCloseTo(0, 6)
  })

  it('donne aux profils livrés un relief qui suit leur caractère', () => {
    const route = createRoadProfile()
    const sport = createDefaultProfile()

    // Sport exagère l'effort et rugit davantage.
    expect(sport.mix.loadReliefDb).toBeGreaterThan(route.mix.loadReliefDb)
    expect(sport.mix.rpmReliefDb).toBeGreaterThan(route.mix.rpmReliefDb)
    // Et la compensation des prises plus douces vit dans les couches, non dans
    // un facteur commun à la famille.
    for (const p of [route, sport]) {
      expect(p.mix.offLoadGain).toBe(1)
      const off = p.layers.filter((l) => l.role === 'off')
      expect(off.every((l) => l.gain > 1.5)).toBe(true)
    }
  })
})

/**
 * La coupure de couple d'un passage de rapport.
 *
 * Le creux de niveau ne suffisait pas : mesuré sur le profil Route, un passage
 * baissait le son de 3,7 dB sans rien changer d'autre. L'effort, lui, restait à
 * 1,000 du début à la fin, parce qu'il se déduit de l'accélération et que la
 * voiture, elle, ne coupe rien — elle est électrique et continue d'avancer
 * pendant que la boîte imaginaire change de rapport. Le fondu vers les couches
 * pied levé ne basculait donc jamais, et le passage gardait le timbre de la
 * pleine charge.
 */
describe('computeMix — coupure de couple au passage', () => {
  it('fait basculer le timbre vers pied levé pendant le passage', () => {
    const chargé = state({ effort: 1, load: 1 })

    const repos = computeMix(profile, chargé)
    const milieu = computeMix(profile, chargé, { isShifting: true, progress: 0.5 })

    expect(milieu.offWeight).toBeGreaterThan(repos.offWeight * 2)
    expect(milieu.onWeight).toBeLessThan(repos.onWeight)
  })

  it('rend le timbre de pleine charge dès la fin du passage', () => {
    const chargé = state({ effort: 1, load: 1 })

    const repos = computeMix(profile, chargé)
    const fin = computeMix(profile, chargé, { isShifting: true, progress: 1 })

    expect(fin.onWeight).toBeCloseTo(repos.onWeight, 6)
  })

  it('ne coupe rien quand la profondeur est nulle', () => {
    const p: Profile = {
      ...profile,
      feel: { ...profile.feel, shiftJolt: { ...profile.feel.shiftJolt, cutDepth: 0 } },
    }
    const chargé = state({ effort: 1, load: 1 })

    const repos = computeMix(p, chargé)
    const milieu = computeMix(p, chargé, { isShifting: true, progress: 0.5 })

    expect(milieu.onWeight).toBeCloseTo(repos.onWeight, 6)
  })

  it("ne coupe rien quand l'à-coup est désactivé", () => {
    const p: Profile = {
      ...profile,
      feel: { ...profile.feel, shiftJolt: { ...profile.feel.shiftJolt, enabled: false } },
    }
    const chargé = state({ effort: 1, load: 1 })

    const repos = computeMix(p, chargé)
    const milieu = computeMix(p, chargé, { isShifting: true, progress: 0.5 })

    expect(milieu.onWeight).toBeCloseTo(repos.onWeight, 6)
  })
})
