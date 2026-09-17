#!/usr/bin/env node
/**
 * Retire d'une banque les composantes qui ne sont pas des harmoniques
 * d'allumage, dans la bande où elles s'entendent.
 *
 *   node scripts/adoucir-banque.mjs gm-ls gm-ls-adouci
 *
 * ## Ce que ça corrige, et pourquoi c'est une question et pas une évidence
 *
 * Un moteur à quatre temps dont les cylindres sonnent tous pareil ne produit
 * que des multiples de sa cadence d'explosion. Mesuré le 17 septembre 2026, les
 * deux banques de V8 portent, **au niveau de l'allumage lui-même**, des
 * composantes qui n'en sont pas des multiples ; le six en ligne et le quatre à
 * plat sont 30 à 70 dB en dessous. C'est ce que David entend comme des
 * « fréquences parasites, surtout à moyen régime ».
 *
 * Un V8 américain **sonne** ainsi : ses explosions ne sont pas régulièrement
 * espacées à l'intérieur d'une rangée de cylindres, et c'est de là que vient son
 * grondement. Retirer ces composantes peut donc aussi bien nettoyer un défaut
 * que retirer sa signature au moteur. Cet outil existe pour **faire écouter les
 * deux**, pas pour trancher.
 *
 * ## Comment
 *
 * Un moyennage circulaire sur un cycle moteur. Décaler le signal d'une période
 * d'allumage et moyenner autant de fois qu'il y a de cylindres, c'est rendre
 * toutes les explosions du cycle identiques : ce qui se répète à chaque
 * explosion survit intact, ce qui ne revient qu'une fois par cycle s'annule.
 * C'est exactement la frontière que la mesure a trouvée.
 *
 * **Le traitement est borné en fréquence**, et c'est le point délicat. Appliqué
 * partout, ce moyennage rendrait le son rigoureusement périodique à l'échelle du
 * cycle — il retirerait aussi le grain de turbulence, que le projet a passé du
 * temps à obtenir. On ne garde donc sa correction que dans la bande où les
 * parasites dominent, relevée entre 410 et 465 Hz selon la prise ; le reste du
 * spectre sort intact.
 *
 * La période se prend du **régime mesuré**, lu dans `mesures.json` — pas du nom
 * du fichier, qui est arrondi. Une erreur d'un pour cent sur la période déplace
 * les zéros du peigne et laisse passer ce qu'on voulait retirer.
 */

import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { readWav, writeWav } from './generate-bank/wav.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')

/**
 * Bande où le traitement agit, en hertz.
 *
 * Bornée d'abord à 250–900 Hz, autour des raies les plus fortes ; mesuré après
 * coup, les parasites restants tombaient **juste de part et d'autre** — 175 et
 * 239 Hz d'un côté, 930 et 1 009 Hz de l'autre. La bande couvre donc maintenant
 * tout le domaine où le moteur porte son timbre. Au-delà, le souffle et le grain
 * sortent intacts : ce sont eux qui empêchent le son de devenir synthétique.
 */
const BANDE_HZ = [120, 1200]

/**
 * Dosage, de 0 à 1, dans la bande.
 *
 * À un, la correction est entière : ce qui n'est pas harmonique d'allumage
 * disparaît de la bande. C'est le réglage livré, parce que l'objet est
 * d'entendre ce que le moteur donne **sans** ces composantes — un demi-effet ne
 * tranche rien.
 */
const DOSAGE = 1

/** FFT radix-2 en place. */
function fft(re, im, inverse = false) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = ((inverse ? 2 : -2) * Math.PI) / len
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k += 1) {
        const wr = Math.cos(angle * k)
        const wi = Math.sin(angle * k)
        const ur = re[i + k]
        const ui = im[i + k]
        const vr = re[i + k + len / 2] * wr - im[i + k + len / 2] * wi
        const vi = re[i + k + len / 2] * wi + im[i + k + len / 2] * wr
        re[i + k] = ur + vr
        im[i + k] = ui + vi
        re[i + k + len / 2] = ur - vr
        im[i + k + len / 2] = ui - vi
      }
    }
  }
  if (inverse) {
    for (let i = 0; i < n; i += 1) {
      re[i] /= n
      im[i] /= n
    }
  }
}

