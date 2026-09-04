import type { Journal } from './journal'

/**
 * Ce qui décide d'inscrire un événement, et ce qui décide de se taire.
 *
 * Deux pièges à éviter, et ils tirent en sens contraire.
 *
 * **Ne pas inscrire à chaque image.** La boucle tourne soixante fois par
 * seconde : journaliser l'état à chaque tour donnerait deux cent seize mille
 * lignes à l'heure, illisibles et impossibles à déposer. Les états ne sont donc
 * inscrits qu'à leurs **transitions**, ce qui demande de retenir le précédent.
 *
 * **Ne pas manquer ce qui compte.** Un relevé périodique accompagne les
 * transitions : sans lui, un trajet entier sans incident ne laisserait aucune
 * trace, et l'on ne pourrait pas répondre à « à quel régime roulait-il ? ».
 *
 * **Où vit la règle de confidentialité.** Le cran d'accord est passé ici, et
 * c'est délibéré : ce qui peut être inscrit est décidé dans une fonction du
 * cœur, vérifiable par un test, plutôt que dans l'interface où la règle se
 * disperserait. Une promesse faite à l'utilisateur mérite mieux qu'un `v-if`.
 */

/**
 * Ce que l'utilisateur a accepté d'envoyer.
 *
 * `none` est la valeur par défaut, et rien ne part alors — pas même un journal
 * gardé en local, puisqu'il n'y aurait aucune raison de l'écrire.
 */
export type JournalConsent = 'none' | 'minimal' | 'extended'

/** Un instantané de ce que l'application sait d'elle-même. */
export interface JournalSnapshot {
  /** Millisecondes depuis le début de la session. */
  at: number
  /** Nom de la source de vitesse, et son état. */
  source: string
  sourceStatus: string
  /** Vrai si la dernière vitesse a été déduite de deux positions. */
  derived: boolean
  kmh: number
  accelMs2: number
  rpm: number
  gear: number
  load: number
  /** Relances du suivi de position, cumulées. */
  fixRestarts: number
  /** Rejets de la source, cumulés, par motif. */
  rejected: { implausible: number; tooClose: number; inaccurate: number }
  /** État du contexte audio, tel que le navigateur le rapporte. */
  audioState: string
  /** Précision annoncée de la dernière position, en mètres. */
  accuracyM: number | null
  /** Position, quand elle est connue. N'est inscrite qu'au cran étendu. */
  latitude?: number | null
  longitude?: number | null
}

/** Intervalle entre deux relevés périodiques, en millisecondes. */
const SAMPLE_EVERY_MS = 10_000

/**
 * Décimation de la position au cran étendu, en millisecondes.
 *
 * Un point par seconde, ce qui est la résolution habituelle d'une trace
 * exploitable. Inscrire chaque mesure à la cadence réelle du GPS donnerait
 * soixante mille points et cinq mégaoctets pour une demi-heure : la décimation
 * n'est pas une économie, c'est ce qui rend le dépôt possible.
 */
const POSITION_EVERY_MS = 1000

export class JournalCollector {
  private lastSampleAt = Number.NEGATIVE_INFINITY
  private lastPositionAt = Number.NEGATIVE_INFINITY
  private previous: JournalSnapshot | null = null

  constructor(
    private readonly journal: Journal,
    private consent: JournalConsent,
  ) {}

  setConsent(consent: JournalConsent): void {
    this.consent = consent
  }

