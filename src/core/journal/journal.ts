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

/** Une tranche prête à partir. */
export interface JournalSlice {
  /** Nom du fichier, qui porte la session et le rang de la tranche. */
  name: string
  /** Contenu : une ligne de JSON par événement. */
  body: string
  /** Nombre d'événements, pour l'afficher sans relire le corps. */
  count: number
  /** Taille du corps, en octets. */
  bytes: number
}

export interface JournalOptions {
  /**
   * Identifiant de la session, tiré au démarrage.
   *
   * Il sert de préfixe commun à toutes les tranches d'un même trajet : c'est ce
   * qui permet de les trier ensemble, de les recoller dans l'ordre, et d'en
   * supprimer un trajet d'un geste. Sans lui, le ménage à la main deviendrait
   * un tri.
   */
  sessionId: string
  /** Horodatage du début de session, pour nommer les fichiers. */
  startedAt: number
  /** Durée au-delà de laquelle une tranche part, en millisecondes. */
  sliceAfterMs?: number
  /** Taille au-delà de laquelle une tranche part sans attendre, en octets. */
  sliceAtBytes?: number
  /**
   * Plafond du nombre d'événements gardés en attente.
   *
   * Un garde-fou, pas une politique : sans réseau l'attente s'allonge, et une
   * session de trois heures ne doit ni saturer le stockage local — dont le
   * quota mord déjà sur les traces — ni produire un fichier que le serveur
   * refuse.
   */
  maxPending?: number
}

/** Cinq minutes : six fichiers pour un trajet d'une demi-heure. */
const SLICE_AFTER_MS = 5 * 60 * 1000
/** Trente kilo-octets, l'ordre de grandeur d'une demi-heure de relevés. */
const SLICE_AT_BYTES = 30_000
const MAX_PENDING = 20_000

export class Journal {
  private pending: JournalEvent[] = []
  private sliceIndex = 0
  /** Instant du dernier découpage, sur l'horloge de session. */
  private lastSliceAt = 0
  /** Événements écartés faute de place. Compté pour être dit. */
  private dropped = 0

  private readonly sliceAfterMs: number
  private readonly sliceAtBytes: number
  private readonly maxPending: number

  constructor(private readonly options: JournalOptions) {
    this.sliceAfterMs = options.sliceAfterMs ?? SLICE_AFTER_MS
    this.sliceAtBytes = options.sliceAtBytes ?? SLICE_AT_BYTES
    this.maxPending = options.maxPending ?? MAX_PENDING
  }

  /** Nombre d'événements en attente de dépôt. */
  get pendingCount(): number {
    return this.pending.length
  }

  /** Nombre d'événements écartés depuis le dernier découpage. */
  get droppedCount(): number {
    return this.dropped
  }

  /**
   * Retient un événement.
   *
   * Au-delà du plafond, on écarte les **plus anciens** : quand le réseau manque
   * longtemps, ce qui vient de se passer explique mieux l'état courant qu'un
   * relevé d'il y a deux heures. Le compte des écartés part avec la tranche
   * suivante, faute de quoi on lirait un journal troué sans le savoir.
   */
  add(at: number, kind: JournalEventKind, data: JournalEvent['data'] = {}): void {
    this.pending.push({ at: Math.round(at), kind, data })
    this.trim()
  }

  /**
   * Faut-il déposer maintenant ?
   *
   * Sur la durée **ou** sur la taille : un trajet calme ne doit pas produire six
   * fichiers de deux lignes, et un trajet bavard ne doit pas attendre cinq
   * minutes pour vider un tampon déjà gros.
   */
  shouldSlice(now: number): boolean {
    if (this.pending.length === 0) return false
    if (now - this.lastSliceAt >= this.sliceAfterMs) return true
    return this.bytesPending() >= this.sliceAtBytes
  }

  /**
   * Détache une tranche de tout ce qui est en attente.
   *
   * Les événements ne sont retirés qu'ici. Un dépôt qui échoue se rattrape en
   * **remettant** la tranche par `restore`, ce qui la joint à la suivante au
   * lieu de lui donner son propre fichier — sans cela, vingt minutes sans
   * réseau produiraient dix fichiers dès son retour.
   */
  takeSlice(now: number): JournalSlice | null {
    if (this.pending.length === 0) return null

    const events = this.pending
    this.pending = []
    this.lastSliceAt = now
    this.sliceIndex += 1

    const lignes = events.map((event) => JSON.stringify(event))
    if (this.dropped > 0) {
      // Le trou est déclaré dans la tranche elle-même : un journal troué qui ne
      // le dit pas se lit comme un journal complet.
      lignes.unshift(
        JSON.stringify({
          at: Math.round(now),
          kind: 'error',
          data: { dropped: this.dropped, why: 'plafond du journal atteint' },
        } satisfies JournalEvent),
      )
      this.dropped = 0
    }

    const body = `${lignes.join('\n')}\n`
    return {
      name: this.sliceName(this.sliceIndex),
      body,
      count: events.length,
      bytes: byteLength(body),
    }
  }

  /**
   * Remet en attente les événements d'une tranche qui n'a pas pu partir.
   *
   * Ils repassent **devant** ce qui s'est accumulé depuis, pour que l'ordre du
   * journal reste celui du trajet. Le rang de tranche, lui, n'est pas rendu :
   * un numéro sauté se lit dans les noms de fichiers, et vaut mieux qu'un rang
   * réemployé, qui ferait deux fichiers de même nom.
   */
  restore(slice: JournalSlice): void {
    const events = slice.body
      .split('\n')
      .filter((ligne) => ligne.length > 0)
      .map(parseEvent)
      .filter((event): event is JournalEvent => event !== null)

    this.pending = [...events, ...this.pending]
    this.trim()
  }

  /**
   * Nom d'une tranche.
   *
   * La date, l'identifiant de session, puis le rang sur trois chiffres : les
   * tranches d'un même trajet se trient alors dans l'ordre du trajet par un
   * simple tri de noms, ce qui est tout ce dont on dispose sur un partage de
   * fichiers.
   */
  private sliceName(index: number): string {
    const stamp = Number.isFinite(this.options.startedAt)
      ? new Date(this.options.startedAt).toISOString().slice(0, 19).replace(/[:T]/g, '-')
      : 'sans-date'
    return `${stamp}_${this.options.sessionId}_${String(index).padStart(3, '0')}.jsonl`
  }

  private trim(): void {
    while (this.pending.length > this.maxPending) {
      this.pending.shift()
      this.dropped += 1
    }
  }

  private bytesPending(): number {
    let total = 0
    for (const event of this.pending) total += byteLength(JSON.stringify(event)) + 1
    return total
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

/**
 * Taille en octets, et non en caractères.
 *
 * Un accent compte double en UTF-8, et les libellés de ce projet en sont
 * pleins : mesurer la longueur de la chaîne sous-estimerait la tranche.
 */
function byteLength(text: string): number {
  return new TextEncoder().encode(text).length
}
