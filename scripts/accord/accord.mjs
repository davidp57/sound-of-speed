#!/usr/bin/env node
/**
 * Rejoue le contrat contre un serveur, quel qu'il soit.
 *
 * ```bash
 * npm run accord -- http://localhost:8088
 * ```
 *
 * Il ne connaît rien du serveur qu'il interroge : c'est tout l'intérêt. Le même
 * jeu passe contre nginx aujourd'hui et contre son remplaçant demain, et l'écart
 * entre les deux est exactement ce qu'on cherche à ne pas avoir.
 *
 * **Il prend son compte tout seul**, comme le ferait un navigateur qui ouvre
 * l'application pour la première fois : plus rien à saisir, et plus aucun cas
 * sauté faute d'identifiants. Un serveur qui ne sait pas en donner fait échouer
 * le jeu au premier cas, ce qui est exactement ce qu'on veut savoir.
 *
 * `--compte` reste, et pour une seule raison : l'**ancien** serveur, celui qui
 * sert encore la production derrière nginx, ne connaît que le mot de passe
 * partagé. L'option force alors l'ancienne façon de s'annoncer. Elle partira
 * avec lui.
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
  console.error(
    'Usage : npm run accord -- <adresse> [--part publique,profils] [--compte nom:motdepasse] [--verbeux]',
  )
  process.exit(2)
}

/**
 * Le témoin de connexion d'un appareil qui vient de se présenter.
 *
 * C'est le geste que fait tout navigateur au premier chargement : demander un
 * compte anonyme. Rien à saisir, rien à configurer sur le serveur d'en face.
 */
async function prendreUnCompte(base) {
  const reponse = await fetch(`${base}/api/auth/sign-in/anonymous`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  })
  if (!reponse.ok) {
    console.error(`Ce serveur n'a pas donné de compte : ${reponse.status}.`)
    process.exit(2)
  }
  return (reponse.headers.get('set-cookie') ?? '').split(';')[0] ?? ''
}

/** Le mot de passe partagé, s'il est demandé : voir l'en-tête de ce fichier. */
const identifiants = options.compte ?? process.env['SPEED_COMPTE'] ?? null

const temoin = identifiants === null ? await prendreUnCompte(options.base) : null

function entetesDe(requete) {
  const entetes = { ...(requete.entetes ?? {}) }
  // La bibliothèque d'identité refuse un POST sans `Origin` — sa protection
  // contre les requêtes venues d'un autre site. Un navigateur en met un tout
  // seul ; ici, il faut le composer.
  if (requete.origine === true) entetes['Origin'] = options.base
  // Les cas qui vérifient le refus ne s'annoncent pas : c'est justement ce
  // qu'ils mesurent.
  if (requete.compte !== true) return entetes

  if (identifiants === null) entetes['Cookie'] = temoin
  else entetes['Authorization'] = `Basic ${Buffer.from(identifiants, 'utf8').toString('base64')}`
  return entetes
}

/**
 * Quatre parts, parce qu'un serveur se reprend en plusieurs fois.
 *
 * `publique` est ce qui se sert sans base : l'application, ses ressources, les
 * échantillons, et les 404 qu'un chemin de données absent doit rendre. Elle ne
 * se sert plus entièrement sans compte — les échantillons en demandent un depuis
 * qu'ils ont cessé d'être la seule ressource que rien ne gardait.
 * `profils` est la bibliothèque. `depots` est ce que la voiture envoie en
 * roulant — traces, journal, relevés. `entites` est le registre des moteurs et
 * des boîtes, qui n'a jamais existé sur le serveur de fichiers : la demander à
 * l'ancien n'aurait pas de sens, et c'est la seule part qu'il ne se voit pas
 * demander.
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
