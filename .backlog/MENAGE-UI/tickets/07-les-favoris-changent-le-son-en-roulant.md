# 07 — Les favoris épinglés changent le son depuis l'écran de conduite

**Statut :** ✅ fait

**Bloqué par :** aucun, peut démarrer tout de suite

## Ce qu'il faut obtenir

Changer le bruit du moteur en roulant, sans quitter les cadrans. Une rangée
courte des seuls profils épinglés : deux ou trois grandes cibles, un appui, le
son change. La liste complète reste dans Paramètres.

L'épinglage existe déjà et ne servait qu'à trier une liste ; il prend ici son
usage.

**Ce ticket touche l'écran que le croquis du 10 septembre voulait dégager.** La
place se mesure, elle ne se suppose pas : les cadrans ont déjà été serrés une
fois, et la hauteur de l'écran de conduite en mode simulateur avait été relevée
à 407 pixels après la sortie du banc. Si la rangée coûte trop cher aux cadrans,
c'est elle qui cède, pas eux.

Aucun profil épinglé : pas de rangée. On ne montre pas une rangée vide pour
expliquer qu'elle pourrait se remplir.

## Critères d'acceptation

- [x] Les profils épinglés forment une rangée sur l'écran de conduite, et un
      appui change le son
- [x] Le profil actif se distingue des autres
- [x] Sans assez de profils épinglés, la rangée n'existe pas
- [x] La hauteur prise par la rangée est mesurée et comparée à celle d'avant,
      cadrans compris
- [x] Les cibles se touchent en roulant : leur taille est relevée, pas estimée
- [x] Le mode plein écran garde la rangée ou s'en passe — le choix est fait et
      dit, pas subi

## Ce que le ticket a réellement trouvé

**La rangée existait déjà.** Elle avait été posée avec le sélecteur de conduite,
et le ticket a été écrit sans le voir. Ce qu'il restait à faire était donc ce que
son titre annonçait le moins et ce qu'il demandait le plus clairement : mesurer.

**Le défaut était dans la cible tactile.** Relevée à **38 pixels** de haut, sous
le seuil que les deux systèmes recommandent pour un bouton visé au doigt — 44
chez l'un, 48 chez l'autre. Sur un écran qu'on touche en roulant, c'est le seul
chiffre qui compte vraiment. Portée à 44.

**Et ces six pixels ne coûtent rien** : l'écran de conduite mesure 1 387 pixels
avant comme après, sans débordement. La place existait, elle n'était pas prise.

**Deux règles `.favorites` se suivaient**, dont une orpheline portant un
commentaire sur une barre qui n'existe plus. Fusionnées.

## La question du plein écran, tranchée par le code

Elle était ouverte dans la spec ; la réponse était déjà écrite. Le plein écran
**garde** la rangée et agrandit ses cibles à **84 pixels** — mesuré. C'est
cohérent : ce mode sert à conduire, et changer de son en conduisant est
exactement ce que cette rangée rend possible.
