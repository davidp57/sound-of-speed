# MOUVEMENT — une seule notion de « est-ce qu'on ralentit ? »

**Statut :** 🔄 en cours — 1/4, le relevé de référence est fait
**Branche :** `feature/mouvement`, à ouvrir
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

## L'écoute du 10 septembre au soir

Elle a eu lieu : trajet de 36 minutes, journal `2026-09-10-17-07-47_2geq`, huit
tranches, profil Route sur le V8 — rupteur 6 500, six rapports. L'accélération
était juste, le correctif d'horodatage étant en place. Quatre retours de David,
et ce que le journal en dit.

**Les rapports passent trop haut.** Régime maximum atteint dans chaque rapport,
contre le seuil que le mode Route lui donne :

| Rapport | Seuil Route | Seuil à pleine charge | Observé |
|---|---|---|---|
| 1ʳᵉ | 3 700 | 4 500 | 6 122 |
| 2ᵉ | 3 350 | 4 150 | 3 800 |
| 4ᵉ | 2 950 | 3 750 | 3 675 |
| 5ᵉ | 2 950 | 3 750 | 4 007 |

Les 1 600 tr/min d'excès en première n'ont pas de cause établie : deux candidats
— le régime inscrit serait celui du moteur pendant un passage, l'embrayage étant
ouvert 600 ms, ou la montée serait inhibée par `slowing` sur une accélération
bruitée. Le journal ne permet pas de trancher, faute d'inscrire le rapport
ailleurs qu'au relevé de dix secondes.

**Dix-neuf alternances A-B-A** malgré cette résolution de dix secondes, donc une
borne basse. Elles se séparent nettement par la charge :

- **sept** à charge 0,78 à 1,00, entre 116 et 148 km/h, en 6ᵉ→5ᵉ→6ᵉ et un
  6ᵉ→4ᵉ→6ᵉ : ce sont des rétrogradages forcés ;
- **douze** à charge 0,22 à 0,59, entre 40 et 72 km/h.

**Une contradiction de seuils, mesurée.** `cruiseMinRpm` vaut 1 500 sur ce
profil, et le seuil de descente au régime vaut 6 500 × 0,28 = 1 820. Chaque
rapport a donc une plage où la montée en croisière l'autorise et où la descente
au régime le refuse : 70,0 à 85,0 km/h en 6ᵉ, 58,6 à 71,2 en 5ᵉ, 49,0 à 59,4 en
4ᵉ, 37,1 à 45,0 en 3ᵉ. Les alternances 5ᵉ↔6ᵉ observées sont à 71,9 et 72,0 km/h,
les 2ᵉ↔4ᵉ à 48,9, 50 et 52. C'est cohérent avec cette plage, sans la prouver :
il faudrait le rapport en continu. C'est une **cinquième** notion du mouvement en
désaccord avec les autres, et elle relève du même défaut de conception.

**Le symptôme A ne s'est pas reproduit.** Aucun rapport bas à haute vitesse :
entre 145 et 153 km/h, la 6ᵉ est engagée sur tous les relevés. Il reste sans
cause, mais il n'est plus le seul défaut sans témoin.

**Ce que l'écoute a produit ailleurs.** David a énoncé le même soir une règle de
passage qui remplace les fractions du rupteur : on peut monter dès que le rapport
visé tournerait au-dessus du ralenti plus une marge, marge réglée par le mode et
par la charge ; on ne redescend qu'en ralentissant ou sur rétrogradage forcé.
Elle rend la contradiction ci-dessus impossible par construction — un seul
plancher gouverne les deux sens. Elle appartient à un lot à écrire, pas à
celui-ci : ici, on unifie la notion de mouvement sur laquelle elle s'appuiera.

## Ce qui reste à faire ici

### Une seule notion de l'état du mouvement

Le défaut de conception tient, même s'il n'était pas le coupable. **La liste a
changé depuis que cette spécification a été écrite, le décompte non** : PLANCHER
a emporté la bande de croisière et la montée en croisière — donc `inBand` et sa
contradiction avec `slowing` —, et deux autres lectures se sont révélées en
relisant le code le 15 septembre 2026. Cinq lectures de « est-ce qu'on
ralentit ? » cohabitent aujourd'hui dans `core/drivetrain/gearbox.ts` :

| Lecture | Ce qu'elle regarde | Forme |
|---|---|---|
| `braking` | `accelMs2 ≤ brakeDownshiftAccelMs2` (−0,7 en Route) tenu 1 s | seuil + maintien |
| `slowing` | `accelMs2 < −0,05` cumulé jusqu'à 0,35 s, plafonné à 1,05 s | seuil + compteur à deux vitesses |
| `CLEARLY_SLOWING_MS2` | `accelMs2 ≤ −0,5` | raccourci immédiat du précédent |
| `downshiftFloorRpm` | `−accelMs2 / 2`, borné à 1 | rampe continue, sans seuil ni hystérésis |
| `overshot` | `accelMs2 ≥ 0` | seuil nu, sans maintien |

