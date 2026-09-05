# 05 — Générer une banque avec engine-sim, ici, et la rejouer là-bas

**Statut :** 🧑 attend David — l'outil est livré et mesuré, le timbre reste à
juger à l'oreille

**Bloqué par :** aucun — n'attend pas le verdict du temps réel

## Ce qui a déclenché

Idée de David, le 4 septembre 2026 :

> on peut aussi utiliser engine-sim pour qu'il tourne au design time, et nous
> génère une version « pré compilée » des sons qu'on pourra ensuite simuler dans
> la voiture

Proposée comme un repli, retenue comme une **option à part entière** : elle a son
domaine, et elle corrige un défaut que rien d'autre ne corrige.

## Ce qu'elle corrige

Le son de la banque livrée est joué entre **0,26 et 0,81 fois** sa vitesse sur
toute la conduite ordinaire. Le rééchantillonnage descend la fréquence
d'allumage, ce qu'on veut, mais il descend **avec elle** les résonances de
l'échappement et de la caisse, ce qu'on ne veut pas : un moteur change de régime
sans changer de corps. C'est la cause racine que l'essai d'ancrage a mise au
jour, et qu'aucun réglage ne rattrape.

En générant, on produit une prise **par plage de régime**, donc une lecture
proche de un, où le timbre ne se déplace plus. Et l'on obtient la prise de
ralenti et la prise bas régime qui manquent depuis le début — la seule vraie
sortie qu'avait identifiée le ticket 05 d'ESSAI-04, et qui demandait « de la
matière, pas du code ».

## Ce qui est livré

Un outil qui tourne **ici**, pas dans la voiture :
[`scripts/generate-bank/`](../../../scripts/generate-bank/README.md), plus un
banc hors ligne en C++ (`native/generator.cpp`, `native/engines.h`,
`native/build-generator.sh`).

```bash
node native/prepare.mjs
bash native/build-generator.sh
node scripts/generate-bank/generate.mjs scripts/generate-bank/engines/v8-crossplane.json
```

Il lit une définition de moteur en JSON, tient chaque régime au **dynamomètre**,
enregistre une boucle par plage de régime en charge et pied levé, et écrit dans
`public/audio/<dossier>/` les WAV, un **profil partiel** que l'application
importe tel quel, et `mesures.json`, le relevé complet.

**Rien n'a été modifié dans le moteur de lecture.** Le profil produit passe la
fonction d'import de l'application sans retouche, ce que vérifie
`scripts/generate-bank/profile.test.mjs`.

Trois choses ont dû être réglées, chacune vue à la mesure :

1. **Le moteur démarre au démarreur avant que le dynamomètre l'engage.** Engager
   le dynamomètre sur un moteur à l'arrêt le fait tourner sans jamais l'allumer :
   à 3 000 tr/min tenus, plein gaz, la chambre la plus chaude plafonnait à 530 K
   et le couple restait négatif. Après démarrage, le même point donne 2 679 K et
   +155 ft·lb, et le plein gaz redevient plus fort que le pied levé — il était
   12 dB plus faible.
2. **Le correcteur de niveau d'engine-sim est neutralisé.** C'est un limiteur à
   crête : il rend le même niveau à 750 tr/min et à 6 500, donc une banque sans
   relief de régime.
3. **Le volume d'enregistrement est étalonné prise par prise.** Le signal brut
   couvre soixante-trois décibels entre le pied levé au ralenti et le plein gaz
   au rupteur ; un volume unique écrête d'un côté ou manque de résolution de
   l'autre.

## Les deux questions, tranchées par la mesure

### Combien de prises, et à quels régimes ?

Mesuré sur le V8 croisé, 750 à 6 500 tr/min, en générant au **quart d'octave**
avec une prise témoin au milieu de chaque intervalle, puis en évaluant ce que
donneraient les sous-ensembles plus larges. L'erreur de timbre est l'écart entre
le centroïde de la prise vraie et celui que l'application produirait à ce régime
en rééchantillonnant ses voisines.

