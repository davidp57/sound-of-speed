/**
 * Une archive zip, écrite et relue sans bibliothèque.
 *
 * Elle porte les tranches d'un trajet **telles qu'elles ont été déposées** :
 * elles sont déjà compressées, les recomprimer ne rendrait rien et les
 * décompresser en chemin trahirait la promesse — ce qui ressort de l'archive
 * doit être exactement ce qui était monté. Toutes les entrées écrites ici sont
 * donc rangées telles quelles, sans compression.
 *
 * La lecture, elle, accepte aussi les entrées compressées : une archive peut
 * avoir été refaite par un autre outil entre-temps, et le relecteur doit savoir
 * la rouvrir.
 *
 * **Pourquoi ne pas prendre une bibliothèque.** Le format tient en trois blocs —
 * un en-tête par fichier, un répertoire à la fin, et un pied qui dit où le
 * répertoire commence. Écrire ces trois blocs coûte moins cher qu'une dépendance
 * de production sur une application qui doit se charger hors réseau.
 *
 * **Ce qui n'est pas couvert :** Zip64, c'est-à-dire au-delà de quatre
 * gibioctets ou de soixante-cinq mille entrées. La plus grosse session de la
 * base pèse un mégaoctet et porte quarante-deux tranches.
 */

/** Un fichier dans l'archive : son nom, ses octets. */
export interface ZipEntry {
  name: string
  bytes: Uint8Array
  /** Date du fichier, en millisecondes. Celle du trajet, quand on la connaît. */
  at?: number
}

const SIGNATURE_LOCALE = 0x04034b50
const SIGNATURE_CENTRALE = 0x02014b50
const SIGNATURE_FIN = 0x06054b50
/** Ce que ce module écrit : rangé tel quel. 8 est « dégonflé », qu'il sait lire. */
const RANGE = 0
const DEGONFLE = 8
/** Les noms sont écrits en UTF-8, et le drapeau le dit. */
const DRAPEAU_UTF8 = 0x0800

/**
 * Le zip d'un lot d'entrées, en un flux.
 *
 * En flux, et non d'un bloc : une session lourde n'a pas à tenir en mémoire
 * entière. Chaque entrée y passe à son tour — elle, oui, est lue entière, mais
 * elle pèse quelques dizaines de kilo-octets.
 */
export function zipStream(entries: AsyncIterable<ZipEntry>): ReadableStream<Uint8Array> {
  const repertoire: { entry: ZipEntry; crc: number; offset: number }[] = []
  let offset = 0
  const iterateur = entries[Symbol.asyncIterator]()

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const suivante = await iterateur.next()

      if (suivante.done === true) {
        controller.enqueue(repertoireEtFin(repertoire, offset))
        controller.close()
        return
      }

      const entry = suivante.value
      const crc = crc32(entry.bytes)
      repertoire.push({ entry, crc, offset })

      const entete = enteteLocal(entry, crc)
      offset += entete.byteLength + entry.bytes.byteLength
      controller.enqueue(entete)
      controller.enqueue(entry.bytes)
    },
  })
}

/** Le zip d'un lot d'entrées, d'un bloc. Pour ce qui est déjà en mémoire. */
export async function zipBytes(entries: readonly ZipEntry[]): Promise<Uint8Array> {
  const flux = zipStream(
    (async function* () {
      for (const entry of entries) yield entry
    })(),
  )

  const morceaux: Uint8Array[] = []
  const lecteur = flux.getReader()
  for (;;) {
    const { done, value } = await lecteur.read()
    if (done === true) break
    morceaux.push(value)
  }
  return concat(morceaux)
}

/**
 * Les entrées d'une archive.
 *
 * Le répertoire de fin fait foi : c'est lui qui dit ce que l'archive contient,
 * et c'est le seul endroit fiable quand une archive a été réécrite. Une entrée
 * qu'on ne sait pas lire est **laissée de côté et nommée**, pas fatale : une
 * archive amputée se relit quand même, et un trajet à moitié lu répond souvent à
 * la question.
 */
