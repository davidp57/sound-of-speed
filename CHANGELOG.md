# Journal des changements

Toutes les évolutions notables du projet. Format
[Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versions en
[gestion sémantique](https://semver.org/lang/fr/).

## [Non publié]

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

### Corrigé

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
