/**
 * L'état de santé d'une session, résumé en une couleur.
 *
 * Le 10 septembre 2026, David a roulé trente-six minutes sans qu'aucune capture
 * n'existe, et rien à l'écran ne le lui a dit. Un témoin le dit maintenant, et
 * la question qu'il répond est une seule : **ce que je suis en train de vivre
 * sera-t-il récupérable au retour ?**
 *
 * **La frontière entre orange et rouge est la récupérabilité**, et non la
 * gravité ressentie. Un réseau absent est orange même si rien ne part depuis
 * dix minutes : la file garde, et tout partira. Un mot de passe refusé est
 * rouge même si l'application tourne parfaitement : rien ne partira jamais.
 *
 * **Un seul témoin, qui prend le pire.** Une rangée de voyants sur un écran
 * qu'on lit en conduisant, c'est une rangée qu'on ne lit pas. Le détail se lit
 * sur l'écran de télémétrie, à l'arrêt.
 */

export type CaptureHealth = 'off' | 'ok' | 'warn' | 'bad'

/** Pourquoi un dépôt a échoué, s'il a échoué. */
export type DepositFailure = 'no-credentials' | 'refused' | 'network' | ''

export interface CaptureHealthInput {
  /** La capture tourne-t-elle ? */
  capturing: boolean
  /** Pourquoi le dernier dépôt de capture a échoué, s'il a échoué. */
  failure: DepositFailure
  /**
   * Pourquoi le dernier dépôt de **journal** a échoué, s'il a échoué.
   *
   * Le journal compte autant que la capture : un trajet dont le journal n'est
   * pas parti se revoit sans ce qui expliquait ce qu'on y voit — le profil en
   * usage, les passages de rapport, les rejets du récepteur. Il n'a pourtant
   * jamais eu de témoin, et le 11 septembre 2026 il s'est répété sept cent
   * vingt-six fois sans que rien ne le dise à l'écran.
   */
  journalFailure: DepositFailure
  /** Le GPS livre-t-il des positions ? */
  gpsActive: boolean
  /** Motif dominant de rejet des positions, quand le veilleur en voit un. */
  rejecting: boolean
}

export interface CaptureVerdict {
  state: CaptureHealth
  /** Ce qu'on écrit à l'écran de télémétrie, en toutes lettres. */
  why: string
}

/** Du plus grave au moins grave. Ce qui ne se corrige pas tout seul passe devant. */
const GRAVITE: DepositFailure[] = ['no-credentials', 'refused', 'network', '']

/**
 * Le pire des deux dépôts.
 *
 * Un seul témoin, qui prend le pire : une rangée de voyants sur un écran qu'on
 * lit en conduisant est une rangée qu'on ne lit pas.
 */
function pire(a: DepositFailure, b: DepositFailure): DepositFailure {
  // Une valeur hors liste vaut « rien à signaler » plutôt que « le plus grave » :
  // `indexOf` rend -1, qui gagnerait sur tout le reste.
  const rang = (f: DepositFailure) => {
    const i = GRAVITE.indexOf(f)
    return i < 0 ? GRAVITE.length : i
  }
  return rang(a) <= rang(b) ? a : b
}

export function captureHealth(input: CaptureHealthInput): CaptureVerdict {
  const failure = pire(input.failure, input.journalFailure)
  // Quand la capture va bien et que seul le journal cloche, il faut le dire :
  // sans cela, on chercherait un défaut de capture qui n'existe pas.
  const seulLeJournal = input.failure === '' && input.journalFailure !== ''
  const quoi = seulLeJournal ? ' (le journal)' : ''

  if (!input.capturing) {
    return {
      state: 'off',
      why: "Rien n'est enregistré : la remontée n'est pas au dernier cran, ou la source n'est pas le GPS.",
    }
  }

  // Ce qui ne se corrigera pas tout seul passe devant : réessayer un compte
  // refusé donnera le même refus au prochain trajet comme à celui-ci.
  if (failure === 'refused') {
    return { state: 'bad', why: `Le serveur refuse le compte de dépôt${quoi} : rien ne partira.` }
  }
  if (failure === 'no-credentials') {
    return { state: 'bad', why: `Aucun compte de dépôt n'est réglé${quoi} : rien ne partira.` }
  }
  if (!input.gpsActive) {
    return { state: 'bad', why: 'Le GPS ne livre plus de position : la capture est vide.' }
  }

  if (failure === 'network') {
    return { state: 'warn', why: `Pas de réseau${quoi} : ce qui attend partira à son retour.` }
  }
  if (input.rejecting) {
    return { state: 'warn', why: 'Le GPS livre des positions trop imprécises pour être gardées.' }
  }

  return { state: 'ok', why: 'La capture tourne et les tranches partent.' }
}
