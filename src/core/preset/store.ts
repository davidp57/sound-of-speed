import {
  createFactoryProfiles,
  createV8Profile,
  depositFactoryProfiles,
  knownFactoryProfiles,
} from './defaults'
import { clampEngineDefinition } from './engine-definition'
import { clampRealCar, type RealCar } from './real-car'
import { isDriveMode, type DriveMode } from '../drivetrain/drive-mode'
import { DEFAULT_RENDERING, clampSynthRendering, type SynthRendering } from '../synth/rendering'
import {
  PROFILE_FORMAT_VERSION,
  soundSourceOf,
  type Profile,
  type ProfileFile,
  type ProfileOrigin,
} from './schema'
import { withSevenGears } from './seven-gears'
import type { Trace } from '../speed/replay'

/**
 * Persistance des profils.
 *
 * Le stockage local suffit : il n'y a pas de compte, pas de serveur, et un
 * profil se transporte très bien en JSON. L'export produit un fichier lisible et
 * modifiable à la main, l'import l'avale et le valide champ par champ — un
 * profil venu d'ailleurs ne doit pas pouvoir casser l'application avec une
 * valeur manquante.
 */

/**
 * Les clés gardent le préfixe `speed.`, et non `sound-of-speed.`.
 *
 * Le projet a été renommé le 12 septembre 2026 ; ces clés ne l'ont pas suivi, et
 * c'est délibéré. Elles nomment ce qui dort dans le navigateur de la voiture :
 * les profils, les moteurs, les boîtes, l'étalonnage. Les renommer les rendrait
 * introuvables au premier chargement — le stockage local ne suit aucun renommage
 * — et demanderait une reprise pour un gain nul, puisque rien de tout cela ne se
 * voit à l'usage.
 */
const STORAGE_KEY = 'speed.profiles.v1'
const SELECTED_KEY = 'speed.selectedProfile.v1'
const TRACES_KEY = 'speed.traces.v1'
const VOLUME_KEY = 'speed.masterVolume.v1'
const DEPOSIT_KEY = 'speed.deposit.v1'
const ADVANCED_KEY = 'speed.advancedMode.v1'
const REAL_CAR_KEY = 'speed.realCar.v1'
const DRIVE_MODE_KEY = 'speed.driveMode.v1'

/**
 * Traces conservées d'une session à l'autre.
 *
 * Elles ne vivaient qu'en mémoire : un trajet enregistré en roulant disparaissait
 * au premier rechargement, c'est-à-dire avant même d'avoir pu servir. Or c'est
 * justement pour les rejouer plus tard, ailleurs, qu'on les enregistre.
 */
export function loadTraces(): Trace[] {
  const stored = readJson<Trace[]>(TRACES_KEY)
  return Array.isArray(stored) ? stored.filter(isTrace) : []
}

export function saveTraces(traces: Trace[]): boolean {
  try {
    localStorage.setItem(TRACES_KEY, JSON.stringify(traces))
    return true
  } catch {
    // Quota dépassé : les traces longues pèsent lourd. On le signale plutôt que
    // de laisser croire que l'enregistrement est conservé.
    return false
  }
}

function isTrace(value: unknown): value is Trace {
  if (typeof value !== 'object' || value === null) return false
  const t = value as Partial<Trace>
  return typeof t.name === 'string' && Array.isArray(t.samples)
}

/** Sérialise des traces pour un fichier, lisible et réimportable. */
export function tracesToFile(traces: Trace[]): string {
  return JSON.stringify({ version: 1, traces }, null, 2)
}

export function loadProfiles(): Profile[] {
  const stored = readJson<Profile[]>(STORAGE_KEY)
  if (!stored || !Array.isArray(stored) || stored.length === 0) {
    return createFactoryProfiles()
  }
  return stored.map((profile) => reconcile(profile))
}

export function saveProfiles(profiles: Profile[]): void {
  writeJson(STORAGE_KEY, profiles)
}

export function loadSelectedId(): string | null {
  try {
    return localStorage.getItem(SELECTED_KEY)
  } catch {
    return null
  }
}

export function saveSelectedId(id: string): void {
  try {
    localStorage.setItem(SELECTED_KEY, id)
  } catch {
    // Navigation privée, quota plein : ce n'est pas une raison pour tout arrêter.
  }
}

