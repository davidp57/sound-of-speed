/**
 * Les réglages du son synthétisé.
 *
 * Ce qui décrit le **moteur** vit dans le profil, où il voyage : c'est
 * `EngineDefinition`, les vingt-sept nombres du contrat. Ce qui reste ici est ce
 * qui décrit le **calcul et le poste** — la fréquence de simulation, la taille
 * de bloc, la réserve, la résonance de sortie —, et qui n'a aucune raison de
 * suivre un profil d'une machine à l'autre.
 *
 * Deux familles de réglages, et la distinction compte : certains s'appliquent
 * sans rien interrompre, les autres exigent de reconstruire le moteur simulé,
 * donc une coupure d'une seconde environ.
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

export interface SynthSettings {
  /** Fréquence de la simulation physique, en hertz. */
  simulationHz: number
  /**
   * Longueur de la réponse impulsionnelle calculée dans engine-sim.
   *
   * Zéro la supprime : la résonance d'échappement passe alors sur un
   * `ConvolverNode` de Web Audio, que le navigateur calcule en transformée de
   * Fourier partitionnée au lieu d'un produit direct. C'est le poste le plus
   * lourd de la chaîne — mesuré à la moitié du budget sur un poste de bureau.
   */
  impulseSamples: number
  /** Ouverture du papillon à effort nul, de 0 à 1. */
  throttleIdle: number
  /** Ouverture du papillon à plein effort, de 0 à 1. */
  throttleFull: number
  /** Volume appliqué dans le synthétiseur, de 0 à 6. */
  volume: number
  /** Taille d'un bloc rendu d'un coup, en échantillons. */
  blockFrames: number
  /** Réserve visée dans le lecteur, en millisecondes. */
  reserveMs: number
  /** Résonance d'échappement déportée sur un `ConvolverNode`. */
  convolver: boolean
  /** Longueur de cette résonance, en millisecondes. */
  convolverMs: number
  /** Part de son réverbéré dans la sortie, de 0 à 1. */
  convolverMix: number
  /**
   * D'où vient la résonance d'échappement.
   *
   * `tube` la fabrique — une suite d'échos, modèle simple et réglable. Les
   * autres sont des réponses **enregistrées sur de vrais échappements**, celles
   * qu'engine-sim livre et utilise : c'est ce qui porte la signature acoustique
   * complète — la géométrie du tube, le silencieux, la caisse, le lieu. Aucun
   * modèle synthétique ne la reproduit.
   *
   * `smooth_39` est celle du V8 Chevrolet 454 livré avec engine-sim.
   */
  exhaustResponse: ExhaustResponse
  /**
   * L'accord du tube d'échappement, en hertz.
   *
   * C'est l'inverse du temps que met l'onde à faire l'aller-retour. Un tube de
   * trois mètres accorde vers 57 Hz, un de deux vers 86. Plus haut, le son se
   * pince ; plus bas, il s'épaissit.
   */
  exhaustHz: number
  /**
   * Le silencieux : coupure du passe-bas de sortie, en hertz.
   *
   * Le modèle rend les impulsions d'échappement crues, et rien dans la chaîne
   * n'absorbait leur haut du spectre — la résonance est un bruit blanc, donc
   * plate. Mesuré au ralenti, la bande 4-16 kHz restait à 12 dB seulement sous
   * la bande 200-800 Hz, et cet écart **se resserre** quand on affine la
   * simulation : 15,2 dB à 6 kHz, 12,4 à 10, 9,9 à 20. L'aigu vient donc du
   * modèle, pas d'un artefact de calcul — il manquait le pot.
   *
   * Un échappement réel est un fort passe-bas. Au-delà de 20 kHz le filtre ne
   * fait plus rien : c'est la position « coupé ».
   */
  mufflerHz: number
  /**
   * Balayage de régime, du ralenti au rupteur et retour.
   *
   * C'est le seul moyen de juger « à régime tenu, puis en accélération » sans
   * conduire : le banc impose la montée, à cadence connue, et l'on écoute. Il
   * remplace le régime que la chaîne calcule tant qu'il est actif.
   */
  sweep: boolean
  /** Durée d'un aller-retour du balayage, en secondes. */
  sweepSeconds: number
  /**
   * Le niveleur d'engine-sim.
   *
   * Il vise une crête constante, ce qui donne un niveau utilisable quel que
   * soit le moteur — et efface l'effort au passage. Le couper laisse passer la
   * dynamique du modèle : c'est le réglage qui décide si l'effort s'entend.
   */
  leveler: boolean
  /** Gain fixe appliqué quand le niveleur est coupé. */
  levelerGain: number
  /**
   * La crête que vise le niveleur, sur l'échelle des entiers 16 bits.
   *
   * engine-sim vise 30 000 sur 32 767 — 92 % du plafond, 0,8 dB de marge. Or
   * `Synthesizer::renderAudio` borne la sortie à `INT16_MAX` : ce qui dépasse
   * n'est pas atténué, il est coupé au couteau. Et le niveleur monte
   * instantanément mais ne redescend qu'en 0,23 ms, donc le front d'une bouffée
   * passe toujours au gain d'avant.
   *
   * David l'a vu avant qu'on le mesure : « en déportée la GM a le niveau crête
   * maximisé (rouge) à 1.000 », et le son qu'il préférait était chaque fois
   * celui qui n'y touchait pas. Simulé sur un V8 au ralenti, un signal de
   * 50 000 de crête ressort écrêté à 17,5 % avec la cible d'origine, contre
   * 0,4 % à 12 000.
   *
   * Le volume perdu se rattrape dans Web Audio, en flottant, où il n'y a pas de
   * plafond dur.
   */
  levelerTarget: number
  /** Imposer l'effort plutôt que de suivre celui du moteur. */
  forceEffort: boolean
  /** L'effort imposé, de 0 à 1. */
  forcedEffort: number
  /**
   * La fermeté du dynamomètre, en livres-pied.
   *
   * Il tient le régime par une contrainte du solveur, résolue à chaque pas, et
   * son couple maximal vaut dix mille livres-pied à l'origine. À chaque
   * explosion il freine d'un coup, entre deux il entraîne. Le soupçon à
   * vérifier : ce va-et-vient injecterait du bruit large bande dans la
   * rotation, et la rotation module tout le son.
   *
   * Le baisser laisse le régime respirer entre les explosions, comme le fait un
   * volant d'inertie. Trop bas, le régime ne suit plus le cadran.
   */
  dynoTorque: number
}

