/**
 * Le serveur : l'application, ses ressources, les échantillons.
 *
 * Il reprend ce que nginx rendait, sans que rien en face ait à le savoir. Le jeu
 * de requêtes de `scripts/accord/` en est le juge, et il décrit le contrat mieux
 * que ce commentaire ne le ferait.
 *
 * Il porte aussi ce que nginx ne rendait pas : les moteurs et les boîtes, qui
 * n'avaient nulle part où aller tant qu'un profil était le seul objet qu'on
 * pouvait déposer.
 */

import { readdirSync } from 'node:fs'

import { Hono } from 'hono'

import type { Base } from './base/base'
import { ecrireDepot, estUnDossier, lireDepot, listerDepots } from './depots'
import { DELAIS_PAR_DEFAUT, verdictDuCompte, type Delais } from './retention'
import {
  archiveDeLaSession,
  effacerSession,
  epingler,
  EPINGLES_PAR_DEFAUT,
  listerSessions,
} from './sessions'
import { ecrireEntite, estUnRegistre, lireEntite, listerEntites } from './entites'
import { CHEMIN_IDENTITE, type Identite } from './identite'
import { cheminSur, fichierOuRien, servirFichier, typeDe } from './fichiers'
import { lireProfilMesure, reprendreApresDepot } from './profil-mesure'
import { ecrireProfil, listerProfils, lireProfil } from './profils'

export interface OptionsDuServeur {
  /** L'application construite : `dist/`. */
  application: string
  /** La base, quand il y en a une. Sans elle, les dossiers de données ne sont pas servis. */
  base?: Base
  /**
   * L'identité. Sans elle, rien de ce qui appartient à un compte n'est servi.
   *
   * C'est elle qui dit **à qui** appartient ce qu'on lit et ce qu'on écrit :
   * chaque requête porte son témoin de connexion, et le compte s'en déduit. Le
   * mot de passe partagé qui ouvrait ces dossiers a disparu avec elle.
   */
  identite?: Identite
  /** Combien d'épingles un compte peut poser. Réglable par l'environnement. */
  epingles?: number
  /** Les délais de rétention, en jours. Réglables par l'environnement. */
  delais?: Delais
  /**
   * Les échantillons déposés, s'il y en a.
   *
   * Absent, on sert uniquement ce que l'application embarque — c'est le cas
   * d'une installation neuve, qui doit quand même faire du son.
   */
  echantillons?: string
}

/** Une semaine, avec revalidation : un échantillon se remplace sans changer de nom. */
const CACHE_ECHANTILLONS = 'public, must-revalidate, max-age=604800'
/** Un an : les ressources construites portent leur empreinte dans leur nom. */
const CACHE_RESSOURCES = 'public, immutable, max-age=31536000'

/**
 * Les dossiers de données.
 *
 * Ils sont nommés ici pour une seule raison : **le repli de l'application ne
 * doit pas leur répondre**. Quand il le fait, le client demande du JSON et reçoit
 * une page HTML avec un code 200 — il ne peut plus distinguer « ce fichier
 * n'existe pas », qui est une situation normale, de « le serveur est cassé ».
 * Le cas est connu et contourné côté client, qui classe la réponse « illisible ».
 */
const DONNEES = [
  '/api/',
  '/profiles/',
  '/engines/',
  '/gearboxes/',
  '/traces/',
  '/journal/',
  '/mesures/',
  '/mesure-voiture/',
  '/sessions/',
  '/retention',
]