/**
 * Volume général : une préférence de **l'appareil**, pas un caractère de profil.
 *
 * Il dépend de la puissance de l'autoradio, de la position du téléphone, du
 * bruit de roulement — rien qui soit un attribut du moteur qu'on imite. Rangé
 * dans le profil, il sautait à chaque changement de voix, voyageait vers celui
 * qui recevait un profil partagé, et se remettait en réinitialisant une section
 * qui n'avait rien à voir.
 *
 * Absent, il n'y a pas de valeur par défaut à inventer : c'est à l'appelant de
 * reprendre celle du profil actif, une fois, à la première ouverture.
 */
export function loadMasterVolume(): number | null {
  try {
    const raw = localStorage.getItem(VOLUME_KEY)
    if (raw === null) return null
    const value = Number(raw)
    return Number.isFinite(value) && value >= 0 ? value : null
  } catch {
    return null
  }
}

export function saveMasterVolume(volume: number): void {
  try {
    localStorage.setItem(VOLUME_KEY, String(volume))
  } catch {
    // Comme au-dessus : le son continue même si la préférence ne se retient pas.
  }
}

/**
 * Mode avancé de l'écran de configuration : une préférence de **l'appareil**.
 *
 * Comme le volume, et pour la même raison : ce n'est pas un caractère de moteur.
 * Régler au détail ou s'en tenir aux curseurs globaux dépend de ce qu'on est en
 * train de faire, pas du profil qu'on écoute — et cela n'a donc rien à faire
 * dans un profil partagé, ni à sauter quand on change de voix.
 *
 * Absent, la vue reste courte : c'est le mode simplifié qui est le défaut.
 */
/**
 * La vraie voiture de cet appareil.
 *
 * Une préférence d'appareil et non un profil : il n'y a qu'une voiture, et un
 * profil reçu de quelqu'un d'autre ne doit pas l'écraser. Rendue aux valeurs
 * d'usine quand rien n'est enregistré, et nettoyée de ce qui sort de son
 * domaine — un stockage local se modifie à la main.
 */
export function loadRealCar(): RealCar {
  return clampRealCar(readJson<Partial<RealCar>>(REAL_CAR_KEY) ?? undefined)
}

/**
 * La voiture enregistrée, ou rien si elle ne l'a jamais été.
 *
 * Rend `null` plutôt que les valeurs d'usine, pour la même raison que le mode de
 * conduite : au premier lancement, la voiture se **reprend** du profil actif,
 * qui portait jusqu'ici les réglages de mesure. Imposer les valeurs d'usine
 * effacerait un étalonnage fait au volant sans que rien ne le dise.
 */
export function storedRealCar(): RealCar | null {
  const brut = readJson<Partial<RealCar>>(REAL_CAR_KEY)
  return brut ? clampRealCar(brut) : null
}

export function saveRealCar(car: RealCar): void {
  writeJson(REAL_CAR_KEY, clampRealCar(car))
}

/**
 * Le mode de conduite retenu sur cet appareil, ou rien s'il n'a jamais été
 * choisi.
 *
 * Rend `null` plutôt qu'un défaut : au premier lancement, le mode se **déduit**
 * du profil actif, dont les seuils portaient jusqu'ici le tempérament. Imposer
 * « route » ferait conduire un profil Sport comme un profil Route sans que rien
 * ne le dise.
 */
export function loadDriveMode(): DriveMode | null {
  try {
    const brut = localStorage.getItem(DRIVE_MODE_KEY)
    return isDriveMode(brut) ? brut : null
  } catch {
    return null
  }
}

export function saveDriveMode(mode: DriveMode): void {
  try {
    localStorage.setItem(DRIVE_MODE_KEY, mode)
  } catch {
    // Comme le reste : l'échec d'écriture n'interrompt pas la conduite.
  }
}

export function loadAdvancedMode(): boolean {
  try {
    return localStorage.getItem(ADVANCED_KEY) === '1'
  } catch {
    return false
  }
}

