# MOUVEMENT — une seule notion de « est-ce qu'on ralentit ? »

**Statut :** 🧑 attend David — la cause première est traitée ailleurs, ce lot
attend une écoute en roulant sur une accélération juste
**Branche :** à ouvrir après l'écoute
**Version visée :** à décider

## Ce qui a déclenché

Un essai en voiture, rapporté par David le 10 septembre 2026. Le son du passage
de rapport tient — « pas mal, perfectible mais ok » — mais le passage lui-même
s'est dégradé :

> le passage en lui-même a été dégradé par cette fonctionnalité (reste parfois
> en 3ème jusque 150, parfois monte en 6 puis redescend tout seul alors que je
> ralentis)

## Deux diagnostics démentis, puis la cause

Ce lot a d'abord accusé deux choses, et s'est trompé deux fois. C'est écrit ici
parce que la trace de l'erreur vaut mieux que sa disparition.

**Premier diagnostic : une accélération bruitée par le GPS.** Écarté par David
— il avait éprouvé le lot PENTE en roulant et l'avait jugé bon — et la datation
des commits lui donnait raison sur un point : le défaut est apparu le
8 septembre, après PENTE.

**Deuxième diagnostic : deux compteurs de ralentissement aux seuils
contradictoires.** La bande de croisière tient l'allure pour stable jusqu'à
−0,1 m/s² quand le compteur `slowing`, ajouté le 8 septembre, déclare le
ralentissement dès −0,05. Démenti par un banc de quatorze scénarios : dix
ralentissements de 0,2 à 2 km/h par seconde n'ont produit **aucune** montée
parasite, et la 3ᵉ tenue à 143 km/h se reproduit sans qu'aucun garde-fou
intervienne — c'est le réglage du profil Sport.

**La cause réelle** est dans le lot [HORODATAGE](../HORODATAGE/spec.md), trouvée
le 10 septembre en rapatriant le journal : le navigateur de la Tesla horodate en
microsecondes, l'accélération sortait mille fois trop petite, et **`slowing` ne
pouvait jamais s'allumer** — il exige moins de −0,05 m/s² et recevait des
millièmes. La contradiction de seuils est donc réelle mais **latente** : elle
n'a pas pu produire ce que David a entendu.

Ce que le journal montre, en revanche, s'explique entièrement par la mesure :
quatre montées de rapport pendant que la vitesse baisse, dont un 3ᵉ → 5ᵉ à
64 km/h, parce que la croisière se croyait éternelle.

Le symptôme A — la 3ᵉ jusqu'à 150 — **reste sans cause établie**. Le régime le
plus haut de tout l'essai est 5 586 tr/min, et aucun épisode de rapport bas à
haute vitesse n'apparaît dans les seize tranches. Soit il est hors de cette
plage, soit un relevé toutes les dix secondes l'a manqué.

## Ce qui reste à faire ici

### Une seule notion de l'état du mouvement

Le défaut de conception tient, même s'il n'était pas le coupable : quatre
mécanismes décrivent le même fait — `inBand`, `slowing`, `slowingForS`,
`braking`, `CLEARLY_SLOWING_MS2` — avec des seuils qui ne s'accordent pas. Une
seule lecture, calculée à un endroit, avec une hystérésis explicite, remplace
tout cela. Monter un seuil déplacerait la contradiction sans la lever.

FIX-BOITE avait déjà conclu « **un compteur, un usage** » : sa troisième
oscillation venait d'un compteur à deux sens. La même erreur est revenue deux
jours plus tard sous une autre forme.

### Les seuils doivent suivre le moteur

Idée de David : « les seuils de passage des rapports doivent dépendre du
moteur. On peut dériver les passages des valeurs du rupteur à mon avis ».
Mesurée au banc, elle se vérifie deux fois.

**L'asymétrie du code.** La descente est déjà exprimée en fraction du rupteur
(`downshiftAtRedlineRatio`) ; la montée est en tours absolus (`upshiftRpm`).
Ramenés en fraction, les deux profils livrés révèlent deux philosophies
opposées que personne n'a énoncées :

| Passage | Route (rupteur 6 500) | Sport (rupteur 8 500) |
|---|---|---|
| 1→2 | 0,57 | 0,61 |
| 2→3 | 0,52 | 0,66 |
| 3→4 | 0,47 | 0,69 |
| 4→5 | 0,45 | 0,73 |
| 5→6 | 0,45 | 0,77 |

Route monte de plus en plus tôt, Sport de plus en plus tard.

**La bibliothèque de moteurs.** Charger un moteur écrit `engine.redlineRpm` sans
toucher aux seuils, et les rupteurs vont de 5 500 (Chevrolet 454) à 11 000
(Hayabusa). Mesuré sur le profil Sport, accélération franche de 0 à 150 km/h :

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

Exprimer les seuils de montée en fraction du rupteur, c'est aussi cinq curseurs
de moins par profil, remplacés par un tempérament. Le lot
[REFONTE](../REFONTE/spec.md) va plus loin : la boîte entière devient une
conséquence du moteur et du mode.

## Ce qui reste à décider

- **Le réglage n'est pas à jeter, mais à réévaluer.** Quatorze écoutes ont réglé
  cette boîte sur une accélération morte. Une fois la mesure juste, il faut
  réécouter avant de retoucher quoi que ce soit — et une partie des garde-fous
  n'aura peut-être plus de raison d'être.
- **Une bascule par garde-fou**, idée de David, pour isoler en roulant lequel
  dérape : « au besoin on pourra refaire des tests avec la nouvelle app […]
  genre, avec un toggle pour activer/désactiver le comportement ».
- **Le symptôme A**, sans cause. Un journal plus fin — un relevé plus fréquent,
  ou un relevé déclenché par un passage de rapport — le montrerait.

## Hors périmètre

Le réglage fin des seuils à l'oreille tant que la mesure n'a pas été entendue
juste. Et le son du passage, que David juge correct.
