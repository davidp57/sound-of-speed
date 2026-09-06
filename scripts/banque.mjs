#!/usr/bin/env node
/**
 * Relevé d'une banque d'échantillons.
 *
 *   node scripts/banque.mjs <dossier> [--cylindres N]
 *
 * Imprime, fichier par fichier, de quoi remplir un profil : le régime
 * d'ancrage, le gain, et ce qu'il faut pour ne pas se tromper — durée, format,
 * niveau, raccord de boucle.
 *
 * **Pourquoi un outil.** Les deux gains de la banque livrée — 9,6 dB pour la
 * prise « pied levé » basse, 6,5 dB pour la haute — ont été relevés à la main.
 * Chaque banque nouvelle demande le même travail, et l'oreille s'y trompe : un
 * écart de 3 dB ne s'entend pas comme un écart, il s'entend comme un mauvais
 * réglage ailleurs.
 *
 * **Le script mesure, il ne décide pas.** L'analyse rend plusieurs ancrages
 * candidats parce que l'ambiguïté d'octave n'est pas tranchable par un critère
 * spectral ; c'est un humain qui recopie, à l'oreille s'il n'est pas d'accord.
 *
 * Aucun échantillon n'entre dans le dépôt : le dossier se passe en argument.
 *
 * Demande Node 22.18 ou plus récent, qui exécute le TypeScript directement —
 * c'est ce qui permet d'appeler l'analyse du cœur (`core/audio/analyze.ts`)
 * plutôt que d'en recopier une version qui dériverait.
 */

import { readdir, readFile } from 'node:fs/promises'
import { basename, extname, join, resolve } from 'node:path'

import { analyzeSample } from '../src/core/audio/analyze.ts'

/** Cylindres du moteur enregistré, faute d'argument. Celui de la banque livrée. */
const DEFAULT_CYLINDERS = 8
/**
 * Ancrages affichés — les six que rend l'analyse.
 *
 * Mesuré sur les 33 prises des deux banques produites par
 * `scripts/generate-bank/`, dont le régime est connu par construction : le bon
 * régime est le premier candidat 23 fois, il est dans les trois premiers 30
 * fois, et dans les six 32 fois. Les trois premiers ne suffisaient donc pas.
 */
const SHOWN_CANDIDATES = 6
/**
 * Rapports simples affichés sous les candidats.
 *
 * Ce sont ceux que teste l'analyse, et ce sont exactement les confusions qu'elle
 * déclare ne pas pouvoir trancher. Sur les banques produites ici, ils
 * n'ajoutent rien aux six candidats — c'est mesuré. Sur la banque livrée, si :
 * la prise haute donne 2702 en tête et rien au-dessus de 5408, alors que le
 * profil dit 8150, qui est le triple à un demi pour cent près. Une ligne pour
 * un cas réel que les six candidats manquent.
 */
const RELATED_RATIOS = [1 / 3, 1 / 2, 2 / 3, 3 / 2, 2, 3]
/** Bornes de la recherche, les mêmes que celles de l'analyse. */
const MIN_RPM = 400
const MAX_RPM = 14000

// --- Arguments ---------------------------------------------------------------

const args = process.argv.slice(2)

/** Valeur d'une option nommée, et l'indice qu'elle occupe. */
function option(name) {
  const at = args.indexOf(`--${name}`)
  return { value: at === -1 ? undefined : args[at + 1], valueAt: at === -1 ? -1 : at + 1 }
}

const cylindresArg = option('cylindres')
const referenceArg = option('reference')
const cylinders = cylindresArg.value === undefined ? DEFAULT_CYLINDERS : Number(cylindresArg.value)
const taken = [cylindresArg.valueAt, referenceArg.valueAt]
const directory = args.find((arg, index) => !arg.startsWith('--') && !taken.includes(index))

if (directory === undefined || !Number.isFinite(cylinders) || cylinders < 1) {
  console.error('Usage : node scripts/banque.mjs <dossier> [--cylindres N] [--reference fichier.wav]')
  process.exit(1)
}

// --- Lecture des fichiers ----------------------------------------------------

/**
 * Décode un WAV.
 *
 * Les banques ne viennent pas toutes du même endroit : la banque livrée est en
 * flottant 32 bits stéréo, celles que produit `scripts/generate-bank/` sont en
 * entier 16 bits mono. Un lecteur qui n'accepterait qu'une des deux formes
 * refuserait la moitié de ce qu'on veut mesurer.
 */
