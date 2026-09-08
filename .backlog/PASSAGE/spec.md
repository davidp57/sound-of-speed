# PASSAGE — un passage de rapport doit s'entendre comme un passage

**Statut :** 🧑 attend David — livré, reste à écouter
**Branche :** `feature/passage-de-rapport`
**Version visée :** 0.3

## D'où vient ce lot

David a signalé le 8 septembre 2026, après avoir regardé la vidéo de
démonstration de [VehicleNoiseSynthesizer](https://github.com/ATG-Simulator/VehicleNoiseSynthesizer) :
« on entend bien le passage des vitesses et il est carrément mieux fait que chez
nous ».

L'étude comparative de trois projets ce jour-là a écarté deux d'entre eux —
[exhaustnotes](https://github.com/sathyaram/exhaustnotes), un catalogue d'écoute
sans licence, et [engine-sound-generator](https://github.com/Antonio-R1/engine-sound-generator),
dont le paramètre de papillon est câblé jusqu'au cœur puis jamais lu. Le
troisième, VNS, fait la même chose que nous — bouclage d'échantillons repitchés,
fondu à puissance constante entre voisins — mais quatre choses de plus au moment
d'un passage. C'est de là que vient ce lot.

## Ce que la mesure a montré

Relevé sur le profil Route, passage de première en seconde à 45 km/h,
accélération constante de 2,2 m/s², un point tous les seize millisecondes.

| | avant | après |
|---|---|---|
| Régime à la fin du passage | 4 289 tr/min, pour 2 803 aux roues | 2 781, pour 2 779 |
| Où tombe la chute de régime | 24 % pendant, 76 % dans les 170 ms d'après | entièrement dans les 133 ms |
| Part d'énergie des couches en charge | 0,926 avant, 0,926 pendant | 0,926 avant, 0,223 au creux |
| Niveau au creux | −3,8 dB | −4,2 dB |

Deux défauts distincts, tous deux mesurés :

1. **L'effort ne bougeait pas d'un millième pendant un passage.** Il se déduit de
   l'accélération, et la voiture ne coupe rien : elle est électrique et continue
   d'avancer pendant que la boîte imaginaire change de rapport. Le fondu vers les
   couches pied levé ne basculait donc jamais, et un passage n'était qu'une
   baisse de niveau sur un timbre identique.

2. **La chute de régime arrivait après le passage.** Le moteur était déclaré
   libre toute la durée de la coupure, donc descendait au frein moteur ; il ne
   rejoignait les roues qu'ensuite, d'un coup, quand le creux de niveau était
   déjà remonté. À l'oreille : un son qui glisse, pas une rupture.

## Ce qui a été fait

- **Coupure de couple** (`feel.shiftJolt.cutDepth`) — l'effort vu par le
  **mixage** tombe le temps du passage, en sinus, comme le creux de niveau. Posé
  dans `core/audio/mix.ts` et nulle part ailleurs : c'est une règle de mixage, et
  l'invariant du dépôt veut qu'elles y soient toutes. L'effort vrai n'est pas
  touché — le régime, la boîte et la télémétrie continuent de le voir entier.
- **Engagement de l'embrayage** (`core/engine/engine.ts`) — la progression du
  passage est transmise au moteur, qui ramène le régime vers celui du nouveau
  rapport à mesure que l'embrayage se referme. Sans progression, le comportement
  d'avant est conservé exactement.
- **Claquement de reprise** (`feel.shiftJolt.crackle`) — une seule détonation au
  front descendant du passage, avec la pétarade déjà synthétisée pour le lever de
  pied.

- **Plongée du régime** (`feel.shiftJolt.dipRpm`) — le moteur tombe sous le
  rapport visé pendant la coupure, et le réengagement l'y ramène. Négatif, il
  donne un coup de gaz au lieu d'un creux.

Les trois valeurs livrées — 0,8, 300 tr/min et 0,5 — sont des estimations, et se
coupent à zéro. L'engagement de l'embrayage n'a pas d'interrupteur : ce n'est pas
un effet mais la correction d'un défaut de synchronisation.

## Deuxième écoute, 8 septembre 2026

David : « on entend un tout petit claquement, c'est tout. Pour le couple, j'ai
pas l'impression que ça ait changé quoi que ce soit. » Et, en réécoutant la
vidéo de VNS : « au passage, on entend le moteur diminuer, remonter et ensuite
repartir de là où il était quand il a diminué — si j'étais pilote je dirais que
c'est un double embrayage. »

Deux mesures ont suivi, et elles ont réorienté le lot.

**VNS ne produit pas ce mouvement.** Son `OnGearShift()` ne déclenche que le clip
d'échappement ; `shiftPitchOsc`, la seule chose qui pourrait faire bouger la
hauteur, vaut zéro par défaut et rien dans VNS ne l'anime ; `autoBlip` ne touche
pas au régime, il force le mélange quand il **détecte** un saut. Ce que David
entend vient donc du modèle de transmission du jeu, pas de l'outil audio : c'est
un comportement de régime à produire dans `engine.ts`, et il n'y a plus rien à
chercher dans VNS.

**La banque n'est pas en cause.** Spectre des quatre couches de `procar`, par
bandes d'octave, normalisé au maximum de chacune : l'écart quadratique entre
en charge et pied levé vaut 6,0 dB en bas et 4,4 dB en haut — jusqu'à 13,4 dB
sur la bande de 63 Hz. Les deux familles sonnent vraiment différemment, la
bascule devait donc s'entendre.

**Ce qui l'annulait : le creux de niveau.** L'instant où le timbre bascule est
celui où le son est le plus faible. Le creux est passé de 0,55 à 0,15, soit de
−4,2 à −1,9 dB.

## Ce qui n'est pas fait

- **La remorsure à la reprise** (l'`autoBlip` de VNS : forcer brièvement le
  mélange vers « en charge » quand le couple revient). Écarté tant que la
  coupure n'a pas été jugée à l'oreille — elle suffit peut-être.
- **Le rétrogradage** n'a pas été mesuré séparément. La mécanique est la même et
  devrait valoir dans les deux sens, mais ce n'est pas vérifié.

## Ce qui reste à vérifier

**Rien de tout cela n'a été écouté.** Les mesures établissent que le timbre
bascule, que le régime atterrit juste et que le niveau creuse. Pas que cela sonne
mieux. C'est à David de trancher, en roulant ou au simulateur.

## Troisième écoute, 8 septembre 2026

David : « non c'est toujours pas ça. Mieux mais vraiment pas au niveau attendu.
Je suis déçu. » Et la liste de ce qui manquait : un claquement mécanique fort,
un coup de gaz franc, du caractère mécanique. Avec la séquence complète : « accél,
montée de régime ; passage au neutre, descente rapide ; coup de gaz, montée
rapide très courte ; passage du rapport, clac ; lâché de l'embrayage, reprise du
couple, descente rapide au rpm des roues puis réaccél. »

**La cause de fond était la durée.** Un passage durait 120 ms. Aucune séquence en
cinq temps ne tient dans un dixième de seconde : les phases se chevauchaient, et
tout ce qu'on ajoutait restait inaudible. `shiftTimeMs` est passé à 390 ms sur
Route et 300 sur Sport.

Ce qui a été ajouté ensuite : la trajectoire en cinq temps dans `engine.ts`, le
coup de gaz (`blipRpm`), et un **clac mécanique** distinct de la pétarade
(`clack`), synthétisé dans `audio/engine.ts` avec une attaque de une milliseconde
et deux composantes, claire et mate.

Relevé sur Route, première en seconde : 4 692 → 2 337 (fond) → 3 364 (sommet) →
clac → 2 910 pour 2 907 aux roues → réaccélération. Durée totale 390 ms.

**Non écouté.** Et les profils déjà enregistrés gardent leurs anciennes valeurs,
temps de passage compris.

## Quatrième écoute, 8 septembre 2026

David : « c'est trop court ; dans la vidéo ça dure au moins 500 ms, voire plus.
Et dans ton code, j'ai beau mettre au max je n'entends aucun claquement de
boîte. Ça devrait être flagrant, c'est un bruit sec dans un bruit de moteur
gras. »

Deux causes, toutes deux mesurées.

**La durée.** 390 ms restait court, et le curseur était plafonné à 500 ms — il
ne pouvait donc pas aller au-delà même en le voulant. Passé à 600 ms sur Route,
480 sur Sport, plafond du curseur à 1 500.

**Le niveau du clac.** Reproduction des filtres de Web Audio en Node, comparaison
aux crêtes du moteur au niveau où il arrive sur le bus :

| Réglage | Crête du clac, face au moteur |
|---|---|
| 0,60 (livré) | −15,6 dB |
| 1,50 (maximum) | −8,0 dB |

Le clac n'était donc pas mal déclenché : il était noyé, et le maximum du curseur
ne rattrapait pas. Trois causes cumulées — passe-bande étroit qui jette
l'essentiel de l'énergie, gain appliqué après cette perte, queue de 30 ms qui
étale au lieu de crêter. Trois composantes le remplacent (corps, métal, masse) :
**+4,2 dB** au-dessus des crêtes du moteur au réglage livré.

Un compteur « Clacs de boîte » est ajouté en télémétrie pour distinguer, sans
avoir à ouvrir la console, un défaut de déclenchement d'un défaut de niveau.

**Non écouté.**

## Cinquième écoute, 8 septembre 2026

David : « toujours pas de claquement, mais le compteur monte — c'est un souci de
son. En réglant à 600 ms j'ai le temps de tout entendre, sauf le claquement. »

Le compteur posé au tour précédent a fait son travail : il a écarté le
déclenchement en un mot, là où trois échanges n'y avaient pas suffi.

**La cause est le saturateur.** Sa courbe est indexée sur [-1, 1] et Web Audio
prend la valeur du bord au-delà. Le moteur crête à 1,74 sur le bus : il sature
donc en permanence, et tout ce qui entre au-dessus de lui en sort au même
niveau. Mesuré sur la courbe du profil Route (`drive` 0,12) :

| Entrée sur le bus | Sortie du saturateur | Écart au moteur |
|---|---|---|
| moteur, crête 1,74 | 1,0000 | 0,00 dB |
| clac à 0,6 (4,2 dB au-dessus) | 1,0000 | 0,00 dB |
| clac à 1,5, le maximum | 1,0000 | 0,00 dB |
| clac dix fois trop fort | 1,0000 | 0,00 dB |

Aucun réglage ne pouvait le rendre audible. Cela explique aussi pourquoi la
pétarade s'entendait « toute petite » depuis le début.

Les deux événements brefs sont injectés après le saturateur, sur le limiteur.
Ajout d'un bouton « Écouter le clac » dans la configuration, puisqu'un événement
d'un centième de seconde ne se règle pas en attendant un passage de rapport.

**Non écouté.**

## Sixième écoute, 8 septembre 2026

David : « j'entends le clac en cliquant sur le bouton, mais pas en passant les
vitesses ». Le bouton se presse à l'arrêt, moteur au ralenti ; le passage a lieu
moteur fort. Deux causes se sont ajoutées à celle du saturateur.

**Le limiteur.** Il n'écrête pas un transitoire, il applique au signal entier la
réduction que le moteur lui impose. Les événements sont donc injectés sur le
gain de rattrapage, après lui.

**Et une mesure fausse de ma part.** J'avais conclu que le clac passait 4,2 dB
au-dessus du moteur en comparant des **crêtes**. Une crête n'est pas un niveau :
repris par bandes d'octave, l'écart réel était de 24 à 40 dB en dessous.

| | 500 Hz | 1 k | 2 k | 4 k | 8 k | crête |
|---|---|---|---|---|---|---|
| avant | −42,7 | −37,7 | −28,6 | −23,4 | −15,2 | 2,1 |
| après | −8,4 | +2,0 | +10,5 | +14,3 | +22,9 | 7,8 |

La cause était l'enveloppe : une rampe exponentielle vers un millième descend en
quelques millisecondes, si bien que toute l'énergie tient dans la crête.
Remplacée par une extinction à constante de temps, gains triplés.

**Non écouté.** La crête du clac monte à 7,8 avant la chaîne ; le moniteur de
sortie dira s'il écrête.

## Septième écoute, 8 septembre 2026

David : « je l'entends (trop fort même) ; à 0,05 c'est encore un peu trop fort.
Je pense que c'est le son qui est surtout trop sec, aigu et court ; dans la
vidéo c'est un son un peu plus long et surtout plus sourd. »

La correction de niveau avait surcompensé, et surtout placé l'énergie au mauvais
endroit. Mesuré au réglage 0,05 — celui qu'il jugeait déjà trop fort — l'ancien
clac culminait à −4 dB du moteur à 8 kHz et +13 dB à 16 kHz : tout son niveau
était dans l'aigu, d'où le « sec ».

Nouvelles composantes, en écart au moteur au réglage livré (0,5) :

| | 125 Hz | 250 | 500 | 1 k | 2 k | 8 k |
|---|---|---|---|---|---|---|
| aigu (jeté) | +5,6 | +2,1 | −11,4 | −5,1 | +4,7 | +17,8 |
| sourd (livré) | −5,7 | −10,7 | −15,3 | −17,5 | −16,4 | −16,2 |

Le maximum passe de l'aigu au grave, et les extinctions de 24-90 ms à 50-120 ms.
La crête tombe de 7,9 à 0,31 : plus de risque d'écrêtage.

**Non écouté.**