| Écartement | Prises par famille | Rapport | Vitesse de lecture | Erreur de timbre |
|---|---|---|---|---|
| quart d'octave | 14 | 1,181 | 0,85 à 1,18 | 0,78 demi-ton |
| **demi-octave** | **8** | **1,361** | **0,72 à 1,39** | **1,02 demi-ton** |
| trois quarts d'octave | 6 | 1,540 | 0,61 à 1,64 | 1,79 demi-ton |
| une octave | 5 | 1,716 | 0,52 à 1,93 | 2,73 demi-tons |
| les deux bouts | 2 | 8,667 | 0,13 à 8,53 | 15,77 demi-tons |

**Le demi-octave est retenu**, et le tableau dit pourquoi : passer de l'octave au
demi-octave gagne 1,7 demi-ton, passer du demi au quart n'en gagne plus que 0,24
pour deux fois plus de prises. Ce qui reste à 0,78 n'est plus de l'écartement
mais le bruit du modèle — le centroïde des prises voisines varie déjà de un à
deux pour cent d'un régime à l'autre, sans monotonie.

**Une par octave ne suffit donc pas**, mais elle n'est pas absurde non plus :
2,7 demi-tons contre 15,8 pour la banque à deux prises d'aujourd'hui.

La banque livrée est produite au demi-octave : **8 ancrages par famille**, de 750
à 6 500 tr/min, plus une prise de ralenti et une prise de rupteur — 18 fichiers,
12 Mo. Sur cette banque-là, mesurée telle qu'elle est écrite, la vitesse de
lecture reste **entre 0,74 et 1,36 sur toute la conduite ordinaire**, contre 0,26
à 0,81 pour la banque enregistrée, et l'erreur de timbre y vaut 1,30 demi-ton.

Le fait qui fonde tout cela, mesuré : entre 750 et 4 775 tr/min, soit 2,67
octaves de régime, le centroïde spectral du moteur simulé ne se déplace que de
0,21 octave — **il suit le régime à 8 %**. Le corps du son est presque fixe ;
c'est le rééchantillonnage qui le déplace.

**Une réserve, mesurée elle aussi.** Sur la banque enregistrée, entre la prise
bas régime et la prise haut régime (3 128 → 8 150 tr/min, 1,38 octave), le
centroïde passe de 1 522 à 2 608 Hz, soit 0,78 octave : **il suit le régime à
56 %**, sept fois plus que le moteur simulé. Une part de cet écart vient de la
réponse impulsionnelle d'échappement, qui est synthétique et identique pour
toutes les prises, donc tient le timbre en place. Cela joue **en faveur** du
chiffre annoncé et non contre lui : plus le timbre suit le régime, moins le
rééchantillonnage a tort, donc 1,30 demi-ton est une borne haute.

### Comment fermer la boucle proprement ?

À régime tenu, le son se répète exactement tous les deux tours de vilebrequin.
Les prises font donc un **nombre entier de cycles moteur** : les deux bouts sont
en phase par construction.

L'application ferme ensuite elle-même la boucle au chargement
(`core/audio/engine.ts`), en mesurant le saut d'énergie sur deux versions et en
gardant la meilleure. L'outil ne recolle donc pas les fichiers — il le ferait
deux fois — mais il rejoue le même calcul pour chiffrer ce que cette passe
donnera.

Mesuré sur les 18 prises de la banque livrée : saut d'énergie **médian de 1,6 %,
au pire 4,8 %** une fois la passe de l'application appliquée. Sur le fichier
écrit, avant cette passe, le saut médian est de 3,4 % — l'écart tient au bruit
d'air et au tremblement d'allumage, qui ne se répètent pas d'un cycle à l'autre.

Point de comparaison, mesuré avec les mêmes outils sur la banque enregistrée :
0,0 % à **10,8 %** une fois jouée, 2,3 % en médiane. La banque générée boucle
donc mieux que celle qui est en service.

