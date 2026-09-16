# 09 — L'application prévient : bandeau et télémétrie

**Statut :** ✅ fait — vérifié dans un navigateur contre un serveur qui tourne : bandeau levé aux trois quarts, fermé, relevé à l’entrée en rotation, et la télémétrie qui suit

**Bloqué par :** 07 — le serveur dit la place ; 08 — la rotation fait de la place

## Ce qu'il faut obtenir

Le conducteur apprend que son compte se remplit **avant** que ça coince, et il
l'apprend en roulant, sans aller le chercher.

Un **bandeau** se lève quand la place passe à 75 %, puis de nouveau à 95 %, puis
au refus. Il se ferme d'un bouton, et **ne revient qu'au changement d'état** :
franchir un seuil est un fait neuf, le répéter entre deux serait harceler au lieu
de prévenir — c'est déjà le mot du rappel d'enregistrer son compte.

Le bandeau n'est pas à inventer : `App.vue` en porte déjà quatre, au-dessus de
tous les écrans, dont deux se ferment d'un bouton. Le quota s'y ajoute comme un
cinquième cas, écrit de la même façon.

La **télémétrie** porte le doublon, et sous la forme de cet écran-là : une valeur,
pas un message — « 182 Mio sur 250 ». C'est ce qui reste lisible une fois le
bandeau fermé, et c'est l'écran des chiffres.

**Rien sur l'écran de conduite.** Il se lit d'un coup d'œil, rien n'y bouge, et un
compte plein ne se règle pas en roulant.

## Ce qu'on ne construit pas

Une file de messages générique. David l'a demandée — « ça serait bien que tous les
messages importants soient affichés comme ça » —, et c'est juste : les erreurs de
dépôt et de journal se disent aujourd'hui dans un coin de l'écran de
configuration, là où personne ne les voit en roulant. Mais ça touche tous les
écrans, et c'est **un lot à part** : ici on ajoute un cinquième cas à la main, et
on unifiera quand il y en aura assez pour voir la bonne forme.

## Critères d'acceptation

- [x] Le client lit les trois en-têtes à chaque dépôt, journal et capture
      compris, et range ce qu'il a lu.
- [x] Un serveur qui ne les envoie pas ne fait rien apparaître, et ne casse rien.
- [x] Le bandeau se lève au passage de 75 %, dit ce qui se passe et ce qu'on peut
      y faire.
- [x] Il se lève de nouveau au passage à la rotation, puis au refus, avec un
      texte qui distingue les trois. **Corrigé après essai** : il ne se relève
      que si la situation **empire**, la rotation faisant retomber l'état sous
      son seuil dès le dépôt suivant — un bandeau qui suivrait chaque changement
      se relèverait tout le temps.
- [x] Fermé, il ne revient pas tant que l'état ne change pas — y compris après un
      rechargement de l'application.
- [x] La télémétrie montre la place prise et le plafond, en permanence.
- [x] L'écran de conduite ne montre rien.
- [x] Hors réseau, l'écran n'affirme pas un état qu'il n'a pas pu relever.
- [x] Contrôle qualité vert.
