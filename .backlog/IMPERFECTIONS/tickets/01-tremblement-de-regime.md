# 01 — Le régime tremble, d'autant plus qu'il est bas

**Statut :** ✅ fait

**Bloqué par :** aucun, peut démarrer tout de suite

## Ce qu'il faut obtenir

Le régime n'est plus parfaitement lisse. Un tremblement lent s'y ajoute, dont
l'amplitude décroît quand le régime monte et quand la charge monte : un moteur se
stabilise en poussant, il tremble au ralenti et à vide.

C'est la réponse directe au « ralenti un poil instable » demandé, et c'est le
remède le plus rentable du lot : le conditionnement produit aujourd'hui un signal
d'une régularité qu'aucun moteur thermique n'a, et cette régularité est une part
importante de ce qui fait entendre une machine plutôt qu'un moteur.

Deux réglages, exposés comme les autres : l'amplitude au ralenti et la vitesse du
tremblement — une composante rapide, une lente, parce qu'un tremblement à une
seule fréquence s'entend comme un vibrato.

Le tremblement est produit par un générateur à graine, donc **reproductible** :
une même situation donne un même chiffre, sans quoi l'écran de télémétrie
deviendrait illisible et aucun test ne pourrait l'affirmer.

## Critères d'acceptation

- [x] Au ralenti, le régime tremble d'une amplitude réglable et non nulle
- [x] Le tremblement décroît quand le régime monte
- [x] Le tremblement décroît quand la charge monte
- [x] À amplitude nulle, le comportement est exactement celui d'avant le ticket
- [x] Le tremblement est reproductible à graine égale
- [x] Il ne fait jamais franchir le rupteur ni descendre sous le ralenti
- [x] Les deux réglages sont dans le guide de création et la référence des
      réglages

## Ce qui a été fait

`EnginePreset` gagne `flutterRpm` (amplitude au ralenti) et `flutterHz`
(fréquence de la composante rapide) ; `EngineState` gagne `audibleRpm`, le
**régime entendu**. Le mixage lit ce dernier pour calculer les vitesses de
lecture ; la boîte, ses seuils et la télémétrie gardent le régime net.

**Pas de graine, et c'est mieux ainsi.** Le tremblement n'est pas un tirage au
sort mais une somme de trois sinusoïdes, dont deux dans un rapport irrationnel :
la somme n'a donc pas de période, et sa valeur ne dépend que du temps écoulé
depuis la remise à zéro. La reproductibilité est acquise par construction, sans
graine à passer ni à retenir — un générateur pseudo-aléatoire aurait fait
dépendre le mixage de l'historique des appels. Le critère est donc tenu plus
strictement que demandé : deux exécutions de la même suite de pas donnent la
même suite de régimes, au bit près.

## Mesures

Excursion du régime entendu autour du régime net, relevée sur trente secondes.

| Situation | Route (réglé à 25) | Sport (réglé à 35) |
|---|---|---|
| Ralenti, pied levé | 0 à +24,2 tr/min | 0 à +33,9 tr/min |
| 1118 tr/min, pied levé | ±20,8 | ±30,0 |
| 1118 tr/min, pleine charge | ±8,3 | ±12,0 |
| 2981 tr/min, pied levé | ±11,3 | ±18,3 |
| 2981 tr/min, mi-charge | ±7,9 | ±12,8 |
| 2981 tr/min, pleine charge | ±4,5 | ±7,3 |
| Haut des tours, pied levé | ±6,1 | ±9,4 |
| Haut des tours, pleine charge | ±2,4 | ±3,8 |

Au ralenti l'excursion est **à sens unique** : le régime y est exactement à son
plancher, et le critère « ne descend jamais sous le ralenti » borne donc la
moitié basse du tremblement. Le régime entendu y est en moyenne 4,3 tr/min
au-dessus du ralenti sur Route, soit neuf centièmes de demi-ton — inaudible comme
fausseté, mais c'est dit.
