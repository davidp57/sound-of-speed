# BOITE-VIVANTE — une boîte qui regarde la vitesse, pas seulement le régime

**Statut :** 🧑 attend David
**Branche :** `feature/boite-comportement`
**Version visée :** 0.2

## Le problème

Trois reproches relevés en roulant, et une seule cause : **la boîte ne voit que
le régime**. Elle reçoit le régime dans chaque rapport, la charge et la vitesse ;
elle ne sait rien de la façon dont la vitesse **évolue**. Or c'est cela qu'un
conducteur perçoit, et c'est là-dessus qu'une vraie boîte décide.

### Le rétrogradage forcé se déclenche pour rien

Mesuré : il part dès **1,00 m/s² sur Route**, soit **3,6 km/h par seconde** —
exactement « remettre délicatement les gaz ». Et il se réarme dès que la charge
retombe sous 0,10 m/s², c'est-à-dire au moindre lever de pied. En conduite
ordinaire il tire donc en permanence. Sur Sport : 1,25 m/s².

La cause est de fond : en conduite réelle il n'y a pas de pédale, la charge est
**déduite de l'accélération**. « Charge ≥ 0,75 » ne dit donc pas « on demande
fort », mais « on accélère un peu ». C'est un résultat, pas une demande.

### À vitesse tenue, la boîte reste figée

La montée est un événement déclenché par le régime. Sur un palier le régime ne
monte plus, donc rien ne se produit — le rapport reste celui où l'on était.
Mesuré sur Route, après une montée douce jusqu'à la vitesse indiquée :

| Vitesse tenue | Rapport engagé | Ce que donneraient les rapports au-dessus |
|---|---|---|
| 30 km/h | **2e à 1820 tr/min** | 3e : 1213 · 4e : 919 · 5e : 767 · 6e : 642 |
| 50 km/h | **2e à 3034 tr/min** | 3e : 2022 · 4e : 1532 · 5e : 1279 · 6e : 1071 |
| 70 km/h | 3e à 2831 tr/min | 4e : 2144 · 5e : 1790 · 6e : 1499 |
| 90 km/h | 4e à 2757 tr/min | 5e : 2302 · 6e : 1927 |

Sur Sport, 70 km/h tenus laissent la **2e à 5165 tr/min** quand la 6e donnerait
1823. Le README annonce « la sixième engagée en conduite douce à 98 km/h » :
c'est vrai en accélération continue, faux dès qu'on tient une vitesse.

### Le rétrogradage ne sait pas qu'on ralentit

Un seul seuil de régime, le même qu'on lève le pied doucement ou qu'on freine
fort : sous 1820 tr/min sur Route, soit 0,28 du rupteur. Les descentes tombent
donc toujours aux mêmes vitesses — 85, 71, 59 et 45 km/h — quoi qu'on fasse. Le
rétrogradage ne sert alors jamais à **ralentir**, ce qui est la moitié de son
métier.

## La solution

Donner à la boîte l'accélération, et trois règles qui s'en servent : une demande
franche pour le rétrogradage forcé, une montée quand la vitesse se stabilise, une
descente quand on ralentit vraiment.

Puis **remettre les profils d'aplomb**, ce qui est deux choses : les deux
profils livrés, à qui les trois valeurs nouvelles manquent ; et le **guide
de création**, qui fabrique des profils et doit donc produire les réglages
nouveaux avec le même soin que les anciens. Un guide qui laisserait ces trois
valeurs à leur défaut donnerait des boîtes au caractère plat, quel que soit le
tempérament demandé.

## Histoires

1. En tant que conducteur, je veux que la boîte descende chercher du couple
   quand j'écrase, et pas quand je remets doucement les gaz.
2. En tant que conducteur, je veux qu'elle monte un rapport quand je tiens une
   vitesse, comme une vraie boîte automatique, pour ne pas rouler à 3000 tours à
   50 km/h.
