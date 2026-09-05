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

/**
 * Chevrolet 454, gros bloc, came d'origine.
 *
 * Relevé dans `assets/engines/chevrolet/chev_truck_454.mr`, complété par les
 * nœuds de `es/part-library/parts/` qu'il appelle : `chevy_bbc_stock_intake`
 * pour l'admission, `chevy_bbc_peanut_port_head` pour la culasse,
 * `chevy_454_stock_camshaft` et ses deux profils de lobe pour les cames. Rien
 * n'est déduit : ce que le fichier ne déclare pas est allé se lire dans le nœud
 * qui porte la valeur par défaut, et le commentaire dit lequel.
 */
export const CHEVROLET_454: EngineDefinition = {
  cylinders: 8,
  bore: 4.25,
  // Le vilebrequin déclare `throw: 2.0 inch`, et la course vaut deux fois le
  // maneton — c'est la relation qu'applique aussi `probe.cpp`.
  stroke: 4,
  rodLength: 6.135,
  // Les cinq valeurs de culasse viennent de `chevy_bbc_peanut_port_head`
  // (es/part-library/parts/heads.mr) : le fichier du moteur ne les redonne pas.
  chamberVolume: 118,
  intakeRunnerVolume: 189,
  // 37,8 cm², soit 5,859 po².
  intakeRunnerArea: 5.859,
  // La culasse ne déclare ni volume ni section d'échappement : elles retombent
  // sur `cylinder_head_parameters` (es/objects/objects.mr), qui donne 300 cc et
  // un cercle de 0,85 pouce de rayon. 300 cc dépasse la borne haute du réglage,
  // fixée à 200 : la valeur y est ramenée, comme le ferait de toute façon
  // `clampEngineDefinition` au chargement.
  exhaustRunnerVolume: 200,
  // π × 0,85², soit 2,2698 po².
  exhaustRunnerArea: 2.2698,
  // Défaut de `chevy_bbc_camshaft_builder`, que la came d'origine ne change pas.
  lobeSeparation: 114,
  intakeLobeCenter: 108,
  exhaustLobeCenter: 113,
  // Les levées et les durées viennent des deux profils de lobe
  // `stock_454_*_lobe_profile` (es/part-library/parts/cam_lobes.mr).
  intakeLift: 0.39,
  exhaustLift: 0.409,
  intakeDuration: 194,
  exhaustDuration: 202,
  // Défaut de `chevy_bbc_stock_intake`, que le fichier ne change pas.
  plenumVolume: 2,
  // `carburetor_cfm: 650.0`, que le nœud d'admission passe en `k_carb`.
  intakeFlowRate: 650,
  idleThrottlePlate: 0.991,
  primaryTubeLength: 10,
  primaryFlowRate: 100,
  outletFlowRate: 550,
  // Le fichier décrit son collecteur par une longueur — 100 pouces dans
  // `es_params`, puis 252 et 180 pouces sur les deux bancs — là où le contrat
  // ne porte qu'un volume. 100 litres est le défaut d'`exhaust_system_parameters`
  // et la valeur des deux définitions de référence ; le collecteur du 454
  // s'écarte donc du fichier, comme celui du GM LS.
  collectorVolume: 100,
  exhaustAudioVolume: 5.5,
  // Le fichier ne déclare pas de durée de coupure : c'est le défaut
  // d'`ignition_module` (es/objects/objects.mr).
  limiterDuration: 0.5,
  // Les deux bruits ne se lisent dans aucun `.mr` sous une forme utilisable :
  // ceux que les fichiers déclarent sont des valeurs de démonstration. On garde
  // celles que le projet a retenues à l'oreille, comme les deux références.
  airNoise: 0.15,
  inputSampleNoise: 0.05,
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
  {
    id: 'chevrolet-454',
    label: 'Chevrolet 454 — V8 gros bloc',
    source: 'assets/engines/chevrolet/chev_truck_454.mr',
    redlineRpm: 5500,
    definition: CHEVROLET_454,
  },
]

export function libraryEngine(id: string): LibraryEngine | undefined {
  return ENGINE_LIBRARY.find((entry) => entry.id === id)
}
