/**
 * Le moniteur de sortie : ce que les haut-parleurs reçoivent vraiment.
 *
 * Le lecteur compte déjà un niveau crête et un taux d'écrêtage, mais il les
 * relève **avant** le silencieux et la résonance d'échappement. Or c'est la
 * résonance qui fait déborder : mesuré le 8 septembre 2026 sur le Chevrolet 454
 * au ralenti, elle ajoute seize décibels à la bande de 500 Hz, et la crête passe
 * de 1,000 en sortie du lecteur à **1,194** en fin de graphe. Le contexte audio
 * borne à un : le dépassement s'entend, en bouffées d'aigu, et l'écran annonçait
 * pendant ce temps un sage 1,000.
 *
 * David, qui n'avait pas ce chiffre : « des frt frt frt à plus haute fréquence
 * que le moteur ». Un écrêtage bref, c'est exactement cela.
 *
 * Ce processeur ne modifie rien — il recopie son entrée dans sa sortie et
 * compte. Le mettre en fin de chaîne coûte une copie par échantillon, et c'est
 * le prix pour que le chiffre affiché soit celui du son qu'on entend.
 */

export const MONITOR_PROCESSOR = 'speed-synth-monitor'

export const MONITOR_SOURCE = `
class SynthMonitor extends AudioWorkletProcessor {
  constructor(options) {
    super()
    this.peak = 0
    this.clipped = 0
    this.frames = 0
    this.ticks = 0
    // Un compte rendu tous les huit tours, soit environ 21 ms : la même cadence
    // que le lecteur, pour que les deux chiffres se comparent.
    this.reportEvery = (options && options.processorOptions && options.processorOptions.reportEvery) || 8
  }

  process(inputs, outputs) {
    const input = inputs[0]
    const output = outputs[0]
    if (!input || input.length === 0) return true

    const source = input[0]
    for (let voie = 0; voie < output.length; voie += 1) {
      output[voie].set(source)
    }

    for (let i = 0; i < source.length; i += 1) {
      const niveau = Math.abs(source[i])
      if (niveau > this.peak) this.peak = niveau
      // Un échantillon à un ou au-delà est un échantillon que la sortie a
      // rogné : le contexte audio ne laisse rien passer plus haut.
      if (niveau >= 0.9999) this.clipped += 1
      this.frames += 1
    }

    this.ticks += 1
    if (this.ticks >= this.reportEvery) {
      this.ticks = 0
      this.port.postMessage({
        type: 'sortie',
        peak: this.peak,
        clipped: this.frames > 0 ? this.clipped / this.frames : 0,
      })
      this.peak = 0
      this.clipped = 0
      this.frames = 0
    }

    return true
  }
}

registerProcessor('${MONITOR_PROCESSOR}', SynthMonitor)
`