3. En tant que conducteur, je veux qu'une reprise après une croisière stabilisée
   déclenche un rétrogradage franc — c'est là que ça a du sens, et c'est ce que
   la montée en croisière rend possible.
4. En tant que conducteur, je veux qu'elle descende pour m'aider à ralentir dès
   que je freine, et non seulement quand le régime est tombé trop bas.
5. En tant que David, je veux que les deux profils livrés restent cohérents
   après tout ça : chaque rapport à sa place, aucun régime absurde à une vitesse
   ordinaire.
6. En tant qu'utilisateur du guide, je veux qu'un profil « calme » croise bas et
   monte tôt, et qu'un profil « sportif » garde ses rapports et descende franc
   au freinage — donc que le guide règle aussi les trois valeurs nouvelles.
7. En tant qu'utilisateur du guide, je veux que l'aperçu me dise à quel régime
   je croiserai, puisque c'est désormais ce qu'on entendra le plus souvent.

## Décisions d'implémentation

- **Un objet d'entrée pour la boîte.** Les trois règles demandent
  l'accélération ; un sixième paramètre positionnel rendrait l'appel illisible.
  Le moteur a déjà un `EngineInput` : la boîte aura un `GearboxInput`. C'est une
  entorse au mode chirurgical, assumée pour cette raison et faite d'abord, sans
  aucun changement de comportement, pour que les tickets suivants se lisent.
- **Rétrogradage forcé : la montée de charge, pas son niveau.** Le seuil de
  niveau du profil est **conservé** (0,75) ; ce qui fait le tri, c'est que la
  charge ait **gagné au moins 0,35 en une seconde et demie**. Monter les deux
  rendrait le rétrogradage presque inatteignable sur un signal déjà lissé d'une
  seconde. Trois secondes minimum entre deux déclenchements.
  La fenêtre d'une seconde et demie n'est pas un choix esthétique : la pente est
  estimée sur une seconde, une détection plus courte lirait du bruit. Corollaire
  assumé : la détection est **un peu en retard** sur le pied. C'est le prix de
  l'absence de pédale.
  La comparaison se fait à la mesure **la plus récente qui soit assez ancienne**,
  et non à la plus ancienne de l'historique — l'erreur exacte que le lot
  FIX-CORE vient de corriger dans le conditionnement. On ne la refait pas.
- **Montée en croisière : un plancher, en tours par minute.** Quand
  l'accélération reste sous 0,3 m/s² pendant 2,5 s, tenter un rapport de plus, un
  seul à la fois, à condition que le rapport visé tourne encore au-dessus d'un
  **régime de croisière minimal**. En tours par minute et non en fraction du
  rupteur : c'est une limite mécanique — le broutement — pas un rapport.
- **Une interaction à traiter en même temps, sinon la boîte fait le yoyo.** La
  4e à 50 km/h donne 1532 tr/min, **sous le seuil de descente de 1820** : la
  règle actuelle la ferait redescendre aussitôt. La descente au régime plancher
  est donc **suspendue pendant une croisière stable**. C'est cohérent : cette
  règle existe pour éviter de brouter, et le plancher de croisière garantit
  précisément qu'on ne broute pas. Le ralentissement est couvert par sa propre
  règle.
- **Descente au ralentissement.** Quand l'accélération reste sous −0,8 m/s²
  pendant une seconde, descendre d'un rapport tant que le rapport visé reste
  sous 0,85 du rupteur, et recommencer à mesure que la vitesse tombe — comme une
  vraie boîte sous freinage.
- **Trois réglages exposés, pas huit.** Le profil compte déjà trente-cinq
  paramètres. N'apparaissent à l'écran que ceux qui changent le caractère :
  **régime de croisière minimal**, **délai avant montée en croisière**, **seuil
  de freinage**. Les autres valeurs restent des constantes commentées dans le
  code, comme la marge de dépassement de 400 tr/min l'est déjà.