/**
 * Le signal moyenné sur un cycle moteur, par décalages d'une période d'allumage.
 *
 * Circulaire : ces prises sont des boucles, et c'est ainsi qu'elles se jouent.
 * L'indice de décalage n'est pas entier — une période d'allumage tombe rarement
 * sur un échantillon rond —, d'où l'interpolation entre les deux voisins.
 */
function moyennerSurUnCycle(x, periodeAllumage, cylindres) {
  const n = x.length
  const y = new Float64Array(n)
  for (let i = 0; i < n; i += 1) {
    let somme = 0
    for (let k = 0; k < cylindres; k += 1) {
      const p = i - k * periodeAllumage
      // Le modulo de JavaScript garde le signe : on le ramène dans [0, n[.
      const pos = ((p % n) + n) % n
      const bas = Math.floor(pos)
      const frac = pos - bas
      const a = x[bas] ?? 0
      const b = x[(bas + 1) % n] ?? 0
      somme += a + (b - a) * frac
    }
    y[i] = somme / cylindres
  }
  return y
}

/** Ne garde d'un signal que ce qui tombe dans la bande. */
function garderLaBande(signal, sampleRate, [bas, haut]) {
  let taille = 1
  while (taille < signal.length) taille <<= 1
  const re = new Float64Array(taille)
  const im = new Float64Array(taille)
  re.set(signal)

  fft(re, im)
  const df = sampleRate / taille
  for (let k = 0; k <= taille / 2; k += 1) {
    const hz = k * df
    if (hz >= bas && hz <= haut) continue
    const miroir = k === 0 ? 0 : taille - k
    re[k] = 0
    im[k] = 0
    re[miroir] = 0
    im[miroir] = 0
  }
  fft(re, im, true)
  return re.subarray(0, signal.length)
}

/** Niveau efficace d'un signal. C'est ce que le profil a mesuré, et qu'on rend. */
function niveauEfficace(signal) {
  let somme = 0
  for (let i = 0; i < signal.length; i += 1) somme += signal[i] * signal[i]
  return Math.sqrt(somme / signal.length)
}

function decoder(flac, dossierTemporaire, nom) {
  const wav = join(dossierTemporaire, `${nom}.wav`)
  execFileSync('ffmpeg', ['-v', 'error', '-i', flac, '-ac', '1', '-ar', '44100', '-c:a', 'pcm_s16le', wav, '-y'])
  return readWav(new Uint8Array(readFileSync(wav)))
}

function encoder(octets, dossierTemporaire, nom, sortie) {
  const wav = join(dossierTemporaire, `${nom}-sortie.wav`)
  writeFileSync(wav, Buffer.from(octets))
  execFileSync('ffmpeg', ['-v', 'error', '-i', wav, '-c:a', 'flac', sortie, '-y'])
}

