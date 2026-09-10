import { SliceBuffer, type Slice, type SliceBufferOptions } from '../upload/slicing'

/**
 * Journal de bord.
 *
 * Ce qui s'est passé pendant un trajet, retenu sous forme d'événements
 * horodatés et découpé en tranches, pour être déposé sur le serveur et lu
 * ailleurs.
 *
 * **Pourquoi cette pièce existe.** Le navigateur de la voiture n'a pas de
 * console : on ne consulte rien assis au volant, et le diagnostic se faisait
 * donc en devinant. Un exemple en dit le coût — le drapeau qui distingue une
 * vitesse lue d'une vitesse déduite existait depuis le premier jour sans être
 * affiché nulle part, et c'est lui qui aurait désigné en une seconde un défaut
 * qui a vécu une semaine.
 *
 * **Des événements, pas du texte.** Des faits qui se comptent et se comparent
 * d'un trajet à l'autre. Des lignes de prose gonflent vite et ne se recoupent
 * pas : on ne répond pas à « combien de fois » avec du texte libre.
 *
 * **Des tranches, jamais réécrites.** Une première conception déposait un
 * fichier par session, réécrit à chaque envoi. Le stockage aurait été le même,
 * mais ce qu'on renvoie grossit à chaque fois puisque c'est le journal complet
 * depuis le début : sur une demi-heure, huit fois trop de données transférées,
 * et un dernier envoi de deux cents kilo-octets qui doit réussir en entier sur
 * un réseau intermittent. Une tranche ne contient que ce qui est nouveau.
 *
 * Cette pièce ne connaît ni le réseau ni l'horloge du système : elle reçoit le
 * temps et rend des tranches. C'est ce qui permet de la vérifier sans serveur.
 */

/**
 * Ce qu'on sait dire d'un trajet.
 *
 * Une liste fermée plutôt qu'un nom libre : c'est elle qui rend un journal
 * dénombrable, et qui empêche deux endroits du code de nommer différemment le
 * même fait.
 */
export type JournalEventKind =
  /** La source de vitesse a changé, ou son état a changé. */
  | 'source'
  /** Le suivi de position a été relancé par le chien de garde. */
  | 'fix-restart'
  /** L'origine de la vitesse a basculé entre lue et déduite. */
  | 'speed-origin'
  /** Une mesure a été rejetée, avec son motif. */
  | 'reject'
  /** Le contexte audio s'est suspendu, ou a été relancé. */
  | 'audio'
  /** Un relevé périodique de l'état de la conduite. */
  | 'sample'
  /** Un profil a été choisi, ou un réglage global déplacé. */
  | 'profile'
  /** Une erreur, avec ce qu'on en sait. */
  | 'error'

export interface JournalEvent {
  /** Millisecondes depuis le début de la session. */
  at: number
  kind: JournalEventKind
  /**
   * Ce que l'événement porte, en clés courtes.
   *
   * Libre, parce qu'un rejet de mesure et un relevé de conduite n'ont rien à
   * dire en commun. Ce qui est fermé, c'est le genre.
   */
  data: Record<string, number | string | boolean | null>
}

/**
 * Une tranche prête à partir.
 *
 * Le découpage lui-même vit dans `core/upload/slicing.ts` : le journal et la
 * capture continue le partagent.
 */
export type JournalSlice = Slice

export type JournalOptions = Pick<
  SliceBufferOptions<JournalEvent>,
  'sessionId' | 'startedAt' | 'sliceAfterMs' | 'sliceAtBytes' | 'maxPending'
>

export class Journal {
  private readonly buffer: SliceBuffer<JournalEvent>

  constructor(options: JournalOptions) {
    this.buffer = new SliceBuffer<JournalEvent>({
      ...options,
      serialize: (event) => JSON.stringify(event),
      parse: parseEvent,
      dropNotice: (count, now) => ({
        at: Math.round(now),
        kind: 'error',
        data: { dropped: count, why: 'plafond du journal atteint' },
      }),
    })
  }

  /** Nombre d'événements en attente de dépôt. */
  get pendingCount(): number {
    return this.buffer.pendingCount
  }

  /** Nombre d'événements écartés depuis le dernier découpage. */
  get droppedCount(): number {
    return this.buffer.droppedCount
  }

  add(at: number, kind: JournalEventKind, data: JournalEvent['data'] = {}): void {
    this.buffer.add({ at: Math.round(at), kind, data })
  }

  shouldSlice(now: number): boolean {
    return this.buffer.shouldSlice(now)
  }

  takeSlice(now: number): JournalSlice | null {
    return this.buffer.takeSlice(now)
  }

  restore(slice: JournalSlice): void {
    this.buffer.restore(slice)
  }
}

/**
 * Identifiant de session : court, et sans ambiguïté à la lecture.
 *
 * Ni `0`, ni `o`, ni `1`, ni `l` : ce nom est lu à l'œil dans une liste de
 * fichiers, et parfois retapé.
 */
export function newSessionId(random: () => number = Math.random): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  let out = ''
  for (let i = 0; i < 4; i += 1) {
    out += alphabet[Math.floor(random() * alphabet.length)] ?? 'a'
  }
  return out
}

function parseEvent(ligne: string): JournalEvent | null {
  try {
    const parsed: unknown = JSON.parse(ligne)
    if (typeof parsed !== 'object' || parsed === null) return null
    const candidate = parsed as Partial<JournalEvent>
    if (typeof candidate.at !== 'number' || typeof candidate.kind !== 'string') return null
    return {
      at: candidate.at,
      kind: candidate.kind,
      data:
        typeof candidate.data === 'object' && candidate.data !== null ? candidate.data : {},
    }
  } catch {
    return null
  }
}
