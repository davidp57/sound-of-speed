# 08 — Le rejeu sonore d'une capture

**Statut :** 🧑 attend David — livré, reste l'écoute

**Bloqué par :** 01 — la capture démarre toute seule et remonte par tranches ;
05 — le relecteur déroule une session

## Ce qu'il faut obtenir

Le relecteur ne montre plus seulement un trajet : il le **fait entendre**. Les
échantillons bruts de la capture traversent la chaîne comme ils l'ont fait dans
la voiture, avec la configuration enregistrée dans l'en-tête — pas avec le
profil actif du moment, sans quoi on écouterait autre chose que ce qui a été
vécu.

Ce ticket rend ce que le retrait du panneau traces avait emporté : le rejeu d'un
trajet réel sur un poste fixe, qui est l'outil de mise au point le plus utile du
projet.

Il ouvre en plus une vérification que rien d'autre ne donne : la capture porte
la **sortie** telle qu'elle a été calculée ce jour-là. La comparer à ce que la
chaîne recalcule aujourd'hui montre les régressions, et l'écart s'affiche.

Le déplacement dans la timeline ne peut pas être instantané pour le son : la
chaîne a un état — phase des boucles, régime lissé, rapport engagé. Après un
saut, le son se rétablit en une seconde environ. Ce n'est pas un défaut à
corriger, c'est un comportement à annoncer.

## Ce qui a été écarté, et pourquoi

**Le conditionnement n'est pas rejoué.** La capture porte à la fois la mesure
brute du GPS et la vitesse conditionnée ; le rejeu repart de la seconde. Le
conditionnement dépend de l'instant où chaque mesure arrive, et rien de cela ne
survit à un déplacement dans la timeline ni à une lecture au double de la
vitesse. Sa sortie est donc reprise telle qu'elle a été calculée ce jour-là — ce
qui veut dire qu'une régression du conditionneur ne se verrait pas ici, alors
qu'une régression du moteur ou de la boîte, si.

**Un piège rencontré en route :** les fichiers écrivent le rapport comme on le
lit au tableau de bord — la première est `1` — quand la boîte le compte à partir
de zéro. Comparé sans conversion, l'écart valait un rapport partout, y compris
là où la boîte décidait exactement pareil.

## Critères d'acceptation

- [x] Une capture rapatriée se rejoue avec son son.
- [x] La configuration jouée est celle de l'en-tête, pas celle du profil actif.
- [x] Un changement de tempérament en cours de session est respecté au rejeu.
- [x] L'écart entre la sortie enregistrée et la sortie recalculée s'affiche.
- [ ] 🧑 Après un déplacement dans la timeline, le son se rétablit sans à-coup
      désagréable. **À écouter** : la chaîne repart de son repos, calée sur le
      rapport de la vitesse d'arrivée.
- [x] Le rejeu n'exige pas le réseau une fois la session et la banque chargées.
