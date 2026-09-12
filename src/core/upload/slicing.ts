import { byteLength } from './put'

/**
 * Découper en tranches ce qui s'écrit pendant qu'on roule.
 *
 * Le journal et la capture posent le même problème : une session dure une heure,
 * le réseau va et vient, et le navigateur de la voiture ne prévient pas quand il
 * se ferme. Attendre la fin pour déposer, c'est tout perdre à la première
 * coupure. On dépose donc par morceaux, au fil de la route.
 *
 * Ce mécanisme était écrit dans `core/journal/journal.ts`, pour le seul journal.
 * La capture continue en avait besoin à l'identique — les mêmes bornes, le même
 * rattrapage, le même nommage. Le recopier aurait fait deux mécanismes qui
 * décrivent le même fait, ce que ce dépôt a déjà payé deux fois.
 *
 * Rien ici ne connaît le réseau ni l'horloge murale : le temps est reçu, ce qui
 * permet de vérifier le découpage sans serveur et sans attendre cinq minutes.
 */

/** Une tranche prête à partir. */
export interface Slice {
  /** Nom du fichier, qui porte la session et le rang de la tranche. */
  name: string
  /** Contenu : une ligne par élément. */
  body: string
  /** Nombre d'éléments, pour l'afficher sans relire le corps. */
  count: number
  /** Taille du corps, en octets. */
  bytes: number
}

export interface SliceBufferOptions<T> {
  /**
   * Identifiant de la session, tiré au démarrage.
   *
   * Il sert de préfixe commun à toutes les tranches d'un même trajet : c'est ce
   * qui permet de les trier ensemble, de les recoller dans l'ordre, et d'en
   * supprimer un trajet d'un geste.
   */
  sessionId: string
  /** Horodatage du début de session, pour nommer les fichiers. */
  startedAt: number
  /** Extension du fichier, point compris. */
  extension?: string
  /** Durée au-delà de laquelle une tranche part, en millisecondes. */
  sliceAfterMs?: number
  /** Taille au-delà de laquelle une tranche part sans attendre, en octets. */
  sliceAtBytes?: number
  /**
   * Plafond du nombre d'éléments gardés en attente.
   *
   * Un garde-fou, pas une politique : sans réseau l'attente s'allonge, et une
   * session de trois heures ne doit ni saturer la mémoire ni produire un fichier
   * que le serveur refuse.
   */
  maxPending?: number
  /** Une ligne de fichier depuis un élément. */
  serialize: (item: T) => string
  /**
   * Un élément depuis une ligne, ou `null` si la ligne ne doit pas revenir en
   * attente — c'est ainsi qu'un en-tête réécrit à chaque tranche ne s'accumule
   * pas quand une tranche est rendue.
   */
  parse: (line: string) => T | null
  /**
   * Ce qu'on inscrit en tête d'une tranche quand des éléments ont été écartés.
   *
   * Un fichier troué qui ne le dit pas se lit comme un fichier complet.
   */
  dropNotice?: (count: number, now: number) => T | null
  /**
   * Lignes réécrites en tête de **chaque** tranche.
   *
   * Une tranche isolée doit se lire seule : sans en-tête, la deuxième moitié
   * d'un trajet ne dirait pas dans quelle configuration elle a été enregistrée.
   */
  header?: () => string[]
}

/**
 * Cinq minutes : six fichiers pour un trajet d'une demi-heure.
 *
 * Exporté parce que le relecteur s'en sert pour dire la durée approchée d'une
 * session sans ouvrir un seul fichier : compter ses tranches suffit. Deux
 * constantes finiraient par diverger.
 */
export const SLICE_AFTER_MS = 5 * 60 * 1000
/** Trente kilo-octets, l'ordre de grandeur d'une demi-heure de relevés. */
const SLICE_AT_BYTES = 30_000
const MAX_PENDING = 20_000

