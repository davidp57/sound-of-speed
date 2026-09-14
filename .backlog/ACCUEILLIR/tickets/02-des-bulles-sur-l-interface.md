# 02 — Des bulles posées sur la vraie interface

**Statut :** ✅ fait — 14 septembre 2026

**Bloqué par :** [01 — Un écran d'accueil](01-un-ecran-d-accueil.md). La visite
part de l'accueil : c'est « Commencer » qui la lance.

## Ce qu'il faut obtenir

Après l'accueil, des **bulles fléchées** se posent sur l'écran de conduite et
désignent ce qu'on y touche. On passe de l'une à l'autre, on peut quitter à tout
moment, et ça ne revient plus.

## Ce qu'on construit

Le mécanisme, livré avec les bulles de l'écran de conduite — il n'y a pas de sens
à écrire le premier sans les secondes.

**L'ancrage.** Chaque cible porte un attribut dans le code
(`data-visite="marche"`, `"repos"`, `"boite"`, `"volume"`). La visite lit la
position de la cible au moment d'afficher sa bulle, et pose la bulle à côté avec
une flèche qui pointe dessus.

**Ce qui n'est pas là se saute.** Une cible absente du document — parce qu'un
rôle a fermé l'écran, parce que le navigateur ne supporte pas le verrou d'écran —
fait passer à la bulle suivante sans trou dans le décompte. C'est la raison
d'ancrer sur l'interface réelle plutôt que sur un dessin.

**La position se recalcule** quand la fenêtre change de taille : la barre du haut
se replie sur deux lignes sous 655 pixels, et tout ce qui est en dessous descend.

**Rien ne bouge.** Une bulle apparaît, puis disparaît quand on passe à la
suivante. Pas de glissement, pas de fondu : la règle « aucune animation » n'a pas
d'exception.

**On en sort.** Un bouton « Passer » à chaque bulle, et « Terminé » à la
dernière. Une clé de stockage retient que c'est fait (`speed.visiteVue.v1`), sur
le même principe que `speed.helpSeen.v1` : si le stockage est refusé, la visite
ne se remontre pas dans la même session.

**Les bulles de l'écran de conduite** — quatre, dans l'ordre où l'on s'en sert :

1. **D** démarre ; une fois en route le même bouton passe en **S**, le mode sport.
2. **P** met tout au repos, et fonctionne aussi en roulant.
3. **AUTO / MAN** choisit la boîte ; les commandes de chaque mode sont montrées
   au-dessus de son étiquette.
4. **Volume**, sous les cadrans, qui monte au-delà du maximum habituel.

## Comment on vérifie

- Stockage vidé : accueil, « Commencer », puis la première bulle sur **D**.
- Chaque bulle touche sa cible — vérifié à trois largeurs, dont un téléphone de
  375 pixels et l'écran large de la voiture.
- La fenêtre redimensionnée pendant la visite : la bulle reste sur sa cible.
- « Passer » quitte, un rechargement ne la relance pas.
- Une cible retirée du document : la visite enchaîne sans case vide.

## Ce qui est hors de ce ticket

Les bulles de la barre du haut (04), qui attendent que la barre ait sa forme
définitive (03).
