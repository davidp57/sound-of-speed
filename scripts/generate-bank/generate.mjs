/**
 * Génère une banque d'échantillons avec engine-sim, ici, au bureau.
 *
 * Le principe tient en une phrase : faire tourner le moteur simulé aussi
 * lentement qu'il le faut, à un régime tenu, et enregistrer une boucle par
 * plage de régime. La voiture, elle, ne fait tourner personne — elle rejoue,
 * avec le moteur de lecture qui existe déjà. Rien n'est modifié dans ce moteur
 * de lecture : c'est la contrainte de départ.
 *
 * Ce que l'outil produit :
 *
 * - un fichier WAV par prise, dans `public/audio/<dossier>/` ;
 * - `profil.json`, un profil partiel que l'application importe tel quel, avec
 *   les ancrages, les gains et les bornes de lecture **mesurés** ;
 * - `mesures.json`, le relevé complet, pour qu'aucun chiffre annoncé ne soit
 *   invérifiable.
 *
 * Usage :
 *
 *   bash native/build-generator.sh
 *   node scripts/generate-bank/generate.mjs scripts/generate-bank/engines/v8-crossplane.json
 */

import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildPlan } from './plan.mjs'
import { bestWindow, closeLoop, seamStep } from './loop.mjs'
import { fichierMoteur, resoudreMoteur } from './moteur.mjs'
import { buildProfile } from './profil.mjs'
import { lireCaptation, poserEchappement } from './echappement.mjs'
import { peak, rms, spectralCentroid } from './spectrum.mjs'
import { readWav, writeWav } from './wav.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const BINARY = join(ROOT, 'native', '.build', 'generate-bank.exe')
const IMPULSE_DIR = join(ROOT, 'public', 'impulse')

/**
 * La réponse d'échappement d'une définition, en chemin de fichier.
 *
 * Le banc fabriquait sa propre résonance — un train de pics espacés de 57 Hz,
 * donc un filtre en peigne. Mesuré contre `smooth_39`, la captation que le son
 * en direct utilise depuis le 8 septembre : le tube creuse le médium de 5,3 dB
 * et laisse passer 14 à 22 dB d'aigu de trop. Ce qui s'entendait, sur la banque
 * du 5 septembre, comme un son sourd doublé d'un souffle aigu battant à
 * contretemps des explosions.
 *
 * `"tube"` garde l'ancienne résonance, pour comparer. C'est le seul usage qui
 * lui reste : `public/impulse/LISEZMOI.md` la dit « repli ».
 */
function exhaustPath(definition) {
  const nom = definition.exhaustResponse ?? 'smooth_39'
  return nom === 'tube' ? '' : join(IMPULSE_DIR, `${nom}.wav`)
}

/**
 * Part d'énergie réverbérée, comme dans le mode direct.
 *
 * `0.45` est la valeur que David tient depuis le 6 septembre 2026, étendue à
 * toute la bibliothèque le 8 — voir `echappement.mjs` pour ce qu'elle corrige
 * ici. `1` rend le comportement d'avant le 14 septembre, où toute la sortie
 * passait par la réponse ; `0` donne le moteur sec.
 */
function exhaustMix(definition) {
  const mix = definition.exhaustMix ?? 0.45
  return Math.min(Math.max(mix, 0), 1)
}
const SAMPLE_RATE = 44100

/** Crête visée dans le fichier écrit. La marge évite l'écrêtage au décodage. */
const TARGET_PEAK = 0.89

function fail(message) {
  console.error(message)
  process.exit(1)
}

function parseArgs(argv) {
  const options = { definition: null, out: join(ROOT, 'public', 'audio') }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--out') {
      i += 1
      options.out = resolve(argv[i])
    } else if (arg.startsWith('--')) {
      fail(`option inconnue : ${arg}`)
    } else {
      options.definition = resolve(arg)
    }
  }
  if (options.definition === null) {
    fail('Usage : node scripts/generate-bank/generate.mjs <définition.json> [--out <dossier>]')
  }
  return options
}

