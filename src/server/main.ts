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

import { listerLesComptes, ouvrirBase } from './base/base'
import { remplirLesDatesDEnregistrement } from './depots'
import { reprendreTout, tracesNonAnalysees } from './profil-mesure'
import { ANCIEN_COMPTE_UNIQUE, semerLAncienCompte } from './heritage'
import { creerIdentite, secretPersistant } from './identite'
import { formaterDecompte, reprendreLesDossiers } from './reprise'
import { appliquerLaRegle, DELAIS_PAR_DEFAUT, formaterPassage, type Delais } from './retention'
import { offertsDeLEnvironnement } from './roles'
import { creerServeur } from './serveur'

const port = Number(process.env['SPEED_PORT'] ?? 8088)
const application = process.env['SPEED_APP'] ?? 'dist'
const echantillons = process.env['SPEED_AUDIO']
const fichierDeBase = process.env['SPEED_DB'] ?? 'donnees/speed.db'
const migrations = process.env['SPEED_MIGRATIONS'] ?? 'src/server/base/migrations'
const anciensDossiers = process.env['SPEED_REPRISE']
// Vide vaut absente : une variable déclarée sans valeur dans l'écran d'une pile
// est ce qu'on obtient le plus souvent, et une adresse vide ferait pire que pas
// d'adresse du tout.
const adressePublique = process.env['SPEED_URL']?.trim() || undefined
const secretDIdentite = process.env['SPEED_AUTH_SECRET']
const epingles = nombreOuRien(process.env['SPEED_EPINGLES'])
// Les rôles offerts à n'importe quel compte. Absente, les trois : tout le monde
// a tout, rien n'étant encaissé. Vide, aucun — ce qui ferme tout, et c'est la
// façon de vérifier la mécanique sur un serveur qui tourne.
const roles = offertsDeLEnvironnement(process.env['SPEED_ROLES_OFFERTS'])
const delais: Delais = {
  traces: nombreOuRien(process.env['SPEED_RETENTION_TRACES']) ?? DELAIS_PAR_DEFAUT.traces,
  journal: nombreOuRien(process.env['SPEED_RETENTION_JOURNAL']) ?? DELAIS_PAR_DEFAUT.journal,
}

/**
 * Un réglage d'environnement, quand il est lisible.
 *
 * Une valeur de travers — une faute de frappe dans l'écran de la pile — vaut
 * mieux ignorée que prise pour zéro : zéro épingle ou zéro jour d'attente
 * effacerait tout au premier passage.
 */
function nombreOuRien(brut: string | undefined): number | undefined {
  if (brut === undefined) return undefined
  const valeur = Number(brut)
  return Number.isFinite(valeur) && valeur > 0 ? valeur : undefined
}

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
    // Ce qu'on verse appartient au **compte d'avant l'identité**, et à lui seul :
    // au moment où la reprise tourne, aucun appareil ne s'est peut-être encore
    // présenté, et il faut bien un propriétaire. Le premier compte réel en
    // héritera — voir `heritage.ts`.
    await semerLAncienCompte(base)
    console.log(
      formaterDecompte(
        anciensDossiers,
        await reprendreLesDossiers(base, ANCIEN_COMPTE_UNIQUE, anciensDossiers),
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
  // Compte par compte, depuis que l'identité est ouverte : le rattrapage se
  // faisait sur un compte écrit en dur, il se fait sur tous ceux qui existent.
  for (const compte of await listerLesComptes(base)) {
    // Le décompte encadre le rattrapage : il dit le travail avant, et doit valoir
    // zéro après. Un procédé corrigé remet toutes les traces à voir d'un coup —
    // c'est ce chiffre-là qui le montre, plutôt qu'un silence.
    const aVoir = await tracesNonAnalysees(base, compte)
    const rattrape = await reprendreTout(base, compte)
    if (aVoir > 0) {
      console.log(
        `profil mesuré de ${compte} : ${aVoir} tranches à regarder, ${await tracesNonAnalysees(base, compte)} restantes`,
      )
    }
    if (rattrape.skipped.length > 0) {
      console.warn(`tranches illisibles, écartées : ${rattrape.skipped.join(', ')}`)
    }
  }
} catch (erreur) {
  // Un rattrapage qui échoue ne doit pas empêcher le serveur de servir : la
  // mesure se reprendra au prochain dépôt.
  console.error(`rattrapage du profil mesuré : ${String(erreur)}`)
}

/**
 * Le ménage : ce que la règle emporte, elle l'emporte.
 *
 * **Au démarrage d'abord**, comme les migrations et la reprise — c'est le motif
 * déjà posé ici. **Puis toutes les vingt-quatre heures**, parce qu'un serveur
 * qui ne redémarre pas pendant trois mois ne doit pas cesser de faire le ménage
 * pour autant.
 *
 * Un passage qui échoue ne fait pas tomber le serveur : la voiture a besoin de
 * lui tout de suite, et le ménage se reprendra au passage suivant.
 *
 * Le journal du conteneur est le seul endroit où l'on verra ce qui a disparu,
 * puisque après coup il n'y a plus rien à regarder. Un passage qui n'efface rien
 * est le cas normal, et il se tait.
 */
async function menageDeRetention(): Promise<void> {
  try {
    // Chaque compte a ses trajets et ses délais s'appliquent séparément : un
    // passage global n'aurait pas de sens, la borne d'épingles étant par compte.
    for (const compte of await listerLesComptes(base)) {
      const ligne = formaterPassage(await appliquerLaRegle(base, compte, Date.now(), delais))
      if (ligne !== null) console.log(ligne)
    }
  } catch (erreur) {
    console.error(`rétention : ${String(erreur)}`)
  }
}

await menageDeRetention()

const UN_JOUR = 24 * 60 * 60 * 1000
const minuteurDuMenage = setInterval(() => void menageDeRetention(), UN_JOUR)
// Le minuteur ne doit pas retenir le processus : un conteneur qu'on remplace
// envoie son signal, et le serveur doit pouvoir rendre la main tout de suite.
minuteurDuMenage.unref()

// L'identité, montée sur la base qui vient d'être migrée. Son secret vit à côté
// du fichier de base et se crée au premier démarrage : celui qui déploie chez lui
// n'a rien à fournir.
const identite = creerIdentite({
  base,
  secret: secretDIdentite ?? secretPersistant(fichierDeBase),
  ...(adressePublique === undefined ? {} : { adresse: adressePublique }),
})

const serveur = serve(
  {
    fetch: creerServeur({
      application,
      base,
      identite,
      ...(epingles === undefined ? {} : { epingles }),
      roles,
      delais,
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
    clearInterval(minuteurDuMenage)
    serveur.close(() => {
      fermer()
      process.exit(0)
    })
  })
}
