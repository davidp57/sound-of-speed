# Journal des changements

Toutes les évolutions notables du projet. Format
[Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versions en
[gestion sémantique](https://semver.org/lang/fr/).

## [Non publié]

### Ajouté

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
