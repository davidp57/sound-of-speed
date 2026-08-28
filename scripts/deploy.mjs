#!/usr/bin/env node
/**
 * Recopie le build vers le NAS.
 *
 * Le réglage d'un profil se fait par allers-retours : on modifie, on reconstruit,
 * on va écouter dans la voiture. Autant que l'étape de copie tienne en une
 * commande plutôt qu'en une navigation dans File Station.
 *
 *   npm run deploy
 *
 * La destination se déclare une fois pour toutes dans la variable
 * d'environnement `SPEED_DEPLOY_TARGET` — un lecteur réseau monté sur le partage
 * du NAS, par exemple `Z:\\docker\\speed\\dist` :
 *
 *   setx SPEED_DEPLOY_TARGET "Z:\\docker\\speed\\dist"
 *
 * Les échantillons ne sont pas copiés. Ils vivent dans un dossier voisin sur le
 * NAS, monté par-dessus le build, et ne bougent que lorsqu'on change de banque
 * sonore — les recopier à chaque déploiement enverrait plusieurs mégaoctets pour
 * rien.
 */

import { cp, rm, readdir, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const target = process.env['SPEED_DEPLOY_TARGET']
if (!target) {
  console.error('SPEED_DEPLOY_TARGET n’est pas défini. Voir l’en-tête de ce script.')
  process.exit(1)
}

const source = resolve('dist')

try {
  await stat(source)
} catch {
  console.error('Aucun dossier `dist`. Lancer `npm run build` d’abord.')
  process.exit(1)
}

// Le dossier `audio` du build est ignoré : sur le NAS, c'est un montage séparé
// qui occupe cet emplacement, et l'écraser romprait le montage.
const entries = (await readdir(source)).filter((name) => name !== 'audio')

console.log(`Déploiement vers ${target}`)
for (const name of entries) {
  const to = join(target, name)
  await rm(to, { recursive: true, force: true })
  await cp(join(source, name), to, { recursive: true })
  console.log(`  ${name}`)
}
console.log('Terminé. Le conteneur sert les nouveaux fichiers sans redémarrage.')
