import { Backoff, DEFAULT_BACKOFF, type BackoffLimits } from './backoff'
import type { UploadKind } from './consent'
import type { PutOutcome } from './put'

/**
 * La file des dépôts qui attendent.
 *
 * Une voiture traverse des zones sans réseau, et c'est le cas normal sur une
 * route, pas l'exception. Sans file, chaque nature de fichier aurait dû traiter
 * le hors-réseau à sa façon : on pose ici ce qui doit partir, la file l'envoie
 * quand elle peut, et ce qui est parti la quitte.
 *
 * **Elle est bornée, et c'est le point délicat.** Le stockage local a déjà
 * échoué à garder une trace longue, et cet échec est signalé — c'est un acquis.
 * Une file qui grossit sans fin rendrait ce défaut plus fréquent, pas moins :
 * au-delà de la borne, le plus ancien cède la place, et cela se dit.
 *
 * Cette pièce ne connaît ni le réseau ni l'horloge : elle reçoit le temps et une
 * fonction d'envoi. C'est ce qui permet de la vérifier sans serveur.
 */

export interface QueuedUpload {
  /**
   * Identifiant du dépôt.
   *
   * Il dédoublonne : reposer deux fois la même trace ne fait pas deux fichiers,
   * et un profil modifié trois fois de suite ne remplit pas la file. Pour ce
   * qui se remplace — un profil — l'identifiant est stable ; pour ce qui
   * s'accumule — une trace — il est unique.
   */
  id: string
  kind: UploadKind
  /** Dossier servi en écriture, barre oblique finale comprise. */
  folder: string
  /** Nom du fichier, nu. */
  name: string
  body: string
  queuedAt: number
  /**
   * Ce dépôt est une reprise : le serveur l'épinglera.
   *
   * Facultatif, et absent de tout ce qui attendait avant que la reprise existe —
   * une file enregistrée hier se relit sans lui.
   */
  epingle?: boolean
}

export interface QueueLimits extends BackoffLimits {
  /** Nombre de dépôts gardés au plus. */
  maxItems: number
  /**
   * Poids total gardé au plus.
   *
   * Compté en caractères et non en octets : ce qui attend est du JSON presque
   * entièrement ASCII, et une borne de sûreté n'a pas besoin d'un encodage exact
   * à chaque ajout.
   */
  maxBytes: number
}

export const DEFAULT_LIMITS: QueueLimits = {
  maxItems: 24,
  // Quatre mégaoctets : de quoi garder plusieurs traces d'un trajet sans
  // approcher le quota du stockage local, qui est de l'ordre de cinq.
  maxBytes: 4 * 1024 * 1024,
  // Le recul est celui de tous les dépôts : le tenir ici en double finirait par
  // le faire diverger de celui des tranches.
  ...DEFAULT_BACKOFF,
}

export type AddResult = 'queued' | 'duplicate'

export class UploadQueue {
  private items: QueuedUpload[] = []
  private readonly retry: Backoff

  /** Dernier échec, en clair, pour l'afficher tel quel. */
  lastError = ''
  /** Dépôts abandonnés faute de place, cumulés. */
  evicted = 0

  constructor(private readonly limits: QueueLimits = DEFAULT_LIMITS) {
    this.retry = new Backoff(limits)
  }

  list(): readonly QueuedUpload[] {
    return this.items
  }

  get size(): number {
    return this.items.length
  }

  get bytes(): number {
    return this.items.reduce((total, item) => total + item.body.length, 0)
  }

  has(id: string): boolean {
    return this.items.some((item) => item.id === id)
  }

  /**
   * Reprend une file gardée d'une session à l'autre.
   *
   * Les entrées illisibles sont écartées une par une : une file corrompue ne
   * doit pas emporter celles qui sont saines.
   */
  restore(items: QueuedUpload[]): void {
    this.items = items.slice(0, this.limits.maxItems)
  }

  /**
   * Pose un dépôt dans la file.
   *
   * Un dépôt de même identifiant remplace le précédent sans changer son rang :
   * c'est ce qui fait qu'un profil retouché dix fois n'occupe qu'une place, et
   * que c'est sa dernière version qui part.
   */
  add(item: QueuedUpload): AddResult {
    const at = this.items.findIndex((queued) => queued.id === item.id)
    if (at >= 0) {
      this.items[at] = item
      this.trim()
      return 'duplicate'
    }
    this.items.push(item)
    this.trim()
    return 'queued'
  }

  /** Retire un dépôt, par exemple quand ce qu'il portait a été supprimé. */
  remove(id: string): void {
    this.items = this.items.filter((item) => item.id !== id)
  }

  /** L'heure est-elle venue de réessayer ? */
  ready(at: number): boolean {
    return this.items.length > 0 && this.retry.ready(at)
  }

  /**
   * Envoie ce qui attend, dans l'ordre, et s'arrête au premier échec.
   *
   * S'arrêter est volontaire : quand le réseau manque, les suivants échoueraient
   * de la même façon, et chaque tentative coûte le temps d'une requête. Ce qui a
   * échoué reste en tête de file et repartira au prochain passage.
   */
  async flush(at: number, send: (item: QueuedUpload) => Promise<PutOutcome>): Promise<number> {
    if (!this.ready(at)) return 0

    let sent = 0
    for (const item of [...this.items]) {
      const outcome = await send(item)
      if (outcome.ok) {
        this.remove(item.id)
        this.retry.succeeded()
        this.lastError = ''
        sent += 1
        continue
      }

      this.lastError = outcome.detail
      this.retry.failed(at, outcome.retry)
      break
    }
    return sent
  }

  /** Force la prochaine tentative, quand l'utilisateur la demande. */
  retryNow(): void {
    this.retry.retryNow()
  }

  /**
   * Ramène la file dans ses bornes.
   *
   * Le plus ancien cède la place. C'est le bon sens de sacrifice : ce qui vient
   * d'être enregistré est ce qu'on cherche à récupérer, et ce qui traîne depuis
   * longtemps a déjà eu ses chances.
   */
  private trim(): void {
    let dropped = 0
    while (this.items.length > this.limits.maxItems || this.bytes > this.limits.maxBytes) {
      if (this.items.length <= 1) break
      this.items.shift()
      dropped += 1
    }
    if (dropped > 0) {
      this.evicted += dropped
      this.lastError =
        dropped === 1
          ? "Un dépôt en attente a été abandonné, faute de place."
          : `${dropped} dépôts en attente ont été abandonnés, faute de place.`
    }
  }
}
