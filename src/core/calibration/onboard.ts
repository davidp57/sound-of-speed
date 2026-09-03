import { analyzeStep, type StepAnalysis } from './analyze'
import { CALIBRATION_STEPS, type CalibrationStepId } from './protocol'
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

/** Ce que l'étalonnage remplace dans un profil, et pourquoi. */
export interface Override {
  path: SettingPath
  label: string
  value: number | number[]
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
 * Ce que la mesure impose, pour ce profil.
 *
 * Dépend du profil parce que certaines valeurs s'y convertissent : les seuils de
 * passage sont mesurés en kilomètres-heure et rangés en tours par minute, ce qui
 * emploie le pont et les démultiplications — des choix faits, pas des mesures.
 */
export function overridesFor(profile: Profile, analyses: StepAnalysis[]): Override[] {
  if (analyses.length === 0) return []
  const overrides: Override[] = []
  for (const suggestion of suggest(analyses, profile)) {
    const setting = suggestion.setting
    if (!setting) continue
    overrides.push({ path: setting.path, label: setting.label, value: setting.write })
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
