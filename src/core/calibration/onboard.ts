import { analyzeStep, type StepAnalysis } from './analyze'
import { CALIBRATION_STEPS, findStep, type CalibrationStepId } from './protocol'
import { writeSetting, type SettingPath } from './settings'
import { suggest } from './suggest'
import type { CalibrationSession } from './store'
import type { Profile } from '../preset/schema'
import type { Trace } from '../speed/replay'

/**
 * L'étalonnage est une **couche**, pas une recopie.
 *
 * Un profil décrit un son : le caractère d'un moteur, sa boîte, son mixage.
 * L'étalonnage décrit une **voiture** : ce dont elle est capable — sa reprise,
 * son freinage, son ralentissement pied levé, les vitesses qu'on y pratique.
 * Ce sont deux choses distinctes, et la seconde ne s'écrit pas dans la première.
 *
 * D'où deux couches qui se composent :
 *
 * 1. le **profil**, ce qu'on règle et ce qu'on voit à l'écran de configuration ;
 * 2. l'**étalonnage**, facultatif, mesuré une fois sur la vraie voiture ;
 * 3. leur composition, qui donne les valeurs que le moteur emploie réellement.
 *
 * Ce que cette forme apporte, et qu'une recopie n'apportait pas :
 *
 * - **rien n'est écrasé.** Le profil reste ce qu'on a réglé ; on peut refaire ou
 *   retirer l'étalonnage sans avoir rien perdu ;
 * - **il vaut pour tous les profils à la fois**, ceux livrés comme ceux qu'on
 *   fabrique. Une mesure de la voiture n'a pas de raison de ne profiter qu'au
 *   profil ouvert le jour où on l'a prise ;
 * - **il ne voyage pas.** Un profil partagé emporte un son, pas les capacités de
 *   la voiture de celui qui l'a réglé — même raison que pour le volume général,
 *   qui a quitté le profil pour la même raison.
 *
 * L'analyse des traces est séparée de son application : elle est coûteuse et ne
 * dépend que des traces, quand l'application se refait à chaque réglage touché.
 */

/**
 * Ce que l'étalonnage remplace dans un profil, et pourquoi.
 *
 * La valeur réglée voyage avec la mesurée, et l'unité avec les deux : sans
 * elles, l'écran ne pouvait annoncer qu'un libellé. « Vitesse plausible
 * maximale » remplacée ne dit pas qu'on roule sous un plafond de 40 km/h.
 */
export interface Override {
  path: SettingPath
  label: string
  /** Ce qui s'écrit dans le profil. Pas toujours ce qui s'affiche : les seuils
   * de passage se mesurent en km/h et se rangent en tr/min. */
  value: number | number[]
  /** La mesure, dans l'unité annoncée. C'est elle qu'on montre. */
  proposed: number | number[]
  /** Ce que porte le profil réglé, dans la même unité, pour montrer l'écart. */
  current: number | number[]
  unit: string
  decimals: number
}

/**
 * Analyse les étapes enregistrées. Coûteux : à mémoriser sur les traces.
 *
 * Une étape dont la trace a été supprimée depuis est simplement absente : la
 * session ne garde qu'un horodatage, et l'on ne réinvente pas ce qui a disparu.
 */
export function analyzeSession(session: CalibrationSession, traces: Trace[]): StepAnalysis[] {
  const analyses: StepAnalysis[] = []
  for (const step of CALIBRATION_STEPS) {
    const startedAt = session[step.id as CalibrationStepId]
    if (startedAt === undefined) continue
    const trace = traces.find((candidate) => candidate.startedAt === startedAt)
    if (!trace) continue
    analyses.push(analyzeStep(step.id, trace))
  }
  return analyses
}

/**
 * Les étapes qu'il manque pour que l'étalonnage compte, dans l'ordre du
 * protocole. Une étape refusée compte comme manquante : elle n'a rien mesuré.
 */
export function missingSteps(analyses: StepAnalysis[]): CalibrationStepId[] {
  const measured = new Set(
    analyses.filter((analysis) => analysis.valid).map((analysis) => analysis.step),
  )
  return CALIBRATION_STEPS.map((step) => step.id).filter((id) => !measured.has(id))
}

/** Les libellés de ces étapes, pour le dire à l'écran. */
export function missingStepLabels(analyses: StepAnalysis[]): string[] {
  return missingSteps(analyses).map((id) => findStep(id)?.label ?? id)
}

/**
 * Ce que la mesure impose, pour ce profil.
 *
 * **Un étalonnage ne s'applique qu'entier.** Plusieurs des réglages écrits ici
 * sont des bornes déduites de ce que la voiture a fait pendant l'étalonnage : au
 * jeu complet elles décrivent la voiture, à une étape près elles décrivent le
 * bout de route qu'on a pris ce jour-là. Relevé en roulant le 4 septembre 2026 :
 * la seule étape de ville, enregistrée dans un bouchon à moins de 30 km/h,
 * portait la vitesse plausible maximale à 40 km/h. Au-delà, la source comme le
 * conditionnement rejettent chaque mesure comme aberrante — la vitesse, le
 * régime et le son se figent, et rien à l'écran n'en dit la cause. La même
 * mécanique guettait les deux bornes d'accélération, un étalonnage sans
 * freinage franc ayant déjà proposé une borne basse qui aurait écrêté tout
 * freinage réel.
 *
 * Les propositions, elles, restent affichées étape par étape : on peut toujours
 * en recopier une à la main. C'est l'application automatique et silencieuse qui
 * demande le jeu complet.
 *
 * Dépend du profil parce que certaines valeurs s'y convertissent : les seuils de
 * passage sont mesurés en kilomètres-heure et rangés en tours par minute, ce qui
 * emploie le pont et les démultiplications — des choix faits, pas des mesures.
 */
export function overridesFor(profile: Profile, analyses: StepAnalysis[]): Override[] {
  if (analyses.length === 0) return []
  if (missingSteps(analyses).length > 0) return []
  const overrides: Override[] = []
  for (const suggestion of suggest(analyses, profile)) {
    const setting = suggestion.setting
    if (!setting) continue
    overrides.push({
      path: setting.path,
      label: setting.label,
      value: setting.write,
      proposed: setting.proposed,
      current: setting.current,
      unit: setting.unit,
      decimals: setting.decimals,
    })
  }
  return overrides
}

/**
 * Le profil que le moteur emploie : le réglé, corrigé par le mesuré.
 *
 * Rendu tel quel quand il n'y a rien à corriger, ce qui évite de recopier un
 * profil entier soixante fois par seconde pour rien.
 */
export function withCalibration(profile: Profile, overrides: Override[]): Profile {
  if (overrides.length === 0) return profile
  let effectif = profile
  for (const override of overrides) {
    effectif = writeSetting(effectif, override.path, override.value)
  }
  return effectif
}