export async function readZip(
  octets: Uint8Array,
): Promise<{ entries: ZipEntry[]; failures: string[] }> {
  const vue = new DataView(octets.buffer, octets.byteOffset, octets.byteLength)
  const fin = chercherLaFin(vue)
  if (fin === null) throw new Error("Ce fichier n'est pas une archive zip.")

  const entries: ZipEntry[] = []
  const failures: string[] = []
  let curseur = fin.debutDuRepertoire

  for (let rang = 0; rang < fin.entrees; rang += 1) {
    if (curseur + 46 > octets.byteLength) break
    if (vue.getUint32(curseur, true) !== SIGNATURE_CENTRALE) break

    const methode = vue.getUint16(curseur + 10, true)
    const compresse = vue.getUint32(curseur + 20, true)
    const tailleDuNom = vue.getUint16(curseur + 28, true)
    const tailleDesExtras = vue.getUint16(curseur + 30, true)
    const tailleDuCommentaire = vue.getUint16(curseur + 32, true)
    const debutLocal = vue.getUint32(curseur + 42, true)
    const name = new TextDecoder().decode(octets.subarray(curseur + 46, curseur + 46 + tailleDuNom))

    curseur += 46 + tailleDuNom + tailleDesExtras + tailleDuCommentaire

    // Un dossier : il n'a pas d'octets, et il n'y a rien à en tirer.
    if (name.endsWith('/')) continue

    try {
      entries.push({ name, bytes: await lireLeContenu(octets, vue, debutLocal, methode, compresse) })
    } catch {
      failures.push(name)
    }
  }

  return { entries, failures }
}

