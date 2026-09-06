/**
 * Ce que l'utilisateur a accepté de laisser partir.
 *
 * L'accord gouvernait le seul journal de bord. Il gouverne maintenant **tout**
 * ce que l'application envoie d'elle-même, et c'est la raison d'être de ce
 * module : une promesse faite à l'utilisateur ne peut pas être écrite à quatre
 * endroits, un par nature de fichier, sans finir par diverger.
 *
 * `none` est la valeur par défaut, et rien ne part alors — pas même un journal
 * gardé en local, puisqu'il n'y aurait aucune raison de l'écrire.
 */
export type UploadConsent = 'none' | 'minimal' | 'extended'

/**
 * Les natures de fichier qui remontent.
 *
 * Une liste fermée : c'est elle qui permet de dire à l'écran ce que chaque cran
 * envoie, et de le vérifier par un test plutôt que par une relecture.
 */
export type UploadKind = 'journal' | 'measurement' | 'profile' | 'trace'

/**
 * Le cran minimum à partir duquel chaque nature part toute seule.
 *
 * **La trace est au troisième cran, et ce n'est pas évident.** Elle ne contient
 * aucune coordonnée — c'est ce qui permet de l'exporter en fichier sans accord
 * particulier. Mais elle porte la conduite à la cadence du GPS là où le journal
 * n'en garde qu'un relevé toutes les dix secondes, et une conduite complète et
 * datée en dit assez pour être annoncée avant, et non après.
 *
 * **Un profil ne dit rien de l'utilisateur** : ce sont des réglages de son.
 */
const REQUIRED: Record<UploadKind, Exclude<UploadConsent, 'none'>> = {
  journal: 'minimal',
  measurement: 'minimal',
  profile: 'minimal',
  trace: 'extended',
}

/** Cette nature part-elle toute seule, à ce cran ? */
export function sendsAutomatically(consent: UploadConsent, kind: UploadKind): boolean {
  if (consent === 'none') return false
  if (consent === 'extended') return true
  return REQUIRED[kind] === 'minimal'
}

/** Ce que le cran ajoute, pour l'écrire à l'écran sans le recopier à la main. */
export function kindsAt(consent: UploadConsent): UploadKind[] {
  const all: UploadKind[] = ['journal', 'measurement', 'profile', 'trace']
  return all.filter((kind) => sendsAutomatically(consent, kind))
}
