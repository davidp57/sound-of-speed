# 01 — Le rétrogradage forcé rend le rapport aussitôt pris

**Statut :** 🧑 attend David — livré, reste l'écoute en roulant

## Ce qui se passe

Trajet du 11 septembre au soir, 566 s, mode Route, reprise vers 118 km/h :

```
566.26  116.0 km/h  ms2=+2.26  rpm=2474  g=6  load=0.87
566.73  120.6 km/h  ms2=+2.67  rpm=3537  g=4  load=0.99   ← 6→4
567.16  123.4 km/h  ms2=+2.16  rpm=2627  g=5  load=1.00   ← 4→5, 0,43 s plus tard
568.06  123.4 km/h  ms2=-0.10  rpm=2585  g=6  load=0.62   ← 5→6, reprise finie
```

La quatrième est tenue **six dixièmes de seconde**. Trois passages pour une
reprise d'une seconde et demie.

## La cause, et elle se calcule

Le kickdown vise `redlineRpm × targetRpmFraction` = 6 500 × 0,55 = **3 575
tr/min**. Le seuil de montée de la quatrième à pleine demande vaut
`(800 + 900 × 2) × 1,03 / 0,86` = **3 114 tr/min**, et la montée immédiate
(`UPSHIFT_OVERSHOOT_RPM`, 400) se déclenche à **3 514**.

Le kickdown atterrit donc **au-dessus de son propre seuil de remontée
instantanée** — mesuré : 3 537 pour 3 514. Ce n'est pas un hasard du trajet :
tout rétrogradage forcé qui atteint sa cible se fait rendre le rapport au tour
suivant. Quatre déclenchements sur la sortie, deux ont servi, deux ont été
rendus.

## Ce qu'il faut obtenir

La cible du rétrogradage forcé **bornée sous le seuil de montée du rapport
visé**, avec la marge d'overshoot. Un rapport pris par kickdown ne peut plus
être rendu par la règle de montée du tour d'après.

La garde de temps minimum dans un rapport a été proposée en plus et **écartée
par David** : « ce n'est pas comme ça que fonctionne une boîte auto ». On ne la
met pas.

## Critères d'acceptation

- [x] Un test montre qu'après un rétrogradage forcé, le régime atteint reste
      sous le seuil de montée immédiate du rapport visé.
- [x] Un test rejoue le cas du 11 septembre — 118 km/h, charge 0,96, sixième —
      et le rapport pris tient plus d'une seconde.
- [x] Le rétrogradage forcé continue de descendre de deux rapports quand la
      cible le permet.
- [x] Contrôle qualité vert.

Critères établis le 12 septembre 2026 : un test rejoue nommément le cas des 118 km/h du 11 septembre, un autre vérifie que le rapport pris n'est pas rendu aussitôt, un troisième que la descente de deux rapports subsiste quand elle se garde. Contrôle qualité vert.
