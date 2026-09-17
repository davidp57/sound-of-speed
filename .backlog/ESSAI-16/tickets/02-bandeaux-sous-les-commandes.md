# 02 — Les bandeaux du bas passent sous les commandes

**Statut :** ✅ fait le 17 septembre 2026 — réglé par la colonne du milieu, sans
être traité pour lui-même

David, photos à l'appui : le bandeau « Plus aucune position depuis 7 s. Suivi
relancé 1 fois. » s'affiche **par-dessus** les boutons P, AUTO et MAN de l'écran
Conduite, et le texte des deux se mélange. Il précise que ce n'est pas propre au
suivi : le bandeau « appliquer l'étalonnage » est dans le même cas.

C'est donc un seul défaut de mise en page, et non un par bandeau : le bloc de
commandes et la zone des bandeaux se recouvrent dès que la fenêtre est courte.
L'écran de la voiture donne **773 × 575 px** utiles pour 1 254 × 784 annoncés,
densité 1,53 — c'est la hauteur qui manque.

## Ce qu'il faut obtenir

Aucun bandeau ne recouvre une commande, à la largeur et à la hauteur utiles de la
voiture. Un bandeau qui apparaît pousse ce qui est en dessous, ou se place
ailleurs ; il ne se superpose pas.

## Critères d'acceptation

- [ ] À 773 × 575 px, le bandeau de perte de position n'empiète sur aucun des
      boutons D, P, +, −, AUTO, MAN.
- [ ] Même chose pour le bandeau d'étalonnage, et pour tout bandeau de la même
      famille.
- [ ] Les deux bandeaux à la fois ne se recouvrent pas non plus l'un l'autre.
- [ ] Vérifié dans le navigateur de prévisualisation à cette taille exacte, et
      pas seulement sur un écran de bureau.

## Comment il s'est réglé

Le déplacement du sélecteur entre les compteurs le supprime par construction.
Mesuré à la taille réelle de l'écran de bord, 774 × 575 : la rangée des cadrans
disposait de **229 pixels** de haut, et la bande des commandes en demandait
**150** à elle seule, en plus des cadrans. Elle ne tenait pas, donc elle
débordait — par-dessus le bandeau d'alerte, qui devenait illisible, et ses
boutons passaient sous le bandeau du compte.

Ce n'était donc pas un problème de superposition à arbitrer, mais un contenu qui
ne tenait pas dans sa rangée. Le sélecteur étant maintenant dans la colonne du
milieu, la rangée n'a plus qu'une hauteur à servir.