/** Lance le banc natif et rend son relevé, prise par prise. */
function runBench(definition, enginePath, plan, rawDir) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(
      BINARY,
      [
        '--engine-def', enginePath,
        '--sim-hz', String(definition.simulationHz),
        '--impulse', String(definition.impulseSamples),
        // Le banc rend le son **sec** : l'échappement se pose ici, avec la part
        // réverbérée du mode direct. Sauf pour le tube fabriqué, qui n'a plus
        // que cet usage de comparaison et reste donc où il était.
        ...(exhaustPath(definition) === '' ? [] : ['--exhaust', 'none']),
        '--out-dir', rawDir,
      ],
      { stdio: ['pipe', 'pipe', 'inherit'] },
    )

    let output = ''
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk) => {
      output += chunk
      // Le banc écrit une ligne dès qu'une prise est finie : on la répercute,
      // sans quoi une génération de plusieurs minutes reste muette.
      for (const line of chunk.split('\n')) {
        if (line.trim() !== '') console.log(`  ${line.trim()}`)
      }
    })
    child.on('error', rejectRun)
    child.on('close', (code) => {
      if (code !== 0) rejectRun(new Error(`le banc natif a rendu ${code}`))
      else resolveRun(output)
    })

    for (const take of plan.takes) {
      child.stdin.write(
        `${take.name} ${take.rpm.toFixed(3)} ${take.throttle} ${take.samples} ${take.settle}\n`,
      )
    }
    child.stdin.end()
  })
}

/** Relit le relevé du banc : une ligne par prise, les commentaires en moins. */
function parseReport(output) {
  const report = new Map()
  let totalSeconds = 0
  for (const line of output.split('\n')) {
    const trimmed = line.trim()
    if (trimmed === '') continue
    if (trimmed.startsWith('#')) {
      const total = /^# total ([\d.]+)/.exec(trimmed)
      if (total) totalSeconds = Number(total[1])
      continue
    }
    const parts = trimmed.split(/\s+/)
    if (parts.length < 12) continue
    report.set(parts[0], {
      askedRpm: Number(parts[1]),
      measuredRpm: Number(parts[2]),
      volume: Number(parts[3]),
      truePeak: Number(parts[4]),
      trueRms: Number(parts[5]),
      samples: Number(parts[6]),
      seconds: Number(parts[7]),
      torqueFtLb: Number(parts[8]),
      hottestK: Number(parts[9]),
      clipped: parts[10] === '1',
      calibrations: Number(parts[11]),
    })
  }
  return { report, totalSeconds }
}

/**
 * Répartition du régime entre les couches d'un même rôle.
 *
 * Copie de `blendWeights` de `src/core/audio/mix.ts`, branche « plus de deux
 * couches » : c'est elle qui s'appliquera à cette banque. Elle sert ici à
 * **prévoir** ce que l'application jouera, pour mesurer l'erreur de timbre
 * avant de livrer.
 */
function blendWeights(anchorList, rpm) {
  return anchorList.map((anchor, index) => {
    const previous = anchorList[index - 1]
    const next = anchorList[index + 1]
    if (next !== undefined && rpm >= anchor && rpm < next) {
      return Math.cos((((rpm - anchor) / (next - anchor)) * Math.PI) / 2)
    }
    if (previous !== undefined && rpm >= previous && rpm < anchor) {
      return Math.sin((((rpm - previous) / (anchor - previous)) * Math.PI) / 2)
    }
    if (index === 0 && rpm < anchor) return 1
    if (index === anchorList.length - 1 && rpm >= anchor) return 1
    return 0
  })
}

/**
 * Erreur de timbre d'un jeu d'ancrages, en demi-tons.
 *
 * On dispose d'une prise **vraie** à chaque régime témoin. Pour un jeu
 * d'ancrages donné, on calcule le centroïde que l'application produirait à ce
 * régime : chaque couche retenue est lue à `régime ÷ ancrage`, ce qui déplace
 * tout son spectre d'autant — résonances comprises, et c'est là le défaut — et
 * les couches se mélangent au poids que le fondu leur donne. L'écart avec le
 * centroïde de la prise vraie est l'erreur.
 *
 * C'est exactement ce que le lot corrige, chiffré : de combien le corps du son
 * se déplace alors qu'il ne devrait pas bouger.
 */
