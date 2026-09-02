# 02 — Le conditionnement du signal sous test

**Statut :** ✅ fait

**Bloqué par :** 01 — Vitest et ESLint en place

## Ce qu'il faut obtenir

Le comportement chiffré du conditionnement est vérifié automatiquement. On
fabrique dans le test une trace synthétique à 1 Hz — accélération régulière,
vitesse tenue, freinage brutal — on la fait passer dans le conditionnement, et
on vérifie la sortie.

Le chiffre annoncé dans le README devient une assertion : l'écart de suivi reste
sous 1 km/h en accélération régulière. Le freinage brutal, où l'écart monte à
une dizaine de km/h le temps que la pente bascule, est vérifié comme tel : c'est
le compromis du procédé, pas un défaut, et un test qui l'exigerait meilleur
serait un test faux.

## Critères d'acceptation

- [x] La sortie est continue : aucun saut entre deux tours de boucle sur toute
      la trace
- [x] En accélération régulière, l'écart entre la vitesse conditionnée et la
      vitesse réelle reste sous 1 km/h
- [x] Sur un freinage brutal, l'écart maximal est vérifié contre une borne
      explicite, commentée comme étant le compromis attendu
- [x] Une variation sous la zone morte ne produit aucune accélération
- [x] Le sort d'une mesure au-delà de la vitesse plausible maximale est établi :
      elle est **plafonnée**, non rejetée comme l'annonçait le README. Le test
      décrit le code tel qu'il est ; la correction est le ticket 02 du lot
      [FIX-CORE](../../FIX-CORE/tickets/02-mesure-aberrante.md)
- [x] Le lissage à raideur élevée suit plus vite qu'à raideur basse — la
      direction du réglage est vérifiée, pas sa valeur exacte
