import { SliceBuffer, type Slice } from '../upload/slicing'

/**
 * La capture continue d'un trajet.
 *
 * Elle enregistre ce qui entre dans la chaîne et ce qui en sort, à la cadence
 * de la source, pour qu'un trajet réel puisse être rejoué et examiné au bureau.
 *
 * **Pourquoi elle remplace la capture manuelle.** Le mécanisme précédent
 * demandait d'appuyer sur un bouton avant de partir. Le 10 septembre 2026,
 * David a roulé trente-six minutes : le journal est bien remonté, la trace
 * n'existait pas. Le transport était en place depuis des jours — c'est le geste
 * qui manquait. Un enregistrement qu'il faut penser à démarrer n'est pas un
 * enregistrement.
 *
 * **L'entrée et la sortie.** L'entrée seule suffirait à rejouer, puisque tout le
 * reste se recalcule. La sortie est là pour une autre raison : comparer ce que
 * la chaîne a produit ce jour-là à ce qu'elle produit aujourd'hui montre les
 * régressions, et rien d'autre dans ce projet ne les montre.
 *
 * **L'en-tête est réécrit à chaque tranche.** Quatre kilo-octets sur trois
 * cents : une tranche isolée doit dire dans quelle configuration elle a été
 * enregistrée, faute de quoi la deuxième moitié d'un trajet ne se relit pas
 * seule.
 *
 * Cette pièce ne connaît ni le réseau ni l'horloge du système : elle reçoit le
 * temps et rend des tranches, comme le journal.
 */

/** Un instant du trajet : ce que la source a émis, et ce que la chaîne en a fait. */
export interface CaptureSample {
  /** Millisecondes depuis le début de la session. */
  at: number
  /** Vitesse brute, en km/h, telle que la source la rapporte. */
  kmh: number
  /** Précision horizontale en mètres, quand la source la connaît. */
  acc: number | null
  /** Vrai si la vitesse a été déduite de deux positions plutôt que lue. */
  der: boolean
  /** Vitesse conditionnée, celle qui pilote le reste. */
  out: number
  /** Accélération, en m/s². */
  ms2: number
  rpm: number
  gear: number
  load: number
}

/** Un fait daté qui n'est pas un relevé : un changement de profil, une erreur. */
export interface CaptureEvent {
  at: number
  kind: string
  data: Record<string, unknown>
}

export type CaptureLine = CaptureSample | CaptureEvent

/** Ce qui décrit la session, réécrit en tête de chaque tranche. */
export type CaptureHeader = Record<string, unknown>

export interface CaptureOptions {
  /** Le même identifiant que le journal : c'est ce qui apparie les deux. */
  sessionId: string
  startedAt: number
  /** Appelé à chaque tranche : la configuration peut avoir changé. */
  header: () => CaptureHeader
  sliceAfterMs?: number
  sliceAtBytes?: number
  maxPending?: number
}

/**
 * Quatre cent mille octets.
 *
 * Bien plus haut que le seuil du journal, et c'est voulu : à dix relevés par
 * seconde, trente kilo-octets seraient atteints en une demi-minute et
 * produiraient soixante fichiers par trajet. Ici, c'est la durée qui découpe, et
 * la taille n'est qu'un garde-fou pour une source anormalement bavarde.
 */
const SLICE_AT_BYTES = 400_000

/**
 * Cent mille relevés : près de trois heures à dix par seconde.
 *
 * Le plafond protège la mémoire quand le réseau manque longtemps. Il est plus
 * haut que celui du journal parce qu'un relevé de capture vaut la moitié d'un
 * événement de journal, et qu'en perdre revient à trouer le trajet.
 */
const MAX_PENDING = 100_000

export class Capture {
  private readonly buffer: SliceBuffer<CaptureLine>

  constructor(options: CaptureOptions) {
    this.buffer = new SliceBuffer<CaptureLine>({
      sessionId: options.sessionId,
      startedAt: options.startedAt,
      ...(options.sliceAfterMs === undefined ? {} : { sliceAfterMs: options.sliceAfterMs }),
      sliceAtBytes: options.sliceAtBytes ?? SLICE_AT_BYTES,
      maxPending: options.maxPending ?? MAX_PENDING,
      serialize: (line) => JSON.stringify(line),
      parse: parseLine,
      dropNotice: (count, now) => ({
        at: Math.round(now),
        kind: 'error',
        data: { dropped: count, why: 'plafond de la capture atteint' },
      }),
      header: () => [JSON.stringify({ kind: 'header', ...options.header() })],
    })
  }

  get pendingCount(): number {
    return this.buffer.pendingCount
  }

  get droppedCount(): number {
    return this.buffer.droppedCount
  }

  /** Retient un relevé. */
  add(sample: CaptureSample): void {
    this.buffer.add({ ...sample, at: Math.round(sample.at) })
  }

  /** Retient un fait daté : un changement de profil, une coupure de source. */
  note(at: number, kind: string, data: Record<string, unknown> = {}): void {
    this.buffer.add({ at: Math.round(at), kind, data })
  }

  shouldSlice(now: number): boolean {
    return this.buffer.shouldSlice(now)
  }

  takeSlice(now: number): Slice | null {
    return this.buffer.takeSlice(now)
  }

  restore(slice: Slice): void {
    this.buffer.restore(slice)
  }
}

/**
 * Une ligne de fichier vers ce qu'elle porte.
 *
 * L'en-tête rend `null` : il est réécrit à chaque tranche, et le garder ferait
 * qu'une tranche rendue puis reprise en porterait deux.
 */
function parseLine(ligne: string): CaptureLine | null {
  try {
    const parsed: unknown = JSON.parse(ligne)
    if (typeof parsed !== 'object' || parsed === null) return null
    const candidate = parsed as Partial<CaptureSample & CaptureEvent>
    if (candidate.kind === 'header') return null
    if (typeof candidate.at !== 'number') return null
    if (typeof candidate.kind === 'string') {
      return {
        at: candidate.at,
        kind: candidate.kind,
        data:
          typeof candidate.data === 'object' && candidate.data !== null ? candidate.data : {},
      }
    }
    if (typeof candidate.kmh !== 'number') return null
    return parsed as CaptureSample
  } catch {
    return null
  }
}
