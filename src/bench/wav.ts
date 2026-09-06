/**
 * Écriture d'un fichier WAV, pour sortir du banc un extrait écoutable.
 *
 * Un tableau de chiffres ne dit pas si une distorsion s'entend. Le banc mesure,
 * ce module rend ce qu'il a mesuré en un fichier qu'on écoute au casque, à
 * l'écart de la voiture et de son bruit de roulement.
 */

/** Assemble des extraits bout à bout, séparés par un silence. */
export function concat(
  parts: AudioBuffer[],
  gapSeconds: number,
  sampleRate: number,
): Float32Array[] {
  const gap = Math.round(gapSeconds * sampleRate)
  const channels = Math.max(...parts.map((part) => part.numberOfChannels))
  const length = parts.reduce((total, part) => total + part.length + gap, 0)
  const out = Array.from({ length: channels }, () => new Float32Array(length))
  let at = 0
  for (const part of parts) {
    for (let channel = 0; channel < channels; channel += 1) {
      const source = part.getChannelData(Math.min(channel, part.numberOfChannels - 1))
      out[channel]?.set(source, at)
    }
    at += part.length + gap
  }
  return out
}

/**
 * Encode en WAV 16 bits.
 *
 * L'écrêtage est reproduit ici, et c'est le sujet : le format ne représente pas
 * ce qui dépasse la pleine échelle, exactement comme le convertisseur de
 * l'appareil.
 */
export function toWav(channels: Float32Array[], sampleRate: number): Blob {
  const count = channels.length
  const frames = channels[0]?.length ?? 0
  const bytes = frames * count * 2
  const buffer = new ArrayBuffer(44 + bytes)
  const view = new DataView(buffer)

  const ascii = (at: number, text: string): void => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(at + i, text.charCodeAt(i))
  }

  ascii(0, 'RIFF')
  view.setUint32(4, 36 + bytes, true)
  ascii(8, 'WAVE')
  ascii(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, count, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * count * 2, true)
  view.setUint16(32, count * 2, true)
  view.setUint16(34, 16, true)
  ascii(36, 'data')
  view.setUint32(40, bytes, true)

  let at = 44
  for (let frame = 0; frame < frames; frame += 1) {
    for (let channel = 0; channel < count; channel += 1) {
      const value = Math.max(-1, Math.min(1, channels[channel]?.[frame] ?? 0))
      view.setInt16(at, value < 0 ? value * 0x8000 : value * 0x7fff, true)
      at += 2
    }
  }
  return new Blob([buffer], { type: 'audio/wav' })
}

/**
 * Rogne l'extrait à la pleine échelle, comme le fait le convertisseur.
 *
 * À faire **avant** toute mise à niveau : normaliser d'abord déplacerait le point
 * où le signal écrête, et l'extrait ne porterait plus la distorsion qu'on veut
 * faire entendre.
 */
export function clip(buffer: AudioBuffer): AudioBuffer {
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel)
    for (let i = 0; i < data.length; i += 1) {
      data[i] = Math.max(-1, Math.min(1, data[i] ?? 0))
    }
  }
  return buffer
}

/** Niveau efficace d'un extrait, tous canaux confondus. */
export function rmsOf(buffer: AudioBuffer): number {
  let sum = 0
  let count = 0
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel)
    for (let i = 0; i < data.length; i += 1) {
      const value = data[i] ?? 0
      sum += value * value
      count += 1
    }
  }
  return count > 0 ? Math.sqrt(sum / count) : 0
}

/** Ramène un extrait à un niveau efficace visé, pour comparer deux versions à l'oreille. */
export function normalize(buffer: AudioBuffer, targetRms: number): AudioBuffer {
  let sum = 0
  let count = 0
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel)
    for (let i = 0; i < data.length; i += 1) {
      const value = data[i] ?? 0
      sum += value * value
      count += 1
    }
  }
  const rms = count > 0 ? Math.sqrt(sum / count) : 0
  if (rms === 0) return buffer
  const factor = targetRms / rms
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel)
    for (let i = 0; i < data.length; i += 1) data[i] = (data[i] ?? 0) * factor
  }
  return buffer
}