export const DEFAULT_SYNTH: SynthSettings = {
  simulationHz: 10000,
  // Convolution déportée par défaut : c'est le seul réglage qui a fait passer
  // le V8 au-dessus du temps réel sur le poste de bureau.
  impulseSamples: 0,
  throttleIdle: 0.06,
  throttleFull: 1,
  /**
   * Zéro vingt-cinq, et c'est mesuré.
   *
   * Le niveleur d'engine-sim vise une crête de 30 000 sur 32 767, soit 0,92 —
   * mais son suiveur de crête décroît en vingt millisecondes, l'intervalle
   * entre deux allumages d'un V8 à 800 tr/min. Le gain remonte donc entre deux
   * bouffées et la suivante déborde. Relevé, régime tenu à 800 : la crête reste
   * collée à 1,000 jusqu'à un volume de 0,35, et tombe à 0,890 à 0,25. Le
   * facteur de crête vaut 28 — un moteur, c'est des impulsions.
   */
  volume: 0.25,
  blockFrames: 1024,
  // Cent vingt millisecondes, et non deux cent cinquante. La réserve absorbe les
  // pointes de calcul, mais elle se paie en retard entre le geste et le son :
  // David l'a vu au changement de rapport, « les tours retombent avant le son ».
  // Avec la réserve interne d'engine-sim par-dessus, on était à plus de trois
  // dixièmes de seconde.
  reserveMs: 120,
  convolver: true,
  // Cinquante millisecondes : la valeur trouvée à l'oreille. Deux cent vingt
  // étaient une salle, pas un échappement — à 800 tr/min un V8 explose toutes
  // les 19 ms, et douze explosions se superposaient dans la queue.
  convolverMs: 50,
  convolverMix: 1,
  // 3 500 Hz était mon estimation, calée sur le spectre moyen d'une prise réelle.
  // À l'écoute, David l'a descendu à 500 : le spectre moyen ne disait donc pas
  // tout, et c'est l'oreille qui tranche. On part de ce qu'elle a trouvé.
  // Coupé. Il avait été mis à 1 kHz pour masquer un parasite dont on a depuis
  // trouvé la cause : les deux bruits d'engine-sim. Une fois ceux-ci réglés, le
  // spectre décroît tout seul — mesuré à 47 dB entre 50 Hz et 4 kHz sur le quatre
  // cylindres, là où une prise réelle en montre 39. Filtrer davantage
  // n'enlèverait plus que du moteur.
  mufflerHz: 22000,
  // La réponse du V8 Chevrolet 454, telle qu'engine-sim la livre. Une captation
  // réelle plutôt qu'un modèle : c'est la différence entre un échappement et
  // l'idée qu'on s'en fait.
  exhaustResponse: 'smooth_39',
  // Trois mètres de tube, en gros. Ne sert qu'à la réponse fabriquée.
  exhaustHz: 57,
  leveler: true,
  levelerGain: 1,
  // Nettement sous les 30 000 d'engine-sim : c'est la marge qui manquait.
  levelerTarget: 12000,
  sweep: false,
  sweepSeconds: 12,
  forceEffort: false,
  forcedEffort: 0.5,
  dynoTorque: 10000,
}

