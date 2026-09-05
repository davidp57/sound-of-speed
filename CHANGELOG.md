# Journal des changements

Toutes les évolutions notables du projet. Format
[Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versions en
[gestion sémantique](https://semver.org/lang/fr/).

## [Non publié]

### Corrigé

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

### Ajouté

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

### Modifié

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

### Corrigé

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

### Ajouté

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

### Ajouté

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

### Modifié

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

### Corrigé

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

### Modifié

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

### Corrigé

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

### Ajouté

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

### Modifié

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

### Corrigé

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
