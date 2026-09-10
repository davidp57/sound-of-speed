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

## Ce que le banc a démenti

**Écrit après coup, le 10 septembre 2026, et il faut le lire avant la suite.**
Le raisonnement ci-dessous a été mis à l'épreuve d'un banc — quatorze
scénarios, `repro.test.ts` — et il ne survit pas :

- **Symptôme A, expliqué autrement.** La 3ᵉ tenue jusqu'à 143 km/h se reproduit
  sans aucun garde-fou en cause : c'est le réglage du profil Sport. Ses seuils
  de montée valent jusqu'à 6 500 tr/min et la 3ᵉ n'atteint ce régime qu'à cette
  vitesse. La boîte fait ce qu'on lui a demandé. Sur Route, la montée est propre
  — 6ᵉ à 148 km/h.
- **Symptôme B, pas reproduit.** Dix scénarios de ralentissement, de 0,2 à
  2 km/h par seconde, sur les deux profils : **aucune montée** pendant le
  ralentissement. La contradiction décrite plus bas existe dans le code, mais
  elle ne produit pas le défaut observé — du moins pas sur un signal propre.

Ce qui reste vrai : les deux seuils **sont** incohérents, et la piste du signal
réel n'est pas explorée. Le banc dérive l'accélération d'un profil de vitesse
lisse ; la voiture la tire d'un GPS à 30 ms et le README annonce déjà, sans
l'avoir vérifié en roulant, qu'« une accélération douce y est vue à zéro, ou à
trois fois sa valeur selon le bruit ». `GpsBench` sait fabriquer ce signal-là.
C'est le prochain banc à monter.

## La contradiction, telle qu'elle a été décrite d'abord

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

## Les seuils doivent suivre le moteur

Idée de David, le 10 septembre 2026 : « les seuils de passage des rapports
doivent dépendre du moteur. On peut dériver les passages des valeurs du rupteur
à mon avis ». Mesuré au banc, elle se vérifie deux fois.

**D'abord l'asymétrie du code.** La descente est déjà exprimée en fraction du
rupteur (`downshiftAtRedlineRatio`) ; la montée, elle, est en tours absolus
(`upshiftRpm`). Ramenés en fraction, les deux profils livrés révèlent deux
philosophies opposées que personne n'a énoncées :

| Passage | Route (rupteur 6 500) | Sport (rupteur 8 500) |
|---|---|---|
| 1→2 | 0,57 | 0,61 |
| 2→3 | 0,52 | 0,66 |
| 3→4 | 0,47 | 0,69 |
| 4→5 | 0,45 | 0,73 |
| 5→6 | 0,45 | 0,77 |

Route monte de plus en plus tôt, Sport de plus en plus tard.

**Ensuite la bibliothèque de moteurs.** Charger un moteur écrit
`engine.redlineRpm` sans toucher aux seuils, et les rupteurs vont de 5 500
(Chevrolet 454) à 11 000 (Hayabusa). Mesuré sur le profil Sport, accélération
franche de 0 à 150 km/h :

| Moteur | Rupteur | Passage 3→4 |
|---|---|---|
| GM LS | 6 500 | 136 km/h |
| Chevrolet 454 | 5 500 | 116 km/h |
| Honda B18C5 | 8 400 | 142 km/h |
| Hayabusa | 11 000 | 144 km/h |

Le Hayabusa passe la quatrième au même endroit que le V8 : il n'exploite pas sa
plage. Le 454 tape son rupteur avant d'avoir le droit de monter — seul le
plafonnement du seuil au rupteur l'empêche de rester coincé. **Changer de moteur
ne change pas la conduite**, alors que c'est l'intérêt d'en avoir neuf.

Conséquence pour la refonte : exprimer les seuils de montée en fraction du
rupteur, comme la descente. Ce serait aussi cinq curseurs de moins par profil,
remplacés par un tempérament.

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
