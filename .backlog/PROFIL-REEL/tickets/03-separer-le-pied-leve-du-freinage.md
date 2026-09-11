# 03 — Séparer le pied levé du freinage, sans le demander

**Statut :** ⬜ prêt

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

## Critères d'acceptation

- [ ] Les ralentissements d'un trajet sont relevés et groupés par force.
- [ ] La séparation en deux modes est **mesurée**, pas supposée : le critère qui
      décide que les deux tas se distinguent est écrit et vérifiable.
- [ ] Aucune frontière n'est proposée quand ils ne se séparent pas.
- [ ] Éprouvé sur la session du 11 septembre, et sur des distributions
      fabriquées où la réponse est connue d'avance — un tas, deux tas nets, deux
      tas qui se touchent.
- [ ] Contrôle qualité vert.
