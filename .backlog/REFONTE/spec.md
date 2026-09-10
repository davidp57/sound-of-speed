# REFONTE — le son, la mécanique, l'écran, et des comptes

**Statut :** ⬜ prêt
**Branche :** à ouvrir, un lot d'exécution à la fois — la refonte ne tient pas
dans une branche unique
**Version visée :** 0.5

## Le problème

David a essayé Speed dans sa voiture. Le verdict porte sur presque tout :

> j'ai testé en voiture et ça ne va pas du tout

Quatre constats, dans ses mots :

- **le processeur de la voiture ne suit pas.** « le CPU de la voiture est très
  insuffisant pour la synthèse. J'arrive à peine à 1x en 8hz » — une seconde de
  son par seconde de calcul, à 8 kHz de simulation, quand le seuil que le lot
  SYNTHESE avait fixé **avant** de mesurer était de trois. À ×1, la réserve du
  lecteur se vide dès que l'écran se rafraîchit ou que le GPS livre une
  position ;
- **le son ne convainc pas**, et pas seulement à cause du processeur : « sur
  engine-sim on avait toujours un son très perfectible (fréquences parasites,
  etc.) », y compris au poste de travail où le temps réel n'est pas en cause ;
- **la boîte se comporte mal**, et c'est nouveau : « le passage en lui-même a
  été dégradé par cette fonctionnalité (reste parfois en 3ème jusque 150,
  parfois monte en 6 puis redescend tout seul alors que je ralentis) ». Le son
  du passage, lui, tient : « pas mal, perfectible mais ok » ;
- **l'application est devenue trop compliquée.** Six mille six cent vingt et une
  lignes d'écrans, dont deux mille deux cent quatre-vingt-quatorze pour le seul
  écran de configuration, qui porte dix sections et soixante et un champs
  numériques. L'écran de conduite, lui, affiche trois chiffres.

Un cinquième problème n'est pas venu de l'essai mais de l'usage : **les réglages
se perdent**. Les profils vivent dans le stockage local du navigateur de la
voiture, les dépôts passent par un mot de passe unique tapé à la main, et rien
ne suit d'un appareil à l'autre.

Le suivi de la vitesse est le seul point que David n'a pas mis en cause.

## La solution

Une refonte en quatre volets, décidée le 10 septembre 2026. La pile ne change
pas : le navigateur de la Tesla n'accepte aucune application installable, donc
le web n'est pas un choix qu'on puisse revoir.

**Le son change d'origine.** Les échantillons portent le régime continu, la
synthèse porte les événements. Une banque cesse d'être cinq prises ancrées très
haut — 3 128 et 8 150 tr/min sur le profil Route, pour une conduite qui vit
entre 800 et 2 800 — et devient une quinzaine de prises étagées, en charge et
pied levé. La vitesse de lecture reste alors proche de un, là où elle descend
aujourd'hui à 0,26 : le spectre ne se déplace plus, et le « son de moto de
course à bas régime » disparaît avec sa cause. Le clac de boîte, le rupteur, les
pétarades et l'à-coup de passage sont synthétisés, parce qu'un événement court
se rend mieux par une impulsion que par un échantillon.

engine-sim ne tourne plus dans la voiture. Il devient un outil d'atelier qui
**fabrique** les prises, hors temps réel, à sa cadence maximale. Ce mode corrige
un défaut que ni le direct ni l'enregistré ne corrigeaient : l'ondulation du
vilebrequin est dans le fichier, à sa vraie fréquence, alors que le pilotage en
direct ne pouvait la moduler qu'à 45 Hz quand il en faudrait 121 pour un V8.

**La boîte cesse de deviner de deux façons.** Une seule notion de l'état du
mouvement — accélère, tient, ralentit — calculée à un endroit, avec une zone
morte franche, remplace les compteurs concurrents accumulés depuis le
6 septembre. Et les seuils de passage se dérivent du rupteur, comme la descente
le fait déjà : aujourd'hui ils sont en tours absolus, si bien qu'un moteur
tournant à 11 000 tr/min passe ses rapports au même endroit qu'un V8 à 6 500, et
qu'un moteur à 5 500 tape son rupteur avant d'avoir le droit de monter.

