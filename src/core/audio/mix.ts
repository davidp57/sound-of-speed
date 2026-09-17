import type { LayerPreset, MixPreset, Profile } from '../preset/schema'
import type { EngineState } from '../engine/engine'

/**
 * Calcul du mixage des couches.
 *
 * Fonction pure, sans Web Audio : elle dit seulement, pour un régime et une
 * charge donnés, quel gain et quelle vitesse de lecture chaque couche doit
 * recevoir. Le moteur audio se contentera d'appliquer ces valeurs, et l'écran de
 * télémétrie les affiche telles quelles — on voit donc le mixage se calculer
 * avant même qu'un son soit branché, ce qui rend le réglage vérifiable à l'œil.
 *
 * Le **volume général** n'est pas ici : c'est un niveau de sortie, appliqué sur
 * le bus du graphe audio, et non une règle de mixage. Les gains rendus décrivent
 * donc l'équilibre entre les couches, que le volume ne déplace pas.
 *
 * Deux fondus se composent :
 *
 * - en régime, entre les couches d'un même rôle, à puissance constante ;
 * - en charge, entre les rôles « en charge » et « pied levé ».
 *
 * Le fondu à puissance constante (sinus et cosinus plutôt qu'une rampe linéaire)
 * maintient l'énergie perçue stable au milieu du passage. Avec une rampe
 * linéaire, deux sources décorrélées produisent un creux audible à mi-course.
 *
 * Les vitesses de lecture suivent le régime **entendu** — celui qui porte le
 * tremblement — et sont désaccordées d'une couche à l'autre. Les deux écarts se
 * calculent ici, donc se vérifient sans sortir un son, et aucun des deux ne
 * touche aux gains : le domaine jouable se décide sur la hauteur que demande le
 * régime, avant désaccord.
 */

export interface LayerMix {
  key: string
  file: string
  role: LayerPreset['role']
  /** Gain final, avant le gain général. */
  gain: number
  /** Facteur de lecture, déjà borné aux limites de la couche. */
  rate: number
  /**
   * Vrai si `rate` a été borné alors que la couche est réellement audible :
   * l'échantillon est étiré au-delà de sa plage utile et cela s'entend. Une
   * couche bornée mais à gain nul n'est pas signalée — sinon tout le tableau
   * clignoterait en permanence et le signal utile se perdrait.
   */
  rateClamped: boolean
}

export interface MixResult {
  layers: LayerMix[]
  /** Poids de la famille « en charge », de 0 à 1. */
  onWeight: number
  /** Poids de la famille « pied levé ». */
  offWeight: number
  idleWeight: number
  limiterWeight: number
}

/** En deçà, une couche ne contribue pas assez pour qu'un défaut s'entende. */
const AUDIBLE_GAIN = 0.02

/**
 * Écart de hauteur, en octaves, au-delà duquel une couche est réduite au silence.
 *
 * Une couche dont la vitesse de lecture a été bornée ne joue plus à la hauteur
 * du régime : elle tient une note fixe pendant que les autres montent. À
 * l'oreille, cela s'entend comme un second moteur tournant en parallèle, à
 * régime constant. Plutôt que de la laisser mentir, on l'efface à mesure qu'elle
 * s'écarte — une demi-octave suffit à la rendre franchement fausse.
 */
const PITCH_TOLERANCE_OCTAVES = 0.5

/** Convertit un écart en décibels en facteur de gain. */
function fromDb(db: number): number {
  return Math.pow(10, db / 20)
}

/**
 * Facteur appliqué à l'effort pendant un passage de rapport.
 *
 * Même forme que le creux de niveau — un sinus, nul aux deux bouts, maximal au
 * milieu — pour que la coupure et le creux se produisent au même moment plutôt
 * que de se décaler. Vaut un hors passage, et à la fin exacte du passage : le
 * couple est alors revenu, et le timbre de pleine charge avec lui.
 */
export function shiftCut(profile: Profile, shift?: { isShifting: boolean; progress: number }): number {
  const jolt = profile.feel.shiftJolt
  if (!jolt.enabled || !shift?.isShifting) return 1
  const depth = clamp(jolt.cutDepth, 0, 1)
  return 1 - depth * Math.sin(clamp(shift.progress, 0, 1) * Math.PI)
}

/**
 * Amplitude du clac mécanique, selon le sens du passage.
 *
 * Deux réglages pour deux sens, et l'ordre compte : `clack` porte les deux, et
 * `clackDownshift` n'est qu'un facteur repris par-dessus en descente. Qui
 * baisse `clack` en croyant ne toucher qu'à la montée baisse les deux — c'est
 * précisément le piège du 11 septembre 2026, quand David a demandé trente pour
 * cent de moins à la montée « et au rétrogradage c'est bien comme ça ».
 *
 * La règle vit ici plutôt que dans l'assemblage, pour qu'elle se vérifie sans
 * sortir un son.
 */
export function clackAmplitude(profile: Profile, downshift: boolean): number {
  const jolt = profile.feel.shiftJolt
  return jolt.clack * (downshift ? jolt.clackDownshift : 1)
}

