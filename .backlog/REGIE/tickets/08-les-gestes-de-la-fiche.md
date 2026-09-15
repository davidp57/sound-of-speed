# 08 — Les gestes de la fiche : effacer, forcer, régler, plafonner

**Statut :** ⬜ prêt

**Bloqué par :** 03 — donner et reprendre un rôle, et la trace qui l'inscrit

## Ce qu'il faut obtenir

Quatre boutons sur la fiche, tous tracés de la même façon.

**Effacer un compte.** Une confirmation, et c'est fait. Pas de délai de grâce,
pas de nom à recopier : le bouton que l'utilisateur a déjà sur son propre écran
est immédiat, et on ne fabrique pas un second comportement pour le même mot. La
ligne de trace s'écrit **avant** l'effacement, sinon la cascade l'emporte ; et
elle perd le nom et l'adresse en même temps que le compte disparaît. Elle dit
toujours qu'un compte a été effacé, par qui et quand, sans garder l'identité de
quelqu'un qu'on vient d'effacer.

**Forcer un passage de rétention.** Je lis d'abord le verdict — le serveur sait
déjà dire ce qui serait effacé et ce qui serait retenu, et pourquoi — puis je
déclenche. Ça n'invente aucun effacement : ça avance une horloge qui tourne déjà
toutes les vingt-quatre heures.

**Régler l'abandon.** Même chose pour la règle qui efface un compte anonyme ne
portant rien, pour nettoyer un compte resté en travers.

**Poser un plafond de volume.** Un plafond commun vient de la configuration —
10 Gio par compte, un nombre rond proposé et non mesuré, à revoir quand le
ticket 04 de DURCIR aura livré sa ligne de dépense. La fiche pose une valeur
particulière sur un compte, ou revient au plafond commun.

**Le plafond refuse un envoi ; il n'efface jamais rien.** Un compte au-delà voit
son dépôt refusé, avec un code que le client ne rejoue pas et un écran qui dit
quoi faire — emporter ses données, ou en effacer. Une ligne part dans le journal
du serveur. La borne existante de 16 Mio par requête ne change pas : celle-ci
porte sur le total déposé.

C'est le geste le plus délicat des quatre, parce que c'est le seul qui touche la
route de dépôt, sur le chemin chaud du serveur.

## Critères d'acceptation

- [ ] Un compte effacé depuis la fiche disparaît avec tout ce qu'il portait.
- [ ] Sa ligne de trace existe encore après l'effacement, et ne porte plus ni
      nom ni adresse.
- [ ] Le verdict de rétention se lit avant de forcer, et dit ce qui serait
      effacé comme ce qui serait retenu.
- [ ] Forcer un passage efface exactement ce que le verdict annonçait.
- [ ] Régler l'abandon d'un compte anonyme vide l'efface ; un compte qui porte
      quelque chose est gardé, et un compte non anonyme aussi.
- [ ] Un dépôt qui ferait dépasser le plafond est refusé ; rien de déjà déposé
      n'est effacé.
- [ ] Le refus arrive avec un code que le client ne rejoue pas, et l'écran de la
      voiture dit quoi faire.
- [ ] Le plafond commun se règle par la configuration, sans reconstruire
      l'image, et il est déclaré dans la composition de la pile.
- [ ] Une surcharge posée sur un compte prime sur le plafond commun, et se
      retire.
- [ ] La mesure du poids d'un compte ne rend pas le dépôt sensiblement plus
      coûteux — chiffre à l'appui.
- [ ] Chacun des quatre gestes écrit sa ligne de trace.
- [ ] L'administrateur peut exercer ces gestes sur son propre compte comme sur
      un autre.
- [ ] Les routes ajoutées sont inscrites dans l'inventaire de l'essai
      d'isolation.
- [ ] Contrôle qualité vert.