**L'application se sépare en deux.** La voiture : un écran, ce qu'on lit en
roulant, une poignée de choix. L'atelier : sur un vrai écran avec un vrai
clavier, tout le réglage, les bancs, l'étalonnage, la fabrication des banques.

**Un compte fait le lien.** Créé automatiquement, sans courriel ni mot de passe.
Il tient les profils, les met à l'abri, les porte d'un appareil à l'autre, et
remplace le mot de passe partagé des dépôts par un jeton propre à chaque
appareil.

## Récits d'usage

### Le son

1. En conduisant, je veux que le moteur sonne juste à 1 500 tr/min comme à
   4 000, pour que le son ne trahisse pas un étirement d'échantillon.
2. En conduisant, je veux entendre un grondement de V8 et non un sifflement de
   moto quand je roule doucement, parce que c'est à bas régime que je passe le
   plus de temps.
3. En conduisant, je veux que le passage de rapport garde le son qu'il a
   aujourd'hui, puisque c'est la seule pièce que j'ai jugée correcte.
4. En conduisant, je veux entendre le clac de la boîte, le rupteur et les
   pétarades, pour que la mécanique ait des accidents et pas seulement un
   régime.
5. En conduisant, je veux que le son ne craque jamais, même quand l'écran se
   rafraîchit et que le GPS livre une position.
6. En conduisant, je veux entendre l'effort et non seulement le régime : tenir
   50 km/h et tenir 130 ne doivent pas sonner pareil.
7. À l'atelier, je veux fabriquer une banque de prises étagées à partir d'une
   définition de moteur, sans avoir à enregistrer une vraie voiture.
8. À l'atelier, je veux que la fabrication d'une banque ne soit limitée par
   aucun budget de temps réel, pour pousser la qualité aussi loin que la
   simulation le permet.
9. À l'atelier, je veux mesurer les fréquences parasites d'une prise par un
   chiffre, pour ne pas discuter d'un timbre à l'oreille et de mémoire.
10. À l'atelier, je veux mesurer l'ancrage et le déficit de niveau de chaque
    prise automatiquement, parce que le faire à la main ne passe pas à quinze
    prises par moteur.
11. À l'atelier, je veux comparer deux origines de son sur le même trajet
    enregistré, pour trancher autrement qu'en se souvenant.
12. En conduisant, je veux choisir entre plusieurs moteurs d'un seul geste, pour
    en essayer plusieurs sur un même trajet.

### La boîte et le moteur

13. En conduisant, je veux que la boîte monte les rapports quand j'accélère,
    sans rester bloquée sur un rapport jusqu'à des vitesses absurdes.
14. En conduisant, je veux que la boîte ne monte jamais un rapport pendant que
    je ralentis, quelle que soit la douceur du ralentissement.
15. En conduisant, je veux que la boîte ne fasse pas d'aller-retour entre deux
    rapports voisins, parce que c'est ce qui s'entend le plus mal.
16. En conduisant, je veux qu'un moteur qui monte à 11 000 tr/min tienne ses
    rapports plus longtemps qu'un moteur qui s'arrête à 5 500, pour que changer
    de moteur change la conduite.
17. En conduisant, je veux qu'un moteur au rupteur bas ne se retrouve jamais
    coincé sous un seuil de passage qu'il ne peut pas atteindre.
18. À l'atelier, je veux régler le tempérament de la boîte par une valeur unique
    plutôt que par cinq régimes de passage, pour que le réglage reste
    compréhensible.
19. À l'atelier, je veux que la boîte se juge sur un signal aussi bruité que
    celui de la voiture, pour ne plus découvrir en roulant ce qu'un banc trop
    propre a laissé passer.
20. En conduisant, je veux pouvoir couper un garde-fou de la boîte et rouler
    avec et sans, pour isoler celui qui dérape.

### L'écran de la voiture

21. En conduisant, je veux lire la vitesse, le régime et le rapport d'un coup
    d'œil, sans rien d'autre à l'écran.
