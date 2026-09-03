# TABLEAU-DE-BORD — un vrai tableau de bord, et un paysage qui défile

**Statut :** 🧑 attend David
**Branche :** `feature/tableau-de-bord`
**Version visée :** 0.4

## L'idée

Relevée à l'usage : « je voudrais changer l'écran de conduite : remplacer les
chiffres et réglettes par un vrai tableau de bord de voiture, et afficher un
paysage simplifié qui défile ».

## Ce qui doit être dit avant tout le reste

Cette idée **heurte une règle écrite du projet**, tenue depuis le premier commit
et rappelée à trois endroits — le README, les conventions de code, la
description des écrans :

> Aucune animation nulle part : les valeurs changent, rien ne bouge pour le
> plaisir. C'est une règle d'ergonomie, pas un goût : l'écran se lit en
> conduisant.

Un paysage qui défile est, par définition, du mouvement pour le plaisir. C'est la
règle de David, et lui seul peut la lever — mais il doit la lever **en le
sachant**, pas la voir disparaître dans un lot.

Le statut de ce lot est donc 🧑 dès son écriture : il n'y a rien à faire avant
cette décision.

## Deux propositions, qu'il faut séparer

Elles arrivent dans la même phrase mais elles n'ont ni le même coût ni la même
justification. Prendre l'une n'oblige pas à prendre l'autre.

### Le tableau de bord

Un cadran se lit d'un coup d'œil là où un nombre se lit en le lisant. Une
aiguille dit la **tendance** — ça monte, ça retombe — qu'un chiffre ne donne
qu'en le comparant au précédent, de mémoire. **L'argument est le même que celui
de la règle** : la lisibilité en conduisant. Ils pointent en sens contraire, et
c'est cela qui rend l'arbitrage intéressant plutôt que tranché d'avance.

Le mouvement d'une aiguille n'est d'ailleurs pas décoratif : il **est** la
valeur. Ce n'est pas de l'animation au sens que la règle proscrit.

Le mode plein écran existe déjà et va dans ce sens — les chiffres occupent toute
la hauteur, les commandes deviennent quatre grandes touches. Le tableau de bord
en serait la suite naturelle.

### Le paysage qui défile

Là, c'est du plaisir, et il faut l'assumer comme tel : rien ne s'y lit. C'est
une réponse à autre chose — le fait qu'on regarde son téléphone au lieu de la
route, et qu'un décor rend l'attente moins vide. Argument recevable, mais
étranger à l'ergonomie.

Son coût est d'un autre ordre : une boucle de rendu permanente, dans une
application dont la cadence est déjà un sujet délicat. L'horloge bat sur le fil
audio précisément parce que le navigateur ralentit les minuteurs ; ajouter un
rendu continu, sur un navigateur de bord ancien, à côté d'un graphe audio qui ne
doit pas hoqueter, demande d'être mesuré avant d'être promis.

## Décisions à prendre, dans cet ordre

1. **Lève-t-on la règle « aucune animation » ?** Entièrement, ou seulement pour
   ce que la règle ne visait pas — une aiguille qui porte une valeur ?
2. **Le paysage est-il dans le même lot que le tableau de bord ?** Recommandation :
   non. Le tableau de bord a une justification ergonomique et peut se faire seul ;
   le paysage est un lot d'agrément, à juger sur son coût.
3. **Que devient l'écran de conduite actuel ?** Les chiffres servent au réglage
   et au diagnostic. Les remplacer ou proposer les deux — le mode plein écran
   montre qu'un même écran peut avoir deux visages.
4. **Qu'est-ce qu'on mesure avant de promettre le paysage ?** Le coût d'un rendu
   continu sur le navigateur de la voiture, et son effet sur la régularité du
   son. Rien ne se décide là-dessus par le raisonnement.

## Hors périmètre tant que la règle n'est pas levée

Tout. Ce lot n'est pas prêt : il attend une décision, pas une implémentation.