export function saveAdvancedMode(advanced: boolean): void {
  try {
    localStorage.setItem(ADVANCED_KEY, advanced ? '1' : '0')
  } catch {
    // Navigation privée, quota plein : la bascule marche quand même, elle ne se
    // retient simplement pas.
  }
}

/**
 * Volume que portait un profil enregistré par la version précédente.
 *
 * Lu **avant** toute normalisation, directement dans le stockage : c'est
 * indispensable, et le contraire a été essayé. La reprise passait d'abord par la
 * liste des profils chargés, or les charger les nettoie de ce champ — la valeur
 * réglée par l'utilisateur avait donc déjà disparu quand on venait la chercher,
 * et l'on retombait sur la valeur par défaut. Le réglage était perdu en silence.
 *
 * Rend `null` quand il n'y a rien à reprendre : un appareil neuf, ou un profil
 * déjà au format courant.
 */
export function loadInheritedVolume(selectedId: string | null): number | null {
  const stored = readJson<unknown[]>(STORAGE_KEY)
  if (!Array.isArray(stored)) return null

  const profils = stored.filter(isRecord)
  const actif = profils.find((p) => p['id'] === selectedId) ?? profils[0]
  const mix = actif?.['mix']
  if (!isRecord(mix)) return null

  const herite = mix['masterGain']
  return typeof herite === 'number' && Number.isFinite(herite) && herite >= 0 ? herite : null
}

/**
 * Le compte de dépôt a disparu, et sa clé avec lui.
 *
 * `speed.deposit.v1` portait un nom et un mot de passe saisis à l'écran de
 * configuration. Depuis que l'appareil a son propre compte, le témoin de
 * connexion voyage tout seul et il n'y a plus rien à saisir. La clé est effacée
 * au chargement : y laisser un mot de passe en clair, pour quelque chose qui
 * n'ouvre plus rien, serait une négligence gratuite.
 */
export function oublierLeCompteDeDepot(): void {
  try {
    localStorage.removeItem(DEPOSIT_KEY)
  } catch {
    // Stockage fermé : il n'y a rien à effacer que l'on puisse atteindre.
  }
}

/**
 * Profils d'usine absents de la liste, repérés par leur identifiant.
 *
 * Sert à récupérer un profil livré après coup : celui qui a commencé avec une
 * seule voix n'a aucune raison d'être privé de la suivante, ni de devoir tout
 * ressaisir.
 *
 * **`availableBanks` ouvre la porte aux profils qu'on ne livre pas.** Un profil
 * d'usine réglé sur une banque **déposée** ne peut pas partir avec
 * l'application — les échantillons ne sont pas redistribuables — mais il n'a
 * aucune raison d'être introuvable chez qui a la banque. On le propose donc
 * quand le serveur la liste, et jamais sinon : proposer un profil muet serait
 * pire que ne rien proposer.
 *
 * David l'a relevé le 14 septembre 2026, le jour où le profil V8 a cessé d'être
 * livré : « on n'a pas de profil pour l'ancien V8 ? la banque procar ». Non, et
 * c'était un trou — chez lui, la banque est là.
 */
export function missingFactoryProfiles(
  existing: Profile[],
  availableBanks: readonly string[] = [],
): Profile[] {
  const known = new Set(existing.map((p) => p.id))
  const listees = new Set(availableBanks)
  const proposables = [
    ...createFactoryProfiles(),
    ...depositFactoryProfiles().filter((p) => listees.has(p.sampleDir)),
  ]
  return proposables.filter((p) => !known.has(p.id))
}

/** Sections d'un profil que l'on peut ramener séparément à leur état d'usine. */
export type ProfileSection = 'engine' | 'drivetrain' | 'speed' | 'mix' | 'feel' | 'layers'

/**
 * Relève les valeurs d'un profil, pour lui servir plus tard d'état d'origine.
 *
 * Une copie profonde : le profil continuera d'être modifié, son origine ne doit
 * pas suivre.
 */
export function captureOrigin(profile: Profile): ProfileOrigin {
  const { sampleDir, engine, drivetrain, speed, mix, feel, layers } = deepCopy(profile)
  return { sampleDir, engine, drivetrain, speed, mix, feel, layers }
}

