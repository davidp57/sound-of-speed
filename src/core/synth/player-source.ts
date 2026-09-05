/**
 * Le lecteur : un `AudioWorklet` qui vide une file de blocs.
 *
 * Il ne calcule rien. Le WebAssembly tourne dans un fil séparé et lui envoie
 * des blocs tout prêts ; lui se contente de les recopier dans la sortie et de
 * compter ce qui manque.
 *
 * **Pourquoi le calcul n'est pas ici.** Faire tourner le WebAssembly dans le
 * fil audio serait plus direct, et c'est ce que fait engine-sim. Mais le module
 * d'Emscripten ne peut pas s'instancier dans un `AudioWorkletGlobalScope` : il
 * n'y a ni `fetch`, ni chargement asynchrone, et l'option `AUDIO_WORKLET`
 * d'Emscripten passe par des fils WebAssembly, donc par `SharedArrayBuffer`,
 * donc par les en-têtes COOP/COEP — que le lot a explicitement écartés, le NAS
 * ne les servant pas.
 *
 * Ce qu'on y gagne au passage : une pointe de calcul mange la réserve au lieu
 * de faire un trou. Le fil audio, lui, ne fait jamais qu'une recopie.
 *
 * Le fil de calcul lui parle par un `MessagePort` dédié, transmis à la
 * construction. Passer par le fil principal marcherait aussi, mais un coup de
 * peinture de Vue s'intercalerait entre le calcul et le son.
 */
export const PLAYER_PROCESSOR = 'speed-synth-player'

export const PLAYER_SOURCE = `
class SynthPlayer extends AudioWorkletProcessor {
  constructor(options) {
    super()
    const opts = options.processorOptions || {}
    this.queue = []
    this.offset = 0
    this.queued = 0
    this.consumed = 0
    this.underruns = 0
    this.underrunFrames = 0
    this.inGap = false
    // Le lecteur demarre avant que le premier bloc soit calcule : sans ce
    // drapeau, la construction du moteur compterait comme un creux de sept
    // cents millisecondes, ce qui masquerait ceux qui comptent.
    this.started = false
    this.peak = 0
    this.ticks = 0
    // Mesure de brillance : energie au-dessus d'un kilohertz sur energie
    // totale. Le ticket demande que l'effort change le **timbre** et pas
    // seulement le niveau ; la machine ne peut pas en juger a l'oreille, mais
    // ce rapport-la se mesure, et il tranche.
    this.hpState = 0
    this.hpPrev = 0
    this.hpCoef = Math.exp((-2 * Math.PI * 1000) / sampleRate)
    this.sumHigh = 0
    this.sumAll = 0
    // Un compte rendu tous les huit tours, soit environ 21 ms a 48 kHz : assez
    // souvent pour que le fil de calcul suive la file, assez rare pour ne pas
    // noyer sa boucle de messages.
    this.reportEvery = opts.reportEvery || 8
    this.link = null
    this.port.onmessage = (event) => {
      const message = event.data
      if (message.type === 'link') {
        this.link = message.port
        this.link.onmessage = (inner) => this.receive(inner.data)
      } else if (message.type === 'flush') {
        this.queue = []
        this.offset = 0
        this.queued = 0
      }
    }
  }

  receive(message) {
    if (message.type !== 'block') return
    const block = new Float32Array(message.samples)
    this.queue.push(block)
    this.queued += block.length
    this.started = true
  }

  process(inputs, outputs) {
    const channels = outputs[0]
    const out = channels[0]
    let written = 0
    while (written < out.length) {
      const head = this.queue[0]
      if (head === undefined) break
      const take = Math.min(out.length - written, head.length - this.offset)
      out.set(head.subarray(this.offset, this.offset + take), written)
      this.offset += take
      written += take
      this.queued -= take
      this.consumed += take
      if (this.offset >= head.length) {
        this.queue.shift()
        this.offset = 0
      }
    }

    const missing = out.length - written
    if (missing > 0) {
      out.fill(0, written)
      if (this.started) {
        this.underrunFrames += missing
        if (!this.inGap) {
          this.underruns += 1
          this.inGap = true
        }
      }
    } else {
      this.inGap = false
    }

    for (let i = 0; i < out.length; i += 1) {
      const sample = out[i]
      const level = Math.abs(sample)
      if (level > this.peak) this.peak = level
      this.hpState = this.hpCoef * (this.hpState + sample - this.hpPrev)
      this.hpPrev = sample
      this.sumHigh += this.hpState * this.hpState
      this.sumAll += sample * sample
    }

    // Le meme signal sur toutes les voies : le synthetiseur est monophonique.
    for (let c = 1; c < channels.length; c += 1) channels[c].set(out)

    this.ticks += 1
    if (this.ticks >= this.reportEvery) {
      this.ticks = 0
      const report = {
        type: 'level',
        queued: this.queued,
        consumed: this.consumed,
        underruns: this.underruns,
        underrunFrames: this.underrunFrames,
        peak: this.peak,
        rms: Math.sqrt(this.sumAll / (this.reportEvery * out.length)),
        brightness: this.sumAll > 0 ? Math.sqrt(this.sumHigh / this.sumAll) : 0,
      }
      this.peak = 0
      this.sumHigh = 0
      this.sumAll = 0
      if (this.link !== null) this.link.postMessage(report)
      this.port.postMessage(report)
    }

    return true
  }
}

registerProcessor('${PLAYER_PROCESSOR}', SynthPlayer)
`