export function creerServeur(options: OptionsDuServeur): Hono {
  const app = new Hono()

  // --- L'identité -----------------------------------------------------------
  //
  // Déclarée en premier, parce que Hono rend la première route qui correspond et
  // que le repli de l'application, lui, correspond à tout.
  //
  // La bibliothèque parle en `Request` et `Response` standard : il n'y a rien à
  // traduire, et c'est pour cette raison que Hono a été choisi.
  if (options.identite !== undefined) {
    const identite = options.identite
    app.on(['GET', 'POST'], `${CHEMIN_IDENTITE}/*`, (c) => identite.handler(c.req.raw))
  }

  // --- La bibliothèque de profils ------------------------------------------
  //
  // Servie depuis la base quand il y en a une. Sans base, ce serveur ne sait pas
  // encore répondre ici et laisse le repli faire son travail — c'est l'état des
  // tickets précédents, où ces dossiers restaient servis par l'ancien chemin.
  if (options.base !== undefined && options.identite !== undefined) {
    const base = options.base
    const identite = options.identite

    /**
     * À qui appartient cette requête ?
     *
     * Rend le compte de la session, ou `null` quand il n'y en a pas. Le témoin
     * voyage tout seul — la page et le serveur sont sur la même origine —, il
     * n'y a donc rien à saisir ni à composer.
     */
    const compteDe = async (entetes: Headers): Promise<string | null> => {
      try {
        const session = await identite.api.getSession({ headers: entetes })
        return session?.user.id ?? null
      } catch {
        // Une session illisible n'est pas une panne du serveur : c'est une
        // requête sans compte, et elle se traite comme telle.
        return null
      }
    }

    app.on(['GET', 'PUT'], '/profiles/*', async (c) => {
      const compte = await compteDe(c.req.raw.headers)
      if (compte === null) return sansCompte()

      const chemin = new URL(c.req.url).pathname
      const nomBrut = chemin.slice('/profiles/'.length)

      if (nomBrut === '') {
        if (c.req.method !== 'GET') return c.text('', 405)
        // Jamais en cache : un profil déposé doit apparaître tout de suite.
        return c.json(await listerProfils(base, compte), 200, { 'Cache-Control': 'no-store' })
      }

      let nom: string
      try {
        nom = decodeURIComponent(nomBrut)
      } catch {
        return c.notFound()
      }

      if (c.req.method === 'PUT') {
        const ecrit = await ecrireProfil(base, compte, nom, await c.req.text())
        // Une charge qu'on ne sait pas relire n'est pas une panne du serveur :
        // c'est le seul autre code que le client ne rejoue pas.
        if (ecrit === 'illisible') return c.text('profil illisible', 413)
        return c.text('', 201)
      }

      const contenu = await lireProfil(base, compte, nom)
      if (contenu === null) return c.notFound()
      return c.text(contenu, 200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      })
    })

    // --- Les moteurs et les boîtes ------------------------------------------
    //
    // Deux registres de même forme, et la même forme que les profils : un profil
    // ne porte plus de valeurs, il désigne un moteur et une boîte. Les trois se
    // déposent donc et se relisent de la même façon.
    app.on(['GET', 'PUT'], '/:registre{engines|gearboxes}/*', async (c) => {
      const compte = await compteDe(c.req.raw.headers)
      if (compte === null) return sansCompte()

      const chemin = new URL(c.req.url).pathname
      const [, registre = '', ...reste] = chemin.split('/')
      if (!estUnRegistre(registre)) return c.notFound()

      const nomBrut = reste.join('/')
      if (nomBrut === '') {
        if (c.req.method !== 'GET') return c.text('', 405)
        // Jamais en cache : un moteur corrigé doit apparaître tout de suite.
        return c.json(await listerEntites(base, registre, compte), 200, {
          'Cache-Control': 'no-store',
        })
      }

      let nom: string
      try {
        nom = decodeURIComponent(nomBrut)
      } catch {
        return c.notFound()
      }

      if (c.req.method === 'PUT') {
        const ecrit = await ecrireEntite(base, registre, compte, nom, await c.req.text())
        // Une charge qu'on ne sait pas relire n'est pas une panne du serveur :
        // c'est le seul autre code que le client ne rejoue pas.
        if (ecrit === 'illisible') return c.text('entité illisible', 413)
        return c.text('', 201)
      }

      const contenu = await lireEntite(base, registre, compte, nom)
      if (contenu === null) return c.notFound()
      return c.text(contenu, 200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      })
    })

    // --- Ce que le serveur a appris de la vraie voiture ---------------------
    //
    // En lecture seule : c'est le serveur qui l'écrit, et l'écran qui le propose
    // le lit. Il appartient à un compte comme le reste, mais une requête sans
    // compte reçoit **404 et non 401** : l'écran ne demandait rien avant, et
    // « pas encore mesuré » est une réponse qu'il sait déjà traiter.
    app.get('/mesure-voiture/profil-voiture.json', async (c) => {
      const compte = await compteDe(c.req.raw.headers)
      const contenu = compte === null ? null : await lireProfilMesure(base, compte)
      // Un 404 franc, et surtout pas la page d'application : le client distingue
      // « pas encore mesuré », qui est normal, de « illisible », qui ne l'est pas.
      if (contenu === null) return c.notFound()
      return c.text(contenu, 200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      })
    })

    // --- Les trajets, et ce qu'on en fait ----------------------------------
    //
    // La base range des tranches ; on n'efface pas une tranche, on efface un
    // trajet. Le regroupement est celui du cœur, le même que le relecteur
    // emploie pour recoller une session : deux règles finiraient par ne plus
    // dire la même chose.
    app.get('/sessions/', async (c) => {
      const compte = await compteDe(c.req.raw.headers)
      if (compte === null) return sansCompte()

      return c.json(await listerSessions(base, compte), 200, { 'Cache-Control': 'no-store' })
    })

    // Un fichier, pas quarante-deux : c'est ce qui rend l'effacement acceptable,
    // l'archive longue étant alors chez l'utilisateur et non sur le serveur.
    app.get('/sessions/:cle/archive.zip', async (c) => {
      const compte = await compteDe(c.req.raw.headers)
      if (compte === null) return sansCompte()

      const archive = await archiveDeLaSession(base, compte, c.req.param('cle'))
      if (archive === null) return c.notFound()

      return new Response(archive.flux, {
        status: 200,
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${archive.nom}"`,
          'Cache-Control': 'no-store',
        },
      })
    })

    // Ce que la règle emporterait, sans rien effacer.
    //
    // Aucun contrôle ne dira qu'un délai est trop court : un mauvais seuil
    // efface des données et rien ne rougit. La seule façon de le savoir est de
    // regarder ce verdict d'abord, sur les vraies données.
    app.get('/retention', async (c) => {
      const compte = await compteDe(c.req.raw.headers)
      if (compte === null) return sansCompte()

      const delais = options.delais ?? DELAIS_PAR_DEFAUT
      const verdict = await verdictDuCompte(base, compte, Date.now(), delais)
      return c.json({ ...verdict, delais }, 200, { 'Cache-Control': 'no-store' })
    })

    // Épingler, et décrocher. La borne se voit : un refus dit ce qu'il faut
    // faire — décrocher autre chose, ou emporter le trajet.
    app.on(['PUT', 'DELETE'], '/sessions/:cle/epingle', async (c) => {
      const compte = await compteDe(c.req.raw.headers)
      if (compte === null) return sansCompte()

      const rendu = await epingler(
        base,
        compte,
        c.req.param('cle'),
        c.req.method === 'PUT',
        options.epingles ?? EPINGLES_PAR_DEFAUT,
      )

      if (rendu.etat === 'inconnu') return c.notFound()
      // 409 : la demande est comprise, et refusée pour une raison qui ne
      // changera pas si on la rejoue. Le client ne doit pas réessayer.
      return c.json(rendu, rendu.etat === 'borne atteinte' ? 409 : 200)
    })

    app.delete('/sessions/:cle', async (c) => {
      const compte = await compteDe(c.req.raw.headers)
      if (compte === null) return sansCompte()

      // Effacer un trajet déjà parti n'est pas une panne : la voiture rejoue une
      // demande, et la seconde doit répondre comme la première.
      const efface = await effacerSession(base, compte, c.req.param('cle'))
      return c.json({ efface }, 200)
    })

    // --- Ce que la voiture envoie en roulant -------------------------------
    //
    // Traces, tranches de journal, relevés de mesure. Trois dossiers, une seule
    // table : ce sont trois fois la même chose, un nom, des octets, une date.
    app.on(['GET', 'PUT'], '/:dossier{traces|journal|mesures}/*', async (c) => {
      const compte = await compteDe(c.req.raw.headers)
      if (compte === null) return sansCompte()

      const chemin = new URL(c.req.url).pathname
      const [, dossier = '', ...reste] = chemin.split('/')
      if (!estUnDossier(dossier)) return c.notFound()

      const nomBrut = reste.join('/')
      if (nomBrut === '') {
        if (c.req.method !== 'GET') return c.text('', 405)
        return c.json(await listerDepots(base, compte, dossier), 200, {
          'Cache-Control': 'no-store',
        })
      }

      let nom: string
      try {
        nom = decodeURIComponent(nomBrut)
      } catch {
        return c.notFound()
      }

      if (c.req.method === 'PUT') {
        const octets = Buffer.from(await c.req.arrayBuffer())
        // `?reprise=1` dit « ceci n'est pas un dépôt du jour, c'est un
        // déménagement » : le fichier entre archivé, comme ceux que la reprise
        // des anciens dossiers verse elle-même.
        const exemption = c.req.query('reprise') === '1' ? ('archive' as const) : undefined
        const ecrit = await ecrireDepot(base, compte, dossier, nom, octets, exemption)
        // 413, parce que le client ne rejoue pas ce code. Une charge refusée par
        // un code de panne ferait réessayer la voiture indéfiniment, pour un
        // envoi qui ne passera jamais.
        if (ecrit === 'trop gros') return c.text('charge trop grosse', 413)

        // La trace vient d'arriver, et c'est nous qui l'avons écrite : plus
        // besoin de scruter un dossier pour l'apprendre. La mesure se reprend
        // ici, et son échec ne fait pas échouer le dépôt — perdre une trace
        // qu'on vient de recevoir serait pire que la mesurer plus tard.
        if (dossier === 'traces') {
          try {
            await reprendreApresDepot(base, compte, nom)
          } catch (erreur) {
            console.error(`reprise du profil mesuré : ${String(erreur)}`)
          }
        }

        return c.text('', 201)
      }

      const octets = await lireDepot(base, compte, dossier, nom)
      if (octets === null) return c.notFound()
      // Le type suit le nom, comme le faisait le serveur de fichiers. Le client,
      // lui, décide de décompresser au nom et ignore ce que le serveur annonce.
      return new Response(new Uint8Array(octets), {
        status: 200,
        headers: { 'Content-Type': typeDe(nom), 'Cache-Control': 'no-store' },
      })
    })
  }

  // --- Les échantillons -----------------------------------------------------
  //
  // Deux sources, et c'est ce que le serveur de fichiers d'avant ne savait pas
  // faire. Les banques déposées vivent dans un volume ; la banque de
  // démonstration vient avec l'application. Le volume se montait **par-dessus**
  // le dossier des échantillons et masquait donc la démonstration, qui a dû être
  // rangée ailleurs et ramenée par un alias — au prix de son absence dans le
  // listage des banques. Ici, on regarde dans les deux, et le listage les réunit.
  app.get('/audio/*', (c) => {
    const chemin = new URL(c.req.url).pathname

    if (chemin.endsWith('/')) {
      const entrees = listerLesDeux(options, chemin.slice('/audio'.length))
      if (entrees === null) return c.notFound()
      // Jamais en cache : une banque déposée doit apparaître tout de suite.
      return c.json(entrees, 200, { 'Cache-Control': 'no-store' })
    }

    return servirDepuisLesDeux(options, chemin, c.req.raw.headers, CACHE_ECHANTILLONS) ?? c.notFound()
  })

  // --- Ce que l'application embarque ---------------------------------------
  app.get('*', (c) => {
    const chemin = new URL(c.req.url).pathname

    const reponse = servirDepuis(options.application, chemin, c.req.raw.headers, cachePour(chemin))
    if (reponse !== null) return reponse

    // Le repli de l'application à page unique, et ses deux limites.
    //
    // Il ne répond que pour une **navigation**, pas pour une ressource : servir
    // la page à la place d'une image ou d'un JSON rend un 200 là où il fallait
    // un 404. Et il ne répond jamais sur un chemin de données, pour la même
    // raison en pire — voir DONNEES.
    if (DONNEES.some((dossier) => chemin.startsWith(dossier))) return c.notFound()
    // La racine est une navigation par définition, quoi qu'annonce celui qui
    // demande : un client qui n'envoie pas d'en-tête `Accept` — une sonde de
    // santé, un outil en ligne de commande — doit obtenir la page, pas un 404.
    if (chemin !== '/' && !ressembleAUneNavigation(c.req.header('accept'))) return c.notFound()

    // Deux pages, deux replis : ouvrir le relecteur doit donner le relecteur, et
    // non l'application de conduite, ce qui se lirait comme un bug.
    const page = chemin.startsWith('/relecteur') ? '/relecteur.html' : '/index.html'
    return servirDepuis(options.application, page, new Headers(), 'no-cache') ?? c.notFound()
  })

  return app
}