/**
 * État auquel un profil doit revenir quand on le réinitialise.
 *
 * Trois sources, dans cet ordre :
 *
 * 1. **ses propres valeurs d'origine**, s'il les porte — le cas des profils
 *    sortis du guide de création et des duplications ;
 * 2. le **profil livré** de même identifiant, pour Route et Sport ;
 * 3. à défaut, les valeurs par défaut génériques.
 *
 * Le troisième cas était auparavant le seul repli, si bien que réinitialiser une
 * section d'un profil fabriqué rendait les valeurs de **Sport**. Il ne reste
 * utile que pour les profils venus d'une version antérieure, qui n'ont pas
 * d'origine enregistrée.
 */
function factoryOrigin(profile: Profile): ProfileOrigin {
  if (profile.origin) return deepCopy(profile.origin)
  // Cherché parmi tous les calibrages connus, comme la reprise : un profil
  // « Route » ou « Sport » enregistré doit retrouver **ses** valeurs, et non
  // celles du profil livré du moment.
  const livre = knownFactoryProfiles().find((p) => p.id === profile.id)
  return captureOrigin(livre ?? createV8Profile())
}

/**
 * Ramène une section — ou le profil entier — à son état d'usine.
 *
 * Un réglage se cherche en tâtonnant, et rien ne permettait jusqu'ici de revenir
 * en arrière : une valeur mal saisie dans la transmission obligeait à supprimer
 * le profil, donc à perdre aussi tout ce qui avait été trouvé ailleurs. La
 * réinitialisation se fait donc section par section, l'identifiant et le nom
 * étant toujours conservés.
 */
export function resetProfileSection(profile: Profile, section: ProfileSection | 'all'): Profile {
  const origin = factoryOrigin(profile)
  if (section === 'all') return applyOrigin(profile, origin)
  // La banque part avec les couches : les noms de fichiers d'usine ne veulent
  // rien dire dans un autre dossier, et remettre les uns sans l'autre laisserait
  // un profil qui ne joue plus rien.
  if (section === 'layers') return { ...profile, layers: origin.layers, sampleDir: origin.sampleDir }
  return { ...profile, [section]: origin[section] }
}

/**
 * Repose sur un profil un état relevé plus tôt.
 *
 * L'identité ne se réinitialise pas — identifiant, nom, statut de favori — et
 * l'origine reste attachée : on doit pouvoir y revenir autant de fois qu'on
 * veut.
 *
 * Sert à deux choses : la réinitialisation aux valeurs d'usine, et le retour en
 * arrière après le mouvement d'un curseur global, qui écrase une dizaine de
 * réglages d'un coup.
 */
export function applyOrigin(profile: Profile, origin: ProfileOrigin): Profile {
  const remis: Profile = {
    ...profile,
    ...deepCopy(origin),
    id: profile.id,
    name: profile.name,
    favorite: profile.favorite,
  }
  if (profile.origin) remis.origin = deepCopy(profile.origin)
  return remis
}

/**
 * Copie profonde, sans lien avec l'original.
 *
 * `structuredClone` échoue ici : les profils manipulés par l'interface sont
 * enveloppés dans les mandataires de réactivité de Vue, qu'il refuse de cloner.
 * Un aller-retour par JSON les traverse sans difficulté, un profil ne contenant
 * que des nombres, des chaînes et des booléens.
 */
export function deepCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

/**
 * Copie profonde avec un nouvel identifiant. Sert au bouton « dupliquer ».
 *
 * La copie hérite de l'origine de son modèle quand il en a une ; sinon elle
 * prend ses valeurs du moment comme origine. Dans les deux cas elle a un état
 * de retour, ce qui n'était pas le cas avant : une duplication de Route
 * revenait aux valeurs de Sport.
 */
export function duplicateProfile(profile: Profile, name: string): Profile {
  const copie = deepCopy(profile)
  return { ...copie, id: newId(), name, origin: copie.origin ?? captureOrigin(copie) }
}

