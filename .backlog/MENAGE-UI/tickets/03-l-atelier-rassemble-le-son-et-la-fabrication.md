# 03 — L'atelier : un onglet qui rassemble le son et la fabrication de profils

**Statut :** ⬜ prêt

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

- [ ] Un onglet « Atelier » porte le mixage, les couches, la tenue des profils
      et le banc de synthèse, avec sa navigation interne
- [ ] Un compte sans le rôle `atelier` ne le voit pas
- [ ] Le banc de synthèse demande `synthese` en plus, et son absence ne ferme
      que lui
- [ ] L'onglet n'apparaît pas sur un téléphone ni sur l'appareil « voiture »
- [ ] Il porte la garde : au GPS en roulant, il est grisé comme les paramètres
      avancés
- [ ] Le premier niveau ne propose plus que choisir, épingler et ajuster un
      profil ; un profil reçu par lien s'y installe toujours
- [ ] Un droit qui expire referme l'atelier sans redémarrage
