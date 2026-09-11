# ETAGEMENT — une boîte à sept rapports, étagée pour tenir bas

**Statut :** 🧑 les trois tickets sont livrés ; reste l'écoute en roulant
**Branche :** `feature/etagement`
**Version visée :** 0.1.109

Le débriefing du trajet du 11 septembre 2026 au soir a donné deux demandes qui
n'en font qu'une : **la boîte tourne trop haut en croisière**, et il lui manque
un rapport.

## Le constat, mesuré

Les trois vitesses que David a nommées, sur la boîte actuelle :

| | aujourd'hui | jugement |
|---|---|---|
| 50 km/h en quatrième | **1 532 tr/min** | déjà bon |
| 80 km/h en cinquième | **2 046 tr/min** | trop haut |
| 110 km/h en sixième | **2 355 tr/min** | trop haut |

La quatrième est juste ; ce sont la cinquième et la sixième qui sont trop
courtes. Et les sauts sont irréguliers — **1,74 · 1,50 · 1,32 · 1,20 · 1,19** :
la boîte s'écrase en haut alors qu'elle devrait s'étaler.

## Ce qui est décidé

**L'étagement.** Deux options ont été posées ; David a tranché pour la première.

Garder la première, la deuxième et la troisième — celles du départ qu'il vient
de juger « parfait » — et réétager la quatrième à la septième :

```
3.55 · 2.04 · 1.36 · 1.00 · 0.73 · 0.53 · 0.39
sauts :      1.74 · 1.50 · 1.36 · 1.37 · 1.38 · 1.36
```

| | régime |
|---|---|
| 50 km/h en quatrième | 1 487 tr/min |
| 80 km/h en cinquième | 1 737 tr/min |
| 110 km/h en sixième | 1 734 tr/min |
| 130 km/h en septième | 1 508 tr/min |

L'option écartée était un étagement régulier de bout en bout
(`3.55 · 2.46 · 1.71 · 1.19 · 0.83 · 0.57 · 0.39`), plus cohérent sur le papier
— tous les sauts à 1,44 — mais qui refaisait tout le bas de la boîte, donc le
départ validé.

Ce qui reste vrai et qu'on assume : le saut 2→3 demeure le plus grand (1,50).
C'est le moment du passage qui le corrige, pas le rapport.

**Le moment des passages en mode Route.** David : « modifier le mode Route pour
que les vitesses passent plus tôt que maintenant (−20 %) », et au débriefing :
« trop tard, ça reste trop longtemps en deux ».

Le seuil se calcule `ralenti + marge × facteur`, avec `upshiftMarginRpm` à 900
en Route. Le ralenti est un plancher fixe : baisser la marge de vingt pour cent
ne baisse pas le seuil d'autant. **Marge 900 → 640**, ce qui donne −20 % pied au
plancher et −14 % en conduite normale. L'alternative — multiplier le seuil final
par 0,8 — est exacte partout mais fait descendre les passages jusqu'à
1 360 tr/min en conduite douce, ce qui va chercher très bas avec les rapports
longs de ce lot. David a tranché pour la marge.

**Les deux se règlent ensemble.** Changer les rapports déplace mécaniquement les
régimes de passage : régler les seuils d'abord, ce serait les régler deux fois.

## Ce que la septième impose

Ce n'est pas une valeur de plus dans un tableau. `upshiftRpm` compte une entrée
de moins que les rapports, `shiftDelaysS` une par rapport, et les profils déjà
enregistrés — ceux de David, sur son téléphone et sur le NAS — en ont six.

## Les tickets

| | Sujet |
|---|---|
| [01](tickets/01-sept-rapports.md) | Les sept rapports, et tout ce qui se compte par rapport |
| [02](tickets/02-passer-plus-tot-en-route.md) | Passer plus tôt en mode Route |
| [03](tickets/03-reprendre-les-profils-a-six-rapports.md) | Les profils à six rapports ne se perdent pas |
