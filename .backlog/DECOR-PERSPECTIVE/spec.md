# DECOR-PERSPECTIVE — un décor vu de la place du conducteur

**Statut :** 🚫 abandonné le 7 septembre 2026
**Branche :** aucune, le lot n'a jamais été ouvert
**Version visée :** —

## Pourquoi c'est abandonné

Décidé le 7 septembre 2026, au moment de découper le lot en tickets. Quatre
raisons, dans l'ordre où elles pèsent.

**Le son passe avant, et le décor le menace.** Un rendu en perspective demande
plus de calcul par image qu'un décor latéral, qui n'était que des translations.
Le produit, c'est le son ; rien ne justifie de faire courir un risque à la
régularité de la cadence pour un dessin dont rien ne se lit.

**La preuve à fournir coûte plus cher que le lot.** L'autorisation demandait de
remesurer, et le harnais de la mesure de septembre n'a pas été conservé — il n'y
a pas de commande de mesure dans `scripts/`. Il faudrait le reconstruire, et
plus complet que la fois précédente : la mesure d'alors n'avait jamais activé le
son, donc elle établissait la cadence de l'affichage et non celle du fil audio,
qui est justement ce qu'on veut protéger. Et elle serait à refaire sur le
navigateur de la voiture, pas au poste.

**Le décor a déjà été raté une fois.** Le rendu latéral était livré, mesuré,
jugé acceptable au poste — et « complètement raté » à la première conduite. Le
seul juge est l'essai en voiture, qui est aussi la ressource la plus rare du
projet. Elle est mieux employée aux lots qui attendent une écoute du son.

**C'est de l'agrément pur.** Le lot lui-même l'écrivait : rien ne s'y lit. Il
n'a jamais eu de version visée autre que « après 0.2 ».

Conséquence : **l'exception à la règle « aucune animation » est retirée** de
`CLAUDE.md`. La règle n'a plus d'exception. La nuance sur l'aiguille de cadran
n'est pas concernée — une aiguille n'a jamais relevé de cette règle, son
mouvement *est* la valeur.

Le ticket [TABLEAU-DE-BORD/04](../TABLEAU-DE-BORD/tickets/04-le-paysage-qui-defile.md)
est abandonné du même mouvement : il attendait une mesure pour un composant qui
n'existe plus.

Ce qui suit est la spécification d'origine, conservée telle quelle. Elle dit ce
qu'on voulait et ce qu'on ignorait ; c'est ce qu'il faut relire avant de
reproposer un décor.

## Ce qui a déclenché

Le décor livré le 3 septembre 2026 défile **de côté**, comme dans un jeu de
plateforme. Relevé en roulant le 4 septembre : « complètement raté ».

L'écran est vu de la place du conducteur, et c'est ce point de vue qui décide.
Un décor y défile d'avant en arrière, en perspective, et se rapproche — il ne
glisse pas latéralement. Ce n'est pas un réglage à corriger, c'est un autre
dessin.

Le décor latéral a donc été retiré, avec son bouton et sa préférence
(ESSAI-04, ticket 07). L'ancien code est dans l'historique.

## Ce qu'on veut

Un décor qui donne la sensation d'avancer, sans rien apporter à lire.

## Ce qui est acquis

**L'exception à la règle « aucune animation » tient.** Elle a été levée par
David le 3 septembre pour ce seul décor, et sa raison n'a pas changé : c'est de
l'agrément assumé, rien ne s'y lit, et il se coupe. Elle n'autorise toujours ni
transition, ni valeur qui glisse vers sa nouvelle position, ni effet
d'apparition — la note de `CLAUDE.md` en fixe les limites.

> Écrit avant l'abandon. L'exception a été retirée de `CLAUDE.md` le
> 7 septembre 2026, en même temps que le lot.

**La condition de mesure tient aussi**, et elle est plus exigeante ici. Le décor
latéral coûtait 0,2 ms d'écart de durée d'image, moins que l'écart de passe à
passe du même état, aucune image ne dépassant 33 ms. Un rendu en perspective
demande davantage de calcul : **la mesure est à refaire avant de promettre quoi
que ce soit**, et sur le navigateur de la voiture, pas au poste de travail. Le
son passe avant le décor : si la régularité de la cadence en souffre, le décor
ne se fait pas.

## Questions ouvertes

- **Jusqu'où va la perspective ?** Une route qui fuit vers un point de fuite,
  avec quelques repères latéraux qui grandissent en approchant, suffit peut-être.
  Un paysage complet coûte cher pour un décor qu'on ne regarde pas.
- **Que fait la vitesse ?** Le défilement doit suivre la vitesse réelle, sinon
  le décor ment — c'est déjà la règle qui voulait qu'un paysage ne bouge pas
  voiture arrêtée.
- **Quelle technique ?** Le projet n'a aucune bibliothèque d'interface et doit se
  charger hors réseau : une solution en CSS ou en canevas se propose avant toute
  dépendance.