22. En conduisant, je veux régler le volume, parce qu'il dépend de l'autoradio
    et du bruit de roulement, pas du profil.
23. En conduisant, je veux couper le son d'un seul geste.
24. En conduisant, je veux changer de profil sans traverser un écran de
    réglages.
25. En conduisant, je ne veux aucun curseur à doser, parce qu'un curseur se
    règle en regardant l'écran.
26. En conduisant, je veux que l'application tienne dans la largeur réelle de
    l'écran de la voiture, dont le zoom n'est pas réglable.
27. En conduisant, je veux que l'écran reste allumé sans que j'aie à y penser.
28. En conduisant, je veux que l'application démarre et sonne même sans réseau,
    parce qu'un tunnel ou un parking ne doit pas la rendre muette.

### L'atelier

29. À l'atelier, je veux tous les réglages fins sur un vrai écran avec un vrai
    clavier, parce que c'est là qu'on règle.
30. À l'atelier, je veux que ce que je règle arrive dans la voiture sans
    exporter un fichier ni recopier une adresse à la main.
31. À l'atelier, je veux garder les bancs de mesure et l'étalonnage, qui n'ont
    jamais eu leur place dans la voiture.
32. À l'atelier, je veux savoir quels réglages la voiture expose, pour ne pas
    dupliquer un contrôle des deux côtés.

### Le compte

33. Comme utilisateur, je veux un compte créé tout seul au premier lancement,
    sans courriel, sans mot de passe et sans formulaire.
34. Comme utilisateur, je veux que mes profils survivent à un nettoyage du
    navigateur de la voiture ou à une mise à jour de son logiciel.
35. Comme utilisateur, je veux retrouver mes réglages sur mon téléphone, sur mon
    ordinateur et dans ma voiture, sans geste de transfert.
36. Comme utilisateur, je veux rattacher un appareil en scannant un code affiché
    par un autre, parce que taper un jeton sur l'écran d'une voiture est
    pénible.
37. Comme utilisateur, je veux rattacher un appareil qui n'a pas de caméra en
    saisissant un code court, parce que le navigateur de la voiture ne scanne
    probablement rien.
38. Comme utilisateur, je veux ne plus jamais saisir un mot de passe partagé
    pour que mes traces et mes relevés remontent.
39. Comme utilisateur, je veux que mes données ne soient visibles que de moi.
40. Comme utilisateur, je veux récupérer tout ce que j'ai enregistré en un seul
    paquet, pour l'emporter ou l'archiver.
41. Comme nouvel arrivant, je veux que mon compte se crée même si le service est
    plein, et qu'on me dise clairement qu'il attend une place.
42. Comme nouvel arrivant en attente, je veux être prévenu quand mon compte
    devient actif, sans avoir laissé d'adresse.
43. Comme nouvel arrivant en attente, je veux que l'application fonctionne et
    sonne quand même, avec les profils livrés et le stockage local.
44. Comme David, je veux plafonner le nombre de comptes actifs, pour que mon NAS
    ne tombe pas si une beta ouverte marche mieux que prévu.
45. Comme David, je veux relever le plafond sans redéployer l'application.
46. Comme David, je veux qu'un compte muet depuis longtemps libère sa place.

### Le repli et le déploiement

47. Comme David, je veux garder l'application actuelle utilisable pendant toute
    la refonte, à son adresse habituelle, pour avoir un point de comparaison en
    roulant.
48. Comme David, je veux retrouver le code d'avant la refonte par un nom, sans
    fouiller l'historique.
49. Comme David, je veux essayer la refonte dans la voiture aussi souvent que
    possible, parce que l'essai en roulant est ce qui a démenti toutes les
    mesures faites au bureau.

## Décisions de conception

### Ce qui ne change pas

- **La pile.** Vue 3 en `script setup`, Vite, TypeScript strict, aucune
  bibliothèque d'interface, aucun gestionnaire d'état. Le navigateur embarqué
  n'accepte rien d'autre qu'une page web.
- **Les trois invariants** : le cœur n'importe jamais Vue, les sources de
  vitesse passent toutes par une seule interface, le mixage reste une fonction
  pure.
