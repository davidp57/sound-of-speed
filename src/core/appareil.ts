/**
 * Sur quoi tourne-t-on : une voiture, un téléphone, un poste de travail ?
 *
 * **C'est le second axe.** Le premier — les rôles, dans `identity/roles.ts` —
 * dit ce que la personne a le droit d'ouvrir ; celui-ci dit ce qui a un sens là
 * où l'on est. Un banc de simulation n'a rien à faire sur l'écran d'une voiture
 * qui roule ; un atelier n'a rien à faire sur un téléphone. Les deux axes se
 * croisent par un et.
 *
 * **Celui-ci ne protège rien, et n'a pas à le faire.** Il range l'écran. Le
 * serveur l'ignore, et ne le reçoit jamais : un navigateur dirait ce qu'il veut.
 *
 * **Il se devine, et il se corrige.** Reconnaître un navigateur à sa chaîne
 * d'agent est un pari qui vieillit mal, et un poste posé dans une voiture
 * n'entre dans aucune case. L'écran du compte laisse donc changer ce choix, qui
 * reste local à cet appareil.
 */

export type Appareil = 'voiture' | 'telephone' | 'poste'

export const APPAREILS: readonly Appareil[] = ['voiture', 'telephone', 'poste']

/** Ce qu'on en dit à l'écran. */
export const NOMS_DAPPAREIL: Record<Appareil, string> = {
  voiture: 'Voiture',
  telephone: 'Téléphone',
  poste: 'Poste de travail',
}

export interface IndicesDAppareil {
  /** La chaîne d'agent du navigateur. */
  agent: string
  /** La largeur de l'écran, en points. */
  largeur: number
  /** Le pointeur est-il grossier — un doigt plutôt qu'une souris ? */
  tactile: boolean
}

/**
 * Ce que le navigateur trahit de lui-même.
 *
 * **Le marqueur `Tesla` reste à confirmer** : il est annoncé par le navigateur
 * embarqué, mais rien ici ne l'a mesuré sur la vraie voiture — le journal qu'elle
 * dépose ne porte pas sa chaîne d'agent. C'est précisément pourquoi le choix se
 * corrige à la main : une détection ratée coûte un réglage, pas un écran perdu.
 */
export function devinerLAppareil({ agent, largeur, tactile }: IndicesDAppareil): Appareil {
  if (/Tesla/i.test(agent)) return 'voiture'
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(agent)) return 'telephone'
  // Un écran tactile et étroit sans rien dire de plus : c'est un téléphone plus
  // souvent qu'un poste de travail, et se tromper ici n'ouvre qu'un écran de
  // trop.
  if (tactile && largeur < 900) return 'telephone'
  return 'poste'
}

/**
 * Ce que le navigateur dit de lui-même, tel que le journal l'enregistre.
 *
 * **Deviné et appliqué, les deux.** Un écart entre les deux dit que quelqu'un a
 * dû corriger à la main — donc que la détection s'est trompée, et c'est
 * exactement ce qu'on cherche à savoir en relisant un trajet.
 */
export function entreeDAppareil(
  indices: IndicesDAppareil,
  applique: Appareil,
  hauteur: number,
): Record<string, string | number | boolean> {
  return {
    agent: indices.agent,
    largeur: indices.largeur,
    hauteur,
    tactile: indices.tactile,
    devine: devinerLAppareil(indices),
    appareil: applique,
  }
}

export function estUnAppareil(valeur: unknown): valeur is Appareil {
  return typeof valeur === 'string' && (APPAREILS as readonly string[]).includes(valeur)
}

const CLE = 'speed.appareil.v1'

/**
 * Le choix corrigé, s'il y en a un.
 *
 * Il ne suit pas le compte, et c'est voulu : deux appareils du même compte ne
 * sont pas le même appareil, et c'est tout l'objet de cet axe.
 */
export function lireLAppareilChoisi(): Appareil | null {
  try {
    const brut = localStorage.getItem(CLE)
    return estUnAppareil(brut) ? brut : null
  } catch {
    return null
  }
}

export function rangerLAppareilChoisi(appareil: Appareil): void {
  try {
    localStorage.setItem(CLE, appareil)
  } catch {
    // Stockage fermé : le choix vaut pour cette session, et on redevinera à la
    // prochaine ouverture.
  }
}

/** Oublie le choix, et s'en remet à nouveau à ce qu'on devine. */
export function oublierLAppareilChoisi(): void {
  try {
    localStorage.removeItem(CLE)
  } catch {
    // Rien à faire.
  }
}

/**
 * L'appareil de ce navigateur : celui qu'on a choisi, sinon celui qu'on devine.
 *
 * Hors navigateur — les tests du cœur, un rendu côté serveur —, c'est un poste
 * de travail : c'est le cas le plus ouvert, et rien n'y dépend de l'écran.
 */
export function appareilCourant(): Appareil {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'poste'

  const choisi = lireLAppareilChoisi()
  if (choisi !== null) return choisi

  return devinerLAppareil({
    agent: navigator.userAgent,
    largeur: window.screen?.width ?? window.innerWidth,
    // `pointer: coarse` dit « un doigt », et c'est la question posée : un écran
    // tactile branché sur un poste répond `fine` tant qu'on a aussi une souris.
    tactile: window.matchMedia?.('(pointer: coarse)').matches === true,
  })
}