## Le seul chiffre du profil qui ne soit pas mesuré

Le relief de niveau. Brut, l'écart entre le pied levé au ralenti et le plein gaz
au meilleur régime atteint **37,4 dB sur le V8** (63,9 dB sur le quatre
cylindres) : joué tel quel, il n'y a plus rien à entendre en bas. À l'inverse, le
correcteur d'engine-sim rendrait un niveau constant, soit aucun relief.

`bank.reliefCompression`, déclaré dans la définition, rabat le relief mesuré en
décibels. À 0,35, les 37,4 dB deviennent 13,1 dB : 5,5 dB de relief de régime sur
la famille en charge, et 7,5 dB entre en charge et pied levé au ralenti, 3,3 dB
au rupteur. Pour comparaison, les profils livrés portaient ces reliefs à la main,
réglés à l'oreille sur la banque enregistrée : 3 à 4 dB de relief de régime, 8 à
10 dB de relief de charge.

**C'est le premier réglage à juger à l'oreille.**

Conséquence : `loadReliefDb`, `rpmReliefDb` et `idleLevelDb` sont mis à zéro dans
le profil produit, et `offLoadGain` à un. Ils compensaient à la main ce que la
banque enregistrée ne portait pas ; les gains de couche le portent désormais, et
les laisser en place appliquerait deux fois le même relief.

## Ce que ça coûte à produire

Sur le poste de David (Ryzen 7 7800X3D, g++ `-O2`, un seul fil) :

| Banque | Prises | Durée |
|---|---|---|
| V8 croisé, quart d'octave, avec témoins | 42 | 7 min 04 |
| V8 croisé, demi-octave, avec témoins — **la banque livrée** | 25 | 4 min 39 |
| Quatre cylindres, demi-octave, avec témoins | 21 | 1 min 33 |

Environ onze secondes de calcul par prise sur le V8, quatre sur le quatre
cylindres, dont l'essentiel part dans la stabilisation. Le temps réel n'a aucune
importance ici — c'est tout l'intérêt du mode.

## Critères d'acceptation

- [x] L'outil produit une banque complète depuis une définition de moteur, sans
      intervention à la main
- [x] Il produit aussi les ancrages et les gains, mesurés et non estimés — seul
      le rabattement du relief est un choix déclaré, et il est dit comme tel
- [x] La banque produite se charge dans l'application sans rien y modifier — le
      profil passe la fonction d'import (vérifié par un test) et les 18 fichiers
      se décodent dans le navigateur, en 44,1 kHz mono
- [x] Le saut d'énergie au bouclage est chiffré pour chaque prise
- [x] La vitesse de lecture reste dans une plage annoncée sur toute la conduite
      ordinaire, et ce chiffre est écrit : **0,74 à 1,36**
- [ ] 🧑 Jugé à l'oreille contre la banque enregistrée et contre le mode direct

## Ce qui n'est pas vérifié

- **Le timbre n'a pas été écouté.** Ni par la machine, ni par personne. Le lot
  dit depuis le début que la machine ne peut pas juger ce point.
- **La réponse impulsionnelle d'échappement est synthétique** — un bruit qui
  décroît, repris de la sonde, identique pour toutes les prises. C'est elle qui
  fait le corps du son : sa fixité d'une prise à l'autre est donc en partie posée
  par construction, pas seulement mesurée. Le classement des écartements, lui,
  n'en dépend pas : il compare des prises entre elles, toutes avec la même
  réponse.
- **Le moteur codé en dur n'a pas été comparé au même moteur chargé par le
  langage de script d'engine-sim** — même réserve que la sonde, dont il reprend
  les définitions.
- **La géométrie du moteur n'est pas encore dans le JSON.** La définition choisit
  une définition C++ (`crossplaneV8` ou `inline4`) et règle ce qui façonne la
  banque. Décrire un moteur entier en JSON est le travail du mode direct
  (ticket 03) ; les deux formats devront converger.