/**
 * Un identifiant de profil : l'instant, et du hasard.
 *
 * **Deux profils créés dans la même milliseconde ne se distinguent que par le
 * hasard**, donc c'est lui qui décide de l'unicité. Il en tenait cinq caractères
 * tirés de `Math.random`, soit soixante millions de possibilités : assez pour
 * l'usage — on ne crée pas deux profils dans la même milliseconde —, pas assez
 * pour le test qui en tire deux cents d'affilée, et qui rougissait une fois sur
 * cinq mille cinq cents. Mesuré sur cinquante mille exécutions.
 *
 * Dix caractères maintenant, et tirés de `getRandomValues` plutôt que découpés
 * dans un flottant : la longueur y est constante, alors que `Math.random()` rend
 * parfois trop peu de décimales pour en donner dix. Trois millions six cent mille
 * milliards de possibilités.
 */
export function newId(): string {
  return `p-${Date.now().toString(36)}-${hasard(10)}`
}

/** Des caractères tirés au sort, en nombre voulu. */
function hasard(combien: number): string {
  const octets = new Uint8Array(combien)
  crypto.getRandomValues(octets)
  // Le reste modulo trente-six penche très légèrement vers les quatre premiers
  // caractères — 256 n'est pas un multiple de 36. Sans conséquence : on cherche
  // de l'unicité, pas de l'imprévisibilité, et rien ici ne se devine.
  return Array.from(octets, (octet) => (octet % 36).toString(36)).join('')
}

/** Sérialise un profil dans le format de fichier, prêt à être téléchargé. */
export function toFile(profile: Profile): string {
  const payload: ProfileFile = { version: PROFILE_FORMAT_VERSION, profile }
  return JSON.stringify(payload, null, 2)
}

export class ProfileImportError extends Error {}

/**
 * Lit un fichier de profil. Chaque champ absent est remplacé par sa valeur par
 * défaut plutôt que de faire échouer l'import : un profil exporté par une
 * version antérieure reste utilisable.
 */
export function fromFile(
  text: string,
  /**
   * Qui décide de l'identifiant.
   *
   * Par défaut un identifiant neuf : recevoir le profil de quelqu'un d'autre ne
   * doit pas écraser le sien parce que les deux sont nés du même profil
   * d'usine. Mais un profil qui redescend de **sa propre** base est le même
   * profil : lui en donner un neuf en ferait un double, et son prochain dépôt
   * un second fichier sur le serveur.
   */
  identifiant: (origine?: string) => string = () => newId(),
): Profile {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new ProfileImportError('Le fichier n’est pas du JSON valide.')
  }

  if (!isRecord(parsed)) throw new ProfileImportError('Le fichier est vide ou mal formé.')

  const candidate = isRecord(parsed['profile']) ? parsed['profile'] : parsed
  if (!isRecord(candidate)) throw new ProfileImportError('Aucun profil trouvé dans le fichier.')

  const origine = typeof candidate['id'] === 'string' ? candidate['id'] : undefined
  return reconcile({ ...(candidate as Partial<Profile>), id: identifiant(origine) } as Profile)
}

/**
 * Complète un profil partiel avec les valeurs par défaut, section par section.
 * Les couches sont reprises telles quelles si elles existent, parce qu'elles
 * dépendent des fichiers présents et qu'aucune valeur par défaut n'y a de sens.
 *
 * **La base est choisie par identifiant.** Elle ne l'était pas : tout profil
 * enregistré était complété avec les valeurs du profil Sport, y compris un
 * profil Route. Un champ ajouté au schéma arrivait donc dans le Route de
 * l'utilisateur avec la valeur de Sport — mesuré sur les six réglages ajoutés
 * depuis : plancher de croisière à 2000 au lieu de 1500, délai de croisière à
 * 3,5 s au lieu de 2,2, seuil de rétrogradage au freinage à −0,7 au lieu de −1,
 * relief de charge à 5 dB au lieu de 4, relief de régime à 4 au lieu de 3.
 *
 * Autrement dit, chaque réglage livré pour Route arrivait chez lui réglé pour
 * Sport, et les essais sur route portaient sur des valeurs que personne n'avait
 * choisies. La réinitialisation, elle, cherchait déjà le bon profil par son
 * identifiant (`factoryOrigin`) : les deux chemins disent enfin la même chose.
 */
