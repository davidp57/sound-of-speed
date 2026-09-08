#!/usr/bin/env node
/**
 * Analyse le son de la synthèse, **tel qu'il sort**, hors du navigateur.
 *
 *   npm run analyse-son -- --moteur chevrolet-454 --rpm 800
 *   npm run analyse-son -- --profil ~/mon-profil.json --rpm 800
 *   npm run analyse-son -- --moteur gm-ls --delissage 0 --derive 1.5
 *
 * `--profil` prend un profil **exporté depuis l'application**, et c'est le seul
 * moyen de mesurer ce qu'un utilisateur entend vraiment : un moteur de la
 * bibliothèque est un point de départ, pas ce qu'on écoute après l'avoir réglé.
 *
 * Ce que l'outil ajoute au banc qui existait : la **chaîne de sortie**. Jusqu'au
 * 8 septembre 2026, toute mesure de timbre portait sur le signal que le
 * WebAssembly produit, c'est-à-dire trois étages avant le haut-parleur — sans le
 * silencieux ni la résonance d'échappement. Une mesure a alors conclu qu'ouvrir
 * le papillon faisait baisser la bande de 1,4 kHz pendant que David entendait
 * l'inverse. Il avait raison : ce n'était pas le même son.
 *
 * Il rend deux analyses, et la seconde est celle qui cherche les parasites que
 * David décrit comme des « frt frt frt » — un bruit granuleux, plus aigu que le
 * moteur :
 *
 * - le **spectre par bandes**, en niveau absolu, pour voir où l'énergie se
 *   trouve ;
 * - le **grain de l'aigu**, qui ne regarde pas les fréquences du son mais la
 *   façon dont son énergie haute arrive : régulièrement, ou par salves. Un
 *   « frt frt frt » est de l'aigu intermittent, et il se noie dans un spectre
 *   moyen.
 *
 * Les définitions de moteur et les réglages de rendu viennent du projet
 * lui-même, par `pont.ts` : rien n'est recopié, donc rien ne peut diverger.
 */

import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { fileURLToPath } from 'node:url'

import { chaineDeSortie, fft } from './chaine.mjs'
import { readWav } from '../generate-bank/wav.mjs'

const ICI = dirname(fileURLToPath(import.meta.url))
const RACINE = resolve(ICI, '..', '..')

const TAUX = 48000
const BLOC = 1024

function argument(nom, defaut) {
  const i = process.argv.indexOf(`--${nom}`)
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : defaut
}

/**
 * Charge ce que le projet sait du moteur et du rendu.
 *
 * Node ne résout pas les imports TypeScript sans extension ; esbuild en fait un
 * paquet, le temps de l'analyse.
 */
async function chargerLeProjet() {
  const dossier = mkdtempSync(join(tmpdir(), 'speed-analyse-'))
  const paquet = join(dossier, 'pont.mjs')
  execFileSync(
    process.execPath,
    [
      join(RACINE, 'node_modules', 'esbuild', 'bin', 'esbuild'),
      join(ICI, 'pont.ts'),
      '--bundle',
      '--format=esm',
      '--platform=node',
      `--outfile=${paquet}`,
      '--log-level=error',
    ],
    { cwd: RACINE },
  )
  const module = await import(pathToFileURL(paquet).href)
  return { module, nettoyer: () => rmSync(dossier, { recursive: true, force: true }) }
}

/** Le son sec, tel que le WebAssembly le produit. */
async function rendre(projet, options) {
  const { default: init } = await import(
    pathToFileURL(join(RACINE, 'public', 'sonde', 'probe.mjs')).href
  )
  const core = await init({ noInitialRun: true })
  const lier = (nom, retour, args) => core.cwrap(nom, retour, args)

  const setRig = lier('synth_set_rig', null, ['number', 'number', 'number', 'number', 'number', 'number'])
  const createFrom = lier('synth_create_from', 'number', ['number', 'number'])
  const setTarget = lier('synth_set_target', null, ['number', 'number'])
  const setThrottle = lier('synth_set_throttle_range', null, ['number', 'number'])
  const setVolume = lier('synth_set_volume', null, ['number'])
  const setRipple = lier('synth_set_ripple', null, ['number', 'number'])
  const render = lier('synth_render', 'number', ['number', 'number'])
  const rpmRipple = lier('synth_rpm_ripple', 'number', [])
  const rpmReset = lier('synth_rpm_window_reset', null, [])

  const { rendu, reglages, valeurs, rpm, effort } = options
  setRig(reglages.simulationHz, TAUX, reglages.impulseSamples, reglages.leveler ? 1 : 0,
    reglages.levelerGain, reglages.levelerTarget)

  const defPtr = core._malloc(valeurs.length * 8)
  core.HEAPF64.set(Float64Array.from(valeurs), defPtr >> 3)
  if (!createFrom(defPtr, valeurs.length)) throw new Error('le moteur ne s’est pas construit')

  setThrottle(rendu.throttleIdle, rendu.throttleFull)
  setVolume(reglages.volume)
  setRipple(reglages.rippleRpm, reglages.rippleHz)
  setTarget(rpm, effort)

  const buf = core._malloc(BLOC * 4)
  // Rodage : les chambres partent à la pression atmosphérique, et le régime doit
  // s'établir avant qu'on mesure quoi que ce soit.
  for (let i = 0; i < Math.round((2 * TAUX) / BLOC); i += 1) render(buf, BLOC)
  // La fenêtre de mesure s'ouvre après le rodage : sinon l'ondulation rapportée
  // serait celle du démarrage, où le régime monte de zéro à son ralenti.
  rpmReset()

  const blocs = Math.round((options.secondes * TAUX) / BLOC)
  const sec = new Float32Array(blocs * BLOC)
  let ecretes = 0
  for (let i = 0; i < blocs; i += 1) {
    render(buf, BLOC)
    const vue = core.HEAPF32.subarray(buf >> 2, (buf >> 2) + BLOC)
    for (let k = 0; k < BLOC; k += 1) if (Math.abs(vue[k]) >= 0.999) ecretes += 1
    sec.set(vue, i * BLOC)
  }
  core._free(buf)
  core._free(defPtr)
  return { sec, ecretes: (100 * ecretes) / sec.length, ondulation: rpmRipple() }
}

