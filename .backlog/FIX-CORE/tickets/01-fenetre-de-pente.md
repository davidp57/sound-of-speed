# 01 — La pente sur une vraie fenêtre glissante

**Statut :** ⬜ prêt

**Bloqué par :** aucun, peut démarrer tout de suite

## Ce qu'il faut obtenir

Quand on cesse d'accélérer et qu'on tient sa vitesse, le son redescend en une
seconde, et non en quinze. Et le réglage « fenêtre d'accélération » commande
bien la durée sur laquelle la pente est estimée.

Le conditionnement compare la mesure courante à une mesure plus ancienne pour
estimer une pente. Il prend aujourd'hui la **plus ancienne** de l'historique —
seize mesures, donc jusqu'à seize secondes — au lieu de la **plus récente qui
soit assez ancienne**, ce que le commentaire du module décrit pourtant. Deux
conséquences mesurées :

- après une rampe à 12 km/h/s suivie d'une vitesse tenue à 72 km/h, la vitesse
  conditionnée monte à 81,7 km/h, et il lui faut une quinzaine de secondes pour
  revenir. Sur la route, cela veut dire un moteur qui reste trop haut pendant
  tout ce temps ;
- le réglage de fenêtre est inopérant : 300 ms et 4000 ms donnent des résultats
  identiques au chiffre près.

Attention en corrigeant : les valeurs par défaut des deux profils livrés ont été
réglées à l'oreille **avec** ce défaut. Une fenêtre qui se met à fonctionner
peut demander de les recaler — à l'écoute, et cela sort de ce ticket.

## Critères d'acceptation

- [ ] La pente est estimée sur la fenêtre déclarée, pas sur tout l'historique
- [ ] Après une rampe suivie d'un plateau, l'écart de suivi retombe sous 1 km/h
      en moins de deux secondes
- [ ] Une fenêtre de 300 ms et une fenêtre de 4000 ms donnent des résultats
      nettement différents
- [ ] Le suivi d'une accélération régulière ne s'est pas dégradé : l'écart reste
      sous 1 km/h à 8 km/h/s
- [ ] Le freinage franc reste vu en une fenêtre, pas davantage
- [ ] Les deux tests de `conditioner.test.ts` qui décrivaient le défaut ont été
      réécrits, et l'on a vérifié qu'ils échouaient avant la correction
- [ ] Le commentaire du module et le README décrivent ce que le code fait
- [ ] 🧑 Vérifié à l'oreille, sur une trace rejouée ou en roulant
