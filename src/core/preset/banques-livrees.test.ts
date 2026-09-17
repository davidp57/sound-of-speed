import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  createFactoryProfiles,
  createBmwI6Profile,
  createGmLsAdouciProfile,
  createGmLsLongHeaderProfile,
  createGmLsProfile,
  createSubaruEj25Profile,
} from './defaults'
import { fromFile } from './store'

/**
 * Les banques livrées sont les seules versionnées avec l'application, et elles
 * ont un métier : qu'un dépôt fraîchement cloné fasse du son. Si leur profil
 * cessait de passer l'import, ou désignait des fichiers absents, l'application
 * resterait muette chez celui qui la découvre — et un chargement raté ne se
 * remarque qu'en allant lire la télémétrie.
 *
 * Il y en avait une, la démonstration. Il y en a trois depuis le 14 septembre
 * 2026 : David les a écoutées et les a jugées livrables.
 */
const BANQUES = ['gm-ls', 'gm-ls-long-header', 'gm-ls-adouci', 'bmw-i6-3l', 'subaru-ej25'] as const

describe.each(BANQUES)('la banque livrée %s', (banque) => {
  const profile = fromFile(readFileSync(`public/audio/${banque}/profil.json`, 'utf8'))

  it('passe l’import de l’application', () => {
    expect(profile.sampleDir).toBe(banque)
    expect(profile.soundSource).toBe('prerendered')
    expect(profile.layers.length).toBeGreaterThan(4)
  })

  it('désigne des fichiers qui sont là', () => {
    for (const couche of profile.layers) {
      expect(() => readFileSync(`public/audio/${banque}/${couche.file}`)).not.toThrow()
    }
  })

  it('est en FLAC, sans reste de WAV', () => {
    // Les prises sortent du banc en WAV et sont compressées ensuite. Un profil
    // qui désigne encore des `.wav` est un transcodage à moitié fait : les
    // fichiers sont là, mais ce sont les lourds.
    for (const couche of profile.layers) {
      expect(couche.file).toMatch(/\.flac$/)
    }
  })

  it('couvre les deux familles et le ralenti', () => {
    const roles = new Set(profile.layers.map((couche) => couche.role))
    expect(roles).toContain('on')
    expect(roles).toContain('off')
    expect(roles).toContain('idle')
  })

  it('emporte le moteur qui a fait son son', () => {
    // Les vingt-neuf nombres du contrat, et non la définition de banque : c'est
    // ce qui permet de rejouer la même banque en son direct, et de la refaire.
    expect(profile.engineDefinition?.cylinders).toBe(profile.engine.cylinders)
  })
})

/**
 * Le profil livré et la banque livrée doivent rester d'accord.
 *
 * Ils vivent à deux endroits — la définition avec le code, les échantillons avec
 * les autres échantillons — et rien n'empêche mécaniquement de régénérer l'un
 * sans l'autre. Le jour où ça arrive, l'application démarre sur un profil d'usine
 * qui désigne des fichiers absents : silence, et un message qu'il faut aller
 * chercher en télémétrie.
 */
describe('les profils d’usine', () => {
  it.each([
    ['gm-ls', createGmLsProfile],
    ['gm-ls-long-header', createGmLsLongHeaderProfile],
    ['gm-ls-adouci', createGmLsAdouciProfile],
    ['bmw-i6-3l', createBmwI6Profile],
    ['subaru-ej25', createSubaruEj25Profile],
  ])('%s désigne la banque livrée, fichier par fichier', (banque, creer) => {
    const usine = creer()
    expect(usine.sampleDir).toBe(banque)
    expect(usine.soundSource).toBe('prerendered')
    for (const couche of usine.layers) {
      expect(() => readFileSync(`public/audio/${banque}/${couche.file}`)).not.toThrow()
    }
  })

  it('commence par le V8 croisé, qui est le premier son entendu', () => {
    const livres = createFactoryProfiles()
    expect(livres[0]?.id).toBe('gm-ls')
    expect(livres[0]?.favorite).toBe(true)
    expect(livres.map((p) => p.id)).toEqual([
      'gm-ls',
      'gm-ls-long-header',
      'gm-ls-adouci',
      'bmw-i6-3l',
      'subaru-ej25',
    ])
  })

  it('ne livre que des banques qui sont dans le dépôt', () => {
    // Le profil V8 livré désignait `v8-musclecar`, une prise sur une vraie voiture
    // qu'on n'a pas le droit de redistribuer : il était donc muet chez qui
    // découvrait le projet. Aucun profil livré ne doit plus désigner une banque
    // absente de l'image.
    for (const livre of createFactoryProfiles()) {
      expect(() =>
        readFileSync(`public/audio/${livre.sampleDir}/profil.json`),
      ).not.toThrow()
    }
  })
})

