# 01 — Le banc de positions fabriquées juge la boîte

**Statut :** ⬜ prêt

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

- [ ] Une épreuve fait entrer des positions fabriquées et relève les passages de
      rapport en sortie, en traversant toute la chaîne sans raccourci.
- [ ] La cadence et le bruit des positions se règlent, et une scène au moins
      reproduit ce que donne le récepteur de la voiture.
- [ ] Deux scènes au moins : une vitesse tenue dans la plage où la boîte a
      oscillé, une décélération lente.
- [ ] Le nombre de passages de la boîte actuelle est relevé pour chaque scène et
      **écrit dans le lot**, de façon qu'un changement se compare à un chiffre.
- [ ] Contrôle qualité vert.