function reconcile(profile: Partial<Profile>): Profile {
  // Cherché parmi **tous** les calibrages connus, et non les seuls livrés : un
  // profil « Route » ou « Sport » enregistré avant que le profil livré devienne
  // le V8 doit garder sa base à lui, sinon il se voit complété avec les valeurs
  // d'un autre.
  const base =
    knownFactoryProfiles().find((livre) => livre.id === profile.id) ?? createV8Profile()
  const complet: Profile = {
    id: typeof profile.id === 'string' && profile.id ? profile.id : newId(),
    name: typeof profile.name === 'string' && profile.name ? profile.name : base.name,
    favorite: profile.favorite === true,
    // Un profil enregistré avant l'arrivée du champ — ou porteur d'une valeur
    // qu'on ne connaît pas — est repris en « enregistré » : c'est ce qu'il a
    // toujours été, et c'est la seule origine qui ne demande rien de plus que
    // la banque qu'il désigne déjà.
    soundSource: soundSourceOf(profile),
    sampleDir:
      typeof profile.sampleDir === 'string' && profile.sampleDir
        ? profile.sampleDir
        : base.sampleDir,
    engine: { ...base.engine, ...(profile.engine ?? {}) },
    drivetrain: migrateDrivetrain(base, profile.drivetrain),
    speed: migrateSpeed(base, profile.speed),
    mix: migrateMix(base, profile.mix),
    feel: {
      kickdown: { ...base.feel.kickdown, ...(profile.feel?.kickdown ?? {}) },
      backfire: { ...base.feel.backfire, ...(profile.feel?.backfire ?? {}) },
      shiftJolt: { ...base.feel.shiftJolt, ...(profile.feel?.shiftJolt ?? {}) },
    },
    layers:
      Array.isArray(profile.layers) && profile.layers.length > 0
        ? profile.layers.map(widenNarrowLayer)
        : base.layers,
  }

  // Le moteur désigné est repris tel quel, et simplement absent sinon. On ne lui
  // en attribue pas d'office : un profil qui n'en désigne aucun joue ses propres
  // valeurs, ce qu'il a toujours fait, et lui coller un moteur inventé
  // prétendrait qu'il vient d'une bibliothèque où il n'a jamais été.
  if (typeof profile.engineId === 'string' && profile.engineId) {
    complet.engineId = profile.engineId
  }
  if (typeof profile.gearboxId === 'string' && profile.gearboxId) {
    complet.gearboxId = profile.gearboxId
  }

  // L'origine est reprise telle quelle quand elle est là, et simplement absente
  // sinon : un profil venu d'une version antérieure garde le repli d'avant
  // plutôt que de se voir attribuer une origine inventée.
  if (isRecord(profile.origin)) complet.origin = profile.origin as ProfileOrigin

  // La définition de moteur est reprise sur celle du profil d'usine : un profil
  // enregistré avant qu'elle ait une forme n'en portait pas, et un profil qui la
  // porte peut venir d'une main ou d'une version antérieure. Dans les deux cas
  // il ressort avec les vingt-sept nombres du contrat, dans leur domaine —
  // aucun profil ne se retrouve sans moteur à décrire.
  complet.engineDefinition = clampEngineDefinition({
    ...(base.engineDefinition ?? {}),
    ...(isRecord(profile.engineDefinition) ? profile.engineDefinition : {}),
  })

  // Le rendu suit la même règle que la définition, et pour la même raison : un
  // profil enregistré avant la version 6 n'en portait pas, et un profil qui en
  // porte un peut venir d'une main. Il ressort avec un rendu complet et borné,
  // repris sur celui de son profil d'usine.
  complet.rendering = clampSynthRendering({
    ...DEFAULT_RENDERING,
    ...(base.rendering ?? {}),
    ...(isRecord(profile.rendering) ? profile.rendering : {}),
  } as SynthRendering)

  return complet
}

/**
 * Reprend un mixage enregistré par une version antérieure.
 *
 * Le volume général a quitté le profil : c'est une préférence de l'appareil, pas
 * un caractère de moteur. La valeur qui s'y trouvait a servi une fois, à la
 * première ouverture, pour initialiser cette préférence — voir `state.ts`. Elle
 * est ensuite retirée du stockage plutôt que laissée morte, sans quoi le schéma
 * mentirait à qui le lit.
 */