export function computeMix(
  profile: Profile,
  state: EngineState,
  shift?: { isShifting: boolean; progress: number },
  running = true,
): MixResult {
  const { mix } = profile
  const enabled = profile.layers.filter((layer) => layer.enabled)

  // Au repos, aucune couche ne sonne.
  //
  // La règle est ici parce que c'est le seul point par lequel toutes les voies
  // passent. Le défaut du 16 septembre 2026 était ailleurs — changer de profil
  // en « P » rebranchait l'horloge du fil audio, et le ralenti repartait —, mais
  // le corriger là-bas seul ne tient que le chemin qu'on connaît. David a donné
  // une règle et non un cas : « on ne doit jamais allumer le son en mode P ».
  //
  // Un facteur plutôt qu'un retour anticipé : les couches gardent leur ordre et
  // leur hauteur, et seul le niveau tombe. Le moteur audio applique des valeurs,
  // il ne démonte pas son graphe — lui rendre une liste vide lui ferait perdre
  // les vitesses de lecture, et le son repartirait sur un saut de hauteur.
  const silence = running ? 1 : 0

  // Charge : fondu à puissance constante entre pied levé et pleine charge.
  //
  // Le contraste resserre l'écart autour du milieu : à un, le fondu va d'un
  // extrême à l'autre et le moteur s'éteint presque en roue libre ; plus bas, les
  // deux familles se mélangent en permanence. Le gain propre aux couches pied
  // levé compense ensuite leur enregistrement plus doux.
  const contrast = clamp(mix.loadContrast, 0, 1)
  // L'effort, et non la charge : c'est le travail du moteur qui décide du
  // timbre, et tenir 130 km/h en demande plus que tenir 30. La charge, elle,
  // reste à la boîte.
  //
  // La coupure de couple d'un passage se retire ici, et nulle part ailleurs :
  // c'est l'effort **entendu**. Le régime, la boîte et la télémétrie continuent
  // de voir l'effort vrai — la voiture, elle, ne coupe rien.
  const effort = shiftCut(profile, shift) * clamp(state.effort, 0, 1)
  const load = clamp(0.5 + (effort - 0.5) * contrast, 0, 1)
  const onWeight = Math.sin((load * Math.PI) / 2)
  const offWeight = Math.cos((load * Math.PI) / 2) * Math.max(0, mix.offLoadGain)

  // Le ralenti s'efface dès que le moteur est entraîné par les roues.
  const idleWeight = state.idling
    ? 1 - smoothstep(profile.engine.idleRpm, mix.idleFadeOutRpm, state.rpm)
    : 0

  const limiterWeight = state.limiterActive ? 1 : 0

  // Relief.
  //
  // Les deux fondus sont à puissance constante — c'est ce qui évite un creux au
  // milieu d'une bascule — mais cela veut dire qu'ils changent le timbre et
  // jamais le volume. Mesuré sur le profil Route avant ce réglage : ralenti,
  // croisière, reprise douce et reprise franche tenaient dans 1,3 dB, et lever
  // le pied était même 2,3 dB **plus fort** qu'écraser. L'effort ne s'entendait
  // pas.
  //
  // Ces trois facteurs s'appliquent donc après les fondus, à toutes les couches
  // à la fois : ils déplacent le niveau d'ensemble sans toucher à l'équilibre
  // entre les couches, donc sans rouvrir le creux que les fondus évitent.
  // Le relief suit la charge **brute**, et non celle que le contraste a
  // resserrée : le contraste règle l'équilibre entre les deux familles, le
  // relief règle le niveau d'ensemble. Les coupler ferait qu'un contraste nul
  // désactiverait le relief en silence, ce qui rendrait les deux curseurs
  // impossibles à régler l'un après l'autre.
  // L'effort **vrai**, et non celui que la coupure abaisse : sans quoi un
  // passage cumulerait deux baisses de niveau — le creux de l'à-coup et la
  // perte de relief — et deviendrait un trou. La coupure change le timbre, le
  // creux change le niveau ; un réglage pour chacun.
  const loadRelief = fromDb((clamp(state.effort, 0, 1) - 0.5) * 2 * mix.loadReliefDb)
  const span = Math.max(1, profile.engine.redlineRpm - profile.engine.idleRpm)
  const rpmShare = clamp((state.rpm - profile.engine.idleRpm) / span, 0, 1)
  const rpmRelief = fromDb(rpmShare * mix.rpmReliefDb)
  const idleTrim = state.idling ? fromDb(mix.idleLevelDb) : 1
  const relief = loadRelief * rpmRelief * idleTrim

  // À-coup de passage : le couple est coupé, donc le son se creuse puis revient.
  // Une boîte parfaitement lisse ne s'entend pas comme une boîte.
  const jolt =
    profile.feel.shiftJolt.enabled && shift?.isShifting
      ? 1 - profile.feel.shiftJolt.depth * Math.sin(clamp(shift.progress, 0, 1) * Math.PI)
      : 1

  const layers: LayerMix[] = []
  for (const role of ['on', 'off', 'idle', 'limiter'] as const) {
    const family = enabled
      .filter((layer) => layer.role === role)
      .sort((a, b) => a.anchorRpm - b.anchorRpm)
    if (family.length === 0) continue

    const familyWeight =
      role === 'on'
        ? onWeight
        : role === 'off'
          ? offWeight
          : role === 'idle'
            ? idleWeight
            : limiterWeight

    const blend = blendWeights(family, state.rpm, mix)

    family.forEach((layer, index) => {
      // Le régime **entendu**, qui porte le tremblement, et non le régime net :
      // c'est ici, et nulle part ailleurs, que le tremblement entre.
      const raw = state.audibleRpm / Math.max(1, layer.anchorRpm)
      const wanted = clamp(raw, layer.minRate, layer.maxRate)
      // Le désaccord vient après la décision de domaine, et se borne aux mêmes
      // limites : il ne peut donc ni sortir une couche de son domaine jouable ni
      // déplacer le gain que celui-ci commande.
      const detuned = wanted * detune(family.length, index, mix.layerDetuneCents)
      const rate = clamp(detuned, layer.minRate, layer.maxRate)
      const gain =
        silence *
        (blend[index] ?? 0) *
        familyWeight *
        layer.gain *
        relief *
        fidelity(raw, wanted) *
        (role === 'limiter' ? 1 : jolt)
      layers.push({
        key: layer.key,
        file: layer.file,
        role,
        gain,
        rate,
        rateClamped: Math.abs(wanted - raw) > 1e-6 && gain > AUDIBLE_GAIN,
      })
    })
  }

  return {
    layers,
    onWeight: silence * onWeight,
    offWeight: silence * offWeight,
    idleWeight: silence * idleWeight,
    limiterWeight: silence * limiterWeight,
  }
}

