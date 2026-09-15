/**
 * Un envoi en cours, et le moment où l'on renonce à l'attendre.
 *
 * Un seul dépôt court à la fois — deux tranches partiraient sinon dans un ordre
 * que personne ne garantit. Mais « un seul à la fois » ne dit pas quand le
 * précédent finit, et un `fetch` n'a aucune limite de durée : tant qu'il ne rend
 * pas la main, plus rien ne part.
 *
 * **Ce n'est pas une inquiétude de principe.** Le 11 septembre 2026, la capture
 * est restée pendue sur **une seule requête pendant quatre cent quarante-quatre
 * secondes** — sept minutes sans qu'une seule tentative soit faite. Le journal,
 * dont les tranches pèsent vingt fois moins, échouait en 189 millisecondes sur
 * la même coupure. C'est la taille du corps qui décidait, et rien ne bornait
 * l'attente.
 *
 * **L'échéance se lit sur l'horloge murale, pas sur le temps de session.** Le
 * pas de la boucle est plafonné à un quart de seconde : une page en
 * arrière-plan — écran éteint, le cas normal en roulant — voit son temps de
 * session avancer quatre fois moins vite que le monde, et trente secondes de
 * session y feraient deux minutes d'attente. C'est le même raisonnement que
 * pour le dépôt à l'arrêt, dans `core/capture/standstill.ts`.
 *
 * **Un minuteur n'aurait pas fait l'affaire**, pour la même raison : le
 * navigateur les bride dès que la page n'est plus visible. L'échéance est donc
 * relue par la boucle, qui bat de toute façon.
 */

/**
 * Trente secondes.
 *
 * Une tranche de capture pèse une centaine de kilo-octets compressés : de quoi
 * tenir sur un réseau médiocre, et loin des quatre cent quarante-quatre
 * secondes observées. Renoncer ne perd rien — la tranche revient en attente —
 * mais il reste un risque, et il faut le dire : une requête abandonnée **peut**
 * avoir abouti côté serveur, et la suivante déposerait alors le même contenu
 * sous un autre rang. Un doublon se lit ; une attente de sept minutes ne se
 * voit pas.
 */
const TIMEOUT_MS = 30_000

export class InFlight {
  private controller: AbortController | null = null
  private startedAt = 0

  constructor(private readonly timeoutMs: number = TIMEOUT_MS) {}

  /** Un envoi est-il en cours ? */
  get busy(): boolean {
    return this.controller !== null
  }

  /**
   * Ouvre un envoi et rend le signal à passer à `fetch`.
   *
   * `at` est sur l'horloge murale.
   */
  begin(at: number): AbortSignal {
    this.controller = new AbortController()
    this.startedAt = at
    return this.controller.signal
  }

  /** L'envoi a rendu la main, quelle qu'en soit l'issue. */
  end(): void {
    this.controller = null
  }

  /**
   * Abandonne l'envoi s'il dure trop. Rend vrai s'il vient de le faire.
   *
   * Appelé par la boucle. Abandonner fait rejeter le `fetch`, ce qui rend un
   * échec de réseau ordinaire : la tranche revient en attente et le recul joue.
   */
  sweep(at: number): boolean {
    if (this.controller === null) return false
    if (at - this.startedAt < this.timeoutMs) return false
    this.controller.abort()
    return true
  }
}
