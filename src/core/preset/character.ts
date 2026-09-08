import type { Profile } from './schema'

/**
 * Le caractère d'un profil, en deux nombres.
 *
 * Le guide de création sait déjà déduire une cinquantaine de réglages de quatre
 * réponses, mais ce savoir ne servait qu'une fois : passé la création, il ne
 * restait que la colonne de curseurs. Les lois écrites ici sont celles du guide,
 * sorties de lui pour être disponibles en continu — et, surtout, **inversibles**
 * : on peut relire dans un profil le tempérament qu'il porte, ce qui permet à un
 * curseur global de refléter ce qu'on a sous les doigts au lieu de partir d'une
 * position arbitraire.
 *
 * Deux nombres, et il faut les distinguer :
 *
 * - le **tempérament** (0 calme, 1 sportif) est le caractère du moteur et de la
 *   boîte : ce qui décide si la voiture pousse fort ;
 * - la **réactivité** (0 pépère, 1 nerveux) est celui du signal : ce qui décide
 *   si elle répond vite. Une voiture calme peut être vive, une sportive pâteuse.
 *
 * Aucun des deux n'est enregistré dans le profil : ils s'en déduisent. Un
 * réglage trouvé à la main reste donc la seule vérité, et un curseur global ne
 * peut pas mentir sur ce que le profil contient.
 */

/** Nombre de rapports admis par la boîte, bornes comprises. */
export const MIN_GEARS = 2
export const MAX_GEARS = 9

/**
 * Nombres de rapports proposés en mode simplifié.
 *
 * Plus étroit que ce que la boîte accepte : une boîte à deux rapports est une
 * curiosité, à neuf une exception. Les deux restent atteignables en posant la
 * liste des démultiplications à la main, en mode avancé.
 */
export const SIMPLE_GEAR_COUNTS = [3, 4, 5, 6, 7, 8]

/**
 * Interpolation entre trois points relevés — au plus calme, au milieu, au plus
 * sportif.
 *
 * Le guide donnait trois valeurs discrètes pour ses trois tempéraments. Deux
 * d'entre elles ne sont pas alignées ; les interpoler par morceaux les
 * conserve exactement, là où une droite les aurait déplacées.
 */
