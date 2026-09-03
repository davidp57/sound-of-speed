import type { StepAnalysis } from './analyze'
import { SETTING_LABELS, readSetting, type SettingPath } from './settings'
import type { CalibrationStepId } from './protocol'
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

/** Rassemble les propositions d'une session, complète ou non. */
export function suggest(analyses: StepAnalysis[], profile: Profile): Suggestion[] {
  const byStep = new Map<CalibrationStepId, StepAnalysis>()
  for (const analysis of analyses) byStep.set(analysis.step, analysis)

  return [fullLoad(byStep.get('launch'), profile)]
}

/**
 * Accélération à charge pleine, tirée de la reprise franche.
 *
 * C'est le réglage dont dépend toute la charge — donc le volume, le timbre et
 * les seuils de passage. Il vaut 2 m/s² sur le profil Route, choisi par le
 * calcul, là où une voiture électrique en fait bien davantage.
 */
function fullLoad(analysis: StepAnalysis | undefined, profile: Profile): Suggestion {
  const path: SettingPath = 'mix.fullLoadAccelMs2'
  const { label, unit, decimals } = SETTING_LABELS[path]
  const current = asNumber(readSetting(profile, path))
  const base: Suggestion = {
    key: path,
    label,
    measured: null,
    missing: null,
    setting: null,
    note: 'Mesurée sur la reprise franche : c’est l’accélération à laquelle la charge est pleine.',
  }

  const missing = whyMissing(analysis, 'l’accélération franche')
  if (missing !== null || !analysis) return { ...base, missing }

  const peak = analysis.measure.peakAccelMs2
  if (peak === null) return { ...base, missing: 'Aucune accélération mesurable dans la trace.' }

  const proposed = round(peak, decimals)
  return {
    ...base,
    measured: { value: peak, unit },
    setting: { path, label, unit, decimals, current, proposed },
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
