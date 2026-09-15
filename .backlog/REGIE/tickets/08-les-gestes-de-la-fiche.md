# 08 — Les gestes de la fiche : effacer, forcer, régler, plafonner

**Statut :** ✅ fait

**Bloqué par :** 03 — donner et reprendre un rôle, et la trace qui l'inscrit

## Ce qu'il faut obtenir

Quatre boutons sur la fiche, tous tracés de la même façon.

**Effacer un compte.** Une confirmation, et c'est fait. Pas de délai de grâce,
pas de nom à recopier : le bouton que l'utilisateur a déjà sur son propre écran
est immédiat, et on ne fabrique pas un second comportement pour le même mot. La
ligne de trace s'écrit **avant** l'effacement — non par crainte de la cascade,
cette table n'ayant pas de clé étrangère, mais parce qu'un serveur qui tombe
entre les deux doit laisser la trace d'un effacement qui n'a pas eu lieu plutôt
qu'un effacement dont il ne reste rien ; et elle perd le nom et l'adresse en même
temps que le compte disparaît. Elle dit
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

- [x] Un compte effacé depuis la fiche disparaît avec tout ce qu'il portait.
- [x] Sa ligne de trace existe encore après l'effacement, et ne porte plus ni
      nom ni adresse.
- [x] Le verdict de rétention se lit avant de forcer, et dit ce qui serait
      effacé comme ce qui serait retenu.
- [x] Forcer un passage efface exactement ce que le verdict annonçait.
- [x] Régler l'abandon d'un compte anonyme vide l'efface ; un compte qui porte
      quelque chose est gardé, et un compte non anonyme aussi.
- [x] Un dépôt qui ferait dépasser le plafond est refusé ; rien de déjà déposé
      n'est effacé.
- [x] Le refus arrive avec un code que le client ne rejoue pas, et l'écran de la
      voiture dit quoi faire.
- [x] Le plafond commun se règle par la configuration, sans reconstruire
      l'image, et il est déclaré dans la composition de la pile.
- [x] Une surcharge posée sur un compte prime sur le plafond commun, et se
      retire.
- [x] La mesure du poids d'un compte ne rend pas le dépôt sensiblement plus
      coûteux — chiffre à l'appui.
- [x] Chacun des quatre gestes écrit sa ligne de trace.
- [x] L'administrateur peut exercer ces gestes sur son propre compte comme sur
      un autre.
- [x] Les routes ajoutées sont inscrites dans l'inventaire de l'essai
      d'isolation.
- [x] Contrôle qualité vert.
