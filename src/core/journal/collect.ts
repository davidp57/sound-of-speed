import type { PaceState } from '../speed/pace'
import type { UploadConsent } from '../upload/consent'
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
 * Le type vit maintenant dans `core/upload/consent.ts` : le même accord gouverne
 * le journal, les traces, les relevés de mesure et les profils, et une promesse
 * faite à l'utilisateur ne peut pas être écrite à quatre endroits sans finir par
 * diverger. L'alias reste pour que le journal se lise sans détour.
 */
export type JournalConsent = UploadConsent

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
  /**
   * Bruit du récepteur, en km/h, tel que le conditionneur le mesure — ou `null`
   * quand la fenêtre ne porte pas de quoi conclure.
   *
   * Au journal et non seulement à l'écran : c'est le chiffre qui dit si la boîte
   * a de la marge, et il devait jusqu'ici se lire dans le profil mesuré, donc
   * au cran de la conduite et après coup.
   */
  noiseKmh: number | null
  rpm: number
  gear: number
  load: number
  /**
   * Ce que la boîte croit que la voiture fait, et depuis combien de temps.
   *
   * Vient de la boîte, qui le calcule pour décider : le journal le recopie, il
   * ne le recalcule pas. Une seconde lecture du même signal serait un second
   * avis, ce que le lot MOUVEMENT a précisément supprimé.
   */
  pace: PaceState
  paceForS: number
  /**
   * Ce que le relevé détaillé inscrit en plus, et rien d'autre ne lit.
   *
   * **Groupé plutôt qu'éparpillé, et c'est la contrainte du ticket** : le jour
   * où un essai demande une grandeur de plus, elle s'ajoute ici et dans
   * `champsDetailles`, à un seul endroit. Éparpillée dans le cliché, elle
   * obligerait à retrouver les trois points de couture.
   *
   * Absent quand la chaîne ne l'a pas encore produit — au premier tour, par
   * exemple : c'est un supplément de diagnostic, pas un contrat.
   */
  detail?: DetailDeConduite | null
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
  /**
   * Ce que le son a coûté, quand il est synthétisé.
   *
   * Absent quand le profil joue des échantillons : un champ vide vaut mieux
   * qu'un zéro qu'on prendrait pour une mesure. C'est la seule façon de savoir
   * après coup si la synthèse a tenu dans la voiture — le seuil du lot est un
   * facteur temps réel de trois, et personne ne l'y a mesuré.
   */
  sound?: SoundCost | null
}

/**
 * Ce que le relevé détaillé porte en plus des grandeurs ordinaires.
 *
 * Ces quatre-là sont exactement celles dont l'absence a laissé des questions
 * ouvertes après l'essai du 10 septembre 2026 : un rapport qui monte au mauvais
 * moment s'explique par le croisement d'un régime et d'un seuil, et aucun des
 * deux n'était inscrit nulle part.
 */
export interface DetailDeConduite {
  /** Régime auquel le rapport engagé cédera la place au suivant. */
  upshiftRpm: number
  /** Régime sous lequel la boîte cherchera à rétrograder. */
  downshiftRpm: number
  /**
   * La demande, qui n'est pas la charge : elle monte avec elle et n'en redescend
   * qu'en trois secondes, et c'est elle qui déplace le seuil de montée.
   */
  demand: number
  /**
   * L'accélération avant lissage, à côté de celle que toute la chaîne emploie.
   *
   * C'est l'écart entre les deux qui dit ce que le conditionnement a absorbé —
   * et c'est lui qu'on cherchera le jour où le son suivra mal la conduite.
   */
  rawAccelMs2: number
}

/** Ce que le son a coûté sur la dernière fenêtre de mesure. */
export interface SoundCost {
  /** Secondes de son produites par seconde de processeur. */
  realtime: number
  /** Part du processeur, de 0 à 1. */
  cpuLoad: number
  /** Fois où le lecteur n'avait plus rien à jouer, cumulées. */
  underruns: number
  /** Durée totale de ces creux, en millisecondes. */
  underrunMs: number
  /** Niveau crête de la sortie, de 0 à 1. */
  peak: number
  /** Part des échantillons qui butent sur le plafond, de 0 à 1. */
  clipping: number
}

/** Intervalle entre deux relevés périodiques, en millisecondes. */
const SAMPLE_EVERY_MS = 10_000

/**
 * Intervalle entre deux relevés quand le journal détaillé est allumé.
 *
 * Dix fois plus souvent. C'est ce qui a manqué à l'essai du 10 septembre 2026 :
 * dix-neuf allers-retours de rapport repérés sur trente-six minutes, sans
 * pouvoir dire leur fréquence réelle, donc sans pouvoir distinguer une boîte qui
 * hésite d'une boîte qui oscille.
 *
 * Le poids n'est pas un obstacle : les tranches partent compressées.
 */
const SAMPLE_EVERY_DETAILED_MS = 1_000

/**
 * Durée qu'un état d'allure doit avoir tenue pour mériter sa ligne, en
 * millisecondes.
 *
 * **Mesuré au banc le 15 septembre 2026 : sans ce filtre, l'allure bascule cent
 * vingt-quatre fois par minute en croisière tenue** — quatre mille cinq cents
 * lignes sur un trajet de trente-six minutes, contre deux cent seize relevés
 * ordinaires. Le journal aurait été fait à quatre-vingt-quinze pour cent d'un
 * papillotement que personne n'a demandé.
 *
 * La boîte, elle, a besoin de cette finesse : elle décide à chaque image, et un
 * ralentissement vu une demi-seconde trop tard s'entend. La **relecture** n'en a
 * pas besoin — elle cherche ce qui a duré. Les deux cadences n'ont aucune raison
 * d'être la même.
 *
 * Ce qui est avalé n'est pas perdu : la ligne suivante dit combien de bascules
 * brèves l'ont précédée, et c'est une information de diagnostic à part entière —
 * une allure qui papillote dit quelque chose du signal.
 */
