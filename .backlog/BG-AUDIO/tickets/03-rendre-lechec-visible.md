# 03 — Rendre l'échec visible sur l'écran Télémétrie

**Statut :** ✅ fait

**Bloqué par :** 02 — Le média de maintien, construit et inséré comme celui qui marche

## Ce qu'il faut obtenir

Un bloc « arrière-plan » sur l'écran Télémétrie, qui dit ce qui se passe
réellement. C'est la pièce qui fait qu'un seul essai en voiture suffira : sans
elle, on répare à l'aveugle et chaque tentative coûte un trajet.

Ce qu'il doit montrer :

- le média de maintien joue-t-il, à cet instant ;
- ce que le navigateur a refusé, s'il a refusé — le rejet de `play()` est
  aujourd'hui avalé par un `.catch(() => undefined)`, donc invisible ;
- l'état du contexte audio, et **combien de fois** il a fallu le relancer depuis
  l'activation : un compteur qui reste à zéro dit que le contexte n'a jamais été
  suspendu, et c'est l'information qui décidera du sort du chien de garde ;
- depuis combien de temps le GPS n'a rien envoyé, et combien de fois le suivi a
  été relancé.

Aucune de ces valeurs ne se lit dans une console : on conduit.

## Critères d'acceptation

- [x] `play()` n'est plus avalé : son échec est relevé et nommé en français
- [x] Une erreur du média (`error.code`) est relevée elle aussi
- [x] Le nombre de reprises du contexte est compté depuis l'activation
- [x] Le bloc apparaît sur l'écran Télémétrie, lisible d'un coup d'œil
- [x] Les valeurs se rafraîchissent pendant que ça tourne, sans animation
- [x] Rien de tout cela ne fait échouer le son si une valeur manque
