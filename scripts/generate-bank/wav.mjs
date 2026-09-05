/**
 * Lecture et écriture de WAV en entier 16 bits, mono.
 *
 * Le strict nécessaire pour ce qu'écrit le banc natif et pour ce que
 * `decodeAudioData` sait lire dans le navigateur. Rien de plus : pas de
 * multicanal, pas de flottant, pas de morceau exotique.
 */

/** Décode un WAV 16 bits mono en échantillons flottants de -1 à 1. */
export function readWav(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (view.getUint32(0, false) !== 0x52494646) throw new Error('ce n’est pas un RIFF')
  if (view.getUint32(8, false) !== 0x57415645) throw new Error('ce n’est pas un WAVE')

  let offset = 12
  let sampleRate = 0
  let channels = 0
  let bits = 0
  let data = null

  while (offset + 8 <= view.byteLength) {
    const id = view.getUint32(offset, false)
    const size = view.getUint32(offset + 4, true)
    const body = offset + 8
    if (id === 0x666d7420) {
      channels = view.getUint16(body + 2, true)
      sampleRate = view.getUint32(body + 4, true)
      bits = view.getUint16(body + 14, true)
    } else if (id === 0x64617461) {
      data = { start: body, size }
    }
    offset = body + size + (size % 2)
  }

  if (data === null) throw new Error('morceau « data » absent')
  if (bits !== 16) throw new Error(`${bits} bits par échantillon, 16 attendus`)
  if (channels !== 1) throw new Error(`${channels} canaux, un seul attendu`)

  const count = Math.floor(data.size / 2)
  const samples = new Float32Array(count)
  for (let i = 0; i < count; i += 1) {
    samples[i] = view.getInt16(data.start + i * 2, true) / 32768
  }
  return { samples, sampleRate }
}

/** Encode des échantillons flottants en WAV 16 bits mono. */
export function writeWav(samples, sampleRate) {
  const bytes = new Uint8Array(44 + samples.length * 2)
  const view = new DataView(bytes.buffer)

  const ascii = (offset, text) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i))
  }

  ascii(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  ascii(8, 'WAVEfmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  ascii(36, 'data')
  view.setUint32(40, samples.length * 2, true)

  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]))
    // -32768 est atteignable, 32767 est le maximum positif : la conversion se
    // fait sur 32767 pour ne jamais déborder vers le négatif.
    view.setInt16(44 + i * 2, Math.round(clamped * 32767), true)
  }
  return bytes
}