- **Pas de montée de version du format de profil.** Les champs nouveaux sont
  complétés par les valeurs d'usine à la relecture, et un test tient déjà cette
  garantie.

## Décisions de test

Tout se teste sans navigateur : la boîte est une pièce de `core/` qui ne connaît
que des nombres, et le banc de `gearbox.test.ts` sait déjà la faire rouler sur
un profil de vitesse en relevant chaque passage.

Ce qui doit être couvert, et qui ne l'était pas :

- une reprise **douce** ne déclenche pas de rétrogradage forcé, une reprise
  **franche** oui — c'est le cœur du premier reproche, et c'est une assertion
  sur deux trajectoires, pas sur un seuil ;
- une vitesse tenue fait monter les rapports, s'arrête au plancher de croisière,
  et **ne redescend pas** ensuite — le yoyo est le risque principal de ce lot ;
- un freinage soutenu fait descendre plus tôt qu'un lever de pied ;
- les deux profils livrés n'affichent aucun régime absurde aux vitesses
  ordinaires, ce qui se vérifie par un tableau et non à l'oreille.

Ce qui ne se teste pas : que ça sonne juste. Le lot finira à 🧑.

## Hors périmètre

- Le réglage fin des profils **à l'oreille**. Les tickets 05 et 06 les rendent
  cohérents par le calcul — chaque rapport à sa place, aucun régime absurde.
  Ce qui relève du goût viendra après, en roulant.
- Toute intervention sur le moteur, le conditionnement ou l'audio.
- Le rétrogradage forcé au simulateur, où la pédale est connue et fait foi : la
  règle de montée de charge s'y applique telle quelle, sans traitement
  particulier.

## Ce que le lot a donné

Les six tickets sont livrés, 251 tests passent. Le tableau de croisière, mesuré
sur les deux profils remis d'aplomb :

| Vitesse tenue | Route (plancher 1500) | Sport (plancher 2000) |
|---|---|---|
| 30 km/h | 2<sup>e</sup> à 1820 tr/min | 2<sup>e</sup> à 2214 tr/min |
| 50 km/h | 4<sup>e</sup> à 1532 | 3<sup>e</sup> à 2460 |
| 70 km/h | 5<sup>e</sup> à 1790 | 5<sup>e</sup> à 2178 |
| 90 km/h | 6<sup>e</sup> à 1927 | 6<sup>e</sup> à 2344 |
| 110 km/h | 6<sup>e</sup> à 2355 | 6<sup>e</sup> à 2865 |
| 130 km/h | 6<sup>e</sup> à 2784 | 6<sup>e</sup> à 3386 |

À comparer au tableau du haut de cette page : 50 km/h tenus laissaient la
deuxième à 3034 tr/min sur Route, et à 3690 sur Sport. Quatre tests tiennent
désormais ce tableau — rien au-dessus de 2500 tr/min sur Route sous 130 km/h,
rien sous le plancher, la sixième dès 90 km/h sur Route, et Sport plus haut que
Route aux six vitesses.

Un défaut de conception trouvé en cours de route, et c'est le plus intéressant du
lot : **confondre « la vitesse est stable » et « elle l'est depuis assez
longtemps » suffit à faire le yoyo**. Remettre à zéro le compteur de stabilité à
chaque montée réarmait la descente au régime dans la seconde — le rapport
atteint tournant précisément sous ce seuil — et la boîte oscillait indéfiniment,
cinquante-deux passages en quatre-vingt-dix secondes. Les deux notions sont
maintenant distinctes, et un test de deux minutes de croisière tient la
correction.

Une trace de l'erreur corrigée par le lot FIX-CORE traînait encore dans
l'infobulle de « Ne jamais monter sous », qui répétait qu'il commande le
rétrogradage. Corrigée aussi.

## Notes

Les chiffres cités ont été mesurés sur le banc de la boîte avant d'écrire une
ligne, profil par profil. Ils sont la raison de chaque valeur proposée.
