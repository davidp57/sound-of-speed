# 03 — Séparer le pied levé du freinage, sans le demander

**Statut :** 🧑 attend David — livré, mais la bimodalité reste à établir

**Bloqué par :** 01 — Lire une capture déposée.

## Ce qu'il faut obtenir

**Le seuil de rétrogradage, tiré d'un trajet où personne n'a dit s'il freinait.**
C'est le point dur du lot. Dans le protocole, deux étapes séparées le donnent :
lever de pied d'un côté, freinage franc de l'autre, et le seuil se pose au
milieu. Rien dans une trace ne dit où était le pied.

Mais un trajet contient des centaines de ralentissements. Groupés par force, ils
doivent former deux tas — les doux, où la récupération freine seule, et les
francs. La frontière entre les deux tas est le seuil recherché.

**Et si les deux tas ne se séparent pas, on ne propose rien.** La règle existe
déjà : le protocole refuse une frontière quand les deux étapes rendent la même
décélération à moins de 0,5 m/s² près. Une mesure qu'on n'est pas sûr de savoir
lire ne vaut pas mieux que pas de mesure — c'est ce qu'a coûté la borne basse
proposée à −0,5 m/s², qui aurait écrêté tout freinage réel.

## Ce que la trace réelle a appris

La séparation **fonctionne** sur le trajet du 11 septembre : 424 ralentissements
relevés, coupure à −1,04 m/s², pied levé moyen −0,51, freinage moyen −1,56.

Et le profil règle ce même seuil à **−1 m/s²**, posé à la main : la mesure y
retombe seule. C'est encourageant, ce n'est pas une preuve.

**Ce qui n'est pas établi** : que la distribution ait vraiment deux bosses. Elle
décroît continûment depuis un pic de 305 ralentissements doux. Le critère retenu
— l'écart des deux moyennes, comme le protocole l'exige de ses deux étapes —
dit que la coupure sépare quelque chose, pas qu'il y avait deux tas. Une
décroissance régulière le passerait aussi.

À reprendre quand plusieurs trajets seront là : un critère de **creux** entre
les deux modes serait plus sûr, et plusieurs trajets diront si la valeur tient.

## Critères d'acceptation

- [ ] Les ralentissements d'un trajet sont relevés et groupés par force.
- [ ] La séparation en deux modes est **mesurée**, pas supposée : le critère qui
      décide que les deux tas se distinguent est écrit et vérifiable.
- [ ] Aucune frontière n'est proposée quand ils ne se séparent pas.
- [ ] Éprouvé sur la session du 11 septembre, et sur des distributions
      fabriquées où la réponse est connue d'avance — un tas, deux tas nets, deux
      tas qui se touchent.
- [ ] Contrôle qualité vert.
