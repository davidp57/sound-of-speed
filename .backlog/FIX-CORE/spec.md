# FIX-CORE — les défauts que la mise sous test a trouvés

**Statut :** ⬜ prêt
**Branche :** `fix/core-defauts`
**Version visée :** 0.2

## Le problème

Le lot [TEST-CORE](../TEST-CORE/spec.md) a mis le cœur sous test. Écrire ces
tests a mis quatre défauts au jour, dont un audible en roulant. Aucun n'a été
corrigé dans ce lot-là : un lot qui installe un filet ne répare pas en même
temps ce que le filet attrape, sinon on ne sait plus ce qui est vérifié et ce
qui est réparé.

Chaque défaut est tenu par un test qui décrit le comportement **actuel**, et
qui devra donc être réécrit avec sa correction. C'est voulu : ces tests rendent
les corrections visibles au lieu de les laisser passer inaperçues.

## La solution

Quatre corrections indépendantes, du plus audible au plus discret. Le premier
ticket porte l'essentiel : les trois autres sont des broutilles qu'il serait
dommage de laisser traîner maintenant qu'elles sont connues.

## Histoires

1. En tant que conducteur, je veux que le son redescende quand je cesse
   d'accélérer, et non une quinzaine de secondes plus tard.
2. En tant qu'utilisateur, je veux que le réglage « fenêtre d'accélération »
   change quelque chose quand je le bouge.
3. En tant que conducteur, je veux qu'une mesure GPS absurde ne fasse pas hurler
   le moteur.
4. En tant qu'utilisateur, je veux que l'avertissement sur un lien impartageable
   s'affiche aussi quand l'application est servie sur la boucle locale en IPv6.
5. En tant qu'utilisateur, je veux que l'aperçu du guide annonce le passage qu'il
   calcule vraiment.

## Décisions d'implémentation

- **Le ticket 01 change ce qu'on entend.** Il faudra le vérifier en roulant, ou
  au moins sur une trace rejouée : les tests diront que la pente s'oublie en une
  seconde, ils ne diront pas que le résultat sonne juste. Le ticket passe donc
  à 🧑 avant d'être clos.
- Les valeurs par défaut de `accelWindowMs` ont été réglées à l'oreille **avec**
  le défaut présent. Une fenêtre qui se met soudain à fonctionner peut demander
  de recaler la valeur des deux profils livrés : à juger à l'écoute, pas au
  chiffre.
- Rien à changer dans les interfaces : les quatre corrections sont internes.

## Décisions de test

Les tests existent déjà — ce sont ceux qui décrivent les défauts. Chaque ticket
consiste donc à **inverser** son test : remplacer la description du défaut par
celle du comportement voulu, et vérifier qu'il échouait bien avant la
correction.

Les tests concernés :

| Fichier | Test |
|---|---|
| `speed/conditioner.test.ts` | « garde une pente périmée pendant une quinzaine de secondes » |
| `speed/conditioner.test.ts` | « ignore le réglage de fenêtre d'accélération » |
| `speed/conditioner.test.ts` | « borne une mesure aberrante à la vitesse plausible maximale » |
| `preset/share.test.ts` | « laisse passer la boucle locale en IPv6 » |
| `preset/wizard.test.ts` | « annonce une vitesse de passage plausible » |

## Hors périmètre

- Le recalage à l'oreille des valeurs par défaut, si la correction du ticket 01
  le rend nécessaire : ce sera un lot de réglage, avec la voiture.
- Tout autre défaut découvert en corrigeant ceux-ci.

## Notes

Les cinq tests cités portent chacun une mention `(défaut, lot FIX-CORE)` ou un
commentaire qui renvoie ici. Chercher `FIX-CORE` dans `src/` retrouve donc
l'ensemble du périmètre.