function readWav(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const tag = (at) => String.fromCharCode(...[0, 1, 2, 3].map((i) => view.getUint8(at + i)))
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('ce n’est pas un WAV')

  let format = 0
  let channels = 0
  let sampleRate = 0
  let bits = 0
  let data = null

  // Les morceaux se suivent sans ordre garanti, et un WAV réel en porte
  // d'autres que « fmt » et « data » — le nom du logiciel, des marqueurs.
  let at = 12
  while (at + 8 <= view.byteLength) {
    const id = tag(at)
    const size = view.getUint32(at + 4, true)
    const body = at + 8
    if (id === 'fmt ') {
      format = view.getUint16(body, true)
      channels = view.getUint16(body + 2, true)
      sampleRate = view.getUint32(body + 4, true)
      bits = view.getUint16(body + 14, true)
      // WAVE_FORMAT_EXTENSIBLE ne dit pas son format là où les autres le
      // disent : il le range en tête du GUID de sous-format.
      if (format === 0xfffe && size >= 40) format = view.getUint16(body + 24, true)
    } else if (id === 'data') {
      data = { start: body, size: Math.min(size, view.byteLength - body) }
    }
    at = body + size + (size % 2)
  }

  if (data === null) throw new Error('morceau « data » absent')
  if (channels < 1) throw new Error('aucun canal déclaré')

  const read = pcmReader(format, bits)
  const step = bits / 8
  const frames = Math.floor(data.size / (step * channels))
  const planes = Array.from({ length: channels }, () => new Float32Array(frames))
  for (let frame = 0; frame < frames; frame += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      planes[channel][frame] = read(view, data.start + (frame * channels + channel) * step)
    }
  }

  return { planes, sampleRate, bits, format }
}

/** Lecture d'un échantillon, ramené entre -1 et 1, selon le format déclaré. */
function pcmReader(format, bits) {
  if (format === 3 && bits === 32) return (view, at) => view.getFloat32(at, true)
  if (format === 3 && bits === 64) return (view, at) => view.getFloat64(at, true)
  if (format === 1 && bits === 16) return (view, at) => view.getInt16(at, true) / 32768
  if (format === 1 && bits === 32) return (view, at) => view.getInt32(at, true) / 2147483648
  if (format === 1 && bits === 24) {
    return (view, at) => {
      // Trois octets en petit-boutiste, signé : le bit de poids fort du
      // troisième porte le signe, qu'il faut propager à la main.
      const raw = view.getUint8(at) | (view.getUint8(at + 1) << 8) | (view.getUint8(at + 2) << 16)
      return (raw & 0x800000 ? raw - 0x1000000 : raw) / 8388608
    }
  }
  if (format === 1 && bits === 8) return (view, at) => view.getUint8(at) / 128 - 1
  throw new Error(`format ${format} sur ${bits} bits, non géré`)
}

/**
 * Faux AudioBuffer.
 *
 * `analyzeSample` n'utilise que cinq propriétés d'un AudioBuffer : les fournir
 * évite de dépendre du Web Audio, donc d'un navigateur. C'est la même couture
 * que celle des tests de l'analyse.
 */
function toBuffer({ planes, sampleRate }) {
  const length = planes[0]?.length ?? 0
  return {
    sampleRate,
    length,
    duration: length / sampleRate,
    numberOfChannels: planes.length,
    getChannelData: (channel) => planes[channel] ?? new Float32Array(length),
  }
}

/** Niveau efficace, tous canaux confondus. */
function rms(planes) {
  let sum = 0
  let count = 0
  for (const plane of planes) {
    for (const value of plane) sum += value * value
    count += plane.length
  }
  return count > 0 ? Math.sqrt(sum / count) : 0
}

// --- Mise en forme -----------------------------------------------------------

const nombre = (value, decimals = 2) => value.toFixed(decimals).replace('.', ',')
const dB = (ratio) => (ratio > 0 ? 20 * Math.log10(ratio) : -Infinity)

function formatFormat({ bits, format, planes, sampleRate }) {
  const encodage = format === 3 ? 'flottant' : 'entier'
  const canaux =
    planes.length === 1 ? 'mono' : planes.length === 2 ? 'stéréo' : `${planes.length} canaux`
  return `${sampleRate.toLocaleString('fr-FR')} Hz · ${canaux} · ${encodage} ${bits} bits`
}

/**
 * Régimes liés au meilleur candidat par un rapport simple.
 *
 * Ceux que l'analyse a déjà classés sont écartés : la ligne ne sert qu'à
 * montrer ce qu'elle n'a pas retenu.
 */
