import { describe, expect, it } from 'vitest'

import { analyzeSample } from './analyze'

/**
 * Tests de l'analyse d'échantillon.
 *
 * On fabrique un signal dont la raie d'allumage est connue par construction :
 * un régime choisi, converti en fréquence par `régime ÷ 120 × cylindres`, avec
 * ses harmoniques. L'analyse doit retrouver ce régime.
 *
 * Elle rend plusieurs candidats classés, et c'est voulu : aucun critère
 * purement spectral ne tranche l'ambiguïté d'octave sur un signal de moteur.
 * Les tests vérifient donc que le bon régime **figure parmi** les candidats,
 * pas qu'il arrive premier — exiger cela reviendrait à exiger du module une
 * certitude qu'il déclare ne pas avoir.
 */

/**
 * Faux AudioBuffer.
 *
 * `analyzeSample` n'utilise que cinq propriétés d'un AudioBuffer. Les fournir
 * évite de dépendre du Web Audio, donc d'un navigateur : c'est la couture la
 * plus haute disponible, et elle est déjà là.
 */
function fakeBuffer(channels: Float32Array[], sampleRate: number): AudioBuffer {
  const length = channels[0]?.length ?? 0
  return {
    sampleRate,
    length,
    duration: length / sampleRate,
    numberOfChannels: channels.length,
    getChannelData: (channel: number) => channels[channel] ?? new Float32Array(length),
  } as unknown as AudioBuffer
}

/**
 * Signal de moteur synthétique : une fondamentale à la fréquence d'allumage,
 * plus quelques harmoniques décroissantes, comme un moteur réel.
 */
function engineTone(options: {
  rpm: number | ((t: number) => number)
  cylinders: number
  seconds?: number
  sampleRate?: number
  channels?: number
  harmonics?: number
}): AudioBuffer {
  const sampleRate = options.sampleRate ?? 48000
  const seconds = options.seconds ?? 1.5
  const length = Math.floor(sampleRate * seconds)
  const rpmAt = typeof options.rpm === 'function' ? options.rpm : () => options.rpm as number
  const harmonics = options.harmonics ?? 6

  const data = new Float32Array(length)
  // Intégration de la phase : indispensable dès que le régime varie, sinon la
  // fréquence instantanée ne serait pas celle qu'on croit imposer.
  let phase = 0
  for (let i = 0; i < length; i += 1) {
    const t = i / sampleRate
    const firingHz = (rpmAt(t) / 120) * options.cylinders
    phase += (2 * Math.PI * firingHz) / sampleRate
    let value = 0
    for (let h = 1; h <= harmonics; h += 1) value += Math.sin(phase * h) / h
    data[i] = value * 0.3
  }

  const channels = Array.from({ length: options.channels ?? 1 }, () => data)
  return fakeBuffer(channels, sampleRate)
}

/** Le candidat le plus proche d'un régime attendu, en écart relatif. */
function closestError(candidates: { rpm: number }[], expected: number): number {
  return Math.min(...candidates.map((c) => Math.abs(c.rpm - expected) / expected))
}

describe('analyzeSample — régime', () => {
  it('retrouve le régime d’un signal fabriqué', () => {
    const buffer = engineTone({ rpm: 3000, cylinders: 8 })

    const analysis = analyzeSample(buffer, 8)

    expect(analysis.candidates.length).toBeGreaterThan(0)
    // À 2 % près : la grille de recherche avance par pas de 0,25 %.
    expect(closestError(analysis.candidates, 3000)).toBeLessThan(0.02)
  })

  it('retrouve un régime élevé aussi bien qu’un régime bas', () => {
    for (const rpm of [1200, 5000, 7500]) {
      const analysis = analyzeSample(engineTone({ rpm, cylinders: 8 }), 8)
      expect(closestError(analysis.candidates, rpm)).toBeLessThan(0.02)
    }
  })

  it('déplace l’ancrage dans le même rapport quand les cylindres sont faux', () => {
    // Le comportement documenté : le nombre de cylindres ne change pas le son,
    // il convertit la raie d'allumage en régime. Doubler le nombre déclaré
    // divise donc par deux le régime proposé pour la même raie.
    const buffer = engineTone({ rpm: 3000, cylinders: 8 })

    const juste = analyzeSample(buffer, 8)
    const double = analyzeSample(buffer, 16)

    expect(closestError(juste.candidates, 3000)).toBeLessThan(0.02)
    expect(closestError(double.candidates, 1500)).toBeLessThan(0.02)
  })

  it('rapporte la fréquence d’allumage de chaque candidat', () => {
    const analysis = analyzeSample(engineTone({ rpm: 4000, cylinders: 8 }), 8)

    for (const candidate of analysis.candidates) {
      // Le régime rendu est arrondi au tour près, la fréquence ne l'est pas :
      // l'écart attendu est celui de cet arrondi, soit 0,03 Hz au plus.
      expect(candidate.firingHz).toBeCloseTo((candidate.rpm / 120) * 8, 1)
    }
  })

  it('classe les candidats par vraisemblance décroissante', () => {
    const analysis = analyzeSample(engineTone({ rpm: 3000, cylinders: 8 }), 8)
    const scores = analysis.candidates.map((c) => c.relativeScore)

    expect(scores[0]).toBeCloseTo(1, 6)
    for (let i = 1; i < scores.length; i += 1) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]!)
    }
  })

  it('propose des candidats distincts, pas plusieurs points du même sommet', () => {
    const analysis = analyzeSample(engineTone({ rpm: 3000, cylinders: 8 }), 8)
    const rpms = analysis.candidates.map((c) => c.rpm).sort((a, b) => a - b)

    for (let i = 1; i < rpms.length; i += 1) {
      // Au moins 12 % d'écart entre deux candidats retenus.
      expect(Math.log(rpms[i]! / rpms[i - 1]!)).toBeGreaterThan(0.11)
    }
  })
})

