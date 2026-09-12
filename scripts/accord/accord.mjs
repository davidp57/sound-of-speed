#!/usr/bin/env node
/**
 * Rejoue le contrat contre un serveur, quel qu'il soit.
 *
 * ```bash
 * npm run accord -- http://localhost:8088
 * npm run accord -- http://localhost:8088 --compte david:secret
 * ```
 *
 * Il ne connaît rien du serveur qu'il interroge : c'est tout l'intérêt. Le même
 * jeu passe contre nginx aujourd'hui et contre son remplaçant demain, et l'écart
 * entre les deux est exactement ce qu'on cherche à ne pas avoir.
 *
 * Les cas qui demandent un compte sont **sautés** quand aucun n'est donné, et
 * dits comme tels. Un jeu qui se déclarerait vert en ayant tout sauté serait un
 * jeu qui ment.
 */

import { cas, marque } from './contrat.mjs'

function lireArguments(argv) {
  const options = { base: null, compte: null, verbeux: false, part: null }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--compte') {
      i += 1
      options.compte = argv[i] ?? null
    } else if (arg === '--part') {
      i += 1
      options.part = argv[i] ?? null
    } else if (arg === '--verbeux') {
      options.verbeux = true
    } else if (!arg.startsWith('--')) {
      options.base = arg.replace(/\/$/, '')
    }
  }
  return options
}

const options = lireArguments(process.argv.slice(2))
if (options.base === null) {
  console.error('Usage : npm run accord -- <adresse> [--compte utilisateur:motdepasse] [--verbeux]')
  process.exit(2)
}

const identifiants =
  options.compte ?? process.env['SPEED_COMPTE'] ?? null

function entetesDe(requete) {
  const entetes = { ...(requete.entetes ?? {}) }
  if (requete.compte === true && identifiants !== null) {
    entetes['Authorization'] = `Basic ${Buffer.from(identifiants, 'utf8').toString('base64')}`
  }
  return entetes
}

/**
 * Trois parts, parce qu'un serveur se reprend en plusieurs fois.
 *
 * `publique` est ce qui se sert sans compte : l'application, ses ressources, les
 * échantillons, et les 404 qu'un chemin de données absent doit rendre.
 * `profils` est la bibliothèque. `depots` est ce que la voiture envoie en
 * roulant — traces, journal, relevés.
 *
 * Pendant la réécriture, le serveur neuf tient ces parts l'une après l'autre, et
 * pouvoir le dire évite le seul mauvais réflexe possible : retirer d'un jeu de
 * vérification les cas qu'on ne sait pas encore passer. Plusieurs parts se
 * demandent séparées par une virgule.
 *
 * Sans `--part`, tout est joué. C'est ce que fait l'intégration continue contre
 * le serveur en service.
 */
const partsVoulues = options.part === null ? null : options.part.split(',').map((p) => p.trim())
const jeu = cas({ nom: marque() }).filter(
  (unCas) => partsVoulues === null || partsVoulues.includes(unCas.part ?? 'publique'),
)
const resultats = []

for (const unCas of jeu) {
  const { requete } = unCas

  if (requete.compte === true && identifiants === null) {
    resultats.push({ nom: unCas.nom, etat: 'sauté', detail: 'aucun compte fourni' })
    continue
  }

  const adresse = `${options.base}${requete.chemin}`
  const methode = requete.methode ?? 'GET'

  let reponse
  let corps
  try {
    reponse = await fetch(adresse, {
      method: methode,
      headers: entetesDe(requete),
      body: requete.corps,
      redirect: 'manual',
    })
    corps = Buffer.from(await reponse.arrayBuffer())
  } catch (erreur) {
    resultats.push({
      nom: unCas.nom,
      etat: 'échoué',
      detail: `${methode} ${requete.chemin} — ${erreur.message}`,
    })
    continue
  }

  try {
    unCas.attend(reponse, corps)
    resultats.push({ nom: unCas.nom, etat: 'passé', detail: `${methode} ${requete.chemin}` })
  } catch (erreur) {
    resultats.push({
      nom: unCas.nom,
      etat: 'échoué',
      detail: `${methode} ${requete.chemin} — ${erreur.message}`,
    })
  }
}

const passes = resultats.filter((r) => r.etat === 'passé')
const echoues = resultats.filter((r) => r.etat === 'échoué')
const sautes = resultats.filter((r) => r.etat === 'sauté')

for (const resultat of resultats) {
  if (resultat.etat === 'échoué') console.log(`  ÉCHEC   ${resultat.nom}\n          ${resultat.detail}`)
  else if (resultat.etat === 'sauté') console.log(`  sauté   ${resultat.nom} (${resultat.detail})`)
  else if (options.verbeux) console.log(`  ok      ${resultat.nom}`)
}

console.log(
  `\n${passes.length} passés, ${echoues.length} échoués, ${sautes.length} sautés — contre ${options.base}`,
)

if (sautes.length > 0 && echoues.length === 0) {
  console.log(
    'Des cas ont été sautés faute de compte : le contrat n’est pas entièrement vérifié.',
  )
}

process.exit(echoues.length === 0 ? 0 : 1)