/**
 * Le refus, quand la requête ne porte pas de compte.
 *
 * **401 et pas un code de panne**, et la distinction engage tout le reste : le
 * client ne rejoue ni 401 ni 403, alors qu'il rejoue indéfiniment tout code qui
 * ressemble à une panne passagère. Une session expirée rendue en 500 ferait
 * rejouer un dépôt toutes les minutes, pour un envoi qui ne passera jamais.
 *
 * Pas d'en-tête `WWW-Authenticate` : il n'y a plus de mot de passe à demander, et
 * en mettre un ferait surgir la fenêtre du navigateur pour une saisie qui
 * n'ouvrirait rien.
 */
function sansCompte(): Response {
  return new Response('compte requis', { status: 401 })
}

function cachePour(chemin: string): string | undefined {
  if (chemin.startsWith('/assets/') || chemin.startsWith('/icons/')) return CACHE_RESSOURCES
  // Le service worker et la page d'entrée décident de ce qui bascule sur une
  // nouvelle version : les mettre en cache figerait l'application à la version
  // du jour où elle a été ouverte.
  if (chemin === '/sw.js' || chemin.endsWith('.html') || chemin === '/') return 'no-cache'
  return undefined
}

/**
 * Cette requête demande-t-elle une page, ou une ressource ?
 *
 * Le navigateur annonce `text/html` en tête de ce qu'il accepte quand il navigue,
 * et jamais quand il va chercher une image ou un script. C'est ce qui permet de
 * ne replier que les navigations.
 */
