import type { StepAnalysis } from './analyze'
import { SETTING_LABELS, readSetting, type SettingPath } from './settings'
import { DOWNSHIFT_SEPARATION_MS2, type CalibrationStepId } from './protocol'
import type { Profile } from '../preset/schema'

/**
 * Ce que l'étalonnage propose, face à ce qui est réglé.
 *
 * **Elle propose, elle n'applique pas.** C'est la règle déjà retenue pour
 * l'analyse d'échantillon, dont les candidats d'ancrage se départagent à
 * l'oreille : la mesure est plus sûre que le souvenir, elle n'est pas plus sûre
 * que le jugement. Une proposition se lit, se compare, et se recopie sur un
 * geste — un réglage à la fois.
 *
 * Ce qui n'a pas été mesuré est dit **non mesuré**, jamais estimé : une session
 * incomplète reste utile, un chiffre inventé ne l'est pas. Un freinage franc ne
 * se commande pas au milieu du trafic.
 */

export interface Suggestion {
  /** Clé stable, sert de clé de liste et de cible de recopie. */
  key: string
  label: string
  /** Ce que la mesure donne, dans l'unité où elle a été prise. */
  measured: { value: number; unit: string } | null
  /** Pourquoi il n'y a rien de mesuré. `null` quand la mesure est là. */
  missing: string | null
  /**
   * Réglage informé, quand la recopie est définie.
   *
   * `null` quand la mesure éclaire un réglage sans le déterminer — le cas de
   * tout ce qui demanderait de choisir un régime, une voiture électrique n'ayant
   * pas de rapports. La raison est alors dans `note`.
   */
  setting: {
    path: SettingPath
    label: string
    unit: string
    /** Nombre de décimales à afficher, et auquel la proposition est arrondie. */
    decimals: number
    current: number
    proposed: number
  } | null
  note: string | null
}

/**
 * Marge des bornes d'accélération.
 *
 * Les bornes servent à rejeter l'absurde, pas à écrêter le réel : trop serrées
 * elles amputent une décélération vraie, trop larges elles ne protègent de rien
 * — ±14 m/s² ne sont jamais atteints. Une fois et demie la plus forte valeur
 * relevée laisse la place d'un freinage plus appuyé que celui qu'on a enregistré.
 */
const BOUND_MARGIN = 1.5
/** Pas d'arrondi des bornes, en m/s². Une borne n'a pas besoin d'être fine. */
const BOUND_STEP_MS2 = 0.5

/** Rassemble les propositions d'une session, complète ou non. */
export function suggest(analyses: StepAnalysis[], profile: Profile): Suggestion[] {
  const byStep = new Map<CalibrationStepId, StepAnalysis>()
  for (const analysis of analyses) byStep.set(analysis.step, analysis)

  return [
    fullLoad(byStep.get('launch'), profile),
    brakeDownshift(byStep.get('coast'), byStep.get('brake'), profile),
    lowerBound(analyses, profile),
    upperBound(analyses, profile),
  ]
}

/**
 * Accélération à charge pleine, tirée de la reprise franche.
 *
 * C'est le réglage dont dépend toute la charge — donc le volume, le timbre et
 * les seuils de passage. Il vaut 2 m/s² sur le profil Route, choisi par le
 * calcul, là où une voiture électrique en fait bien davantage.
 */
function fullLoad(analysis: StepAnalysis | undefined, profile: Profile): Suggestion {
  const note =
    'Mesurée sur la reprise franche : c’est l’accélération à laquelle la charge est pleine.'
  const missing = whyMissing(analysis, 'l’accélération franche')
  if (missing !== null || !analysis) {
    return line('mix.fullLoadAccelMs2', profile, note, { missing: missing ?? '' })
  }

  const peak = analysis.measure.peakAccelMs2
  if (peak === null) {
    return line('mix.fullLoadAccelMs2', profile, note, {
      missing: 'Aucune accélération mesurable dans la trace.',
    })
  }
  return line('mix.fullLoadAccelMs2', profile, note, { value: peak, proposal: peak })
}

/**
 * La frontière entre lever le pied et freiner.
 *
 * C'est elle que la boîte utilise pour décider de rétrograder afin de ralentir.
 * Elle vaut −1 m/s² sur Route et −0,7 sur Sport, choisis pour que le
 * rétrogradage ne se déclenche pas sur un simple lever de pied — sans que
 * personne ait mesuré ce que valent l'un et l'autre dans cette voiture.
 *
 * Le seuil se place **au milieu** des deux mesures, et le milieu n'est pas un
 * choix par défaut : il est le point qui laisse la même marge contre les deux
 * erreurs possibles — rétrograder sur un simple lever de pied, et ne pas
 * rétrograder sur un vrai freinage. Le placer plus près de l'un revient à
 * décider laquelle des deux on préfère commettre, ce qu'aucune mesure ne dit.
 *
 * Et s'il n'y a pas de milieu
 * — les deux étapes rendant la même décélération — aucune valeur n'est proposée :
 * une électrique récupère au lever de pied, et il est parfaitement possible que
 * cette voiture-là ne fasse pas de différence. Le dire vaut mieux que d'inventer
 * une frontière.
 */
