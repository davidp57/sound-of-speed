/**
 * Ce qui fait le **son** d'un moteur simulé, séparé de ce qui décrit le calcul.
 *
 * La distinction n'est pas cosmétique, elle vient d'un besoin de David : « en
 * voiture on peut choisir un profil de synthèse, avec le choix du moteur
 * (profil préréglé sur PC), le choix de l'échappement [...] et de l'endroit d'où
 * on écoute », et « on pourra choisir les autres profils moteur en voiture
 * aussi ? j'aimerais bien en tester plusieurs ».
 *
 * Essayer plusieurs moteurs au volant n'a de sens que si chacun arrive avec son
 * réglage. Un moteur écouté avec l'échappement et le volume du précédent sonne
 * mal, et l'on ne sait plus si c'est le moteur ou le réglage qu'on entend. Ces
 * valeurs voyagent donc **avec le moteur** : la bibliothèque en pose un jeu
 * d'usine, le profil en garde une copie modifiable — comme il garde déjà une
 * copie modifiable de la définition.
 *
 * Ce qui n'est **pas** ici, et pourquoi : la fréquence de simulation, la
 * longueur de la réponse impulsionnelle interne, la taille de bloc et la réserve
 * décrivent la machine qui calcule. La réserve en particulier est l'arbitrage
 * entre la latence et le risque de creux : les 60 ms que David tient sur son PC,
 * sans un seul creux mesuré, n'ont pas la même marge sur un téléphone. Embarquée
 * dans un moteur d'usine, elle ferait attribuer au moteur un trou qui vient de
 * l'appareil.
 */

/** Les réponses d'échappement disponibles. */
export const EXHAUST_RESPONSES = [
  { id: 'smooth_39', label: 'V8 Chevrolet 454', file: 'smooth_39.wav' },
  { id: 'mild_exhaust', label: 'Silencieux doux', file: 'mild_exhaust.wav' },
  { id: 'minimal_muffling_01', label: 'Silencieux minimal', file: 'minimal_muffling_01.wav' },
  { id: 'sharp_01', label: 'Sec', file: 'sharp_01.wav' },
  { id: 'tube', label: 'Tube fabriqué', file: null },
] as const

export type ExhaustResponse = (typeof EXHAUST_RESPONSES)[number]['id']

export function exhaustResponseFile(id: ExhaustResponse): string | null {
  return EXHAUST_RESPONSES.find((entry) => entry.id === id)?.file ?? null
}

/**
 * Les deux fréquences de silencieux qui font le point d'écoute : dedans,
 * dehors.
 *
 * Le silencieux est un passe-bas ; ouvert en grand, on entend la voiture de
 * l'extérieur, refermé bas on l'entend à travers la tôle et les vitres. C'est
 * David qui l'a remarqué en réglant à l'oreille — le réglage existait, le sens
 * lui manquait. Mille hertz pour l'habitacle : la valeur qu'il avait trouvée
 * lui-même.
 *
 * Elles vivent ici et non dans l'écran du banc parce que l'écran de conduite
 * les pose aussi, sans montrer de curseur.
 */
export const MUFFLER_INSIDE_HZ = 1000
export const MUFFLER_OUTSIDE_HZ = 22000

export interface SynthRendering {
  /** Ouverture du papillon à effort nul, de 0 à 1. */
  throttleIdle: number
  /** Ouverture du papillon à plein effort, de 0 à 1. */
  throttleFull: number
  /** Le niveleur d'engine-sim, qui vise une crête constante. */
  leveler: boolean
  /** Gain fixe appliqué quand le niveleur est coupé. */
  levelerGain: number
  /** La crête qu'il vise, sur l'échelle des entiers 16 bits. */
  levelerTarget: number
  /** Résonance d'échappement déportée sur un `ConvolverNode`. */
  convolver: boolean
  /** Longueur de cette résonance, en millisecondes. */
  convolverMs: number
  /** Part de son réverbéré dans la sortie, de 0 à 1. */
  convolverMix: number
  /** D'où vient la résonance d'échappement. */
  exhaustResponse: ExhaustResponse
  /** Accord du tube fabriqué, en hertz. Sans effet sur une captation réelle. */
  exhaustHz: number
  /**
   * Part de résonance d'échappement retirée à plein effort, de 0 à 1.
   *
   * David, le 8 septembre 2026 : « en décel, le son est plus clair, moins
   * sourd — comme si on enlevait un bouchon de l'échappement ou de mes
   * oreilles ». Il voulait la même chose en accélérant.
   *
   * Un plateau haut avait été essayé d'abord, et il a été jeté : « ton éclat en
   * charge ajoute justement une nouvelle fréquence parasite, c'est pas du tout
   * pareil ». Il avait raison, et la mesure dit pourquoi. La résonance
   * d'échappement n'éclaircit ni n'assombrit uniformément : elle empile **quinze
   * décibels sur la seule bande de 500 Hz**, et rien au-dessus de deux
   * kilohertz. C'est un bouchon, au sens propre. Ajouter de l'aigu par-dessus ne
   * l'enlève pas, cela pose une couleur de plus.
   *
   * Retirer de la résonance quand l'effort monte fait exactement ce qu'il
   * décrit. Mesuré à 2 500 tr/min, effort 0,6, en passant de 0,45 à 0,15 de
   * résonance : la bande de 500 Hz tombe de 67,2 à 62,5 dB, celle de 2 800
   * monte de 36,1 à 36,5 et celle de 4 000 de 25,7 à 27,3. Le grave recule,
   * l'aigu ressort, et aucune fréquence n'est ajoutée.
   *
   * Zéro laisse la résonance constante, comme avant.
   */
  loadOpeningRatio: number
  /** Coupure du silencieux, en hertz. C'est aussi le point d'écoute. */
  mufflerHz: number
}

