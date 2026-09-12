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

import { ouvrirBase } from './base/base'
import { creerServeur } from './serveur'

const port = Number(process.env['SPEED_PORT'] ?? 8088)
const application = process.env['SPEED_APP'] ?? 'dist'
const echantillons = process.env['SPEED_AUDIO']
const fichierDeBase = process.env['SPEED_DB'] ?? 'donnees/speed.db'
const migrations = process.env['SPEED_MIGRATIONS'] ?? 'src/server/base/migrations'

const { fermer } = await ouvrirBase({ fichier: fichierDeBase, migrations })
console.log(`base ouverte et à jour : ${fichierDeBase}`)

const serveur = serve(
  {
    fetch: creerServeur(
      echantillons === undefined ? { application } : { application, echantillons },
    ).fetch,
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
