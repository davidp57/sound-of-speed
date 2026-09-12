/**
 * L'authentification, reprise telle quelle.
 *
 * Un fichier de mots de passe, un en-tête « Basic », et deux codes qui portent
 * du sens. Rien de neuf : le remplacer fait l'objet du lot COMPTES, et le
 * toucher maintenant reviendrait à démêler l'identité pendant qu'on déplace les
 * données.
 *
 * **Ce que la sémantique des codes engage.** Le client traite 401 et 403 comme
 * des refus **non rejouables** : il abandonne l'envoi et prévient. Tout autre
 * code le fait réessayer, indéfiniment s'il le faut, parce qu'il suppose une
 * panne passagère. Rendre 500 là où il fallait 401 transforme donc un mot de
 * passe faux en une voiture qui rejoue son dépôt toutes les minutes.
 *
 * **Et une page dépose hors de l'application** : la sonde relit le compte dans
 * le stockage du navigateur et compose son propre en-tête. Elle n'apparaît dans
 * aucun écran, et personne ne la verra casser.
 */

import { readFileSync } from 'node:fs'

import bcrypt from 'bcryptjs'

export interface Comptes {
  /** Vrai si ce couple ouvre les dossiers protégés. */
  verifie: (utilisateur: string, motDePasse: string) => boolean
  /** Faux quand aucun compte n'est configuré : tout est alors refusé. */
  configure: boolean
}

/**
 * Lit un fichier de mots de passe au format htpasswd.
 *
 * Un fichier absent n'est pas une panne : c'est une installation qui n'a pas
 * encore de compte. Tout ce qui en demande un est alors refusé — ce qui est le
 * comportement sûr, et ce que faisait déjà le serveur d'avant.
 */
export function lireComptes(fichier: string | undefined): Comptes {
  const empreintes = new Map<string, string>()

  if (fichier !== undefined) {
    let contenu: string
    try {
      contenu = readFileSync(fichier, 'utf8')
    } catch {
      return { verifie: () => false, configure: false }
    }

    for (const ligne of contenu.split(/\r?\n/)) {
      if (ligne.trim() === '' || ligne.startsWith('#')) continue
      const separateur = ligne.indexOf(':')
      if (separateur <= 0) continue
      empreintes.set(ligne.slice(0, separateur), ligne.slice(separateur + 1))
    }
  }

  return {
    configure: empreintes.size > 0,
    verifie: (utilisateur, motDePasse) => {
      const empreinte = empreintes.get(utilisateur)
      if (empreinte === undefined) return false
      try {
        return bcrypt.compareSync(motDePasse, empreinte)
      } catch {
        // Une empreinte d'un format qu'on ne sait pas lire vaut un refus, pas
        // une erreur : on ne laisse pas entrer parce qu'on n'a pas compris.
        return false
      }
    },
  }
}

/** Lit un en-tête « Authorization », et rend le couple s'il y en a un. */
export function coupleDe(entete: string | null): { utilisateur: string; motDePasse: string } | null {
  if (entete === null) return null

  const lu = /^Basic\s+(.+)$/i.exec(entete.trim())
  if (lu === null) return null

  let decode: string
  try {
    decode = Buffer.from(lu[1] ?? '', 'base64').toString('utf8')
  } catch {
    return null
  }

  const separateur = decode.indexOf(':')
  if (separateur < 0) return null

  return { utilisateur: decode.slice(0, separateur), motDePasse: decode.slice(separateur + 1) }
}
