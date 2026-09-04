# 06 — quitter le plein écran sans viser un profil

**Statut :** ✅ fait

**Bloqué par :** aucun

## Ce qu'il faut obtenir

On quitte le plein écran d'un geste, sans risquer de changer de profil.

La sortie était une croix flottante en haut à droite, en `position: fixed`, à
35 % d'opacité et sans fond. Or la rangée des profils épinglés, en plein écran,
passe ses boutons en pleine largeur : la croix était posée **par-dessus** le
bouton le plus à droite. Quitter le plein écran recouvrait littéralement changer
de profil, et rien ne distinguait les deux.

La croix avait été faite discrète exprès, pour qu'on n'en sorte pas par mégarde
en roulant. Mais ce sont deux besoins distincts : un geste délibéré d'un côté,
une cible identifiable de l'autre. Une petite cible transparente au bord de
l'écran ne répond ni à l'un ni à l'autre — en roulant, ce n'est pas une cible.

La sortie est donc une touche de la rangée de commandes, **à gauche, à l'écart
des autres et d'une autre couleur** : une flèche de retour, qui dit ce qu'elle
fait sans qu'on ait à la lire. L'écart avec le groupe des commandes de conduite
est plus large que celui qui les sépare entre elles, et c'est lui qui empêche de
la presser en visant la voisine.

## Critères d'acceptation

- [x] Plus rien ne recouvre la rangée des profils épinglés.
- [x] La touche de sortie est distincte des commandes de conduite, par sa place
      comme par sa couleur.
- [x] Elle quitte le plein écran, et la barre du haut revient. Vérifié.
- [x] Sur un écran de 375 px, la rangée ne déborde pas : la flèche fait 58 px de
      large et 81 de haut, et la page tient dans la largeur de l'écran.
- [x] La flèche porte un libellé lu par les lecteurs d'écran.

## Ce qui a été relevé au passage

Sur un écran étroit, la flèche prend 58 px que les quatre commandes n'ont plus :
elles se partagent 279 px au lieu de 359, et « Son actif » passe sur deux
lignes. Sans conséquence sur l'écran large de la voiture, et sans débordement.
