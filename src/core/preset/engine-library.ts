import { GM_LS_V8, SUBARU_EJ25 } from './defaults'
import type { EngineDefinition } from './schema'

/**
 * Les moteurs qu'on sait charger.
 *
 * Vingt-huit curseurs ne se règlent pas un par un : David l'a dit après avoir
 * essayé — « c'est vraiment difficile de trouver des réglages qui sont bien, ils
 * ont tous des effets les uns sur les autres et y'en a beaucoup ». Un moteur
 * n'est pas vingt-huit valeurs indépendantes, c'est un ensemble où elles
 * s'accordent. On en charge un entier, puis on affine deux ou trois choses.
 *
 * C'est aussi ce qu'il demandait au tout début du lot, en découvrant
 * engine-sim : « l'exemple que je t'ai trouvé propose de *charger un moteur* ».
 *
 * **Ce qui limite la liste**, ce n'est pas le nombre de définitions disponibles
 * — le dépôt d'engine-sim en contient vingt-cinq — mais les deux architectures
 * que `native/probe.cpp` sait construire : quatre cylindres en ligne, et V8 à
 * quatre-vingt-dix degrés à vilebrequin croisé. Un V12, un radial ou un V6 à
 * calage inégal demanderaient chacun leur constructeur.
 */
export interface LibraryEngine {
  id: string
  /** Ce qui s'affiche à l'écran. */
  label: string
  /** D'où vient la définition, pour qu'on puisse y retourner. */
  source: string
  /** Le rupteur du moteur d'origine, en tours par minute. */
  redlineRpm: number
  definition: EngineDefinition
}

export const ENGINE_LIBRARY: readonly LibraryEngine[] = [
  {
    id: 'gm-ls',
    label: 'GM LS — V8 5,7 L',
    source: 'assets/engines/atg-video-2/07_gm_ls.mr',
    redlineRpm: 6500,
    definition: GM_LS_V8,
  },
  {
    id: 'subaru-ej25',
    label: 'Subaru EJ25 — 4 cylindres',
    source: 'assets/engines/atg-video-1/06_subaru_ej25.mr',
    redlineRpm: 6500,
    definition: SUBARU_EJ25,
  },
]

export function libraryEngine(id: string): LibraryEngine | undefined {
  return ENGINE_LIBRARY.find((entry) => entry.id === id)
}