Cinq seuils qui ne s'accordent pas — −0,7, −0,05, −0,5, une rampe, et zéro — et
trois formes différentes de mémoire : un maintien, un compteur asymétrique, et
rien. Une seule lecture, calculée à un endroit, avec une hystérésis explicite,
remplace tout cela. Monter un seuil déplacerait la contradiction sans la lever.

FIX-BOITE avait déjà conclu « **un compteur, un usage** » : sa troisième
oscillation venait d'un compteur à deux sens. La même erreur est revenue deux
jours plus tard sous une autre forme.

### Le relevé de référence, mesuré le 15 septembre 2026

Ticket 01 livré : `core/drivetrain/gearbox-gps.test.ts` fait entrer des positions
fabriquées dans la vraie source de géolocalisation, les fait traverser le
conditionneur, le moteur et la boîte, et relève les passages. La charge s'y
déduit de l'accélération mesurée, comme en voiture — le banc ne dit jamais ce que
fait le pied. Profil Route sur le V8, dispersion du seuil de montée à zéro,
croisière de deux minutes après quarante secondes d'établissement.

**Sur un signal réaliste, la boîte ne fait plus d'aller-retour.** Ni à 50, 60,
72, 85 ou 110 km/h tenus, ni en décélération — pied levé comme frein appuyé, elle
descend rapport par rapport sans jamais remonter. Ce que David a entendu le
10 septembre ne se reproduit pas : PLANCHER l'a emporté, et l'écoute du
11 septembre au soir le disait déjà.

**Ce qui se mesure, c'est donc la marge avant que ça recommence**, et elle est
mince. Nombre de passages pendant deux minutes de croisière, par bruit de mesure
et par cadence, sur les cinq vitesses tenues :

| Bruit (km/h) | 30 ms | 100 ms — la voiture | 1 000 ms |
|---|---|---|---|
| 1,00 | 0 | 0 | 0 |
| 1,25 | 0 | 0 | 10 |
| 1,50 | 0 | 5 | 14 |
| 1,75 | 0 | 17 | 34 |
| 2,00 | 0 | 22 | 36 |
| 3,00 | 23 | 24 | 111 |

Trois choses s'y lisent :

- **La marge est d'un quart de bruit** à la cadence de la voiture : ça tient à
  1,25 km/h et ça décroche à 1,5. C'est le chiffre que l'unification doit
  augmenter.
- **La cadence pèse autant que le bruit.** À 1,25 km/h, un récepteur à 30 ms ne
  bronche pas et un récepteur à la seconde a déjà décroché : moins de points sous
  la fenêtre, c'est une pente moins moyennée, donc une accélération plus bruitée
  à bruit de mesure égal.
- **50 km/h est la vitesse la plus fragile** des cinq, et décroche la première
  dans les trois cadences. 72 km/h — la plage que David a entendue — vient
  ensuite.

**Ce que ce relevé ne dit pas, et qui manque pour conclure : le bruit réel du
récepteur de la voiture.** Il n'a jamais été relevé. Il se calcule pourtant sur
chaque trajet — `core/calibration/measure.ts`, champ `noiseKmh` — et il vit dans
le profil mesuré, sur le serveur. **Blocage non bloquant** : le travail continue
sans lui, mais tant qu'il n'est pas lu, ce banc dit une marge et non un verdict.
Si le récepteur de la voiture est au-dessus de 1,25 km/h, le défaut n'a jamais
été corrigé — seulement déplacé hors de portée de l'écoute du 11 septembre.

### Les seuils qui suivent le moteur : livré

Cette moitié du lot est faite. Les seuils de montée s'expriment en fraction du
rupteur, un mode de conduite les module, et cinq curseurs ont quitté l'écran :
commit `17e664d`, ticket
[REFONTE/02](../REFONTE/tickets/02-la-boite-se-deduit-du-moteur-et-du-mode.md),
qui porte les mesures au banc sur les quatre moteurs.

L'écoute en roulant du 10 septembre au soir en donne le verdict, plus haut : la
conduite est proportionnée au moteur, mais les régimes de passage sont trop
hauts en mode Route. Le réglage ne se corrige pas ici — la règle qui le remplace
appartient au lot à écrire.

## Ce qui reste à décider

- **La réévaluation est faite.** Quatorze écoutes avaient réglé cette boîte sur
  une accélération morte ; l'écoute du 10 septembre au soir s'est faite sur une
  mesure juste, et elle conclut que les seuils sont trop hauts. Reste à décider
  lesquels des garde-fous survivent à la règle qui les remplace — le rétrogradage
  au freinage et le tirage au sort du seuil sont les deux à examiner.
- **Une bascule par garde-fou**, idée de David, pour isoler en roulant lequel
  dérape : « au besoin on pourra refaire des tests avec la nouvelle app […]
  genre, avec un toggle pour activer/désactiver le comportement ».
- **Le symptôme A**, sans cause. Un journal plus fin — un relevé plus fréquent,
  ou un relevé déclenché par un passage de rapport — le montrerait.

## Hors périmètre

Le réglage des seuils de passage et du rétrogradage forcé : la règle qui les
gouverne a changé le 10 septembre au soir, et elle fait l'objet d'un lot à part.
Ici on unifie la notion de mouvement dont cette règle se sert. Et le son du
passage, que David juge correct.
