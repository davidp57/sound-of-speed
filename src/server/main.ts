#!/usr/bin/env node
/**
 * Le point d'entrée du serveur.
 *
 * Il ouvre la base — donc joue les migrations qui manquent — **avant** de se
 * mettre à répondre. Un serveur qui accepte une requête pendant qu'il se migre
 * répond sur un schéma à moitié posé, et l'erreur qui en sort ne ressemble pas à
 * sa cause.
 */

import { serve } from '@hono/node-server'

import { SOLO_ACCOUNT_ID, ouvrirBase } from './base/base'
import { lireComptes } from './comptes'
import { reprendreTout } from './profil-mesure'
import { creerServeur } from './serveur'

const port = Number(process.env['SPEED_PORT'] ?? 8088)
const application = process.env['SPEED_APP'] ?? 'dist'
const echantillons = process.env['SPEED_AUDIO']
const fichierDeBase = process.env['SPEED_DB'] ?? 'donnees/speed.db'
const migrations = process.env['SPEED_MIGRATIONS'] ?? 'src/server/base/migrations'
const fichierDeComptes = process.env['SPEED_HTPASSWD']

const { base, fermer } = await ouvrirBase({ fichier: fichierDeBase, migrations })
console.log(`base ouverte et à jour : ${fichierDeBase}`)

// Rattrapage : une trace déposée pendant que le serveur était arrêté n'a
// déclenché aucune reprise, et serait perdue pour la mesure. Le profileur décide
// lui-même s'il doit tout relire — un procédé corrigé rend l'ancien cumul sans
// valeur — donc ceci ne coûte rien quand il n'y a rien à rattraper.
try {
  const rattrape = await reprendreTout(base, SOLO_ACCOUNT_ID)
  if (rattrape.skipped.length > 0) {
    console.warn(`tranches illisibles, écartées : ${rattrape.skipped.join(', ')}`)
  }
} catch (erreur) {
  // Un rattrapage qui échoue ne doit pas empêcher le serveur de servir : la
  // mesure se reprendra au prochain dépôt.
  console.error(`rattrapage du profil mesuré : ${String(erreur)}`)
}

const serveur = serve(
  {
    fetch: creerServeur({
      application,
      base,
      comptes: lireComptes(fichierDeComptes),
      ...(echantillons === undefined ? {} : { echantillons }),
    }).fetch,
    port,
  },
  (adresse) => {
    console.log(`Sound of Speed sert ${application} sur le port ${adresse.port}`)
    if (echantillons !== undefined) console.log(`échantillons déposés : ${echantillons}`)
  },
)

// Rendre la main proprement : un conteneur qu'on remplace envoie ce signal, et
// un serveur qui l'ignore se fait tuer après un délai — avec une base qu'il n'a
// pas refermée.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    serveur.close(() => {
      fermer()
      process.exit(0)
    })
  })
}
