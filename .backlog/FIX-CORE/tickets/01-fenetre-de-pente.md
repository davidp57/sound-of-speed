# 01 — La pente sur une vraie fenêtre glissante

**Statut :** 🧑 attend David

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

- [x] La pente est estimée sur la fenêtre déclarée, pas sur tout l'historique
- [x] Après une rampe suivie d'un plateau, l'écart de suivi retombe sous 1 km/h
      en moins de deux secondes
- [x] Une fenêtre de 300 ms et une fenêtre de 4000 ms donnent des résultats
      nettement différents
- [x] Le suivi d'une accélération régulière ne s'est pas dégradé : l'écart reste
      sous 1 km/h à 8 km/h/s
- [x] Le freinage franc reste vu en une fenêtre, pas davantage
- [x] Les deux tests de `conditioner.test.ts` qui décrivaient le défaut ont été
      réécrits, et l'on a vérifié qu'ils échouaient avant la correction
- [x] Le commentaire du module et le README décrivent ce que le code fait
- [ ] 🧑 Vérifié à l'oreille, sur une trace rejouée ou en roulant

## Ce qui a été fait

`find` devenait `findLast` : l'historique est rangé du plus ancien au plus
récent, si bien que `find` rendait la plus **ancienne** entrée assez vieille,
donc la fenêtre entière.

Mesuré, sur une rampe à 12 km/h/s pendant six secondes suivie d'une vitesse
tenue à 72 km/h :

| | avant | après |
|---|---|---|
| Dépassement au sommet | 10,4 km/h | 10,4 km/h |
| Écart deux secondes après | 5,3 km/h | 0,001 km/h |
| Écart quatorze secondes après | 1,3 km/h | 0 |

Le dépassement au sommet ne change pas, et c'est normal : l'extrapolation ne
peut pas se démentir avant la mesure suivante. C'est le **temps de retour** qui
était en cause.

Rien d'autre n'a bougé, vérifié chiffre par chiffre : suivi d'une accélération
régulière (0,467 / 0,934 / 1,401 km/h à 4, 8 et 12 km/h/s), continuité
(1,389 km/h de variation maximale par image), freinage (9,83 et 19,67 km/h à 10
et 20 km/h/s), vitesse tenue (écart nul).

## Ce qui reste à écouter

La pente est désormais estimée sur une seconde, contre seize auparavant : elle
est plus juste, mais **moins lissée**. Sur un GPS réel, dont les mesures
tremblent, la charge — donc le fondu entre « en charge » et « pied levé » —
peut s'en trouver plus nerveuse.

Le remède est à portée de curseur, et c'est maintenant qu'il sert : **monter la
« fenêtre d'accélération » à 2000 ou 3000 ms** retrouve du lissage tout en
gardant une mémoire bornée. À juger à l'oreille, en roulant. Si un réglage
s'impose, il ira dans les deux profils livrés — et ce sera un lot de réglage,
pas celui-ci.
