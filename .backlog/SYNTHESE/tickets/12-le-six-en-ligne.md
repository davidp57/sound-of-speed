# 12 — Un six cylindres en ligne, et la chasse au grain du V8

**Statut :** ✅ fait — livré avec l'application le 14 septembre 2026

**Bloqué par :** aucun

## Ce qui a déclenché

David, le 14 septembre 2026, après avoir trouvé le quatre cylindres sans
caractère : « on pourrait créer un nouveau moteur, du type diesel commercial
2.0 l ? genre un audi ou un bmw ? », puis « ajoute un 6 en ligne du type BMW ».

## Ce qui est livré

**Une troisième architecture** dans `native/engines.h` : manetons à
0-120-240-240-120-0, ordre d'allumage 1-5-3-6-2-4, donc un allumage tous les
120 degrés de vilebrequin. Le contrat passe de deux valeurs de cylindres à
trois, et les trois tests qui gardaient l'invariant « quatre ou huit » suivent.

**Deux lignes d'échappement**, trois cylindres chacune — un montage 6-en-2,
celui des six de route. C'est la seule des cinq pistes essayées qui ait donné
quelque chose, et David l'a confirmée à l'oreille : « c'est mieux ».

**Ses cotes ne sont pas sourcées**, et c'est le seul moteur de la bibliothèque
dans ce cas : 84 × 89,6 mm, rapport 10,2, construits de mémoire. Un test vérifie
qu'il reste le seul — le jour où la moitié de la liste est inventée, elle ne
documente plus rien.

| | |
|---|---|
| Prises | 18, de 750 à 7 000 tr/min, plus ralenti et rupteur |
| Poids | 1,26 Mo |
| Saut au bouclage | 10,68 % au pire — le moins bon des quatre, juste sous la banque enregistrée |
| Durées | 2,78 à 3,04 s |

## Deux défauts trouvés en chemin

**Le plancher de longueur de boucle.** Le correctif du ticket 11 remplaçait la
longueur minimale par un seuil de raccord ; quand aucune fenêtre longue ne
passait le seuil, la recherche descendait jusqu'à trois cycles. Sur le six,
trois prises faisaient **95 millisecondes** — une boucle qui se répète dix fois
par seconde. David l'a entendu comme « très synthétique », et **aucun chiffre du
relevé ne le signalait** : le saut d'énergie d'une boucle de trois cycles est
excellent. Il en fallait deux, un seuil et un plancher. Le relevé avertit
désormais quand une prise sort nettement de sa cible.

Son verdict « seul le V8 produit un son intéressant » a été rendu sur cette
banque-là, donc sur un essai en partie invalide.

**La chaîne de compilation ne suivait pas les en-têtes.** `build-generator.sh` ne
recompilait que si un `.cpp` changeait ; `engines.h`, qui porte tous les
constructeurs, ne déclenchait rien. Deux essais de suite ont rendu des chiffres
**identiques au centième** — ils mesuraient le binaire d'avant. Le premier des
deux était le test que David avait demandé.

## Ce qui fait le V8, et ce qu'on n'a pas trouvé

Le V8 a **16 dB de plus entre 1 et 4 kHz** que le six, sur le son sec, donc avant
tout rendu. Cinq hypothèses essayées, toutes mesurées à régime comparable :

| Hypothèse | 1–2 kHz | 4–8 kHz |
|---|---|---|
| collecteurs étagés | +2,9 | +1,3 |
| échappement complet du GM LS | +1,8 | +7,7 |
| came du V8 (levées 0,551 contre 0,39) | −0,9 | +0,8 |
| vilebrequin croisé contre plat | −3,1 | −3,9 |
| **deux lignes d'échappement** | +0,5 | **+12,1** |

Deux enseignements qui valent au-delà de ce ticket :

1. **Le calage irrégulier n'apporte pas de grain, il apporte du grave.** Un V8 à
   vilebrequin plat, donc parfaitement régulier, reste à −7,35 dB là où le six
   est à −26,72. Ce n'est pas l'irrégularité qui fait le V8.
2. **Les deux bancs apportent l'aigu haut, pas le médium.** Un V6 ou un V12
   hériteraient donc des +12 dB et pas des 16 manquants.

**Ce qui reste à essayer est la cylindrée** : le V8 fait 5,7 L, le six 3,0 —
712 cm³ par cylindre contre 496, une chambre de 90 cc contre 54, un alésage de
3,78 pouces contre 3,31.

## Ce qui n'est pas tranché

- **Le six est livré**, tranché par David le 14 septembre : « le six dans les
  profils d'usine ». Quatre profils au lieu de trois, rangés par nombre de
  cylindres décroissant, le V8 croisé toujours premier.
- **Le diesel 2.0** demandé dans le même message n'est pas fait. Il bute sur
  autre chose : le carburant, l'avance à l'allumage et la vitesse de flamme ne
  sont pas dans le contrat, et une part du claquement diesel est un bruit
  mécanique qu'engine-sim ne modélise pas.
- **Le timbre**, comme toujours sur ce lot.

## Ce qui reste à faire, et qui n'est pas du code

**Le régler.** C'est l'hypothèse qui survit aux sept autres, et elle est écrite
dans `engine-library.ts` depuis des semaines : « un seul est réglé à ce jour, le
GM LS, aux valeurs relevées par David ». Le V8 est le seul moteur travaillé du
dépôt ; le quatre cylindres et le six portent des valeurs de référence brutes.

Cela expliquerait le dégradé mesuré sur le son sec — V8 à −10,5 dB entre 1 et
2 kHz, quatre cylindres à −18,9, six à −26,2 — et pourquoi aucun paramètre isolé
ne rend les 16 dB manquants : un réglage est un ensemble, pas un curseur.

Le module WebAssembly a été recompilé le 14 septembre, donc le six apparaît dans
l'écran Synthèse avec ses vingt-neuf curseurs. C'est le seul essai que la machine
ne peut pas faire.
