# 05 — Relier un second appareil : un jeton, deux rendus

**Statut :** 🔄 rouvert le 13 septembre 2026 — une première version est livrée (PR #147), le mot de passe posé laisse la place à un jeton

**Bloqué par :** [02 — Un compte se crée tout seul](02-un-compte-se-cree-tout-seul.md).

**Remplace** le ticket 05 d'origine, « Rattacher une adresse conserve tout ce que
le compte portait ». Ce ticket-là mélangeait deux besoins qui n'ont ni le même
usage ni le même coût : relier deux appareils qu'on possède déjà, et reprendre
son compte quand on a tout perdu. Le second est le
[ticket 09](09-reprendre-son-compte.md).

## Ce qu'il faut obtenir

L'écran de la voiture affiche un code. On le scanne avec son téléphone, ou **on
recopie huit caractères** sur un poste de travail sans caméra, et cet appareil-là
ouvre le **même compte** : les mêmes profils, les mêmes moteurs, les mêmes
trajets.

**Sans adresse, sans mot de passe à retenir, sans aucun service tiers.** C'est ce
qui en fait le chemin normal, et c'est pour cela qu'il vient avant tout le reste.

## Ce que la première version a livré, et ce qui la remplace

Livrée le 13 septembre 2026 (PR #147) : le serveur posait un **mot de passe** sur
le compte anonyme, et le couple voyageait dans le fragment d'un lien. Cela
marche, et c'est vérifié — mais cela ne survit pas à la suite.

**La bibliothèque d'identité ne garde qu'une preuve « mot de passe » par
compte.** Afficher un code écrasait donc le mot de passe du compte : sans
conséquence tant que personne n'en choisit un, fatal dès le
[ticket 11](11-un-vrai-compte.md). Et le couple affiché restait valable
indéfiniment, ce qui empêchait de le sauvegarder sans risque.

Ce qui le remplace : **un jeton de liaison à usage unique**, qui expire, rangé
dans une table à nous. Deux rendus du même jeton :

- un **lien à scanner**, comme aujourd'hui, mais qui ne porte que le jeton ;
- un **code court** de huit caractères, groupés, dans un alphabet sans caractères
  qu'on confond (ni `I`, ni `L`, ni `O`, ni `U`), à recopier sur un clavier.

Ce qui disparaît avec le mot de passe machine : la bascule de `is_anonymous`, et
la règle « un code neuf périme le précédent » — un jeton s'use, cela suffit.

## Ce à quoi il faut faire attention

- **Un code court se devine, un lien non.** Huit caractères dans un alphabet de
  trente-deux font mille milliards de combinaisons ; c'est assez pour dix minutes
  de validité, à condition de **compter les essais** et de refuser au-delà. Sans
  ce compteur, le calcul ne tient plus.
- **Le jeton s'use.** Une fois qu'un appareil s'en est servi, il ne vaut plus
  rien — c'est ce qui permet de l'afficher sans arrière-pensée, et ce qui rend
  inutile la règle de péremption de la première version.
- **Le code porte un lien, pas des identifiants à recopier.** Tout dans le
  **fragment** de l'adresse, qui n'est jamais transmis au serveur — c'est
  exactement le motif du partage de profil, déjà en place avec
  `qrcode-generator`. Recopier `afwfxnmq…@anonymous.placeholder.invalid` à la main
  serait une punition ; huit caractères, non.
- **Un code affiché donne le compte à qui le photographie.** C'est assumé : ce qui
  est en jeu est une bibliothèque de réglages, pas de l'argent. Mais le code ne
  reste pas à l'écran, et l'écran le dit.
- **Rien au premier lancement.** Tranché par David le 13 septembre 2026 : la spec
  dit « une adresse se rattache le jour où elle sert, jamais avant », et une
  fenêtre qui demande de choisir au premier démarrage serait l'écran d'inscription
  que ce lot supprime. Les deux voies vivent dans l'écran de configuration, à côté
  de « le compte de cet appareil » ; une bannière escamotable les rappelle une
  fois.
- **Le compte anonyme que l'appareil secondaire vient de se créer** survit à la
  connexion — mesuré. Sur un appareil neuf il ne porte rien : on l'efface s'il est
  vide, on le garde et on le dit sinon.
- **`is_anonymous` ne bouge pas.** Un compte relié à deux appareils reste
  irrécupérable si on perd les deux : il n'a toujours ni adresse ni mot de passe.
  Le drapeau dit donc la vérité, et l'écran garde sa mise en garde jusqu'au
  [ticket 11](11-un-vrai-compte.md).
- **Ce qui voyage et ce qui ne voyage pas.** Le volume, le visage de l'écran, le
  verrou, le mode de boîte décrivent l'appareil et restent locaux ; c'est déjà la
  règle du lot MIGRER, et elle ne change pas ici.
- **Hors réseau, on ne relie pas.** C'est acceptable — on ne relie pas un appareil
  en roulant —, mais l'écran doit le dire au lieu d'attendre.

## Critères d'acceptation

- [ ] Un code court de huit caractères relie un appareil sans caméra
- [ ] Le jeton s'use à la première utilisation, et expire
- [ ] Les essais sont comptés, et refusés au-delà
- [ ] Le mot de passe du compte n'est plus touché par la liaison
- [x] L'écran de configuration affiche un code qui relie un second appareil
- [x] Le second appareil ouvre le même compte : mêmes profils, moteurs, boîtes,
      trajets et profil mesuré
- [x] Le compte anonyme que le second appareil portait est effacé s'il est vide,
      gardé et annoncé sinon
- [x] Un compte qui a reçu un mot de passe n'est plus marqué anonyme
- [x] Aucun service tiers, aucune adresse, aucun envoi de courriel
- [x] Le code ne reste pas affiché, et l'écran dit ce qu'il donne à qui le voit
- [x] Hors réseau, l'écran dit qu'on ne peut pas relier maintenant

## Ce qui a été fait, et ce qui a été mesuré

Le serveur répond sous `/api/liaison/` : `code` pose un mot de passe sur le
compte de la session et rend le couple, `relier` ouvre ce compte ailleurs et
règle le sort de celui que l'appareil portait. Le couple voyage dans le fragment
d'un lien (`src/core/identity/lien.ts`), à l'image du partage de profil.

**Une deuxième demande remplace le mot de passe**, ce qui périme le code
précédent : la preuve « credential » est effacée avant d'en reposer une, la
bibliothèque refusant de remplacer un mot de passe existant. Vérifié contre le
serveur local : le premier code rend 401, le second 200.

**Mesuré, et pas seulement testé.** Le scénario complet a été joué contre le
vrai serveur — deux témoins de connexion distincts, un profil déposé par le
premier et listé par le second — puis dans le navigateur : le fragment disparaît
de l'adresse, la bannière annonce l'arrivée, et le rapatriement des profils et
des moteurs part tout de suite.

**Le rapatriement ignore le cran d'accord**, et c'est délibéré : l'accord dit ce
qui **part** de la voiture — position, trajets, journal —, pas ce qui redescend
du compte qu'on vient de rejoindre. Sans cela, relier un appareil dont l'accord
est à « rien n'est envoyé », qui est le défaut, n'aurait rien ramené.

**La bannière escamotable qui rappelle les deux voies** attend le
[ticket 09](09-reprendre-son-compte.md) : la seconde voie — l'adresse — n'existe
pas encore, et une bannière qui n'annoncerait qu'un chemin déjà visible dans
l'écran de configuration n'apprendrait rien. Ce qui est en place est le message
d'arrivée, sur l'appareil qui vient de se relier.

**Pour le ticket 09 :** le mot de passe posé ici est **remplacé** à chaque
demande de code. Le jour où l'on choisit son mot de passe, cette règle ne peut
plus valoir telle quelle — afficher un code effacerait le mot de passe choisi.
