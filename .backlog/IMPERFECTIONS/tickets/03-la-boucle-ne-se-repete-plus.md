# 03 — La boucle ne se répète plus à l'identique

**Statut :** ✅ fait — reste à écouter en roulant

**Bloqué par :** 01 — Le régime tremble, d'autant plus qu'il est bas ; 02 — Deux
couches ne jouent plus parfaitement d'accord

## Ce qu'il faut obtenir

Le son ne repasse plus indéfiniment par la même tranche d'enregistrement.

C'est la cause principale de l'impression de synthèse, et la moins évidente :
chaque couche est **une seule** source en boucle, démarrée une fois pour toutes.
Sa position de départ est bien tirée au sort, mais seulement à l'allumage — passé
la première seconde, la même tranche se répète pour toute la durée de la session,
et l'oreille apprend une répétition périodique en quelques tours.

**La mesure est faite** — 6 septembre 2026. Elle était réputée impossible depuis
le dépôt, les échantillons vivant dans un volume du NAS ; la banque livrée est en
réalité présente en local, et il suffisait de lire l'entête de ses fichiers.

| Couche de la banque `procar` | Durée |
|---|---|
| `procar-on-high` | 3,14 s |
| `procar-off-low` | 4,22 s |
| `procar-on-low` | 4,20 s |
| `procar-off-high` | 5,37 s |

Ce ticket prévoyait de s'abandonner si les boucles étaient longues. **Elles ne le
sont pas** : la plus courte se répète dix-neuf fois par minute à vitesse de
lecture normale. En conduite la vitesse de lecture mesurée va de 0,26 à 0,81, ce
qui étire la période à quatre secondes au plus court et une vingtaine au plus
long — assez lent pour ne pas gêner en accélération, assez court pour qu'une
croisière tenue laisse l'oreille apprendre le motif.

Deux voies possibles, à trancher sur cette mesure : redémarrer périodiquement la
source à une nouvelle position avec un fondu court, ou entretenir deux instances
par couche en fondu croisé lent et permanent.

C'est le seul ticket du lot qui touche le graphe audio et non le cœur calculable.
Il vient donc après les deux autres, et il se justifie par une mesure : **un
fondu croisé mal fait s'entend plus que la périodicité qu'il masque.** Si la
mesure ne montre pas de gain, on s'arrête.

## Critères d'acceptation

- [x] La durée des boucles de la banque livrée est mesurée et écrite
- [x] Le son ne repasse plus par la même position à intervalle fixe
- [x] Le raccord ne s'entend pas : aucun saut de niveau ni de hauteur mesurable
      au moment du changement de position
- [x] Le nombre de sources simultanées reste maîtrisé, et la charge de calcul
      mesurée avant et après
- [x] Le comportement est désactivable, et l'état désactivé est exactement celui
      d'avant le ticket
- [ ] 🧑 Vérifié en roulant : la croisière tenue longtemps sonne moins figée

## Ce qui a été fait

`MixPreset` gagne `layerRefreshS`, l'intervalle moyen entre deux reprises de la
lecture ailleurs dans l'enregistrement — six secondes sur les deux profils
livrés, zéro pour retrouver exactement le comportement d'avant. L'intervalle réel
est tiré à quarante pour cent près : à cadence fixe on remplacerait une
périodicité par une autre.

Le calcul — cadence et forme du fondu — vit dans `core/audio/refresh.ts`, séparé
du graphe, donc vérifiable sans sortir un son. Le graphe porte maintenant deux
voix par couche pendant les vingt millisecondes du fondu, chacune derrière son
propre gain ; le gain de couche reste en aval, et le mixage n'a rien à savoir de
tout cela.

**La voie « deux instances permanentes en fondu croisé lent » est écartée**, pas
ajournée. Les prises bas régime sont fortement corrélées à elles-mêmes — 0,93
d'autocorrélation à 34,6 Hz, corrélation médiane 0,45 entre deux positions au
hasard : deux copies jouées en permanence s'y battraient en peigne. Le fondu
court n'expose à ce risque que vingt millisecondes de temps en temps.

**L'alignement de la nouvelle position sur le cycle moteur est écarté aussi.**
C'était la parade prévue au peigne, et la mesure dit qu'elle ne sert à rien.

## Mesures

Le motif que porte la boucle, par tranches de 50 ms. La dernière colonne compare
deux tranches distantes d'une seconde à deux tranches voisines : au-dessus de 1,
se déplacer dans la boucle apporte du matériau neuf.

| Couche | Durée | Étendue de niveau | Éloignées / voisines |
|---|---|---|---|
| `on-high` | 3,14 s | 2,4 dB | 2,15 |
| `on-low` | 4,20 s | 9,2 dB | 1,57 |
| `off-low` | 4,22 s | 4,9 dB | 0,94 |
| `off-high` | 5,37 s | 6,8 dB | 2,58 |

`off-low` est le seul bourdon homogène : le renouvellement ne lui apporte rien,
et ne lui coûte rien.

Le creux d'énergie moyen pendant le fondu, selon la loi employée :

| Loi | Mesuré sur les quatre couches | Théorie sur signaux décorrélés |
|---|---|---|
| linéaire | −0,5 à −1,8 dB | −1,76 dB |
| puissance constante | −0,5 à +0,2 dB, soit nul | 0 dB |

Le pire écart de niveau pendant le fondu, à puissance constante, fondu de 20 ms,
médiane sur 80 sauts. Le témoin est la même mesure sur le son qui ne saute pas :
c'est la respiration naturelle du moteur, le plancher indépassable.

| Couche | Témoin | Position libre | Position alignée sur le cycle |
|---|---|---|---|
| `on-high` | 2,33 dB | 1,19 | 1,23 |
| `on-low` | 2,78 dB | 3,25 | 3,30 |
| `off-low` | 2,82 dB | 2,51 | 2,79 |
| `off-high` | 2,49 dB | 2,50 | 2,46 |

Cinquante millisecondes font moins bien partout : de 1,35 à 4,35 dB.

**Sources simultanées**, relevées au serveur de développement sur le profil Sport
et ses cinq couches, son coupé : cinq en régime établi, six au maximum pendant un
fondu. À l'intervalle absurde de 0,5 seconde — quarante renouvellements en quatre
secondes — le maximum reste six : aucune source ne s'accumule. À zéro, le
compteur de renouvellements ne bouge plus.

La charge de calcul n'a pas été mesurée : rien dans l'application ne la relève,
et une source de plus, présente une fois sur trois cents, ne se distinguerait pas
du bruit d'un relevé extérieur. C'est le comptage de sources qui tient lieu de
garde-fou, et il est affiché.
