# 01 — Le banc de positions fabriquées juge la boîte

**Statut :** ✅ fait — 15 septembre 2026

**Bloqué par :** aucun, peut démarrer tout de suite.

## Ce qu'il faut obtenir

**Savoir combien de fois la boîte change d'avis sur un trajet donné, sans
sortir la voiture.** Aujourd'hui on ne le sait qu'après coup, en relisant un
journal rapporté du NAS, et on ne peut donc pas dire si un changement de code a
amélioré ou aggravé quoi que ce soit.

Le banc de positions fabriquées existe et sait produire la cadence d'un
récepteur de voiture ; il n'a jamais été branché sur la boîte. Il le sera : des
positions entrent, elles traversent la vraie source de géolocalisation, le
conditionneur, le moteur et la boîte, et on relève les passages de rapport en
sortie. C'est la seule façon de juger la boîte sur un signal **bruité**, qui est
la condition dans laquelle elle échoue — un régime fourni directement, comme le
fait le banc de boîte actuel, ne reproduit pas le problème.

Ce ticket ne corrige rien. Il **mesure la boîte telle qu'elle est**, et ce
relevé devient la référence à laquelle le ticket suivant se compare. Sans lui,
l'unification qui vient se jugerait à l'œil.

Deux scènes au minimum, tirées de l'essai du 10 septembre au soir : une vitesse
tenue autour de 72 km/h, où les allers-retours entre cinquième et sixième ont
été observés, et une décélération lente, où la boîte doit descendre rapport par
rapport sans remonter.

## Critères d'acceptation

- [x] Une épreuve fait entrer des positions fabriquées et relève les passages de
      rapport en sortie, en traversant toute la chaîne sans raccourci —
      `core/drivetrain/gearbox-gps.test.ts`.
- [x] La cadence et le bruit des positions se règlent. Les scènes tournent à la
      cadence de la voiture, dix mesures par seconde, et non aux trente
      millisecondes du banc livré. **Réserve** : le bruit du récepteur de la
      voiture n'a jamais été relevé, donc aucune scène ne peut se dire conforme
      au sien. Le banc balaie le bruit à la place, ce qui rend une marge.
- [x] Cinq vitesses tenues — 50, 60, 72, 85, 110 — et deux décélérations, pied
      levé et frein appuyé.
- [x] Le relevé est écrit dans la spécification du lot, avec la marge de bruit
      par cadence.
- [x] Contrôle qualité vert.

## Ce que le relevé a donné

Zéro passage partout sur un signal réaliste : le défaut entendu le 10 septembre
ne se reproduit pas, PLANCHER l'ayant emporté. Ce qui se mesure est donc la
**marge avant que ça recommence** — un quart de bruit en plus à la cadence de la
voiture. Le tableau complet est dans la spécification.
