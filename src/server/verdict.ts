#!/usr/bin/env node
/**
 * Ce que la règle de rétention emporterait, sur une base qu'on désigne.
 *
 * **Il n'efface rien.** C'est tout son intérêt : aucun contrôle ne dira qu'un
 * délai est trop court — un mauvais seuil efface des données et rien ne rougit.
 * La seule façon de le savoir est de regarder le verdict d'abord, sur les vraies
 * données, avant que le serveur arme son ménage.
 *
 * Le relecteur montre le même verdict, mais il lui faut un serveur qui tourne.
 * Ceci se lance sur un fichier de base copié depuis le NAS, sans conteneur et
 * sans rien démarrer.
 *
 * **Il écrit pourtant dans la base qu'on lui donne** : il joue les migrations,
 * donne sa date de trajet à ce qui n'en a pas, et laisse le profileur marquer ce
 * qu'il a regardé — exactement ce que fait un démarrage de serveur, moins le
 * ménage. Donc : **sur une copie**, jamais sur la base en service.
 *
 * ```bash
 * npm run verdict -- /chemin/vers/une-copie-de-speed.db
 * ```
 */

import { SOLO_ACCOUNT_ID, ouvrirBase } from './base/base'
import { remplirLesDatesDEnregistrement } from './depots'
import { reprendreTout, tracesNonAnalysees } from './profil-mesure'
import { DELAIS_PAR_DEFAUT, formaterVerdict, verdictDuCompte, type Delais } from './retention'

const fichierDeBase = process.argv[2] ?? process.env['SPEED_DB']
const migrations = process.env['SPEED_MIGRATIONS'] ?? 'src/server/base/migrations'

if (fichierDeBase === undefined) {
  console.error('Donnez le chemin d’une **copie** de la base : npm run verdict -- copie.db')
  process.exit(2)
}

const delais: Delais = {
  traces: nombreOuRien(process.env['SPEED_RETENTION_TRACES']) ?? DELAIS_PAR_DEFAUT.traces,
  journal: nombreOuRien(process.env['SPEED_RETENTION_JOURNAL']) ?? DELAIS_PAR_DEFAUT.journal,
}

const { base, fermer } = await ouvrirBase({ fichier: fichierDeBase, migrations })

try {
  const datees = await remplirLesDatesDEnregistrement(base)
  if (datees > 0) console.log(`date du trajet donnée à ${datees} dépôts`)

  // Le même rattrapage qu'au démarrage : sans lui, tout serait « pas encore
  // analysé » et le verdict ne dirait rien de ce que la règle fera vraiment.
  const aVoir = await tracesNonAnalysees(base, SOLO_ACCOUNT_ID)
  if (aVoir > 0) {
    const rattrape = await reprendreTout(base, SOLO_ACCOUNT_ID)
    console.log(`profil mesuré : ${aVoir} tranches regardées`)
    if (rattrape.skipped.length > 0) {
      console.log(`tranches illisibles, écartées : ${rattrape.skipped.length}`)
    }
  }

  console.log('')
  console.log(formaterVerdict(await verdictDuCompte(base, SOLO_ACCOUNT_ID, Date.now(), delais), delais))
} finally {
  fermer()
}

/** Un réglage d'environnement, quand il est lisible. Voir `main.ts`. */
function nombreOuRien(brut: string | undefined): number | undefined {
  if (brut === undefined) return undefined
  const valeur = Number(brut)
  return Number.isFinite(valeur) && valeur > 0 ? valeur : undefined
}
