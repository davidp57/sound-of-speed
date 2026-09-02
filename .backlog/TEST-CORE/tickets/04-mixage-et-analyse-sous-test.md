# 04 — Le mixage et l'analyse sous test

**Statut :** ✅ fait

**Bloqué par :** 01 — Vitest et ESLint en place

## Ce qu'il faut obtenir

Le mixage est une fonction pure : on lui donne un régime, une charge et un jeu
de couches, elle rend des gains et des vitesses de lecture. C'est donc le module
le plus facile à couvrir, et celui dont les règles sont les plus faciles à
casser en croyant les améliorer.

Trois règles à verrouiller : les fondus se font à puissance constante, donc le
niveau d'ensemble ne se creuse pas au passage d'une couche à l'autre ; une
couche hors de son domaine jouable est réduite au silence, et non laissée à
hauteur figée ; le ralenti s'efface au-dessus de son régime d'effacement.

L'analyse d'échantillon se teste sur un signal fabriqué dans le test, dont la
raie d'allumage est connue par construction : l'ancrage proposé doit retrouver
le régime correspondant au nombre de cylindres déclaré.

## Critères d'acceptation

- [x] Le niveau d'ensemble reste constant, à une tolérance explicite, tout au
      long d'une bascule de régime entre deux couches d'un même rôle
- [x] Il en va de même pour le fondu de charge entre « en charge » et
      « pied levé »
- [x] Une couche dont la vitesse de lecture demandée sort de ses bornes voit son
      gain décroître, et atteint le silence au-delà d'une demi-octave
- [x] La couche de ralenti est silencieuse au-dessus du régime d'effacement
- [x] Une couche désactivée ne joue jamais, quel que soit le régime
- [x] Le contraste de charge à zéro mélange les deux familles en permanence, à
      un les sépare complètement
- [x] Sur un signal synthétique de raie d'allumage connue, l'ancrage proposé
      correspond au régime attendu pour le nombre de cylindres déclaré
- [x] Un nombre de cylindres erroné déplace l'ancrage proposé dans le même
      rapport — le comportement documenté, vérifié