- **Le conditionnement du signal de vitesse**, seul point que l'essai n'a pas
  mis en cause.
- **L'application reste utilisable sans réseau.** Décision structurante, posée
  avant toute autre : **le compte ne conditionne jamais la sortie du son.**

### Le son

- **Deux origines qui se complètent** : les échantillons portent le régime
  continu, la synthèse porte les événements. Ce n'est pas un choix par profil
  entre deux mondes, comme le prévoyait le lot SYNTHESE, mais une répartition
  des rôles.
- **Une banque devient dense** : une quinzaine de prises étagées en régime, en
  charge et pied levé, au lieu de cinq. Le format de banque et le schéma de
  profil changent de forme, donc la version de format de profil monte et les
  profils enregistrés se reprennent.
- **Le mixage choisit les prises encadrantes** et fond entre elles, au lieu
  d'étirer une prise unique sur toute la plage. C'est la règle qui remplace
  l'ancrage unique.
- **engine-sim quitte la voiture** et devient un outil d'atelier qui fabrique
  les prises hors temps réel. Le mode « généré en direct » disparaît du produit.
- **Les prises viennent de quatre sources**, dans cet ordre d'exploration :
  engine-sim hors temps réel, les banques déjà sur le NAS, les dépôts publics
  déjà repérés (`VehicleNoiseSynthesizer`, `exhaustnotes`, `engine-sound-generator`),
  et les bibliothèques du commerce, à instruire. Pour un prototype la licence
  ne gêne personne ; **une beta ouverte est une redistribution**, et la question
  se tranche avant d'ouvrir.

### La mécanique

- **Une seule notion de l'état du mouvement** — accélère, tient, ralentit —
  calculée en un endroit et consultée par tout le reste, avec une hystérésis
  explicite. Elle remplace les compteurs concurrents dont deux se contredisent :
  la bande de croisière tient l'allure pour stable jusqu'à −0,1 m/s² quand le
  compteur ajouté le 8 septembre déclare le ralentissement dès −0,05. La leçon
  du lot FIX-BOITE — « un compteur, un usage » — s'applique.
- **Les seuils de montée se dérivent du rupteur**, comme la descente le fait
  déjà. Cinq régimes absolus par profil sont remplacés par un tempérament. Le
  détail et les mesures sont dans la spécification du lot MOUVEMENT.
- **La boîte se juge sur un signal bruité.** Le banc de positions fabriquées
  existe et sait produire la cadence de la voiture ; il n'a jamais été branché
  sur la boîte. Il le sera.
- **Une bascule par garde-fou**, pour rouler avec et sans et isoler celui qui
  dérape. Idée de David, retenue.

### Les deux applications

- **Deux interfaces, un seul dépôt.** La voiture ne porte que ce qui se lit et
  se choisit en roulant ; l'atelier porte le réglage, les bancs et
  l'étalonnage.
- **Ce que la voiture garde** : le profil, le moteur, l'échappement, le point
  d'écoute, le volume, la coupure du son, le visage de l'écran, le verrou
  d'écran, le mode de boîte. La liste complète est à arrêter par David sur le
  relevé des cent cinquante-huit réglages, qui accompagne le lot MENAGE-UI.
- **Aucun curseur en voiture**, sauf le volume — un choix se fait d'un coup
  d'œil, un curseur se dose en regardant. La règle vient de David lui-même, et
  la refonte la garde.
- **Aucune animation**, hors l'aiguille d'un cadran, dont le mouvement *est* la
  valeur. La règle n'a plus d'exception depuis le 7 septembre.

### Le compte et le serveur

- **PocketBase**, un conteneur à côté du serveur web actuel, tient les comptes,
  les jetons, les règles d'accès et les fichiers. Aucun code
  d'authentification n'est écrit à la main : c'est la partie où une erreur
  maison coûte le plus cher.
- **Un compte anonyme**, créé automatiquement, sans courriel ni mot de passe.
  Conséquence assumée : la récupération repose sur l'appairage d'un second
  appareil, et sur rien d'autre.