/**
 * Répartition du régime entre les couches d'un même rôle.
 *
 * Avec exactement deux couches — le cas courant : un enregistrement bas régime,
 * un haut régime — la bascule s'étale entre `crossfadeLowRpm` et
 * `crossfadeHighRpm`. Ces deux bornes sont indépendantes des régimes d'ancrage,
 * qui, eux, servent uniquement à calculer le repitch : on peut donc déplacer le
 * point de bascule à l'oreille sans toucher à la justesse.
 *
 * Au-delà de deux couches, on retombe sur les ancrages eux-mêmes, en fondant
 * entre les deux voisines qui encadrent le régime.
 */
function blendWeights(family: LayerPreset[], rpm: number, mix: MixPreset): number[] {
  if (family.length === 1) return [1]

  if (family.length === 2) {
    const low = Math.min(mix.crossfadeLowRpm, mix.crossfadeHighRpm)
    const high = Math.max(mix.crossfadeLowRpm, mix.crossfadeHighRpm)
    const t = high > low ? clamp((rpm - low) / (high - low), 0, 1) : rpm >= high ? 1 : 0
    return [Math.cos((t * Math.PI) / 2), Math.sin((t * Math.PI) / 2)]
  }

  const anchors = family.map((layer) => layer.anchorRpm)
  return anchors.map((anchor, index) => {
    const previous = anchors[index - 1]
    const next = anchors[index + 1]

    if (next !== undefined && rpm >= anchor && rpm < next) {
      const t = (rpm - anchor) / (next - anchor)
      return Math.cos((t * Math.PI) / 2)
    }
    if (previous !== undefined && rpm >= previous && rpm < anchor) {
      const t = (rpm - previous) / (anchor - previous)
      return Math.sin((t * Math.PI) / 2)
    }
    if (index === 0 && rpm < anchor) return 1
    if (index === anchors.length - 1 && rpm >= anchor) return 1
    return 0
  })
}

/**
 * Désaccord d'une couche, en facteur de vitesse de lecture.
 *
 * Réparti symétriquement dans la famille : avec deux couches, l'une descend de
 * la moitié de l'écart et l'autre monte d'autant. La hauteur moyenne de la
 * famille ne bouge donc pas — le désaccord élargit le son, il ne fausse pas la
 * justesse.
 *
 * Il ne dépend que du rang de la couche dans sa famille, jamais du temps : une
 * même situation donne toujours le même mixage, sans quoi l'écran de télémétrie
 * deviendrait illisible. Une famille d'une seule couche n'est pas désaccordée,
 * il n'y aurait personne avec qui battre.
 */
function detune(count: number, index: number, cents: number): number {
  if (count < 2 || cents === 0) return 1
  return Math.pow(2, (cents * (index / (count - 1) - 0.5)) / 1200)
}

/**
 * Facteur d'effacement d'une couche jouée à la mauvaise hauteur.
 *
 * Vaut un tant que la vitesse de lecture demandée est tenue, et décroît jusqu'à
 * zéro à mesure que le bornage l'en écarte.
 */
function fidelity(raw: number, rate: number): number {
  if (raw <= 0 || rate <= 0) return 0
  const octaves = Math.abs(Math.log2(rate / raw))
  return clamp(1 - octaves / PITCH_TOLERANCE_OCTAVES, 0, 1)
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge1 <= edge0) return x >= edge1 ? 1 : 0
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}
