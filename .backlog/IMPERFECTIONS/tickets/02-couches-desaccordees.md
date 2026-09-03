# 02 — Deux couches ne jouent plus parfaitement d'accord

**Statut :** ✅ fait

**Bloqué par :** aucun, peut démarrer tout de suite

## Ce qu'il faut obtenir

Quand deux couches d'une même famille jouent ensemble, elles sont légèrement
désaccordées — de quelques centièmes de demi-ton, réglables.

Aujourd'hui elles jouent au rapport exact, donc parfaitement justes l'une par
rapport à l'autre, ce qui n'arrive jamais sur un moteur réel : les inégalités
entre cylindres et les deux lignes d'échappement produisent un battement lent.
C'est ce battement qui manque, et c'est peu de code pour un gain net de largeur.

Le décalage est **constant par couche**, tiré une fois : il ne varie pas au fil du
temps, sans quoi une même situation donnerait deux mixages différents et l'écran
de télémétrie ne serait plus lisible.

Le calcul reste dans la fonction de mixage, qui est pure — donc vérifiable sans
sortir un son, ce qui est la raison pour laquelle elle est pure.

## Critères d'acceptation

- [x] Deux couches d'une même famille jouent à des vitesses légèrement
      différentes
- [x] À réglage nul, les vitesses de lecture sont exactement celles d'avant
- [x] Une même situation donne toujours le même mixage
- [x] Le désaccord ne fait pas sortir une couche de son domaine jouable
- [x] Le réglage est dans le guide de création et la référence des réglages

## Ce qui a été fait

`MixPreset` gagne `layerDetuneCents`. Le décalage est réparti **symétriquement**
dans la famille : avec deux couches, l'une descend de la moitié de l'écart et
l'autre monte d'autant, de sorte que la moyenne géométrique des deux vitesses
reste celle du rapport exact. Le désaccord élargit le son sans toucher à la
justesse. Une famille d'une seule couche n'est pas désaccordée : il n'y aurait
personne avec qui battre.

Il ne dépend que du rang de la couche dans sa famille, jamais du temps ni d'un
tirage : une même situation donne toujours le même mixage, au bit près.

**Ordre des opérations**, qui est ce qui tient les deux critères délicats : le
domaine jouable se décide sur la hauteur que demande le régime, **avant**
désaccord, et l'effacement de justesse est calculé sur cette même paire. Le
désaccord s'applique ensuite, borné aux mêmes limites. Deux conséquences
mesurées : régler ce curseur ne déplace aucun gain, et il ne peut pas sortir une
couche de son domaine.

## Mesures

| Profil | Réglage | Milieu de bascule | Allumage | Battement |
|---|---|---|---|---|
| Route | 8 centièmes | 3900 tr/min | 260,0 Hz | 1,20 Hz |
| Sport | 12 centièmes | 5100 tr/min | 340,0 Hz | 2,37 Hz |

Sur Sport, le battement descend à 1,48 Hz au début de la bascule (3200 tr/min) :
il suit la fréquence d'allumage, donc le régime.

Écart de gain entre le réglage livré et zéro, mesuré couche par couche de 600 à
8500 tr/min et à trois charges : **nul**, au bit près.
