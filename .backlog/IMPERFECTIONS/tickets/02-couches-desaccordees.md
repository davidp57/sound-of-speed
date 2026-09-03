# 02 — Deux couches ne jouent plus parfaitement d'accord

**Statut :** ⬜ prêt

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

- [ ] Deux couches d'une même famille jouent à des vitesses légèrement
      différentes
- [ ] À réglage nul, les vitesses de lecture sont exactement celles d'avant
- [ ] Une même situation donne toujours le même mixage
- [ ] Le désaccord ne fait pas sortir une couche de son domaine jouable
- [ ] Le réglage est dans le guide de création et la référence des réglages
