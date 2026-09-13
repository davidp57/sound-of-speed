# Journal des changements

Toutes les évolutions notables du projet. Format
[Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versions en
[gestion sémantique](https://semver.org/lang/fr/).

## [Non publié]

### Corrigé

- **Le serveur ne compressait plus rien.** nginx le faisait ; le serveur qui l'a
  remplacé ne le faisait plus, et personne ne l'avait vu. La voiture tirait
  **310 ko de JavaScript là où gzip en fait 99**. Les types textuels se
  compressent désormais au-delà d'un kilo-octet — jamais les échantillons, déjà
  compressés, ni une plage d'octets, le client demandant les octets d'un fichier
  et non d'un flux. Ce que la voiture charge au démarrage passe de **459 ko à
  142 ko**, mesuré dans un navigateur.

- **Le service worker gardait en cache ce qui appartient à un compte.** Son
  dernier cas attrapait tout ce qui répondait 200 : la session, les droits, les
  profils, la liste des trajets — que le serveur déclare pourtant `no-store`.
  Une liste périmée pouvait être resservie, et surtout **une session pouvait
  l'être alors qu'elle n'existait plus**. Ce qui appartient à un compte n'est
  plus intercepté : hors réseau la requête échoue, et l'application sait déjà
  s'en passer. Le service worker n'avait aucun test alors qu'il est la pièce qui
  fait démarrer une voiture dans un tunnel ; il en a six.

- **Le titre de l'écran d'aide disait encore « Speed ».** Il avait échappé au
  renommage du 12 septembre. Le nom court du manifeste, lui, reste « Speed » :
  c'est celui qui s'affiche sous l'icône de l'écran d'accueil, et il doit tenir
  en une douzaine de caractères.

### Ajouté

- **Se connecter avec un compte tenu ailleurs** — Tesla, Google ou Apple —, **en
  plus de l'adresse et du mot de passe, jamais à la place** : perdre l'accès à
  son fournisseur ne doit pas faire perdre le compte. Les mêmes deux gestes
  qu'avec une adresse — rattacher une preuve de plus au compte d'ici, ou rouvrir
  celui auquel ce fournisseur a déjà été rattaché. **Il ne crée jamais de
  compte** : sinon ce bouton, pressé depuis la voiture, en fabriquerait un neuf
  et vide et laisserait les réglages derrière.

  **Ce qui n'est pas configuré n'apparaît pas.** Un fournisseur demande deux
  variables d'environnement, et l'écran ne montre que ce qui est réellement
  monté : celui qui déploie chez lui n'a rien à inscrire, et aucun bouton ne mène
  à une erreur. Les identifiants restent à obtenir auprès des trois — un dossier,
  pas du code ; la marche à suivre, et ce que Tesla exige, sont dans le ticket.
  Les six variables sont déclarées dans la pile du serveur : Portainer les
  **remplace** dans le fichier de pile, il ne les injecte pas, donc une variable
  saisie mais absente du fichier n'arriverait jamais au conteneur.

  La voiture charge **1 342 octets de plus** pour cela, mesuré compressé : la
  bibliothèque ne quitte pas le serveur, et l'application lui parle par deux
  requêtes.

- **Les trois écrans qu'une voiture n'ouvre jamais se chargent à la demande** —
  étalonnage, banc, synthèse. Trente-sept kilo-octets de moins au démarrage. Les
  autres restent chargés d'emblée, et c'est délibéré : ils s'ouvrent au volant,
  donc les différer déplacerait leur téléchargement là où il n'y a pas de réseau.

- **Le journal dit sur quel navigateur il a tourné**, une fois par session : la
  chaîne d'agent, l'écran, le pointeur, ce qu'on a deviné de l'appareil et ce
  qui s'applique. Un écart entre les deux derniers dit qu'il a fallu corriger à
  la main, donc que la détection s'est trompée. Rien n'est écrit sans accord de
  remontée, et accorder en cours de session l'écrit quand même — c'est
  justement la session qu'on voudra lire.

- **L'appareil décide de ce qui s'affiche, et le drapeau de construction s'en
  va.** Une voiture ne montre ni le banc, ni l'étalonnage manuel, ni le réglage
  du timbre ; un téléphone ajoute le banc et l'étalonnage ; un poste de travail a
  tout. La rangée des sources de vitesse disparaît en voiture, où il n'y a que le
  GPS. **Une seule image sert les trois usages** — `BENCH=1` n'existe plus. C'est
  le second axe : il range l'écran, il ne protège rien, et le serveur l'ignore.
  L'appareil se devine au premier lancement et se corrige depuis l'écran du
  compte ; le marqueur qui reconnaît le navigateur de la voiture reste à
  confirmer en roulant, et c'est pour cela que la correction existe.

- **Un compte porte des rôles, et un rôle ouvre des écrans.** `conduite` ouvre la
  conduite, la télémétrie, les réglages, l'étalonnage et le banc ; `atelier`
  ouvre le dépôt des moteurs et des boîtes ; `synthese` ouvre le réglage du
  timbre. Tout le monde a les trois, gratuitement, et rien n'est encaissé : ce
  qui est offert est une valeur, `SPEED_ROLES_OFFERTS`, et non une règle. Un
  droit daté referme son écran à l'heure dite, sans rechargement — mesuré dans un
  navigateur. Le serveur refuse de son côté ce qu'un rôle n'ouvre pas, et c'est
  le seul refus qui protège : l'écran ne fait que cacher. Hors réseau,
  l'application s'en tient aux rôles qu'elle avait relevés, pendant trente jours.
  L'écran du compte, lui, ne se referme jamais, et emporter ses données n'exige
  aucun rôle.

- **Tenir son compte : changer, emporter, supprimer.** Le mot de passe se change
  depuis l'écran Compte, l'ancien à l'appui. Tout ce que le compte porte
  s'emporte en un fichier — profils, moteurs, boîtes, trajets, journal, relevés
  et profil mesuré, dans les mêmes dossiers qu'ici, reversables tels quels dans
  une installation neuve. Et le compte se supprime en deux temps, en emportant
  tout ce qu'il portait sur le serveur ; ce qui est réglé sur l'appareil ne
  bouge pas. Deux réserves sont dites à l'écran plutôt que découvertes :
  emporter demande un poste de travail, le navigateur de la voiture refusant les
  téléchargements, et « j'ai oublié » n'apparaît pas tant qu'aucun relais de
  courriel n'est configuré.

- **Une adresse et un mot de passe, pour le jour où l'on n'a plus d'appareil.**
  Dans l'écran Compte, deux gestes distincts : *rattacher* donne une adresse au
  compte de cet appareil — qui **ne change pas d'identifiant**, donc ses profils,
  ses moteurs, ses boîtes, ses trajets et son profil mesuré ne bougent pas — et
  *ouvrir un compte qui existe* fait passer cet appareil sur un compte
  d'ailleurs, en effaçant celui d'ici s'il était vide. Le compte se rouvre alors
  depuis n'importe quel appareil. Aucun courriel n'est envoyé et l'adresse n'est
  pas vérifiée : il n'y a pas de relais à configurer, et l'écran dit ce que cela
  coûte.

- **Un écran pour le compte.** Ce qui touche à l'identité quitte l'écran de
  configuration, où il se perdait au milieu des réglages, pour un onglet à lui :
  ce que porte cet appareil, donner un code, recopier un code venu d'un autre
  appareil. La place de la connexion par adresse y est prise, et dit qu'elle
  n'existe pas encore. Un rappel escamotable signale l'écran à la deuxième
  ouverture, une seule fois — au premier lancement, on veut rouler.

- **Relier un second appareil : un code à scanner, ou huit caractères à taper.**
  L'écran de configuration donne un code ; un téléphone qui le scanne, ou un
  poste de travail où l'on recopie huit caractères, ouvre le même compte —
  mêmes profils, mêmes moteurs, mêmes boîtes, mêmes trajets, même profil mesuré.
  Sans adresse, sans mot de passe à retenir, sans service tiers. Le code ne sert
  qu'une fois, expire en dix minutes, et l'écran affiche le temps qui reste ;
  l'alphabet écarte ce qui se confond, et la casse comme les traits sont ignorés
  à la saisie. Le compte que l'appareil portait avant est effacé s'il était vide,
  gardé et annoncé sinon. Hors réseau, l'écran dit qu'on ne peut pas relier
  maintenant.

- **La voiture dépose avec son compte, et le mot de passe partagé disparaît.**
  Le témoin de connexion voyage tout seul — la page et le serveur sont sur la
  même origine —, et le serveur en déduit à qui appartient ce qui arrive. Le
  champ « Compte de dépôt » quitte l'écran de configuration, et la clé qui
  gardait son mot de passe en clair est effacée au chargement. La page de mesure
  `/sonde/`, qui composait son propre en-tête, dépose du même coup sans rien
  lire. Rien ne part tant que l'appareil n'a pas de compte : un dépôt envoyé
  avant recevrait un refus qu'on ne rejoue pas, et ce qu'on essayait de sauver
  serait perdu. Le fichier `htpasswd` quitte le serveur TypeScript, sa pile et
  l'intégration continue ; il reste chez nginx, qui en a toujours besoin. Ce que
  la voiture charge : **394 octets de moins qu'avant** — l'identité complète pèse
  moins que le mot de passe qu'elle remplace.

- **Ce que la base portait change de mains.** Tout appartenait à un compte écrit
  en dur ; le premier appareil qui se présente en hérite — profils, moteurs,
  boîtes, trajets, profil mesuré — et ce compte-là s'efface. Cela n'arrive
  qu'une fois, et il n'y a rien à mémoriser pour s'en assurer : après l'héritage,
  il ne reste rien à transmettre. Le journal du conteneur dit ce qui est passé.
  Le ménage de rétention et le rattrapage du profil mesuré passent désormais sur
  tous les comptes, et `npm run verdict` aussi.

- **On monte dans la voiture et ça marche : un compte se crée tout seul.** Au
  premier contact avec le serveur, l'appareil reçoit un compte anonyme — rien à
  saisir, aucun écran d'inscription, aucune adresse. Il est gardé dans le
  navigateur et resservira à chaque ouverture. **Et l'application démarre sans
  lui** : elle part de ce qu'elle a en local, fait du son, et se présente au
  serveur quand elle peut — au démarrage si le réseau est là, sinon à son retour.
  Deux appareils font deux comptes tant que rien ne les relie. L'écran de
  configuration dit ce que porte ce compte, et prévient qu'un compte anonyme n'a
  rien à récupérer : vider les données du site en perdrait l'accès. La remise à
  zéro des réglages, elle, n'y touche pas. Ce que la voiture charge en plus :
  2 431 octets, soit 0,55 % — la bibliothèque ne quitte pas le serveur.

- **La bibliothèque d'identité est montée sur le serveur.** Better Auth, sous
  licence MIT, branchée sur la base qui existe et répondant sous `/api/auth/` :
  une session se crée et se relit. Rien n'en dépend encore — la voiture dépose
  comme avant, le relecteur lit comme avant, le mot de passe partagé reste le
  seul contrôle d'accès, et le jeu de quarante-cinq requêtes passe sans qu'on y
  touche. Elle se pose sur la table `accounts`, qui existait déjà : adopter la
  sienne aurait obligé à recréer les six tables qui désignent un compte, SQLite
  ne sachant pas déplacer une clé étrangère. Trois tables s'ajoutent, préfixées
  `auth_`, et aucune ne s'appelle « compte » — ce que cette bibliothèque nomme
  un *account* est un moyen de prouver qui on est, pas une personne. Un compte
  sans adresse est accepté, ce qui est la condition pour monter dans la voiture
  sans rien saisir. Le secret qui signe les connexions s'écrit tout seul au
  premier démarrage, à côté du fichier de base : celui qui déploie chez lui n'a
  rien à fournir. `SPEED_URL` dit l'adresse publique de la pile quand on la
  connaît — derrière un proxy inversé, le conteneur ne voit qu'un port local et
  ne peut pas la deviner. Le paquet que charge la voiture n'a pas bougé d'un
  octet — 445 576 avant, 445 576 après.

- **Une commande dit ce que la règle emporterait, sur une copie de la base.**
  `npm run verdict -- copie.db` rend le même verdict que le relecteur, sans
  serveur ni conteneur : de quoi juger les délais sur les vraies données avant
  d'armer quoi que ce soit. Elle n'efface rien.

- **Le serveur fait le ménage : la règle efface.** Au démarrage, comme les
  migrations et la reprise, puis toutes les vingt-quatre heures — un serveur qui
  ne redémarre pas pendant trois mois ne doit pas cesser de faire le ménage pour
  autant. Un trajet part entier, tranches de trace et de journal ensemble, et
  chaque passage s'écrit dans le journal du conteneur : ce qui est parti, ce qui
  a été retenu et pourquoi. C'est le seul endroit où l'on verra ce qui a disparu.
  Un passage qui n'efface rien reste discret, et un passage qui échoue laisse le
  serveur servir. Le profil mesuré ne bouge pas : ce que les trajets ont montré
  est déjà cumulé.

- **Le relecteur montre ce que la règle de rétention emporterait, sans rien
  effacer.** Quels trajets partiraient, à quelle date, combien d'octets, et pour
  chacun de ceux qui restent, la raison qui le retient : épinglé, archivé, trop
  récent, ou pas encore analysé. Un trajet part quand sa date d'enregistrement
  dépasse le délai, que le profileur l'a traité, et qu'il n'est ni épinglé ni
  archivé. Trente jours pour une trace, quatorze pour un journal seul — le
  journal d'un trajet qui a une trace suit sa trace et part avec elle, sans quoi
  on relirait un trajet ayant perdu ses faits marquants. Les deux délais se
  règlent par `SPEED_RETENTION_TRACES` et `SPEED_RETENTION_JOURNAL`.

- **Un trajet qu'on veut garder s'épingle.** L'épingle l'exempte de l'effacement
  automatique, elle porte sur le trajet entier — on ne choisit pas une tranche de
  journal —, et elle survit à un nouveau dépôt sous le même nom. Leur nombre est
  borné, la borne se voit, et un refus dit quoi faire : décrocher autre chose, ou
  emporter le trajet. Vingt par défaut, réglable par `SPEED_EPINGLES`. Les
  trajets archivés, venus d'une reprise, n'y comptent pas : ce n'est pas un
  choix, c'est un déménagement.

- **Le relecteur rouvre une archive prise sur le disque.** Le trajet se relit
  comme s'il venait du serveur — la carte, les cadrans, les faits marquants, la
  barre de temps —, sans compte et sans réseau. C'est ce qui ferme la boucle :
  tant que le relecteur ne savait relire que le serveur, télécharger ne servait à
  rien et effacer revenait à perdre. Une archive à qui il manque des tranches se
  relit quand même, et ce qui manque est nommé ; un fichier qui n'est pas une
  archive de trajet le dit.

- **Un trajet s'emporte en un fichier.** Le relecteur en rend une archive zip
  unique — la plus grosse session de la base porte quarante-deux tranches, et
  quarante-deux téléchargements ne seraient pas une porte de sortie. Les
  tranches y entrent telles qu'elles ont été déposées, sous leur dossier
  d'origine et sans être recomprimées : ce qui ressort est exactement ce qui
  était monté. Le découpage est conservé, donc la trace des tranches manquantes
  aussi. L'archive porte la date du trajet, pas celle du téléchargement.

- **Le relecteur montre les trajets du serveur, et sait en effacer un.** Une
  liste devant laquelle on voit ce que chaque trajet pèse, ce dont il est fait et
  ce qui le retient — archivé, épinglé, ou pas encore analysé. Effacer emporte le
  trajet entier, tranches de trace et de journal ensemble, après une
  confirmation qui dit ce qui part ; les enregistrements anciens au nom libre,
  que rien ne pouvait enlever jusqu'ici, s'effacent aussi. Ce que la trace a
  montré reste dans le profil mesuré : le cumul ne se défait pas.

- **Un dépôt sait s'il a été analysé, et de quelle exemption il relève.** Le
  profileur marque ce qu'il a regardé, et il marque aussi ce dont il n'y avait
  rien à tirer : sans cette marque, rien ne distinguerait « trop court pour
  montrer quoi que ce soit » de « on n'a pas encore regardé », et la règle
  d'effacement confondrait les deux. La marque porte le numéro du procédé, donc
  elle ne vaut plus rien dès qu'il change — le démarrage annonce alors ce qu'il
  reste à revoir. Et l'exemption d'effacement se dédouble : l'**épingle** est un
  choix, l'**archive** est un fait, posé par la reprise sur ce qui vient d'un
  ancien serveur. Les quatre-vingt-quatorze dépôts repris deviennent des
  archives.

- **Un dépôt sait quand le trajet a eu lieu.** Il portait la date de son arrivée
  sur le serveur, qui ment dès que le dépôt est différé : une trace enregistrée
  hors réseau et remontée trois jours plus tard, ou les quatre-vingt-quatorze
  dépôts que la reprise a versés d'un coup. La date d'enregistrement se lit dans
  le nom de la tranche, elle est écrite à l'arrivée, et le démarrage la donne à
  ce qui est entré avant qu'elle existe. C'est elle que rend le listage, et c'est
  elle qui décidera de l'effacement.

- **Les réglages ne dorment plus dans le seul navigateur de la voiture.** Au
  premier lancement, les profils, les moteurs, les boîtes et les traces qui
  n'étaient jamais remontées partent en base — par petites poignées, pour ne pas
  faire déborder la file de dépôt, et en reprenant où on en était si le
  navigateur se ferme entre-temps. Les traces ainsi remontées entrent épinglées.
  Les préférences d'appareil — volume, visage de l'écran, verrou, mode de boîte —
  ne bougent pas : elles décrivent l'appareil, pas le conducteur. Rien n'est
  effacé du stockage local.

- **Au lancement, la base rend ce qu'elle a de plus récent.** Vider le stockage
  du navigateur de la voiture ne fait plus perdre ses réglages, et ce qu'on règle
  au bureau se retrouve au volant. La voiture reste le patron : elle écrit dans
  sa copie tout de suite, y compris hors réseau, et l'application démarre sans
  jamais attendre le réseau. Ce qui attend de partir dans la file n'est jamais
  écrasé par une version plus ancienne, et une base vide ne fait rien perdre.
  Les listages rendent de nouveau une date, comme le faisait l'autoindex du
  serveur de fichiers : c'est elle qui dit ce qui est plus récent, sans avoir à
  télécharger chaque fichier pour le comparer.

- **Ce qui dort dans les anciens dossiers du NAS rejoint la base.** On désigne
  au serveur le dossier de l'ancienne pile, monté en lecture seule, et il y
  verse ce qu'il trouve à son démarrage — traces, tranches de journal, relevés,
  profils. Les traces et le journal entrent épinglés, sans quoi la règle de
  rétention à venir effacerait un mois plus tard ce qu'on vient de déplacer. Le
  profil mesuré, lui, n'est pas repris : il se recalcule tout seul depuis les
  traces reprises, et un cumul produit par un procédé qui a changé depuis ne
  vaut rien. La reprise n'écrase jamais ce que la base porte déjà et ne touche
  pas à la source ; un décompte s'imprime, qui nomme ce qui est resté de côté.
  Mesuré sur le NAS : 41 traces (2,3 Mo), 53 tranches de journal (767 Kio),
  4 profils, et un profil mesuré recalculé sur les quarante et un trajets.

- **Les moteurs et les boîtes ont enfin leur place sur le serveur.** Leurs
  tables existaient et rien ne les remplissait : un moteur réglé au volant
  remonte désormais tout seul, comme un profil le fait déjà, et se relit depuis
  un autre appareil. C'est ce qui manquait pour qu'un profil déposé ne désigne
  plus un moteur que personne d'autre ne possède.

- **Une pile à un seul service**, qui fait le travail des deux images d'avant.
  Elle tourne à côté de celle en service, sur son propre port, le temps que le
  neuf convainque — rien ne bascule tant que personne ne l'a décidé. La base se
  crée et se met à jour toute seule au démarrage ; il n'y a rien à lancer à la
  main. L'intégration continue vérifie désormais que l'image **démarre**, qu'elle
  tient le contrat depuis le conteneur, et que la base **survit au remplacement
  du conteneur** — une promesse posée trois tickets plus tôt et qui n'avait
  jamais pu être vérifiée faute de conteneur qui porte cette base.

- **Le serveur mesure la vraie voiture sans plus scruter un disque.** Un service
  séparé relisait le dossier des traces toutes les cinq secondes pour découvrir
  ce qui s'y trouvait ; maintenant que le serveur écrit lui-même les traces, il
  sait qu'elles arrivent. Le calcul n'a pas changé d'une ligne — c'est le même
  code, à qui l'on donne une vue de la base au lieu d'un dossier. Une trace
  déposée pendant que le serveur était arrêté est rattrapée au démarrage.

- **Ce que la voiture envoie en roulant est rangé en base** : traces, tranches de
  journal, relevés de mesure. Une tranche compressée redescend à l'octet près et
  sous le nom exact qui la dit compressée — le client décide de décompresser au
  nom du fichier, jamais au type que le serveur annonce. Redéposer sous le même
  nom remplace, ce que fait la voiture quand elle rejoue un envoi qu'elle croit
  perdu. Une charge trop grosse est refusée par un code que le client ne rejoue
  pas : rendu autrement, la voiture réessaierait indéfiniment un envoi qui ne
  passera jamais. **Le serveur neuf passe désormais le contrat en entier**, et
  devient indiscernable de celui qu'il remplace.

- **La bibliothèque de profils est servie depuis la base.** Vu de
  l'application, rien n'a changé : mêmes adresses, même forme de listage, mêmes
  codes, même authentification. Déposer deux fois le même nom remplace, comme le
  faisait le dépôt de fichiers. Le serveur refuse ce qui n'est pas du JSON — un
  fichier illisible rendrait la bibliothèque muette sans rien dire — mais ne
  valide pas la forme d'un profil : le cœur en est la seule autorité, et il la
  vérifie déjà à la lecture.

- **Un serveur en TypeScript sert l'application, ses ressources et les
  échantillons**, à la place du serveur de fichiers. Il honore les demandes de
  plage d'octets, annonce les deux types que le navigateur exige pour le moteur
  simulé, et son repli de page ne répond jamais sur un chemin de données — un
  fichier de données absent rend un vrai 404, et non la page d'accueil avec un
  code 200 que le client ne peut pas distinguer d'une panne.
- **Les deux sources d'échantillons sont enfin réunies.** Les banques déposées
  vivent dans un volume, celle de démonstration vient avec l'application : le
  serveur cherche dans les deux, et le listage les montre ensemble. Le volume se
  montait jusqu'ici par-dessus le dossier des échantillons et masquait la
  démonstration, qui n'apparaissait donc dans aucune liste de banques.

- **Une base de données, son schéma et ses migrations.** Sept tables — comptes,
  droits, moteurs, boîtes, profils, dépôts, voiture mesurée — dans un fichier
  SQLite qui vit dans un volume, avec des migrations versionnées jouées au
  démarrage. Ouvrir la base deux fois ne change rien : c'est la seule façon
  d'accepter qu'elle se migre toute seule. Un compte unique est semé au premier
  lancement, et rien ne demande de se connecter — mais tout ce qui est rangé
  appartient à un compte dès maintenant, pour qu'il n'y ait rien à rattacher
  après coup le jour où l'identité s'ouvrira. Les réglages y sont gardés tels que
  le cœur les décrit plutôt qu'étalés en colonnes : le cœur reste la seule
  autorité sur la forme d'une entité.

- **Les trois zones du code ne se mélangent plus par règle, et non par
  consigne.** Le cœur, l'interface et le serveur ont chacun leurs frontières :
  le cœur n'importe ni Vue, ni un écran, ni le serveur ; l'interface n'importe
  pas le serveur ; le serveur n'affiche rien. `npm run lint` refuse ces imports
  et dit pourquoi, et neuf tests vérifient qu'il les refuse **réellement** — une
  règle qu'on n'a jamais vue refuser quoi que ce soit n'est pas un garde. Le plus
  ancien de ces invariants tenait depuis des mois sur un `grep` lancé à la main.
  Le service qui profile la voiture devient la première pièce de `src/server/`.

- **Un jeu de requêtes décrit ce que le serveur doit rendre**, et se rejoue
  contre n'importe quelle adresse : `npm run accord -- <adresse>`. C'est le seul
  contrôle qui regarde une réponse HTTP — les mille cent dix-huit tests du dépôt
  tournent sur les sources et n'en voient aucune. Il enferme ce qu'une réécriture
  du serveur casserait sans bruit : la forme du listage que quatre modules du
  cœur lisent, les deux types MIME sans lesquels le moteur simulé ne démarre pas,
  le vrai 404 qu'un chemin de données absent doit rendre, et les codes de refus
  que la voiture ne rejoue pas. Il tourne à chaque pull request, contre l'image
  que cette pull request construit.

- **Le projet est sous licence AGPL-3.0**, et le dépôt devient forkable. Un
  fichier `LICENSE`, le champ dans `package.json`, une section du README qui dit
  ce que la licence implique, et un `CONTRIBUTING.md`. L'écran d'aide porte un
  lien vers le code source et la version servie : ce n'est pas une politesse,
  c'est ce que la section 13 de l'AGPL demande à qui fait tourner le programme
  comme service. **Qui déploie une version modifiée doit faire pointer ce lien
  vers son propre code.**
- **Une banque de démonstration est livrée avec l'application** — un quatre
  cylindres simulé, quinze prises, 1,6 Mo en FLAC — et un profil d'usine la
  désigne. Un dépôt fraîchement cloné fait donc du son sans qu'on ait rien
  déposé, là où il restait muet jusqu'ici : les banques enregistrées vivent sur
  le serveur et ne se redistribuent pas. Ce profil est **premier** dans la liste
  des profils d'usine, donc c'est lui qui joue au tout premier lancement ; une
  installation déjà en service ne voit aucun changement.
- **La pile se configure sans éditer le `docker-compose.yml`** : `SPEED_DATA`,
  `SPEED_PORT` et `SPEED_TAG`, décrits dans un `.env.example` commenté, avec des
  valeurs par défaut identiques à la configuration d'avant. Le README décrit
  l'installation en quatre étapes.

### Corrigé

- **Le générateur de banques capte son échappement au lieu de l'inventer.** Il
  fabriquait un train de pics espacés de 57 Hz — un filtre en peigne — là où le
  son en direct charge depuis le 8 septembre une captation réelle. Mesuré contre
  `smooth_39` : le tube creusait le médium de 5,3 dB et laissait passer 14 à
  22 dB d'aigu de trop. Sur la banque produite, cela s'entendait comme un son
  sourd doublé d'un souffle aigu qui battait à contretemps des explosions —
  53,3 Hz au ralenti pour un allumage à 26,7. Avec la captation, le souffle
  tombe de 15 à 21 dB, le médium remonte de 6,6 dB au niveau de la banque
  enregistrée, et la modulation de l'aigu retrouve exactement la fréquence
  d'allumage. La réponse se choisit par `exhaustResponse` dans la définition de
  moteur, parmi les quatre captations de `public/impulse/` ; `"tube"` garde
  l'ancienne résonance pour comparer.
- **Un chargement de banque raté fait taire le moteur.** Il laissait branchées
  les couches de la banque précédente : changer de profil vers une banque qui ne
  charge pas ne changeait rien au son, et l'échec ne s'entendait pas. Une banque
  importée a ainsi été jugée identique à celle qu'elle devait remplacer.

## [0.2.1] — 2026-09-12

Le projet change de nom, et rien d'autre : aucun comportement, aucun réglage,
aucun son ne bouge. Les notes de version sont dans
[`docs/releases/v0.2.1.md`](docs/releases/v0.2.1.md).

### Modifié

- **Le projet s'appelle Sound of Speed.** « Speed » désignait à la fois
  l'application et la grandeur qu'elle mesure : dans le code, cent soixante-quatre
  occurrences du mot veulent dire « vitesse », et l'on ne pouvait chercher l'une
  sans trouver l'autre. Le nouveau nom dit en plus ce que l'application fait.

  Le dépôt, les deux images et le nom affiché suivent. **Trois choses ne suivent
  pas**, et c'est délibéré : le dossier de données du serveur, qui demanderait de
  déplacer traces et profils à la main ; les seize clés du stockage local, qui
  rendraient introuvables les profils, moteurs, boîtes et étalonnages dormant dans
  le navigateur de la voiture ; et le vocabulaire du code, où « speed » continue de
  désigner la vitesse.

- **Les dossiers du serveur portent le nom du projet.** `sound-of-speed/` et
  `sound-of-speed-dev/` remplacent `speed/` et `speed-dev/`, et les conteneurs
  suivent. Contrairement au stockage local du navigateur, ces dossiers se
  renomment sans rien perdre : ils vivent sur le serveur, où l'on peut les
  déplacer à la main. La documentation d'installation, le script du fichier de
  mots de passe et la configuration du relecteur pointent tous sur les nouveaux
  chemins.

- **Les deux piles du serveur ne partagent plus leurs dossiers.** L'intégration
  lit et écrit dans les siens. Elles partageaient tout, ce qui coûtait plus cher
  que la recopie économisée : un trajet fait sur l'intégration entrait dans le
  profil mesuré de la production, et le profileur de chaque pile relisait les
  trajets de l'autre. Rien ne le signalait, et la mesure en était faussée.

## [0.2.0] — 2026-09-12

Deux semaines et demie de septembre, en une version : la boîte se conduit
comme une boîte, le passage de rapport s'entend, la voiture capture ses
trajets toute seule et les fait relire au bureau, et elle tire d'eux le profil
de la vraie voiture. Les notes de version sont dans
[`docs/releases/v0.2.0.md`](docs/releases/v0.2.0.md).

### Ajouté

- **Une boîte devient une chose qu'on nomme.** Comme le moteur avant elle : une
  boîte porte ses rapports, son pont, le rayon de roue, la durée d'un passage et
  ses temporisations, plus le rétrogradage forcé et l'à-coup — deux gestes de
  boîte, et non des propriétés de moteur, puisqu'un moteur ne fait pas de clac.
  Elle ne porte ni les régimes de passage, qui se déduisent du rupteur et du
  mode, ni les pétarades, qui sont le caractère du moteur et le suivent.

  Deux boîtes sont livrées et non une : elles partagent leurs rapports mais pas
  leur pont — 3,7 contre 4,5 —, donc ni le régime à une vitesse donnée, ni les
  durées de passage. Et changer de boîte ne change ni la voix, ni la banque, ni
  le mixage : sans ce verrou, on croirait avoir changé de moteur.

- **Capturer le son qui sort, et le déposer sur le serveur.** Un cliquetis
  entendu dans la voiture était absent du son que le banc fabrique avec les mêmes
  réglages : le banc refait la chaîne, mais ni le lecteur, ni la réverbération du
  navigateur, ni la carte son. Trois étages où le défaut pouvait se loger, sans
  moyen de savoir lequel.

  Un bouton de l'écran de synthèse garde les huit dernières secondes de ce qui
  sort réellement, les encode et les dépose sur le serveur — le navigateur de la
  voiture ne téléchargeant rien. Ce que la journée a appris et qui justifie
  l'outil : chaque fois que la mesure et l'oreille ont divergé, c'est la mesure
  qui avait tort.

- **Une sonde qui mesure le moteur simulé hors de l'application.** Le cœur
  d'engine-sim a été porté pour tourner dans un navigateur, et une page séparée
  le fait tourner seul, sans le reste de Speed. C'est elle qui a permis de
  chiffrer ce que la voiture peut tenir, et de trouver les défauts de la
  simulation là où l'application entière les aurait noyés.

- **Le relecteur fait entendre un trajet.** Le bouton « Écouter le trajet » fait
  retraverser la chaîne aux relevés de la capture : le trajet sonne comme il a
  sonné dans la voiture, autant de fois qu'on veut, sans reprendre la route.

  La configuration jouée est celle de l'en-tête de la capture, jamais celle du
  profil actif, et elle n'est pas reprise au format courant — une capture du
  11 septembre 2026 se rejoue avec ses six rapports. Les bascules Route/Sport du
  trajet sont suivies. Le conditionnement du signal, lui, n'est pas rejoué : sa
  sortie enregistrée est reprise telle quelle, parce qu'il dépend de l'instant
  d'arrivée de chaque mesure GPS et ne survit ni à un saut dans la timeline ni à
  une lecture accélérée.

  **L'écart entre l'enregistré et le recalculé s'affiche** — régime et rapport.
  C'est la vérification que rien d'autre ne donne : mesuré sur le trajet du
  11 septembre au soir, zéro tour d'écart sur les portions d'autoroute, et
  jusqu'à un rapport là où les réglages de la boîte ont changé depuis.

- **Le régime du rapport suivant, sur le compteur.** Une seconde aiguille, plus
  courte, plus fine et d'une autre couleur, montre où le moteur retomberait si
  le rapport suivant était engagé à l'instant. Elle disparaît au point mort et
  sur le dernier rapport. Le chiffre vient du calcul que la boîte emploie pour
  décider, et non d'un second écrit à côté.

- **L'état du profil mesuré, en télémétrie.** Une section dit ce que le dernier
  essai de lecture a donné : profil reçu, rien à proposer, serveur injoignable,
  réponse illisible, procédé plus ancien. Les trois derniers signalent une
  plomberie qui ne marche pas — jusqu'ici, ils se taisaient tous.

- **La voiture propose son propre profil.** Quand le serveur a mesuré de quoi
  conclure, un bandeau l'annonce sous les cadrans : « Profil de la voiture prêt,
  sur dix-sept trajets », à appliquer ou à remettre à plus tard. Il ne bloque
  rien et s'affiche même en roulant — un « plus tard » ne vaut que pour cette
  mesure-là, la suivante se reproposera.

  Accepté, il se pose en **couche** sur le profil choisi : le son reste celui du
  profil, seules les capacités de la voiture sont reprises, et aucun réglage
  n'est modifié. L'écran de configuration annonce lesquels, avec l'écart.
  Mesuré sur le trajet du 11 septembre : neuf réglages, dont l'accélération à
  charge pleine à 3,4 m/s² au lieu de 2,0.

  Une fois acceptée, la couche s'affine sans rien redemander ; elle signale
  seulement quand une mesure se déplace de plus de vingt pour cent — pneus
  d'hiver, voiture chargée, quelqu'un d'autre au volant.

- **Un service qui profile la voiture sur le serveur.** Il regarde le dossier
  des traces, remesure le trajet qu'une tranche vient de compléter, et dépose ce
  qu'il sait dans le dossier des profils. Une seconde image, publiée par la même
  chaîne que l'application et depuis le même commit — c'est ce qui garantit
  qu'ils calculent la même chose.

  Il ne sert rien et n'ouvre aucun port : c'est nginx, à côté, qui sert ce qu'il
  écrit. Une tranche illisible est écartée et nommée sans faire tomber le
  trajet ; une ligne tronquée ne fait rien tomber du tout.

- **Ce que la voiture a montré d'elle se cumule trajet après trajet**, sans tout
  relire. Les capacités — accélération et freinage maximum, vitesse pratiquée,
  bornes du signal — se gardent sur tout l'historique par leurs extrêmes, donc
  sans rien conserver ; les habitudes — vitesses tenues, départs, façons de
  ralentir — sur les vingt derniers trajets, gardés entiers. Un trajet qui
  revient remplace sa version précédente au lieu de compter deux fois : le
  serveur recalcule à chaque tranche déposée.

- **Un verdict qui dit ce qui manque, dans les termes du conducteur.** Pas un
  volume mais une couverture : il faut avoir roulé en ville, sur route et sur
  autoroute, être parti à l'arrêt, avoir accéléré franchement, et que les
  ralentissements se séparent en deux façons de ralentir. Ce qui manque se
  formule « il manque encore de la conduite sur autoroute » plutôt qu'en
  comptes. Rien ne le montre encore : aucun écran ne le lit, et la couverture du
  trajet du 11 septembre est déclarée complète après un seul matin — les comptes
  exigés sont des points de départ.

- **Le code d'étalonnage sait lire une capture de trajet.** Il mesurait les
  enregistrements du protocole ; il mesure désormais un trajet ordinaire, avec
  le même calcul plutôt qu'un second qui divergerait. C'est la première pièce du
  profil de la vraie voiture dérivé des traces déposées.

  Deux choix tranchés par la mesure sur le trajet du 11 septembre : la vitesse
  retenue est la brute et non la conditionnée — le conditionnement lisse, et
  mesurer sa sortie rendrait une voiture moins vive qu'elle n'est — et une mesure
  réémise à l'identique n'est pas comptée, 23 983 relevés ne portant que 21 897
  mesures distinctes — le bruit du GPS, qui dimensionne la fenêtre
  d'accélération, passe de 0,240 à 0,306 km/h une fois les réémissions
  écartées.

- **Les moments d'un trajet se reconnaissent sans qu'on les provoque** :
  départs arrêtés, mises de gaz franches, vitesses tenues rangées par régime.
  Les critères sont ceux du protocole, appliqués à des morceaux du trajet.

- **Une première mesure du seuil de rétrogradage, tirée d'un trajet ordinaire.**
  Rien dans une trace ne dit si le frein a été touché ; on range donc les
  ralentissements par force et l'on cherche la coupure qui les sépare le mieux.
  Sur le trajet du 11 septembre, 115 ralentissements retenus et une coupure à
  −1,34 m/s². Rien n'est proposé quand les deux groupes ne se séparent pas.

  **Ce n'est pas encore une preuve** : la distribution n'a qu'une bosse et une
  queue, et le critère retenu dit que la coupure sépare quelque chose, pas qu'il
  y avait deux façons de ralentir. La réponse dépend aussi de ce qu'on fait
  entrer — une version plus permissive comptait 424 ralentissements et rendait
  −1,04. Plusieurs trajets trancheront.

- **Un bouton pour redemander une position en roulant**, sur l'écran de
  télémétrie, dans la section « Qualité du signal ». Passer par « P » puis « D »
  relance déjà la localisation, mais coupe le son et scinde l'enregistrement en
  deux sessions ; celui-ci ne fait que redemander une position. Il n'apparaît
  qu'en roulant, et remet à zéro les comptes de la source pour qu'on lise ce que
  la relance produit.

- **Les commandes de conduite deviennent un sélecteur de boîte.** `D` démarre
  l'application — localisation, son, enregistrement —, puis bascule en `S` pour
  le mode sport ; `P` met tout au repos et dépose ce qui attendait. `AUTO` et
  `MAN` sont deux colonnes côte à côte, chacune montrant les commandes de son
  mode plutôt que de le nommer.

  **L'application s'ouvre au repos**, et c'est le propos : elle démarrait la
  géolocalisation dès le chargement, sans geste. Le 11 septembre 2026, elle n'a
  reçu que des positions annoncées à 9 999,99 m de précision — la valeur qu'un
  navigateur sert faute d'en avoir une vraie — pendant tout un trajet, et il a
  fallu lancer une autre version de l'application pour s'en sortir : celle-ci
  n'avait plus aucun bouton pour relancer la source.

- **Le son dit quand une autre application le lui a pris.** La musique de la
  voiture suspend le contexte audio ; le bouton annonçait alors « Activer le
  son » alors que personne ne l'avait coupé. Il le nomme, et le même appui le
  rend.

- **L'écran de conduite ne porte plus que ce qu'on lit au volant.** Le choix
  entre cadrans et chiffres, et celui de la source de vitesse, passent en
  Configuration › Réglage : ni l'un ni l'autre ne se décide en roulant, et une
  source qu'on peut changer au volant n'est qu'un moyen de se tromper sur ce
  qu'on entend.

- **L'écran de conduite tel que David l'a dessiné.** Les commandes de boîte
  passent **entre les cadrans**, au-dessus du rapport, et le tempérament juste en
  dessous : la main se trouve là où le regard est déjà, au lieu de descendre
  chercher une barre en bas d'écran. Les cadrans reprennent la place libérée.

  **Un seul bouton par choix**, qui change de valeur au clic — auto ⇄ manuelle,
  route ⇄ sport. Deux boutons pour un choix binaire prennent la place de ce qu'on
  lit en roulant, et il faut viser le bon des deux.

- **Un seul profil livré, nommé d'après son moteur : le V8.** Il y en avait deux,
  Route et Sport, et leur différence tenait à leurs seuils de passage. Ceux-ci se
  déduisant maintenant du rupteur et du tempérament, garder deux profils
  reviendrait à proposer deux fois le même moteur avec deux tempéraments figés.

  Cela lève surtout une confusion que le croquis de David a mise au jour : deux
  boutons « Route / Sport » à l'écran, l'un pour le profil, l'autre pour le
  tempérament. Un profil se nomme d'après ce qu'on entend, plus d'après une façon
  de conduire.

  Son calibrage est celui de l'ancien profil Route — rupteur à 6 500, celui du
  GM LS livré. Les anciens calibrages restent connus pour la reprise : un profil
  « Route » ou « Sport » enregistré garde **ses** valeurs, sinon il se verrait
  complété avec celles d'un autre.

- **Un moteur devient une chose qu'on nomme.** Ses réglages, sa banque de sons,
  ses couches et son mixage — tout ce qui fait qu'on le reconnaît — forment
  désormais une entité qui a un nom, et que le profil **désigne** au lieu de
  recopier. Trois gestes en découlent : envoyer un moteur **seul**, sans faire
  suivre tout un profil ; le corriger une fois pour tous les profils qui le
  jouent ; et savoir enfin lequel un profil joue — la bibliothèque le devinait,
  en comptant les écarts entre ses valeurs et celles de chaque entrée.

  Vérifié dans le navigateur : appliquer le moteur Sport au profil Route emporte
  son rupteur, son ralenti et sa banque, et **ne touche ni la boîte, ni les
  réglages de mesure**. C'est ce qu'on cherchait — un moteur n'est pas une façon
  de passer les rapports.

  Les moteurs livrés sont les deux profils d'usine, et non les neuf entrées de la
  bibliothèque de définitions : celles-là portent des cotes et un échappement,
  pas de banque, et n'ont donc pas de son à faire entendre. Elles restent un
  catalogue pour l'atelier.

  Le profil garde ses sections pour l'instant, alimentées par le moteur désigné.
  Les en retirer touche environ trois cent cinq points d'appel et ne pourrait pas
  rester vert : c'est le dernier ticket du volet qui contracte, une fois les cinq
  groupes en place. Format de profil en version 9, profils repris.
- **La vraie voiture devient une chose à part.** Les six réglages du signal de
  vitesse — raideur du lissage, fenêtre d'accélération, vitesse plausible,
  précision acceptée, bornes d'accélération — ne décrivent ni un moteur, ni un
  goût : ils décrivent le récepteur GPS de la voiture et sa façon de bouger. Ils
  forment désormais une entité, **une seule par appareil**, puisqu'on ne choisit
  pas sa vraie voiture comme on choisit un V8.

  Ce palier pose l'entité, ses valeurs — celles qui ont roulé, reprises telles
  quelles —, leur domaine et la reprise depuis un profil déjà réglé. La chaîne
  lit encore la section du profil : la sortie effective se fera avec le reste de
  la contraction, l'étalonnage écrivant dans quatre de ces réglages et devant la
  suivre dans le même mouvement.

- **Tout ce que le serveur porte se récupère en un fichier.** Un bouton « Tout
  récupérer », dans la section Profils, liste les quatre dossiers du serveur —
  journal, traces, relevés de mesure, profils —, tire les fichiers et les rend
  en un paquet compressé. Le navigateur de la voiture ne télécharge rien : le
  geste se fait depuis un téléphone ou un ordinateur, et c'est le seul chemin de
  retour pour un essai enregistré en roulant. David : « j'utilise l'app sur
  téléphone pour récupérer et sauvegarder les traces en .zip ».

  Le paquet est **écrit à la main, sans dépendance ni compression** : une
  centaine de lignes pures, vérifiées par vingt-quatre tests, plutôt qu'une
  bibliothèque de plus dans une application qui doit se charger hors réseau. Le
  format est vérifié à l'extérieur — le décompresseur de Windows l'ouvre,
  arborescence et accents intacts. La compression native du navigateur
  s'ajoutera si le poids devient gênant.

  Il part **incomplet plutôt que pas du tout** : un dossier refusé ou un fichier
  illisible n'emporte pas le reste, et le message dit lesquels manquent. Un
  dossier absent, en revanche, n'est pas une anomalie — ils naissent au premier
  dépôt.

- **Un passage de rapport se déroule en cinq temps.** Il n'en avait qu'un :
  baisser le niveau de 3,8 dB pendant un dixième de seconde, sur un timbre
  inchangé. Trois versions ont suivi sans que David entende de différence — « on
  entend un tout petit claquement, c'est tout ; pour le couple, j'ai pas
  l'impression que ça ait changé quoi que ce soit ». La quatrième suit la
  description qu'il a donnée d'une vraie boîte : « passage au neutre, descente
  rapide ; coup de gaz, montée rapide très courte ; passage du rapport, clac ;
  lâcher de l'embrayage, descente rapide au régime des roues puis
  réaccélération ».

  **Ce qui manquait d'abord, c'était le temps.** Un passage durait 120 ms, et
  rien de tout cela n'est audible en un dixième de seconde : les quatre temps se
  chevauchaient et il ne restait qu'un trou. Le temps de passage est monté à
  **600 ms** sur Route et 480 sur Sport — « dans la vidéo ça dure au moins
  500 ms, voire plus : on a bien le temps de tout entendre » — soit 204 ms de
  chute, 108 de coup de gaz, 48 d'engagement et 240 de reprise. Le curseur, qui
  s'arrêtait à 500 ms, va maintenant jusqu'à 1 500.

  **Et le clac était avalé par le saturateur.** « J'ai beau mettre au max, je
  n'entends aucun claquement de boîte » — puis, le compteur de télémétrie une
  fois posé : « toujours pas de claquement, mais le compteur monte ». Le
  déclenchement était donc hors de cause, et c'est la chaîne de sortie qui
  l'était.

  La courbe du saturateur est indexée sur [-1, 1] : au-delà, Web Audio prend la
  valeur du bord. Or le moteur crête à 1,74 sur le bus, donc il sature déjà en
  permanence — et **tout ce qui entre au-dessus de lui en sort au même niveau**.
  Mesuré sur la courbe du profil Route : un clac 4,2 dB plus fort, un clac au
  maximum du curseur et un clac dix fois trop fort sortent tous les trois à
  0,00 dB d'écart du moteur. Aucune valeur ne pouvait le rendre audible, ce qui
  explique aussi pourquoi la pétarade s'entendait « toute petite ».

  Les deux événements brefs sont désormais injectés **après le saturateur**,
  directement sur le limiteur : la sortie reste protégée, et l'attaque de deux
  millisecondes du limiteur laisse passer le transitoire. Le clac a par ailleurs
  été refait en trois composantes — corps, métal, masse — après une première
  mesure qui le trouvait 15,6 dB sous le moteur.

  **Restait une seconde cause, et une mesure fausse de ma part.** Sorti du
  saturateur, le clac s'entendait au bouton mais toujours pas en roulant. Sa
  crête dépassait pourtant celle du moteur — mais une crête n'est pas un niveau.
  Repris par bandes d'octave, l'écart réel était de **24 à 40 dB sous le
  moteur** partout où l'oreille écoute : sa rampe d'extinction descendait si
  vite que toute son énergie tenait dans la première milliseconde. Il s'éteint
  maintenant à constante de temps, avec des gains triplés. En écart au moteur au
  réglage livré : −8 dB à 500 Hz, +2 à 1 kHz, +10 à 2 kHz, +14 à 4 kHz, +23 à
  8 kHz.

  **Puis il a fallu le rendre sourd.** Audible enfin, il était « trop sec, aigu
  et court ; dans la vidéo c'est un son un peu plus long et surtout plus
  sourd » — et si perçant qu'au vingtième du réglage il dominait encore. Il
  culminait à −4 dB du moteur à huit kilohertz et à +13 dB à seize. La version
  livrée place son énergie dans le grave : −5,7 dB à 125 Hz, −10,7 à 250, et
  seize décibels sous le moteur partout au-dessus de deux kilohertz. Trois
  composantes — la masse, le corps du carter, un soupçon de médium — et des
  extinctions de cinq à douze centièmes de seconde. Un choc dans un carter n'est
  pas un claquement de fouet.

  **Le clac se dose séparément au rétrogradage.** Le son est le même dans les
  deux sens ; ce qui change, c'est ce qu'il y a autour. On rétrograde pied levé
  ou en freinant, donc avec un moteur bien plus doux, et le même clac y ressort
  nettement plus. Un réglage plutôt qu'une pondération automatique : le bon
  dosage dépend de la banque et se juge à l'oreille. Livré à 0,55.

  Un bouton **« Écouter le clac »** apparaît dans la configuration : un
  événement d'un centième de seconde ne se règle pas en attendant le prochain
  passage de rapport. Son curseur monte maintenant à 3.

  Relevé sur Route, première en seconde : 4 692 tr/min, fond de la chute à
  **2 337** au tiers du passage, sommet du coup de gaz à **3 364**, clac à
  l'engagement, retour à 2 910 pour 2 907 aux roues, puis réaccélération. La
  part d'énergie tenue par les couches en charge suit — 0,93, puis 0,21 au
  creux, puis 0,93.

  **Le clac est un choc mécanique et non un bruit d'échappement** : attaque en
  une milliseconde là où la pétarade en prend quatre, extinction en trente
  millisecondes au lieu de cent vingt, et deux composantes — un claquement clair
  vers deux kilohertz qui donne le métal, un coup mat sous deux cents hertz qui
  donne la masse. Sans le second on entend un déclic, sans le premier une porte
  qui ferme. Il tombe au sommet du coup de gaz, quand le rapport s'engage, et
  non à la fin du passage : ce qui reste après lui, c'est l'embrayage qui se
  lâche, et cela ne claque pas.

  Cinq réglages, tous neutralisables à zéro : coupure de couple, plongée du
  régime, coup de gaz, clac de la boîte, claquement d'échappement. Les lois du
  curseur calme-sportif suivent les nouvelles plages, si bien que le caractère
  relu d'un profil livré ne bouge pas.

  **Les profils déjà enregistrés gardent leurs anciennes valeurs**, temps de
  passage compris : sans une remise aux valeurs d'usine de la transmission et du
  caractère, la séquence n'a pas la place de s'entendre.

- **Le son se débouche en accélérant.** David voulait retrouver sous charge ce
  qu'il entend en levant le pied : « le son est plus clair, moins sourd, comme si
  on enlevait un bouchon ». Deux mécanismes ont été essayés et jetés le même
  jour — un plateau haut, qui « ajoute justement une nouvelle fréquence
  parasite », puis le retrait de la résonance d'échappement, dont la mesure a
  montré qu'elle ne déplace la bande de 500 Hz que d'un dixième de décibel même
  poussée à fond.

  C'est le protocole que David a donné qui a tranché : accélérer, mesurer,
  relâcher, remesurer. À niveau égal, GM à 2 500 tr/min, le relâché contre la
  charge — 5,7 dB de plus à 250 Hz, 1,4 de moins à 500, et de 4 à 6 de plus sur
  tout ce qui dépasse le kilohertz. En charge, le son est écrasé par sa bosse de
  500 Hz, et cela ne venait pas de la chaîne mais du son que le moteur simulé
  produit.

  Le correcteur creuse donc cette bosse et relève le reste, proportionnellement à
  l'effort. Mesuré, écart moyen sur neuf bandes avec la couleur du relâché :
  4,39 dB sans lui contre 2,66 à 1 500 tr/min, 7,18 contre 3,54 à 2 500. C'est
  une égalisation assumée et non un modèle physique, mais elle vise une courbe
  mesurée plutôt qu'une idée du son qu'on devrait entendre.

- **L'écran montre ce que les haut-parleurs reçoivent.** Le niveau crête et le
  taux d'écrêtage étaient relevés dans le lecteur, donc **avant** le silencieux
  et la résonance d'échappement — celle-ci ajoutant une quinzaine de décibels à
  la bande de 500 Hz. Mesuré sur le Chevrolet 454 au ralenti : 1,000 au lecteur
  pour **1,194** en fin de graphe, que le contexte audio rognait sans que rien ne
  le dise. Un écrêtage bref est riche en aigu, et c'est ce que David entendait —
  « des frt frt frt à plus haute fréquence que le moteur ». Deux lignes
  nouvelles, *Crête en sortie* et *Écrête en sortie*, relevées par un moniteur
  placé tout au bout de la chaîne.

  Cela éclaire aussi le rapprochement qu'il avait fait avec la brillance : elle
  ne causait rien, elle signalait. Un écrêtage engendre des harmoniques hautes,
  donc la part d'énergie au-dessus d'un kilohertz monte avec lui.

- **Le banc écrit le son qu'il produit.** `--wav` en fait un fichier, chaîne de
  sortie comprise. C'est ce qui a fermé la boucle entre la mesure et l'écoute :
  six analyses n'avaient rien vu du cliquetis, et il a suffi de le rendre
  audible, puis de le découper en quatre bandes, pour que l'oreille le localise
  en une écoute. Le banc sait aussi couper le niveleur, forcer un gain, une
  crête visée, la gigue ou le bruit d'air, pour isoler un suspect sans toucher
  au dépôt.

- **Un banc qui mesure le son tel qu'il sort.** `npm run analyse-son` fait tourner
  le moteur simulé hors du navigateur, puis lui applique la **chaîne de sortie** —
  silencieux, puis mélange du son sec et de la résonance d'échappement. Toute
  mesure de timbre portait jusqu'ici sur le signal du WebAssembly, trois étages
  en amont du haut-parleur : une mesure a ainsi conclu qu'ouvrir le papillon
  faisait baisser la bande de 1,4 kHz pendant que David entendait l'inverse. Le
  premier relevé montre ce qui manquait — la résonance ajoute **quinze décibels**
  à la bande de 500 Hz.

  Il prend un moteur de la bibliothèque, ou **un profil exporté depuis
  l'application** : un moteur d'usine est un point de départ, pas ce qu'on écoute
  après l'avoir réglé. Les définitions viennent du projet lui-même, sans recopie.

  Deux analyses : les **niveaux par bande**, avant et après la chaîne, et le
  **grain de l'aigu** — l'énergie haute arrive-t-elle régulièrement ou par
  salves. C'est cette seconde qui cherche les parasites que David décrit comme
  des « frt frt frt », lesquels se noient dans un spectre moyen.

- **Le régime du moteur simulé se délisse.** Le dynamomètre tient la vitesse par
  une contrainte du solveur : mesurée à chaque pas de simulation, l'ondulation du
  vilebrequin était **exactement nulle**, à tous les régimes. Un régime
  rigoureusement constant donne une fréquence pure, et c'est ce que David
  entendait — « on dirait un oscilloscope », sur l'EJ25 à 1 820 tr/min.

  Un bruit filtré module désormais le régime, réglable en amplitude et en
  vitesse de dérive, applicable sans couper le son. Mesuré à 1 820 tr/min sur
  quatre cylindres, part de l'énergie tenue par les cinquante plus grandes
  raies : 46,3 % sans lui, 39,1 % à vingt tours, 35,1 % à quarante. La valeur
  livrée — quinze tours, quinze hertz — est une estimation, à juger à l'oreille ;
  zéro rend le comportement d'avant.

  **Une ondulation régulière avait été essayée d'abord, et elle ne servait à
  rien** : calée sur la fréquence d'allumage, elle place ses bandes latérales
  exactement sur les harmoniques voisines, si bien que l'énergie reste sur la
  même grille — 46,3 % contre 45,4 % à quarante tours. Ce qui manquait à ce son
  n'était pas une ondulation, c'était de l'irrégularité.

- **L'écran de synthèse affiche l'ondulation du régime.** Relevée à chaque pas de
  simulation dans le WebAssembly, la seule cadence où elle est visible : le
  régime rapporté par ailleurs est échantillonné quatre fois par seconde, là où
  l'ondulation vaut cent à deux cents hertz. En alerte sous un tour par minute,
  parce que zéro est le défaut qu'on vient de corriger.

- **Un GM LS à collecteur long, réglé à l'oreille.** Quatre valeurs d'échappement
  s'écartent de la définition d'engine-sim : le collecteur du premier cylindre
  passe de 6,8 à 30 pouces, le débit du primaire double, le tube primaire gagne
  un pouce et le débit de sortie double. C'est le collecteur qui s'entend le
  plus — David : « quand on l'augmente, fait mieux entendre le bruit des
  explosions, surtout au ralenti ». L'accélération y gagne ; la décélération
  laisse passer une fréquence parasite, « comme une pièce métallique qui vibre
  vite ». Le moteur d'origine reste dans la liste, à sa valeur de référence.

- **Le cache hors réseau suit la banque.** Ce qui est surveillé n'était déclaré
  qu'au démarrage : changer de banque — ou de profil, ou éteindre une couche —
  laissait l'écran compter les fichiers de l'ancienne, et *Préparer hors réseau*
  mettait en cache ceux dont on venait de se détourner. Le défaut se voyait peu
  tant que la banque se tapait à la main.

  **Libérer les banques inutilisées** vide du cache les échantillons dont plus
  aucun profil ne se sert, et dit la place rendue. Ils y restaient indéfiniment
  par construction : essayer trois banques en laissait trois sur le téléphone.

  Le listage des banques n'est plus servi depuis le cache. Il s'y glissait à
  côté des échantillons, et une banque déposée sur le serveur ne serait jamais
  apparue.

- **La banque d'un profil se choisit dans une liste.** C'était une saisie de
  texte libre : on tapait un nom de dossier en aveugle, et une faute de frappe
  se découvrait à l'activation du son, sous la forme d'un silence. La liste
  donne les banques présentes sur le serveur et le nombre de fichiers de
  chacune ; la saisie à la main reste possible, pour une banque que le serveur
  ne sait pas lister.

  Quand la banque est listée, **les fichiers que le profil déclare en vain sont
  nommés** — le premier écueil quand on change de banque, les noms de fichiers
  étant rarement les mêmes d'une banque à l'autre.

  Réinitialiser **les couches** remet désormais la banque avec : des noms de
  fichiers d'usine dans un autre dossier ne joueraient rien.

- **`npm run banque` relève une banque entière.** Régler une banque nouvelle
  demandait de lancer l'analyse couche par couche, puis de trouver les gains à
  l'oreille — les deux écarts de la banque livrée, 9,6 et 6,5 dB, ont été
  relevés à la main. Le script imprime, prise par prise : durée et format,
  niveau, écart avec la prise de référence et gain qui en découle, six ancrages
  candidats, raccord de boucle ; puis un récapitulatif à recopier.

  Il mesure, il ne décide pas : l'ambiguïté d'octave reste à trancher à
  l'oreille. Mesuré sur les 33 prises des deux banques produites par
  `generate-bank`, dont le régime est connu par construction, le bon régime
  arrive en tête 23 fois et figure parmi les six candidats 32 fois. Sur la
  banque livrée, les gains proposés retombent sur ceux du profil — 3,03 contre
  3, et 2,11 contre 2,1.

- **L'application découvre les banques d'échantillons déposées sur le
  serveur.** Un profil désigne sa banque par un nom de dossier, qu'il fallait
  jusqu'ici taper en aveugle : rien ne disait quelles banques existaient, ni ce
  qu'elles contenaient. Le serveur rend maintenant le contenu de `/audio/` en
  JSON — le mécanisme de la bibliothèque de profils, pris à l'envers, puisqu'on
  y garde les dossiers au lieu de les écarter.

  Ce listage n'est pas protégé, à la différence des quatre dossiers de dépôt :
  les échantillons se chargent sans compte, sinon aucun son ne sortirait. Un
  serveur qui ne sait pas lister rend une liste vide plutôt qu'une erreur, et
  l'application s'en tient alors au nom déclaré par le profil.

  Le serveur de développement liste lui aussi `public/audio/`, sans quoi la
  découverte ne se vérifierait qu'après un déploiement.

- **La boucle ne se répète plus à l'identique.** Chaque couche est un
  enregistrement de trois à cinq secondes lu en boucle : à la vitesse de lecture
  réelle il se referme toutes les quatre à vingt secondes, et l'oreille apprend
  le motif — c'est la première cause de l'impression de synthèse. La lecture
  reprend maintenant ailleurs dans l'enregistrement toutes les six secondes en
  moyenne, par un fondu croisé de vingt millisecondes.

  Le fondu est à **puissance constante**, parce que deux positions d'un même
  enregistrement sont décorrélées : un fondu linéaire creuserait de 1,8 dB à
  chaque passage. Mesuré ainsi, le raccord reste sous la respiration naturelle du
  son — 1,2 à 3,3 dB d'écart de niveau pendant le fondu, contre 2,3 à 2,8 dB pour
  le son qui ne saute pas.

  Un réglage, **Renouvellement de position**, donne l'intervalle moyen ; à zéro
  le comportement est exactement celui d'avant. L'écran de télémétrie compte les
  sources en lecture et les renouvellements : durablement plus de sources que de
  couches, c'est qu'un fondu ne s'est pas refermé.

- **Un banc mesure ce que la chaîne de sortie fait au niveau.** Ouvert sur
  `/banc/sortie.html` au serveur de développement — il n'entre pas dans
  l'image —, il rejoue le mixage réel dans un contexte hors ligne et relève ce
  que le saturateur, le limiteur et le gain de rattrapage conservent du relief de
  charge. Aucun son n'en sort.

  Il écarte la cause qu'on croyait tenir : la chaîne coûte 0,09 dB sur 6,58, et
  le limiteur n'atténue jamais plus de 0,2 dB. Ce qui écrase le relief est
  l'écrêtage en sortie, dû au gain de rattrapage placé après le limiteur — 1 %
  des échantillons rognés au volume livré, 8 % au volume maximal, soit une
  distorsion mesurée à −31 dB du son.

  Le banc produit aussi un extrait de huit secondes — avant, puis après
  correction, au même niveau — pour juger à l'oreille ce qu'aucun décibel ne
  tranche. **Écouté : « quasiment aucune différence ».** Rien n'est donc corrigé,
  et la chaîne de sortie est écartée des causes du relief qu'on n'entend pas.

- **Tout ce qui naît dans la voiture remonte tout seul.** David : « l'objectif
  est de déposer régulièrement, en automatique sur le NAS, avec une option en
  opt-in, les traces, les logs, les relevés de mesure, les profils, tout ce qui
  peut servir à la fois de mémoire pour l'utilisateur et de source de données
  pour le debugging ».

  L'accord qui gouvernait le seul journal gouverne maintenant les quatre
  natures, et il garde ses trois positions. Le troisième cran s'appelle
  désormais « et la conduite » : il ajoute la position **et** les traces
  enregistrées, qui portent la conduite à la cadence du GPS. Les profils
  rejoignent la bibliothèque partagée sous un nom stable — une synchronisation,
  pas un archivage.

  Ce qui n'a pas pu partir attend et repart au retour du réseau. La file est
  gardée d'une session à l'autre, bornée, et l'écran de configuration dit ce
  qu'elle contient.

- **La sonde dépose son relevé.** La page de mesure `/sonde/` affichait un
  chiffre qu'il fallait recopier à la main, dans une voiture où le
  presse-papiers ne mène nulle part. Un bouton le dépose sur le serveur, avec
  son contexte — navigateur, matériel, date, verdict —, en réutilisant le compte
  déjà saisi dans l'application.

- **Le journal dit ce que le son a coûté.** Facteur temps réel, creux du
  lecteur, écrêtage et charge du calcul entrent dans le relevé périodique quand
  le son est synthétisé. Le seuil du lot de synthèse est un facteur trois *dans
  la voiture*, et personne ne l'y avait mesuré. Un profil qui joue des
  échantillons n'inscrit rien : un zéro se lirait comme une mesure.

- **Changer de moteur simulé depuis l'écran de conduite.** David : « on doit
  pouvoir changer facilement la source du son du profil — exemple : Sport pour
  régler la transmission et le comportement, son d'origine GM modifié — en
  sélectionnant le moteur simulé sur la page principale ».

  Un rang de boutons sous celui des profils, un par moteur de la bibliothèque,
  qui n'apparaît que si le profil décrit un moteur simulé. Le moteur arrive avec
  son rupteur et son réglage de son. Retouché au banc, il n'allume aucun bouton
  mais le rang dit de qui il descend — « 454, retouché — 5 valeurs ».

  Sur un profil *généré à l'avance*, le choix se fait aussi : il désigne le
  moteur du profil, mais la banque déjà rendue continue de jouer — le son ne
  changera qu'au prochain rendu.

- **Choisir son moteur, son échappement et son point d'écoute en conduisant.**
  David : « la page de réglage des moteurs c'est pour nous, sur PC ; rien à faire
  dans l'app en voiture. En voiture on peut choisir un profil de synthèse, avec
  le choix du moteur, le choix de l'échappement et de l'endroit d'où on écoute ».

  Trois listes dans la configuration, sur un profil dont le son est simulé, et
  pas un curseur : on choisit, on ne règle pas. Le réglage fin reste au banc, sur
  un ordinateur.

  Le moteur n'annonce plus « réglé à la main » quand il descend d'un moteur connu
  qu'on a retouché : il dit de qui il descend et de combien de valeurs il s'en
  écarte — « 454, retouché — 5 valeurs ».

- **Le son d'un moteur voyage avec lui.** Échappement, volume, crête visée et
  papillon vivaient dans les réglages du banc, en mémoire, perdus à chaque
  rechargement de page : un moteur réglé à l'atelier n'emportait rien de son
  réglage. Ils entrent dans le profil, et chaque moteur de la bibliothèque pose
  les siens en arrivant. Sans quoi, essayer plusieurs moteurs au volant les
  ferait tous écouter à travers l'échappement du premier.

  Un seul est réglé à ce jour, le **GM LS**, aux valeurs relevées par David le
  6 septembre : résonance 0,45, volume 0,70, crête visée au maximum. Les sept
  autres portent le réglage par défaut, c'est-à-dire qu'ils ne sont pas réglés —
  c'est écrit dans la bibliothèque plutôt que masqué.

  Le format de profil passe en **version 6**. Un profil enregistré sans ces
  valeurs reçoit celles de son profil d'usine ; rien ne se perd.

  La réserve reste en dehors, volontairement : elle décrit la machine qui
  calcule, et les 60 ms tenues sans un creux sur un poste de bureau n'ont pas la
  même marge sur un téléphone.

- **La crête visée par le niveleur ne coupe plus le son pour changer.** Elle est
  relue à chaque échantillon par engine-sim, donc `synth_set_leveler_target`
  l'écrit à chaud, sur le modèle de `synth_set_noise`. La régler n'impose plus la
  seconde de rebâtissage à chaque cran du curseur.

- **La crête que vise le niveleur, réglable.** David a mesuré ce que l'écran
  appelait « niveau crête » : à 1,000 en rouge sur le GM LS en convolution
  déportée, le son écrasé n'était pas plus fort, il était **écrêté**. engine-sim
  vise 30 000 sur 32 767 — 0,8 dB de marge avant le plafond dur d'`INT16_MAX` —
  et le gain qu'applique son niveleur se lisse en environ 0,2 ms : le front
  d'une bouffée soudaine ne reçoit encore que 10 % du bon gain quand il
  arrive, et plus il est raide, plus il écrête. C'est ce qui expliquait ses
  trois observations à la fois :
  la GM sature, l'EJ25 reste sous le plafond et sonne mieux, la convolution
  interne — en atténuant les fronts — élimine l'écrêtage en même temps que le
  mordant.

  Un curseur neuf règle cette cible, avec le compte d'échantillons écrêtés à
  côté. Le défaut passe à 12 000 : simulé sur un V8 au ralenti, un signal qui
  écrêtait à 17,5 % avec la cible d'origine tombe à 0,4 %. Le volume perdu se
  rattrape en aval, dans Web Audio, où rien ne plafonne.

- **Charger un moteur section par section.** Idée de David : « avoir les
  boutons de choix de moteur dans chaque section (culasse, échappement) pour
  essayer par exemple le moteur de la 454 avec l'échappement de la GM ». Chaque
  section de l'onglet Synthèse porte maintenant la liste des huit moteurs, en
  noms courts : un clic pose cette section-là sur le moteur réglé, et laisse
  tout le reste en place.

  Le bouton s'allume quand la section vient déjà de ce moteur — deux boutons
  peuvent l'être à la fois, quand deux moteurs partagent la section.

  La section « Bruits » n'a pas de boutons, et ce n'est pas une exception
  écrite à la main : les moteurs y portent tous la même valeur, puisqu'elle est
  jugée à l'oreille et non relevée. Une section dont les moteurs ne se
  distinguent pas ne propose rien.

  Le rupteur ne voyage pas avec une section : il vient du profil.

- **La longueur du collecteur devient un curseur.** Elle était écrite en dur :
  chaque cylindre du V8 recevait la sienne, et le quatre cylindres une longueur
  unique. Or c'est ce nombre qui arbitre le compromis que David a entendu — long,
  le moteur est rugueux et vivant en charge, mais des fréquences parasites
  montent au ralenti ; court, les parasites tombent et la vie avec.

  Le curseur donne la longueur du **premier** cylindre ; sur un V8 les trois
  autres s'en déduisent par quarts, la règle du 454 qui écrit ses quatre
  longueurs `distance * 4, 3, 2, 1`. Sur un quatre cylindres, tous portent la
  même. C'est le vingt-neuvième paramètre du contrat, ajouté en dernier comme
  la règle l'exige ; un profil enregistré avant lui reprend la valeur d'origine
  de son moteur, rien ne se perd.

- **Huit moteurs à charger d'un clic**, dans l'onglet Synthèse. David, après
  avoir essayé les vingt-huit curseurs : « c'est vraiment difficile de trouver
  des réglages qui sont bien, ils ont tous des effets les uns sur les autres et
  y'en a beaucoup ». Un moteur n'est pas vingt-huit valeurs indépendantes : c'est
  un ensemble où elles s'accordent. On en charge un entier, puis on affine.

  | Moteur | Rupteur |
  |---|---|
  | Chevrolet 454, gros bloc | 5 500 |
  | Chevrolet 454, came Comp Cams | 5 500 |
  | GM LS, V8 5,7 L | 6 500 |
  | Honda B18C5 VTEC | 8 400 |
  | Suzuki Hayabusa | 11 000 |
  | Subaru EJ25, et ses variantes à collecteur égal et inégal | 6 500 |

  Toutes relevées dans les définitions livrées avec engine-sim, valeur par
  valeur : ce qu'un fichier ne déclare pas est allé se lire dans le nœud qui
  porte le défaut, et chaque commentaire dit lequel.

  L'écran indique ce qui est chargé, compte les retouches, et sait revenir au
  moteur d'origine — de quoi essayer sans crainte.

  **Ce qui limite la liste**, ce n'est pas le nombre de définitions disponibles
  mais les deux architectures que le C++ sait construire : quatre cylindres en
  ligne, et V8 à quatre-vingt-dix degrés à vilebrequin croisé. Le V8 à
  vilebrequin plat de la Ferrari F136, les six et cinq en ligne, les V6, le V10
  de la LFA, les V12 et les radiaux demanderaient chacun leur constructeur.


- **Le moteur simulé se décrit dans le profil, et se règle à l'oreille.** Les
  deux moteurs d'engine-sim étaient écrits en dur dans le C++ : changer un
  volume de chambre demandait de recompiler le WebAssembly, une minute, et
  personne d'autre que la machine ne pouvait le faire. Or c'est à l'oreille que
  ces valeurs se trouvent.

  Vingt-sept nombres décrivent maintenant le moteur — géométrie, culasse, cames,
  admission, échappement, bruits — dans une section du profil. Ils voyagent avec
  lui : stockage, fichier exporté, lien de partage. L'onglet Synthèse les donne
  en curseurs, groupés par famille, avec la valeur de **référence** affichée dès
  qu'on s'en écarte — celle du GM LS pour un huit cylindres, celle du Subaru
  EJ25 pour un quatre. Deux boutons reposent le moteur sur l'une ou l'autre.

  Le rupteur figure dans la liste mais reste en gris : il se règle déjà dans la
  section moteur du profil. Le nombre de cylindres et les deux bruits quittent
  les réglages du banc, où ils faisaient double emploi. La liste des paramètres
  et leur ordre — que le C++ lit par position — sont dans
  `native/CONTRAT-MOTEUR.md`.

  Le format de profil passe en version 5 : un profil enregistré sans définition
  reçoit celle de son profil d'usine.

- **Un régime de décollage, et le ralenti cesse de s'entendre en roulant.**
  David : « le bruit du moteur qui pousse ne commence que vers 15 km/h [...] en
  pratique un moteur qui démarre utilise son embrayage, puis la première, et donc
  les tours sont *toujours* au-dessus du ralenti ».

  Le régime était borné au ralenti tant que les roues tournaient moins vite — de
  zéro à six kilomètres à l'heure sur le profil Sport, où la première ne donne
  que 385 tr/min à trois kilomètres à l'heure et 642 à cinq. Le son y était donc
  exactement celui de l'arrêt, ce qu'aucune voiture ne fait.

  Dès que la voiture avance, c'est maintenant l'embrayage qui commande : le
  moteur monte au **régime de décollage** et l'y tient pendant qu'elle prend de la
  vitesse, jusqu'à ce que les roues le rejoignent. Réglable par profil, 1 300
  tr/min sur Route et 1 500 sur Sport.

  Un garde-fou est nécessaire : l'embrayage ne patine qu'en partant. Au-delà de
  vingt-cinq kilomètres à l'heure il est tenu pour fermé, faute de quoi une
  allure tenue sur un rapport long — trente kilomètres à l'heure à mille cent
  tours — passerait pour un décollage et verrait son régime relevé à tort. Ce
  sont deux tests existants qui l'ont montré.

  La version du format de profil passe de 3 à 4 ; les profils enregistrés
  reçoivent le régime de décollage de leur profil d'usine.


- **Un choix « où l'on écoute »** sur le banc de synthèse : dehors à côté de la
  voiture, ou dedans vitres fermées. Le passe-bas de sortie faisait déjà cela
  sans qu'on l'ait cherché — c'est David qui l'a remarqué en réglant à
  l'oreille. Le réglage libre reste accessible.


- **La résonance d'échappement est maintenant une captation réelle**, et non
  plus un modèle. C'est ce que fait engine-sim depuis toujours, et nous ne
  l'avions pas vu : son application charge un fichier WAV enregistré sur un vrai
  échappement, là où nous fabriquions une réponse — d'abord un bruit blanc, puis
  un tube. Une captation porte ce qu'aucun modèle ne reproduit : la géométrie du
  tube, le silencieux, la caisse, le lieu de la prise.

  Quatre réponses sont reprises de sa bibliothèque, dont celle du V8 Chevrolet
  454 qu'il livre, retenue par défaut. Un sélecteur **Échappement** permet d'en
  changer, et la réponse fabriquée reste disponible en repli.

  Relevé sur le ralenti du V8, sortie complète : l'écart entre le grave et la
  bande de 8 kHz vaut **40,1 dB**, quand une prise faite sur une vraie voiture en
  montre 39,1. Le spectre décroît de 33 dB entre 2 et 8 kHz au lieu de remonter.

  Au passage, notre gain de convolution valait 0,01 là où engine-sim applique
  0,001 — dix fois trop.


- **La banque générée portait le même parasite que le son en direct**, et un de
  plus. Les deux bruits d'engine-sim y étaient aussi restés à leurs valeurs de
  démonstration — ils sont fixés dans les définitions de moteur, où est leur
  place. Et sa réponse impulsionnelle était un bruit blanc, avec ce commentaire :
  « le contenu importe peu, seule sa longueur pèse sur le coût ». Vrai quand on
  mesurait le coût processeur, faux dès qu'on produit du son à écouter. Elle
  simule maintenant un tube, comme celle du son en direct.

  Mesuré sur les prises produites, l'écart entre le grave et la bande de 8 kHz
  passe de **3,4 à 42,9 dB** — une prise faite sur une vraie voiture en montre
  39,1. En revanche le saut d'énergie au bouclage recule de 7,1 à 15,4 % au
  pire : la queue d'un tube est tonale et se raccorde moins bien que du bruit.


- **Les deux bruits d'engine-sim étaient restés à leurs valeurs de
  démonstration.** C'est la cause du parasite que David entendait à tous les
  régimes — « une fréquence assez aiguë en trop », puis « on n'entend pas du
  tout le moteur, juste le souffle, comme des interférences sur une radio FM ».

  Le spectre du ralenti montrait deux anomalies qu'aucune prise faite sur une
  vraie voiture ne présente : un plateau plat de 250 Hz à 2 kHz, et une remontée
  de 11 dB entre 2 et 8 kHz. Elles correspondent exactement aux deux bruits
  qu'engine-sim ajoute à dessein, avec leurs coupures à 2 et 10 kHz :
  `airNoise` à 1,0 et `inputSampleNoise` à 0,5.

  Le premier ne s'ajoute pas au signal, il le **multiplie** : à un, le moteur
  est entièrement modulé par un bruit blanc. Les deux sont maintenant réglables,
  et ramenés à 0,15 et 0,05 — pas à zéro, un moteur a du souffle.

  Ralenti d'un quatre cylindres, silencieux coupé : le parasite à 8 kHz chute de
  17 dB, le corps à 250 Hz gagne 6 dB, et la remontée vers l'aigu disparaît
  (+10,8 dB avant, −1,3 après). Sur le V8, le rapport entre le corps et le
  plateau passe de 5,7 à 10,6 dB.

  Le **silencieux** est coupé par défaut : il avait été ajouté pour masquer ce
  parasite, et il fallait le descendre si bas qu'il rendait le moteur sourd.


- **Un bouton « Réglages d'origine » sur le banc de synthèse.** Sept curseurs,
  dont plusieurs se compensent : on s'y perd en tâtonnant à l'oreille, et la
  seule issue était de recharger la page — ce qui coupe le son et rebâtit le
  moteur. Le bouton remet les valeurs par défaut sans rien interrompre.


- **La résonance d'échappement est un tube, et non plus un bruit.** C'est une
  erreur de fond que je traînais depuis le début du portage : la réponse
  impulsionnelle était un bruit blanc décroissant, repris d'engine-sim. Or
  convoluer des explosions par du bruit rend du bruit. À haut régime les
  explosions se succèdent assez vite pour que la texture tienne ; en dessous,
  chaque explosion devient une bouffée de souffle au lieu d'un coup. David,
  résonance à fond : « on n'entend pas du tout le moteur, juste le souffle,
  comme des interférences sur une radio FM ».

  Un échappement est un tube. L'onde court jusqu'au bout, se réfléchit sur
  l'extrémité ouverte en changeant de signe, revient, et ainsi de suite en
  s'affaiblissant. La réponse est donc une suite d'échos espacés du temps
  d'aller-retour, adoucis à chaque réflexion — c'est ce qui donne sa note à un
  échappement. Un réglage **Accord de l'échappement** en fixe la fréquence :
  57 Hz par défaut, soit trois mètres de tube environ.

  Mesuré sur un ralenti de V8 à 750 tr/min, tout en réverbéré, par le facteur de
  crête — il dit si les coups restent détachés ou si tout s'étale :

  | Réponse | Niveau efficace | Facteur de crête |
  |---|---|---|
  | aucune, son sec | 0,023 | 6,0 |
  | bruit blanc | 0,023 | 3,4 |
  | tube à 57 Hz | 0,062 | 5,7 |

  Le bruit détruisait près de la moitié du relief ; le tube le rend intact. Il
  sort au passage 2,7 fois plus fort, ce qui dégage le volume du plafond où il
  butait — plafond relevé de 2 à 6, puisqu'il y butait quand même.

  Les valeurs par défaut sont celles trouvées à l'oreille : silencieux à 1 kHz,
  résonance entière, longueur 50 ms. Deux cent vingt millisecondes étaient une
  salle et non un échappement — à 800 tr/min un V8 explose toutes les 19 ms,
  et douze explosions se superposaient dans la queue.


- **Le curseur de résonance d'échappement ne change plus le volume.** Il en
  faisait deux à la fois : monter la résonance rendait le son nettement plus
  faible, si bien qu'on ne pouvait pas juger la couleur sans juger le niveau en
  même temps.

  Deux causes, toutes deux corrigées. Le `ConvolverNode` normalisait la réponse
  impulsionnelle selon sa propre règle ; elle est désormais normalisée en
  énergie chez nous, ce qui rend aussi la **longueur** de résonance réglable sans
  qu'elle emporte le volume avec elle. Et le mélange sec/réverbéré se fait
  maintenant en racine : les deux signaux étant décorrélés, ce sont leurs
  énergies qui s'ajoutent, là où des gains proportionnels perdaient trois
  décibels au milieu de la course.

  Relevé après coup, régime tenu : le niveau crête reste entre 0,15 et 0,21 sur
  toute la course du curseur.

- **Un silencieux sur le son synthétisé.** David a entendu « une fréquence
  assez aiguë en trop », présente en permanence, ralenti compris. Mesuré : la
  bande 4-16 kHz n'était qu'à 12 dB sous la bande 200-800 Hz, là où une prise
  faite dans une vraie voiture est à 22-37 dB en dessous.

  Ce n'est pas un artefact de calcul : l'écart **se resserre** quand on affine
  la simulation — 15,2 dB à 6 kHz, 12,4 à 10, 9,9 à 20 —, donc l'aigu vient du
  modèle. Il manquait le pot : la résonance d'échappement est un bruit blanc,
  elle atténue de 17 dB à toutes les fréquences également et ne filtre rien.

  Un passe-bas réglable est placé avant la séparation du son sec et du son
  réverbéré. À 3 500 Hz par défaut, l'écart passe à 26 dB. Il se tourne en
  écoutant, sans couper le son.

- **Un profil déclare d'où vient son son**, parmi trois origines : *enregistré*
  — la banque d'échantillons jouée en changeant sa vitesse de lecture, ce que
  fait l'application depuis le début —, *généré en direct* — le moteur simulé
  pendant la conduite — et *généré à l'avance* — une banque produite au bureau
  par cette simulation, une prise par plage de régime, que la voiture rejoue.

  Le choix se fait dans l'écran de configuration, panneau *Profils*, et suit le
  profil dans un export en fichier comme dans un lien de partage. Un profil peut
  aussi porter la définition du moteur qui a produit sa banque, pour qu'une
  banque générée ne devienne pas une boîte noire qu'on ne saurait plus refaire.

  Les trois origines sont gréées, et c'est le même bouton « Activer le son » qui
  les démarre. Un navigateur sans `AudioWorklet` ni WebAssembly ne peut pas faire
  tourner le moteur simulé : il le dit, et la banque continue de jouer plutôt que
  de grésiller.

  Les profils déjà enregistrés sont repris en *enregistré*, ce qu'ils ont
  toujours été. La version du format de profil passe de 2 à 3.

- **Une banque d'échantillons produite ici par engine-sim, et rejouée telle
  quelle dans la voiture.** `scripts/generate-bank/` fait tourner le moteur
  simulé au bureau, aussi lentement qu'il le faut, à un régime tenu par un
  dynamomètre, et en tire une prise par plage de régime — en charge et pied
  levé, plus le ralenti et le rupteur. Rien n'est modifié dans le moteur de
  lecture : la banque et le profil qui la déclare s'importent tels quels.

  Ce que ça corrige. La banque enregistrée est jouée entre 0,26 et 0,81 fois sa
  vitesse sur toute la conduite ordinaire, et le rééchantillonnage descend les
  résonances de l'échappement en même temps que la fréquence d'allumage : un
  moteur change de régime sans changer de corps. Mesuré sur le V8 simulé, le
  centroïde spectral ne suit le régime qu'à 8 % — 0,21 octave de timbre pour 2,67
  octaves de régime. C'est bien le rééchantillonnage qui déplace le timbre, pas
  le moteur.

  Combien de prises faut-il ? La question se mesure : on génère au quart
  d'octave, avec une prise témoin au milieu de chaque intervalle, puis on compare
  ce que donneraient les écartements plus larges. Une octave laisse 2,7 demi-tons
  d'erreur de timbre, un demi-octave 1,0, un quart 0,78 pour deux fois plus de
  prises. **Le demi-octave est retenu** : huit ancrages par famille, plus le
  ralenti et le rupteur, et une vitesse de lecture qui reste entre 0,74 et 1,36
  au lieu de 0,26 à 0,81.

  Les boucles font un nombre entier de cycles moteur, ce qui met leurs deux bouts
  en phase par construction. Saut d'énergie au raccord, une fois la fermeture de
  l'application appliquée : 1,6 % en médiane, 4,8 % au pire sur les 18 prises —
  contre 2,3 % et 10,8 % mesurés de la même façon sur la banque enregistrée.

  Les ancrages, les gains et les bornes de lecture sont **mesurés**, pas relevés
  à la main : c'est ce que le lot BANQUES devait faire à l'oreille. Un seul
  chiffre reste un choix — de combien rabattre le relief de niveau, qui couvre
  37,4 dB bruts sur le V8 et 13,1 dB une fois rabattu. C'est le premier réglage à
  juger à l'oreille, et le timbre n'a encore été écouté par personne.

- **Le son d'engine-sim sort, et il suit le régime.** Le portage WebAssembly ne
  produisait que des chiffres ; il produit maintenant du son, joué en direct, à
  la cadence du navigateur. Un onglet **Synthèse**, réservé au développement
  comme le simulateur, l'allume et le règle.

  Trois fils : le fil principal transmet à chaque tour de boucle le **régime du
  cadran** et l'**effort** ; un fil de calcul fait tourner engine-sim et remplit
  une réserve ; un `AudioWorklet` la vide et compte ce qui manque. Le calcul
  n'est pas dans le fil audio, faute de pouvoir y instancier un module
  Emscripten sans `SharedArrayBuffer` — donc sans les en-têtes COOP/COEP que le
  lot a écartés. Ce qu'on y gagne : une pointe de calcul mange la réserve au
  lieu de faire un trou.

  Le **régime est imposé au dynamomètre** d'engine-sim plutôt que trouvé par le
  moteur : le régime entendu et celui du cadran doivent dire la même chose,
  sinon c'est le compteur qu'on croira faux. Mesuré, du ralenti au rupteur :
  écart nul, à l'unité près.

  Relevé sur un Ryzen 7 7800X3D, contexte audio à 48 kHz, l'application entière
  tournant à côté, résonance d'échappement déportée sur un `ConvolverNode` :
  **×2,0 temps réel** pour le V8 à 10 kHz de simulation, **×3,7** pour un quatre
  cylindres, **×0,95** si l'on laisse engine-sim convoluer lui-même. Réserve
  tenue à 250 ms, **aucun creux** sur un balayage complet 800 → 6 500 tr/min. Le
  seuil du lot est ×3 dans la voiture, où rien de tout cela n'a encore été
  mesuré : sur ce poste, seul le quatre cylindres le passe.

  Le banc affiche ce qui se mesure — régime demandé et entendu, coefficient
  temps réel, charge, creux, réserve, niveau crête, niveau efficace, brillance —
  et donne un **balayage de régime** pour écouter la montée sans rouler. **Le
  timbre, lui, reste à juger à l'oreille** : la machine ne peut pas le faire.

- **L'effort du moteur tient compte de la vitesse : la croisière n'est plus
  plate.** Faute de pédale, tout se déduisait de l'accélération, si bien que
  tenir une allure donnait toujours le même demi — mesuré, cinq allures tenues à
  0,50 au centième près, de l'arrêt à 130 km/h. Or tenir 130 demande beaucoup de
  couple et tenir 30 presque rien : la traînée croît comme le carré de la vitesse.

  Deux grandeurs remplacent donc l'unique charge. La **charge** dit l'intention
  du conducteur et pilote la boîte, inchangée. L'**effort** dit le travail du
  moteur — l'accélération plus la traînée — et pilote le son : le fondu entre
  « en charge » et « pied levé », et le relief de charge. Un réglage nouveau, le
  **repère de traînée**, donne la vitesse à laquelle tenir l'allure consomme la
  moitié de l'effort maximal : 130 km/h sur Route, 150 sur Sport.

  Mesuré sur Route : l'effort passe de 0,07 à 30 km/h tenus à 0,57 à 130, et la
  croisière s'étage sur 3,4 dB là où elle était plate. Une reprise douce à
  130 km/h passe 2,2 dB au-dessus de la croisière à la même vitesse. La charge,
  elle, n'a pas bougé d'un centième — aucun seuil de passage n'est à recaler, et
  les tests de la boîte le vérifient.

  `idleLevelDb` est recalé de −5 à −1 sur Route et de −5 à 0 sur Sport : l'effort
  vaut zéro à l'arrêt là où la charge valait un demi sans raison, et le relief lui
  retirait donc ses décibels pleins. **Un profil déjà enregistré est repris de la
  même façon** — sans quoi son ralenti aurait sonné quatre à cinq décibels plus
  bas qu'hier, sans que rien ne le dise.


- **Trois modes de simulation**, pour éprouver toute la chaîne sans rouler. Le
  simulateur livrait jusqu'ici une vitesse parfaite à chaque image, ce qui fait
  disparaître toute la difficulté du produit : mesuré en croisière tenue à
  110 km/h, l'accélération vue vaut exactement zéro, quand un vrai GPS en montre
  0,51 m/s² de pointe — un quart de la charge pleine du profil Route, sur une
  vitesse qui ne bouge pas.

  *Vitesse exacte* garde ce comportement, commode pour juger un réglage de son.
  *Mesure GPS* livre la même vitesse à la cadence d'un récepteur (30 ms en
  roulant, deux secondes à l'arrêt : les valeurs mesurées sur la voiture) et
  bruitée. *Positions GPS* fabrique des positions complètes que la **vraie**
  source GPS traite — le seul mode qui éprouve la dérivation par distance, le
  rejet des positions trop rapprochées et le filtre de précision, c'est-à-dire
  exactement là où vivaient les deux derniers défauts relevés en roulant. Le
  blocage du 4 septembre se reproduit désormais au banc, sans voiture.

  Une case « le récepteur annonce sa vitesse » permet d'écouter les deux cas : on
  ne sait toujours pas ce que fait la Tesla, et l'attendre coûterait un trajet.

  Mesuré au banc : écart-type de l'accélération vue de 0 en vitesse exacte, 0,177
  en mesure GPS, 0,179 en positions.

- **L'application dit quelle version elle sert**, en tête de la section
  *Appareil* de l'écran de télémétrie. Dans la voiture il n'y a ni console ni
  outils de développement, un service worker garde un cache, et rien ne
  permettait de savoir si l'on essayait la version qu'on croyait — un correctif
  jugé sur la version précédente est un correctif jugé pour rien. Le numéro est
  lu dans `package.json` au moment de la construction.

- **Une manette Xbox conduit le simulateur.** Deux gâchettes analogiques valent
  mieux qu'une flèche du clavier pour juger un son : la charge s'entend sur des
  transitions, et une commande tout ou rien ne produit que la plus brutale.
  Gâchette droite pour accélérer, gauche pour freiner, A et B pour changer de
  rapport, X pour la boîte automatique ou manuelle, Y pour tenir la vitesse ou
  rendre la main, stick gauche pour le volume.

  La lecture est une pièce du cœur qui ne parle pas au navigateur : elle reçoit
  un instantané de boutons et rend des intentions, ce qui la rend vérifiable
  sans manette — onze tests couvrent les zones mortes, le redressement de course,
  les bascules qui ne comptent qu'une fois par appui et la manette débranchée en
  pleine accélération. La manette ne prend la main sur les curseurs de l'écran
  qu'en étant touchée, et la rend en revenant au repos.

  Deux choses corrigées aussitôt, la manette n'étant pas détectée sur le poste de
  David. **Aucun agencement n'est plus refusé** : exiger `mapping === 'standard'`
  écartait en silence une manette qui s'annonce autrement — ce qui dépend du
  navigateur, du pilote et du mode de liaison. Et **la détection ne dépend plus de
  la boucle** : elle passe par l'événement de connexion, qui arrive au premier
  appui, si bien qu'une boucle à l'arrêt ne fait plus dire à l'écran qu'aucune
  manette n'est branchée. L'écran annonce enfin ce que le navigateur voit — nom et
  agencement — et prévient quand l'agencement n'est pas standard.

- **Un journal de bord, déposé tout seul.** Le navigateur de la voiture n'a pas
  de console : on ne consulte rien au volant, et le diagnostic se faisait donc en
  devinant. Le drapeau qui distingue une vitesse lue d'une vitesse déduite
  existait depuis le premier jour sans être affiché nulle part — il aurait
  désigné en une seconde un défaut qui a vécu une semaine.

  L'application retient désormais des **événements horodatés** — source de
  vitesse et son état, bascule de l'origine de la vitesse, relances du suivi,
  mesures rejetées par motif, suspensions du son, erreurs — plus un relevé
  toutes les dix secondes. Des faits qui se comptent, et non du texte : on ne
  répond pas à « combien de fois » avec de la prose. Les états ne sont inscrits
  qu'à leurs **transitions**, sans quoi la boucle en produirait deux cent seize
  mille lignes à l'heure ; mesuré sur une minute de conduite étale, il en reste
  sept.

  Le dépôt est **automatique**, toutes les cinq minutes ou dès qu'une tranche
  atteint sa taille, par le chemin d'écriture déjà en place sur le serveur — dans
  un dossier `journal/` séparé de celui des traces, dont l'index est téléchargé
  par l'application pour les lister. Pas de connexion permanente : une voiture
  traverse des zones sans réseau, et le temps réel n'a de valeur que si quelqu'un
  regarde, or celui qui pourrait regarder conduit. Ce qui n'a pas pu partir est
  gardé et **joint à la tranche suivante**, si bien qu'un tunnel ne coûte pas un
  journal — et non un fichier par tentative.

  Des tranches, et non un fichier réécrit à chaque envoi. Le stockage aurait été
  le même, mais ce qu'on renvoie grossit à chaque fois puisque c'est le journal
  complet depuis le début : sur une demi-heure, huit fois trop de données
  transférées, et un dernier envoi de deux cents kilo-octets qui doit réussir en
  entier sur un réseau intermittent.

  **Rien ne part par défaut, et l'accord a deux crans.** Une fenêtre de
  confirmation dit ce qui sera envoyé avant que cela ne parte. Le minimum couvre
  ce que fait l'application ; le cran étendu ajoute **la position**, un point par
  seconde, et se choisit séparément — il ne se déduit jamais du premier, une
  donnée de déplacement se disant avant et non après. Couper est immédiat, sans
  confirmation : on n'a pas à confirmer qu'on ne veut plus rien envoyer.

  La règle vit dans le cœur et non dans l'interface : c'est une fonction
  vérifiable par un test qui décide de ce qui peut être inscrit, et un test
  échoue si une position se glisse au cran minimum. Une promesse faite à
  l'utilisateur mérite mieux qu'une condition d'affichage.

  La position est tenue **hors du flux des mesures**. Ce flux est recopié tel
  quel par l'enregistreur de traces, et une trace s'exporte et se dépose sans
  accord particulier : y faire entrer des coordonnées les aurait fait sortir par
  une porte déjà ouverte.

  L'application ne peut pas effacer ses journaux — le serveur ne lui ouvre que
  l'écriture — et c'est voulu : un témoin qui peut effacer ses notes est un
  mauvais témoin. Le ménage se fait avec File Station, et l'écran dit ce qui a
  été déposé.

- Quatre lignes dans « Qualité du signal » de l'écran Télémétrie :
  l'**origine de la vitesse** — lue du navigateur ou déduite de deux positions —,
  les **positions reçues**, les **vitesses produites** et les **rejets** par
  motif. Le drapeau qui distingue une vitesse déduite d'une vitesse lue existait
  depuis le premier jour et n'était affiché nulle part : c'est ce qui a rendu
  invisible pendant une semaine le défaut du repli ci-dessus. Une source qui
  reçoit des positions sans en tirer aucune vitesse donne le même écran qu'une
  source muette ; ces comptes distinguent les deux.
- **Les positions imprécises sont écartées**, par un réglage nouveau —
  *Précision GPS acceptée*, dans « Signal de vitesse ». La précision annoncée
  avec chaque position était transmise depuis le premier jour et ne servait à
  rien : un point à 200 mètres près entrait dans le calcul comme un point à 5
  mètres. Une position écartée n'est ni une mesure ni la référence de la
  mesure suivante, et son rejet se compte à l'écran.

  Le seuil est livré à **250 mètres, volontairement large** : les valeurs de la
  voiture ne sont pas mesurées, et un seuil trop serré rejetterait des mesures
  saines pour faire taire le GPS — le défaut qu'on vient de corriger deux fois.
  Une position dont la précision n'est pas renseignée n'est jamais rejetée : un
  champ absent n'est pas un mauvais chiffre.
- Deux lignes de plus dans « Qualité du signal » : la **précision annoncée**
  avec la dernière position, et les **douze dernières**. C'est ce relevé qui
  servira à resserrer le seuil ci-dessus, sur des chiffres et non sur une
  intuition.
- **Une section « Appareil »** sur l'écran Télémétrie : largeur et hauteur
  utiles de la page en pixels CSS, taille d'écran annoncée, densité de pixels,
  réponse de l'API de maintien d'écran allumé, et état de l'autorisation de
  géolocalisation **relevé au chargement** — plus tard, il vaudrait « accordée »
  dans tous les cas et ne dirait plus si la voiture la retient d'une session à
  l'autre. Le zoom du navigateur de bord n'est pas réglable et sa valeur par
  défaut a changé : la mise en page ne peut se caler que sur un relevé.

- **Un tableau de bord à cadrans** sur l'écran de conduite : compteur de vitesse,
  compte-tours avec sa zone de rupteur, rapport engagé au centre. L'écran a deux
  visages et l'on passe de l'un à l'autre — les cadrans pour conduire, les
  chiffres pour régler, car un écart de cent tours ne se voit pas sur une
  aiguille. Le mouvement d'une aiguille **est** la valeur : il ne relevait pas de
  la règle qui interdit les animations.

  Un **paysage** défile derrière les cadrans, coupé par défaut. Celui-là est de
  l'agrément assumé, et la règle a été levée pour lui seul. Mesuré avant de le
  promettre, sur la même trace rejouée : l'écart de durée d'image entre décor
  coupé et décor actif est de 0,2 ms, plus petit que l'écart de passe à passe du
  même état (1,8 ms), et aucune image ne dépasse 33 ms dans les deux cas.

  L'échelle du compteur est fixe à 180 km/h. La déduire de la voiture donnait
  304 km/h sur Route : l'aiguille aurait passé sa vie dans le coin inférieur
  gauche. Un compteur se gradue pour ce qu'on roule.
- **Un mode simplifié** de l'écran de configuration : deux curseurs globaux et le
  nombre de rapports, le détail des cinquante réglages attendant derrière une
  bascule « avancé ». Aucun réglage n'est supprimé.

  Le curseur **calme ↔ sportif** commande onze valeurs du moteur et de la boîte ;
  le curseur **pépère ↔ nerveux** commande la réactivité du signal, ce qui n'est
  pas la même chose — une voiture calme peut être vive. Le milieu de ce second
  curseur est exactement le réglage qui a servi jusqu'ici.

  Le tempérament n'est pas stocké : il se **déduit** des réglages. Les lois du
  guide de création sont devenues inversibles, si bien qu'un profil réglé à la
  main se lit quand même sur les curseurs, à un dix-millième près. Le guide passe
  désormais par ces mêmes lois — quatre-vingt-seize lignes de règles dupliquées
  ont disparu.

  Un mouvement de curseur global écrase les réglages détaillés, mais **se
  rattrape** : l'état d'avant est pris au premier mouvement et gardé jusqu'à
  usage.
- **Le nombre de rapports se règle**, de trois à huit. Il était déjà modifiable
  par la saisie d'une liste, mais les tables de seuils et de temporisations ne
  suivaient pas : un rapport ajouté héritait du seuil de son prédécesseur et
  d'une temporisation étrangère au profil. Le premier et le dernier rapport sont
  désormais conservés, le pont avec eux, donc le régime en dernier rapport à
  110 km/h ne bouge pas — 2355 tr/min sur Route, quel que soit le nombre.
- **Un écran d'étalonnage** : un protocole guidé en six étapes — ville, route,
  autoroute, accélération franche, décélération pied levé, freinage franc — qui
  mesure la vraie voiture et propose onze réglages en regard de ceux du profil.
  Chaque étape juge si elle a bien été faite : une « accélération franche » qui
  n'atteint pas le critère est refusée, et la raison est dite, plutôt que de
  donner une charge fausse.

  **Elle propose, elle n'applique pas** : chaque valeur se recopie séparément,
  jamais en bloc, et le profil sait revenir à ce qu'il était.
- **Le moteur tremble.** Un tremblement lent s'ajoute au régime, d'amplitude
  décroissante avec le régime et avec la charge — un moteur se stabilise en
  poussant, il tremble au ralenti et à vide. Il ne touche pas la boîte : le
  moteur sort désormais deux régimes, le net qui pilote les seuils de passage et
  le **régime entendu** qui porte le tremblement et ne sert qu'aux hauteurs de
  lecture.
- **Deux couches d'une même famille jouent légèrement désaccordées**, ce qui
  produit le battement lent d'un moteur réel. Mesuré : le désaccord ne déplace
  aucun gain, au bit près, et ne peut pas sortir une couche de son domaine
  jouable.
- **Le serveur accepte le dépôt d'une trace.** Le navigateur de la voiture refuse
  tout téléchargement : rien ne sortait d'une session d'enregistrement, alors que
  les traces ne servent qu'ailleurs. Un dossier `traces/` est servi en lecture
  comme les profils, et en écriture pour la seule méthode qui dépose un fichier —
  ni suppression, ni création de dossier. L'écriture exige l'authentification en
  toutes circonstances, y compris quand celle du site reste désactivée.
- **Une trace se dépose sur le serveur depuis la voiture.** C'est le seul moyen
  de l'en sortir : le navigateur de bord refuse tout téléchargement, alors que
  les traces naissent en roulant et ne servent qu'ailleurs.

  L'application s'annonce avec un **compte du fichier `htpasswd`** — un nom et un
  mot de passe — réglé une fois à l'écran de configuration et rangé hors du
  profil. Elle est obligée de le faire elle-même : le navigateur ne demande
  l'authentification que sur une navigation, jamais sur une requête lancée par
  une page, si bien qu'un dépôt aurait échoué en silence.

  Le compte déjà créé fonctionne, mais un second dédié au dépôt vaut mieux : il
  vit en clair dans le navigateur de la voiture, et il ne donnerait pas accès au
  site entier si l'authentification générale était activée un jour.

  Le champ dit que la saisie est retenue, et sa longueur : l'écran de
  configuration n'a pas de bouton d'enregistrement — tout s'y applique à la
  frappe — mais pour un champ masqué, rien ne le montrait.

  Le nom du fichier dit la date, l'enregistrement et sa durée, et il se relit par
  la fonction d'import. Chaque échec dit lequel il est — compte absent, refus
  d'authentification, droit d'écriture manquant, hors couverture, déjà déposée — parce
  qu'ils ne se corrigent pas au même endroit. Une trace n'est jamais perdue au
  profit d'un dépôt raté.

- Trois lignes dans « Qualité du signal » de l'écran Télémétrie : la **cadence
  typique** des mesures — la médiane, car une seule interruption rend une
  moyenne illisible — et le **nombre de mesures** qui servent à estimer la
  pente. C'est ce chiffre qui a permis de trouver le défaut ci-dessus.
- Une **seconde pile Portainer**, sur l'étiquette `develop`, pour essayer en
  voiture ce qui n'est pas encore sorti sans toucher à l'application qui sert au
  quotidien : `docker/docker-compose.develop.yml`, et la marche à suivre dans le
  README — port, proxy inversé, et ce que les deux piles ne partagent pas.
- Process de développement écrit : `CLAUDE.md` (langue, git flow, contrôle
  qualité, workflow par défaut, release), `CONTEXT.md` (glossaire du projet) et
  `docs/agents/` (configuration des skills de backlog).
- Backlog par lot dans `.backlog/`.
- **211 tests sur le cœur de l'application**, avec Vitest : conditionnement du
  signal, moteur, boîte de vitesses, mixage, analyse d'échantillon, simulateur,
  rejeu de trace, profils et partage. 94,6 % des lignes de `src/core/`
  couvertes. Les tests tournent sous Node, sans navigateur, en une seconde.
- ESLint, et les commandes `npm run lint`, `npm test`, `npm run test:watch` et
  `npm run coverage`.
- Chaîne d'intégration : types, style, tests et construction du paquet sur
  chaque PR vers `develop` et `main`.
- Publication de l'image Docker depuis `develop` (étiquette `develop`) en plus
  de `main` (`latest`), et depuis un tag de version.

### Modifié

- **Une boîte à sept rapports, étagée pour tenir bas.** Les trois premiers
  rapports ne bougent pas — le départ mesuré le 11 septembre au soir est celui
  que David a jugé juste. Les quatre autres sont redessinés depuis les vitesses
  qu'il a nommées, avec une septième pour l'autoroute :

  | | avant | après |
  |---|---|---|
  | 50 km/h en quatrième | 1 532 tr/min | **1 487** |
  | 80 km/h en cinquième | 2 046 tr/min | **1 737** |
  | 110 km/h en sixième | 2 355 tr/min | **1 734** |
  | 130 km/h en septième | — | **1 508** |

  Les sauts s'écrasaient en haut de boîte — 1,32 · 1,20 · 1,19 — et valent
  maintenant 1,36 · 1,37 · 1,38 · 1,36. La septième entre vers 125 km/h.

  Les profils et les boîtes déjà enregistrés la reçoivent en s'ouvrant, y
  compris ceux reçus par un lien de partage. Une boîte réglée à la main n'est
  pas touchée : elle garde ce qu'on lui a donné.

- **Les rapports passent plus tôt en mode Route.** David : « ça reste trop
  longtemps en deux ». La marge au-dessus du ralenti passe de 900 à 640 tr/min,
  soit −20 % sur le seuil pied au plancher et −15 % en conduite ordinaire. Le
  mode Sport ne bouge pas. En accélération douce, les rapports cèdent maintenant
  à 2 210, 1 983, 1 999, 1 995 et 1 969 tr/min, contre 3 005, 2 597, 2 367 et
  2 324 avant — cinq valeurs presque égales, signature d'une boîte régulièrement
  étagée.

- **La boîte se décide sur un seul plancher de régime.** On monte dès que le
  rapport suivant tournerait au-dessus du ralenti plus une marge, et on descend
  quand le rapport engagé tombe sous une marge un peu plus basse. La marge vient
  du mode de conduite et se déplace avec la demande — elle double à pleine
  charge. Le premier passage échappe à la règle : la deuxième s'engage dès
  qu'elle tient au-dessus du ralenti, quels que soient le mode et la charge.

  Mesuré sur le profil Route en mode Route, accélération douce : les rapports
  cèdent à 3005, 2597, 2367 et 2324 tr/min, contre 3700, 3350, 3050 et 2950
  avant. Pied au plancher : 4296, 3632, 3333 et 3213.

  Deux mécanismes disparaissent, le plancher faisant leur travail : la montée en
  croisière et la descente au freinage. Un seul nombre gouvernant les deux sens,
  ils ne peuvent plus se contredire — c'est ce qui ouvrait sur chaque rapport une
  plage de vitesse où la croisière autorisait un rapport que la descente au
  régime refusait, et où la boîte faisait le va-et-vient. Entendu le 10 septembre
  2026 entre 70 et 72 km/h, et relevé au journal.

- **Le rétrogradage forcé dépend du mode.** Pied au plancher en Route, demande
  forte en Sport. Sept rétrogradages en trente-six minutes le 10 septembre, sur
  des relances ordinaires : le seuil du profil ne distinguait pas les deux modes.


- **Aucune image publiée ne porte plus les écrans de banc.** L'image
  d'intégration les portait, et l'application y démarrait donc sur le simulateur
  au lieu du GPS — trente-six secondes de simulateur sur l'essai du
  10 septembre 2026. Le banc reste en développement.

- **Ce qui part vers le serveur est compressé dans le navigateur**, par le
  compresseur natif et sans bibliothèque — l'application doit se charger hors
  réseau. Mesuré sur les huit tranches de l'essai du 10 septembre 2026 :
  **226 483 octets deviennent 32 309, soit 85,7 % de moins**, la meilleure
  tranche tombant à 93 %. Le gain porte d'abord sur la 4G en roulant, ensuite
  sur la place du serveur. Là où le navigateur ne sait pas compresser, la
  tranche part en clair plutôt que pas du tout.

  Les profils et les relevés de mesure restent en clair : l'application les
  retélécharge et les lit, et la bibliothèque de profils cesserait de
  fonctionner.

- **Le panneau des traces disparaît de l'écran de télémétrie** — capturer,
  nommer, lister, supprimer, exporter, importer, rejouer, déposer. Une ligne
  d'état le remplace. Deux mécanismes qui décrivent le même fait finissent par
  diverger, et ce dépôt l'a déjà payé deux fois.

  **Cela retire le seul rejeu sonore existant**, que le CHANGELOG appelait
  « l'outil de mise au point le plus utile du projet ». C'est un prix accepté,
  pas un oubli : le rejeu revient avec le relecteur, qui jouera une capture avec
  la configuration de son en-tête.

  L'étalonnage embarqué, lui, garde son enregistrement borné par étape :
  délimiter une mesure n'est pas capturer une session, et une étape mal bornée
  donne une mesure fausse. Un échec du stockage local se dit désormais sur son
  panneau, faute de quoi il ne se dirait plus nulle part.

- Le découpage en tranches, écrit pour le journal, est devenu une pièce à part :
  la capture en avait besoin à l'identique, et le recopier aurait fait deux
  mécanismes de plus.


- Le profil actif est **assemblé** depuis les groupes qu'il désigne : son
  moteur, sa boîte et la voiture de l'appareil. Les réglages de l'écran de
  configuration atterrissent dans le groupe où ils vivent, et corriger un
  moteur s'entend dans tous les profils qui le jouent.
- Les pétarades suivent le moteur : c'est son échappement qui claque.
- Les profils enregistrés sont scindés au chargement — chacun reçoit un moteur
  et une boîte, ou retrouve ceux qui lui ressemblent, sans doublon dans la
  liste.
- Un profil reçu par lien ou par fichier reçoit un moteur d'ici : il jouait
  bien, il se règle maintenant aussi.

- **Le point d'écoute « Dehors » referme le silencieux à 4 kHz.** Il laissait
  tout passer, y compris ce que le moteur simulé produit au-dessus, et ce qu'il
  y produit n'est pas du moteur : des bouffées d'aigu, quatre à cinq par
  seconde, +6,4 dB à 8 kHz pendant la bouffée alors que le grave ne bouge pas.
  Elles viennent du moteur lui-même — le banc en produit quatre par seconde, la
  capture prise dans la voiture quatre et demie.

  Le prix est nul, mesuré sur cette capture : 13 dB retirés à 8 kHz, et **aucune
  bande utile déplacée** — 250, 500, 1 000 et 2 000 Hz ne bougent pas d'un
  dixième de décibel, le moteur y étant déjà à −40 dB. Les ruptures fortes
  tombent de 126 à 86. David : « c'est mieux, même si c'est pas encore parfait ».

- **La gigue d'échantillonnage est coupée sur tous les moteurs.** C'était elle,
  le cliquetis que David traquait — « des frt frt frt à plus haute fréquence que
  le moteur ». `inputSampleNoise` n'est pas un tremblement de moteur mais une
  ligne à retard dont la position de lecture est tirée au sort à chaque
  échantillon : elle crépite. Mesuré sur le GM LS au ralenti, ce que la valeur
  portée par le projet ajoutait à elle seule : **8,7 dB à 5 600 Hz et 25,5 dB à
  8 000 Hz**. Elle avait été posée à 0,05 « jugée à l'oreille » sans qu'on
  mesure ce qu'elle faisait à l'aigu. Verdict de David sur les deux sons
  égalisés : « c'est bon, le claquement est supprimé ».

  Le curseur reste — la gigue est un caractère de moteur, et les fichiers
  d'engine-sim en déclarent jusqu'à 0,5 — mais elle ne s'allume plus toute seule.

- **La crête visée des moteurs non réglés descend de 12 000 à 9 000.** Douze
  mille suffisait au son sec, pas à ce qui sort : mesuré sur le Chevrolet 454 au
  ralenti, la crête en fin de chaîne montait à 1,19, que les deux décibels de
  marge ne rattrapaient pas tout à fait — David entendait encore le parasite sur
  ce moteur quand il avait disparu du GM LS, lequel vise 16 000 et sort à 0,96.
  À neuf mille, le 454 tombe à 1,01 avant marge, donc 0,80 après.

- **La sortie garde deux décibels de marge sous le plafond.** C'est le remède au
  débordement ci-dessus : à 1,194 de crête mesurée, deux décibels ramènent le cas
  à 0,95. Le niveau perdu se rattrape avec le volume de l'appareil, en flottant,
  où rien ne plafonne. Ce n'est pas un réglage — un curseur de plus pour une
  valeur qu'on ne touche qu'une fois n'aurait pas sa place dans un écran qu'on
  vient de décider d'alléger.

- **La résonance d'échappement passe à 45 % pour tous les moteurs**, et la
  réserve du lecteur à 60 ms. Ce sont les valeurs que David tient au volant ; la
  première n'était réglée que sur le GM LS, les autres moteurs passaient tout
  leur son par la réponse d'échappement — celle d'un V8 Chevrolet, y compris
  sous un quatre cylindres.

- **Le volume de la synthèse ne voyage plus avec le moteur.** Il faisait partie
  du rendu, donc essayer plusieurs moteurs le remettait à chaque chargement —
  David : « c'est chiant que ça change à chaque fois ». On comparait deux timbres
  à deux niveaux. C'est désormais un réglage du banc, à un par défaut, et il
  reste où on l'a mis quel que soit le moteur chargé. Les profils enregistrés
  montent en version 7 : celui qu'ils portaient encore est ignoré, et disparaît
  du stockage au premier enregistrement.

- **La crête visée du GM LS descend de 32 000 à 16 000, et l'écrêtage avec.**
  Elle était réglée tout contre le plafond des entiers 16 bits, ce qui
  s'entendait : « de petits moments où tout d'un coup le bruit part en écrêtage,
  2-3 %, mais c'est très audible ». Mesuré au ralenti sur le V8, part
  d'échantillons butés sur le plafond en moyenne puis en pointe : 1,26 % et
  2,73 % à trente-deux mille au volume désormais livré, contre 0,02 % et 0,39 %
  à seize mille. Le niveau perdu se rattrape avec le volume de l'appareil, en
  flottant, où rien ne plafonne. Le délissage n'y était pour rien — mesuré au même
  endroit, la pointe vaut 1,46 % avec lui comme sans lui, et la moyenne passe
  seulement de 0,45 à 0,51 %.

- **Le délissage est livré à soixante tours et un hertz et demi**, les valeurs
  que David a trouvées à l'oreille. La dérive est dix fois plus lente que
  l'estimation livrée la veille, et l'amplitude quatre fois plus large.

- **Le moteur simulé reçoit le régime entendu, celui qui tremble.** Il recevait
  le régime net, au motif que « le tremblement sort tout seul du modèle
  physique ». Mesuré : il n'en sort pas. Le régime tenu par le moteur simulé est
  exactement le régime demandé — 780 pour 780, 2 952 pour 2 952 — parce que le
  dynamomètre travaille au couple maximum de son domaine. Le son n'avait donc
  aucune variation de régime, et un régime rigoureusement constant donne un
  signal rigoureusement périodique : c'est une part de ce qui le fait entendre
  comme une machine.

- **Le dynamomètre ne fait pas respirer le moteur simulé, et la mesure le
  tranche.** Le code annonçait depuis le début que baisser son couple
  « laisse le régime respirer entre les explosions ». Balayé de dix mille à
  vingt à 2 950 tr/min : jusqu'à quarante le régime tenu vaut exactement le
  régime demandé, puis il s'établit plus bas — 2 728, 2 576, 2 435 — et chaque
  fois aussi figé. Le baisser ne fait pas osciller le régime, il le fausse. Le
  réglage reste donc à son maximum et n'est exposé nulle part ; ce que la mesure
  a montré est écrit là où quelqu'un serait tenté de recommencer.

- **Le simulateur a sa propre page.** Ses commandes — les deux pédales, le
  curseur d'allure maintenue, les réglages de cadence, de bruit et de précision
  — vivaient sous les cadrans de l'écran de conduite, qui est déjà le plus
  chargé de l'application. Elles sont sur un écran **Banc**, qui rappelle la
  vitesse, le régime et le rapport pour se suffire à lui-même : on s'en sert
  garé, sans regarder les cadrans. La hauteur de l'écran de conduite en
  simulateur tombe de six cents pixels environ à quatre cents.

- **Une position déjà connue du système est acceptée, jusqu'à dix secondes.**
  Elle était refusée — `maximumAge: 0` —, ce qui faisait attendre un point neuf
  à chaque démarrage : plusieurs minutes sous un bâtiment, alors que le
  récepteur en avait un sous la main. C'est ce qui rendait le contournement du
  8 septembre efficace, une version obtenant le signal dont l'autre ne voulait
  pas. Dix secondes, parce qu'une position de dix secondes annonce une vitesse
  de dix secondes : prise garé elle dit zéro, prise en roulant elle est proche
  de l'allure du moment, et le lissage la rattrape en une seconde.

- **Les écrans de banc sont dans l'image d'intégration.** Le simulateur de
  vitesse et l'écran de réglage de la synthèse n'existaient qu'en développement,
  sur le poste. Ils sont désormais aussi dans l'image `:develop` — celle qu'on
  essaie dans la voiture —, et toujours absents de la production. C'est garé
  qu'un timbre se règle, et le simulateur reste le test qui distingue un défaut
  de son d'un défaut de signal.

- **L'écran de synthèse n'est plus troué.** Sa grille alignait ses lignes sur la
  plus haute section : « Le calcul » faisait mille pixels de haut, ses deux
  voisines deux cent soixante-dix, et sept cents pixels de vide s'ouvraient sous
  chacune ; deux autres sections occupaient une colonne sur trois en laissant les
  deux autres vides. « Plein de trous », a dit David, et c'était mesurable.

  Les deux relevés passent côte à côte en haut, où ils restent sous les yeux
  pendant qu'on règle, et le reste coule en colonnes qui se remplissent l'une
  après l'autre. Mesuré après : les deux colonnes s'arrêtent à la même hauteur.

- **Le choix de la source de vitesse disparaît en voiture.** David : « en voiture
  on est toujours en GPS, pas besoin des boutons simu ou rejeu ». Le simulateur
  et le rejeu sont des outils d'atelier ; ils ne sont proposés qu'en
  développement, et la rangée entière s'efface quand il ne reste que le GPS — un
  seul bouton qu'on ne peut pas désactiver n'est pas un choix. Le statut de la
  source, lui, reste affiché.

- **Le suivi GPS repart quand il n'a jamais démarré.** Au départ d'un parking
  souterrain, aucune position n'était acquise et rien ne repartait une fois
  dehors : il fallait lancer l'ancienne version, obtenir un signal avec elle,
  puis revenir. Le chien de garde se déclenche sur le silence de la source, et
  ce silence valait zéro tant qu'aucune mesure n'était **jamais** arrivée — il
  couvrait la perte du signal en route, pas le signal jamais acquis. L'attente
  court désormais depuis la mise en marche. Mesuré sur une source muette : le
  compteur passe de 0 ms figé à 250 s, et le suivi est relancé toutes les cinq
  secondes au lieu de jamais.

- **L'écran dit ce qu'il attend quand le GPS ne donne rien.** La vitesse restait
  à zéro sans un mot, et le chien de garde relançait en silence : rien ne disait
  s'il fallait patienter, ressortir, ou donner une autorisation. L'écran de
  conduite annonce maintenant le silence en secondes, le nombre de relances, et
  distingue une source dont aucune position n'est jamais arrivée d'une source
  qui s'est tue en route.

- **Le bouton du son s'allume quand du son sort, quelle que soit son origine.**
  Sous un profil « généré en direct », il annonçait « Son actif » en gris pendant
  que le moteur simulé jouait : son texte tenait compte de l'origine, sa couleur
  non — elle ne regardait que la banque, restée vide. Il est jaune comme les
  autres commandes en service. Le curseur de volume et le message d'erreur, qui
  ne regardaient eux aussi que la banque, suivent la même lecture : le volume
  reste réglable en synthèse, et une erreur du moteur simulé s'affiche au lieu de
  laisser « Son en erreur » sans explication.

- **Changer l'origine du son d'un profil prend effet tout de suite.** Passer un
  profil de « enregistré » à « généré en direct » pendant que le son jouait ne
  changeait rien : la banque continuait. Un clic sur le bouton du son démarrait
  alors le moteur simulé **par-dessus** le ralenti de la banque, qui ne s'est
  jamais tu — relevé par David le 7 septembre 2026, le bouton affichant bien
  « Son actif ».

  Le veilleur qui surveille l'origine ne traitait qu'un sens : il arrêtait la
  synthèse quand on la quittait, et ne faisait rien quand on y entrait. Et la
  règle « une seule origine à la fois » était tenue par la boucle d'images, qui
  faisait taire la banque à chaque tour tant que le moteur simulé tournait —
  donc plus rien dès que la boucle s'arrête.

  La règle se pose maintenant **au changement d'origine** : entrer dans « généré
  en direct » démonte la banque, lectures comprises, et allume le moteur simulé ;
  en sortir fait l'inverse. Le son suit son origine sans qu'on ait à le
  redemander, et il reste éteint si personne ne l'avait demandé.

- **Le son synthétisé démarre dans la voiture.** Il s'arrêtait sur une erreur
  juste après « construction du moteur », et seulement sur le serveur : au
  bureau, où Vite sert les fichiers, il n'y avait rien à voir. La table des
  types de nginx ne connaît pas l'extension `.mjs` ; `probe.mjs`, le module
  d'engine-sim, partait donc en `application/octet-stream` — mesuré sur la
  configuration du projet —, et un navigateur refuse d'exécuter un module servi
  sous ce type-là. Il est maintenant annoncé comme son voisin `engine.js`.

  Même cause pour la page de mesure `/sonde/` : son import échouait de la même
  façon et elle retombait sans le dire sur son bouchon, c'est-à-dire qu'elle
  affichait un chiffre qui ne mesurait rien. Les relevés pris dans la voiture
  avant cette correction sont donc à refaire.

  Le cœur d'engine-sim entre aussi dans le cache hors réseau, comme la réponse
  d'échappement par défaut : sans lui le mode synthèse ne démarre pas du tout
  sans connexion.

- **Le mordant se règle avec la résonance d'échappement, pas avec le niveleur.**
  David cherchait depuis plusieurs séances à retrouver « quelque chose
  d'organique, de réel » en charge, et la piste suivie était la saturation du
  niveleur. Elle était fausse : à pleine charge tenue, passer le réglage de
  « n'écrête pas du tout » à « écrête sec » ne s'entend pas — deux fois, avec le
  son entièrement réverbéré puis avec la résonance à 0,45. Ce qui l'enlevait,
  c'est le **mélange de résonance d'échappement**, à 1,00 par défaut : plus rien
  du son direct n'arrivait à la sortie, et la convolution étale les fronts. À
  0,00 le rauque revient franchement.

  Une tentative de correction automatique de la crête visée a été écrite puis
  retirée dans la foulée : outre qu'elle visait la mauvaise grandeur, elle
  mangeait en charge la saturation qu'on voulait garder et laissait un demi-quart
  de seconde de son sale au relâchement. L'écran dit maintenant ce que le réglage
  fait réellement — le niveau, pas le timbre.

- **Le témoin « écrête » du banc mesure enfin l'écrêtage.** Il comparait la
  position du curseur à un nombre en dur : il s'allumait sur un réglage haut
  même quand la sortie ne touchait pas son plafond, et restait éteint sur un
  moteur qui saturait à un réglage plus bas. Il compte maintenant les
  échantillons réellement butés sur le plafond des entiers 16 bits, relevés dans
  le lecteur, et affiche leur part.

- **L'embrayage se ferme progressivement, au lieu de sauter à un palier.** David,
  après l'arrivée du régime de décollage : « on passe de 800 rpm à 1 300, sans
  aucun changement même en accélérant doucement ; seulement à partir d'une
  dizaine de km/h ça commence à augmenter ».

  Le modèle tenait un palier : le régime sautait au régime de décollage et y
  restait jusqu'à ce que les roues le rattrapent. On ne lâche pas l'embrayage
  d'un coup. Le régime monte désormais du ralenti vers le régime de décollage à
  mesure que la voiture avance, et la hauteur atteinte **dépend des gaz** : on
  ne démarre pas en douceur comme on démarre vite.

  Relevé au simulateur, profil Route, démarrage doux : 923 tr/min à 7 km/h,
  1 447 à 14, 1 845 à 17. Aucun palier plat.


- **La première se conduit comme un rapport, et l'on débraye en s'arrêtant.**
  David : « la première passe tout de suite (logique) mais elle passe la 2de au
  km/h suivant. Et la 2de est en dessous de 800 rpm (cappé à 800) jusque
  12-14 km/h — ce qui donne l'effet que je n'aime pas ».

  La première cédait la place dès la vitesse de lancement, **sans regarder le
  régime** : cinq kilomètres à l'heure sur le profil Route, huit sur Sport. La
  deuxième y tombait alors bien sous le ralenti. On y accélère désormais jusqu'au
  seuil de régime, comme sur les autres rapports ; `launchUpshiftKmh` **empêche**
  le passage en dessous au lieu de le forcer, pour qu'un coup d'accélérateur à
  l'arrêt ne fasse pas monter les rapports.

  Et l'on **débraye en s'arrêtant** : dès que les roues descendent sous le
  ralenti en décélération, le moteur s'en détache et y retombe. C'est la règle que
  David a donnée — « on freine jusqu'à l'arrêt en 2de, et quand on arrive sous
  800 rpm on débraye avant de caler ». La première, elle, ne se reprend jamais en
  roulant : c'est tout ce que `firstGearLaunchOnly` commande désormais.

  Relevé au simulateur, profil Sport : 7 km/h à 1 500 tr/min en première,
  passage en deuxième à 40 km/h. Plus aucun relevé au ralenti en roulant.


- **Le V8 portait l'échappement d'une Subaru.** Sa géométrie est bien relevée sur
  le GM LS livré avec engine-sim — angle de V, point mort haut, manetons, ordre
  d'allumage, répartition des bancs — mais **l'échappement n'était pas dans cette
  liste** : ses valeurs venaient du quatre cylindres, dont la ligne est celle
  d'un EJ25.

  | Paramètre | GM LS | Avant |
  |---|---|---|
  | Longueur du tube primaire | 29 pouces | 10 |
  | Débit primaire | k_carb(500) | k_carb(300) |
  | Volume audio | 4,0 | 1,0 |

  C'est l'échappement qui fait le son d'un moteur, et c'est la première
  explication mesurée du retrait du V8 sur le quatre cylindres — dont
  l'échappement, lui, était juste. Le volume audio de l'EJ25 (`0.5 * 8`) est
  rétabli sur les deux moteurs.


- **Les menus déroulants du banc de synthèse bloquaient l'écran.** « Le focus
  clignote », et un clic sur une valeur figeait tout, rechargement obligatoire.
  Mesuré : **soixante-neuf remaniements du DOM par seconde** dans la section des
  réglages, parce que le panneau affichait le régime tiré de la télémétrie, qui
  change à la cadence de la boucle de conduite. Un menu ouvert se refermait donc
  sous le doigt.

  Deux corrections. Le régime demandé vient désormais du statut de la synthèse et
  non de la télémétrie — les deux valent la même chose, mais l'un ne bat que
  quatre fois par seconde. Et les six menus déroulants deviennent des groupes de
  boutons : un bouton n'a pas d'état ouvert à perdre, et c'est le style de tout
  le reste de l'application. Vérifié sur sept clics enchaînés, sans blocage ni
  creux.


- **Le rupteur du moteur simulé suit le profil.** Il était figé à 6 800 tr/min
  quand le profil Sport monte à 8 500 : au-delà, engine-sim coupait l'allumage,
  et il ne restait que le pompage d'air — aigu et sans corps. David l'a entendu
  à 100 tr/min près : « vers 6 900, comme si la fréquence sourde était tout d'un
  coup coupée ». Vérifié après correction : le régime monte à 7 985 tr/min avec
  un écart nul et un niveau qui tient. Changer de profil rebâtit le moteur,
  puisque le rupteur est figé à la construction.

- **Le décalage entre le geste et le son est réduit de moitié.** « Les tours
  retombent avant le son », au changement de rapport. Deux causes cumulées : la
  réserve du lecteur, à 250 ms, ramenée à 120 — zéro creux mesuré à cette
  valeur —, et le limiteur de pente du régime, qui valait 12 000 tr/min par
  seconde. Un passage de rapport fait chuter le régime de deux mille cinq cents
  tours d'un coup : plus de deux dixièmes de seconde à cette pente. Porté à
  40 000, la même chute prend soixante millisecondes.

- **Le papillon de ralenti était presque fermé.** Il valait 0,9985 là où
  engine-sim retient 0,975. Le débit d'air passe en cosinus de l'angle : cela
  fait **dix-sept fois moins d'air**. Le moteur était asphyxié au ralenti, il ne
  brûlait presque pas, et ce qu'on entendait était le pompage. À papillon égal,
  la sonde monte désormais à 4 565 tr/min au lieu de 2 337.

  **Ce que cela donne à l'oreille n'est pas mesuré** : le niveleur d'engine-sim
  vise une crête constante et masque tout changement d'amplitude. Le ralenti
  reste à juger.

  **Jugé depuis, et la valeur est revenue à 0,9985.** David a écouté les trois
  positions : à 0,996 — la valeur du fichier de référence — « ça craque, ça fait
  des parasites » ; 0,9975 et 0,9985 sont équivalents et nettement meilleurs.
  C'est donc un écart assumé à la référence, et le premier : le fichier dit une
  chose, l'oreille en dit une autre, et c'est l'oreille qui tranche. La valeur
  n'est pas définitive pour autant — elle dépend des autres réglages du moteur.

- **Les commandes de l'écran de conduite tiennent sur une seule ligne**, en trois
  groupes ancrés : la source à gauche, l'affichage au centre, les profils à
  droite. Elles occupaient trois lignes, soit 286 pixels de hauteur pris sur les
  cadrans ; elles en prennent 38. Chaque groupe garde sa place quand les autres
  changent de largeur — un nom de profil plus long ne déplace pas les boutons de
  source, qu'on cherche au même endroit à chaque fois. Ils se replient l'un après
  l'autre dès que la largeur manque : deux lignes à 380 pixels, sans débordement.
  Cela compte, la largeur utile du navigateur de la voiture n'étant pas connue et
  son zoom pas réglable.

  Sous les cadrans, même traitement : **son, écran et boîte tiennent sur une
  ligne** — 38 pixels au lieu de trois lignes. Et l'ordre suit l'usage : les
  réglages qu'on touche à l'arrêt d'abord, puis le choix de ce que le banc
  fabrique, puis les commandes du simulateur tout en bas.


- **Le simulateur n'existe plus qu'en développement.** Dans une voiture il n'a
  aucun sens, et il n'y serait qu'un moyen de se tromper sur ce qu'on entend. La
  construction de production ne le propose pas, et la source au démarrage y
  devient le GPS.

  Ce qu'on y perd mérite d'être dit : le simulateur avait servi de test
  discriminant en roulant — « le simulateur fonctionne encore, repasser au GPS
  rebloque aussitôt » est la phrase qui a orienté le diagnostic du GPS muet. Le
  journal de bord et les comptes de rejet, désormais lisibles à l'écran, le
  remplacent en partie.

- **On quitte le plein écran par une flèche de retour**, à gauche de la rangée de
  commandes, à l'écart des autres et d'une autre couleur. C'était une croix
  flottante en haut à droite, à 35 % d'opacité et sans fond — posée **par-dessus**
  le bouton de profil le plus à droite, puisque la rangée des profils épinglés
  occupe toute la largeur en plein écran. Quitter le plein écran recouvrait
  changer de profil.

  La croix avait été faite discrète exprès, pour qu'on n'en sorte pas par
  mégarde. Ce sont deux besoins distincts : un geste délibéré, et une cible
  identifiable. Une petite cible transparente au bord de l'écran ne répond ni à
  l'un ni à l'autre — en roulant, ce n'est pas une cible. C'est l'écart avec les
  commandes de conduite qui empêche maintenant de la presser par erreur.
- **Le décor qui défilait derrière les cadrans est retiré.** Il défilait de côté,
  comme un jeu de plateforme, là où l'écran se voit de la place du conducteur :
  un décor y défile en perspective, d'avant en arrière, et se rapproche. Ce n'est
  pas un réglage à corriger, c'est un autre dessin.

  Retiré plutôt que caché derrière un bouton coupé : un décor faux qu'on peut
  activer par erreur ne vaut pas mieux qu'un décor faux, et le garder laisserait
  croire qu'il sert de base à la refonte. L'exception à la règle « aucune
  animation » tient — le lot est reporté, pas abandonné — et l'ancien code est
  dans l'historique.

- **Le fichier de mots de passe accepte plusieurs entrées.** `npm run htpasswd`
  écrasait le fichier : créer un second identifiant effaçait le premier. Il
  ajoute désormais une ligne, et remplace celle d'un nom déjà présent. C'est ce
  qui permet d'en avoir deux — le vôtre pour ce que vous faites à la main, et
  celui du dépôt dont l'application se sert depuis la voiture.
- **L'étalonnage est une couche par-dessus les profils**, et non une recopie
  dedans. Un profil décrit un son ; l'étalonnage décrit la voiture. Les mesures
  s'appliquent donc d'elles-mêmes à tous les profils, ceux livrés compris, sans
  jamais écraser ce qui a été réglé — et un profil partagé n'emporte pas les
  capacités d'une autre voiture, pour la même raison qui a fait sortir le volume
  général du profil. Sans étalonnage, rien ne change.

  L'écran de configuration annonce les réglages que la mesure remplace. Il n'y a
  plus de bouton d'adaptation, ni de question « appliquer ou pas ».

- **Le volume général est une préférence de l'appareil**, et non plus un réglage
  du profil. Il vivait dans la section de mixage, ce qui produisait trois effets
  tous fautifs : passer de Route à Sport en roulant faisait sauter le niveau, un
  profil partagé emportait le volume réglé pour une autre voiture, et
  réinitialiser la section de mixage remettait le son au niveau d'usine alors
  qu'on voulait seulement retrouver un caractère. Il est désormais rangé à côté
  du profil choisi, survit au changement de profil, ne voyage ni par lien ni par
  fichier, et se règle toujours depuis l'écran de conduite.

  Le niveau déjà réglé est conservé : à la première ouverture, la préférence
  prend la valeur du profil actif.

  Techniquement, il quitte aussi le calcul du mixage pour devenir un gain de
  sortie, appliqué en amont du limiteur — ce qui préserve la marge au-delà de 1.
  Les gains affichés à l'écran de télémétrie décrivent donc l'équilibre entre les
  couches, sans que le volume les déplace tous ensemble.

- **Le volume fait entendre l'effort.** Les fondus étant à puissance constante,
  ils changeaient la couleur du son et jamais son niveau : mesuré, ralenti,
  croisière, reprise douce et reprise franche tenaient dans 1,3 dB, et lever le
  pied franchement était même 2,3 dB plus fort qu'écraser. Trois réglages de
  relief s'appliquent désormais par-dessus — la charge, le régime, le ralenti —
  et l'étendue passe de 5,3 à 16,5 dB sur le profil Route, dans le bon ordre.
- La compensation des prises « pied levé », enregistrées plus doucement, passe
  dans le gain de chaque couche là où son déficit se mesure — 9,6 dB pour la
  basse, 6,5 pour la haute — au lieu d'un facteur commun qui surcompensait l'une
  de 2,8 dB et l'autre de 5,9. « Gain pied levé » devient un curseur de goût.
- **La boîte de vitesses regarde l'évolution de la vitesse, et non plus
  seulement le régime.** Trois comportements en découlent, tous réglables :
  - **elle monte les rapports quand on tient une vitesse**, comme une boîte
    automatique. Elle restait figée sur un palier, faute d'un régime qui monte :
    50 km/h tenus laissaient la deuxième à 3034 tr/min sur le profil Route, où
    la quatrième tourne à 1532. La sixième s'engage désormais dès 90 km/h ;
  - **elle descend pour aider à ralentir** dès que la décélération est soutenue,
    au lieu d'attendre que le régime soit tombé. Un lever de pied et un freinage
    donnaient exactement les mêmes vitesses de rétrogradage ;
  - **le rétrogradage forcé répond à une demande franche**, c'est-à-dire à une
    montée de charge, et non à son niveau. Faute de pédale dans une voiture
    électrique la charge est déduite de l'accélération : le seuil se franchissait
    dès 3,6 km/h par seconde, si bien que remettre délicatement les gaz suffisait
    à faire descendre la boîte.
- **Trois réglages nouveaux** dans la transmission : « Croisière au-dessus de »,
  « Monter après » et « Descendre en freinant à ».
- **Les deux profils livrés sont remis d'aplomb** pour la boîte nouvelle, et le
  guide de création produit les trois valeurs selon le tempérament demandé — un
  profil calme croise bas et monte tôt, un profil sportif garde ses rapports et
  descend franc au freinage. L'aperçu du guide annonce le rapport de croisière et
  son régime.

### Retiré

- Le réglage **« Zone morte »** du signal de vitesse. Il n'existait que pour
  masquer le bruit d'une pente estimée sur deux points ; l'ajustement sur toute
  la fenêtre moyenne ce bruit au lieu de le seuiller. Mesuré, deux variantes qui
  le conservaient sous une forme correcte — soustractive, ou pondérée par la
  qualité de l'ajustement — amputaient les reprises douces de 25 à 69 % : elles
  ont été écartées. Le tremblement du GPS à l'arrêt, ce que la zone morte
  protégeait réellement, est traité en ne cherchant pas de pente quand le
  véhicule est immobile. Les profils enregistrés perdent le champ sans rien
  d'autre : le format ne change pas de forme.

### Corrigé

- **L'effort agissait à l'envers**, d'un facteur 38. Le banc du son en direct
  coupait le démarreur, au motif que le dynamomètre tient l'arbre : or engager le
  dynamomètre sur un moteur arrêté le fait tourner sans jamais l'allumer. Ce
  qu'on entendait n'était donc pas une combustion mais du pompage d'air — et le
  pompage est plus bruyant papillon fermé qu'ouvert, d'où le sens inversé.

  Le démarreur lance maintenant le moteur une seconde avant que le dynamomètre ne
  prenne le relais. Mesuré à 800 tr/min tenus : la crête passe de 0,343 à 0,634
  quand l'effort va de 0,1 à 1. Le sens est rétabli, mais l'ampleur reste faible
  et la brillance ne monte pas — cela reste à juger à l'oreille.

- **Les collecteurs du V8 ne mesuraient pas ce qu'ils devaient.** David :
  « y'a des fréquences parasites par dessus, qu'on dirait synchro sur le côté
  rugueux mais plus aiguës — on les a pas du tout en 4 cyl ». Il avait raison sur
  la différence de structure : le V8 étage la longueur de collecteur d'un
  cylindre à l'autre, le quatre cylindres non.

  Mais l'étagement était faux : la longueur du tube primaire de l'échappement
  avait été prise pour celle du collecteur de chaque cylindre. On posait 29, 31,
  33 et 35 pouces là où les fichiers de référence descendent de 6,79 à 1,97 —
  cinq à dix fois trop long, et croissant là où il faut décroître. Quatre
  résonances fausses, que le quatre cylindres n'avait pas puisqu'il n'étage rien.

- **La liste du relecteur dit la durée de chaque trajet.** Elle n'affichait que
  la date et le nombre de fichiers ; il fallait ouvrir une session pour savoir si
  elle durait deux minutes ou une heure — c'est-à-dire charger celle qu'on était
  en train de choisir. La durée s'annonce comme une **borne basse** — « plus de
  15 min » —, lue sur le seul nombre de tranches, la capture découpant toutes les
  cinq minutes. Une session sans capture, comme celles des 8, 9 et 10 septembre,
  affiche « journal seul » plutôt qu'une durée inventée.

- **Du code mort a été retiré** après le retrait du panneau de traces : des
  règles de style que plus aucun élément ne portait, la lecture de traces en
  fichier que seul son propre test appelait, et deux commentaires qui décrivaient
  encore le geste supprimé.

- **Le README décrivait trois gestes qui n'existent plus.** Il annonçait encore
  des traces « exportables en un fichier et réimportables ailleurs », et un
  trajet réel qui « s'enregistre une fois depuis l'écran Télémétrie » — le
  panneau qui portait ces trois gestes a été retiré avec le relecteur. Le texte
  dit maintenant ce qui se passe : l'étalonnage embarqué produit seul les traces
  locales, la capture du trajet remonte toute seule, et c'est le relecteur qui
  sert à revoir un trajet. Le rejeu, lui, reste bien une source de vitesse.

- **Le profil mesuré n'était servi par personne.** L'application demandait
  `/mesure-voiture/profil-voiture.json` ; nginx n'avait pas d'emplacement pour ce
  chemin, le volume n'était pas monté dans le conteneur du site, et le dossier
  n'existait pas sur le serveur. La requête tombait sur la règle générale, dont
  le `try_files … /index.html` répond **200 avec la page d'accueil** : le code
  voyait une réponse valable, échouait à la lire, et rendait la même absence
  qu'un serveur sans mesure. Le bandeau de proposition ne pouvait donc pas
  apparaître, et rien à l'écran ne le disait. Sortie du 11 septembre 2026.

  Le dossier s'appelait d'abord `profils/`, à une lettre de `profiles/` qui est
  la bibliothèque de profils. Deux dossiers voisins à ce point se confondent à
  la première manipulation : il a été renommé **`mesure-voiture/`** avant
  d'exister. Les deux ne contiennent pas la même chose — l'un ne porte qu'une
  couche de mesure, l'autre les profils qu'on peut choisir — et n'ont pas les
  mêmes droits.

- **Le rétrogradage forcé rendait le rapport qu'il venait de prendre.** Sa cible
  vaut `redlineRpm × 0,55` — 3 575 tours sur le V8 — quand le seuil de montée
  immédiate de la quatrième à pleine demande vaut 3 514 : elle passait au-dessus
  de sa propre porte de sortie. Mesuré le 11 septembre à 118 km/h : 6→4, puis
  4→5 quatre dixièmes plus tard, puis 5→6, pour une reprise d'une seconde et
  demie. Le rapport visé est maintenant choisi pour se garder, et le pied au
  plancher le retient tant qu'il y reste — comme une automatique. Là où aucun
  rapport ne se garderait, la boîte descend quand même : une boîte muette serait
  un défaut pire.

- **Le claquement de passage était trop fort à la montée.** Il perd trente pour
  cent ; le rétrogradage garde le sien, au niveau près. Les deux réglages
  bougent ensemble, l'amplitude de descente étant le produit des deux.

- **Le cumul des mesures d'une voiture donne le même résultat qu'un recalcul.**
  Il n'en donnait pas : la vitesse pratiquée est un centile, qui **baisse**
  quand un trajet s'allonge, et le cumul par extrêmes gardait la valeur qu'une
  tranche courte avait rendue. Mesuré : 150 km/h contre 40 pour un même trajet,
  sur la grandeur qui fixe la vitesse plausible.

- **Un trajet n'est plus compté douze fois.** Le garde de remplacement le
  cherchait dans la fenêtre des vingt derniers : un trajet qui n'y était pas —
  arrivé en retard, ou sans horodatage lisible — était recompté à chaque tranche
  déposée. Mesuré : trente-deux trajets là où il y en avait vingt et un.

- **La boîte remonte les rapports après un arrêt.** Relevé en roulant le
  11 septembre 2026 : après quarante-quatre minutes de stationnement, la
  deuxième a tenu de 22 à 108 km/h jusqu'au rupteur, et pas un rapport n'a été
  passé sur les cinquante et un kilomètres du trajet.

  Deux défauts qui se composaient. Le conditionneur prêtait une décélération de
  0,19 à 0,39 m/s² à une voiture immobile — vitesse à 0,000 km/h d'un bout à
  l'autre — parce que la pente gardait sa dernière valeur faute de mesure
  neuve. Et le compteur de ralentissement de la boîte avalait ces valeurs sans
  plafond : mesuré à 2 706 secondes pour un seuil de 0,35, il aurait fallu
  vingt-deux minutes d'accélération continue pour le rendre, si bien que
  l'inhibition de montée ne retombait jamais.

- **Le motif d'un rejet de position se lit sous les cadrans**, avec la précision
  réellement annoncée. Il existait déjà, mais rangé sous les réglages, là où
  personne ne regarde en conduisant.

- **Le bouton du son ne ment plus quand l'application est au repos.** Il
  annonçait « Son actif » alors que « P » avait coupé la cadence et le mixage.

- **« P » coupe vraiment le son.** Il n'arrêtait que la boucle d'affichage,
  alors que la banque d'échantillons est cadencée par l'horloge du fil audio :
  celle-ci continuait de battre à soixante hertz, et le silence demandé était
  défait au tour suivant. Le ralenti s'entendait toujours, la boîte tournait et
  le journal s'incrémentait pendant que l'écran affichait « P ».

- **« D » ne peut plus installer deux cadences.** Le démarrage passait par la
  boucle d'affichage sans regarder si l'horloge du fil audio tournait déjà : le
  pas de temps était alors compté deux fois, et tout ce qui s'intègre dessus —
  compteurs de la boîte, durée d'un passage, lissage de la charge — avançait
  deux fois trop vite. L'ordre était sûr tant que le démarrage avait lieu au
  chargement de la page ; il ne l'est plus depuis que c'est un bouton.

- **La commande de boîte changée à la manette se voit à l'écran.** Elle
  s'adressait à la boîte sans passer par l'état que l'écran lit : « AUTO »
  restait allumé pendant que la boîte était en manuelle.

- **Le repos ne perd plus le mode de conduite enregistré.** Remettre « route »
  au parking l'écrivait dans les préférences, si bien que le mode déduit du
  profil disparaissait dès le deuxième trajet.

- **Le rapport est inscrit au journal à l'instant où il change.** Le relevé
  périodique le portait toutes les dix secondes : il prouvait qu'un passage
  avait eu lieu, jamais quand ni combien. Le relecteur s'en sert quand il est
  là, et mesure alors la durée d'un enchaînement au lieu de l'encadrer.
- **Un relevé de l'accéléromètre en télémétrie.** Cadence réelle, présence de
  l'accélération sans la gravité, amplitude observée : de quoi savoir, en
  roulant, si la voiture peut mesurer l'accélération au lieu de la déduire d'une
  vitesse GPS qui n'arrive qu'une fois par seconde.

- **Un relecteur, pour revoir un trajet au lieu de le raconter de mémoire.** Il
  vit sur une page à part, `/relecteur.html`, et déroule une session enregistrée
  comme un lecteur vidéo : lecture, pause, déplacement libre, vitesse réglable
  jusqu'à vingt fois.

  Les sessions se listent depuis le serveur, la plus récente en tête, et leurs
  tranches se recollent toutes seules. Il lit indifféremment les fichiers en
  clair et compressés, et les deux natures : le journal des essais passés — ceux
  des 8, 9 et 10 septembre restent relisibles — comme la capture continue.

  **Ce qui est deviné se voit.** Un journal ne porte le régime, le rapport et la
  charge qu'une fois toutes les dix secondes : entre deux relevés, les valeurs
  affichées sont interpolées, et l'écran dit à quelle distance se trouve le
  relevé le plus proche. Le rapport, lui, n'est jamais interpolé — entre la
  troisième et la quatrième il n'y a pas de trois et demi.

  Une **carte** montre le trajet et le véhicule qui le suit. Un clic sur le tracé
  emmène la timeline à cet endroit ; un déplacement de la timeline déplace le
  véhicule. Elle demande Leaflet et les tuiles d'OpenStreetMap — la première
  dépendance d'interface du projet, acceptée pour ce seul écran. La page étant
  séparée, **l'application de conduite ne grossit pas d'un octet** : elle reste
  à 307 ko quand le relecteur en pèse 162 dans son propre paquet.

  La **timeline est marquée** des faits du journal — arrêts, redémarrages du
  suivi, salves de positions rejetées, coupures du son, changements de
  configuration —, groupés pour qu'une rafale ne couvre pas la barre.

  Un bouton **copie le repère** de l'instant affiché : une ligne lisible, puis
  l'état complet avec les coordonnées. C'est le geste qui sert le but du lot —
  David colle le repère, et la conversation part du bon moment.

  La timeline marque aussi les **rapports enchaînés**, déduits des relevés et
  non lus dans un fichier. Ce qui est mesuré et ce qui est déduit se
  distinguent : à un relevé toutes les dix secondes, voir la deuxième puis la
  quatrième prouve deux passages sans dire s'ils se sont suivis. Le critère
  devient alors la densité — plus d'un rapport franchi par relevé, c'est que la
  boîte a bougé plusieurs fois entre deux regards. Sur l'essai du 10 septembre,
  neuf moments ressortent, dont les allers-retours deuxième-quatrième relevés
  entre 290 et 310 secondes.

  Sous la barre, un **relief de vingt-huit pixels** trace l'accélération en une
  courbe continue, verte au-dessus de l'axe et rouge en dessous : le même tracé
  découpé à zéro, pour que la couleur change sans que le trait se coupe. Chaque
  colonne garde l'extrême de ce qu'elle couvre — une moyenne effacerait le
  freinage bref, qui est justement ce qu'on cherche — et un trou
  d'enregistrement coupe le trait plutôt que de se laisser traverser. Les **passages de rapport** s'y posent en chevrons sur l'axe, vers le
  haut pour une montée et vers le bas pour un rétrogradage : les lire sur la
  même ligne que l'effort montre d'un coup un rétrogradage en pleine
  accélération, ou une montée en freinant.

  Sous le rapport, une **jauge de charge** montre ce que le moteur croit qu'on
  demande — l'équivalent d'une position d'accélérateur. Elle est calculée et
  jamais mesurée, la voiture ne disant pas ce que fait le pied : d'où une barre
  plutôt qu'un cadran, qui suggérerait un instrument dont il n'existe pas
  d'équivalent à bord.

  L'instant se lit sur **les cadrans de la voiture** — le même composant, pour
  que relire un trajet soit revoir ce qu'on avait sous les yeux. La carte occupe
  tout ce que l'écran laisse, un bouton **garde la vue centrée** sur le
  véhicule, et le survol d'une marque de la timeline dit ce qu'elle est,
  combien de fois et quand.

  Vérifié sur l'essai du 10 septembre 2026 rapatrié du serveur : 218 relevés,
  2 111 positions, 36 minutes, le tracé de l'A31 sur la carte, et le véhicule
  qui reste au pixel près au centre tant que le suivi est actif.


- **La capture d'un trajet démarre toute seule.** Elle se déclenche au démarrage
  du GPS, dès lors que la remontée est au dernier cran, et s'arrête avec lui. Il
  n'y a plus rien à penser avant de partir.

  Le mécanisme précédent demandait d'appuyer sur un bouton. Le 10 septembre
  2026, un essai de trente-six minutes n'a laissé **aucune trace** : le journal
  est remonté en huit tranches, la trace n'existait pas. La remontée automatique
  des traces était pourtant en place depuis des jours — `core/upload/consent.ts`
  les classe au dernier cran, et l'accord était donné, puisque le journal portait
  les positions. Le transport marchait ; c'est le geste qui manquait.

  Elle enregistre, à la cadence de l'appareil, **ce que la source livre** —
  vitesse brute, précision, origine — et **ce que la chaîne en fait** au même
  instant — vitesse conditionnée, accélération, régime, rapport, charge. La
  sortie n'est pas là pour le rejeu, qui la recalculerait : elle permet de
  comparer ce que la chaîne a produit ce jour-là à ce qu'elle produit
  aujourd'hui, et rien d'autre dans ce projet ne montre les régressions.

  Chaque tranche réécrit un **en-tête** qui décrit la session : profil, moteur,
  boîte, version de l'application, et le profil assemblé en entier. Quatre
  kilo-octets sur trois cents, pour qu'une tranche isolée se lise seule. Un
  changement de configuration en cours de route s'inscrit, daté — et le journal
  reçoit le même fait, son genre `profile` étant déclaré depuis le premier jour
  sans que rien ne l'émette.

  Chaque relevé garde aussi **l'horodatage brut de la source**, sans conversion :
  c'est la seule façon de retrouver la cadence réelle de l'appareil, et l'unité
  elle-même est une information — le navigateur de la Tesla compte en
  microsecondes, ce qui a coûté une semaine de diagnostic.

  Les tranches partent par la file de remontée déjà écrite, toutes les cinq
  minutes, et **ce qui reste part après quinze secondes à l'arrêt**. La dernière
  tranche n'a pas cinq minutes devant elle, et personne n'arrête l'application :
  David « sort de la voiture, et quand il s'éloigne elle s'éteint ». Un arrêt qui
  dure est le dernier moment où l'on est encore là pour envoyer — le temps de se
  garer suffit, un feu rouge n'y suffit pas, et le déclencheur ne tire qu'une
  fois par arrêt pour qu'un embouteillage ne produise pas un fichier par quart de
  minute.

  Il compte sur l'horloge murale et non sur le temps de session : le pas de la
  boucle est plafonné à un quart de seconde, si bien qu'une page en arrière-plan
  voit son temps avancer quatre fois moins vite que le monde. Rien n'est gardé dans le téléphone : trente-six minutes à dix relevés
  par seconde font vingt-deux mille lignes, et le stockage local ne les
  absorberait pas trajet après trajet.

- **Un témoin sur l'écran de conduite dit si la session sera récupérable.** Vert :
  la capture tourne et les tranches partent. Orange : ça se rattrapera tout
  seul — pas de réseau, ou un GPS qui rejette beaucoup. Rouge : c'est perdu —
  compte refusé, GPS mort, écriture impossible. Absent quand l'envoi est coupé.

  **La frontière entre orange et rouge est la récupérabilité**, et non la gravité
  ressentie : un réseau absent depuis dix minutes reste orange, parce que tout
  partira ; un mot de passe refusé est rouge même si l'application tourne
  parfaitement. Un seul témoin, qui prend le pire des états — une rangée de
  voyants sur un écran qu'on lit en conduisant est une rangée qu'on ne lit pas.
  Il ne clignote pas : sa couleur porte le sens.

  Le détail se lit sur l'écran de télémétrie, en toutes lettres, avec ce qui a
  été retenu et ce qui est parti.

- **Changer de moteur change enfin la façon de conduire.** Les seuils de passage
  étaient en tours absolus, si bien que la boîte ignorait le moteur qu'elle avait
  devant elle : mesuré au banc, un moteur de moto qui monte à 11 000 tr/min
  passait ses rapports au même endroit qu'un V8 qui s'arrête à 6 500, et un gros
  bloc à 5 500 tapait son rupteur **avant d'avoir le droit de monter**.

  Ils se déduisent maintenant du rupteur et d'un **tempérament** — route ou
  sport —, comme la descente le faisait déjà : l'asymétrie était dans le code
  depuis le début. Le tempérament se choisit sous les cadrans de l'écran de
  conduite, à côté de la commande automatique ou manuelle, et il est retenu par
  l'appareil. Au premier lancement, il se déduit du profil actif — imposer
  « route » ferait conduire un profil Sport comme un profil Route sans que rien
  ne le dise.

  Les deux tempéraments disent enfin explicitement ce que les profils livrés
  faisaient sans le dire : **Route monte de plus en plus tôt** — on cherche le
  rapport long — et **Sport de plus en plus tard** — on garde le régime. Leurs
  courbes sont les seuils de ces profils divisés par leur rupteur, donc rien ne
  change sur les moteurs livrés.

  **Cinq curseurs quittent l'écran de réglage.** Et un rapport ajouté reçoit
  désormais un seuil cohérent avec ses voisins : la courbe s'étale sur la boîte
  qu'elle trouve, là où une table absolue faisait hériter le nouveau rapport du
  seuil de son prédécesseur.

- **Les traces enregistrées en voiture se rejouent enfin.** Même cause que
  l'accélération : le rejeu comparait des horodatages en microsecondes à son
  temps écoulé en millisecondes, et attendait donc mille fois trop longtemps
  entre deux mesures — les deux traces du 9 septembre 2026 annonçaient 60 700 et
  73 700 secondes, et ne se déroulaient pas. Elles annoncent maintenant 60,7 et
  73,7 secondes, et se rejouent en temps réel.

  Cela rend au projet son outil de mise au point le plus utile : un trajet réel,
  avec la cadence de la voiture, sa quantification au kilomètre-heure et ses
  paliers, rejoué autant de fois qu'on veut au bureau. C'est le seul signal réel
  dont le projet dispose pour éprouver la boîte sans rouler.

  La détection d'unité, commune au conditionnement et au rejeu, vit désormais
  dans une pièce à part : le seuil doit être le même des deux côtés, et ce dépôt
  a déjà payé deux fois la même erreur — deux mécanismes qui décrivent le même
  fait avec des valeurs qui finissent par diverger.

- **L'accélération était mille fois trop petite.** Le navigateur de la Tesla
  horodate ses positions en **microsecondes**, là où la norme du web dit
  millisecondes ; le code divisait par mille en croyant convertir. L'accélération
  étant une pente, donc une division par une durée, elle sortait à 0,0028 m/s²
  pour une vraie valeur de 2,78 — sous le seuil d'arrondi partout où on la
  regardait.

  Relevé sur le journal de l'essai du 9 septembre 2026, rapatrié depuis le NAS :
  l'accélération est négligeable dans **476 relevés sur 480**, et la charge, qui
  s'en déduit, est figée à 0,50 dans la même proportion. Le défaut était même
  écrit dans le nom du fichier de trace déposé — `…_test2_60700s.json` annonce
  60 700 secondes pour un trajet de soixante.

  Ce que cela expliquait d'un coup : le relief de charge plat, donc l'effort
  inaudible ; les garde-fous de la boîte inertes, faute d'atteindre leur seuil de
  −0,05 m/s² ; la croisière qui se croyait éternelle, donc les rapports qui
  montaient pendant un ralentissement — quatre cas dans le journal, dont un
  3ᵉ → 5ᵉ à 64 km/h. La vitesse **affichée**, elle, était juste : seule sa
  dérivée était morte.

  Le conditionnement déduit maintenant l'échelle du plus petit écart strictement
  positif entre deux mesures, et ramène l'horodatage en millisecondes. Le seuil
  ne peut pas nuire : si le plus petit écart entre deux positions dépassait
  vraiment dix secondes, l'accélération serait inexploitable de toute façon.
  Rejouées dans le code corrigé, les deux traces du même essai rendent une
  accélération exploitable sur 83 % et 70 % de leurs mesures, de médiane
  0,36 m/s² et d'étendue −1,39 à +3,37 m/s².

  Deux relevés bornent au passage ce qu'on peut attendre du signal de cette
  voiture : la cadence réelle est de **dix** positions par seconde, et non trente
  comme annoncé, et la vitesse est **quantifiée au kilomètre-heure entier**.

- **Le passage de rapport s'entend aussi sur les moteurs en synthèse.** David,
  après un essai sur le NAS : « ça ne marche pas pour les moteurs en synthèse,
  juste ceux qui sont enregistrés — je parle de tout le toutim, du claquement au
  passage en particulier ».

  Trois pièces sur quatre étaient logées du mauvais côté. Le clac de la boîte et
  la pétarade étaient joués par le moteur à échantillons, dont la garde exige une
  banque chargée : un profil en synthèse n'en charge pas, et ouvre de surcroît
  son propre contexte audio. La coupure de couple, elle, vit dans le mixage des
  couches, qui n'est jamais appelé quand le synthé tourne — l'effort transmis au
  moteur simulé restait donc entier pendant tout le passage. Seul le mouvement de
  régime — plongée, coup de gaz, engagement — passait, parce qu'il est calculé
  dans le moteur et transmis tel quel.

  Les deux bruits deviennent des pièces autonomes, jouées sur le graphe qui sonne,
  quel qu'il soit : c'est le même son des deux côtés, pas deux sons qui se
  ressemblent. Sur le graphe du synthé ils entrent après le silencieux et la
  résonance d'échappement — un choc de carter ne traverse pas la ligne
  d'échappement, et l'y faire passer le noierait sous quinze décibels de
  résonance à 500 Hz. La coupure de couple s'applique désormais à l'effort
  transmis au moteur simulé, avec la même forme que pour les couches.

  Le compteur « Clacs de boîte » de la télémétrie reste unique et monte quelle
  que soit l'origine : c'est un compte, pas un son, et c'est lui qui permet de
  distinguer un défaut de déclenchement d'un défaut de niveau.

- **Le coup de gaz ne se produit plus quand on a levé le pied.** David : « je
  crois que le rapport passe automatiquement au moment du coup de gaz, même si
  j'ai commencé à ralentir juste avant. »

  Deux effets se cumulaient. Le blocage des montées demandait six dixièmes de
  seconde de ralentissement avéré pour agir ; il en demande un tiers. Et surtout,
  un passage décidé légitimement dure lui-même six dixièmes de seconde : il
  s'engage quand même, et son coup de gaz tombe alors que la voiture ralentit
  déjà. En montée, celui-ci suit donc l'effort du moment — pied levé, il ne
  reste que la chute. Au rétrogradage il reste entier : c'est là qu'il est le
  geste du conducteur, et l'on rétrograde précisément pied levé.

- **La boîte ne monte plus un rapport pendant qu'on ralentit.** David, en
  laissant décélérer : « parfois le simu passe une vitesse supérieure au lieu de
  laisser ralentir et de finalement rétrograder ; et comme le son du moteur est
  faible en décélération, on entend le claquement fort ».

  La bande de croisière juge sur la dérive de la vitesse mesurée sur trois
  secondes — robuste au bruit, mais lente. Quand on lève le pied après une
  longue croisière, la stabilité est déjà acquise et la dérive met plus d'une
  seconde à voir le ralentissement : assez pour laisser passer un rapport de
  plus. Reproduit au banc — un passage du quatrième au cinquième une seconde
  après le lever de pied, sur une perte de 0,5 km/h par seconde.

  L'accélération instantanée le sait tout de suite mais elle est bruitée à un
  dixième de m/s². Elle est donc cumulée dans un compteur qui monte pendant
  qu'on ralentit et redescend deux fois plus vite sinon : une croisière qui
  tremble autour de zéro ne l'atteint jamais, un vrai ralentissement le
  franchit en un tiers de seconde.

  **Et surtout, le seuil de montée suit la demande et non la charge.** C'est
  David qui a vu la cause : « les rapports montent plus tôt quand on accélère
  moins, et plus tard après un kickdown ; je pense que ça a un lien ». Les deux
  viennent du même décalage de seize cents tours.

  Ce décalage attend l'**intention** du conducteur — sur une vraie automatique,
  la position de la pédale. Faute de pédale, la charge se déduit de
  l'accélération, donc du **résultat**. En côte, pied au plancher, l'accélération
  est faible : la charge tombe, le seuil descend de huit cents tours et la boîte
  monte tôt, l'inverse de ce qu'il faudrait. Et au lever de pied, la charge
  s'effondre en une demi-seconde, si bien que le seuil passe sous le régime sans
  que le moteur ait bougé.

  La demande monte instantanément avec la charge et n'en redescend qu'en trois
  secondes : une accélération franche garde ses rapports longs quelques secondes
  après qu'on a relâché, et le seuil ne peut plus tomber que d'environ cinq cent
  trente tours par seconde. Relevé sur le profil Route, quatrième à 4000 tr/min
  puis lever de pied : plus aucun passage dans les trois secondes qui suivent.

  Quatre gardes avaient été posées en aval avant d'en arriver là ; trois
  dépendaient du moment où l'accélération mesurée devient franchement négative,
  or elle est lissée quand la charge ne l'est presque pas. La quatrième freinait
  la descente du seuil : la demande la remplace, en disant pourquoi il ne doit
  pas descendre.

  **Et le passage immédiat ne vaut plus qu'en accélérant.** « Accélération
  jusqu'à 4800 tr/min en 4e, arrêt de l'accélération, le simu passe la 5 et la
  6. » Le seuil de montée se décale de seize cents tours avec la charge : pied
  au plancher il est haut, et il s'effondre en une demi-seconde quand on
  relâche, bien plus vite que le régime ne descend. La marge de dépassement — qui
  court-circuite la temporisation — se trouvait franchie non parce que le moteur
  montait, mais parce que la barre était tombée. Deux rapports passaient
  d'affilée, chacun voyant son propre seuil effondré, et sans laisser aux gardes
  précédentes le temps d'agir. S'y ajoute un blocage immédiat au-delà d'un demi
  m/s² de décélération, où le cumul n'apporte plus aucune certitude : la traînée
  du simulateur en donne déjà 1,4 à cent kilomètres à l'heure.

  **Cela vaut aussi pour la montée au régime**, et c'était le gros du reproche.
  « Si j'arrête d'accélérer juste avant que la boîte ne monte un rapport, elle le
  monte quand même. » Le franchissement du seuil de régime lance un compte à
  rebours de quelques dixièmes de seconde, que plus rien n'annulait : reproduit
  au banc — le seuil franchi, le pied levé dans la foulée, et le passage se
  produit une demi-seconde plus tard. Le compte est désormais abandonné et non
  suspendu, donc reprendre les gaz repart d'un compte neuf.

- **Les deux modes de banc qui imitent un GPS fournissaient une pédale que la
  voiture n'a pas.** La charge se déduit de l'accélération quand la position de
  l'accélérateur est inconnue, et se lit directement dessus quand elle l'est —
  or elle était transmise dès que la source était le simulateur, mode compris.
  Les trois modes s'entendaient donc pareil : le calcul de charge réel n'était
  jamais exercé. Mesuré après correction, en croisière tenue à 110 km/h : charge
  de 0 en vitesse exacte, 0,50 en mesure GPS et en positions, avec un
  frémissement de 0,024 à 0,029 que le mode exact ne montre pas.


- **Le numéro de version mentait en développement.** Il est injecté à la
  construction, et le serveur gardait donc celui qu'il avait lu à son démarrage :
  l'écran annonçait 0.1.27 sur du 0.1.30 — le numéro censé lever les doutes en
  créait un, le jour même de sa mise en place. Le serveur redémarre désormais
  quand `package.json` change. Sans effet sur la construction de production, qui
  lit toujours la bonne.


- **Un étalonnage incomplet pouvait figer la vitesse.** Relevé en roulant le
  4 septembre 2026 : la seule étape de ville enregistrée, prise dans un bouchon à
  moins de 30 km/h, portait la vitesse plausible maximale de 260 à 40 km/h. Cette
  borne est appliquée au profil que le moteur emploie, et une mesure au-delà
  n'est pas écrêtée mais **rejetée** — aux deux étages, la source et le
  conditionnement. En montant sur l'autoroute, plus une seule vitesse ne sortait :
  vitesse, régime et son figés, le chien de garde relançant un suivi qui
  fonctionnait. Rien à l'écran n'en disait la cause, l'écran de configuration
  affichant toujours les 260 km/h du profil réglé.

  **L'étalonnage ne s'applique désormais qu'entier.** Tant qu'une des six étapes
  manque ou a été refusée, rien n'est repris automatiquement, et l'écran de
  configuration dit lesquelles manquent. Plusieurs des réglages informés sont des
  bornes tirées de ce que la voiture a fait pendant l'étalonnage : au jeu complet
  elles décrivent la voiture, à une étape près elles décrivent le bout de route du
  jour. La même mécanique guettait les deux bornes d'accélération — un étalonnage
  sans freinage franc avait déjà proposé une borne basse qui aurait écrêté tout
  freinage réel. Les propositions restent affichées et se recopient à la main.

  L'écran de configuration annonce maintenant **la valeur** de chaque réglage
  remplacé, et non son seul libellé : « Vitesse plausible maximale — 40 km/h au
  lieu de 260 » se lit, « Vitesse plausible maximale » ne disait rien.

- **Une source qui jetait toutes ses mesures était muette sur la raison.** Elle
  donnait le même écran qu'une source qui ne reçoit rien : une vitesse figée. Un
  message sur l'écran de conduite nomme désormais la cause au bout de trois
  secondes de silence — vitesse acceptée dépassée, positions trop imprécises,
  positions trop rapprochées — et le réglage à regarder. Le chien de garde, lui,
  ne voit qu'un silence et relance un suivi qui marche : les deux ne parlent pas
  en même temps.

- **L'accélération transmise au son était celle du ressort de lissage, pas
  celle qui avait été mesurée.** Le conditionnement calcule une pente ajustée
  aux moindres carrés sur sa fenêtre — c'est le travail du 3 septembre — mais
  ce qui arrivait à la charge et à la boîte était la vitesse de la masse du
  ressort. Or le ressort a pour métier de rattraper une cible qui saute à
  chaque mesure sans la dépasser : sa vitesse porte tout le bruit du GPS, et le
  retard qui va avec.

  Mesuré sur une vitesse parfaitement tenue, à la cadence réelle du GPS et avec
  un bruit de mesure de ±1 km/h : 0,83 m/s² d'écart-type et des pointes à 2,2
  pour le ressort, **0,10 et 0,4 pour la pente**. Et sur une reprise établie à
  2 m/s², le ressort lit 1,96 quand la pente lit 2,00.

  La première piste avait été d'empêcher le curseur de réactivité de descendre
  aussi bas, et **la mesure l'a écartée** : la fenêtre balayée de 200 à 2000 ms
  ne changeait presque rien, l'écart-type restant entre 0,82 et 0,93. Le
  curseur peut donc aller au bout de sa course.
- **La boîte jugeait « vitesse tenue » sur l'accélération instantanée**, dont le
  bruit résiduel est du même ordre que la borne basse de sa bande — un dixième
  de m/s². Le critère se décidait ainsi au tirage au sort, et une seule image
  dans la bande suffisait à remettre le compte à zéro. Deux conséquences
  opposées : sur une vitesse vraiment tenue, la boîte faisait le va-et-vient ;
  en ralentissant doucement, elle se croyait en croisière deux fois sur trois,
  gardait un rapport long, et le régime se plaquait au ralenti sous 26 km/h en
  quatrième — d'où un son qui ne bougeait plus en ville.

  Une vitesse tenue se mesure désormais sur la **vitesse**, par la dérive entre
  les deux moitiés d'une fenêtre de trois secondes. Les bornes de la bande n'ont
  pas changé, c'est la façon de les mesurer. Mesuré sur douze minutes de vitesse
  tenue, à 25, 40, 60 et 90 km/h : quarante-six passages parasites avant,
  quatre avec une fenêtre de deux secondes, **aucun** avec trois — et cela
  quelle que soit la fenêtre d'accélération réglée.
- **La source GPS pouvait se taire définitivement.** Quand le navigateur ne
  renseigne pas la vitesse, elle est déduite de deux positions ; un écart de
  moins de 150 ms était refusé, mais la position de référence était **remplacée
  quand même**, si bien que l'écart ne pouvait jamais s'accumuler. Mesuré : zéro
  vitesse produite sur une minute à 110 km/h dès que la cadence passait sous
  150 ms — c'est-à-dire dès que la voiture roulait. Le suivi ne repartait plus,
  et le chien de garde le relançait en vain puisque la cadence restait rapide.

  La référence est maintenant conservée jusqu'à ce que l'écart suffise. Et une
  mesure au-delà du plausible n'est plus remplacée par la dernière valeur saine
  puis émise comme si elle avait été mesurée : elle est ignorée, ce que le
  conditionnement fait déjà de son côté. Ce maquillage privait le chien de garde
  du silence dont il aurait pu se saisir.

  `geolocation.ts` était le seul module du signal de vitesse sans aucun test.
  Il en a sept.
- **Un enregistrement d'étalonnage s'arrête toujours.** L'étape en cours était
  retenue dans l'écran d'étalonnage, lequel est démonté dès qu'on change
  d'onglet : au retour, l'application savait qu'un enregistrement tournait mais
  plus lequel. Toutes les étapes s'annonçaient occupées par une autre et aucun
  bouton ne permettait plus de l'arrêter — il suffisait d'aller regarder l'écran
  de conduite pour condamner l'écran jusqu'au rechargement, l'enregistrement
  continuant d'accumuler des mesures. L'étape vit désormais dans l'état de
  l'application, et un enregistrement lancé ailleurs s'annonce dans un bandeau
  qui l'arrête d'un geste, sans perdre la trace.

- **Une borne de décélération n'est plus proposée sans étape qui ralentisse.**
  Avec la seule reprise enregistrée — une accélération pure, sans freinage — la
  plus forte décélération relevée valait presque zéro, et la borne proposée
  −0,5 m/s². Écrite dans un profil, elle aurait écrêté **tout** freinage réel :
  la charge et la boîte auraient vu un ralentissement minuscule là où l'on plante
  les freins. Une borne trop large ne protège de rien ; une borne trop serrée
  ampute le signal.
- **Un profil enregistré était complété avec les valeurs de Sport**, quel que
  soit son identifiant. Chaque réglage ajouté au schéma arrivait donc dans le
  profil Route de l'utilisateur réglé pour Sport : plancher de croisière à 2000
  au lieu de 1500, délai de croisière à 3,5 s au lieu de 2,2, seuil de
  rétrogradage au freinage à −0,7 au lieu de −1, relief de charge à 5 dB au lieu
  de 4, relief du régime à 4 au lieu de 3. Les essais sur route portaient sur des
  valeurs que personne n'avait choisies. La réinitialisation, elle, cherchait
  déjà le bon profil par son identifiant : les deux chemins disent enfin la même
  chose.

- **Le bouton marche/arrêt n'est plus hors écran sur un téléphone.** La barre du
  haut alignait ses six boutons sur une seule ligne quoi qu'il arrive, et ce qui
  dépassait sortait de l'écran : mesuré sur un écran de 375 px, « En marche »
  était entièrement dehors — 228 px au-delà du bord — et il fallait faire
  glisser la page de côté pour atteindre le bouton qui démarre et coupe tout.
  L'écran de la voiture étant large, le défaut ne s'y produisait pas, ce qui
  explique qu'il soit passé inaperçu. La barre se replie désormais sous 655 px,
  les commandes restant alignées à droite ; au-delà, elle est inchangée.
- **Faire défiler l'écran de configuration ne dérègle plus un curseur.** Un
  glissement vertical commencé sur l'un des cinquante et un curseurs déplaçait le
  curseur au lieu de faire défiler la page : on réglait au hasard en cherchant à
  lire, et on s'en apercevait au son. Les curseurs rendent désormais le
  glissement vertical à la page et ne gardent que l'horizontal.
- Une **bande de défilement** longe le bord gauche de l'écran de configuration —
  la place du conducteur, donc celle du pouce. Le glissement n'y peut rien
  dérégler, quoi qu'il arrive : elle vaut aussi comme sécurité si le navigateur
  de la voiture ignore le comportement tactile déclaré.
- **L'écran de configuration ne débordait plus l'écran d'un téléphone en
  portrait.** Le tableau des couches forçait la largeur de la page — mesuré à
  766 px pour un écran de 375 — et le geste de défilement emportait l'écran de
  côté. Le tableau glisse maintenant dans sa propre boîte, et la zone de contenu
  tient dans la largeur de l'écran.

- **L'accélération douce n'était pas vue du tout dans la voiture.** Le
  conditionnement du signal était bâti sur l'idée qu'un GPS livre une mesure par
  seconde — c'était écrit dans son code. Relevé dans une Tesla, il en livre une
  toutes les quelques dizaines de millisecondes en roulant. Deux défauts s'y
  composaient : l'historique était borné à seize mesures, soit une demi-seconde
  à cette cadence, si bien que la fenêtre réglée n'était jamais atteinte et que
  le réglage ne commandait rien ; et la zone morte retirait un écart fixe en
  km/h **avant** de diviser par la durée, ce qui, sur une fenêtre deux fois plus
  courte, annulait purement et simplement toute accélération sous 0,58 m/s².
  Mesuré : une reprise de 0,55 m/s² était lue à **zéro**. Accélérer de 110 à 150
  en vingt secondes se jouait donc comme une vitesse tenue.

  La pente est maintenant ajustée aux moindres carrés sur **toutes** les mesures
  de la fenêtre, dont la durée est bornée en temps et non en nombre. Mesuré, à
  bruit de mesure égal : la pente est juste à toutes les cadences de 30 ms à 1 s
  (0,35 m/s² lue 0,350 ; 2,0 lue 2,000), et son écart-type tombe de 0,26 m/s² à
  un hertz à 0,12 à trente millisecondes. Plus le GPS parle, plus l'estimation
  est sûre — l'inverse d'avant.

  Le défaut valait aussi au poste de travail : le simulateur émet une mesure par
  image, soit près de cent cinquante par seconde. Tous les réglages faits au
  simulateur portaient donc sur une fenêtre de cent millisecondes, pas sur celle
  qui était affichée.

- **La boîte gardait le dernier rapport jusqu'à l'arrêt quand on ralentissait
  doucement**, puis passait tous les rapports au premier freinage franc. La bande
  d'accélération considérée comme « vitesse tenue » était symétrique, si bien
  qu'un lever de pied sur du plat y tombait et suspendait la descente au régime.
  Tenir une vitesse, c'est ne pas la perdre : la bande est désormais asymétrique.
  Mesuré, un ralentissement doux depuis 110 km/h descend maintenant à 104, 87, 73
  et 55 km/h au lieu de rester en sixième.
- **Un aller-retour entre deux rapports voisins s'entendait au freinage**, tous
  les trois km/h : la montée au régime défaisait la descente au freinage, qui
  engage un rapport dont le régime dépasse son propre seuil de montée. On ne
  monte plus pendant qu'on freine, comme une vraie boîte, et le plafond d'une
  descente est désormais le seuil de montée du rapport visé — le régime le plus
  haut atteint passe de 7232 à 5298 tr/min.
- **Réinitialiser un profil créé par le guide lui rendait les réglages du profil
  « Sport »**, et non les siens : un profil était reconnu à son identifiant, et
  tous ceux qui n'étaient pas livrés retombaient sur les valeurs par défaut. La
  fonction ne servait donc à rien là où elle sert le plus — sur un profil qu'on
  vient de fabriquer et qu'on tâtonne. Chaque profil garde désormais ses valeurs
  de création, y revient autant de fois qu'on veut, et une duplication en a une
  aussi.
- La procédure d'installation ne faisait créer que le dossier des échantillons,
  alors que la pile monte aussi celui des profils partagés — annoncé
  « facultatif », mais un montage absent empêche le conteneur de démarrer sous
  DSM. Les deux dossiers sont désormais demandés, et les piles disent pourquoi.
- L'infobulle de « Ne jamais monter sous » répétait encore qu'il commande le
  rétrogradage, erreur pourtant déjà corrigée dans le README.
- **Le son tient quand le navigateur passe en arrière-plan** — à essayer en
  voiture. Il s'arrêtait net dès que le navigateur de la Tesla était réduit. Le
  média qui maintient la session audio est désormais un fichier servi de deux
  minutes, inséré dans le document, là où il était fabriqué en mémoire, long de
  quatre secondes et détaché de la page. Un refus du navigateur n'est plus avalé
  en silence : il s'affiche, avec l'état du contexte audio, dans un bloc
  « Arrière-plan » sur l'écran Télémétrie.
- Le réglage « son en arrière-plan » est respecté à l'activation du son, où il
  était ignoré, et basculer ce réglage ne peut plus laisser deux médias de
  maintien en place.
- **Le suivi GPS est relancé quand il se tait** plus de vingt secondes : sans
  cela, le son tiendrait en arrière-plan mais resterait figé sur la dernière
  vitesse connue.
- **Le régime redescend quand on cesse d'accélérer.** La pente d'accélération
  était estimée sur l'historique entier — seize secondes — au lieu de la fenêtre
  réglée : après une reprise suivie d'une vitesse tenue, le moteur restait trop
  haut une quinzaine de secondes. Mesuré : le dépassement se résorbe maintenant
  en une seconde au lieu de quinze, et le suivi d'une accélération régulière est
  inchangé.
- **Le réglage « fenêtre d'accélération » commande enfin quelque chose.** Il
  décide de la durée sur laquelle la pente est estimée, donc du temps qu'elle
  met à s'oublier.
- **Une mesure GPS aberrante est écartée** au lieu d'être ramenée au plafond de
  plausibilité : une valeur absurde ne fait plus monter le moteur au rupteur.
- La boucle locale en IPv6 est reconnue par l'avertissement de partage : un lien
  produit depuis `[::1]` était annoncé comme joignable.
- L'aperçu du guide de création annonce le passage dont il donne la vitesse.
- La documentation du réglage « Ne jamais monter sous » : il ne commande pas la
  vitesse à laquelle la boîte rétrograde en décélération, contrairement à ce
  qu'annonçait le README. C'est « Descente sous » qui le fait — mesuré, et
  désormais tenu par un test.

### Sécurité

- **Les quatre dossiers du serveur ne se lisent plus sans mot de passe.**
  L'écriture était protégée depuis le début, la lecture ne l'était pas : qui
  connaissait l'adresse du site — publique, puisque la voiture n'est pas sur le
  réseau local — pouvait lister les trajets et les télécharger, positions
  comprises dès le cran étendu du journal. David : « c'est accessible de
  l'extérieur, bien sûr ; ferme tout en utilisant le mot de passe du dépôt ».

  L'application s'annonce désormais pour lire la bibliothèque de profils et pour
  vérifier qu'une trace n'est pas déjà déposée. **Sur un appareil sans compte de
  dépôt, la bibliothèque est vide** ; le partage par lien ne passe pas par le
  serveur et fonctionne toujours.

## [0.1.0] — 2026-08-29

Première version en service, sur le NAS. Ce chapitre est reconstitué depuis
l'historique git : le journal n'existait pas encore quand ces lots ont été
livrés.

### Ajouté

- Squelette de l'application, boucle unique, les trois écrans, et un simulateur
  au clavier pour travailler sans voiture.
- Conditionnement du signal de vitesse, source GPS, enregistrement et rejeu de
  traces.
- Modèle de moteur et de boîte de vitesses : régime, charge, rupteur, rapports,
  passages automatiques et manuels.
- Moteur audio à échantillons : couches en boucle permanente, fondus à puissance
  constante, chaîne de sortie, calage des points de raccord.
- Analyse des échantillons dans l'éditeur : ancrage proposé, mesure du raccord et
  du timbre.
- Écran de conduite, session média du système et verrou d'écran.
- Déploiement sur NAS Synology, HTTPS en développement, publication automatique
  de l'image et installation sans terminal.
- Application installable et utilisable hors réseau.
- Trois traits de caractère : rétrogradage forcé, pétarade, à-coup de passage.
- Régimes de passage réglables rapport par rapport, rétrogradage en
  décélération, régulateur au simulateur.
- Profils : deux profils livrés dont un calibré pour la route, réinitialisation
  section par section, favoris, création guidée, partage sans compte, et aide
  intégrée.

### Corrigé

- Une couche ne joue plus à la mauvaise hauteur hors de son domaine jouable.
- Les boucles se referment là où le son se referme, et non à un endroit
  arbitraire.
- La charge retombe vraiment quand on lève le pied.
- Les ancrages sont protégés d'un nombre de cylindres erroné.
- Cinq corrections venues d'un premier essai sur route, et quatre points
  d'ergonomie relevés à l'usage.
