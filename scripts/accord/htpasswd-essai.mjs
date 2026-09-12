#!/usr/bin/env node
/**
 * Un fichier de mots de passe pour un serveur d'essai, et rien d'autre.
 *
 * ```bash
 * node scripts/accord/htpasswd-essai.mjs /tmp/pile/htpasswd essai essai
 * ```
 *
 * Le script `npm run htpasswd` pose ses questions au clavier : c'est ce qu'il
 * faut quand on prépare un vrai compte, et c'est inutilisable dans une
 * intégration continue. Celui-ci prend tout en arguments, ne cache rien, et ne
 * sert qu'à monter une pile jetable — **ne l'employez pas pour un serveur qui
 * porte quelque chose**.
 *
 * nginx exige son fichier de mots de passe dès qu'il demande un compte : sans
 * lui, les quatre dossiers de dépôt ne rendent pas 401 mais 500, et le contrat
 * échouerait en désignant la mauvaise cause.
 */

import { writeFileSync } from 'node:fs'

import bcrypt from 'bcryptjs'

const [sortie, utilisateur, motDePasse] = process.argv.slice(2)

if (!sortie || !utilisateur || !motDePasse) {
  console.error('Usage : node scripts/accord/htpasswd-essai.mjs <fichier> <compte> <mot de passe>')
  process.exit(2)
}

// Les variantes `$2a$`, `$2b$` et `$2y$` désignent le même algorithme et
// produisent la même empreinte ; seul le préfixe diffère. On normalise vers
// `$2y$`, celui qu'écrivent les outils htpasswd, comme le fait déjà le script
// interactif — la bibliothèque a changé de variante au fil de ses versions.
const empreinte = bcrypt.hashSync(motDePasse, 10).replace(/^[$]2[abxy][$]/, '$2y$')

writeFileSync(sortie, `${utilisateur}:${empreinte}\n`, 'utf8')
console.log(`${sortie} — compte « ${utilisateur} », empreinte ${empreinte.slice(0, 4)}…`)
