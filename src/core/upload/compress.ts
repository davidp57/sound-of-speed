/**
 * Compresser ce qui part vers le serveur.
 *
 * Le journal et la capture sont du JSON très répétitif : les mêmes clés à
 * chaque ligne, des nombres courts, aucune donnée dense. Une demi-heure de
 * journal occupe deux cent trente kilo-octets pour un contenu qui en vaut
 * trente, et une heure de capture dépasse le mégaoctet.
 *
 * **Le gain porte d'abord sur la 4G, pas sur le disque.** Une tranche part
 * depuis une voiture en mouvement, sur une couverture qui va et vient : ce qui
 * compte est qu'elle tienne dans la fenêtre de réseau qu'on a, et non la place
 * qu'elle prendra sur le serveur.
 *
 * **Aucune bibliothèque.** Le navigateur sait compresser depuis 2023
 * (`CompressionStream`), et cette application doit se charger hors réseau : une
 * dépendance de plus se paierait à chaque démarrage. Là où le compresseur
 * manque, on dépose en clair — un fichier plus gros vaut mieux qu'un fichier
 * absent.
 */

/** Le navigateur sait-il compresser lui-même ? */
export function canCompress(): boolean {
  return typeof globalThis.CompressionStream === 'function'
}

/**
 * Compresse un texte en gzip.
 *
 * Gzip et non deflate : c'est le format que tous les outils de bureau ouvrent,
 * et un fichier qu'on ne sait pas rouvrir ne vaut rien.
 */
export async function gzip(text: string): Promise<Blob> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))
  return await new Response(stream).blob()
}

/** Décompresse ce que `gzip` a produit. */
export async function gunzip(data: Blob): Promise<string> {
  const stream = data.stream().pipeThrough(new DecompressionStream('gzip'))
  return await new Response(stream).text()
}

export interface Packed {
  name: string
  body: string | Blob
  /** Vrai si le corps est compressé, pour l'annoncer au serveur. */
  compressed: boolean
}

/**
 * Prépare un fichier pour l'envoi : compressé si on sait le faire.
 *
 * Le nom porte l'extension `.gz`, parce que c'est le nom qui dit à celui qui
 * rapatrie le fichier ce qu'il tient. Une compression qui échoue rend le texte
 * d'origine : à ce stade, la seule issue est de déposer quand même.
 */
export async function pack(name: string, body: string): Promise<Packed> {
  if (!canCompress()) return { name, body, compressed: false }
  try {
    return { name: `${name}.gz`, body: await gzip(body), compressed: true }
  } catch {
    return { name, body, compressed: false }
  }
}
