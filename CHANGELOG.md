# Journal des changements

Toutes les évolutions notables du projet. Format
[Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versions en
[gestion sémantique](https://semver.org/lang/fr/).

## [Non publié]

### Ajouté

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

### Corrigé

- La documentation du réglage « Ne jamais monter sous » : il ne commande pas la
  vitesse à laquelle la boîte rétrograde en décélération, contrairement à ce
  qu'annonçait le README. C'est « Descente sous » qui le fait — mesuré, et
  désormais tenu par un test.

### À corriger

Quatre défauts relevés en écrivant les tests, décrits dans le lot `FIX-CORE` et
tenus en attendant par des tests qui constatent le comportement actuel :

- la pente d'accélération est estimée sur tout l'historique et non sur la
  fenêtre réglée, si bien que le régime reste trop haut une quinzaine de
  secondes après une accélération, et que le réglage « fenêtre d'accélération »
  ne commande rien ;
- une mesure GPS aberrante est ramenée au plafond de plausibilité au lieu d'être
  écartée ;
- la boucle locale en IPv6 n'est pas reconnue par l'avertissement de partage ;
- l'aperçu du guide de création annonce un passage dont il calcule un autre.

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
