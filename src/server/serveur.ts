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

import type { Role } from '../core/identity/roles'

import type { Base } from './base/base'
import { banquesInterdites, peutJouer, type DroitsSurLesBanques } from './banques'
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
import { archiveDuCompte } from './emporter'
import { cheminSur, estUnNomSimple, fichierOuRien, servirFichier, typeDe } from './fichiers'
import { lireProfilMesure, reprendreApresDepot } from './profil-mesure'
import { ecrireProfil, listerProfils, lireProfil } from './profils'
import { droitsDuCompte, ROLES_OFFERTS_PAR_DEFAUT, rolesDe } from './roles'

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
  /**
   * Les rôles offerts à n'importe quel compte.
   *
   * Les trois par défaut : tout le monde a tout, rien n'étant encaissé. Le jour
   * de l'ouverture, c'est **cette valeur** qui change, et rien d'autre.
   */
  roles?: readonly Role[]
  /** Les délais de rétention, en jours. Réglables par l'environnement. */
  delais?: Delais
  /**
   * Les échantillons déposés, s'il y en a.
   *
   * Absent, on sert uniquement ce que l'application embarque — c'est le cas
   * d'une installation neuve, qui doit quand même faire du son.
   */
  echantillons?: string
  /**
   * Les banques qui ne sont pas à nous, et qui a le droit de les jouer.
   *
   * Absente : aucune n'est restreinte, et c'est le cas de qui déploie chez lui.
   * Elle se déclare par l'environnement et **jamais par une route** — c'est ce
   * qui fait qu'aucun appel ne peut s'accorder ce droit.
   */
  banques?: DroitsSurLesBanques
}

/**
 * La politique de contenu, et pourquoi chaque morceau est là.
 *
 * Une politique posée à l'aveugle coupe le son **sans rien dire** : le navigateur
 * refuse en silence et l'application démarre muette. Chaque desserrage ci-dessous
 * a donc une raison nommée, et le jeu de requêtes d'accord plus l'essai dans un
 * navigateur sont ce qui a permis de l'écrire.
 *
 * - `'wasm-unsafe-eval'` — le moteur simulé est un module WebAssembly, et sans
 *   ce mot il ne s'instancie pas du tout.
 * - `blob:` dans `script-src` — **l'horloge audio et le joueur de synthèse sont
 *   fabriqués à la volée** et chargés par `audioWorklet.addModule` depuis une
 *   adresse `blob:`. C'est le desserrage qui coûte le plus cher, et le retirer
 *   demanderait de livrer ces deux modules en fichiers, ce qui touche une pièce
 *   délicate du projet. À reprendre le jour où l'on y touchera pour autre chose.
 * - `'unsafe-inline'` dans `style-src` — les liaisons de style de Vue posent des
 *   attributs `style`. Le risque est sans commune mesure avec celui d'un script.
 * - `https:` dans `img-src` — le portrait d'un compte tenu ailleurs vient de chez
 *   le fournisseur.
 * - `frame-ancestors 'none'` — rien n'a de raison d'encadrer cette application,
 *   et l'encadrer est la moitié d'un détournement de clic.
 */
