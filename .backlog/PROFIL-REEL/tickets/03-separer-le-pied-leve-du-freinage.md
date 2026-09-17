# 03 — Séparer le pied levé du freinage, sans le demander

**Statut :** 🚫 tranché le 17 septembre 2026, et la réponse est **non** — mesuré sur 13 108 relevés des trajets du 16, bouchons d'autoroute compris : la distribution des ralentissements est monotone (65,8 % à −0,5 m/s², 20 % à −1, 8,8 % à −1,5…), une bosse et une queue, aucune rupture. La régénération d'une Tesla freine dès qu'on lève le pied : il n'y a pas de roue libre, donc pas deux populations à séparer. Le ticket ne se validera jamais tel qu'écrit

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

La séparation **rend un résultat** sur le trajet du 11 septembre : 115
ralentissements retenus, coupure à −1,34 m/s², pied levé moyen −0,74, freinage
moyen −1,78.

**Ce qui n'est pas établi** : que la distribution ait vraiment deux bosses. Elle
en a une, nette, autour de −0,8, et une queue qui s'étire jusqu'à −2,5. Le
critère retenu — l'écart des deux moyennes, comme le protocole l'exige de ses
deux étapes — dit que la coupure sépare quelque chose, pas qu'il y avait deux
tas. Une queue régulière le passerait aussi.

**Et la réponse dépend d'abord de ce qu'on fait entrer.** Une première version
admettait n'importe quel soubresaut du signal comme un ralentissement : elle en
comptait 424, dont un pic de 305 dans la tranche la plus douce, et tombait sur
−1,04 — soit très près du −1 que le profil règle à la main. On aurait pu y lire
une confirmation. Le filtrage par durée et vitesse d'entrée a supprimé les trois
quarts de cette population et déplacé la réponse de trois dixièmes.

À reprendre quand plusieurs trajets seront là : un critère de **creux** entre
les deux modes serait plus sûr que l'écart des moyennes. Et il faudra trancher
avec `suggest.ts`, qui produit le même réglage par un autre chemin.

## Critères d'acceptation

- [x] Les ralentissements d'un trajet sont relevés et groupés par force.
- [x] La séparation en deux modes est **mesurée**, pas supposée : le critère qui
      décide que les deux tas se distinguent est écrit et vérifiable.
- [x] Aucune frontière n'est proposée quand ils ne se séparent pas.
- [ ] Éprouvé sur la session du 11 septembre, et sur des distributions
      fabriquées où la réponse est connue d'avance — un tas, deux tas nets, deux
      tas qui se touchent.
- [ ] Contrôle qualité vert.

Trois critères établis le 12 septembre 2026, par les tests du découpage des ralentissements : ils nomment la frontière entre deux tas nets, le refus de conclure sur un seul tas, et le refus quand les deux tas se touchent. Le dernier critère reste ouvert : la bimodalité sur une vraie session n'est toujours pas établie, ce que le statut du ticket dit déjà.
