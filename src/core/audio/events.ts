/**
 * Les bruits brefs d'un passage de rapport : le clac de la boîte, la pétarade.
 *
 * Ils vivaient dans le moteur à échantillons, et n'y étaient jouables que
 * lorsque la banque était chargée — `phase === 'ready'`. Un profil en synthèse
 * ne charge pas de banque et ouvre son propre contexte audio : les deux bruits
 * y étaient donc rigoureusement muets, alors que la trajectoire de régime, elle,
 * passait bien. David, après un essai sur le NAS : « ça ne marche pas pour les
 * moteurs en synthèse, juste ceux qui sont enregistrés ».
 *
 * Ils ne dépendent en réalité de rien d'autre qu'un contexte et un nœud où se
 * brancher. Les sortir ici les rend jouables des deux côtés, sans dupliquer la
 * recette — c'est le même son, pas deux sons qui se ressemblent.
 *
 * **Où se brancher compte autant que le son lui-même.** Sur la chaîne à
 * échantillons, ces bruits doivent entrer après le saturateur *et* après le
 * limiteur : la courbe du premier est indexée sur [-1, 1] et le moteur y sature
 * déjà, donc tout ce qui entre au-dessus en sort au même niveau ; le second
 * applique au signal entier la réduction que le moteur lui impose. Mesuré, un
 * clac dix fois trop fort ressortait à 0,00 dB d'écart du moteur.
 */

/** Bruit blanc réutilisable, une seconde, pour tous les événements. */
export function makeEventNoise(context: BaseAudioContext): AudioBuffer {
  const buffer = context.createBuffer(1, Math.floor(context.sampleRate), context.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1
  return data.length > 0 ? buffer : buffer
}

/**
 * Les trois composantes du clac : filtre, fréquence, résonance, gain, extinction.
 *
 * Trois et non une, parce qu'un seul filtre ne fait pas un choc. La masse sous
 * deux cents hertz, le corps du carter vers quatre cent cinquante, et juste
 * assez de médium vers douze cents pour qu'on entende une pièce et non un coup
 * sourd. Les extinctions sont inégales et volontairement longues : la masse
 * traîne quand le médium est déjà éteint, et c'est ce décalage qui fait entendre
 * une pièce lourde plutôt qu'une impulsion.
 *
 * **Une version aiguë et courte a été essayée d'abord, et jetée.** Elle plaçait
 * son énergie vers trois kilohertz et au-delà : mesurée par bandes d'octave, au
 * réglage où David la jugeait déjà trop forte, elle culminait à −4 dB du moteur
 * à huit kilohertz et à +13 dB à seize. « C'est le son qui est surtout trop sec,
 * aigu et court ; dans la vidéo c'est un son un peu plus long et surtout plus
 * sourd. » Celle-ci a son maximum dans le grave — mesuré en écart au moteur :
 * −5,7 dB à 125 Hz, −10,7 à 250, et seize décibels en dessous partout au-dessus
 * de deux kilohertz.
 */
const CLACK_PARTS: {
  type: BiquadFilterType
  hz: number
  q: number
  gain: number
  /** Constante de temps de l'extinction, en secondes. */
  decay: number
}[] = [
  { type: 'lowpass', hz: 200, q: 0.9, gain: 2.2, decay: 0.12 },
  { type: 'bandpass', hz: 450, q: 1.2, gain: 2.0, decay: 0.09 },
  { type: 'bandpass', hz: 1200, q: 1.0, gain: 0.75, decay: 0.05 },
]

/** Où et comment jouer un événement. */
export interface EventTarget {
  context: BaseAudioContext
  destination: AudioNode
  /** Bruit partagé, pour ne pas en fabriquer un par coup. */
  noise: AudioBuffer
}

/**
 * Le clac de la boîte quand le rapport s'engage.
 *
 * Rien à voir avec la pétarade, et c'est tout l'objet : celle-ci est un souffle
 * grave avec une queue de cinquante à cent vingt millisecondes — un bruit
 * d'échappement. Le clac est un **choc mécanique** : attaque en une milliseconde,
 * et de l'énergie sur toute la hauteur du spectre.
 */
export function playClack(target: EventTarget, intensity: number): void {
  if (intensity <= 0) return
  const { context, destination, noise } = target
  const at = context.currentTime + 0.001
  const level = Math.min(3, intensity)

  for (const part of CLACK_PARTS) {
    const source = context.createBufferSource()
    source.buffer = noise
    source.playbackRate.value = 0.9 + Math.random() * 0.25
    source.loop = true

    const filter = context.createBiquadFilter()
    filter.type = part.type
    filter.frequency.value = part.hz * (0.92 + Math.random() * 0.16)
    filter.Q.value = part.q

    const gain = context.createGain()
    const peak = Math.max(0.0002, level * part.gain)
    // L'attaque fait le choc : une milliseconde, pas quatre comme la pétarade.
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(peak, at + 0.001)
    // Une extinction à constante de temps, et non une rampe vers un millième :
    // la rampe descendait si vite que toute l'énergie du clac tenait dans sa
    // crête. Mesuré par bandes d'octave, il arrivait alors 24 à 40 dB sous le
    // moteur partout où l'oreille écoute, pour une crête pourtant supérieure à
    // la sienne. Une crête n'est pas un niveau.
    gain.gain.setTargetAtTime(0, at + 0.001, part.decay)

    source.connect(filter)
    filter.connect(gain)
    gain.connect(destination)
    source.start(at)
    source.stop(at + part.decay * 4 + 0.02)
  }
}

/**
 * Pétarade à l'échappement.
 *
 * Le claquement d'un imbrûlé qui prend feu : une impulsion brève, plutôt grave,
 * avec une queue de souffle. Synthétisée plutôt qu'échantillonnée — quelques
 * dizaines de millisecondes de bruit filtré suffisent, et cela évite de dépendre
 * d'un enregistrement que la banque ne contient pas, ni le moteur simulé.
 */
export function playBackfire(target: EventTarget, intensity: number, count: number): void {
  if (intensity <= 0 || count <= 0) return
  const { context, destination, noise } = target
  const now = context.currentTime

  for (let i = 0; i < count; i += 1) {
    // Les claquements ne sont jamais réguliers : c'est ce qui les distingue
    // d'un crépitement mécanique.
    const at = now + Math.random() * 0.28 + i * 0.045
    const duration = 0.05 + Math.random() * 0.07

    const source = context.createBufferSource()
    source.buffer = noise
    source.playbackRate.value = 0.7 + Math.random() * 0.6
    source.loop = true

    const band = context.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = 260 + Math.random() * 420
    band.Q.value = 1.4

    const gain = context.createGain()
    const peak = intensity * (0.5 + Math.random() * 0.5)
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + 0.004)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration)

    source.connect(band)
    band.connect(gain)
    gain.connect(destination)
    source.start(at)
    source.stop(at + duration + 0.02)
  }
}
