import type { CaptureLine, CaptureSample } from '../capture/capture'
import type { Trace } from '../speed/replay'
import type { SpeedSample } from '../speed/source'

/**
 * Lire une capture de trajet avec les outils de l'étalonnage.
 *
 * L'étalonnage sait mesurer une `Trace` — un nom, un début, des échantillons de
 * source. Les captures déposées sur le serveur depuis le 10 septembre 2026 ont
 * une autre forme : des tranches numérotées, chacune précédée d'un en-tête, où
 * des relevés et des faits datés se mêlent, et où chaque relevé porte bien plus
 * que ce que la source a donné — le régime, le rapport, la charge, la vitesse
 * conditionnée.
 *
 * Cette pièce fait la conversion, et rien d'autre : elle ne mesure pas, elle ne
 * juge pas. C'est ce qui permet de mesurer un trajet ordinaire avec le code
 * éprouvé sur les enregistrements du protocole, au lieu d'en écrire un second.
 */

/** Ce qui distingue un relevé d'un fait daté : le fait porte un `kind`. */
function isSample(line: CaptureLine): line is CaptureSample {
  return !('kind' in line)
}

export interface FromCaptureOptions {
  /** Début de la session, en millisecondes. Reporté tel quel dans la trace. */
  startedAt?: number
}

/**
 * Assemble les relevés d'une capture en une trace mesurable.
 *
 * **La vitesse retenue est la brute**, celle que la source a donnée, et non la
 * vitesse conditionnée qui pilote le son. Les deux sont dans la capture, et le
 * choix compte : le conditionnement lisse, donc mesurer sa sortie rendrait des
 * pentes plus douces que la voiture — elle paraîtrait moins vive qu'elle n'est.
 * C'est aussi du brut que mesurent les enregistrements du protocole, et sans
 * cela les deux chemins ne seraient pas comparables.
 *
 * **Une mesure réémise n'est pas une mesure.** Une capture note ce que la chaîne
 * fait à chaque tour de boucle, pas à chaque position reçue : la même mesure y
 * revient tant que la suivante n'est pas arrivée. Mesuré sur le trajet du
 * 11 septembre 2026 : 23 983 relevés pour 21 897 mesures distinctes, soit 8,7 %
 * de réémissions — la boucle bat donc à peu près à la cadence de la source, et
 * l'essentiel du surplus tient en un seul point répété 370 fois, à l'arrêt.
 *
 * Ces répétitions portent la même vitesse au bit près. Elles ne s'écartent donc
 * de la droite ajustée que de zéro, et le bruit du GPS en ressort sous-estimé —
 * or c'est lui qui dimensionne la fenêtre d'accélération. **Mesuré sur ce même
 * trajet : 0,240 km/h en les comptant, 0,306 en les écartant**, soit un quart
 * de plus.
 *
 * On les reconnaît à la fois par l'horodatage de la source **et** par la
 * vitesse, et il faut les deux. L'horodatage seul ne suffit pas : mesuré sur le
 * même trajet, soixante-huit fois le même horodatage porte deux vitesses
 * différentes — sa résolution est plus grossière que la cadence. S'y fier seul
 * efface tous les arrêts, parce que le premier relevé immobile hérite de
 * l'horodatage du dernier relevé en mouvement : 446 relevés à l'arrêt tombaient
 * à zéro, et les trois départs du trajet avec eux — ceux-là mêmes qui informent
 * la vitesse de passage en deuxième.
 *
 * Les relevés sont aussi remis dans l'ordre, et ceux qui partagent un instant
 * de boucle sont écartés — deux points au même instant donnent un intervalle
 * nul, donc une pente infinie.
 *
 * Les instants restent ceux de la capture, comptés depuis le début de la
 * session. Les mesures d'étalonnage ne regardent que des écarts : l'origine n'a
 * pas d'importance, seule sa cohérence en a.
 *
 * `startedAt` est donc **facultatif**, et vaut zéro à défaut. Une trace du
 * protocole y met un horodatage absolu ; ici les instants sont relatifs, et
 * mélanger les deux conventions dans un même objet n'aurait pas de sens. Le
 * passer quand on l'a — l'en-tête de la capture le porte — donne une trace qui
 * se date ; ne pas le passer donne une trace qui se mesure quand même.
 */
export function traceFromCapture(
  name: string,
  lines: readonly CaptureLine[],
  options: FromCaptureOptions = {},
): Trace {
  // On trie **avant** d'écarter les doublons, et non après : les tranches d'une
  // session n'arrivent pas forcément dans l'ordre — une tranche dont le dépôt a
  // échoué est remise en file et rejoint la suivante. Dédupliquer d'abord
  // garderait le premier relevé du fichier au lieu du premier dans le temps, et
  // une mesure répétée de part et d'autre d'une frontière de tranche serait
  // re-datée en avant.
  const ordered = lines
    .filter(isSample)
    .filter((line) => Number.isFinite(line.at) && Number.isFinite(line.kmh))
    .sort((a, b) => a.at - b.at)

  const samples: SpeedSample[] = []
  const seenAt = new Set<number>()
  const seenMeasures = new Set<string>()

  for (const line of ordered) {
    if (seenAt.has(line.at)) continue
    // Une source qui n'horodate pas — le simulateur, un banc — ne permet pas
    // de reconnaître une réémission : on garde alors tout ce qui arrive.
    if (Number.isFinite(line.src) && line.src !== 0) {
      const measure = `${line.src}:${line.kmh}`
      if (seenMeasures.has(measure)) continue
      seenMeasures.add(measure)
    }
    seenAt.add(line.at)
    samples.push({
      kmh: line.kmh,
      at: line.at,
      accuracyM: line.acc,
      derived: line.der,
    })
  }

  return { name, startedAt: options.startedAt ?? 0, samples }
}