function clamp(value: number, low: number, high: number): number {
  if (!Number.isFinite(value)) return low
  return value < low ? low : value > high ? high : value
}

/**
 * Ramène des réglages dans leur domaine.
 *
 * Les bornes ne sont pas décoratives : un bloc trop court fait plus d'appels
 * que de calcul, une fréquence de simulation trop basse fait rater des
 * allumages, et un papillon inversé rendrait l'effort silencieux.
 */
export function clampSynthSettings(settings: SynthSettings): SynthSettings {
  const idle = clamp(settings.throttleIdle, 0, 1)
  return {
    simulationHz: Math.round(clamp(settings.simulationHz, 4000, 24000)),
    impulseSamples: Math.round(clamp(settings.impulseSamples, 0, 10000)),
    throttleIdle: idle,
    throttleFull: clamp(settings.throttleFull, idle, 1),
    volume: clamp(settings.volume, 0, 6),
    blockFrames: Math.round(clamp(settings.blockFrames, 128, 8192)),
    reserveMs: Math.round(clamp(settings.reserveMs, 40, 1000)),
    convolver: settings.convolver,
    convolverMs: Math.round(clamp(settings.convolverMs, 10, 2000)),
    convolverMix: clamp(settings.convolverMix, 0, 1),
    exhaustHz: Math.round(clamp(settings.exhaustHz, 20, 400)),
    exhaustResponse: EXHAUST_RESPONSES.some((e) => e.id === settings.exhaustResponse)
      ? settings.exhaustResponse
      : 'smooth_39',
    dynoTorque: Math.round(clamp(settings.dynoTorque, 20, 10000)),
    mufflerHz: Math.round(clamp(settings.mufflerHz, 120, 22000)),
    leveler: settings.leveler,
    levelerGain: clamp(settings.levelerGain, 0.01, 4),
    levelerTarget: Math.round(clamp(settings.levelerTarget, 1000, 32000)),
    sweep: settings.sweep,
    sweepSeconds: clamp(settings.sweepSeconds, 2, 120),
    forceEffort: settings.forceEffort,
    forcedEffort: clamp(settings.forcedEffort, 0, 1),
  }
}

/**
 * Le changement demande-t-il de reconstruire le moteur simulé ?
 *
 * La fréquence de simulation et la longueur de la réponse impulsionnelle sont
 * figées à la construction, dans des tableaux dimensionnés une fois pour toutes.
 * Le reste — papillon, volume — s'écrit à chaud, et c'est ce qui rend le réglage
 * du timbre supportable : on l'entend changer sans coupure.
 *
 * La description du moteur, elle, ne passe plus par ici : elle vit dans le
 * profil, et c'est `needsEngineRebuild` qui répond la même question pour elle.
 */
export function needsRebuild(previous: SynthSettings, next: SynthSettings): boolean {
  return (
    previous.simulationHz !== next.simulationHz ||
    previous.impulseSamples !== next.impulseSamples ||
    previous.blockFrames !== next.blockFrames ||
    // Les deux bornes de gain du niveleur ne sont recopiées qu'une fois, dans
    // `Synthesizer::initialize` : les écrire à chaud ne fait rien, mesuré.
    previous.leveler !== next.leveler ||
    previous.levelerGain !== next.levelerGain ||
    // La cible, elle, est relue à chaque échantillon par `renderAudio` : elle
    // pourrait s'écrire à chaud. Elle passe quand même par la construction,
    // faute d'un point d'entrée qui l'écrive seule — et le rebâtissage reste
    // rare, c'est un réglage qu'on pose une fois.
    previous.levelerTarget !== next.levelerTarget
  )
}
