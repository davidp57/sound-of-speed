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

function state(over: Partial<EngineState> = {}): EngineState {
  return {
    rpm: 3000,
    kinematicRpm: 3000,
    load: 0.5,
    rpmFraction: 3000 / profile.engine.redlineRpm,
    firingHz: (3000 / 120) * profile.engine.cylinders,
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
      feel: { ...profile.feel, shiftJolt: { enabled: false, depth: 0.55 } },
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