/** Niveaux par bande, en décibels, sur une fenêtre de Hann. */
function bandes(signal, centres) {
  const N = 32768
  const re = new Float64Array(N)
  const im = new Float64Array(N)
  for (let i = 0; i < N && i < signal.length; i += 1) {
    re[i] = signal[i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)))
  }
  fft(re, im)
  const binHz = TAUX / N
  return centres.map((f) => {
    const bas = Math.max(1, Math.floor(f / 1.122 / binHz))
    const haut = Math.min(N / 2 - 1, Math.ceil((f * 1.122) / binHz))
    let energie = 0
    for (let i = bas; i <= haut; i += 1) energie += re[i] * re[i] + im[i] * im[i]
    return 10 * Math.log10(energie + 1e-20)
  })
}

/**
 * Le grain de l'aigu : l'énergie haute arrive-t-elle par salves ?
 *
 * Un « frt frt frt » n'est pas une fréquence, c'est de l'aigu **intermittent**.
 * Il ne se voit donc ni dans le spectre moyen, où il se noie, ni dans
 * l'enveloppe du signal entier, que le grave domine. On isole la bande haute,
 * puis on regarde comment son énergie varie d'une tranche de dix millisecondes
 * à l'autre.
 *
 * Deux chiffres en sortent. Le **rapport crête sur moyenne** dit si l'aigu
 * arrive par bouffées — au-delà de trois, ce ne sont plus des variations, ce
 * sont des salves. La **cadence** dit à quel rythme, et la comparer à la
 * fréquence d'allumage dit si le moteur en est la cause ou non.
 */
function grainAigu(signal, basHz = 2000) {
  // Passe-haut du premier ordre : on ne garde que ce qui est au-dessus.
  const coef = Math.exp((-2 * Math.PI * basHz) / TAUX)
  const haut = new Float32Array(signal.length)
  let etat = 0
  let precedent = 0
  for (let i = 0; i < signal.length; i += 1) {
    etat = coef * (etat + signal[i] - precedent)
    precedent = signal[i]
    haut[i] = etat
  }

  const tranche = Math.round(TAUX / 100)
  const compte = Math.floor(haut.length / tranche)
  const niveaux = new Float64Array(compte)
  for (let t = 0; t < compte; t += 1) {
    let energie = 0
    for (let i = 0; i < tranche; i += 1) {
      const v = haut[t * tranche + i]
      energie += v * v
    }
    niveaux[t] = Math.sqrt(energie / tranche)
  }

  let moyenne = 0
  let crete = 0
  for (let t = 0; t < compte; t += 1) {
    moyenne += niveaux[t]
    if (niveaux[t] > crete) crete = niveaux[t]
  }
  moyenne /= compte

  // La cadence des salves : transformée de la suite des niveaux, dont le pas est
  // de dix millisecondes — on voit donc jusqu'à cinquante hertz.
  const N = 1024
  const re = new Float64Array(N)
  const im = new Float64Array(N)
  for (let i = 0; i < N && i < compte; i += 1) {
    re[i] = (niveaux[i] - moyenne) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)))
  }
  fft(re, im)
  // Le pas des tranches vaut dix millisecondes, donc la suite est échantillonnée
  // à cent hertz : la raie d'indice i tombe sur i × 100 / N.
  let meilleur = 0
  let cadence = 0
  for (let i = 1; i < N / 2; i += 1) {
    const force = Math.hypot(re[i], im[i])
    if (force > meilleur) {
      meilleur = force
      cadence = (i * 100) / N
    }
  }
  return { creteSurMoyenne: moyenne > 0 ? crete / moyenne : 0, cadenceHz: cadence }
}

const CENTRES = [125, 250, 500, 1000, 1400, 2000, 2800, 4000, 5600, 8000]

