import type { DrivetrainPreset } from './schema'

/**
 * Reprise des boîtes livrées à six rapports.
 *
 * La sortie du 11 septembre 2026 a montré une boîte qui tourne trop haut en
 * croisière — 2 046 tr/min à 80 km/h en cinquième, 2 355 à 110 en sixième — et
 * des sauts qui s'écrasent en haut au lieu de s'étaler. David a demandé sept
 * rapports et un haut réétagé.
 *
 * Le changement doit atteindre **les boîtes déjà enregistrées**, sinon il ne se
 * verrait pas dans sa voiture : la sienne vit dans le stockage local du
 * téléphone, et modifier les valeurs du code ne l'aurait pas touchée.
 *
 * **Seule la boîte de route d'origine est reprise** — son étagement et son pont
 * tels qu'ils étaient livrés. Une boîte réglée à la main garde exactement ce
 * qu'on lui a donné : lui ajouter un rapport qu'on n'a pas demandé serait
 * décider à la place de celui qui l'a réglée. Pour en changer le nombre,
 * l'écran de configuration a déjà ce qu'il faut.
 */

/** L'étagement livré jusqu'au 11 septembre 2026, à six rapports. */
const SIX_GEARS = [3.55, 2.04, 1.36, 1.03, 0.86, 0.72]

/**
 * Le pont de la boîte de route, et ce qui la sépare de celle de sport.
 *
 * Les deux boîtes livrées portaient le **même** étagement ; seul le pont les
 * distinguait — 3,7 sur Route, 4,5 sur Sport. Sans cette condition, une boîte
 * de sport enregistrée recevrait la septième et les rapports longs, ce que
 * personne n'a demandé : une sportive garde des rapports courts.
 *
 * Elle a un second effet, voulu : une boîte de route dont on a changé le pont a
 * été retouchée à la main, et on n'y touche pas non plus.
 */
const ROAD_FINAL_DRIVE = 3.7

/** Celui qui le remplace : les trois premiers intacts, le haut redessiné. */
const SEVEN_GEARS = [3.55, 2.04, 1.36, 1.0, 0.73, 0.53, 0.39]

function sameRatios(ratios: readonly number[], reference: readonly number[]): boolean {
  if (ratios.length !== reference.length) return false
  // Une tolérance au millième : un profil passé par un fichier JSON peut avoir
  // perdu une décimale en route, et ce n'est pas une boîte différente.
  return ratios.every((ratio, i) => Math.abs(ratio - (reference[i] ?? 0)) < 0.001)
}

/**
 * Complète les tableaux qui se comptent par rapport.
 *
 * `upshiftRpm` en tient un de moins que les rapports — il n'y a pas de seuil sur
 * le dernier —, `shiftDelaysS` un par rapport. Les valeurs ajoutées prolongent
 * la dernière plutôt que d'inventer un chiffre : c'est un rapport de plus au
 * bout d'une boîte, pas une boîte nouvelle.
 */
function extend(values: readonly number[], length: number): number[] {
  if (values.length >= length) return [...values]
  const last = values[values.length - 1] ?? 0
  return [...values, ...Array.from({ length: length - values.length }, () => last)]
}

/**
 * Rend la transmission à reprendre, ou la même quand il n'y a rien à faire.
 *
 * Ne touche ni au pont, ni aux seuils, ni aux temporisations déjà réglées : les
 * tableaux sont seulement allongés de ce qui leur manque.
 */
export function withSevenGears(drivetrain: DrivetrainPreset): DrivetrainPreset {
  if (Math.abs(drivetrain.finalDrive - ROAD_FINAL_DRIVE) > 0.001) return drivetrain
  if (!sameRatios(drivetrain.gearRatios, SIX_GEARS)) return drivetrain
  return {
    ...drivetrain,
    gearRatios: [...SEVEN_GEARS],
    upshiftRpm: extend(drivetrain.upshiftRpm, SEVEN_GEARS.length - 1),
    shiftDelaysS: extend(drivetrain.shiftDelaysS, SEVEN_GEARS.length),
  }
}