function between(low: number, mid: number, high: number, t: number): number {
  const x = clamp01(t)
  return x <= 0.5 ? low + (mid - low) * (x * 2) : mid + (high - mid) * ((x - 0.5) * 2)
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

function round1(value: number): number {
  return Number(value.toFixed(1))
}

function round2(value: number): number {
  return Number(value.toFixed(2))
}

/**
 * Arrondi des valeurs menées par un curseur global.
 *
 * Trois décimales, et non deux : c'est ce qui rend le geste **fidèle**. Un
 * curseur global écrit une dizaine de réglages, puis se relit dans ce qu'il a
 * écrit ; chaque arrondi rogne un peu cette relecture, et le curseur sautait
 * alors de quelques crans dès qu'on le relâchait. Mesuré sur toute la course :
 * l'écart entre la position posée et celle relue reste sous 0,009, soit moins
 * d'un cran sur cent.
 */
function round3(value: number): number {
  return Number(value.toFixed(3))
}

/**
 * Régimes de passage, un par passage, en tours par minute.
 *
 * Une rampe en fraction du rupteur, du premier passage au dernier : les
 * rapports courts passent tôt, les longs étirent davantage. Un seuil unique ne
 * peut pas faire les deux, c'est ce qui a motivé la table.
 */
export function upshiftTableFor(
  gearCount: number,
  redlineRpm: number,
  sportiness: number,
): number[] {
  const count = gearsIn(gearCount)
  const s = clamp01(sportiness)
  const from = 0.42 + 0.26 * s
  const to = 0.5 + 0.32 * s
  return Array.from({ length: Math.max(1, count - 1) }, (_, i) => {
    const t = count > 2 ? i / (count - 2) : 0
    return Math.round(redlineRpm * (from + (to - from) * t))
  })
}

/**
 * Temporisations avant montée, en secondes, une par rapport.
 *
 * Volontairement inégales : avec une valeur unique, la boîte sonne comme un
 * métronome. Leur longueur relève de la réactivité et non du tempérament — une
 * voiture calme peut passer ses rapports sans traîner — mais un tempérament vif
 * les raccourcit tout de même, parce qu'il ne laisse pas le temps de la
 * réflexion.
 */
export function shiftDelaysFor(
  gearCount: number,
  sportiness: number,
  responsiveness: number,
): number[] {
  const count = gearsIn(gearCount)
  const base = between(0.45, 0.32, 0.22, sportiness) * (1.5 - clamp01(responsiveness))
  return Array.from({ length: count }, (_, i) => round2(base * (i % 2 === 0 ? 1 : 1.7)))
}

/**
 * Démultiplications étagées entre un premier rapport court et un dernier long.
 *
 * Une progression géométrique donne des écarts de régime égaux d'un rapport au
 * suivant, ce qui est le propre d'une boîte bien étagée.
 */
export function gearRatiosFor(gearCount: number, first: number, last: number): number[] {
  const count = gearsIn(gearCount)
  // Un premier rapport qui ne serait pas plus court que le dernier ne décrit pas
  // une boîte : on reprend alors l'étagement du guide de création.
  const court = first > last && first > 0 && last > 0 ? first : 3.6
  const long = first > last && first > 0 && last > 0 ? last : 0.72
  return Array.from({ length: count }, (_, i) =>
    Number((court * (long / court) ** (i / (count - 1))).toFixed(3)),
  )
}

/**
 * Change le nombre de rapports d'un profil, boîte complète.
 *
 * Le premier et le dernier rapport sont **conservés**, et le pont avec eux : le
 * régime en dernier rapport à une vitesse donnée ne bouge donc pas, et c'est
 * exactement la contrainte qui a motivé le profil Route — le rapport le plus
 * long doit tourner à un régime tenable à la vitesse de croisière habituelle.
 * Seuls les rapports intermédiaires se redistribuent, avec les tables qui les
 * accompagnent.
 *
 * Le nombre de rapports était déjà modifiable par la liste des
 * démultiplications ; ce qui manquait était de le mettre à portée de main sans
 * avoir à écrire six nombres qui s'accordent.
 */
export function setGearCount(profile: Profile, gearCount: number): Profile {
  const count = gearsIn(gearCount)
  const actuels = profile.drivetrain.gearRatios
  if (actuels.length === count) return profile

  const sportiness = sportinessOf(profile)
  const responsiveness = responsivenessOf(profile)
  return {
    ...profile,
    drivetrain: {
      ...profile.drivetrain,
      gearRatios: gearRatiosFor(count, actuels[0] ?? 3.6, actuels[actuels.length - 1] ?? 0.72),
      upshiftRpm: upshiftTableFor(count, profile.engine.redlineRpm, sportiness),
      shiftDelaysS: shiftDelaysFor(count, sportiness, responsiveness),
    },
  }
}

function gearsIn(gearCount: number): number {
  if (!Number.isFinite(gearCount)) return MIN_GEARS
  return Math.max(MIN_GEARS, Math.min(MAX_GEARS, Math.round(gearCount)))
}

/**
 * Les huit valeurs qui trahissent le tempérament d'un profil.
 *
 * Chacune est linéaire en tempérament, donc inversible exactement : la valeur
 * lue, rapportée à ce que la loi donnerait aux deux extrêmes, rend le
 * tempérament. On en garde huit et on prend la **médiane** plutôt que la
 * moyenne : les deux profils livrés ont été réglés à la main, et l'un ou l'autre
 * de leurs réglages sort de la loi sans que cela dise quoi que ce soit de leur
 * caractère d'ensemble. Une moyenne se laisse tirer par cet écart, une médiane
 * non.
 *
 * L'écart de charge n'en fait pas partie : c'est le seul des réglages menés par
 * le tempérament qui ne soit pas linéaire, donc le seul qui ne s'inverse pas
 * exactement.
 */
const SPORTINESS_READINGS: {
  value: (profile: Profile) => number
  law: (profile: Profile, sportiness: number) => number
}[] = [
  { value: (p) => p.engine.inertia, law: (_p, s) => 1.4 - 0.5 * s },
  {
    value: (p) => p.engine.freeRevRate / p.engine.redlineRpm,
    law: (_p, s) => 0.9 + 0.5 * s,
  },
  { value: (p) => p.drivetrain.shiftTimeMs, law: (_p, s) => 680 - 240 * s },
  {
    // Comparé à la rampe qu'aurait une table de **même longueur** : la table
    // enregistrée peut être plus courte que la boîte, et c'est justement le
    // défaut que ce lot corrige. Comparer sa moyenne à celle d'une rampe d'une
    // autre longueur ferait lire un tempérament qui n'est pas là.
    value: (p) => mean(p.drivetrain.upshiftRpm) / p.engine.redlineRpm,
    law: (p, s) =>
      mean(upshiftTableFor(p.drivetrain.upshiftRpm.length + 1, p.engine.redlineRpm, s)) /
      p.engine.redlineRpm,
  },
  { value: (p) => p.drivetrain.cruiseUpshiftAfterS, law: (_p, s) => 2 + 1.6 * s },
  { value: (p) => p.drivetrain.brakeDownshiftAccelMs2, law: (_p, s) => -1.1 + 0.5 * s },
  { value: (p) => p.feel.kickdown.targetRpmFraction, law: (_p, s) => 0.5 + 0.15 * s },
  { value: (p) => p.feel.shiftJolt.depth, law: (_p, s) => 0.05 + 0.2 * s },
]

/**
 * Les trois valeurs qui trahissent la réactivité d'un profil.
 *
 * Le milieu du curseur est, par construction, le réglage des profils livrés :
 * c'est celui qui a servi jusqu'ici, il n'y a pas de raison de le déplacer en
 * passant par le mode simplifié.
 */
const RESPONSIVENESS_READINGS: {
  value: (profile: Profile) => number
  law: (responsiveness: number) => number
}[] = [
  { value: (p) => p.speed.springOmega, law: (r) => 6 + 16 * r },
  { value: (p) => p.speed.accelWindowMs, law: (r) => 1600 - 1200 * r },
  { value: (p) => p.mix.loadSmoothingS, law: (r) => 0.3 - 0.24 * r },
]

function mean(values: number[]): number {
  if (values.length === 0) return Number.NaN
  return values.reduce((total, value) => total + value, 0) / values.length
}

/**
 * Médiane des lectures exploitables.
 *
 * Une lecture peut ne rien valoir — une table vide, un rupteur absurde dans un
 * profil importé — et il vaut mieux l'écarter que la compter pour zéro : elle
 * tirerait la médiane vers le calme sans qu'aucun réglage ne le dise.
 */
function median(values: number[]): number {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b)
  if (sorted.length === 0) return 0.5
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[middle] ?? 0
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
}

