# 05 — Relier un second appareil en scannant un code

**Statut :** ✅ fait — 13 septembre 2026

**Bloqué par :** [02 — Un compte se crée tout seul](02-un-compte-se-cree-tout-seul.md).

**Remplace** le ticket 05 d'origine, « Rattacher une adresse conserve tout ce que
le compte portait ». Ce ticket-là mélangeait deux besoins qui n'ont ni le même
usage ni le même coût : relier deux appareils qu'on possède déjà, et reprendre
son compte quand on a tout perdu. Le second est le
[ticket 09](09-reprendre-son-compte.md).

## Ce qu'il faut obtenir

L'écran de la voiture affiche un code. On le scanne avec son téléphone, ou avec
son ordinateur de bureau, et cet appareil-là ouvre le **même compte** : les mêmes
profils, les mêmes moteurs, les mêmes trajets.

**Sans adresse, sans mot de passe à retenir, sans aucun service tiers.** C'est ce
qui en fait le chemin normal, et c'est pour cela qu'il vient avant tout le reste.

## Ce à quoi il faut faire attention

- **Le compte anonyme a déjà tout ce qu'il faut.** La bibliothèque lui a fabriqué
  une adresse sous le domaine réservé `.invalid`, qui ne désigne aucune boîte ; il
  suffit de lui **poser un mot de passe**, et le couple devient un identifiant
  complet. Vérifié le 13 septembre 2026 sur le vrai serveur : `setPassword` est
  une route réservée au serveur, donc appelée depuis notre code pour la session en
  cours ; la connexion depuis un autre navigateur avec ce couple rend bien le même
  compte, y compris depuis un navigateur qui venait de se créer le sien.
- **Le code porte un lien, pas des identifiants à recopier.** Tout dans le
  **fragment** de l'adresse, qui n'est jamais transmis au serveur — c'est
  exactement le motif du partage de profil, déjà en place avec
  `qrcode-generator`. Recopier `afwfxnmq…@anonymous.placeholder.invalid` à la main
  serait une punition.
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
- **`is_anonymous` ne dit plus la vérité** une fois un mot de passe posé : le
  compte reste marqué anonyme alors qu'il est devenu récupérable. Le drapeau
  repasse à faux quand un mot de passe est posé.
- **Ce qui voyage et ce qui ne voyage pas.** Le volume, le visage de l'écran, le
  verrou, le mode de boîte décrivent l'appareil et restent locaux ; c'est déjà la
  règle du lot MIGRER, et elle ne change pas ici.
- **Hors réseau, on ne relie pas.** C'est acceptable — on ne relie pas un appareil
  en roulant —, mais l'écran doit le dire au lieu d'attendre.

## Critères d'acceptation

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
