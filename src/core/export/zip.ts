/**
 * Un fichier ZIP, écrit à la main.
 *
 * Le navigateur de la voiture ne télécharge rien, mais celui d'un téléphone si :
 * pour sortir d'un coup ce que le serveur a accumulé — journal, traces, relevés,
 * profils — il faut un seul fichier, et le seul format qu'un téléphone ouvre
 * sans rien installer est le ZIP.
 *
 * **Sans compression.** Les entrées sont stockées telles quelles, méthode zéro.
 * C'est ce qui permet d'écrire ce module en une centaine de lignes plutôt que
 * d'ajouter une dépendance à une application qui doit se charger hors réseau, et
 * dont la seule dépendance de production hors Vue est un générateur de codes à
 * scanner. Le prix est la taille : un journal de cinq minutes fait vingt-huit
 * kilo-octets, et le paquet les garde tous. Si le poids devient gênant, la
 * compression native du navigateur (`CompressionStream`) s'ajoute ici et nulle
 * part ailleurs.
 *
 * Ce module ne connaît ni Vue, ni le réseau : il prend des noms et des octets,
 * il rend des octets. C'est ce qui le rend vérifiable sans navigateur.
 */

/** Une entrée du paquet : un chemin, et son contenu. */
export interface ZipEntry {
  /** Chemin dans le paquet, séparé par des barres obliques. */
  path: string
  bytes: Uint8Array
}

const SIGNATURE_LOCALE = 0x04034b50
const SIGNATURE_CENTRALE = 0x02014b50
const SIGNATURE_FIN = 0x06054b50

/**
 * Version minimale de lecture, et drapeaux.
 *
 * Le drapeau 0x0800 déclare les noms en UTF-8. Sans lui, un nom accentué
 * s'ouvre en mojibake sous Windows, qui suppose alors une page de codes
 * historique — et les noms de traces portent le nom du profil, donc des
 * accents.
 */
const VERSION = 20
const DRAPEAU_UTF8 = 0x0800

/** Table du CRC-32, construite une fois. */
const TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  return table
})()

/** Somme de contrôle exigée par le format, sans quoi l'archive est refusée. */
export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i += 1) {
    c = TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

/**
 * Date et heure au format MS-DOS, sur deux mots de seize bits.
 *
 * Le format ZIP n'en connaît pas d'autre : les secondes y tiennent sur cinq
 * bits, donc par pas de deux, et l'année compte depuis 1980. Une date antérieure
 * est ramenée à 1980 plutôt que d'écrire un champ négatif, qu'aucun lecteur
 * n'interprète de la même façon.
 */
export function dosDateTime(date: Date): { time: number; date: number } {
  const annee = Math.max(1980, date.getFullYear())
  return {
    time:
      (Math.floor(date.getSeconds() / 2) & 0x1f) |
      ((date.getMinutes() & 0x3f) << 5) |
      ((date.getHours() & 0x1f) << 11),
    date: (date.getDate() & 0x1f) | (((date.getMonth() + 1) & 0x0f) << 5) | ((annee - 1980) << 9),
  }
}

/**
 * Assemble les entrées en un fichier ZIP.
 *
 * L'ordre est celui des entrées reçues. Les chemins sont normalisés en barres
 * obliques : le format l'exige, et un antislash produirait un dossier au nom
 * étrange au lieu d'une arborescence.
 */
export function buildZip(entries: ZipEntry[], modifiedAt = new Date()): Uint8Array {
  const encodeur = new TextEncoder()
  const horodatage = dosDateTime(modifiedAt)

  const preparees = entries.map((entry) => ({
    nom: encodeur.encode(entry.path.replace(/\\/g, '/')),
    bytes: entry.bytes,
    crc: crc32(entry.bytes),
  }))

  const tailleLocale = preparees.reduce((total, e) => total + 30 + e.nom.length + e.bytes.length, 0)
  const tailleCentrale = preparees.reduce((total, e) => total + 46 + e.nom.length, 0)
  const sortie = new Uint8Array(tailleLocale + tailleCentrale + 22)
  const vue = new DataView(sortie.buffer)

  let position = 0
  const positionsLocales: number[] = []

  const ecrire32 = (valeur: number) => {
    vue.setUint32(position, valeur, true)
    position += 4
  }
  const ecrire16 = (valeur: number) => {
    vue.setUint16(position, valeur, true)
    position += 2
  }
  const ecrireOctets = (octets: Uint8Array) => {
    sortie.set(octets, position)
    position += octets.length
  }

  for (const entree of preparees) {
    positionsLocales.push(position)
    ecrire32(SIGNATURE_LOCALE)
    ecrire16(VERSION)
    ecrire16(DRAPEAU_UTF8)
    ecrire16(0) // méthode zéro : stocké
    ecrire16(horodatage.time)
    ecrire16(horodatage.date)
    ecrire32(entree.crc)
    ecrire32(entree.bytes.length) // taille compressée
    ecrire32(entree.bytes.length) // taille réelle
    ecrire16(entree.nom.length)
    ecrire16(0) // pas de champ supplémentaire
    ecrireOctets(entree.nom)
    ecrireOctets(entree.bytes)
  }

  const debutCentral = position
  for (const [index, entree] of preparees.entries()) {
    ecrire32(SIGNATURE_CENTRALE)
    ecrire16(VERSION) // version d'écriture
    ecrire16(VERSION) // version de lecture minimale
    ecrire16(DRAPEAU_UTF8)
    ecrire16(0)
    ecrire16(horodatage.time)
    ecrire16(horodatage.date)
    ecrire32(entree.crc)
    ecrire32(entree.bytes.length)
    ecrire32(entree.bytes.length)
    ecrire16(entree.nom.length)
    ecrire16(0) // champ supplémentaire
    ecrire16(0) // commentaire
    ecrire16(0) // disque de départ
    ecrire16(0) // attributs internes
    ecrire32(0) // attributs externes
    ecrire32(positionsLocales[index]!)
    ecrireOctets(entree.nom)
  }

  // Mesurée ici et non plus bas : la position aura déjà avancé de douze octets
  // au moment où le champ s'écrit, et l'archive serait déclarée trop longue.
  const tailleCentraleEcrite = position - debutCentral

  ecrire32(SIGNATURE_FIN)
  ecrire16(0) // numéro de ce disque
  ecrire16(0) // disque où commence le répertoire
  ecrire16(preparees.length)
  ecrire16(preparees.length)
  ecrire32(tailleCentraleEcrite)
  ecrire32(debutCentral)
  ecrire16(0) // commentaire d'archive

  return sortie
}