  /**
   * Regarde un instantané et inscrit ce qui mérite de l'être.
   *
   * Appelé à chaque tour de boucle : c'est cette méthode qui doit rester
   * silencieuse, et non l'appelant qui doit savoir quand l'appeler.
   */
  observe(snapshot: JournalSnapshot): void {
    if (this.consent === 'none') {
      // Rien n'est même retenu : un journal qu'on n'enverra pas n'a pas de
      // raison d'occuper la mémoire ni le stockage.
      this.previous = snapshot
      return
    }

    const before = this.previous
    this.previous = snapshot

    if (before === null) {
      // Premier tour : on inscrit l'état de départ, sans quoi le journal
      // commencerait par une transition dont on ignore le point de départ.
      this.journal.add(snapshot.at, 'source', {
        source: snapshot.source,
        status: snapshot.sourceStatus,
      })
      this.sample(snapshot)
      // La position aussi, au même titre que le relevé : le premier tour
      // décrivait l'état de départ en oubliant l'endroit où il se produisait.
      if (this.consent === 'extended') this.position(snapshot)
      return
    }

    this.transitions(before, snapshot)

    if (snapshot.at - this.lastSampleAt >= SAMPLE_EVERY_MS) this.sample(snapshot)
    if (this.consent === 'extended') this.position(snapshot)
  }

  /** Ce qui a changé depuis le tour précédent. */
  private transitions(before: JournalSnapshot, now: JournalSnapshot): void {
    if (before.source !== now.source || before.sourceStatus !== now.sourceStatus) {
      this.journal.add(now.at, 'source', { source: now.source, status: now.sourceStatus })
    }

    // L'origine de la vitesse : c'est le drapeau qui a manqué une semaine, et
    // sa bascule est exactement ce qu'on veut voir arriver.
    if (before.derived !== now.derived) {
      this.journal.add(now.at, 'speed-origin', { derived: now.derived, kmh: round(now.kmh, 1) })
    }

    if (now.fixRestarts > before.fixRestarts) {
      this.journal.add(now.at, 'fix-restart', {
        total: now.fixRestarts,
        kmh: round(now.kmh, 1),
      })
    }

    // Les rejets sont cumulés : on inscrit l'écart, et non le total, pour
    // pouvoir répondre à « combien entre telle et telle minute ».
    for (const motif of ['implausible', 'tooClose', 'inaccurate'] as const) {
      const delta = now.rejected[motif] - before.rejected[motif]
      if (delta > 0) {
        this.journal.add(now.at, 'reject', {
          motif,
          count: delta,
          accuracyM: now.accuracyM,
        })
      }
    }

    if (before.audioState !== now.audioState) {
      this.journal.add(now.at, 'audio', { state: now.audioState })
    }
  }

  private sample(snapshot: JournalSnapshot): void {
    this.lastSampleAt = snapshot.at
    this.journal.add(snapshot.at, 'sample', {
      kmh: round(snapshot.kmh, 1),
      accel: round(snapshot.accelMs2, 2),
      rpm: Math.round(snapshot.rpm),
      gear: snapshot.gear,
      load: round(snapshot.load, 2),
      accuracyM: snapshot.accuracyM,
    })
  }

  /**
   * La position, au cran étendu seulement.
   *
   * Deux gardes, et la seconde n'est pas superflue : le cran, et la présence
   * effective d'une position. Une latitude absente ne s'inscrit pas comme
   * `null` — une ligne qui ne dit rien coûte autant qu'une qui dit quelque
   * chose.
   */
  private position(snapshot: JournalSnapshot): void {
    if (snapshot.latitude == null || snapshot.longitude == null) return
    if (snapshot.at - this.lastPositionAt < POSITION_EVERY_MS) return
    this.lastPositionAt = snapshot.at
    this.journal.add(snapshot.at, 'sample', {
      lat: round(snapshot.latitude, 5),
      lon: round(snapshot.longitude, 5),
      kmh: round(snapshot.kmh, 1),
    })
  }
}

/**
 * Arrondi à un nombre de décimales.
 *
 * Une vitesse à quinze décimales occupe trois fois la place d'une vitesse au
 * dixième, et ne dit rien de plus : le bruit de mesure d'un GPS est de l'ordre
 * du km/h. Cinq décimales pour une coordonnée valent le mètre.
 */
function round(value: number, digits: number): number {
  if (!Number.isFinite(value)) return 0
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}
