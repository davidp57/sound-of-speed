#!/usr/bin/env node
/**
 * Niveau joué de chaque banque livrée, et ce qu'il faut pour les aligner.
 *
 *   npm run niveau-banques
 *   npm run niveau-banques -- --reference gm-ls --ecrire
 *
 * David, le 17 septembre 2026 : « les profils L4 et L6 ont un volume
 * audiblement plus faible que les V8 ». Ce n'étaient pas les prises — mesurées
 * sur les fichiers, les banques à un seul banc de cylindres sont même plus
 * fortes. Ce sont les **gains du profil** : le générateur normalise à
 * l'intérieur d'une banque, chaque banque prenant pour référence sa propre
 * prise la plus forte (`scripts/generate-bank/generate.mjs`). Rien ne rapporte
 * deux banques l'une à l'autre.
 *
 * **Ce que ce script mesure.** Le niveau qui sort vraiment, à régime et charge
 * comparables :
 *
 * 1. le niveau efficace de chaque fichier, décodé par ffmpeg ;
 * 2. les gains que le mixage pose à un régime et une charge donnés — par
 *    `computeMix`, le vrai code du cœur, et non une formule recopiée ;
 * 3. la somme en puissance des couches audibles, deux prises d'un même moteur
 *    n'étant pas en phase ;
 * 4. la moyenne en énergie sur une grille de régimes, pied levé et pleine
 *    charge.
 *
 * Le niveau efficace, et non le pic : les fichiers sont déjà tous normalisés au
 * même pic, et c'est bien le niveau perçu qui diffère — un V8 n'a pas le facteur
 * de crête d'un quatre cylindres.
 *
 * `--ecrire` applique le correctif : il multiplie les gains des couches dans les
 * deux copies du profil de banque — celle du cœur (`core/preset/`) et celle qui
 * part avec les échantillons (`public/audio/`) —, que `banques-livrees.test.ts`
 * vérifie identiques.
 *
 * Demande ffmpeg sur le chemin, et Node 22.18 ou plus récent, qui exécute le
 * TypeScript directement.
 */

import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ICI = dirname(fileURLToPath(import.meta.url))
const RACINE = resolve(ICI, '..', '..')

/**
 * Le cœur, tel que le navigateur l'exécute.
 *
 * Node ne charge pas directement des modules TypeScript qui s'importent sans
 * extension : esbuild en fait un paquet, comme pour le banc d'analyse du son.
 */
function chargerLeProjet() {
  const dossier = mkdtempSync(join(tmpdir(), 'speed-niveau-'))
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
  return {
    paquet: pathToFileURL(paquet).href,
    nettoyer: () => rmSync(dossier, { recursive: true, force: true }),
  }
}

const { paquet, nettoyer } = chargerLeProjet()
const { computeMix, createFactoryProfiles } = await import(paquet)
nettoyer()

/**
 * Régimes où l'on compare, en tours par minute.
 *
 * De 1 000 au rupteur le plus bas des quatre banques : au-delà, une banque
 * serait comparée à une autre qui n'a plus de prise et étire la sienne. Le
 * ralenti est hors de la grille — il a son propre réglage de niveau, et c'est
 * un autre sujet.
 */
const REGIMES = [1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000]

/**
 * Les charges où l'on compare.
 *
 * Les deux extrêmes par défaut, à parts égales. `--charge` n'en garde qu'une :
 * c'est le contrôle de robustesse du chiffre, le mixage ne faisant pas entendre
 * les mêmes couches pied levé et pleine charge.
 */
const CHARGES = [0, 1]

function option(nom, defaut) {
  const index = process.argv.indexOf(`--${nom}`)
  if (index === -1) return defaut
  const valeur = process.argv[index + 1]
  return valeur === undefined || valeur.startsWith('--') ? true : valeur
}

function toDb(ratio) {
  return 20 * Math.log10(Math.max(ratio, 1e-12))
}

/**
 * Niveau efficace d'un fichier audio, tous canaux confondus.
 *
 * ffmpeg décode en flottants 32 bits mono : c'est ce que le navigateur donnera
 * aussi au moteur audio, qui mélange les canaux.
 */
function mesurerLeFichier(chemin) {
  const pcm = execFileSync(
    'ffmpeg',
    ['-v', 'error', '-i', chemin, '-ac', '1', '-f', 'f32le', '-'],
    { maxBuffer: 1 << 30 },
  )
  const echantillons = new Float32Array(
    pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.byteLength),
  )
  let somme = 0
  let crete = 0
  for (const valeur of echantillons) {
    somme += valeur * valeur
    if (Math.abs(valeur) > crete) crete = Math.abs(valeur)
  }
  return { rms: Math.sqrt(somme / Math.max(1, echantillons.length)), crete }
}

/** L'état moteur que le mixage lit, réduit à ce dont il se sert. */
function etat(profil, rpm, charge) {
  const rupteur = profil.engine.redlineRpm
  return {
    rpm,
    audibleRpm: rpm,
    kinematicRpm: rpm,
    load: charge,
    effort: charge,
    rpmFraction: rpm / rupteur,
    firingHz: (rpm / 60) * (profil.engine.cylinders / 2),
    limiterActive: false,
    idling: false,
  }
}