- **L'appairage marche dans les deux sens** : celui qui a un écran affiche un
  code à scanner, celui qui a une caméra le scanne, et un code court couvre le
  cas où aucune caméra n'est disponible — ce qui est probablement celui de la
  voiture, à relever.
- **Le serveur fait foi pour les profils.** Le stockage local n'en est qu'un
  cache, qui permet de rouler sans réseau. Choix de David contre la
  recommandation inverse ; le coût est qu'on ne modifie pas un profil hors
  réseau.
- **Les préférences d'appareil restent locales** — le volume en tête, que le lot
  VOLUME-GLOBAL a explicitement sorti du profil. Sans cette exception, le volume
  ne serait plus réglable dans un parking souterrain.
- **Le plafond ne refuse personne** : le compte se crée, il est marqué inactif
  quand la place manque, et l'application le prévient elle-même au lancement
  suivant. Un compte inactif n'a pas de synchronisation, mais l'application
  fonctionne et sonne en local.
- **Une place se libère par défection** : un compte muet depuis un délai à
  définir rend sa place.
- **Le mot de passe partagé des dépôts disparaît**, remplacé par un jeton par
  appareil. Les deux champs d'identifiants et l'accord de remontée sont à
  revoir avec les comptes.
- **Un export en un paquet** par compte, pour emporter ses données. Idée de
  David, motivée par le besoin immédiat de récupérer un journal depuis un
  téléphone. Elle devient nécessaire dès qu'il y a des comptes.

### Le déploiement et le repli

- **La refonte se déploie sur l'étiquette de développement**, à l'adresse
  `speed-dev` ; l'application actuelle reste en production à son adresse
  habituelle et sert de repli en roulant.
- **Pas de release avant de commencer.** Choix de David, contre la
  recommandation inverse. Le coût est connu et assumé : l'application de
  production reste celle du 29 août, sans le passage de rapport, la synthèse, le
  tableau de bord ni le journal.
- **Le repli du code est un tag nommé**, `avant-refonte`, documenté dans les
  règles du dépôt et dans l'état du projet. C'est le premier tag de ce dépôt, et
  il ne suit pas `vX.Y.Z` exprès : ce format est réservé aux versions publiées.
- **La mécanique passe d'abord.** Elle est petite, sa cause est en cours
  d'établissement, et elle rend une voiture conduisible dès la première
  livraison — ce qui compense l'absence de release.

### La forme du lot

Ce lot est un **cadre**, pas une unité de travail : il ne tient pas dans une
branche. Les lots d'exécution en sont dérivés — MOUVEMENT pour la boîte,
MENAGE-UI pour l'interface, un lot par volet du son et du compte — chacun avec
sa branche et sa demande de fusion.

## Décisions de test

**Ce qui fait un bon test ici** : il vérifie un comportement observable depuis
l'extérieur du module, jamais la façon dont il est écrit. Le dépôt en a la
culture — cinq cents tests, quatre-vingt-quatorze pour cent du cœur couvert, une
seconde pour tout faire tourner sous Node — et une leçon durement acquise : un
banc qui simule un signal parfait valide des règles qui échouent en roulant.
C'est pourquoi le quatrième point ci-dessous compte autant que les autres.

Cinq points de test, dont **un seul est nouveau** :

1. **Le mixage** — quelles prises jouent, à quel gain, à quelle vitesse de
   lecture. Fonction pure déjà en place, avec une importante batterie de tests.
   C'est là que se vérifient les prises encadrantes et le fondu entre elles,
   sans produire un son.
2. **Les événements** — clac, rupteur, pétarades, à-coup de passage. Module
   existant. Un événement se vérifie par son enveloppe et son niveau, pas à
   l'oreille.
3. **La boîte** — les seuils dérivés du rupteur et la notion unique du
   mouvement, sur les bancs existants qui font rouler la boîte sur un profil de
   vitesse et relèvent chaque passage avec son régime.
4. **La chaîne complète depuis le GPS** — le banc de positions fabriquées, à la
   cadence de la voiture et avec son bruit, branché sur la source réelle, le
   conditionneur puis la boîte. Le banc existe, il n'a jamais servi à juger la
   boîte, et c'est exactement ce qui manquait pour reproduire le second symptôme
   de l'essai : dix scénarios de ralentissement sur signal propre n'ont produit
   aucune montée parasite.
