/**
 * Le nom d'un compte qui s'est créé tout seul.
 *
 * **C'est une étiquette, pas une clé.** Elle ne donne accès à rien : ce qui
 * ouvre un compte depuis un autre appareil est le code de liaison, qui ne sert
 * qu'une fois et expire. Elle sert à reconnaître son compte quand on en voit le
 * nom — et c'est déjà plus que ce que faisait « Appareil du 13/09/2026 », qui
 * désignait tous les appareils ouverts le même jour.
 *
 * **Deux mots et un nombre**, dans cet ordre : un nom, un adjectif, deux
 * chiffres. `houle-paisible-47`, `granit-nocturne-12`. Du français ordinaire,
 * qui se retient et se dit à voix haute.
 *
 * **Les adjectifs sont tous épicènes** — même forme au masculin et au féminin.
 * C'est ce qui permet de tirer le nom et l'adjectif indépendamment sans jamais
 * produire de faute d'accord, et c'est la seule contrainte du vocabulaire avec
 * celle de l'absence d'accent, qui garde l'étiquette recopiable telle quelle.
 *
 * **Rien ne garantit l'unicité, et rien ne l'exige.** Un peu moins d'un million
 * de combinaisons pour un serveur qui en comptera quelques dizaines : deux
 * comptes du même nom sont improbables, et sans conséquence s'ils arrivent —
 * ce qui distingue deux comptes est leur identifiant, jamais leur nom.
 */

/**
 * Des noms, tous concrets et sans accent.
 *
 * Paysages, temps qu'il fait, bêtes et matières : de quoi faire une image en
 * deux mots. Un nom abstrait donnerait des étiquettes qu'on ne voit pas.
 */
const NOMS: readonly string[] = [
  'brume',
  'orage',
  'aurore',
  'cerisier',
  'glacier',
  'falaise',
  'lagune',
  'sillage',
  'givre',
  'houle',
  'dune',
  'ravin',
  'brise',
  'ardoise',
  'silex',
  'tilleul',
  'roseau',
  'bourrasque',
  'solstice',
  'mistral',
  'estuaire',
  'delta',
  'fjord',
  'banquise',
  'colline',
  'torrent',
  'cascade',
  'prairie',
  'sillon',
  'bosquet',
  'lichen',
  'granit',
  'basalte',
  'argile',
  'sable',
  'galet',
  'varech',
  'marais',
  'source',
  'ruisseau',
  'vallon',
  'combe',
  'sommet',
  'vague',
  'embrun',
  'averse',
  'bruine',
  'nuage',
  'cumulus',
  'alcyon',
  'mouette',
  'sterne',
  'cormoran',
  'pinson',
  'linotte',
  'fauvette',
  'alouette',
  'hirondelle',
  'martinet',
  'chouette',
  'hulotte',
  'chevreuil',
  'martre',
  'loutre',
  'blaireau',
  'renard',
  'lynx',
  'hermine',
  'belette',
  'campagnol',
  'mulot',
  'sanglier',
  'ajonc',
  'ronce',
  'lierre',
  'mousse',
  'noisetier',
  'sureau',
  'saule',
  'aulne',
  'charme',
  'bouleau',
  'orme',
  'peuplier',
  'myrtille',
  'framboise',
  'groseille',
  'prunelle',
  'sorbier',
  'alisier',
  'lune',
  'soleil',
  'astre',
  'nadir',
  'quartz',
  'cuivre',
  'ivoire',
  'lin',
  'chanvre',
  'osier',
  'jonc',
  'tourbe',
  'humus',
  'silence',
  'sentier',
  'clairon',
  'fanal',
  'phare',
  'quai',
  'digue',
  'ponton',
  'crique',
  'archipel',
  'cap',
  'anse',
  'mangrove',
  'canyon',
  'plateau',
  'cirque',
]

/**
 * Des adjectifs épicènes, sans accent.
 *
 * Aucun ne s'accorde en genre — `sauvage`, `tranquille`, `mauve` —, donc aucun
 * tirage ne peut produire « granit sauvageE ». Ajouter un adjectif à cette
 * liste demande de vérifier ce seul point ; le test s'en assure.
 */
const ADJECTIFS: readonly string[] = [
  'calme',
  'tranquille',
  'sauvage',
  'fragile',
  'paisible',
  'immobile',
  'limpide',
  'rapide',
  'vaste',
  'libre',
  'sombre',
  'rouge',
  'jaune',
  'mauve',
  'tendre',
  'humide',
  'timide',
  'agile',
  'aimable',
  'morne',
  'terne',
  'mince',
  'souple',
  'lisse',
  'alerte',
  'svelte',
  'sage',
  'grave',
  'brave',
  'jeune',
  'large',
  'propre',
  'simple',
  'utile',
  'fertile',
  'docile',
  'tenace',
  'placide',
  'splendide',
  'candide',
  'aride',
  'acide',
  'torride',
  'rigide',
  'solide',
  'liquide',
  'lucide',
  'avide',
  'morose',
  'nocturne',
  'diurne',
  'taciturne',
  'agreste',
  'modeste',
  'robuste',
  'auguste',
  'juste',
  'triste',
  'leste',
  'preste',
  'chaste',
  'faste',
  'possible',
  'sensible',
  'terrible',
  'visible',
  'invisible',
  'flexible',
  'hostile',
  'futile',
  'mobile',
  'tactile',
  'versatile',
  'volage',
  'volatile',
  'rose',
  'fauve',
  'ocre',
  'beige',
  'pourpre',
  'opale',
  'turquoise',
]

/** Le plus petit et le plus grand nombre, tous deux à deux chiffres. */
const PREMIER_NOMBRE = 10
const DERNIER_NOMBRE = 99

/** Ce qui compose une étiquette, pour qui veut la vérifier ou la reconnaître. */
export const FORME_DUNE_ETIQUETTE = /^[a-z]+-[a-z]+-[0-9]{2}$/

/**
 * Tire une étiquette au sort.
 *
 * `hasard` rend un nombre dans `[0, 1[`, comme `Math.random` : le passer permet
 * de tirer la même étiquette deux fois dans un test, et n'a pas d'autre usage.
 */
export function tirerUneEtiquette(hasard: () => number = Math.random): string {
  const dans = <T,>(liste: readonly T[]): T => liste[Math.floor(hasard() * liste.length)] as T
  const nombre = PREMIER_NOMBRE + Math.floor(hasard() * (DERNIER_NOMBRE - PREMIER_NOMBRE + 1))

  return `${dans(NOMS)}-${dans(ADJECTIFS)}-${nombre}`
}

/** Ce que le vocabulaire permet de nommer. Sert à mesurer, pas à décider. */
export function combienDEtiquettes(): number {
  return NOMS.length * ADJECTIFS.length * (DERNIER_NOMBRE - PREMIER_NOMBRE + 1)
}

/** Les deux listes, pour le test qui garde leurs propriétés. */
export const VOCABULAIRE = { noms: NOMS, adjectifs: ADJECTIFS } as const
