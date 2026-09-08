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

Les deux valeurs livrées — 0,8 et 0,25 — sont des estimations, et se coupent à
zéro. L'engagement de l'embrayage n'a pas d'interrupteur : ce n'est pas un effet
mais la correction d'un défaut de synchronisation.

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
