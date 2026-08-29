#!/usr/bin/env node
/**
 * Produit le fichier de mots de passe attendu par nginx.
 *
 *   npm run htpasswd
 *
 * Ce script existe pour une raison simple : la documentation indiquait jusqu'ici
 * de lancer `docker run httpd:alpine htpasswd`, ce qui suppose un Docker sur le
 * poste — qu'il n'y a pas. Node, lui, est là.
 *
 * Le mot de passe est demandé en saisie masquée plutôt que passé en argument :
 * un argument reste dans l'historique du terminal et dans la liste des processus.
 *
 * Le fichier produit est à déposer dans /volume1/docker/speed/ avec File
 * Station, puis à monter dans la pile Portainer.
 */

import { createInterface } from 'node:readline'
import { writeFile } from 'node:fs/promises'
import { stdin, stdout } from 'node:process'

import bcrypt from 'bcryptjs'

/** Coût du hachage. Dix tours restent instantanés à la vérification. */
const ROUNDS = 10
const OUTPUT = 'htpasswd'

function ask(question, { masked = false } = {}) {
  const rl = createInterface({ input: stdin, output: stdout, terminal: true })
  return new Promise((resolve) => {
    if (masked) {
      // `_writeToOutput` est le point d'accroche de readline pour contrôler ce
      // qui est réaffiché : on n'imprime que l'invite, jamais la frappe.
      rl._writeToOutput = (text) => {
        if (text.includes(question)) stdout.write(question)
      }
    }
    rl.question(question, (answer) => {
      if (masked) stdout.write('\n')
      rl.close()
      resolve(answer)
    })
  })
}

const user = (await ask("Nom d'utilisateur : ")).trim()
if (!user || user.includes(':')) {
  console.error("Nom d'utilisateur vide ou contenant « : », ce que le format interdit.")
  process.exit(1)
}

const password = await ask('Mot de passe : ', { masked: true })
if (password.length < 8) {
  console.error('Mot de passe trop court : huit caractères au minimum.')
  process.exit(1)
}

const confirmation = await ask('Confirmation : ', { masked: true })
if (password !== confirmation) {
  console.error('Les deux saisies diffèrent.')
  process.exit(1)
}

// Les variantes `$2a$`, `$2b$` et `$2y$` désignent le même algorithme et
// produisent la même empreinte ; seul le préfixe diffère, pour des raisons
// historiques. On normalise vers `$2y$`, celui qu'écrivent les outils htpasswd,
// afin de ne pas dépendre de la variante que la bibliothèque choisit — elle a
// changé au fil de ses versions.
const hash = bcrypt.hashSync(password, ROUNDS).replace(/^\$2[abxy]\$/, '$2y$')

await writeFile(OUTPUT, `${user}:${hash}\n`, 'utf8')
console.log(`\nÉcrit dans ./${OUTPUT}`)
console.log('À déposer dans /volume1/docker/speed/ avec File Station,')
console.log('puis à décommenter dans docker/nginx.conf et dans la pile.')