/** Position d'une valeur entre ce que la loi donne aux deux extrêmes. */
function invert(value: number, atCalm: number, atSporty: number): number {
  const span = atSporty - atCalm
  if (!Number.isFinite(value) || !Number.isFinite(span)) return Number.NaN
  if (Math.abs(span) < 1e-9) return Number.NaN
  return clamp01((value - atCalm) / span)
}

/** Tempérament que porte ce profil, de 0 (calme) à 1 (sportif). */
export function sportinessOf(profile: Profile): number {
  return median(
    SPORTINESS_READINGS.map((reading) =>
      invert(reading.value(profile), reading.law(profile, 0), reading.law(profile, 1)),
    ),
  )
}

/** Réactivité que porte ce profil, de 0 (pépère) à 1 (nerveux). */
export function responsivenessOf(profile: Profile): number {
  return median(
    RESPONSIVENESS_READINGS.map((reading) =>
      invert(reading.value(profile), reading.law(0), reading.law(1)),
    ),
  )
}

/**
 * Refait le caractère du moteur et de la boîte, du calme au sportif.
 *
 * Onze réglages d'un coup : inertie, montée à vide, temps de passage, écart de
 * charge, régimes de passage, plancher et délai de croisière, seuil de
 * rétrogradage au freinage, rétrogradage forcé, pétarade, à-coup de passage.
 * C'est bien un **écrasement** : un curseur global recalcule, il ne peut pas
 * faire autrement. Le geste est rendu sans risque par un état de retour pris
 * juste avant, à la manière de celui du lot ORIGINE. Un décalage relatif aurait
 * préservé le réglage fin, mais « calme » n'aurait plus rien voulu dire : deux
 * profils au même curseur n'auraient pas sonné pareil.
 *
 * Ce qui n'est pas touché : le pont, les démultiplications, le rupteur, le
 * ralenti, le mixage, le signal de vitesse. Ce sont la mécanique et la
 * réactivité, pas le tempérament.
 *
 * Deux interrupteurs restent à la main : le rétrogradage forcé et l'à-coup de
 * passage. Le guide de création ne les a jamais coupés, et couper ce que
 * quelqu'un a activé exprès n'est pas un caractère, c'est une perte. La
 * pétarade, elle, s'éteint au plus calme : c'est la règle du guide, et une
 * voiture tranquille ne claque pas à l'échappement.
 */
