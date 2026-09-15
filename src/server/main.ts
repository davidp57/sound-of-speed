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
import { administrateursDeLEnvironnement } from './administration'
import { banquesAccordees, banquesRestreintes } from './banques'
import {
  compteurDeDepense,
  formaterDepense,
  poidsDesBanques,
  poidsDesComptes,
} from './depense'
import { creerIdentite, reprendreLesAdressesDesTiers, secretPersistant } from './identite'
import { formaterDecompte, reprendreLesDossiers } from './reprise'
import { appliquerLaRegle, DELAIS_PAR_DEFAUT, formaterPassage, type Delais } from './retention'
import { plafondDeLEnvironnement } from './plafond'
import { offertsDeLEnvironnement } from './roles'
import { creerServeur } from './serveur'
import { comptesTenusAilleurs } from './tiers'

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
// Les rôles offerts à n'importe quel compte. Absente **ou vide**, les trois :
// tout le monde a tout, rien n'étant encaissé — et une variable déclarée dans
// une pile sans être saisie arrive vide. Pour tout fermer et vérifier la
// mécanique sur un serveur qui tourne, il faut une valeur qui ne nomme aucun
// rôle : `aucun`.
const roles = offertsDeLEnvironnement(process.env['SPEED_ROLES_OFFERTS'])
// Les comptes tenus ailleurs : deux variables par fournisseur, et rien du tout
// par défaut. Voir `tiers.ts` pour les noms.
const tiers = comptesTenusAilleurs(process.env)
// Les banques qui ne sont pas à nous, et qui a le droit de les jouer. Déclarées
// ici et **jamais par une route** : aucun appel ne peut donc s'accorder ce
// droit. Absentes, aucune banque n'est restreinte.
const banques = {
  restreintes: banquesRestreintes(process.env['SPEED_BANQUES_RESTREINTES']),
  accordees: banquesAccordees(process.env['SPEED_BANQUES_ACCORDEES']),
}
// Qui administre : des adresses séparées par des virgules. Déclarées ici et
// **jamais par une route** — aucun appel ne peut donc fabriquer un
// administrateur. Absente, personne n'administre et la régie répond 404.
const admins = administrateursDeLEnvironnement(process.env['SPEED_ADMINS'])
// Le plafond de volume commun, en gibioctets. Il **refuse** un dépôt, il
// n'efface jamais rien : c'est ce qui rend un chiffre provisoire acceptable.
const plafond = plafondDeLEnvironnement(process.env['SPEED_PLAFOND_GIO'])
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

/**
 * Ce que le serveur a dépensé depuis le dernier relevé.
 *
 * **Une différence, pas un cumul** : un compteur depuis le démarrage divisé par
 * une durée montrerait une moyenne là où il faut une tendance. Le relevé remet
 * donc les compteurs à zéro, et chaque ligne parle de la période qu'elle couvre.
 *
 * Il n'y a rien à décider ici : ces chiffres servent à poser la borne de volume
 * par compte, qui sans eux serait inventée.
 */
const depense = compteurDeDepense()

async function releveDeDepense(): Promise<void> {
  try {
    console.log(
      formaterDepense(
        depense.releverEtRepartir(),
        poidsDesBanques(echantillons),
        await poidsDesComptes(base, fichierDeBase),
      ),
    )
  } catch (erreur) {
    // Un relevé qui échoue ne doit pas emporter le ménage qui le suit.
    console.error(`relevé de dépense : ${String(erreur)}`)
  }
}

await menageDeRetention()

const UN_JOUR = 24 * 60 * 60 * 1000
const minuteurDuMenage = setInterval(() => {
  void menageDeRetention()
  void releveDeDepense()
}, UN_JOUR)
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
  tiers,
})

// Les comptes rattachés à un tiers avant que le rattrapage de l'adresse existe
// gardent l'adresse de remplacement du greffon anonyme. On relit une fois ce que
// leur fournisseur avait dit ; sans effet au démarrage suivant.
try {
  const repris = await reprendreLesAdressesDesTiers(base)
  if (repris > 0) console.log(`adresse reprise chez le fournisseur pour ${repris} compte(s)`)
} catch (erreur) {
  // Se rattrape au démarrage suivant, ou à la prochaine reconnexion.
  console.error(`reprise des adresses de tiers : ${String(erreur)}`)
}

// Un fournisseur doit revenir sur le site, et le conteneur ne voit qu'un port
// local : sans adresse publique, l'adresse de retour qu'il annoncera sera fausse
// et la connexion échouera au retour, pas au départ. Le dire au démarrage plutôt
// que de le laisser découvrir à l'usage.
const nombreDeTiers = Object.keys(tiers.integres).length + tiers.generiques.length
if (nombreDeTiers > 0 && adressePublique === undefined) {
  console.warn(
    `${nombreDeTiers} compte(s) tenu(s) ailleurs configuré(s) sans SPEED_URL : l'adresse de retour sera déduite de la requête, ce qui est faux derrière un proxy inversé.`,
  )
} else if (adressePublique === undefined) {
  // Sans elle, la garde qui refuse les requêtes venues d'un autre site marche
  // quand même : l'origine annoncée est alors comparée à l'**hôte** de la
  // requête, ce qui est le bon contrôle. Mesuré le 15 septembre 2026.
  //
  // Ce qu'on perd est plus étroit, et réel : ce contrôle dépend alors de l'hôte
  // que le proxy inversé transmet. Le fixer ici supprime cette dépendance.
  console.warn(
    'SPEED_URL n’est pas renseignée : le refus des requêtes venues d’un autre site se fonde alors sur l’hôte transmis par le proxy inversé, et non sur une adresse connue.',
  )
}

const serveur = serve(
  {
    fetch: creerServeur({
      application,
      base,
      identite,
      ...(epingles === undefined ? {} : { epingles }),
      roles,
      delais,
      banques,
      admins,
      plafond,
      depense,
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
    // **Le relevé part avant la fermeture**, sinon un conteneur qu'on remplace
    // emporte ses compteurs sans rien dire. Une pile qu'on redéploie plus
    // souvent que toutes les vingt-quatre heures ne montrerait alors **jamais**
    // une ligne, et le silence se lirait comme « rien à signaler ».
    void releveDeDepense().finally(() => {
      serveur.close(() => {
        fermer()
        process.exit(0)
      })
    })
  })
}
