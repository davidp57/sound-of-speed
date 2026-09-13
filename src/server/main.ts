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
import { remplirLesDatesDEnregistrement } from './depots'
import { reprendreTout } from './profil-mesure'
import { formaterDecompte, reprendreLesDossiers } from './reprise'
import { creerServeur } from './serveur'

const port = Number(process.env['SPEED_PORT'] ?? 8088)
const application = process.env['SPEED_APP'] ?? 'dist'
const echantillons = process.env['SPEED_AUDIO']
const fichierDeBase = process.env['SPEED_DB'] ?? 'donnees/speed.db'
const migrations = process.env['SPEED_MIGRATIONS'] ?? 'src/server/base/migrations'
const fichierDeComptes = process.env['SPEED_HTPASSWD']
const anciensDossiers = process.env['SPEED_REPRISE']

const { base, fermer } = await ouvrirBase({ fichier: fichierDeBase, migrations })
console.log(`base ouverte et à jour : ${fichierDeBase}`)

// La date du trajet sur ce qui est entré avant qu'elle existe. Avant la reprise,
// pour qu'elle n'ait à traiter que ce qu'elle vient de verser — la reprise, elle,
// écrit déjà la date en entrant.
try {
  const datees = await remplirLesDatesDEnregistrement(base)
  if (datees > 0) console.log(`date du trajet donnée à ${datees} dépôts`)
} catch (erreur) {
  // Une date manquante se rattrape au démarrage suivant ; un serveur qui ne
  // démarre pas, non.
  console.error(`dates d'enregistrement : ${String(erreur)}`)
}

// La reprise des anciens dossiers, quand on lui en désigne un.
//
// **Avant le rattrapage du profil mesuré**, et pas après : le cumul se refait
// sur ce que la base contient, et le refaire avant d'avoir versé les traces
// obligerait à redémarrer une seconde fois pour rien.
//
// Elle se joue au démarrage, comme les migrations, parce qu'il n'y a pas d'autre
// endroit commode : lancer une commande à la main dans un conteneur, depuis
// Portainer, ne l'est pas. Elle ne fait rien quand tout est déjà entré, donc la
// laisser branchée ne casse rien — elle relit seulement un dossier pour rien.
if (anciensDossiers !== undefined) {
  try {
    console.log(
      formaterDecompte(
        anciensDossiers,
        await reprendreLesDossiers(base, SOLO_ACCOUNT_ID, anciensDossiers),
      ),
    )
  } catch (erreur) {
    // Un dossier absent ou illisible ne doit pas empêcher le serveur de servir :
    // la voiture, elle, a besoin de lui tout de suite.
    console.error(`reprise des anciens dossiers : ${String(erreur)}`)
  }
}

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
