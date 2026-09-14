# 03 — L'atelier : un onglet qui rassemble le son et la fabrication de profils

**Statut :** ✅ fait

**Bloqué par :** 01 — Les paramètres avancés deviennent un écran à part, gardé

## Ce qu'il faut obtenir

Un onglet « Atelier », et un seul, qui porte tout ce qui fabrique : le mixage,
les couches, la création et la tenue des profils, le banc de synthèse. Il a sa
propre navigation interne — c'est l'écran où l'on passe du temps, pas celui
qu'on touche en roulant.

Il demande le rôle `atelier`, et `synthese` pour le banc. Ce rôle existe depuis
le lot COMPTES : le serveur l'exige déjà pour accepter un dépôt, mais aucun
écran ne le demandait. Ce ticket lui donne son contenu.

Il n'apparaît que sur un poste de travail, et porte quand même la garde : un
appareil est déclaré par celui qui s'en sert, et une déclaration se trompe.

**Ce qui déménage depuis les profils.** Créer, renommer, dupliquer, supprimer,
exporter et partager un profil deviennent des gestes d'atelier. Le premier
niveau ne garde que choisir, épingler, ajuster — et recevoir un profil par lien,
parce que recevoir n'est pas créer.

**La barre du haut ne grossit pas de quatre entrées.** Une barre de neuf onglets
se replie sur trois rangs dès 375 pixels, et le raccord de l'onglet actif au
contenu, posé le 14 septembre, ne veut alors plus rien dire.

## Critères d'acceptation

- [x] Un onglet « Atelier » porte le mixage, les couches, la tenue des profils
      et le banc de synthèse, avec sa navigation interne
- [x] Un compte sans le rôle `atelier` ne le voit pas
- [x] Le banc de synthèse demande `synthese` en plus, et son absence ne ferme
      que lui
- [x] L'onglet n'apparaît pas sur un téléphone ni sur l'appareil « voiture »
- [x] Il porte la garde : au GPS en roulant, il est grisé comme les paramètres
      avancés
- [x] Le premier niveau ne propose plus que choisir, épingler et ajuster un
      profil ; un profil reçu par lien s'y installe toujours
- [x] Un droit qui expire referme l'atelier sans redémarrage

## Ce qui a été fait, et mesuré

**Le gain principal du lot est ici.** L'atelier part dans son propre morceau,
chargé à la demande : le morceau principal tombe de 107,4 à 98,1 ko compressés,
soit 9 % de moins téléchargés par la voiture. L'atelier pèse 12,4 ko, et elle ne
les prend jamais.

La barre du haut retombe à **cinq onglets en voiture** — Conduite, Télémétrie,
Paramètres, Avancé, Compte — et 58 pixels de haut, contre trois rangs et 198
pixels au pire moment du ticket 01.

Vérifié dans le navigateur : les trois volets répondent, la synthèse charge son
morceau à la demande, et l'appareil déclaré « voiture » ne voit pas l'atelier.

## Un arbitrage rendu par David en cours de route

Le sélecteur de réinitialisation par section part à l'atelier, mais **un bouton
« Revenir au profil d'usine » reste dans Paramètres**. La raison est que
« Revenir aux réglages d'avant », sous les curseurs, ne s'enregistre pas : il vit
dans la session et sur l'appareil. On bricole en roulant, on coupe le contact, et
le lendemain le recours a disparu.

Un bouton et non le sélecteur : proposer « réinitialiser le mixage » à qui n'a
jamais vu le mixage ne l'aide pas. Au ticket 06, ce bouton devient « enlever la
couche », ce qui vaut mieux — il rendra le profil tel que l'atelier l'a livré,
corrections comprises.

## Le découpage des neuf blocs de l'ancienne section « Profils »

Arbitré par David le 14 septembre 2026. Restent dans Paramètres : choisir et
épingler un profil, la bibliothèque du serveur — c'est ainsi qu'un conducteur
reçoit ce que l'atelier dépose —, et les trois crans de remontée, un réglage de
vie privée devant rester atteignable par celui qu'il concerne. Partent à
l'atelier : la tenue des profils, les moteurs, le rapatriement, la
réinitialisation par section, l'origine du son, la banque et l'échappement.
