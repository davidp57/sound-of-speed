/**
 * L'unité dans laquelle un appareil horodate ses mesures.
 *
 * **Le navigateur de la Tesla compte en microsecondes**, là où la norme du web
 * dit millisecondes. Relevé sur les traces de l'essai du 9 septembre 2026 :
 * soixante secondes de trajet s'y annonçaient longues de 60 700 « secondes », et
 * le nom du fichier déposé le disait. Tout ce qui divise une différence
 * d'horodatage — l'accélération, qui est une pente ; la cadence d'un rejeu — en
 * sortait mille fois faux.
 *
 * La détection vit ici et non dans ses deux appelants parce que le seuil doit
 * être le même des deux côtés. Ce dépôt a déjà payé deux fois la même erreur :
 * deux mécanismes qui décrivent le même fait avec des valeurs qui finissent par
 * diverger.
 */

/**
 * Au-delà de cet écart entre deux mesures, l'horodatage n'est pas en
 * millisecondes.
 *
 * Dix secondes : trois ordres de grandeur au-dessus de ce qu'un récepteur
 * produit en roulant — dix positions par seconde dans cette voiture — et cinq
 * fois au-dessus de ce qu'il produit à l'arrêt.
 *
 * **Ce qui ferme le risque d'une fausse détection :** si le plus petit écart
 * entre deux mesures dépassait vraiment dix secondes, tout ce qu'on tire d'une
 * différence d'horodatage serait inexploitable de toute façon. Le seuil ne peut
 * donc pas dégrader un cas sain, et il ne suppose aucun appareil particulier —
 * il mesure ce qui arrive.
 */
export const FINER_THAN_MS_ABOVE_MS = 10_000

/** Diviseur à appliquer quand l'horodatage est en microsecondes. */
export const MICROSECONDS_PER_MS = 1000

/**
 * Diviseur qui ramène des horodatages en millisecondes, d'après leurs écarts.
 *
 * Le critère est le **plus petit écart strictement positif**, et non leur
 * moyenne : un récepteur qui roule produit forcément des écarts courts, alors
 * qu'un arrêt les espace — juger sur la moyenne ferait basculer l'échelle au
 * premier feu rouge. L'écart nul est écarté parce qu'il existe — deux positions
 * consécutives portent parfois le même horodatage dans les traces relevées — et
 * qu'il ne dit rien de l'échelle.
 *
 * Rend 1 quand aucun écart n'est exploitable : sans preuve du contraire,
 * l'unité annoncée par la norme est celle qu'on suppose.
 */
export function detectTimeScale(gaps: Iterable<number>): number {
  let shortest = Number.POSITIVE_INFINITY
  for (const gap of gaps) {
    if (gap > 0 && gap < shortest) shortest = gap
  }
  if (!Number.isFinite(shortest)) return 1
  return shortest > FINER_THAN_MS_ABOVE_MS ? MICROSECONDS_PER_MS : 1
}

/**
 * La même détection, sur une suite de mesures déjà complète.
 *
 * C'est le cas du rejeu, qui connaît toute la trace d'avance là où le
 * conditionnement la découvre mesure par mesure.
 */
export function timeScaleOfSamples(samples: readonly { at: number }[]): number {
  const gaps: number[] = []
  for (let i = 1; i < samples.length; i += 1) {
    gaps.push((samples[i]?.at ?? 0) - (samples[i - 1]?.at ?? 0))
  }
  return detectTimeScale(gaps)
}
