import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import bcrypt from 'bcryptjs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { coupleDe, lireComptes } from './comptes'

let dossier: string

beforeEach(() => {
  dossier = mkdtempSync(join(tmpdir(), 'comptes-'))
})

afterEach(() => {
  try {
    rmSync(dossier, { recursive: true, force: true })
  } catch {
    // Le ménage n'est pas ce qu'on vérifie.
  }
})

function fichierAvec(lignes: string): string {
  const chemin = join(dossier, 'htpasswd')
  writeFileSync(chemin, lignes, 'utf8')
  return chemin
}

/** Une empreinte au format que les outils htpasswd écrivent. */
function empreinte(motDePasse: string): string {
  return bcrypt.hashSync(motDePasse, 4).replace(/^[$]2[abxy][$]/, '$2y$')
}

describe('le fichier de mots de passe', () => {
  it('accepte le bon couple et refuse les autres', () => {
    const comptes = lireComptes(fichierAvec(`david:${empreinte('secret')}\n`))

    expect(comptes.verifie('david', 'secret')).toBe(true)
    expect(comptes.verifie('david', 'autre chose')).toBe(false)
    expect(comptes.verifie('quelquun', 'secret')).toBe(false)
  })

  it('lit les variantes d’empreinte que les outils écrivent', () => {
    // `$2a$`, `$2b$` et `$2y$` désignent le même algorithme ; seul le préfixe
    // diffère, et il a changé au fil des versions de la bibliothèque.
    const brute = bcrypt.hashSync('secret', 4)
    for (const prefixe of ['$2a$', '$2b$', '$2y$']) {
      const comptes = lireComptes(
        fichierAvec(`david:${brute.replace(/^[$]2[abxy][$]/, prefixe)}\n`),
      )
      expect(comptes.verifie('david', 'secret'), prefixe).toBe(true)
    }
  })

  it('tient plusieurs comptes, et ignore les lignes vides ou commentées', () => {
    const comptes = lireComptes(
      fichierAvec(`# un commentaire\ndavid:${empreinte('un')}\n\nmarie:${empreinte('deux')}\n`),
    )

    expect(comptes.verifie('david', 'un')).toBe(true)
    expect(comptes.verifie('marie', 'deux')).toBe(true)
    expect(comptes.configure).toBe(true)
  })

  it('refuse tout quand le fichier manque, sans se plaindre', () => {
    // Un fichier absent n'est pas une panne : c'est une installation qui n'a pas
    // encore de compte. Tout ce qui en demande un est alors refusé — le
    // comportement sûr, et celui du serveur d'avant.
    const comptes = lireComptes(join(dossier, 'jamais-ecrit'))

    expect(comptes.configure).toBe(false)
    expect(comptes.verifie('david', 'secret')).toBe(false)
  })

  it('refuse une empreinte qu’il ne sait pas lire', () => {
    // On ne laisse pas entrer parce qu'on n'a pas compris.
    const comptes = lireComptes(fichierAvec('david:pas-une-empreinte\n'))

    expect(comptes.verifie('david', 'secret')).toBe(false)
  })
})

describe('l’en-tête d’authentification', () => {
  it('rend le couple qu’il porte', () => {
    const entete = `Basic ${Buffer.from('david:secret', 'utf8').toString('base64')}`

    expect(coupleDe(entete)).toEqual({ utilisateur: 'david', motDePasse: 'secret' })
  })

  it('garde un mot de passe qui contient un deux-points', () => {
    const entete = `Basic ${Buffer.from('david:a:b:c', 'utf8').toString('base64')}`

    expect(coupleDe(entete)?.motDePasse).toBe('a:b:c')
  })

  it('lit les caractères accentués', () => {
    // L'application compose son en-tête en UTF-8 : le lire autrement refuserait
    // un mot de passe pourtant juste.
    const entete = `Basic ${Buffer.from('david:é-à-ü', 'utf8').toString('base64')}`

    expect(coupleDe(entete)?.motDePasse).toBe('é-à-ü')
  })

  it('rend rien sur ce qui n’est pas un « Basic » lisible', () => {
    expect(coupleDe(null)).toBeNull()
    expect(coupleDe('Bearer abc')).toBeNull()
    expect(coupleDe('Basic sans-deux-points')).toBeNull()
  })
})