/**
 * Niveau joué d'une banque, en décibels, moyenné en énergie sur la grille.
 *
 * Les couches se somment en puissance : ce sont des extraits distincts d'un même
 * moteur, décorrélés, et leurs phases sont d'ailleurs tirées au sort au
 * démarrage pour qu'elles ne se renforcent pas.
 */
function niveauJoue(profil, fichiers) {
  let energie = 0
  let points = 0
  let crete = 0
  for (const rpm of REGIMES) {
    for (const charge of charges) {
      const mix = computeMix(profil, etat(profil, rpm, charge))
      let puissance = 0
      let sommeDesCretes = 0
      for (const couche of mix.layers) {
        const mesure = fichiers.get(couche.file)
        if (mesure === undefined) continue
        const niveau = couche.gain * mesure.rms
        puissance += niveau * niveau
        sommeDesCretes += couche.gain * mesure.crete
      }
      energie += puissance
      if (sommeDesCretes > crete) crete = sommeDesCretes
      points += 1
    }
  }
  // La crête est le pire cas : toutes les couches en phase au même instant. Elle
  // ne se produit pas — les phases sont tirées au sort — mais elle se compare
  // d'une banque à l'autre, et c'est ce qu'on lui demande. Elle est donnée telle
  // qu'elle est, gains actuels : après `--ecrire`, c'est le second passage qui
  // dit ce que la correction a fait.
  return { db: toDb(Math.sqrt(energie / Math.max(1, points))), creteDb: toDb(crete) }
}

/** Réécrit les gains d'un profil de banque, dans les deux copies du dépôt. */
function ecrireLesGains(sampleDir, facteur) {
  const copies = [
    join(RACINE, 'src/core/preset', `${sampleDir}-profile.json`),
    join(RACINE, 'public/audio', sampleDir, 'profil.json'),
  ]
  for (const chemin of copies) {
    const profil = JSON.parse(readFileSync(chemin, 'utf-8'))
    profil.layers = profil.layers.map((couche) => ({
      ...couche,
      gain: Number((couche.gain * facteur).toFixed(4)),
    }))
    writeFileSync(chemin, `${JSON.stringify(profil, null, 2)}\n`, 'utf-8')
  }
}

const charges = option('charge', null) === null ? CHARGES : [Number(option('charge', 1))]
const reference = option('reference', 'gm-ls')
const ecrire = option('ecrire', false) === true

const profils = createFactoryProfiles()
const mesures = []

for (const profil of profils) {
  const fichiers = new Map()
  for (const couche of profil.layers) {
    if (!couche.enabled || couche.file === '') continue
    if (fichiers.has(couche.file)) continue
    fichiers.set(
      couche.file,
      mesurerLeFichier(join(RACINE, 'public/audio', profil.sampleDir, couche.file)),
    )
  }
  const rms = [...fichiers.values()].map((m) => m.rms)
  const joue = niveauJoue(profil, fichiers)
  mesures.push({
    profil,
    banque: profil.sampleDir,
    fichiersDb: toDb(Math.sqrt(rms.reduce((somme, v) => somme + v * v, 0) / Math.max(1, rms.length))),
    joueDb: joue.db,
    creteDb: joue.creteDb,
  })
}

const cible = mesures.find((m) => m.banque === reference)
if (cible === undefined) {
  console.error(`Banque de référence inconnue : ${reference}`)
  process.exit(1)
}

console.log(`Référence : ${cible.banque}`)
console.log('')
console.log('Banque                 fichiers    joué   crête    écart   facteur')
for (const mesure of mesures) {
  const ecart = mesure.joueDb - cible.joueDb
  const facteur = Math.pow(10, -ecart / 20)
  console.log(
    `${mesure.banque.padEnd(20)} ${mesure.fichiersDb.toFixed(1).padStart(8)} ${mesure.joueDb
      .toFixed(1)
      .padStart(7)} ${mesure.creteDb.toFixed(1).padStart(7)} ${ecart
      .toFixed(1)
      .padStart(8)} ${facteur.toFixed(3).padStart(9)}`,
  )
}

if (ecrire) {
  console.log('')
  for (const mesure of mesures) {
    const facteur = Math.pow(10, -(mesure.joueDb - cible.joueDb) / 20)
    // Un décibel de seuil : en dessous, l'écart ne s'entend pas comme un écart
    // de volume, et toucher les gains d'un profil déjà jugé à l'oreille coûterait
    // plus que ce qu'il rendrait.
    if (Math.abs(toDb(facteur)) < 1) {
      console.log(`${mesure.banque} : déjà au niveau, inchangé`)
      continue
    }
    ecrireLesGains(mesure.banque, facteur)
    console.log(`${mesure.banque} : gains multipliés par ${facteur.toFixed(3)}`)
  }
}
