# ACCUEILLIR — l'écran d'aide du premier lancement, revu

**Statut :** ⬜ prêt — cadre posé le 13 septembre 2026, pas encore découpé
**Branche :** à ouvrir
**Version visée :** à décider

## Ce que David demande

Revoir l'écran d'aide montré au premier lancement, pour le rendre **plus clair**,
et pour que **les informations sur le compte soient évidentes : en premier, en
gros, claires**.

## Ce que l'écran est aujourd'hui

Onze sections, deux cent soixante-dix-huit lignes, dans cet ordre : pour
commencer, les commandes de conduite, la vitesse reste à zéro, le son est trop
faible, en roulant, partir sans réseau, créer sa propre voiture, régler le son,
l'écran Télémétrie, code source et licence, et — **en dernier** — « Ce compte est
le vôtre ».

**Le compte est arrivé là le 13 septembre 2026**, au ticket 16 de
[COMPTES](../COMPTES/spec.md), et il a été mis à la fin. C'est exactement
l'inverse de ce qui est demandé ici : la section existe, elle est juste au
mauvais endroit et de la mauvaise taille.

## Ce qu'il reste à instruire

Rien n'est tranché — la liste dit où regarder.

- **Ce qui passe en premier, et ce qui descend.** Aujourd'hui l'écran s'ouvre sur
  « pour commencer », qui apprend à faire du son. Le compte demande la première
  place ; reste à savoir ce qu'il dit en tête, et en combien de mots.
- **La longueur.** Onze sections lues au premier lancement, c'est un manuel là où
  l'on veut rouler. Ce qui relève de l'aide de référence pourrait ne pas relever
  du premier contact.
- **Un écran ou deux ?** L'aide sert deux usages qui n'ont rien en commun :
  accueillir quelqu'un qui ouvre l'application pour la première fois, et répondre
  à une question qu'on se pose plus tard, par le bouton `?`. Les traiter comme un
  seul texte est peut-être la cause de tout le reste.
- **Ce que le compte doit dire là**, sans répéter l'écran Compte : qu'il existe,
  qu'il porte déjà les réglages et les trajets, qu'il ne tient qu'à ce
  navigateur, et ce que l'enregistrer apporte.
- **Ce qui reste vrai au volant.** Le premier lancement a de bonnes chances
  d'arriver dans la voiture, où l'on ne s'enregistre pas — l'écran doit y mener
  au code, comme le fait déjà l'écran Compte.

## Ce qui est déjà établi, et n'est pas à refaire

- L'aide s'affiche d'office au premier lancement et se rappelle par le bouton
  `?` ; la clé `speed.helpSeen.v1` tient ce « une seule fois ».
- Le formulaire d'enregistrement vit dans l'écran Compte **et nulle part
  ailleurs** — tranché le 13 septembre 2026 : deux copies divergeraient. L'aide
  renvoie, elle ne duplique pas.
- L'offre de source exigée par l'AGPL-3.0 doit rester dans cet écran.