export class SliceBuffer<T> {
  private pending: T[] = []
  /** Le poids de chaque élément en attente, dans le même ordre. */
  private weights: number[] = []
  private sliceIndex = 0
  /** Instant du dernier découpage, sur l'horloge de session. */
  private lastSliceAt = 0
  /** Éléments écartés faute de place. Compté pour être dit. */
  private dropped = 0
  /**
   * Poids de ce qui attend, tenu à jour à chaque ajout.
   *
   * Et non recalculé à la demande. `shouldSlice` est interrogé à chaque tour de
   * boucle ; resérialiser tout ce qui attend coûtait, mesuré sur quatre minutes
   * de capture à dix relevés par seconde, **68 millisecondes de calcul par
   * seconde de conduite** sur un poste de bureau — pour une réponse presque
   * toujours « non ». Le processeur de la voiture atteint à peine le temps réel
   * sur le son ; il n'a pas ces cycles à donner.
   */
  private bytes = 0

  private readonly sliceAfterMs: number
  private readonly sliceAtBytes: number
  private readonly maxPending: number

  constructor(private readonly options: SliceBufferOptions<T>) {
    this.sliceAfterMs = options.sliceAfterMs ?? SLICE_AFTER_MS
    this.sliceAtBytes = options.sliceAtBytes ?? SLICE_AT_BYTES
    this.maxPending = options.maxPending ?? MAX_PENDING
  }

  /** Nombre d'éléments en attente de dépôt. */
  get pendingCount(): number {
    return this.pending.length
  }

  /** Nombre d'éléments écartés depuis le dernier découpage. */
  get droppedCount(): number {
    return this.dropped
  }

  /**
   * Retient un élément.
   *
   * Au-delà du plafond, on écarte les **plus anciens** : quand le réseau manque
   * longtemps, ce qui vient de se passer explique mieux l'état courant qu'un
   * relevé d'il y a deux heures.
   */
  add(item: T): void {
    this.pending.push(item)
    this.weights.push(byteLength(this.options.serialize(item)) + 1)
    this.bytes += this.weights[this.weights.length - 1] ?? 0
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
    return this.bytes >= this.sliceAtBytes
  }

  /**
   * Détache une tranche de tout ce qui est en attente.
   *
   * Les éléments ne sont retirés qu'ici. Un dépôt qui échoue se rattrape en
   * **remettant** la tranche par `restore`, ce qui la joint à la suivante au
   * lieu de lui donner son propre fichier — sans cela, vingt minutes sans réseau
   * produiraient dix fichiers dès son retour.
   */
  takeSlice(now: number): Slice | null {
    if (this.pending.length === 0) return null

    const items = this.pending
    this.pending = []
    this.weights = []
    this.bytes = 0
    this.lastSliceAt = now
    this.sliceIndex += 1

    const lignes = items.map((item) => this.options.serialize(item))

    if (this.dropped > 0 && this.options.dropNotice) {
      const notice = this.options.dropNotice(this.dropped, now)
      if (notice !== null) lignes.unshift(this.options.serialize(notice))
      this.dropped = 0
    }

    if (this.options.header) lignes.unshift(...this.options.header())

    const body = `${lignes.join('\n')}\n`
    return {
      name: this.sliceName(this.sliceIndex),
      body,
      count: items.length,
      bytes: byteLength(body),
    }
  }

  /**
   * Remet en attente le contenu d'une tranche qui n'a pas pu partir.
   *
   * Il repasse **devant** ce qui s'est accumulé depuis, pour que l'ordre reste
   * celui du trajet. Le rang de tranche, lui, n'est pas rendu : un numéro sauté
   * se lit dans les noms de fichiers, et vaut mieux qu'un rang réemployé, qui
   * ferait deux fichiers de même nom.
   */
  restore(slice: Slice): void {
    const items = slice.body
      .split('\n')
      .filter((ligne) => ligne.length > 0)
      .map((ligne) => this.options.parse(ligne))
      .filter((item): item is T => item !== null)

    const poids = items.map((item) => byteLength(this.options.serialize(item)) + 1)
    this.pending = [...items, ...this.pending]
    this.weights = [...poids, ...this.weights]
    this.bytes = this.weights.reduce((total, poid) => total + poid, 0)
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
    const extension = this.options.extension ?? '.jsonl'
    return `${stamp}_${this.options.sessionId}_${String(index).padStart(3, '0')}${extension}`
  }

  private trim(): void {
    while (this.pending.length > this.maxPending) {
      this.pending.shift()
      this.bytes -= this.weights.shift() ?? 0
      this.dropped += 1
    }
  }
}
