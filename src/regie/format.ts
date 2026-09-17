/**
 * Ce qui se lit d'un coup d'œil, dans la régie.
 *
 * Les trois écrans de ce dossier montrent les mêmes grandeurs — une date, un
 * poids, une durée restante — et les écrire trois fois donnerait trois façons de
 * les écrire.
 */

/**
 * À la minute : on cherche « celui de tout à l'heure », pas la seconde.
 *
 * **En heure locale**, et c'est le point : les noms de tranches portent le temps
 * universel, délibérément — une même tranche daterait sinon de deux heures
 * différentes selon la machine qui la relit. Ce qui s'affiche, lui, doit être
 * l'heure qu'il était.
 *
 * Accepte une date ISO ou un instant en millisecondes, les deux formes qui
 * circulent dans la régie.
 */
export function dateLisible(iso: string | number): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Dans l'unité qui se lit : on repère un compte qui fait grossir le serveur. */
export function poidsLisible(octets: number): string {
  if (octets === 0) return '—'
  // Sous le kibioctet, on donne les octets : arrondir douze octets à « 0 Kio »
  // ferait lire « rien » là où il y a quelque chose.
  if (octets < 1024) return `${octets} o`
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Kio`
  if (octets < 1024 * 1024 * 1024) return `${(octets / (1024 * 1024)).toFixed(1)} Mio`
  return `${(octets / (1024 * 1024 * 1024)).toFixed(2)} Gio`
}

/** Sans accent ni casse : une recherche qui se tape vite. */
export function normaliser(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}