/**
 * Les quatre listes où une banque livrée doit être déclarée.
 *
 * Ajouter une banque au dépôt ne suffit pas à la faire arriver chez qui déploie :
 * elle doit être exceptée dans `.gitignore` pour entrer dans le dépôt, et dans
 * `.dockerignore` pour entrer dans l'image. Le second est le piège, parce que
 * **rien ne rougit quand il manque** — le contrôle qualité passe, les tests
 * passent, l'image se construit, et le serveur rend 404 sur une banque que le
 * dépôt contient pourtant.
 *
 * C'est arrivé le 14 septembre 2026, le commentaire du `.dockerignore` le dit.
 * C'est arrivé **une seconde fois** le 17 septembre avec `gm-ls-adouci` : David a
 * touché le profil, plus de son, et « on-1021.flac : 404 » en bas de l'écran. La
 * vérification de la chaîne d'intégration existait pourtant — mais elle listait
 * les banques en dur, donc elle ignorait la nouvelle.
 *
 * Ces tests sont ce qui manquait : ils partent des profils livrés et vérifient
 * que chaque déclaration suit.
 *
 * **Il y en avait trois, il en fallait quatre.** Écrits sur trois listes, ils
 * ont laissé passer la quatrième — la pile nginx, que j'avais crue morte parce
 * que l'image publiée vient d'ailleurs. La chaîne d'intégration la monte
 * pourtant, et c'est elle qui a rougi. Une garde écrite d'après ce qu'on croit
 * savoir vaut ce que vaut cette croyance.
 */
describe('une banque livrée est déclarée partout où il faut', () => {
  const dossiers = [...new Set(createFactoryProfiles().map((profil) => profil.sampleDir))]

  it('entre dans le dépôt : exceptée dans .gitignore', () => {
    const regles = readFileSync('.gitignore', 'utf8')
    for (const dossier of dossiers) {
      expect(regles).toContain(`!public/audio/${dossier}`)
    }
  })

  it('entre dans l’image : exceptée dans .dockerignore', () => {
    // Le piège : une banque oubliée ici arrive **vide** dans l'image, la
    // construction réussit, et le 404 ne se voit qu'en roulant.
    const regles = readFileSync('.dockerignore', 'utf8')
    for (const dossier of dossiers) {
      expect(regles).toContain(`!public/audio/${dossier}`)
    }
  })

  it('est servie par la pile nginx, qui la nomme un bloc à la fois', () => {
    // Le volume des échantillons se monte **sur** le dossier `audio` de l'image
    // et masque tout ce qu'il contient. nginx ne ramène sous `/audio/` que les
    // banques qu'il nomme, une par une — celle qu'on oublie est invisible, sans
    // que rien ne le signale.
    const conf = readFileSync('docker/nginx.conf', 'utf8')
    for (const dossier of dossiers) {
      expect(conf).toContain(`/audio/${dossier}/`)
      expect(conf).toContain(`_banques/${dossier}/`)
    }
  })

  it('ne déclare sa règle nginx qu’une fois, et la conf reste équilibrée', () => {
    // nginx **refuse de démarrer** sur une règle en double ou une accolade
    // manquante, et le conteneur ne répond alors sur rien. Vu le 17 septembre
    // 2026 : un script d'édition avait recopié un bloc au lieu de le déplacer,
    // rien ne l'a signalé, et la chaîne d'intégration a mis deux minutes à le
    // dire sous la forme d'un port qui ne répond pas. Un fichier de
    // configuration ne passe ni par le typage ni par le style : ce test est tout
    // ce qu'il y a entre lui et la construction de l'image.
    const conf = readFileSync('docker/nginx.conf', 'utf8')

    const regles = [...conf.matchAll(/location \^~ (\/audio\/[a-z0-9-]+\/)/g)].map((m) => m[1])
    expect(regles.length).toBe(new Set(regles).size)

    const sansCommentaires = conf
      .split('\n')
      .map((ligne) => ligne.split('#')[0] ?? '')
      .join('\n')
    let profondeur = 0
    let minimum = 0
    for (const caractere of sansCommentaires) {
      if (caractere === '{') profondeur += 1
      else if (caractere === '}') {
        profondeur -= 1
        minimum = Math.min(minimum, profondeur)
      }
    }
    expect(profondeur).toBe(0)
    expect(minimum).toBe(0)
  })

  it('est vérifiée par la chaîne d’intégration', () => {
    // La chaîne monte l'image et demande chaque banque : c'est la seule preuve
    // qu'elle est servie malgré le montage du volume d'échantillons. Une liste
    // en dur qui oublie une banque rend cette preuve muette.
    const workflow = readFileSync('.github/workflows/docker.yml', 'utf8')
    const ligne = workflow.split('\n').find((texte) => texte.includes('for banque in'))
    expect(ligne).toBeDefined()
    for (const dossier of dossiers) {
      expect(ligne).toContain(dossier)
    }
  })
})
