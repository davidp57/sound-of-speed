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

**Décision prise le 3 septembre 2026.** David a levé la règle **pour le paysage
seul**, en connaissance de cause, et l'exception est écrite dans
[`CLAUDE.md`](../../CLAUDE.md) — elle ne porte que sur ce décor, et pas sur les
transitions, les valeurs qui glissent ou les apparitions. Le cadran, lui, ne
relevait pas de la règle : le mouvement d'une aiguille est la valeur.

Le lot est donc prêt, et il est découpé de façon que le paysage puisse être
abandonné sans rien perdre du tableau de bord — la mesure du coût d'un rendu
continu est dans son propre ticket, et elle conditionne sa réalisation.

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

1. ~~Lève-t-on la règle « aucune animation » ?~~ **Tranché** : levée pour le
   paysage seul.
2. ~~Le paysage est-il dans le même lot ?~~ **Tranché** : même lot, tickets
   séparés, le paysage en dernier et conditionné à sa mesure.
3. ~~Que devient l'écran de conduite actuel ?~~ **Tranché en écrivant le code** :
   les deux visages, cadrans par défaut, chiffres à un bouton. Les chiffres
   servent au réglage et au diagnostic, où cent tours d'écart ne se voient pas
   sur une aiguille.
4. ~~Qu'est-ce qu'on mesure avant de promettre le paysage ?~~ **Tranché** : la
   durée d'image, avant et après, sur la même trace rejouée, plus le travail
   ajouté par image. Fait, et favorable — voir le ticket 04. Le navigateur de la
   voiture et la régularité du son restent à établir en roulant.

## Où en est le lot

Les quatre tickets sont écrits en code. Deux sont clos — la disposition en
tableau de bord (02) et les deux visages (03). Deux attendent la voiture : le
cadran (01), pour la lecture en roulant et en plein soleil, et le paysage (04),
dont le coût est mesuré au poste mais pas sur le navigateur de bord, et dont
l'effet sur la régularité du son ne peut pas s'établir sans faire sortir du son.

**Le paysage n'est pas abandonné.** La mesure qui conditionnait sa réalisation est
favorable : la durée d'image ne bouge pas, et le décor coûte 0,13 ms de temps de
tâche par image, un peu plus d'un centième d'image. Le chiffre et ses réserves
sont dans le ticket 04.

Deux décisions ont été prises en écrivant le code, faute d'avoir été tranchées
dans la spécification :

- **L'écran de conduite garde ses deux visages** — point 3 ci-dessus. Le tableau
  de bord est le visage par défaut, les chiffres restent à un bouton, et le choix
  est une préférence de l'appareil.
- **Le paysage est coupé par défaut.** C'est de l'agrément, et un navigateur de
  bord ancien n'a pas à le payer sans qu'on l'ait demandé.

## Hors périmètre

- Toute autre animation. L'exception porte sur le décor, et sur lui seul.
- L'écran de télémétrie, qui est fait pour le diagnostic et garde ses chiffres.