function ressembleAUneNavigation(accept: string | undefined): boolean {
  return accept !== undefined && accept.includes('text/html')
}

/**
 * Sert un fichier, en passant les en-têtes de la requête.
 *
 * Les en-têtes ne sont pas un détail de plomberie : c'est là que voyage la
 * demande de plage d'octets. Les oublier donne un serveur qui répond à tout par
 * le fichier entier — ce qui marche, et transfère cent mille octets là où le
 * client en demandait cent. Mesuré ici avant de l'écrire.
 */
function servirDepuis(
  racine: string,
  chemin: string,
  entetes: Headers,
  cache?: string,
): Response | null {
  const fichier = cheminSur(racine, chemin)
  if (fichier === null) return null

  const info = fichierOuRien(fichier)
  if (info === null) return null

  return servirFichier(fichier, info.taille, entetes, cache === undefined ? {} : { cache })
}

/** Les échantillons déposés d'abord, ceux de l'application ensuite. */
function servirDepuisLesDeux(
  options: OptionsDuServeur,
  chemin: string,
  entetes: Headers,
  cache: string,
): Response | null {
  const depose =
    options.echantillons === undefined
      ? null
      : servirDepuis(options.echantillons, chemin.slice('/audio'.length), entetes, cache)
  return depose ?? servirDepuis(options.application, chemin, entetes, cache)
}