function timbreError(anchorTakes, witnesses) {
  const anchorList = anchorTakes.map((t) => t.measuredRpm)
  const centroids = anchorTakes.map((t) => t.centroidHz)
  let worst = 0
  const points = []

  for (const truth of witnesses) {
    const weights = blendWeights(anchorList, truth.measuredRpm)
    // Les poids sont des gains ; l'énergie va comme leur carré, et c'est
    // l'énergie qui pondère un centroïde.
    let weighted = 0
    let total = 0
    for (let i = 0; i < anchorList.length; i += 1) {
      const energy = weights[i] * weights[i]
      if (energy <= 0) continue
      weighted += energy * centroids[i] * (truth.measuredRpm / anchorList[i])
      total += energy
    }
    if (total <= 0) continue
    const predicted = weighted / total
    const semitones = 12 * Math.log2(predicted / truth.centroidHz)
    points.push({
      rpm: Math.round(truth.measuredRpm),
      predictedHz: predicted,
      trueHz: truth.centroidHz,
      semitones,
    })
    if (Math.abs(semitones) > Math.abs(worst)) worst = semitones
  }

  return { worst, points }
}

/** Plage de vitesse de lecture d'un jeu d'ancrages, sur toute la couverture. */
function rateSpan(anchorList, idleRpm, redlineRpm) {
  let low = Number.POSITIVE_INFINITY
  let high = 0
  const steps = 400
  for (let i = 0; i <= steps; i += 1) {
    const rpm = idleRpm * Math.pow(redlineRpm / idleRpm, i / steps)
    const weights = blendWeights(anchorList, rpm)
    for (let k = 0; k < anchorList.length; k += 1) {
      // Une couche muette n'est pas jouée : sa vitesse n'existe pas.
      if (weights[k] < 0.02) continue
      const rate = rpm / anchorList[k]
      if (rate < low) low = rate
      if (rate > high) high = rate
    }
  }
  return { low, high }
}

