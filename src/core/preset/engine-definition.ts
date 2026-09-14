/**
 * Ce qui passe du profil au moteur simulé.
 *
 * Un **tableau de doubles**, écrit dans la mémoire du module WebAssembly et lu
 * par le C++ dans l'ordre de `ENGINE_FIELDS`. Pas de JSON de l'autre côté : il
 * faudrait un analyseur, et l'ordre suffit.
 *
 * La source de vérité des paramètres, de leurs unités et de leurs valeurs de
 * référence est `native/CONTRAT-MOTEUR.md`.
 */

import { GM_LS_V8 } from './defaults'
import { ENGINE_FIELDS, type EngineDefinition, type EngineGroup } from './schema'

function clampValue(value: unknown, min: number, max: number, fallback: number): number {
  // Une valeur illisible ne retombe pas sur la borne basse mais sur celle du V8
  // de référence : un volume de chambre à trente centimètres cubes serait un
  // moteur de compétition, choisi par accident.
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return value < min ? min : value > max ? max : value
}

/**
 * Les trois architectures que `native/engines.h` sait bâtir.
 *
 * Ce ne sont pas des nombres de cylindres au sens d'un réglage : l'ordre
 * d'allumage et les angles de manetons **définissent** un moteur, et chacun a
 * son constructeur. Une valeur venue d'ailleurs — une main, une version
 * antérieure — se range donc sur la plus proche des trois, plutôt que de
 * construire un moteur qui n'existe pas.
 */
const ARCHITECTURES = [4, 6, 8] as const

function architectureLaPlusProche(cylindres: number): number {
  return ARCHITECTURES.reduce((meilleur, candidat) =>
    Math.abs(candidat - cylindres) < Math.abs(meilleur - cylindres) ? candidat : meilleur,
  )
}

/**
 * Ramène une définition dans son domaine, et la complète.
 *
 * Sert à deux endroits : la reprise d'un profil enregistré, dont la définition
 * peut venir d'une main ou d'une version antérieure, et la sérialisation, juste
 * avant que le tableau ne parte dans la mémoire du module.
 *
 * Le nombre de cylindres n'a que trois valeurs possibles : l'ordre d'allumage et
 * les angles de manetons sont écrits en dur dans `native/engines.h` pour un
 * quatre en ligne, un six en ligne et un V8 croisé. Toute autre valeur est
 * ramenée à la plus proche des trois.
 */
export function clampEngineDefinition(definition: Partial<EngineDefinition>): EngineDefinition {
  const out = {} as Record<string, number>
  for (const field of ENGINE_FIELDS) {
    if (field.fromProfile === true) continue
    const key = field.key as keyof EngineDefinition
    out[key] = clampValue(definition[key], field.min, field.max, GM_LS_V8[key])
  }
  out['cylinders'] = architectureLaPlusProche(definition.cylinders ?? GM_LS_V8.cylinders)
  return out as unknown as EngineDefinition
}

/**
 * La définition, en doubles, dans l'ordre du contrat.
 *
 * Le rupteur est le seul nombre qui ne vient pas de la définition : il occupe sa
 * place dans le tableau — sans quoi tout ce qui suit se décalerait — mais sa
 * valeur est celle du profil, `engine.redlineRpm`. Deux réglages pour un seul
 * chiffre finiraient par se contredire.
 */
export function engineDefinitionValues(
  definition: Partial<EngineDefinition>,
  redlineRpm: number,
): number[] {
  const sain = clampEngineDefinition(definition)
  return ENGINE_FIELDS.map((field) =>
    field.key === 'revLimit' ? redlineRpm : sain[field.key as keyof EngineDefinition],
  )
}

/**
 * Le changement demande-t-il de reconstruire le moteur simulé ?
 *
 * Presque tout est figé à la construction : les chambres, les conduits, les
 * cames et les tubes sont bâtis une fois, dans des tableaux dimensionnés pour de
 * bon. Seuls les deux bruits s'écrivent à chaud, et c'est ce qui rend leur
 * réglage supportable — on les entend bouger sans la coupure d'une seconde que
 * coûte un rebâtissage.
 */
export function needsEngineRebuild(
  previous: Partial<EngineDefinition>,
  next: Partial<EngineDefinition>,
): boolean {
  const avant = clampEngineDefinition(previous)
  const apres = clampEngineDefinition(next)
  return ENGINE_FIELDS.some((field) => {
    if (field.fromProfile === true || field.hot === true) return false
    const key = field.key as keyof EngineDefinition
    return avant[key] !== apres[key]
  })
}

/**
 * Prendre une section d'un moteur et la poser sur un autre.
 *
 * David : « avoir les boutons de choix de moteur dans chaque section (culasse,
 * échappement) pour essayer par exemple le moteur de la 454 avec l'échappement
 * de la GM ». Un moteur est un ensemble, mais ses sections se transplantent —
 * c'est même ce que font les préparateurs.
 *
 * Le rupteur ne suit pas : il vient du profil, et une section d'échappement
 * n'a pas d'avis sur le régime maximal.
 */
export function mergeEngineGroup(
  base: Partial<EngineDefinition>,
  source: Partial<EngineDefinition>,
  group: EngineGroup,
): EngineDefinition {
  const out = clampEngineDefinition(base)
  const sain = clampEngineDefinition(source)
  for (const field of ENGINE_FIELDS) {
    if (field.group !== group || field.fromProfile === true) continue
    const key = field.key as keyof EngineDefinition
    out[key] = sain[key]
  }
  return out
}

/**
 * Les moteurs se distinguent-ils sur cette section ?
 *
 * Les bruits sont jugés à l'oreille et portent la même valeur partout : y
 * proposer un choix de moteur ne donnerait que des boutons sans effet. Plutôt
 * que d'écrire la liste des sections à exclure, on la mesure.
 */
export function groupVaries(
  definitions: readonly Partial<EngineDefinition>[],
  group: EngineGroup,
): boolean {
  if (definitions.length < 2) return false
  const sains = definitions.map(clampEngineDefinition)
  return ENGINE_FIELDS.some((field) => {
    if (field.group !== group || field.fromProfile === true) return false
    const key = field.key as keyof EngineDefinition
    return sains.some((d) => d[key] !== sains[0]?.[key])
  })
}