function relatedRpms(candidates) {
  const best = candidates[0]?.rpm
  if (best === undefined) return []
  const known = candidates.map((candidate) => candidate.rpm)
  return RELATED_RATIOS.map((ratio) => Math.round(best * ratio))
    .filter((rpm) => rpm >= MIN_RPM && rpm <= MAX_RPM)
    .filter((rpm) => !known.some((other) => Math.abs(other - rpm) / rpm < 0.02))
}

// --- Relevé ------------------------------------------------------------------

const root = resolve(directory)
let entries
try {
  entries = await readdir(root, { withFileTypes: true })
} catch {
  console.error(`Dossier introuvable : ${root}`)
  process.exit(1)
}

const wavs = entries
  .filter((entry) => entry.isFile() && extname(entry.name).toLowerCase() === '.wav')
  .map((entry) => entry.name)
  .sort((a, b) => a.localeCompare(b, 'fr'))

if (wavs.length === 0) {
  console.error(`Aucun fichier WAV dans ${root}.`)
  console.error('Une banque se mesure sur ses WAV : les versions compressées en sont tirées.')
  process.exit(1)
}

const measured = []
const failed = []

for (const name of wavs) {
  try {
    const wav = readWav(await readFile(join(root, name)))
    const buffer = toBuffer(wav)
    measured.push({ name, wav, level: rms(wav.planes), analysis: analyzeSample(buffer, cylinders) })
  } catch (error) {
    // Un fichier illisible ne doit pas emporter le relevé : c'est justement
    // dans une banque inconnue qu'on en rencontre un.
    failed.push({ name, reason: error instanceof Error ? error.message : String(error) })
  }
}

// Par défaut la référence est la prise la plus forte : c'est l'écart entre les
// couches qui compte, le niveau d'ensemble étant réglé par le volume général et
// le relief. `--reference` la déplace, parce que la plus forte n'est pas
// toujours celle sur laquelle on veut caler le profil — dans la banque livrée,
// c'est le rupteur, une prise à part.
const chosen = measured.find((entry) => entry.name === referenceArg.value)
if (referenceArg.value !== undefined && chosen === undefined) {
  console.error(`Prise de référence introuvable ou non mesurée : ${referenceArg.value}`)
  process.exit(1)
}
const reference = chosen ?? measured.reduce((a, b) => (b.level > a.level ? b : a))

console.log(`Banque « ${basename(root)} » — ${measured.length} prises, moteur ${cylinders} cylindres`)
console.log(
  `Gains rapportés à ${reference.name}` +
    `${chosen === undefined ? ', la plus forte (--reference pour en choisir une autre)' : ''}.`,
)
console.log('Le nombre de cylindres commande les régimes : le passer faux les décale tous.')
console.log('')

for (const { name, wav, level, analysis } of measured) {
  const gain = level > 0 ? reference.level / level : 0
  console.log(name)
  console.log(`  ${nombre(analysis.durationS)} s · ${formatFormat(wav)}`)
  console.log(
    `  niveau ${nombre(dB(level), 1)} dBFS · crête ${nombre(analysis.peak)} · ` +
      `écart ${nombre(dB(level / reference.level), 1)} dB · gain proposé ${nombre(gain)}`,
  )
  const candidates = analysis.candidates
    .slice(0, SHOWN_CANDIDATES)
    .map((candidate) => `${candidate.rpm} (${nombre(candidate.relativeScore)})`)
    .join(' · ')
  console.log(`  ancrages : ${candidates}`)
  const related = relatedRpms(analysis.candidates)
  if (related.length > 0) console.log(`  mêmes ordres : ${related.join(' · ')}`)
  const regime = analysis.steady
    ? 'régime stable'
    : `RAMPE : ${analysis.startRpm} → ${analysis.endRpm} tr/min, pas d’ancrage unique`
  console.log(
    `  ${regime} · timbre ${Math.round(analysis.centroidHz)} Hz · ` +
      `raccord de boucle ${nombre(analysis.seamRatio * 100, 1)} % de la crête`,
  )
  console.log('')
}

for (const { name, reason } of failed) {
  console.log(`${name} — NON MESURÉ : ${reason}`)
}
if (failed.length > 0) console.log('')

// Récapitulatif à recopier dans le profil. Point décimal : ces deux colonnes
// partent dans du code, pas dans une phrase.
console.log('À recopier, couche par couche :')
console.log('')
console.log('  ' + 'fichier'.padEnd(36) + 'anchorRpm'.padStart(10) + 'gain'.padStart(8))
for (const { name, level, analysis } of measured) {
  const gain = level > 0 ? reference.level / level : 0
  const anchor = analysis.candidates[0]?.rpm ?? 0
  console.log('  ' + name.padEnd(36) + String(anchor).padStart(10) + gain.toFixed(2).padStart(8))
}
