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
export function cas({ nom }) {
  const profil = `${nom}.json`
  const tranche = `${nom}.jsonl.gz`
  const releve = `${nom}-sonde.json`
  const contenuProfil = JSON.stringify({ name: 'Accord', sampleDir: 'demo', layers: [] })

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

    // --- Les banques -------------------------------------------------------
    {
      nom: 'le listage des banques, au format autoindex',
      // Quatre modules du cœur lisent cette forme, et le service worker
      // distingue un listage d'un échantillon à la seule barre oblique finale.
      //
      // On vérifie la **forme**, et non ce qui s'y trouve : le contenu dépend de
      // ce qui a été déposé sur le serveur interrogé, et la banque de
      // démonstration n'y figure pas — elle vit dans l'image, derrière un alias,
      // parce que le volume des échantillons masque ce que l'image place là.
      requete: { chemin: '/audio/', entetes: { Accept: 'application/json' } },
      attend: (r, corps) => {
        egal(r.status, 200, 'statut')
        autoindex(corps)
      },
    },
    {
      nom: "le listage d'une banque",
      requete: { chemin: '/audio/demo/', entetes: { Accept: 'application/json' } },
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
      requete: { chemin: '/audio/demo/on-800.flac' },
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
      requete: { chemin: '/audio/demo/on-800.flac', entetes: { Range: 'bytes=0-99' } },
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
      requete: { chemin: '/traces/rien-du-tout.jsonl', compte: true },
      attend: (r) => egal(r.status, 404, 'statut'),
    },

    // --- Ce qui demande un compte -----------------------------------------
    {
      nom: 'le dépôt refuse sans compte, et le refus ne se rejoue pas',
      // 401 et 403 disent « refusé » : le client n'essaie pas de rejouer. Tout
      // autre code le ferait réessayer indéfiniment.
      requete: { chemin: `/profiles/${profil}`, methode: 'PUT', corps: contenuProfil },
      attend: (r) => vrai([401, 403].includes(r.status), `401 ou 403, reçu ${r.status}`),
    },
    {
      nom: 'la bibliothèque de profils refuse sans compte',
      requete: { chemin: '/profiles/', entetes: { Accept: 'application/json' } },
      attend: (r) => vrai([401, 403].includes(r.status), `401 ou 403, reçu ${r.status}`),
    },
    {
      nom: 'un profil se dépose avec un compte',
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
      requete: { chemin: `/profiles/${profil}`, compte: true },
      attend: (r, corps) => {
        egal(r.status, 200, 'statut')
        egal(corps.toString('utf8'), contenuProfil, 'le contenu rendu')
      },
    },
    {
      nom: 'le profil déposé apparaît au listage',
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
      requete: {
        chemin: `/profiles/${profil}`,
        methode: 'PUT',
        corps: contenuProfil,
        compte: true,
      },
      attend: (r) => vrai(r.ok, `un code de succès, reçu ${r.status}`),
    },

    // --- Ce que la voiture dépose en roulant -------------------------------
    {
      nom: 'une tranche de journal compressée se dépose',
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
    {
      nom: 'les relevés se listent',
      requete: { chemin: '/mesures/', compte: true, entetes: { Accept: 'application/json' } },
      attend: (r, corps) => {
        egal(r.status, 200, 'statut')
        vrai(
          autoindex(corps).some((e) => e.name === releve),
          'le relevé déposé est listé',
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