export function applySportiness(profile: Profile, sportiness: number): Profile {
  const s = clamp01(sportiness)
  const { redlineRpm, idleRpm } = profile.engine
  const count = profile.drivetrain.gearRatios.length
  const responsiveness = responsivenessOf(profile)

  return {
    ...profile,
    engine: {
      ...profile.engine,
      inertia: round3(1.4 - 0.5 * s),
      freeRevRate: Math.round(redlineRpm * (0.9 + 0.5 * s)),
    },
    drivetrain: {
      ...profile.drivetrain,
      // La loi va de 680 à 440 ms et non plus de 140 à 80 : un passage doit
      // durer assez pour que sa séquence — chute, coup de gaz, clac, reprise —
      // s'entende, et David la mesure à « au moins 500 ms, voire plus » sur la
      // vidéo qui sert de référence. Les bornes bougent du même rapport, si
      // bien que le caractère relu d'un profil livré ne change pas.
      shiftTimeMs: Math.round(680 - 240 * s),
      upshiftRpm: upshiftTableFor(count, redlineRpm, s),
      upshiftLoadSpreadRpm: Math.round(redlineRpm * between(0.2, 0.28, 0.34, s)),
      // Le plancher garde une marge au-dessus du ralenti : sur un diesel, la
      // fraction du rupteur seule tomberait trop près du régime de ralenti.
      cruiseMinRpm: Math.round(Math.max(idleRpm * 1.4, redlineRpm * (0.2 + 0.1 * s))),
      cruiseUpshiftAfterS: round2(2 + 1.6 * s),
      brakeDownshiftAccelMs2: round3(-1.1 + 0.5 * s),
      shiftDelaysS: shiftDelaysFor(count, s, responsiveness),
    },
    feel: {
      ...profile.feel,
      kickdown: {
        ...profile.feel.kickdown,
        targetRpmFraction: round3(0.5 + 0.15 * s),
        maxGears: s >= 0.75 ? 3 : 2,
      },
      backfire: {
        ...profile.feel.backfire,
        enabled: s > 0.1,
        minRpm: Math.round(redlineRpm * 0.5),
        intensity: round3(0.2 + 0.35 * s),
        count: s >= 0.75 ? 5 : 3,
      },
      shiftJolt: {
        ...profile.feel.shiftJolt,
        // La loi va de 0,05 à 0,25 et non plus de 0,25 à 0,65 : le creux de
        // niveau masquait la bascule de timbre qu'il devait souligner. Les
        // deux bornes ont été divisées par le même facteur, si bien que le
        // caractère relu d'un profil livré ne bouge pas.
        depth: round3(0.05 + 0.2 * s),
        // Une boîte de caractère coupe plus franchement et claque plus fort.
        // Sans cela, le curseur creuserait le niveau sans changer le timbre, et
        // le passage deviendrait un trou au lieu d'un événement.
        cutDepth: round3(0.6 + 0.35 * s),
        crackle: round3(0.25 + 0.5 * s),
        dipRpm: Math.round(250 + 400 * s),
        blipRpm: Math.round(300 + 500 * s),
        clack: round3(0.35 + 0.35 * s),
        clackDownshift: round3(0.5 + 0.15 * s),
      },
    },
  }
}