function migrateMix(
  base: Profile,
  stored: Partial<Profile['mix']> | undefined,
): Profile['mix'] {
  const merged: Record<string, unknown> = { ...base.mix, ...(stored ?? {}) }
  delete merged.masterGain

  // Arrivée de l'effort : le ralenti perd le relief de charge que la charge à
  // un demi lui laissait sans raison. Les profils livrés ont vu leur niveau de
  // ralenti recalé d'autant ; un profil déjà enregistré, lui, porte l'ancienne
  // valeur et sonnerait quatre à cinq décibels plus bas qu'hier. On la lui
  // remonte du même montant, une fois, reconnaissable à l'absence du repère de
  // traînée — le seul marqueur qui distingue un profil d'avant.
  if (stored && stored.dragRefKmh === undefined) {
    const relief = typeof merged.loadReliefDb === 'number' ? merged.loadReliefDb : 0
    const idle = typeof merged.idleLevelDb === 'number' ? merged.idleLevelDb : 0
    merged.idleLevelDb = idle + relief
  }

  return merged as unknown as Profile['mix']
}

/**
 * Reprend un signal de vitesse enregistré par une version antérieure.
 *
 * La zone morte a disparu : elle retirait un écart fixe en km/h avant de diviser
 * par la durée de la fenêtre, ce qui annulait les accélérations douces dès que
 * le GPS livrait plus d'une mesure par seconde. La pente est désormais ajustée
 * sur toutes les mesures de la fenêtre, et le bruit se moyenne au lieu d'être
 * seuillé. Le champ est retiré plutôt que laissé mort dans le stockage.
 */
function migrateSpeed(
  base: Profile,
  stored: Partial<Profile['speed']> | undefined,
): Profile['speed'] {
  const merged: Record<string, unknown> = { ...base.speed, ...(stored ?? {}) }
  delete merged.accelDeadbandKmh
  return merged as unknown as Profile['speed']
}

/**
 * Élargit vers le grave les couches restées à l'ancienne borne de lecture.
 *
 * Cette borne valait la moitié de la vitesse nominale, ce qui rendait
 * l'enregistrement haut régime injouable en dessous de la moitié de son régime
 * d'ancrage — soit la majeure partie du domaine sur un moteur de série. Sa
 * hauteur s'y figeait, et on entendait un second moteur tourner à régime
 * constant derrière le premier.
 */
function widenNarrowLayer<T extends { minRate: number }>(layer: T): T {
  return layer.minRate === 0.5 ? { ...layer, minRate: 0.25 } : layer
}

/**
 * Reprend une transmission enregistrée par une version antérieure.
 *
 * Les régimes de passage étaient exprimés par deux fractions du rupteur valables
 * pour tous les rapports. On les convertit en une table par rapport plutôt que
 * de les perdre : un profil réglé à l'oreille ne doit pas être remis à zéro par
 * une mise à jour.
 */
function migrateDrivetrain(
  base: Profile,
  stored: Partial<Profile['drivetrain']> | undefined,
): Profile['drivetrain'] {
  // La boîte à six rapports livrée jusqu'au 11 septembre 2026 gagne sa septième
  // et son haut réétagé. Une boîte réglée à la main n'est pas touchée.
  const merged = withSevenGears({ ...base.drivetrain, ...(stored ?? {}) })
  if (Array.isArray(stored?.upshiftRpm) && stored.upshiftRpm.length > 0) return merged

  const legacy = stored as { upshiftAtRedlineRatio?: number; upshiftAtLowLoadRatio?: number }
  const full = legacy?.upshiftAtRedlineRatio
  const light = legacy?.upshiftAtLowLoadRatio
  if (typeof full !== 'number' || typeof light !== 'number') return merged

  const redline = base.engine.redlineRpm
  const count = Math.max(1, merged.gearRatios.length - 1)
  // L'ancien seuil à mi-charge devient la valeur de référence, identique pour
  // tous les rapports : c'était précisément le comportement d'avant.
  const middle = redline * ((full + light) / 2)
  merged.upshiftRpm = Array.from({ length: count }, () => Math.round(middle))
  merged.upshiftLoadSpreadRpm = Math.round(redline * (full - light))
  return merged
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Idem : l'échec d'écriture ne doit pas interrompre la conduite.
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