const POLITIQUE_DE_CONTENU = [
  "default-src 'self'",
  "script-src 'self' blob: 'wasm-unsafe-eval'",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob:",
  "connect-src 'self'",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

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
 *
 * **Le service worker tient la même liste**, pour une raison voisine : ce qui
 * appartient à un compte ne se met pas en cache. Un fichier statique ne peut
 * pas importer d'ici, donc la liste y est recopiée, et `src/core/sw.test.ts`
 * vérifie que les deux disent la même chose.
 */
export const DONNEES = [
  '/api/',
  '/profiles/',
  '/engines/',
  '/gearboxes/',
  '/traces/',
  '/journal/',
  '/mesures/',
  '/mesure-voiture/',
  '/mon-compte/',
  '/sessions/',
  '/retention',
]

export function creerServeur(options: OptionsDuServeur): Hono {
  const app = new Hono()

  /**
   * De quoi savoir si une requête porte un compte, même hors des dossiers de
   * données. Les échantillons en ont besoin, et ils se servent sans base.
   *
   * `null` quand aucune identité n'est montée : il n'y a alors pas de session à
   * lire, et rien ne peut être gardé.
   */
  const sessionDe = options.identite === undefined ? null : lecteurDeCompte(options.identite)

  const droitsSurLesBanques: DroitsSurLesBanques = options.banques ?? {
    restreintes: new Set<string>(),
    accordees: new Map<string, ReadonlySet<string>>(),
  }

  // --- Ce que le serveur dit de lui-même ------------------------------------
  //
  // **En premier, et sur tout** : une réponse servie par une route déclarée plus
  // bas doit les porter aussi, et il n'y a pas de raison d'en exempter une.
  //
  // `nosniff` n'est pas décoratif ici : le serveur annonce des types que le
  // navigateur **exige** — un module WebAssembly deviné autrement ne démarre
  // pas — et un navigateur qui devine finit par deviner de travers.
  app.use('*', async (c, next) => {
    await next()
    c.header('Content-Security-Policy', POLITIQUE_DE_CONTENU)
    c.header('X-Content-Type-Options', 'nosniff')
    // L'adresse complète ne part pas chez un tiers : un profil partagé voyage
    // dans l'adresse, et elle n'a rien à faire dans le journal de quelqu'un.
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
  })

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

    const compteDe = lecteurDeCompte(identite)

    const offerts = options.roles ?? ROLES_OFFERTS_PAR_DEFAUT

    /** Ce que ce compte porte, à cet instant. */
    const rolesDu = async (compte: string): Promise<Role[]> =>
      rolesDe(await droitsDuCompte(base, compte, Date.now(), offerts))

    /**
     * Le compte de cette requête, s'il a le rôle qu'elle demande.
     *
     * **C'est le seul contrôle qui protège.** L'écran, lui, cache ce qu'un rôle
     * n'ouvre pas, mais un navigateur affiche ce qu'il veut et peut appeler ce
     * qu'il veut : ce qui compte est ici. Rend la réponse à renvoyer quand la
     * requête n'a pas de compte, ou que son compte n'ouvre pas ce rôle.
     */
    const compteAyantDroit = async (entetes: Headers, role: Role): Promise<string | Response> => {
      const compte = await compteDe(entetes)
      if (compte === null) return sansCompte()
      if (!(await rolesDu(compte)).includes(role)) return sansDroit(role)
      return compte
    }

    /**
     * Les rôles du compte, et ce qui est offert à tout le monde.
     *
     * L'écran range la réponse et s'en sert hors réseau — d'où les échéances,
     * qui lui permettent de refermer un droit sans avoir à redemander.
     */
    app.get('/api/droits', async (c) => {
      const compte = await compteDe(c.req.raw.headers)
      if (compte === null) return sansCompte()

      const droits = await droitsDuCompte(base, compte, Date.now(), offerts)
      return c.json(
        {
          // À qui appartiennent ces droits. L'écran range la réponse et s'en
          // sert hors réseau : sans ce nom, une copie survit à un changement de
          // compte et parle de l'autre. Elle était effacée aux trois endroits où
          // le compte change, mais par discipline — et une quatrième route
          // arrivera. Ici, la discordance se voit toute seule.
          compte,
          droits: droits.map(({ role, expireLe }) => ({
            role,
            expireLe: expireLe === null ? null : new Date(expireLe).toISOString(),
          })),
          offerts,
        },
        200,
        { 'Cache-Control': 'no-store' },
      )
    })

    app.on(['GET', 'PUT'], '/profiles/*', async (c) => {
      const compte = await compteAyantDroit(c.req.raw.headers, 'conduite')
      if (compte instanceof Response) return compte

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
      // Un nom, et non un chemin : voir `estUnNomSimple`. Refusé ici, à l'entrée,
      // plutôt que rattrapé plus tard par ce qui le relit.
      if (!estUnNomSimple(nom)) return c.notFound()

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
      // **Lire n'est pas déposer.** La voiture lit les moteurs qu'elle joue, et
      // ne les fabrique pas : c'est l'atelier qui dépose. Les deux gestes
      // passent par la même adresse, et c'est le seul endroit où la méthode
      // décide du rôle.
      const role = c.req.method === 'PUT' ? 'atelier' : 'conduite'
      const compte = await compteAyantDroit(c.req.raw.headers, role)
      if (compte instanceof Response) return compte

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
      // Un nom, et non un chemin : voir `estUnNomSimple`. Refusé ici, à l'entrée,
      // plutôt que rattrapé plus tard par ce qui le relit.
      if (!estUnNomSimple(nom)) return c.notFound()

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
      // Le rôle manquant se traite comme le compte manquant, et pour la même
      // raison : l'écran sait déjà se passer de cette mesure, et un refus franc
      // l'enverrait afficher une panne là où il n'y a rien à voir.
      const compte = await compteDe(c.req.raw.headers)
      const ouvert = compte !== null && (await rolesDu(compte)).includes('conduite')
      const contenu = ouvert && compte !== null ? await lireProfilMesure(base, compte) : null
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
      const compte = await compteAyantDroit(c.req.raw.headers, 'conduite')
      if (compte instanceof Response) return compte

      return c.json(await listerSessions(base, compte), 200, { 'Cache-Control': 'no-store' })
    })

    // Un fichier, pas quarante-deux : c'est ce qui rend l'effacement acceptable,
    // l'archive longue étant alors chez l'utilisateur et non sur le serveur.
    app.get('/sessions/:cle/archive.zip', async (c) => {
      const compte = await compteAyantDroit(c.req.raw.headers, 'conduite')
      if (compte instanceof Response) return compte

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

    // Tout ce qu'un compte porte, en un fichier.
    //
    // Ce sont ses réglages, ses trajets et ses mesures : rien ne doit l'obliger
    // à passer par nous pour les relire, et c'est ce qui rend une suppression
    // acceptable. Le navigateur de la voiture, lui, refuse les
    // téléchargements — l'écran le dit, et renvoie vers un poste de travail.
    //
    // **Aucun rôle n'est exigé ici**, et c'est délibéré : ce sont ses données,
    // pas une fonction de l'application. Les lui refuser parce qu'un droit s'est
    // refermé reviendrait à les retenir.
    app.get('/mon-compte/archive.zip', async (c) => {
      const compte = await compteDe(c.req.raw.headers)
      if (compte === null) return sansCompte()

      const archive = archiveDuCompte(base, compte)
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
      const compte = await compteAyantDroit(c.req.raw.headers, 'conduite')
      if (compte instanceof Response) return compte

      const delais = options.delais ?? DELAIS_PAR_DEFAUT
      const verdict = await verdictDuCompte(base, compte, Date.now(), delais)
      return c.json({ ...verdict, delais }, 200, { 'Cache-Control': 'no-store' })
    })

    // Épingler, et décrocher. La borne se voit : un refus dit ce qu'il faut
    // faire — décrocher autre chose, ou emporter le trajet.
    app.on(['PUT', 'DELETE'], '/sessions/:cle/epingle', async (c) => {
      const compte = await compteAyantDroit(c.req.raw.headers, 'conduite')
      if (compte instanceof Response) return compte

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
      const compte = await compteAyantDroit(c.req.raw.headers, 'conduite')
      if (compte instanceof Response) return compte

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
      const compte = await compteAyantDroit(c.req.raw.headers, 'conduite')
      if (compte instanceof Response) return compte

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
      // Un nom, et non un chemin : voir `estUnNomSimple`. Refusé ici, à l'entrée,
      // plutôt que rattrapé plus tard par ce qui le relit.
      if (!estUnNomSimple(nom)) return c.notFound()

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
  app.get('/audio/*', async (c) => {
    // **Un compte, et pas un rôle.** Les échantillons sont le plus gros poste de
    // trafic du serveur, et ils se servaient à qui connaissait l'adresse : c'est
    // la seule ressource que rien ne gardait. L'application s'ouvre un compte
    // toute seule au démarrage, donc une voiture ne voit aucune différence ;
    // exiger un rôle, en revanche, fermerait la banque à qui n'a plus le sien,
    // et la voiture se tairait.
    //
    // Sans identité montée, il n'y a pas de session à lire et on sert comme
    // avant : c'est la configuration d'un poste de développement, pas celle d'un
    // serveur exposé.
    const compte = sessionDe === null ? null : await sessionDe(c.req.raw.headers)
    if (sessionDe !== null && compte === null) return sansCompte()

    const chemin = new URL(c.req.url).pathname
    // `/audio/<banque>/<fichier>` — le nom voyage encodé dans l'adresse.
    const banque = nomDeLaBanque(chemin)

    // **Une banque qui n'est pas à nous ne descend que chez qui y a droit**, et
    // elle disparaît du listage des autres : cacher les octets en laissant les
    // noms ne cacherait rien. Un refus se donne en 404 et non en 403 — dire
    // « interdit » confirmerait l'existence de ce qu'on cherche à taire.
    if (options.base !== undefined && compte !== null && droitsSurLesBanques.restreintes.size > 0) {
      const base = options.base

      if (chemin === '/audio/') {
        const entrees = listerLesDeux(options, '/')
        if (entrees === null) return c.notFound()
        const interdites = await banquesInterdites(base, droitsSurLesBanques, compte)
        return c.json(
          entrees.filter((entree) => !interdites.has(entree.name)),
          200,
          { 'Cache-Control': 'no-store' },
        )
      }

      if (banque !== null && !(await peutJouer(base, droitsSurLesBanques, compte, banque))) {
        return c.notFound()
      }
    }

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
 * À qui appartient cette requête ?
 *
 * Rend le compte de la session, ou `null` quand il n'y en a pas. Le témoin
 * voyage tout seul — la page et le serveur sont sur la même origine —, il n'y a
 * donc rien à saisir ni à composer.
 *
 * Hors de `creerServeur` parce que deux endroits en ont besoin, et qu'ils n'ont
 * pas les mêmes conditions : les dossiers de données exigent une base, les
 * échantillons non.
 */
function lecteurDeCompte(identite: Identite): (entetes: Headers) => Promise<string | null> {
  return async (entetes) => {
    try {
      const session = await identite.api.getSession({ headers: entetes })
      return session?.user.id ?? null
    } catch {
      // Une session illisible n'est pas une panne du serveur : c'est une requête
      // sans compte, et elle se traite comme telle.
      return null
    }
  }
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

/**
 * Le compte existe, et n'ouvre pas ça.
 *
 * 403 et non 401 : se reconnecter n'y changerait rien, et le client ne doit pas
 * rejouer la demande. Le rôle manquant est nommé pour que l'écran puisse le
 * dire — il n'apprend rien à qui le lit, l'application étant publique.
 */
function sansDroit(role: string): Response {
  return new Response(`rôle requis : ${role}`, { status: 403 })
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

/**
 * Le nom de la banque que ce chemin désigne, ou rien.
 *
 * `/audio/<banque>/…`. Rend `null` sur `/audio/` lui-même, qui ne désigne pas
 * une banque mais leur liste.
 */
function nomDeLaBanque(chemin: string): string | null {
  const [, , banque = ''] = chemin.split('/')
  if (banque === '') return null
  try {
    return decodeURIComponent(banque)
  } catch {
    return null
  }
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