describe('analyzeSample — prise stable ou en rampe', () => {
  it('déclare stable une prise à régime constant', () => {
    const analysis = analyzeSample(engineTone({ rpm: 3000, cylinders: 8, seconds: 2 }), 8)

    expect(analysis.steady).toBe(true)
    expect(Math.abs(analysis.endRpm - analysis.startRpm) / analysis.startRpm).toBeLessThan(0.08)
  })

  it('déclare non stable une montée en régime', () => {
    // De 2500 à 4500 tr/min sur deux secondes : une rampe franche, comme une
    // prise en accélération.
    const analysis = analyzeSample(
      engineTone({ rpm: (t) => 2500 + t * 1000, cylinders: 8, seconds: 2 }),
      8,
    )

    expect(analysis.steady).toBe(false)
    expect(analysis.endRpm).toBeGreaterThan(analysis.startRpm)
  })
})

describe('analyzeSample — mesures du fichier', () => {
  it('rapporte durée, fréquence d’échantillonnage et nombre de canaux', () => {
    const analysis = analyzeSample(
      engineTone({ rpm: 3000, cylinders: 8, seconds: 1.25, sampleRate: 44100, channels: 2 }),
      8,
    )

    expect(analysis.sampleRate).toBe(44100)
    expect(analysis.channels).toBe(2)
    expect(analysis.durationS).toBeCloseTo(1.25, 2)
  })

  it('mesure un raccord franc et un raccord propre', () => {
    const sampleRate = 48000
    const length = sampleRate

    // Boucle propre : le signal revient à zéro à la fin comme au début.
    const propre = new Float32Array(length)
    for (let i = 0; i < length; i += 1) {
      propre[i] = Math.sin((2 * Math.PI * 100 * i) / sampleRate) * 0.5
    }

    // Raccord franc : la fin est loin du début.
    const franc = Float32Array.from(propre)
    franc[length - 1] = 0.5

    expect(analyzeSample(fakeBuffer([propre], sampleRate), 8).seamRatio).toBeLessThan(0.05)
    expect(analyzeSample(fakeBuffer([franc], sampleRate), 8).seamRatio).toBeGreaterThan(0.5)
  })

  it('mesure le niveau crête', () => {
    const sampleRate = 48000
    const data = new Float32Array(sampleRate)
    // Le crête est relevé par pas de 31 échantillons : on remplit tout le
    // fichier pour ne pas dépendre de l'endroit où tombe le pas.
    for (let i = 0; i < data.length; i += 1) {
      data[i] = Math.sin((2 * Math.PI * 220 * i) / sampleRate) * 0.4
    }

    const analysis = analyzeSample(fakeBuffer([data], sampleRate), 8)

    expect(analysis.peak).toBeGreaterThan(0.35)
    // 0,4 n'est pas représentable exactement en simple précision.
    expect(analysis.peak).toBeCloseTo(0.4, 6)
  })

  it('ordonne deux prises par leur timbre', () => {
    // Le centroïde ne donne pas le régime, mais il ordonne fiablement deux
    // prises du même moteur : c'est à cela qu'il sert, en garde-fou.
    const bas = analyzeSample(engineTone({ rpm: 2000, cylinders: 8 }), 8)
    const haut = analyzeSample(engineTone({ rpm: 6000, cylinders: 8 }), 8)

    expect(haut.centroidHz).toBeGreaterThan(bas.centroidHz)
  })

  it('accepte un fichier plus court qu’une fenêtre d’analyse', () => {
    // 32768 points de fenêtre, soit 0,68 s à 48 kHz : un fichier plus court ne
    // doit pas faire échouer l'analyse, seulement la rendre moins sûre.
    const analysis = analyzeSample(engineTone({ rpm: 3000, cylinders: 8, seconds: 0.3 }), 8)

    expect(Number.isFinite(analysis.peak)).toBe(true)
    expect(analysis.candidates.length).toBeGreaterThan(0)
  })

  it('ne rend aucun candidat sur un fichier silencieux', () => {
    const silence = new Float32Array(48000)

    const analysis = analyzeSample(fakeBuffer([silence], 48000), 8)

    expect(analysis.candidates).toHaveLength(0)
    expect(analysis.peak).toBe(0)
    expect(analysis.seamRatio).toBe(0)
  })
})
