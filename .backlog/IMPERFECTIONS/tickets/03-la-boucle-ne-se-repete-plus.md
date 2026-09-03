# 03 — La boucle ne se répète plus à l'identique

**Statut :** ⬜ prêt

**Bloqué par :** 01 — Le régime tremble, d'autant plus qu'il est bas ; 02 — Deux
couches ne jouent plus parfaitement d'accord

## Ce qu'il faut obtenir

Le son ne repasse plus indéfiniment par la même tranche d'enregistrement.

C'est la cause principale de l'impression de synthèse, et la moins évidente :
chaque couche est **une seule** source en boucle, démarrée une fois pour toutes.
Sa position de départ est bien tirée au sort, mais seulement à l'allumage — passé
la première seconde, la même tranche se répète pour toute la durée de la session,
et l'oreille apprend une répétition périodique en quelques tours.

**Une mesure vient d'abord** : la durée des boucles n'est pas connue, les
échantillons vivant hors du dépôt, dans un volume du NAS. Elle décide de
l'urgence et de la forme du remède — une prise de dix secondes se répète bien
moins vite qu'une prise de deux. Si les boucles sont longues, ce ticket peut être
abandonné sans regret.

Deux voies possibles, à trancher sur cette mesure : redémarrer périodiquement la
source à une nouvelle position avec un fondu court, ou entretenir deux instances
par couche en fondu croisé lent et permanent.

C'est le seul ticket du lot qui touche le graphe audio et non le cœur calculable.
Il vient donc après les deux autres, et il se justifie par une mesure : **un
fondu croisé mal fait s'entend plus que la périodicité qu'il masque.** Si la
mesure ne montre pas de gain, on s'arrête.

## Critères d'acceptation

- [ ] La durée des boucles de la banque livrée est mesurée et écrite
- [ ] Le son ne repasse plus par la même position à intervalle fixe
- [ ] Le raccord ne s'entend pas : aucun saut de niveau ni de hauteur mesurable
      au moment du changement de position
- [ ] Le nombre de sources simultanées reste maîtrisé, et la charge de calcul
      mesurée avant et après
- [ ] Le comportement est désactivable, et l'état désactivé est exactement celui
      d'avant le ticket
- [ ] 🧑 Vérifié en roulant : la croisière tenue longtemps sonne moins figée