function main() {
  const [source, cible, nomLisible] = process.argv.slice(2)
  if (!source || !cible) {
    console.error('usage : node scripts/adoucir-banque.mjs <banque-source> <banque-cible> [nom affiché]')
    process.exit(1)
  }

  const dossierSource = join(ROOT, 'public', 'audio', source)
  const dossierCible = join(ROOT, 'public', 'audio', cible)
  if (!existsSync(dossierSource)) {
    console.error(`banque introuvable : ${dossierSource}`)
    process.exit(1)
  }
  mkdirSync(dossierCible, { recursive: true })

  const mesures = JSON.parse(readFileSync(join(dossierSource, 'mesures.json'), 'utf8'))
  // `definition` est celle de la banque — le plan de prises ; c'est `engine` qui
  // porte la mécanique, et donc le nombre de cylindres.
  const cylindres = mesures.engine?.definition?.cylinders
  if (typeof cylindres !== 'number') {
    console.error('le nombre de cylindres ne se lit pas dans mesures.json')
    process.exit(1)
  }
  /** Le régime de chaque prise, par nom de fichier. */
  const regimes = new Map(
    (mesures.takes ?? []).map((prise) => [prise.name.replace(/\.wav$/, ''), prise.measuredRpm]),
  )

  const temporaire = mkdtempSync(join(tmpdir(), 'adoucir-'))
  try {
    for (const entree of readdirSync(dossierSource)) {
      if (entree === 'LISEZMOI.md') {
        // Un LISEZMOI se rédige : celui de la source décrit un moteur et des
        // choix qui ne sont plus ceux de la banque produite. Le recopier
        // ferait mentir le dossier, et personne ne relit un fichier qu'un
        // script a posé.
        console.log('LISEZMOI.md : à écrire à la main, rien n’a été copié')
        continue
      }
      if (entree === 'profil.json') {
        // Le profil désigne sa banque par son dossier : recopié tel quel, il
        // renverrait aux échantillons d'origine et la banque produite ne serait
        // jamais jouée. C'est le test d'import des banques livrées qui l'attrape.
        const profil = JSON.parse(readFileSync(join(dossierSource, entree), 'utf8'))
        profil.sampleDir = cible
        profil.name = nomLisible ?? profil.name
        writeFileSync(join(dossierCible, entree), `${JSON.stringify(profil, null, 2)}
`)
        continue
      }
      if (!entree.endsWith('.flac')) {
        copyFileSync(join(dossierSource, entree), join(dossierCible, entree))
        continue
      }
      const nom = entree.replace(/\.flac$/, '')
      const rpm = regimes.get(nom)
      if (rpm === undefined) {
        console.log(`${nom} : aucun régime mesuré, recopié tel quel`)
        copyFileSync(join(dossierSource, entree), join(dossierCible, entree))
        continue
      }

      const { samples, sampleRate } = decoder(join(dossierSource, entree), temporaire, nom)
      const allumageHz = (rpm / 120) * cylindres
      const periode = sampleRate / allumageHz

      const moyenne = moyennerSurUnCycle(samples, periode, cylindres)
      // Ce que le moyennage retire, et rien d'autre : on le borne à la bande
      // puis on le soustrait. Le reste du spectre sort tel qu'il est entré.
      const retire = new Float64Array(samples.length)
      for (let i = 0; i < samples.length; i += 1) retire[i] = samples[i] - moyenne[i]
      const dansLaBande = garderLaBande(retire, sampleRate, BANDE_HZ)

      const sortie = new Float32Array(samples.length)
      for (let i = 0; i < samples.length; i += 1) {
        sortie[i] = samples[i] - DOSAGE * dansLaBande[i]
      }

      // Chaque prise retrouve son niveau d'origine.
      //
      // Retirer de l'énergie en retire un peu, et pas la même selon la prise :
      // mesuré avant cette correction, de 0,2 à 4,1 dB, soit **quatre décibels
      // d'écart** entre les couches. Or le profil de cette banque porte les gains
      // mesurés sur la banque d'origine : sans renormaliser, le niveau ferait un
      // creux vers 4 800 tr/min et remonterait ensuite. On entendrait une
      // différence de niveau là où l'on veut juger un timbre, et aucun test ne le
      // verrait.
      const avant = niveauEfficace(samples)
      const apres = niveauEfficace(sortie)
      if (apres > 0) {
        const facteur = avant / apres
        let pic = 0
        for (let i = 0; i < sortie.length; i += 1) {
          sortie[i] *= facteur
          const magnitude = Math.abs(sortie[i])
          if (magnitude > pic) pic = magnitude
        }
        // Remonter le niveau peut faire dépasser un pic : on redescend plutôt que
        // d'écrêter, et on le dit — l'écart tenu par le gain de la couche vaut
        // mieux qu'une distorsion muette.
        if (pic > 0.999) {
          const garde = 0.999 / pic
          for (let i = 0; i < sortie.length; i += 1) sortie[i] *= garde
          console.log(`  pic à ${pic.toFixed(3)} : niveau redescendu de ${(-20 * Math.log10(garde)).toFixed(2)} dB`)
        }
      }

      encoder(writeWav(sortie, sampleRate), temporaire, nom, join(dossierCible, entree))
      console.log(`${nom} : ${Math.round(rpm)} tr/min, allumage ${allumageHz.toFixed(1)} Hz`)
    }
  } finally {
    rmSync(temporaire, { recursive: true, force: true })
  }

  console.log(`\nbanque écrite dans public/audio/${cible}`)
}

main()