function toDb(ratio) {
  return 20 * Math.log10(Math.max(ratio, 1e-12))
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const definition = JSON.parse(readFileSync(options.definition, 'utf8'))

  // Le moteur vient de la bibliothèque de l'application, la même que celle de
  // l'écran de synthèse. Le rupteur qu'elle porte fait le domaine de la banque :
  // une définition qui le redit l'emporte, mais elle n'a pas à le redire.
  const moteur = await resoudreMoteur(definition)
  const plan = buildPlan({ ...definition, redlineRpm: moteur.redlineRpm }, SAMPLE_RATE)
  const bankDir = join(options.out, definition.sampleDir)
  const rawDir = join(bankDir, '.brut')
  mkdirSync(rawDir, { recursive: true })

  // Le moteur part au banc par fichier, et ce fichier reste : une banque se
  // refait en le relisant, sans avoir à retrouver quelle version de la
  // bibliothèque l'a produite.
  const enginePath = join(rawDir, 'moteur.txt')
  writeFileSync(enginePath, fichierMoteur(moteur))

  console.log(`Moteur : ${moteur.label} (${moteur.id}, ${moteur.cylinders} cylindres)`)
  console.log(
    `Ancrages : ${plan.anchors.length} de ${Math.round(plan.anchors[0])}` +
      ` à ${Math.round(plan.anchors[plan.anchors.length - 1])} tr/min,` +
      ` écart ${plan.ratio.toFixed(3)}× (${(Math.log2(plan.ratio) * 12).toFixed(1)} demi-tons)`,
  )
  console.log(`Prises : ${plan.takes.length}, ${definition.bank.takeSeconds} s visée chacune`)
  console.log('')

  const output = await runBench(definition, enginePath, plan, rawDir)
  const { report, totalSeconds } = parseReport(output)

  // La captation se lit une fois pour toutes les prises. `null` quand le tube
  // fabriqué est demandé : c'est alors le banc qui l'a déjà appliqué, entier.
  const mix = exhaustMix(definition)
  const reponse = exhaustPath(definition) === '' ? null : lireCaptation(exhaustPath(definition))
  if (reponse !== null) {
    console.log(
      `Échappement : ${definition.exhaustResponse ?? 'smooth_39'},` +
        ` ${Math.round(mix * 100)} % de la sortie`,
    )
  }

  // --- Reprise de chaque prise : niveau, fermeture de boucle, mesures. ---
  //
  // Le fichier écrit garde sa longueur : un nombre entier de cycles moteur.
  // On ne recolle pas ici — l'application le fait au chargement, sur toutes
  // les couches, et le faire deux fois raccourcirait la boucle deux fois. On
  // se contente de **mesurer** ce que sa passe donnera.
  const results = []
  for (const take of plan.takes) {
    const measured = report.get(take.name)
    if (measured === undefined) fail(`le banc n'a rien rendu pour ${take.name}`)

    const { samples: secs } = readWav(readFileSync(join(rawDir, take.name)))

    // L'échappement, posé sur le son sec que le banc vient de rendre. Il vient
    // **avant** la normalisation et les mesures : ce qu'on chiffre plus bas doit
    // être ce qui est écrit dans le fichier, pas ce qui l'a précédé.
    const melange = reponse === null ? secs : poserEchappement(secs, reponse, mix)

    // Puis la fenêtre de cycles qui se referme le mieux. Sans elle, le son sec —
    // aux transitoires plus raides que le convolué — doublait le saut au
    // bouclage : 26,4 % contre 11,4 % sur le V8, mesuré le 14 septembre 2026.
    const fenetre = bestWindow(melange, SAMPLE_RATE, take.cycles)
    const samples = fenetre.samples

    // Normalisation en crête : elle n'efface rien du relief entre les prises,
    // qui est repris plus bas par le gain de couche. La convolution déplace le
    // rapport crête/énergie, et différemment selon le régime — mesuré de ×1,2 à
    // ×3,5 sur le quatre cylindres. C'est `fileRms` qui le rattrape, plus bas.
    const rawPeak = peak(samples)
    const scale = rawPeak > 0 ? TARGET_PEAK / rawPeak : 1
    const finalSamples = new Float32Array(samples.length)
    for (let i = 0; i < finalSamples.length; i += 1) finalSamples[i] = samples[i] * scale

    if (take.purpose === 'bank') {
      writeFileSync(join(bankDir, take.name), writeWav(finalSamples, SAMPLE_RATE))
    }

    const closed = closeLoop(finalSamples, SAMPLE_RATE)

    results.push({
      ...take,
      measuredRpm: measured.measuredRpm,
      truePeak: measured.truePeak,
      trueRms: measured.trueRms,
      torqueFtLb: measured.torqueFtLb,
      hottestK: measured.hottestK,
      clipped: measured.clipped,
      benchSeconds: measured.seconds,
      cycles: fenetre.cycles,
      cyclesEnregistres: take.cycles,
      durationS: finalSamples.length / SAMPLE_RATE,
      fileSeam: seamStep(finalSamples, SAMPLE_RATE),
      playedSeam: closed.seam,
      seamMethod: closed.method,
      playedDurationS: closed.samples.length / SAMPLE_RATE,
      fileRms: rms(finalSamples),
      centroidHz: spectralCentroid(finalSamples, SAMPLE_RATE),
    })
  }

  // Une boucle beaucoup plus courte que prévu s'entend comme un bourdonnement,
  // et aucun des chiffres du relevé ne la signale : le saut au bouclage d'une
  // prise de trois cycles est excellent. C'est ce qui a fait juger « très
  // synthétique » un six en ligne dont trois prises faisaient 95 ms.
  const courtes = results.filter(
    (r) => r.purpose === 'bank' && r.durationS < definition.bank.takeSeconds * 0.75,
  )
  if (courtes.length > 0) {
    console.log('')
    console.log(
      `Attention : ${courtes.length} prise(s) nettement plus courte(s) que la cible —` +
        ` ${courtes.map((r) => `${r.name} (${r.durationS.toFixed(2)} s)`).join(', ')}`,
    )
  }

  const clippedTakes = results.filter((r) => r.clipped)
  if (clippedTakes.length > 0) {
    console.log('')
    console.log(
      `Attention : ${clippedTakes.length} prise(s) écrêtée(s) à l'enregistrement —` +
        ` ${clippedTakes.map((r) => r.name).join(', ')}`,
    )
  }

  // --- Gains de couche : ce que la normalisation vient d'effacer. ---
  //
  // La référence est la prise en charge la plus forte : elle porte le gain 1 et
  // tout le reste se place par rapport à elle. Le gain rend au fichier le
  // niveau relatif qu'il avait à la sortie du moteur simulé.
  //
  // Mais le relief brut est **rabattu**, et il faut dire pourquoi. Mesuré sur
  // le quatre cylindres, l'écart entre le pied levé au ralenti et le plein gaz
  // au rupteur atteint 64 dB : joué tel quel, il n'y a plus rien à entendre en
  // dessous de 2 000 tr/min. À l'inverse, engine-sim lui-même sort à niveau
  // constant, son correcteur de niveau ramenant tout à la pleine échelle — soit
  // aucun relief du tout. Ni l'un ni l'autre ne convient. Le facteur de
  // `relief` est donc un choix déclaré dans la définition, appliqué en
  // décibels, et le chiffre brut reste écrit dans `mesures.json`.
  const compression = definition.bank.reliefCompression ?? 1
  const reference = results
    .filter((r) => r.role === 'on' && r.purpose === 'bank')
    .reduce((best, r) => (r.trueRms > best.trueRms ? r : best))

  for (const result of results) {
    result.measuredDb = toDb(result.trueRms / reference.trueRms)
    const wantedDb = result.measuredDb * compression
    const fileRatio = result.fileRms / reference.fileRms
    result.gain = fileRatio > 0 ? Math.pow(10, wantedDb / 20) / fileRatio : 1
    result.appliedDb = wantedDb
  }

  // --- Combien de prises ? La mesure, et non la décision. ---
  const bankOn = results.filter((r) => r.role === 'on' && r.purpose === 'bank')
  const witnesses = results.filter((r) => r.purpose === 'witness')
  const last = bankOn.length - 1

  // On compare le jeu complet à ses propres sous-ensembles : garder un ancrage
  // sur deux, sur trois, sur quatre. Chaque sous-ensemble est un écartement
  // deux, trois ou quatre fois plus large, et les ancrages qu'il abandonne
  // deviennent autant de prises vraies auxquelles se comparer. La question
  // « une par octave suffit-elle » se mesure ainsi sur une seule génération.
  const candidates = []
  for (const step of [1, 2, 3, 4]) {
    const indices = bankOn.map((_, i) => i).filter((i) => i % step === 0)
    if (indices[indices.length - 1] !== last) indices.push(last)
    if (indices.length < 2) continue
    if (candidates.some((c) => c.indices.length === indices.length)) continue
    const octaves = definition.bank.spacingOctaves * step
    candidates.push({ label: `un ancrage tous les ${octaves.toFixed(2)} octave`, indices })
  }
  candidates.push({ label: 'les deux bouts', indices: [0, last] })

  const spacings = candidates.map((candidate) => {
    const kept = candidate.indices.map((i) => bankOn[i])
    const anchorList = kept.map((t) => t.measuredRpm)
    // Les ancrages écartés deviennent eux-mêmes des témoins : ce sont des
    // prises vraies que ce jeu-là n'a plus.
    const dropped = bankOn.filter((t) => !kept.includes(t))
    return {
      label: candidate.label,
      takes: kept.length,
      ratio: Math.pow(anchorList[anchorList.length - 1] / anchorList[0], 1 / (anchorList.length - 1)),
      ...rateSpan(anchorList, definition.idleRpm, moteur.redlineRpm),
      timbre: timbreError(kept, [...witnesses, ...dropped]),
    }
  })

  // --- Le profil partiel, importable tel quel. ---
  const anchorList = bankOn.map((r) => r.measuredRpm)
  const span = rateSpan(anchorList, definition.idleRpm, moteur.redlineRpm)
  // Une marge de 10 % au-delà de la plage mesurée : le tremblement de régime et
  // le désaccord entre couches débordent légèrement, et une couche bornée est
  // effacée par le mixage.
  const minRate = Number((span.low / 1.1).toFixed(3))
  const maxRate = Number((span.high * 1.1).toFixed(3))

  const layers = results
    .filter((r) => r.purpose === 'bank')
    .map((result) => ({
      key: result.key,
      file: result.name,
      role: result.role,
      anchorRpm: Math.round(result.measuredRpm),
      gain: Number(result.gain.toFixed(4)),
      minRate: result.role === 'limiter' ? 0.8 : minRate,
      maxRate: result.role === 'limiter' ? 1.25 : maxRate,
      enabled: true,
    }))

  const profile = buildProfile({ definition, moteur, layers, anchorList })

  writeFileSync(join(bankDir, 'profil.json'), `${JSON.stringify(profile, null, 2)}\n`)

  // La recette complète, à côté des fichiers qu'elle a produits : la définition
  // de banque et les vingt-neuf nombres du moteur. C'est ici qu'on vient pour
  // refaire une banque, et `sampleDir` est ce qui y mène depuis le profil.
  const mesures = {
    definition,
    engine: { id: moteur.id, label: moteur.label, definition: moteur.nommees },
    generatedAt: new Date().toISOString(),
    totalSeconds,
    reference: reference.name,
    reliefCompression: compression,
    rateSpan: span,
    spacings: spacings.map((s) => ({
      label: s.label,
      takes: s.takes,
      ratio: s.ratio,
      rateLow: s.low,
      rateHigh: s.high,
      worstTimbreSemitones: s.timbre.worst,
      points: s.timbre.points,
    })),
    takes: results.map((r) => ({
      name: r.name,
      role: r.role,
      purpose: r.purpose,
      askedRpm: r.rpm,
      measuredRpm: r.measuredRpm,
      cycles: r.cycles,
      durationS: r.durationS,
      fileSeam: r.fileSeam,
      playedSeam: r.playedSeam,
      seamMethod: r.seamMethod,
      playedDurationS: r.playedDurationS,
      gain: r.gain,
      measuredDb: r.measuredDb,
      appliedDb: r.appliedDb,
      centroidHz: r.centroidHz,
      torqueFtLb: r.torqueFtLb,
      hottestK: r.hottestK,
      clipped: r.clipped,
      benchSeconds: r.benchSeconds,
    })),
  }
  writeFileSync(join(bankDir, 'mesures.json'), `${JSON.stringify(mesures, null, 2)}\n`)

  // --- Le relevé, à l'écran. ---
  console.log('')
  console.log(
    'Prise             régime  durée  saut fichier  saut joué  méthode   gain  mesuré  retenu  centroïde  couple  chambre',
  )
  for (const r of results) {
    console.log(
      `${r.name.padEnd(17)} ${String(Math.round(r.measuredRpm)).padStart(5)}` +
        ` ${r.durationS.toFixed(2).padStart(5)}s` +
        ` ${(r.fileSeam * 100).toFixed(2).padStart(12)}%` +
        ` ${(r.playedSeam * 100).toFixed(2).padStart(8)}%` +
        ` ${r.seamMethod.padStart(8)}` +
        ` ${r.gain.toFixed(3).padStart(6)}` +
        ` ${r.measuredDb.toFixed(1).padStart(6)}` +
        ` ${r.appliedDb.toFixed(1).padStart(7)} dB` +
        ` ${Math.round(r.centroidHz).toString().padStart(6)} Hz` +
        ` ${Math.round(r.torqueFtLb).toString().padStart(6)}` +
        ` ${Math.round(r.hottestK).toString().padStart(6)} K`,
    )
  }

  console.log('')
  console.log('Combien de prises ?')
  console.log('Écartement              prises  rapport   vitesse de lecture   erreur de timbre')
  for (const s of spacings) {
    console.log(
      `${s.label.padEnd(22)} ${String(s.takes).padStart(6)}` +
        ` ${s.ratio.toFixed(3).padStart(8)}` +
        `   ${s.low.toFixed(2)} à ${s.high.toFixed(2)}`.padEnd(22) +
        ` ${s.timbre.worst.toFixed(2).padStart(6)} demi-tons`,
    )
  }

  const bankTakes = results.filter((r) => r.purpose === 'bank')
  const worstSeam = bankTakes.reduce((top, r) => Math.max(top, r.playedSeam), 0)
  console.log('')
  console.log(`Banque écrite dans ${bankDir} — ${bankTakes.length} fichiers`)
  console.log(`Profil : ${join(bankDir, 'profil.json')} — à importer dans l'application`)
  console.log(`Saut d'énergie au bouclage, une fois joué : ${(worstSeam * 100).toFixed(2)} % au pire`)
  console.log(`Génération : ${totalSeconds.toFixed(0)} s pour ${plan.takes.length} prises`)
}

main().catch((error) => fail(error.stack ?? String(error)))