5. **Le service distant** — comptes, appairage, synchronisation, envoi de
   fichiers, derrière **un port unique**, testé par un faux. Seul ajout, et il
   suit le modèle qui a fait ses preuves : l'interface unique des sources de
   vitesse fait déjà passer simulateur, GPS et rejeu par la même porte, si bien
   que rien en aval ne sait d'où vient le chiffre. Prior art pour le faux : les
   tests de bibliothèque de profils, qui simulent déjà le serveur avec un faux
   `fetch` vérifiant les options exactes.

**Ce qui ne se teste pas et se dit** : qu'un son sonne juste. Le jugement est
celui de David, en roulant. Le travail de la machine est de fournir les mesures,
de rendre les allers-retours rapides, et de ne jamais présenter une mesure comme
un verdict d'écoute.

## Hors périmètre

- **Le suivi de la vitesse**, seul point que l'essai n'a pas mis en cause.
- **La synthèse en direct dans la voiture.** Écartée par la mesure, pas par
  choix : ×1 le temps réel contre un seuil de trois.
- **Le langage de description de moteur d'engine-sim** et son interpréteur,
  déjà hors périmètre du lot SYNTHESE, et son projet est passé en source fermée.
- **La conception d'un moteur sur mesure** cylindre par cylindre.
- **Un compte avec courriel, mot de passe ou récupération par adresse.** Le
  compte est anonyme, et c'est la condition pour n'avoir aucune donnée
  personnelle à garder.
- **Le décor qui défile**, abandonné le 7 septembre.
- **Le réglage fin des seuils de boîte à l'oreille**, tant que la notion de
  mouvement n'est pas unifiée : il porterait sur un comportement qui va changer.
- **Une application installable au sens d'un magasin d'applications.** La
  voiture n'en accepte pas.

## Notes

**Ce qui reste ouvert, et ne bloque pas le démarrage :**

1. **La liste des réglages embarqués.** David la remplit sur le relevé des cent
   cinquante-huit réglages joint au lot MENAGE-UI, qui porte une colonne de
   décision par ligne.
2. **Le délai de défection** d'un compte inactif.
3. **Quels événements exactement** sont synthétisés, parmi le clac, le rupteur,
   les pétarades, l'à-coup et le claquement de reprise.
4. **La licence des prises**, à trancher avant d'ouvrir la beta.
5. **Ce que la voiture expose de son matériel** : quatre inconnues sont déjà
   affichées en télémétrie et jamais relevées — précision réelle des positions,
   largeur utile de la page, réponse de l'interface de verrou d'écran,
   persistance de l'autorisation de géolocalisation. La refonte en ajoute deux :
   l'accès à un accéléromètre, qui donnerait l'accélération mesurée au lieu de la
   déduire du GPS, et l'accès à une caméra, qui décide du sens de l'appairage.
   Toutes se relèvent en roulant, par un affichage plutôt que par du code écrit
   à l'aveugle.

**Le témoin qui manque.** Le journal du 9 septembre 2026 couvre 1 h 20 de
conduite réelle en seize tranches, et enregistre la vitesse, l'accélération, le
régime et le rapport toutes les dix secondes. Il dirait dans quelles conditions
la boîte a dérapé, au lieu de le déduire. Il est sur le NAS et le poste du
bureau n'y a pas accès — le proxy répond 503. Le récupérer est le geste le moins
cher et le plus informatif de tout ce lot.

**Un diagnostic déjà démenti une fois.** La première cause avancée pour les
défauts de boîte — une accélération mesurée fausse — a été écartée par David,
qui avait éprouvé le lot PENTE en roulant ; la datation des commits lui a donné
raison. La deuxième — deux compteurs qui se contredisent — a été démentie par un
banc le même jour. La contradiction existe et sera corrigée, mais elle ne
reproduit pas le défaut observé. Il reste donc un défaut sans cause établie, et
ce lot ne doit pas prétendre le contraire.