/**
 * Refait la réactivité du signal, du pépère au nerveux.
 *
 * Quatre réglages : la raideur du lissage, la fenêtre d'accélération, le lissage
 * de la charge et les temporisations de passage. Le compromis est celui du
 * conditionnement du signal, et il n'est pas supprimable — nerveux suit au plus
 * près et laisse passer le bruit du GPS, pépère est lisse et en retard.
 *
 * Les bornes sont mesurées, sur une rampe de 0 à 90 km/h en quinze secondes avec
 * un bruit de mesure de ±1 km/h :
 *
 * - au plus **nerveux** (raideur 22), la vitesse conditionnée bouge de 0,675
 *   km/h par image au plus à la cadence d'un hertz, et le retard tombe à 369 ms.
 *   Elle reste continue : le ressort est amorti critique, il ne produit pas de
 *   marche ;
 * - au plus **pépère** (raideur 6), la marche descend à 0,242 km/h par image et
 *   le retard monte à 556 ms — une demi-seconde, tenable en conduite ;
 * - au **milieu** (raideur 14), on retrouve exactement le réglage des profils
 *   livrés : 0,433 km/h par image et 409 ms. C'est celui qui a servi jusqu'ici,
 *   il n'y a pas de raison que passer par le mode simplifié le déplace.
 *
 * La fenêtre d'accélération suit la même logique : à la cadence de 250 ms, une
 * fenêtre de 400 ms laisse l'accélération lue trembler à 1,51 m/s² d'écart-type
 * contre 0,85 à 1600 ms. C'est le prix de la vivacité, et il se paie sur la
 * charge, donc sur le fondu entre les couches.
 *
 * Ce curseur ne touche pas au caractère du moteur ni à celui de la boîte : une
 * voiture calme peut être vive, une sportive pâteuse.
 */
export function applyResponsiveness(profile: Profile, responsiveness: number): Profile {
  const r = clamp01(responsiveness)
  return {
    ...profile,
    drivetrain: {
      ...profile.drivetrain,
      shiftDelaysS: shiftDelaysFor(
        profile.drivetrain.gearRatios.length,
        sportinessOf(profile),
        r,
      ),
    },
    speed: {
      ...profile.speed,
      springOmega: round1(6 + 16 * r),
      accelWindowMs: Math.round(1600 - 1200 * r),
    },
    mix: {
      ...profile.mix,
      loadSmoothingS: round3(0.3 - 0.24 * r),
    },
  }
}

/**
 * Redimensionne les tables qui suivent le nombre de rapports.
 *
 * Changer le nombre de rapports était déjà possible — le champ des
 * démultiplications accepte la liste et la réécrit — mais bancal : les régimes
 * de passage et les temporisations gardaient leur ancienne longueur. La boîte se
 * rabattait alors sur le dernier seuil connu et sur une temporisation de 0,8 s
 * étrangère au profil, si bien qu'un rapport ajouté héritait des réglages de son
 * prédécesseur.
 *
 * Les tables sont donc reconstruites depuis le caractère du profil lui-même, tel
 * qu'il se relit dans ses autres réglages : c'est ce que le guide de création
 * fait depuis le tempérament, appliqué à un profil déjà en place.
 *
 * Un profil dont les tables ont déjà la bonne longueur est rendu **tel quel** :
 * on ne redistribue pas des seuils que quelqu'un a placés à l'oreille.
 */
export function resizeGearTables(profile: Profile, gearCount: number): Profile {
  const count = gearsIn(gearCount)
  if (
    profile.drivetrain.upshiftRpm.length === Math.max(1, count - 1) &&
    profile.drivetrain.shiftDelaysS.length === count
  ) {
    return profile
  }
  return {
    ...profile,
    drivetrain: {
      ...profile.drivetrain,
      upshiftRpm: upshiftTableFor(count, profile.engine.redlineRpm, sportinessOf(profile)),
      shiftDelaysS: shiftDelaysFor(count, sportinessOf(profile), responsivenessOf(profile)),
    },
  }
}
