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

export interface CaptureHealthInput {
  /** La capture tourne-t-elle ? */
  capturing: boolean
  /** Pourquoi le dernier dépôt a échoué, s'il a échoué. */
  failure: 'no-credentials' | 'refused' | 'network' | ''
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

export function captureHealth(input: CaptureHealthInput): CaptureVerdict {
  if (!input.capturing) {
    return {
      state: 'off',
      why: "Rien n'est enregistré : la remontée n'est pas au dernier cran, ou la source n'est pas le GPS.",
    }
  }

  // Ce qui ne se corrigera pas tout seul passe devant : réessayer un compte
  // refusé donnera le même refus au prochain trajet comme à celui-ci.
  if (input.failure === 'refused') {
    return { state: 'bad', why: 'Le serveur refuse le compte de dépôt : rien ne partira.' }
  }
  if (input.failure === 'no-credentials') {
    return { state: 'bad', why: "Aucun compte de dépôt n'est réglé : rien ne partira." }
  }
  if (!input.gpsActive) {
    return { state: 'bad', why: 'Le GPS ne livre plus de position : la capture est vide.' }
  }

  if (input.failure === 'network') {
    return { state: 'warn', why: "Pas de réseau : ce qui attend partira à son retour." }
  }
  if (input.rejecting) {
    return { state: 'warn', why: 'Le GPS livre des positions trop imprécises pour être gardées.' }
  }

  return { state: 'ok', why: 'La capture tourne et les tranches partent.' }
}
