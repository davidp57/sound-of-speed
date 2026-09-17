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
 * La place dont l'application dispose vraiment, à cet instant.
 *
 * **Trois cadres emboîtés, et il faut les trois.** Il manquait 481 px de large
 * et 209 px de haut entre l'écran que la voiture annonce — 1 254 × 784 — et la
 * page que David a mesurée à 773 × 575. De la place que prend une barre n'est
 * pas de la place qu'on n'aura jamais : la première se récupère en plein écran,
 * la seconde jamais. Un seul chiffre ne permet pas de les distinguer.
 *
 * `echelle` est celle du viewport visuel, et c'est elle qui **dénonce un
 * zoom** : le navigateur de la Tesla ne le laisse pas régler, et sa valeur par
 * défaut a changé avec le logiciel de bord.
 */
export interface MesureDEcran {
  /** La page : `documentElement.clientWidth` / `clientHeight`. */
  page: { largeur: number; hauteur: number }
  /** La fenêtre, barres du navigateur comprises ou non selon le cadre. */
  fenetre: { largeur: number; hauteur: number }
  /** Le châssis de la fenêtre, tout compris. */
  chassis: { largeur: number; hauteur: number }
  /** L'écran annoncé par le système, et ce qu'il en laisse. */
  ecran: { largeur: number; hauteur: number; utileLargeur: number; utileHauteur: number }
  /** Pixels physiques par pixel CSS. */
  densite: number
  /** Échelle du viewport visuel : au-delà de 1, quelqu'un a zoomé. */
  echelle: number
  orientation: string
  pleinEcran: boolean
}

/** La fenêtre, réduite à ce qu'on lui demande — de quoi mesurer sans navigateur. */
export interface FenetreMesurable {
  document?: {
    documentElement?: { clientWidth?: number; clientHeight?: number }
    fullscreenElement?: unknown
  }
  innerWidth?: number
  innerHeight?: number
  outerWidth?: number
  outerHeight?: number
  screen?: {
    width?: number
    height?: number
    availWidth?: number
    availHeight?: number
    orientation?: { type?: string }
  }
  devicePixelRatio?: number
  visualViewport?: { scale?: number } | null
}

export function mesurerLEcran(fenetre: FenetreMesurable): MesureDEcran {
  const racine = fenetre.document?.documentElement
  const ecran = fenetre.screen
  return {
    page: { largeur: racine?.clientWidth ?? 0, hauteur: racine?.clientHeight ?? 0 },
    fenetre: { largeur: fenetre.innerWidth ?? 0, hauteur: fenetre.innerHeight ?? 0 },
    chassis: { largeur: fenetre.outerWidth ?? 0, hauteur: fenetre.outerHeight ?? 0 },
    ecran: {
      largeur: ecran?.width ?? 0,
      hauteur: ecran?.height ?? 0,
      utileLargeur: ecran?.availWidth ?? 0,
      utileHauteur: ecran?.availHeight ?? 0,
    },
    densite: fenetre.devicePixelRatio ?? 1,
    // Absent sur les navigateurs anciens : 1 est alors la seule chose honnête à
    // dire, et le zoom ne se distinguera pas. Mieux vaut le savoir que
    // l'inventer.
    echelle: fenetre.visualViewport?.scale ?? 1,
    orientation: ecran?.orientation?.type ?? 'inconnue',
    pleinEcran: fenetre.document?.fullscreenElement != null,
  }
}

/**
 * La mesure vaut-elle quelque chose ?
 *
 * **Une page masquée mesure zéro.** Le navigateur suspend le rendu d'un volet
 * qu'on ne voit pas, et tout en sort à zéro — page, fenêtre, écran, jusqu'à la
 * densité qui retombe à 1. Une telle ligne au journal ne dit pas « l'écran fait
 * zéro pixel », elle dit « personne ne regardait », et rien ne l'en
 * distinguerait une fois écrite. On ne l'écrit donc pas.
 *
 * Le cas n'est pas théorique : il s'est produit dès la première vérification de
 * cette mesure, dans le navigateur de prévisualisation replié.
 */
export function mesureUtilisable(mesure: MesureDEcran): boolean {
  return mesure.page.largeur > 0 && mesure.page.hauteur > 0
}

/**
 * Ce que le navigateur dit de lui-même, tel que le journal l'enregistre.
 *
 * **Deviné et appliqué, les deux.** Un écart entre les deux dit que quelqu'un a
 * dû corriger à la main — donc que la détection s'est trompée, et c'est
 * exactement ce qu'on cherche à savoir en relisant un trajet.
 *
 * **En clés courtes et plates.** Le journal se relit dans un tableau, colonne
 * par colonne ; un objet imbriqué y devient une cellule qu'on ne trie pas.
 */
export function entreeDAppareil(
  indices: IndicesDAppareil,
  applique: Appareil,
  mesure: MesureDEcran,
): Record<string, string | number | boolean> {
  return {
    agent: indices.agent,
    largeur: mesure.ecran.largeur,
    hauteur: mesure.ecran.hauteur,
    tactile: indices.tactile,
    devine: devinerLAppareil(indices),
    appareil: applique,
    pageL: mesure.page.largeur,
    pageH: mesure.page.hauteur,
    fenetreL: mesure.fenetre.largeur,
    fenetreH: mesure.fenetre.hauteur,
    chassisL: mesure.chassis.largeur,
    chassisH: mesure.chassis.hauteur,
    utileL: mesure.ecran.utileLargeur,
    utileH: mesure.ecran.utileHauteur,
    densite: mesure.densite,
    echelle: mesure.echelle,
    orientation: mesure.orientation,
    pleinEcran: mesure.pleinEcran,
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

const CLE_ETALON = 'speed.etalonEcran.v1'

/**
 * Ce qu'un pixel CSS fait en millimètres sur cet écran, s'il a été étalonné.
 *
 * Mesuré à la carte bancaire dans la mire de l'atelier, parce qu'aucune API ne
 * le donne : les unités physiques du CSS sont fixées à 96 px par pouce quelle
 * que soit la dalle. Local à l'appareil, comme le choix d'appareil — deux
 * écrans du même compte n'ont pas la même taille de pixel.
 */
export function lireLEtalonDEcran(): number | null {
  try {
    const brut = Number(localStorage.getItem(CLE_ETALON))
    return Number.isFinite(brut) && brut > 0 ? brut : null
  } catch {
    return null
  }
}

export function rangerLEtalonDEcran(mmParPixel: number): void {
  try {
    localStorage.setItem(CLE_ETALON, String(mmParPixel))
  } catch {
    // Stockage fermé : la valeur part quand même au journal, qui est ce qui
    // compte — c'est au bureau qu'on la relira.
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