function brakeDownshift(
  coast: StepAnalysis | undefined,
  brake: StepAnalysis | undefined,
  profile: Profile,
): Suggestion {
  const path: SettingPath = 'drivetrain.brakeDownshiftAccelMs2'
  const generic =
    'La boîte descend un rapport au-dessous de ce seuil. Il se place entre le ' +
    'lever de pied et le freinage.'

  const missing =
    whyMissing(coast, 'la décélération pied levé') ?? whyMissing(brake, 'le freinage franc')
  if (missing !== null || !coast || !brake) {
    return line(path, profile, generic, { missing: missing ?? '' })
  }

  const lift = coast.measure.peakDecelMs2
  const stop = brake.measure.peakDecelMs2
  if (lift === null || stop === null) {
    return line(path, profile, generic, {
      missing: 'Une des deux traces ne porte aucune décélération mesurable.',
    })
  }

  const note =
    `Entre le lever de pied (${lift.toFixed(2)} m/s²) et le freinage ` +
    `(${stop.toFixed(2)} m/s²).`

  if (lift - stop < DOWNSHIFT_SEPARATION_MS2) {
    return line(path, profile, note, {
      missing:
        `Les deux étapes donnent la même décélération, à ` +
        `${Math.abs(lift - stop).toFixed(2)} m/s² près : soit le frein a servi ` +
        'pendant le lever de pied, soit la récupération de cette voiture suffit à ' +
        'elle seule. Il n’y a pas de frontière à placer entre les deux.',
    })
  }

  const middle = (lift + stop) / 2
  return line(path, profile, note, { value: middle, proposal: middle })
}

/**
 * Borne basse de l'accélération : la plus forte décélération relevée, avec marge.
 *
 * Toutes les étapes valides comptent, pas seulement le freinage : on freine
 * aussi en ville, parfois plus fort que sur la manœuvre commandée.
 */
function lowerBound(analyses: StepAnalysis[], profile: Profile): Suggestion {
  const note =
    'La plus forte décélération relevée sur toutes les étapes, plus la moitié en ' +
    'marge. Toute décélération au-delà est écrêtée.'
  const values = analyses
    .filter((analysis) => analysis.valid)
    .map((analysis) => analysis.measure.peakDecelMs2)
    .filter((value): value is number => value !== null)

  if (values.length === 0) {
    return line('speed.minAccelMs2', profile, note, {
      missing: 'Aucune étape valide : rien à borner.',
    })
  }

  const worst = Math.min(...values)
  return line('speed.minAccelMs2', profile, note, {
    value: worst,
    proposal: snap(worst * BOUND_MARGIN),
  })
}

/** Borne haute, symétrique : la plus forte accélération relevée, avec marge. */
function upperBound(analyses: StepAnalysis[], profile: Profile): Suggestion {
  const note =
    'La plus forte accélération relevée sur toutes les étapes, plus la moitié en ' +
    'marge. Toute accélération au-delà est écrêtée.'
  const values = analyses
    .filter((analysis) => analysis.valid)
    .map((analysis) => analysis.measure.peakAccelMs2)
    .filter((value): value is number => value !== null)

  if (values.length === 0) {
    return line('speed.maxAccelMs2', profile, note, {
      missing: 'Aucune étape valide : rien à borner.',
    })
  }

  const best = Math.max(...values)
  return line('speed.maxAccelMs2', profile, note, {
    value: best,
    proposal: snap(best * BOUND_MARGIN),
  })
}

type Outcome = { value: number; proposal: number } | { missing: string }

/**
 * Une ligne du récapitulatif.
 *
 * La valeur réglée est lue ici, à un seul endroit : c'est ce qui garantit que la
 * colonne « réglé » montre bien le profil actif et non une copie devenue vieille.
 */
function line(
  path: SettingPath,
  profile: Profile,
  note: string,
  outcome: Outcome,
): Suggestion {
  const { label, unit, decimals } = SETTING_LABELS[path]
  const current = asNumber(readSetting(profile, path))

  if ('missing' in outcome) {
    return { key: path, label, measured: null, missing: outcome.missing, setting: null, note }
  }

  return {
    key: path,
    label,
    measured: { value: outcome.value, unit },
    missing: null,
    setting: {
      path,
      label,
      unit,
      decimals,
      current,
      proposed: round(outcome.proposal, decimals),
    },
    note,
  }
}

/**
 * Pourquoi une étape ne rend rien : pas faite, ou refusée.
 *
 * Les deux se disent, et se distinguent. « Non mesuré » et « mesuré mais
 * refusé » ne demandent pas la même chose à qui lit : refaire l'étape, ou la
 * refaire *mieux*.
 */
function whyMissing(analysis: StepAnalysis | undefined, stepName: string): string | null {
  if (!analysis) return `Étape non enregistrée : ${stepName}.`
  if (!analysis.valid) return `Étape refusée — ${analysis.reason}`
  return null
}

function asNumber(value: number | number[]): number {
  return typeof value === 'number' ? value : (value[0] ?? 0)
}

/** Arrondi à un nombre de décimales, pour ne pas proposer douze chiffres. */
export function round(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

/** Arrondi au pas des bornes, vers l'extérieur : une borne ne doit pas serrer. */
function snap(value: number): number {
  const steps = Math.abs(value) / BOUND_STEP_MS2
  return Math.sign(value) * Math.ceil(steps) * BOUND_STEP_MS2
}