const PACE_MIN_HOLD_MS = 1_000

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
  /**
   * Le journal détaillé est-il allumé ?
   *
   * Séparé du consentement, et ce n'est pas une commodité : le consentement dit
   * **ce qui** part, celui-ci dit à **quelle finesse**. Voir
   * `core/journal/detail.ts`.
   */
  private detailed = false
  /** Bascules d'allure trop brèves pour mériter leur ligne, depuis la dernière inscrite. */
  private paceSkipped = 0

  constructor(
    private readonly journal: Journal,
    private consent: JournalConsent,
    detailed = false,
  ) {
    this.detailed = detailed
  }

  setConsent(consent: JournalConsent): void {
    this.consent = consent
  }

  setDetailed(detailed: boolean): void {
    this.detailed = detailed
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

    const every = this.detailed ? SAMPLE_EVERY_DETAILED_MS : SAMPLE_EVERY_MS
    if (snapshot.at - this.lastSampleAt >= every) this.sample(snapshot)
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

    // Le rapport, à l'instant où il change.
    //
    // Le relevé périodique en porte déjà un, mais toutes les dix secondes : il
    // prouve qu'un passage a eu lieu, jamais quand ni combien. L'essai du
    // 10 septembre au soir a buté là-dessus — dix-neuf allers-retours d'un
    // rapport à l'autre repérés, sans pouvoir dire leur fréquence réelle, donc
    // sans pouvoir distinguer une boîte qui hésite d'une boîte qui oscille.
    //
    // Une ligne par passage : sur ce trajet de 36 minutes, quelques centaines
    // d'octets pour la question à laquelle rien ne répondait.
    if (before.gear !== now.gear) {
      this.journal.add(now.at, 'shift', {
        from: before.gear,
        to: now.gear,
        kmh: round(now.kmh, 1),
        rpm: Math.round(now.rpm),
        load: round(now.load, 2),
      })
    }

    // L'état du mouvement, à l'instant où il bascule.
    //
    // La durée inscrite est celle de l'état qu'on **quitte** : c'est elle qui
    // dit si la boîte a cru à un ralentissement pendant deux dixièmes de
    // seconde ou pendant dix, et la relecture n'aurait aucun moyen de la
    // reconstituer autrement.
    if (before.pace !== now.pace) {
      // Une bascule trop brève ne gagne pas sa ligne : elle est comptée, et la
      // prochaine ligne dira combien il y en a eu. Voir `PACE_MIN_HOLD_MS`.
      if (before.paceForS * 1000 < PACE_MIN_HOLD_MS) {
        this.paceSkipped += 1
      } else {
        this.journal.add(now.at, 'pace', {
          from: before.pace,
          to: now.pace,
          heldS: round(before.paceForS, 1),
          kmh: round(now.kmh, 1),
          accel: round(now.accelMs2, 2),
          // Zéro n'est pas inscrit : une ligne sur deux le porterait pour rien.
          ...(this.paceSkipped > 0 ? { breves: this.paceSkipped } : {}),
        })
        this.paceSkipped = 0
      }
    }
  }

  private sample(snapshot: JournalSnapshot): void {
    this.lastSampleAt = snapshot.at
    this.journal.add(snapshot.at, 'sample', {
      kmh: round(snapshot.kmh, 1),
      accel: round(snapshot.accelMs2, 2),
      noise: snapshot.noiseKmh === null ? null : round(snapshot.noiseKmh, 2),
      rpm: Math.round(snapshot.rpm),
      gear: snapshot.gear,
      load: round(snapshot.load, 2),
      accuracyM: snapshot.accuracyM,
      ...soundFields(snapshot.sound),
      ...(this.detailed ? champsDetailles(snapshot.detail) : {}),
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

/**
 * Ce que le son coûte, mis en clés courtes pour le relevé.
 *
 * Rend un objet vide quand le profil ne synthétise pas : inscrire des zéros
 * ferait croire à un son parfait là où il n'y a pas de son du tout.
 */
/**
 * Les champs que le relevé détaillé ajoute.
 *
 * **C'est l'endroit unique** : ajouter une grandeur au journal détaillé, c'est
 * une ligne ici et un champ dans `DetailDeConduite`. Un test le tient, plutôt
 * qu'un commentaire qui vieillirait.
 *
 * Les noms restent courts : il y a dix fois plus de lignes qu'au cran ordinaire.
 */
function champsDetailles(
  detail: DetailDeConduite | null | undefined,
): Record<string, number> {
  if (!detail) return {}
  return {
    up: Math.round(detail.upshiftRpm),
    down: Math.round(detail.downshiftRpm),
    demand: round(detail.demand, 2),
    rawAccel: round(detail.rawAccelMs2, 2),
  }
}

function soundFields(
  sound: SoundCost | null | undefined,
): Record<string, number> {
  if (!sound) return {}
  return {
    realtime: round(sound.realtime, 2),
    cpu: round(sound.cpuLoad, 2),
    underruns: Math.round(sound.underruns),
    underrunMs: Math.round(sound.underrunMs),
    peak: round(sound.peak, 3),
    clipping: round(sound.clipping, 4),
  }
}
