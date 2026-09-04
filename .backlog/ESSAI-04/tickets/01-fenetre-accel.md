# 01 — une accélération que la boîte peut croire

**Statut :** ✅ fait

**Bloqué par :** aucun

## Ce qu'il faut obtenir

Sur une vitesse tenue, la boîte tient son rapport ; en ralentissant, elle
descend. Et cela quelle que soit la position du curseur de réactivité.

Ce ticket s'appelait d'abord « une fenêtre d'accélération qui ne descend jamais
sous le tenable », et **la mesure a écarté ce correctif**. La fenêtre balayée de
200 à 2000 ms ne changeait presque rien : l'accélération gardait un écart-type
de 0,82 à 0,93 m/s² et la boîte faisait dans tous les cas une quarantaine de
passages parasites par douze minutes. La raison en est que l'accélération
transmise n'était pas la pente estimée sur cette fenêtre, mais la dérivée du
ressort de lissage — que la fenêtre ne touche qu'indirectement.

Deux corrections, désignées par la mesure.

**L'accélération rendue est la pente estimée**, et non la vitesse de la masse du
ressort. Le ressort a pour métier de rattraper une cible qui saute à chaque
mesure sans la dépasser : sa vitesse porte tout le bruit du GPS et le retard qui
va avec. La pente aux moindres carrés était déjà calculée et ne servait qu'à
l'extrapolation entre deux mesures.

**La croisière se juge sur la dérive de la vitesse**, mesurée par moitiés sur une
fenêtre de trois secondes, et non sur l'accélération instantanée. Le bruit
résiduel de celle-ci est du même ordre que la borne basse de la bande, si bien
que le critère se décidait au tirage au sort. Une vitesse tenue se mesure sur la
vitesse.

## Ce qui a été mesuré

Douze minutes de vitesse parfaitement tenue par ligne — 25, 40, 60 et 90 km/h,
trois tirages de bruit —, bruit de mesure de ±1 km/h, cadence de 30 ms :

| Accélération transmise | écart-type | pointes | passages parasites |
|---|---|---|---|
| dérivée du ressort | 0,83 m/s² | 2,2 | 98 |
| pente estimée | 0,10 m/s² | 0,4 | 46 |

Et sur une reprise établie à 2 m/s², le ressort lit 1,96 quand la pente lit
2,00.

Brancher la pente ne suffisait donc pas. Avec le critère de croisière porté sur
la dérive de la vitesse :

| Fenêtre de la dérive | passages parasites |
|---|---|
| accélération instantanée | 46 |
| deux secondes | 4, dont 2 descentes |
| **trois secondes** | **0**, à toutes les fenêtres d'accélération de 200 à 2000 ms |

Le curseur de réactivité n'a donc plus besoin d'être bridé : il peut aller au
bout de sa course sans dérégler la boîte.

## Critères d'acceptation

- [x] Sur une vitesse parfaitement tenue avec un bruit de ±1 km/h, à la cadence
      réelle du GPS, la boîte ne change pas de rapport — quelle que soit la
      position du curseur de réactivité, et à 25, 40, 60 et 90 km/h.
- [x] Le plancher retenu est justifié par une mesure écrite dans le code.
- [x] Un ralentissement doux sort la boîte de la croisière, malgré le bruit.
- [x] Le milieu du curseur donne toujours les réglages des profils livrés.
- [x] Le test qui garde ce correctif emploie le conditionnement réel : un
      premier essai bâti sur deux bruits tirés séparément passait avant comme
      après, faute de la corrélation entre bruit de vitesse et bruit de pente.

## Ce qui reste

La charge, elle, dépend toujours de la fenêtre : à 200 ms son écart-type est de
0,062 contre 0,017 à 1000 ms. Cela ne déplace plus aucun rapport, mais fait
vaciller le fondu entre les couches. À juger à l'oreille — c'est du ressort du
ticket 04.
