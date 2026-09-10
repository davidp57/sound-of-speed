# MOUVEMENT — une seule notion de « est-ce qu'on ralentit ? »

**Statut :** ⬜ prêt — cause établie, correctif à écrire
**Branche :** à ouvrir, `fix/mouvement`
**Version visée :** à décider

## Ce qui a déclenché

Un essai en voiture, rapporté par David le 10 septembre 2026. Le son du passage
de rapport tient — « pas mal, perfectible mais ok » — mais le passage lui-même
s'est dégradé :

> le passage en lui-même a été dégradé par cette fonctionnalité (reste parfois
> en 3ème jusque 150, parfois monte en 6 puis redescend tout seul alors que je
> ralentis)

Et il situe le défaut : « c'est un souci nouveau, qui n'est là que depuis qu'on
a travaillé sur le passage des rapports ce weekend ». L'agent avait d'abord
accusé la mesure d'accélération de la voiture ; David a écarté cette piste — le
lot PENTE avait été essayé et jugé bon. La datation lui donne raison.

## La cause

**Deux mécanismes répondent à la même question, avec des seuils qui se
contredisent.**

| Mécanisme | Dit qu'on ralentit à partir de | Introduit le |
|---|---|---|
| Bande de stabilité de la croisière | −0,1 m/s² (`inBand`) | 6 septembre, FIX-BOITE |
| Compteur `slowing` (`CRUISE_SLOWING_MS2`) | −0,05 m/s² | **8 septembre, PASSAGE** |

Entre les deux valeurs, la boîte se croit simultanément en croisière **et** en
ralentissement. Et l'écart est dérisoire : 0,05 m/s², c'est 0,18 km/h par
seconde — perdre un kilomètre-heure en six secondes.

Les trois constantes en cause datent toutes du 8 septembre, ce qui confirme la
datation de David :

- `CRUISE_SLOWING_MS2` et `CRUISE_SLOWING_HOLD_S` — `f58efd8`, « ne plus monter
  un rapport pendant qu'on ralentit » ;
- `DEMAND_FALL_PER_S` — `7889e6a`, « faire suivre au seuil de montée la
  demande » ;
- `CLEARLY_SLOWING_MS2` — `229e1c7`, « ne pas passer parce que le seuil est
  tombé sous le régime ».

### Les deux symptômes, expliqués par cette contradiction

**Rester en 3ᵉ jusqu'à 150 km/h.** Le ralentissement passe par moments sous
−0,05 m/s². Le compteur `slowing` monte alors deux fois plus vite qu'il ne
redescend (`CRUISE_SLOWING_HOLD_S`), donc il se colle à vrai. Or la montée au
régime exige `!slowing` : plus aucune montée, quel que soit le régime. Mesuré :
la 3ᵉ à 150 km/h sur le profil Route, c'est 6 070 tr/min pour un rupteur à
6 300 et un seuil de montée à 3 050 — la boîte aurait dû monter deux mille
tours plus tôt.

**Monter en 6ᵉ puis redescendre en ralentissant.** Le ralentissement est plus
doux, entre 0 et −0,05. `slowing` ne s'allume pas, la bande déclare l'allure
tenue, la montée en croisière part — puis le régime tombe sous le seuil de
descente (1 820 tr/min sur Route) et la descente au régime rattrape le rapport.
Aller-retour.

Les deux « parfois » de David sont donc le même défaut vu de ses deux côtés,
selon de quel côté du seuil le ralentissement se trouve.

## La leçon, déjà tirée une fois

FIX-BOITE avait conclu « **un compteur, un usage** » : sa troisième oscillation
venait déjà d'un compteur à deux sens. La même erreur est revenue deux jours
plus tard, sous une autre forme.

## La direction

**Une seule notion de l'état du mouvement**, calculée à un seul endroit, que
tout le reste consulte — accélère, tient, ralentit. Elle remplace `inBand`,
`slowing`, `slowingForS`, `braking` et `CLEARLY_SLOWING_MS2` par une même
lecture, avec une hystérésis explicite au lieu de deux compteurs asymétriques.

Ce n'est pas un défaut de réglage : monter un seuil déplacerait la
contradiction sans la lever. Vaut aussi pour la charge et la demande, qui
décrivent elles aussi l'intention à deux endroits.

## Ce qui reste à décider

- **Où ce lot vit.** La refonte décidée le 10 septembre 2026 doit refaire le
  modèle mécanique. Ce correctif est-il un fix à part, livré sur l'application
  telle qu'elle roule, ou la première pierre de la boîte refondue ? David a
  demandé de le noter et de le traiter après la conception : « continue à
  cuisiner la refonte, on verra le fix après ».
- **Une bascule par garde-fou.** Idée de David, pour isoler en roulant lequel
  dérape : « au besoin on pourra refaire des tests avec la nouvelle app […]
  genre, avec un toggle pour activer/désactiver le comportement ». Il la
  proposait pour PENTE ; elle vaut mieux appliquée aux garde-fous du 8
  septembre, qui sont les suspects.
- **Ce que le journal du 9 septembre dit.** Il enregistre `kmh`, `accelMs2`,
  `rpm` et `gear` toutes les dix secondes, et seize tranches couvrent 1 h 20 de
  conduite réelle. De quoi montrer les épisodes fautifs au lieu de les déduire.
  Les fichiers sont sur le NAS, dans `journal/` ; le poste du bureau n'y a pas
  accès (le proxy répond 503).

## Hors périmètre

Le réglage fin des seuils à l'oreille : il n'a pas de sens tant que deux
notions se contredisent. Et le son du passage, que David juge correct.