async function main() {
  const { module, nettoyer } = await chargerLeProjet()
  try {
    const chemin = argument('profil', null)
    const id = argument('moteur', 'chevrolet-454')
    const rpm = Number(argument('rpm', 800))
    const effort = Number(argument('effort', 0))
    const secondes = Number(argument('secondes', 2))
    const delissage = argument('delissage', null)
    const crete = argument('crete', null)
    const derive = argument('derive', null)

    let moteur
    if (chemin) {
      const fichier = JSON.parse(readFileSync(resolve(chemin), 'utf8'))
      const profil = fichier.profile ?? fichier
      if (!profil.engineDefinition) {
        console.error('Ce profil ne porte pas de définition de moteur.')
        process.exitCode = 1
        return
      }
      moteur = {
        label: `${profil.name ?? 'profil'} (exporté)`,
        definition: profil.engineDefinition,
        redlineRpm: profil.engine?.redlineRpm ?? 6500,
        rendering: { ...module.DEFAULT_RENDERING, ...(profil.rendering ?? {}) },
      }
    } else {
      moteur = module.libraryEngine(id)
      if (!moteur) {
        console.error(`Moteur inconnu : ${id}`)
        console.error(`Connus : ${module.ENGINE_LIBRARY.map((e) => e.id).join(', ')}`)
        process.exitCode = 1
        return
      }
    }

    const rendu = moteur.rendering
    const reglages = { ...module.DEFAULT_SYNTH, ...rendu }
    if (crete !== null) reglages.levelerTarget = Number(crete)
    if (delissage !== null) reglages.rippleRpm = Number(delissage)
    if (derive !== null) reglages.rippleHz = Number(derive)
    const valeurs = module.engineDefinitionValues(moteur.definition, moteur.redlineRpm)

    const { sec, ecretes, ondulation } = await rendre(module, {
      rendu, reglages, valeurs, rpm, effort, secondes,
    })

    const fichier = module.exhaustResponseFile(rendu.exhaustResponse)
    let reponse = null
    if (fichier) {
      const octets = readFileSync(join(RACINE, 'public', 'impulse', fichier))
      reponse = readWav(new Uint8Array(octets)).samples
    }
    const sortie = chaineDeSortie(sec, {
      mufflerHz: rendu.mufflerHz,
      convolverMix: rendu.convolver ? rendu.convolverMix : 0,
      reponse,
      tauxHz: TAUX,
      loadOpeningRatio: rendu.loadOpeningRatio ?? 0,
      effort,
    })

    console.log(`\n${moteur.label} — ${rpm} tr/min, effort ${effort}`)
    console.log(
      `Échappement « ${rendu.exhaustResponse} », résonance ${rendu.convolverMix}, ` +
        `silencieux ${rendu.mufflerHz} Hz, crête visée ${reglages.levelerTarget}`,
    )
    // Le niveau en sortie, et non celui du son sec : la résonance ajoute une
    // quinzaine de décibels à la bande de 500 Hz, et c'est après elle que le
    // plafond se rencontre.
    let creteSortie = 0
    let butes = 0
    for (let i = 0; i < sortie.length; i += 1) {
      const a = Math.abs(sortie[i])
      if (a > creteSortie) creteSortie = a
      if (a >= 1) butes += 1
    }
    console.log(
      `Ondulation du régime ${ondulation.toFixed(1)} tr/min, ` +
        `écrêtage ${ecretes.toFixed(2)} % sur le son sec`,
    )
    console.log(
      `Crête en sortie de chaîne ${creteSortie.toFixed(3)} — ` +
        `${((100 * butes) / sortie.length).toFixed(2)} % au-delà du plafond\n`,
    )

    const avant = bandes(sec, CENTRES)
    const apres = bandes(sortie, CENTRES)
    console.log('Niveaux par bande, en dB')
    console.log('             ' + CENTRES.map((f) => String(f).padStart(7)).join(''))
    console.log('son sec      ' + avant.map((v) => v.toFixed(1).padStart(7)).join(''))
    console.log('en sortie    ' + apres.map((v) => v.toFixed(1).padStart(7)).join(''))
    console.log(
      'écart        ' + apres.map((v, i) => (v - avant[i]).toFixed(1).padStart(7)).join(''),
    )

    const allumageHz = (rpm / 60) * (moteur.definition.cylinders / 2)
    console.log(`
Grain de l'aigu — allumage à ${allumageHz.toFixed(1)} Hz`)
    for (const bas of [800, 1200, 2000, 4000]) {
      const g = grainAigu(sortie, bas)
      const verdict = g.creteSurMoyenne > 3 ? 'par salves' : 'régulier'
      console.log(
        `  au-dessus de ${String(bas).padStart(4)} Hz : crête/moyenne ` +
          `${g.creteSurMoyenne.toFixed(1)} (${verdict}), cadence ${g.cadenceHz.toFixed(1)} Hz`,
      )
    }
    console.log('')
  } finally {
    nettoyer()
  }
}

await main()
