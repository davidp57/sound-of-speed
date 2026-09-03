# UI-DEFILEMENT — faire défiler sans dérégler

**Statut :** ⬜ prêt
**Branche :** `fix/defilement`
**Version visée :** 0.3

## Le problème

Relevé en roulant : « l'écran configuration est compliqué à faire défiler, on
change sans le vouloir des paramètres (sliders) quand on scroll ».

L'écran de configuration est une longue colonne de curseurs. Un glissement
vertical qui commence sur l'un d'eux ne fait pas défiler la page : il **déplace
le curseur**. On règle donc au hasard en cherchant à lire, et l'on s'en aperçoit
au son.

C'est un défaut de sécurité autant que de confort : cela se produit à l'arrêt à
un feu, l'écran à bout de bras, sans possibilité de vérifier ce qu'on vient de
déranger.

## La solution

Deux choses, et la première est probablement suffisante à elle seule — mais la
seconde a été demandée explicitement, et elle a sa propre valeur.

**Le comportement tactile.** Un curseur qui déclare `touch-action: pan-y` rend
le glissement **vertical** au défilement de la page et ne garde que
l'**horizontal** pour lui. C'est le remède exact au symptôme, et il tient en une
déclaration par curseur. À vérifier sur le navigateur de la voiture, qui est un
Chromium ancien : c'est le seul avis qui compte.

**Une bande neutre de défilement**, à **gauche** — la place du conducteur, donc
celle du pouce. Assez large pour qu'on la trouve sans regarder, et assez
identifiée pour qu'on sache qu'elle est là. Elle donne une zone où le glissement
ne peut rien dérégler, quoi qu'il arrive, y compris si le comportement tactile
se révèle inopérant sur ce navigateur.

## Histoires

1. En tant que conducteur arrêté à un feu, je veux faire défiler l'écran de
   configuration sans changer un réglage par accident.
2. En tant que conducteur, je veux trouver la zone de défilement sans la
   chercher : à gauche, large, et visible.
3. En tant que conducteur, je veux qu'un réglage déplacé par accident se
   remarque — l'écran de télémétrie et la réinitialisation par section existent
   pour cela, mais mieux vaut ne pas y arriver.

## Décisions à prendre

- **La largeur de la bande.** Assez pour le pouce en conduite, pas au point de
  rétrécir les curseurs sur un téléphone en portrait. À décider en la voyant,
  pas ici.
- **Sa marque visuelle.** Le dépôt s'interdit les animations et l'emphase ; une
  bande discrète mais reconnaissable, sans dégradé ni flèche clignotante.
- **Est-ce que la bande sert aussi ailleurs ?** L'écran de télémétrie est une
  longue colonne lui aussi, mais il n'a pas de curseurs — donc pas le problème.
  À ne pas généraliser sans raison.

## Hors périmètre

- Un verrou général de l'écran de configuration en roulant. La tentation est
  grande, mais le réglage à l'oreille se fait précisément en roulant : c'est
  l'usage, pas un abus.
- Le mode simplifié, qui réduira le nombre de curseurs et donc la longueur de la
  colonne — c'est le lot [MODE-SIMPLE](../MODE-SIMPLE/spec.md), et il ne
  supprime pas le besoin de celui-ci.
