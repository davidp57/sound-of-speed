/**
 * Ce que le serveur doit rendre, cas par cas.
 *
 * Ce fichier est la **description exécutable** du contrat entre l'application et
 * son serveur. Il est tiré d'un relevé de tous les appels réseau du dépôt, fait
 * le 12 septembre 2026 : vingt-deux requêtes distinctes, dont plusieurs dont la
 * rupture ne s'entend pas.
 *
 * Il sert de juge à la réécriture du serveur. Les tests du dépôt tournent sur
 * les sources et ne voient **rien** de ce qu'un serveur rend : le 12 septembre,
 * une image cassée est passée à travers une pull request entièrement verte pour
 * cette seule raison.
 *
 * **Les cas construisent leur propre état.** Un cas qui a besoin d'un profil le
 * dépose, puis le relit. Rien ne dépend de ce qui traîne sur le serveur, et le
 * jeu se rejoue deux fois de suite sans se contredire.
 */

/** Nom de fichier propre à une exécution, pour ne marcher sur personne. */
export function marque() {
  return `accord-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Le type d'un module JavaScript, tel que le navigateur l'exige pour `import`.
 *
 * Plusieurs orthographes ont cours et sont toutes acceptées par les
 * navigateurs ; c'est `text/html` ou `application/octet-stream` qui casse.
 */
const TYPES_JS = ['application/javascript', 'text/javascript', 'application/ecmascript']

/**
 * Les cas, dans l'ordre où on les lit plutôt que dans celui où ils comptent.
 *
 * Chaque cas porte : un nom, la requête, et ce qu'on attend. `attend` reçoit la
 * réponse et son corps, et lève quand quelque chose ne va pas — un message qui
 * dit ce qu'on espérait, pas « échec ».
 */
export function cas({ nom, administre = false }) {
  const profil = `${nom}.json`
  const tranche = `${nom}.jsonl.gz`
  // Une tranche au nom que la voiture donne : date, identifiant de session, rang.
  // C'est ce nom-là qui fait un trajet ; celui de `tranche`, libre, fait un
  // dépôt seul — les deux cas existent en base et les deux doivent s'effacer.
  const session = `2026-09-11-06-24-01_${nom.slice(-6)}`
  const trancheDeSession = `${session}_001.jsonl.gz`
  const releve = `${nom}-sonde.json`
  const contenuProfil = JSON.stringify({ name: 'Accord', sampleDir: 'gm-ls', layers: [] })
  const moteur = `${nom}-moteur.json`
  const boite = `${nom}-boite.json`
  const contenuMoteur = JSON.stringify({ version: 1, engine: { id: nom, name: 'Accord' } })
  const contenuBoite = JSON.stringify({ version: 1, gearbox: { id: nom, name: 'Accord' } })

  return [
    // --- L'application elle-même ------------------------------------------
    {
      nom: "la page d'accueil",
      requete: { chemin: '/' },
      attend: (r, corps) => {
        egal(r.status, 200, 'statut')
        vrai(corps.includes('<'), 'la réponse ressemble à du HTML')
      },
    },
    {
      nom: 'le relecteur a sa propre page',
      // Deux pages, deux replis : ouvrir le relecteur hors réseau doit donner le
      // relecteur, pas l'application de conduite.
      requete: { chemin: '/relecteur.html' },
      attend: (r) => egal(r.status, 200, 'statut'),
    },
    {
      nom: 'la régie a sa propre page',
      // Troisième entrée, même raison : son code n'a rien à faire dans ce que la
      // voiture télécharge. Et c'est le seul contrôle qui regarde une vraie
      // réponse — une image qui ne se construisait plus est passée à travers une
      // pull request entièrement verte, faute de celui-ci.
      part: 'durcissement',
      requete: { chemin: '/regie.html' },
      attend: (r, corps) => {
        egal(r.status, 200, 'statut')
        vrai(corps.includes('Régie'), 'la page servie est bien la régie')
      },
    },
    {
      nom: 'la régie ne dit rien à qui n’administre pas',
      // 404 comme une banque restreinte, et non 403 : l'existence de la régie
      // n'a pas à être une information gratuite. Le jeu s'annonce avec un compte
      // ordinaire, donc sans administration.
      part: 'durcissement',
      requete: { chemin: '/api/regie/comptes', compte: true },
      attend: (r) => egal(r.status, 404, 'statut'),
    },
    {
      nom: 'la régie ne dit rien non plus sans session',
      // Le même 404, et jamais un 401 qui renseignerait.
      part: 'durcissement',
      requete: { chemin: '/api/regie/comptes' },
      attend: (r) => egal(r.status, 404, 'statut'),
    },

    // --- Ce qu'un administrateur obtient, quand on en donne un ---------------
    //
    // Sautés sans `--admin` : le jeu prend un compte anonyme, qui ne peut pas
    // être administrateur — l'administration vient d'une adresse déclarée dans
    // la pile. Avec l'option, on vérifie l'autre moitié du contrôle : que la
    // porte s'ouvre pour qui est déclaré.
    ...(administre
      ? [
          {
            nom: 'la régie s’ouvre à l’administrateur déclaré',
            part: 'regie',
            requete: { chemin: '/api/regie/comptes', administrateur: true },
            attend: (r, corps) => {
              egal(r.status, 200, 'statut')
              vrai(String(corps).trimStart().startsWith('['), 'une liste de comptes')
            },
          },
          {
            nom: 'la trace d’administration se lit',
            part: 'regie',
            requete: { chemin: '/api/regie/trace', administrateur: true },
            attend: (r) => egal(r.status, 200, 'statut'),
          },
        ]
      : []),
    {
      nom: 'le manifeste',
      requete: { chemin: '/manifest.webmanifest' },
      attend: (r) => egal(r.status, 200, 'statut'),
    },
    {
      nom: 'le service worker est servi à la racine',
      // Son champ d'action est la racine : servi ailleurs, il ne contrôlerait
      // pas les pages, et l'application cesserait de marcher hors réseau.
      requete: { chemin: '/sw.js' },
      attend: (r) => {
        egal(r.status, 200, 'statut')
        typeParmi(r, TYPES_JS)
      },
    },
    {
      nom: 'le média silencieux qui tient la session audio',
      requete: { chemin: '/silence.mp3' },
      attend: (r) => egal(r.status, 200, 'statut'),
    },

    // --- Le moteur simulé, et ses deux types obligatoires -------------------
    {
      nom: 'le module du moteur simulé, avec un type que « import » accepte',
      // Sans un type JavaScript, l'import du module échoue et le son généré en
      // direct ne démarre pas du tout.
      requete: { chemin: '/sonde/probe.mjs' },
      attend: (r) => {
        egal(r.status, 200, 'statut')
        typeParmi(r, TYPES_JS)
      },
    },
    {
      nom: 'le binaire du moteur simulé, en application/wasm',
      // `instantiateStreaming` **refuse** tout autre type : c'est une règle du
      // navigateur, pas une préférence.
      requete: { chemin: '/sonde/probe.wasm' },
      attend: (r) => {
        egal(r.status, 200, 'statut')
        typeParmi(r, ['application/wasm'])
      },
    },
    {
      nom: 'la taille du binaire se demande sans le télécharger',
      // On n'exige pas que la taille soit annoncée : un serveur qui comprime à
      // la volée ne peut pas la connaître d'avance, et le client le tolère — il
      // retombe sur zéro. Ce qui compte, c'est que la demande aboutisse sans
      // transférer le binaire.
      requete: { chemin: '/sonde/probe.wasm', methode: 'HEAD' },
      attend: (r, corps) => {
        egal(r.status, 200, 'statut')
        egal(corps.length, 0, 'une réponse à HEAD ne porte pas de corps')
      },
    },
    {
      nom: "une réponse d'échappement",
      requete: { chemin: '/impulse/smooth_39.wav' },
      attend: (r) => egal(r.status, 200, 'statut'),
    },

    {
      nom: 'le serveur dit ce qu’il autorise, et refuse d’être encadré',
      part: 'durcissement',
      // Une politique de contenu posée à l'aveugle coupe le son sans rien dire :
      // le navigateur refuse en silence et l'application démarre muette. Les
      // deux desserrages qui la rendent viable sont donc vérifiés nommément.
      requete: { chemin: '/', entetes: { Accept: 'text/html' } },
      attend: (r) => {
        egal(r.status, 200, 'statut')
        egal(r.headers.get('x-content-type-options'), 'nosniff', 'nosniff')
        vrai(r.headers.get('referrer-policy') !== null, 'une politique de provenance est servie')
        const politique = r.headers.get('content-security-policy') ?? ''
        vrai(politique.includes("frame-ancestors 'none'"), 'l’encadrement est refusé')
        vrai(politique.includes("object-src 'none'"), 'les objets sont refusés')
        // Sans lui, le moteur simulé ne s'instancie pas du tout.
        vrai(politique.includes("'wasm-unsafe-eval'"), 'le WebAssembly reste permis')
        // Sans lui, l'horloge audio et le joueur de synthèse ne se chargent pas.
        vrai(/script-src[^;]*blob:/.test(politique), 'les modules de worklet restent permis')
      },
    },

    // --- Les banques -------------------------------------------------------
    {
      nom: 'un échantillon ne descend pas sans compte',
      part: 'durcissement',
      // Les échantillons sont le plus gros poste de trafic du serveur, et ils se
      // servaient à qui connaissait l'adresse. Un compte suffit — l'application
      // s'en crée un au démarrage — mais il en faut un.
      requete: { chemin: '/audio/gm-ls/on-750.flac' },
      attend: (r) => egal(r.status, 401, 'statut'),
    },
    {
      nom: 'le listage des banques ne se lit pas sans compte',
      part: 'durcissement',
      // Le fermer aussi : le listage dit quelles banques existent, et cacher les
      // octets en laissant les noms ne cacherait rien.
      requete: { chemin: '/audio/', entetes: { Accept: 'application/json' } },
      attend: (r) => egal(r.status, 401, 'statut'),
    },
    {
      nom: 'le listage des banques, au format autoindex',
      // Quatre modules du cœur lisent cette forme, et le service worker
      // distingue un listage d'un échantillon à la seule barre oblique finale.
      //
      // On vérifie la **forme**, et non ce qui s'y trouve : le contenu dépend de
      // ce qui a été déposé sur le serveur interrogé, et la banque de
      // démonstration n'y figure pas — elle vit dans l'image, derrière un alias,
      // parce que le volume des échantillons masque ce que l'image place là.
      requete: { chemin: '/audio/', compte: true, entetes: { Accept: 'application/json' } },
      attend: (r, corps) => {
        egal(r.status, 200, 'statut')
        autoindex(corps)
      },
    },
    {
      nom: "le listage d'une banque",
      requete: { chemin: '/audio/gm-ls/', compte: true, entetes: { Accept: 'application/json' } },
      attend: (r, corps) => {
        egal(r.status, 200, 'statut')
        const entrees = autoindex(corps)
        vrai(
          entrees.some((e) => e.name.endsWith('.flac') && e.type === 'file'),
          'des échantillons sont listés comme fichiers',
        )
      },
    },
    {
      nom: 'un échantillon se télécharge',
      requete: { chemin: '/audio/gm-ls/on-750.flac', compte: true },
      attend: (r, corps) => {
        egal(r.status, 200, 'statut')
        vrai(corps.length > 1000, 'le corps a la taille d’un échantillon')
      },
    },
    {
      nom: 'un échantillon se demande par plage d’octets',
      // Le navigateur le fait de lui-même sur les médias. Un serveur qui rend
      // 200 avec tout le fichier n'est pas faux, mais un qui rend 206 doit
      // rendre la bonne plage.
      requete: { chemin: '/audio/gm-ls/on-750.flac', compte: true, entetes: { Range: 'bytes=0-99' } },
      attend: (r, corps) => {
        vrai([200, 206].includes(r.status), `statut 200 ou 206, reçu ${r.status}`)
        if (r.status === 206) {
          egal(corps.length, 100, 'la plage demandée fait cent octets')
          vrai(r.headers.get('content-range') !== null, 'une plage est annoncée')
        }
      },
    },

    // --- Le piège du repli d'application ----------------------------------
    {
      nom: "un chemin de données absent rend un vrai 404, pas la page d'accueil",
      // Le repli d'application à page unique ne doit **pas** répondre ici. Quand
      // il le fait, le client reçoit du HTML là où il attend du JSON — le cas est
      // déjà connu côté client, qui le classe « illisible ».
      requete: { chemin: '/mesure-voiture/rien-du-tout.json' },
      attend: (r, corps) => {
        egal(r.status, 404, 'statut')
        vrai(!corps.includes('<!DOCTYPE'), "la réponse n'est pas la page d'application")
      },
    },
    {
      nom: 'une trace absente rend un vrai 404',
      part: 'depots',
      requete: { chemin: '/traces/rien-du-tout.jsonl', compte: true },
      attend: (r) => egal(r.status, 404, 'statut'),
    },
    {
      nom: 'un nom qui compose un chemin n’entre pas',
      part: 'durcissement',
      // Le nom ressort concaténé dans l'archive du compte, et une remontée y
      // produit une entrée qui s'écrit hors du dossier chez celui qui extrait.
      requete: {
        chemin: '/traces/..%2F..%2Fdehors.txt',
        compte: true,
        methode: 'PUT',
        corps: 'charge',
      },
      attend: (r) => egal(r.status, 404, 'statut'),
    },

    // --- Ce qui demande un compte -----------------------------------------
    {
      nom: 'le dépôt refuse sans compte, et le refus ne se rejoue pas',
      part: 'profils',
      // 401 et 403 disent « refusé » : le client n'essaie pas de rejouer. Tout
      // autre code le ferait réessayer indéfiniment.
      requete: { chemin: `/profiles/${profil}`, methode: 'PUT', corps: contenuProfil },
      attend: (r) => vrai([401, 403].includes(r.status), `401 ou 403, reçu ${r.status}`),
    },
    {
      nom: 'la bibliothèque de profils refuse sans compte',
      part: 'profils',
      requete: { chemin: '/profiles/', entetes: { Accept: 'application/json' } },
      attend: (r) => vrai([401, 403].includes(r.status), `401 ou 403, reçu ${r.status}`),
    },
    {
      nom: 'un profil se dépose avec un compte',
      part: 'profils',
      requete: {
        chemin: `/profiles/${profil}`,
        methode: 'PUT',
        corps: contenuProfil,
        compte: true,
      },
      attend: (r) => vrai(r.ok, `un code de succès, reçu ${r.status}`),
    },
    {
      nom: 'le profil déposé se relit tel quel',
      part: 'profils',
      requete: { chemin: `/profiles/${profil}`, compte: true },
      attend: (r, corps) => {
        egal(r.status, 200, 'statut')
        egal(corps.toString('utf8'), contenuProfil, 'le contenu rendu')
      },
    },
    {
      nom: 'le profil déposé apparaît au listage',
      part: 'profils',
      requete: { chemin: '/profiles/', compte: true, entetes: { Accept: 'application/json' } },
      attend: (r, corps) => {
        egal(r.status, 200, 'statut')
        const entrees = autoindex(corps)
        vrai(
          entrees.some((e) => e.name === profil && e.type === 'file'),
          'le profil déposé est listé comme fichier',
        )
      },
    },
    {
      nom: 'déposer deux fois le même nom remplace',
      part: 'profils',
      requete: {
        chemin: `/profiles/${profil}`,
        methode: 'PUT',
        corps: contenuProfil,
        compte: true,
      },
      attend: (r) => vrai(r.ok, `un code de succès, reçu ${r.status}`),
    },

    // --- Les moteurs et les boîtes -----------------------------------------
    //
    // Deux registres que le serveur de fichiers n'a jamais servis : ils sont nés
    // avec la base. La part est donc à part, et l'ancien serveur ne se la voit
    // pas demander — non pour lui épargner un échec, mais parce que la
    // question n'a pas de sens pour lui.
    {
      nom: 'le registre des moteurs refuse sans compte',
      part: 'entites',
      requete: { chemin: '/engines/', entetes: { Accept: 'application/json' } },
      attend: (r) => vrai([401, 403].includes(r.status), `401 ou 403, reçu ${r.status}`),
    },
    {
      nom: 'un moteur se dépose avec un compte',
      part: 'entites',
      requete: { chemin: `/engines/${moteur}`, methode: 'PUT', corps: contenuMoteur, compte: true },
      attend: (r) => vrai(r.ok, `un code de succès, reçu ${r.status}`),
    },
    {
      nom: 'le moteur déposé se relit tel quel',
      part: 'entites',
      requete: { chemin: `/engines/${moteur}`, compte: true },
      attend: (r, corps) => {
        egal(r.status, 200, 'statut')
        egal(corps.toString('utf8'), contenuMoteur, 'le contenu rendu')
      },
    },
    {
      nom: 'le moteur déposé apparaît au listage, dans la forme des profils',
      part: 'entites',
      requete: { chemin: '/engines/', compte: true, entetes: { Accept: 'application/json' } },
      attend: (r, corps) => {
        egal(r.status, 200, 'statut')
        const entrees = autoindex(corps)
        vrai(
          entrees.some((e) => e.name === moteur && e.type === 'file'),
          'le moteur déposé est listé comme fichier',
        )
      },
    },
    {
      nom: 'déposer deux fois le même moteur remplace',
      part: 'entites',
      requete: { chemin: `/engines/${moteur}`, methode: 'PUT', corps: contenuMoteur, compte: true },
      attend: (r) => vrai(r.ok, `un code de succès, reçu ${r.status}`),
    },
    {
      nom: 'le listage date ses entrées, comme l’autoindex le faisait',
      part: 'entites',
      // Sans la date, la voiture ne peut pas savoir au lancement si la base
      // porte plus récent qu'elle sans télécharger chaque fichier pour le
      // comparer. Les quatre listages la rendent ; seul celui-ci est vérifié
      // ici, parce que c'est le seul que l'ancien serveur n'a jamais rendu.
      requete: { chemin: '/engines/', compte: true, entetes: { Accept: 'application/json' } },
      attend: (r, corps) => {
        egal(r.status, 200, 'statut')
        const entree = autoindex(corps).find((e) => e.name === moteur)
        vrai(entree !== undefined, 'le moteur déposé est listé')
        vrai(
          !Number.isNaN(Date.parse(entree?.mtime ?? '')),
          `une date lisible, reçu ${String(entree?.mtime)}`,
        )
      },
    },
    {
      nom: 'un moteur absent rend un vrai 404',
      part: 'entites',
      requete: { chemin: '/engines/rien-du-tout.json', compte: true },
      attend: (r) => egal(r.status, 404, 'statut'),
    },
    {
      nom: 'une boîte se dépose et se relit, comme un moteur',
      part: 'entites',
      requete: { chemin: `/gearboxes/${boite}`, methode: 'PUT', corps: contenuBoite, compte: true },
      attend: (r) => vrai(r.ok, `un code de succès, reçu ${r.status}`),
    },
    {
      nom: 'la boîte déposée apparaît au listage des boîtes, et pas à celui des moteurs',
      part: 'entites',
      requete: { chemin: '/gearboxes/', compte: true, entetes: { Accept: 'application/json' } },
      attend: (r, corps) => {
        egal(r.status, 200, 'statut')
        const entrees = autoindex(corps)
        vrai(
          entrees.some((e) => e.name === boite && e.type === 'file'),
          'la boîte déposée est listée comme fichier',
        )
        vrai(
          !entrees.some((e) => e.name === moteur),
          'le moteur ne se retrouve pas dans le registre des boîtes',
        )
      },
    },

    // --- Ce que la voiture dépose en roulant -------------------------------
    {
      nom: 'une tranche de journal compressée se dépose',
      part: 'depots',
      requete: {
        chemin: `/journal/${tranche}`,
        methode: 'PUT',
        corps: '{"t":0}\n',
        entetes: { 'Content-Type': 'application/gzip' },
        compte: true,
      },
      attend: (r) => vrai(r.ok, `un code de succès, reçu ${r.status}`),
    },
    {
      nom: 'le journal se liste',
      part: 'depots',
      requete: { chemin: '/journal/', compte: true, entetes: { Accept: 'application/json' } },
      attend: (r, corps) => {
        egal(r.status, 200, 'statut')
        vrai(
          autoindex(corps).some((e) => e.name === tranche),
          'la tranche déposée est listée',
        )
      },
    },
    {
      nom: 'une tranche de trace se dépose et redescend sous le nom qui la dit compressée',
      part: 'depots',
      // Le client décide de décompresser **au nom du fichier**, jamais au type
      // annoncé par le serveur. Le nom doit donc revenir tel qu'il est parti.
      requete: {
        chemin: `/traces/${tranche}`,
        methode: 'PUT',
        corps: '{"t":0}\n',
        entetes: { 'Content-Type': 'application/gzip' },
        compte: true,
      },
      attend: (r) => vrai(r.ok, `un code de succès, reçu ${r.status}`),
    },
    {
      nom: 'la trace déposée se liste sous son nom exact',
      part: 'depots',
      requete: { chemin: '/traces/', compte: true, entetes: { Accept: 'application/json' } },
      attend: (r, corps) => {
        egal(r.status, 200, 'statut')
        vrai(
          autoindex(corps).some((e) => e.name === tranche),
          'la trace déposée est listée, extension comprise',
        )
      },
    },
    {
      nom: 'un relevé de sonde se dépose',
      part: 'depots',
      // Déposé par une page autonome, hors de l'application, qui relit le compte
      // dans le stockage du navigateur et compose son propre en-tête.
      requete: {
        chemin: `/mesures/${releve}`,
        methode: 'PUT',
        corps: '{"sonde":true}',
        compte: true,
      },
      attend: (r) => vrai(r.ok, `un code de succès, reçu ${r.status}`),
    },
    // --- Les trajets, et ce qu'on en fait ----------------------------------
    //
    // Une part à eux : le serveur de fichiers ne sait pas regrouper des tranches
    // en trajets, et ne le saura jamais. La question n'a pas de sens pour lui,
    // comme celle des moteurs et des boîtes.
    {
      nom: 'une tranche au nom de session se dépose',
      part: 'trajets',
      requete: {
        chemin: `/traces/${trancheDeSession}`,
        methode: 'PUT',
        corps: '{"t":0}\n',
        entetes: { 'Content-Type': 'application/gzip' },
        compte: true,
      },
      attend: (r) => vrai(r.ok, `un code de succès, reçu ${r.status}`),
    },
    {
      nom: 'les trajets refusent sans compte',
      part: 'trajets',
      requete: { chemin: '/sessions/', entetes: { Accept: 'application/json' } },
      attend: (r) => vrai(r.status === 401 || r.status === 403, `un refus, reçu ${r.status}`),
    },
    {
      nom: 'le trajet réunit ses tranches, avec son poids et ce qui le retient',
      part: 'trajets',
      requete: { chemin: '/sessions/', compte: true, entetes: { Accept: 'application/json' } },
      attend: (r, corps) => {
        egal(r.status, 200, 'statut')
        const trajets = JSON.parse(corps.toString('utf8'))
        vrai(Array.isArray(trajets), 'le listage des trajets est un tableau')
        const trouve = trajets.find((t) => t.cle === session)
        vrai(trouve !== undefined, `le trajet ${session} est listé`)
        vrai(trouve.octets > 0, 'le trajet annonce ce qu’il pèse')
        egal(trouve.traces, 1, 'tranches de trace')
        // Le dépôt au nom libre fait un trajet à lui seul : sans cela, rien ne
        // pourrait jamais l'enlever.
        vrai(
          trajets.some((t) => t.cle === `depot:traces:${tranche}` && t.isole === true),
          'le dépôt au nom libre est listé comme trajet seul',
        )
      },
    },
    {
      nom: 'un trajet s’emporte en une archive zip',
      part: 'trajets',
      requete: { chemin: `/sessions/${encodeURIComponent(session)}/archive.zip`, compte: true },
      attend: (r, corps) => {
        egal(r.status, 200, 'statut')
        typeParmi(r, ['application/zip'])
        vrai(
          (r.headers.get('content-disposition') ?? '').includes('trajet-2026-09-11-06-24-01.zip'),
          'l’archive porte la date du trajet dans son nom',
        )
        // « PK » : la signature d'une archive zip, en toutes lettres.
        egal(corps.subarray(0, 2).toString('ascii'), 'PK', 'signature de l’archive')
      },
    },
    {
      nom: 'un trajet s’épingle, et la borne s’annonce',
      part: 'trajets',
      requete: {
        chemin: `/sessions/${encodeURIComponent(session)}/epingle`,
        methode: 'PUT',
        compte: true,
      },
      attend: (r, corps) => {
        egal(r.status, 200, 'statut')
        const rendu = JSON.parse(corps.toString('utf8'))
        egal(rendu.etat, 'épinglé', 'état')
        vrai(rendu.borne > 0, 'la borne est annoncée')
      },
    },
    {
      nom: 'la règle rend son verdict, et retient ce qui est épinglé',
      part: 'trajets',
      requete: { chemin: '/retention', compte: true, entetes: { Accept: 'application/json' } },
      attend: (r, corps) => {
        egal(r.status, 200, 'statut')
        const verdict = JSON.parse(corps.toString('utf8'))
        vrai(Array.isArray(verdict.aEffacer), 'le verdict dit ce qui partirait')
        vrai(verdict.delais?.traces > 0, 'les délais sont annoncés')
        const retenu = verdict.retenus.find((t) => t.cle === session)
        vrai(retenu !== undefined, 'le trajet épinglé est retenu')
        egal(retenu.raison, 'épinglé', 'raison de la retenue')
      },
    },
    {
      nom: 'un trajet s’efface, et le rejouer n’est pas une panne',
      part: 'trajets',
      // Le ménage de ce jeu de requêtes, autant que sa vérification : sans
      // effacement, chaque passage laisserait un trajet de plus en base.
      requete: {
        chemin: `/sessions/${encodeURIComponent(session)}`,
        methode: 'DELETE',
        compte: true,
      },
      attend: (r, corps) => {
        egal(r.status, 200, 'statut')
        egal(JSON.parse(corps.toString('utf8')).efface, 1, 'tranches effacées')
      },
    },
    {
      nom: 'effacer deux fois rend zéro, et non une erreur',
      part: 'trajets',
      requete: {
        chemin: `/sessions/${encodeURIComponent(session)}`,
        methode: 'DELETE',
        compte: true,
      },
      attend: (r, corps) => {
        egal(r.status, 200, 'statut')
        egal(JSON.parse(corps.toString('utf8')).efface, 0, 'tranches effacées')
      },
    },
    {
      nom: 'un dépôt seul s’efface, sa clé portant des deux-points',
      part: 'trajets',
      // Les deux traces anciennes de la base sont de cette forme. Une clé mal
      // échappée efface ailleurs, ou n'efface rien.
      requete: {
        chemin: `/sessions/${encodeURIComponent(`depot:traces:${tranche}`)}`,
        methode: 'DELETE',
        compte: true,
      },
      attend: (r, corps) => {
        egal(r.status, 200, 'statut')
        egal(JSON.parse(corps.toString('utf8')).efface, 1, 'tranches effacées')
      },
    },
    {
      nom: 'les relevés se listent',
      part: 'depots',
      requete: { chemin: '/mesures/', compte: true, entetes: { Accept: 'application/json' } },
      attend: (r, corps) => {
        egal(r.status, 200, 'statut')
        vrai(
          autoindex(corps).some((e) => e.name === releve),
          'le relevé déposé est listé',
        )
      },
    },
    // --- Relier un second appareil ----------------------------------------
    //
    // Le code de liaison est un jeton à usage unique : le demander n'engage
    // rien, ce qui permet de le vérifier ici sans laisser de trace utilisable.
    //
    // **L'en-tête `Origin` n'est pas décoratif.** La bibliothèque d'identité
    // refuse un POST qui n'en porte pas — c'est sa protection contre les
    // requêtes venues d'un autre site —, et un navigateur en met un tout seul.
    // Le jeu, lui, doit le composer.
    {
      nom: 'le code de liaison refuse sans compte',
      part: 'identite',
      // Un code donné sans compte donnerait un compte à qui le demande.
      requete: {
        chemin: '/api/auth/liaison/code',
        methode: 'POST',
        corps: '{}',
        entetes: { 'Content-Type': 'application/json' },
        origine: true,
      },
      attend: (r) => vrai([401, 403].includes(r.status), `401 ou 403, reçu ${r.status}`),
    },
    {
      nom: 'une requête d’identité venue d’un autre site est refoulée',
      part: 'identite',
      // Le scénario classique : une page hostile fait faire à un navigateur déjà
      // connecté chez nous une requête qui change quelque chose. Le témoin part
      // tout seul — c'est ce qui rend l'attaque possible —, donc seule l'origine
      // annoncée sépare la requête légitime de l'autre.
      //
      // **Vérifié ici et pas dans la suite de tests**, parce que la bibliothèque
      // désarme cette garde hors production et fige la lecture de
      // l'environnement à son import : sous vitest, le contrôle est éteint et un
      // test passerait au vert sans rien mesurer.
      requete: {
        chemin: '/api/auth/liaison/code',
        methode: 'POST',
        corps: '{}',
        entetes: { 'Content-Type': 'application/json' },
        origine: 'https://site-hostile.test',
        compte: true,
      },
      attend: (r) => egal(r.status, 403, 'statut'),
    },
    {
      nom: 'un code de liaison se lit à bout de bras et se dicte',
      part: 'identite',
      requete: {
        chemin: '/api/auth/liaison/code',
        methode: 'POST',
        corps: '{}',
        entetes: { 'Content-Type': 'application/json' },
        origine: true,
        compte: true,
      },
      attend: (r, corps) => {
        egal(r.status, 200, 'statut')
        const donne = JSON.parse(corps.toString('utf8'))
        // Ni I, ni L, ni O, ni U, ni 0, ni 1 : ce qui se confond sur un écran de
        // voiture, ou au téléphone.
        vrai(
          /^[2-9A-HJKMNP-TV-Z]{4}-[2-9A-HJKMNP-TV-Z]{4}$/.test(donne.code ?? ''),
          `huit caractères sans ceux qui se confondent, reçu ${JSON.stringify(donne.code)}`,
        )
        vrai(Number.isFinite(Date.parse(donne.expireLe ?? '')), 'une date d’échéance lisible')
      },
    },
    {
      nom: 'un code qui ne vaut rien n’ouvre rien',
      part: 'identite',
      // Le cas ordinaire : un code déjà servi, ou mal recopié. Tout autre code
      // qu'un refus ferait rejouer l'appareil.
      requete: {
        chemin: '/api/auth/liaison/relier',
        methode: 'POST',
        corps: JSON.stringify({ code: 'ZZZZ-ZZZZ' }),
        entetes: { 'Content-Type': 'application/json' },
        origine: true,
        compte: true,
      },
      attend: (r) => vrai([401, 403].includes(r.status), `401 ou 403, reçu ${r.status}`),
    },

    // --- Se faire un vrai compte -------------------------------------------
    //
    // Joué après le code de liaison, et pour la même raison : rattacher une
    // adresse fait cesser le compte du jeu d'être anonyme. Rien en aval n'en
    // dépend, et le garder à la fin évite d'y penser.
    {
      nom: 'rattacher une adresse refuse sans compte',
      part: 'identite',
      requete: {
        chemin: '/api/auth/compte/rattacher',
        methode: 'POST',
        corps: JSON.stringify({ email: `${nom}@exemple.fr`, motDePasse: 'un-mot-de-passe-assez-long' }),
        entetes: { 'Content-Type': 'application/json' },
        origine: true,
      },
      attend: (r) => vrai([401, 403].includes(r.status), `401 ou 403, reçu ${r.status}`),
    },
    {
      nom: 'une adresse se rattache au compte qui existe déjà',
      part: 'identite',
      // Le point du ticket 11 : le compte ne change pas d'identifiant, donc rien
      // de ce qu'il porte ne bouge. Une inscription ordinaire en créerait un neuf.
      requete: {
        chemin: '/api/auth/compte/rattacher',
        methode: 'POST',
        corps: JSON.stringify({ email: `${nom}@exemple.fr`, motDePasse: 'un-mot-de-passe-assez-long' }),
        entetes: { 'Content-Type': 'application/json' },
        origine: true,
        compte: true,
      },
      attend: (r, corps) => {
        egal(r.status, 200, 'statut')
        egal(JSON.parse(corps.toString('utf8')).email, `${nom}@exemple.fr`.toLowerCase(), 'adresse')
      },
    },
    {
      nom: 'un mot de passe faux n’ouvre aucun compte',
      part: 'identite',
      // Ni le code ni le message ne doivent dire lequel des deux était faux :
      // cela apprendrait quelles adresses existent.
      requete: {
        chemin: '/api/auth/compte/connexion',
        methode: 'POST',
        corps: JSON.stringify({ email: `${nom}@exemple.fr`, motDePasse: 'ce-n-est-pas-le-bon' }),
        entetes: { 'Content-Type': 'application/json' },
        origine: true,
      },
      attend: (r) => vrai([401, 403].includes(r.status), `401 ou 403, reçu ${r.status}`),
    },
    {
      nom: 'le compte se rouvre avec son adresse et son mot de passe',
      part: 'identite',
      requete: {
        chemin: '/api/auth/compte/connexion',
        methode: 'POST',
        corps: JSON.stringify({ email: `${nom}@exemple.fr`, motDePasse: 'un-mot-de-passe-assez-long' }),
        entetes: { 'Content-Type': 'application/json' },
        origine: true,
      },
      attend: (r, corps) => {
        egal(r.status, 200, 'statut')
        const rendu = JSON.parse(corps.toString('utf8'))
        egal(rendu.user?.email, `${nom}@exemple.fr`.toLowerCase(), 'adresse du compte rendu')
        // Sans témoin, l'appareil aurait ouvert un compte qu'il ne pourrait pas
        // atteindre.
        vrai((r.headers.get('set-cookie') ?? '') !== '', 'un témoin de connexion est posé')
      },
    },
    {
      nom: 'le serveur dit ce qu’il sait faire',
      part: 'identite',
      // Ce qui n'est pas configuré ne doit pas apparaître à l'écran : un bouton
      // qui mène à une erreur est pire que pas de bouton.
      requete: { chemin: '/api/auth/compte/possibilites', entetes: { Accept: 'application/json' } },
      attend: (r, corps) => {
        egal(r.status, 200, 'statut')
        const dit = JSON.parse(corps.toString('utf8'))
        vrai(typeof dit.relaisCourriel === 'boolean', 'il dit s’il sait envoyer un courriel')
        vrai(Array.isArray(dit.fournisseurs), 'il dit quels comptes tiers il accepte')
      },
    },
    {
      nom: 'emporter refuse sans compte',
      part: 'identite',
      requete: { chemin: '/mon-compte/archive.zip' },
      attend: (r) => vrai([401, 403].includes(r.status), `401 ou 403, reçu ${r.status}`),
    },
    {
      nom: 'tout ce qu’un compte porte descend en une archive',
      part: 'identite',
      // C'est ce qui rend une suppression acceptable : l'archive part chez son
      // propriétaire, et non sur le serveur.
      requete: { chemin: '/mon-compte/archive.zip', compte: true },
      attend: (r, corps) => {
        egal(r.status, 200, 'statut')
        typeParmi(r, ['application/zip'])
        vrai(
          (r.headers.get('content-disposition') ?? '').includes('sound-of-speed-'),
          'le fichier porte un nom daté',
        )
        // La signature d'un zip. Un serveur qui rendrait la page d'application
        // ici donnerait 200 et du HTML.
        vrai(
          corps[0] === 0x50 && corps[1] === 0x4b,
          'le corps est bien une archive zip',
        )
      },
    },
  ]
}

// --- De quoi dire ce qui ne va pas ---------------------------------------

function egal(obtenu, attendu, quoi) {
  if (obtenu !== attendu) {
    throw new Error(`${quoi} : attendu ${JSON.stringify(attendu)}, reçu ${JSON.stringify(obtenu)}`)
  }
}

function vrai(condition, quoi) {
  if (!condition) throw new Error(quoi)
}

function typeParmi(reponse, types) {
  const recu = (reponse.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
  if (!types.includes(recu)) {
    throw new Error(`type de contenu : attendu l'un de ${types.join(', ')}, reçu « ${recu} »`)
  }
}

/**
 * Lit un listage, et **dit** pourquoi il n'en est pas un.
 *
 * C'est la forme de l'autoindex JSON de nginx : un tableau d'entrées
 * `{ name, type }`, `type` valant `directory` ou `file`. Un serveur qui rendrait
 * un autre JSON, ou la page d'application, échoue ici avec le message qui dit
 * laquelle des deux choses il a faite.
 */
function autoindex(corps) {
  const texte = corps.toString('utf8')
  let lu
  try {
    lu = JSON.parse(texte)
  } catch {
    const debut = texte.slice(0, 60).replace(/\s+/g, ' ')
    throw new Error(`le listage n'est pas du JSON — reçu « ${debut}… »`)
  }
  if (!Array.isArray(lu)) throw new Error("le listage n'est pas un tableau")
  for (const entree of lu) {
    if (typeof entree?.name !== 'string' || !['file', 'directory'].includes(entree?.type)) {
      throw new Error(
        `une entrée n'a pas la forme { name, type } : ${JSON.stringify(entree).slice(0, 80)}`,
      )
    }
  }
  return lu
}