/** Les clés du rendu, pour le découper d'un jeu de réglages complet. */
export const SYNTH_RENDERING_KEYS = [
  'throttleIdle',
  'throttleFull',
  'leveler',
  'levelerGain',
  'levelerTarget',
  'convolver',
  'convolverMs',
  'convolverMix',
  'exhaustResponse',
  'exhaustHz',
  'loadOpeningRatio',
  'mufflerHz',
] as const satisfies readonly (keyof SynthRendering)[]

/**
 * Un profil reçu par lien ou par fichier peut porter n'importe quoi : une
 * valeur non finie retombe sur la borne basse plutôt que de propager un NaN
 * jusque dans le graphe audio, où il fait taire la sortie sans rien dire.
 */
function clamp(value: number, low: number, high: number): number {
  if (!Number.isFinite(value)) return low
  return value < low ? low : value > high ? high : value
}

/** Ramène un rendu venu de l'extérieur dans ses bornes. */
export function clampSynthRendering(rendering: SynthRendering): SynthRendering {
  // Le plein papillon ne descend pas sous le ralenti : l'effort ne peut pas
  // fermer les gaz en montant.
  const idle = clamp(rendering.throttleIdle, 0, 1)
  return {
    throttleIdle: idle,
    throttleFull: clamp(rendering.throttleFull, idle, 1),
    leveler: rendering.leveler,
    levelerGain: clamp(rendering.levelerGain, 0.01, 4),
    levelerTarget: Math.round(clamp(rendering.levelerTarget, 1000, 32000)),
    convolver: rendering.convolver,
    convolverMs: Math.round(clamp(rendering.convolverMs, 10, 2000)),
    convolverMix: clamp(rendering.convolverMix, 0, 1),
    exhaustResponse: EXHAUST_RESPONSES.some((e) => e.id === rendering.exhaustResponse)
      ? rendering.exhaustResponse
      : 'smooth_39',
    exhaustHz: Math.round(clamp(rendering.exhaustHz, 20, 400)),
    loadOpeningRatio: clamp(rendering.loadOpeningRatio, 0, 1),
    mufflerHz: Math.round(clamp(rendering.mufflerHz, 120, 22000)),
  }
}

/** Découpe le rendu d'un jeu de réglages qui contient aussi le calcul. */
export function renderingOf(settings: SynthRendering): SynthRendering {
  return clampSynthRendering({
    throttleIdle: settings.throttleIdle,
    throttleFull: settings.throttleFull,
    leveler: settings.leveler,
    levelerGain: settings.levelerGain,
    levelerTarget: settings.levelerTarget,
    convolver: settings.convolver,
    convolverMs: settings.convolverMs,
    convolverMix: settings.convolverMix,
    exhaustResponse: settings.exhaustResponse,
    exhaustHz: settings.exhaustHz,
    loadOpeningRatio: settings.loadOpeningRatio,
    mufflerHz: settings.mufflerHz,
  })
}

/**
 * Le rendu par défaut : ce qu'un moteur sonne tant que personne ne l'a réglé.
 *
 * Ce sont les valeurs que le banc portait avant que le rendu devienne un
 * réglage de moteur, commentaires d'origine compris — elles ne sont pas un
 * choix neuf, elles sont ce qui existait.
 */
export const DEFAULT_RENDERING: SynthRendering = {
  throttleIdle: 0.06,
  throttleFull: 1,
  leveler: true,
  levelerGain: 1,
  // Neuf mille, et non douze. Douze suffisait au son sec, pas à ce qui sort :
  // mesuré sur le Chevrolet 454 au ralenti, la crête en fin de chaîne montait à
  // 1,19, que les deux décibels de marge ne rattrapaient pas tout à fait — David
  // entendait encore le parasite sur ce moteur-là quand il avait disparu du
  // GM LS. À neuf mille elle tombe à 1,01 avant marge, donc 0,80 après.
  levelerTarget: 9000,
  convolver: true,
  // Cinquante millisecondes : la valeur trouvée à l'oreille. Deux cent vingt
  // étaient une salle, pas un échappement — à 800 tr/min un V8 explose toutes
  // les 19 ms, et douze explosions se superposaient dans la queue.
  convolverMs: 50,
  // Quarante-cinq pour cent, et pour tous les moteurs : la valeur que David
  // tenait sur le GM LS depuis le 6 septembre 2026, étendue à la bibliothèque le
  // 8 à sa demande. À cent pour cent, tout le son passait par la réponse
  // d'échappement — celle d'un V8 Chevrolet, y compris sous un quatre cylindres.
  convolverMix: 0.45,
  // La réponse du V8 Chevrolet 454, telle qu'engine-sim la livre. Une captation
  // réelle plutôt qu'un modèle : c'est la différence entre un échappement et
  // l'idée qu'on s'en fait.
  exhaustResponse: 'smooth_39',
  // Trois mètres de tube, en gros. Ne sert qu'à la réponse fabriquée.
  exhaustHz: 57,
  // Six dixièmes de la résonance retirés à plein effort : de 0,45 à 0,18, ce
  // qui vaut cinq décibels de moins sur la bande de 500 Hz. Une estimation, à
  // juger à l'oreille ; zéro laisse la résonance constante.
  loadOpeningRatio: 0.6,
  // Coupé, c'est-à-dire dehors. Il avait été mis à 1 kHz pour masquer un
  // parasite dont on a depuis trouvé la cause : les deux bruits d'engine-sim.
  // Une fois ceux-ci réglés, le spectre décroît tout seul.
  mufflerHz: MUFFLER_OUTSIDE_HZ,
}