async function lireLeContenu(
  octets: Uint8Array,
  vue: DataView,
  debutLocal: number,
  methode: number,
  compresse: number,
): Promise<Uint8Array> {
  if (debutLocal + 30 > octets.byteLength || vue.getUint32(debutLocal, true) !== SIGNATURE_LOCALE) {
    throw new Error('en-tête local absent')
  }
  const tailleDuNom = vue.getUint16(debutLocal + 26, true)
  const tailleDesExtras = vue.getUint16(debutLocal + 28, true)
  const debut = debutLocal + 30 + tailleDuNom + tailleDesExtras
  const brut = octets.subarray(debut, debut + compresse)

  if (methode === RANGE) return brut
  if (methode !== DEGONFLE) throw new Error(`méthode ${methode} inconnue`)

  // « deflate-raw » : le zip range le flux dégonflé sans l'enveloppe zlib.
  const flux = new Blob([brut as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(flux).arrayBuffer())
}

/**
 * Le pied d'archive, cherché depuis la fin.
 *
 * Depuis la fin, parce qu'un commentaire d'archive peut le suivre : sa position
 * n'est pas fixe, et c'est la seule façon de le trouver à coup sûr.
 */
function chercherLaFin(vue: DataView): { entrees: number; debutDuRepertoire: number } | null {
  const minimum = Math.max(0, vue.byteLength - 22 - 0xffff)
  for (let position = vue.byteLength - 22; position >= minimum; position -= 1) {
    if (vue.getUint32(position, true) !== SIGNATURE_FIN) continue
    return {
      entrees: vue.getUint16(position + 10, true),
      debutDuRepertoire: vue.getUint32(position + 16, true),
    }
  }
  return null
}

function enteteLocal(entry: ZipEntry, crc: number): Uint8Array {
  const nom = new TextEncoder().encode(entry.name)
  const bloc = new Uint8Array(30 + nom.byteLength)
  const vue = new DataView(bloc.buffer)
  const { heure, date } = horodatageDos(entry.at)

  vue.setUint32(0, SIGNATURE_LOCALE, true)
  vue.setUint16(4, 20, true)
  vue.setUint16(6, DRAPEAU_UTF8, true)
  vue.setUint16(8, RANGE, true)
  vue.setUint16(10, heure, true)
  vue.setUint16(12, date, true)
  vue.setUint32(14, crc, true)
  vue.setUint32(18, entry.bytes.byteLength, true)
  vue.setUint32(22, entry.bytes.byteLength, true)
  vue.setUint16(26, nom.byteLength, true)
  vue.setUint16(28, 0, true)
  bloc.set(nom, 30)

  return bloc
}

function repertoireEtFin(
  repertoire: readonly { entry: ZipEntry; crc: number; offset: number }[],
  debutDuRepertoire: number,
): Uint8Array {
  const blocs: Uint8Array[] = []
  let taille = 0

  for (const { entry, crc, offset } of repertoire) {
    const nom = new TextEncoder().encode(entry.name)
    const bloc = new Uint8Array(46 + nom.byteLength)
    const vue = new DataView(bloc.buffer)
    const { heure, date } = horodatageDos(entry.at)

    vue.setUint32(0, SIGNATURE_CENTRALE, true)
    vue.setUint16(4, 20, true)
    vue.setUint16(6, 20, true)
    vue.setUint16(8, DRAPEAU_UTF8, true)
    vue.setUint16(10, RANGE, true)
    vue.setUint16(12, heure, true)
    vue.setUint16(14, date, true)
    vue.setUint32(16, crc, true)
    vue.setUint32(20, entry.bytes.byteLength, true)
    vue.setUint32(24, entry.bytes.byteLength, true)
    vue.setUint16(28, nom.byteLength, true)
    vue.setUint32(42, offset, true)
    bloc.set(nom, 46)

    blocs.push(bloc)
    taille += bloc.byteLength
  }

  const fin = new Uint8Array(22)
  const vue = new DataView(fin.buffer)
  vue.setUint32(0, SIGNATURE_FIN, true)
  vue.setUint16(8, repertoire.length, true)
  vue.setUint16(10, repertoire.length, true)
  vue.setUint32(12, taille, true)
  vue.setUint32(16, debutDuRepertoire, true)
  blocs.push(fin)

  return concat(blocs)
}

/**
 * L'horodatage au format que le zip attend : deux entiers de seize bits,
 * hérités de MS-DOS, dont l'année part de 1980 et les secondes vont par deux.
 *
 * Sans date, les fichiers extraits porteraient celle de l'extraction, et on
 * perdrait de vue quand le trajet a eu lieu.
 */
function horodatageDos(at: number | undefined): { heure: number; date: number } {
  if (at === undefined || !Number.isFinite(at)) return { heure: 0, date: 0 }
  const quand = new Date(at)
  const annee = quand.getUTCFullYear()
  if (annee < 1980) return { heure: 0, date: 0 }

  return {
    heure:
      (quand.getUTCHours() << 11) |
      (quand.getUTCMinutes() << 5) |
      Math.floor(quand.getUTCSeconds() / 2),
    date: ((annee - 1980) << 9) | ((quand.getUTCMonth() + 1) << 5) | quand.getUTCDate(),
  }
}

function concat(morceaux: readonly Uint8Array[]): Uint8Array {
  const total = morceaux.reduce((somme, morceau) => somme + morceau.byteLength, 0)
  const tout = new Uint8Array(total)
  let position = 0
  for (const morceau of morceaux) {
    tout.set(morceau, position)
    position += morceau.byteLength
  }
  return tout
}

/**
 * La somme de contrôle que le zip exige.
 *
 * Elle n'est pas décorative : un extracteur qui trouve une somme fausse refuse
 * le fichier, et l'archive serait illisible partout sauf ici.
 */
const TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i += 1) {
    let valeur = i
    for (let bit = 0; bit < 8; bit += 1) {
      valeur = (valeur & 1) === 1 ? 0xedb88320 ^ (valeur >>> 1) : valeur >>> 1
    }
    table[i] = valeur
  }
  return table
})()

export function crc32(octets: Uint8Array): number {
  let somme = 0xffffffff
  for (const octet of octets) somme = TABLE[(somme ^ octet) & 0xff]! ^ (somme >>> 8)
  return (somme ^ 0xffffffff) >>> 0
}