/**
 * Le listage, au format que quatre modules du cœur attendent.
 *
 * Un tableau d'entrées `{ name, type }`, `type` valant `directory` ou `file` —
 * c'est la forme de l'autoindex de nginx, et le service worker distingue un
 * listage d'un échantillon à la seule barre oblique finale. Les deux sources
 * sont réunies, sans doublon : une banque déposée qui porterait le nom d'une
 * banque livrée l'emporte, comme pour les fichiers.
 */
function listerLesDeux(
  options: OptionsDuServeur,
  sousChemin: string,
): { name: string; type: 'file' | 'directory' }[] | null {
  const trouve = new Map<string, 'file' | 'directory'>()
  let auMoinsUn = false

  const sources = [
    options.echantillons === undefined ? null : cheminSur(options.echantillons, sousChemin),
    cheminSur(options.application, `/audio${sousChemin}`),
  ]

  for (const source of sources) {
    if (source === null) continue
    let entrees
    try {
      entrees = readdirSync(source, { withFileTypes: true })
    } catch {
      // Dossier absent : ce n'est pas une panne, c'est une source qui n'a rien
      // à dire. Le 404 ne sort que si aucune des deux n'existe.
      continue
    }
    auMoinsUn = true
    for (const entree of entrees) {
      if (!trouve.has(entree.name)) {
        trouve.set(entree.name, entree.isDirectory() ? 'directory' : 'file')
      }
    }
  }

  if (!auMoinsUn) return null

  return [...trouve]
    .map(([name, type]) => ({ name, type }))
    .sort((a, b) => a.name.localeCompare(b.name))
}
