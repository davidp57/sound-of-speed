# DECOR-PERSPECTIVE — un décor vu de la place du conducteur

**Statut :** ⬜ prêt
**Branche :** `feature/decor-perspective`
**Version visée :** après 0.2 — c'est de l'agrément, il attend

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
