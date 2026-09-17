# 04 — Vérifié en roulant

**Statut :** 🔁 rouvert le 17 septembre 2026 — le lot **n'est pas clos**, et la prédiction d'INSTRUMENTER est démentie : le bruit est bas (0,27 à 0,42 km/h) **et** la boîte oscille encore. Ce n'est donc pas le bruit qui la fait pomper

**Bloqué par :** plus rien — 03 est livré le 15 septembre 2026, et le journal
inscrit désormais chaque bascule d'allure, ce qui rend l'essai lisible après
coup.

## Ce qu'il faut obtenir

**L'essai qui clôt le lot.** Rien à coder : un trajet, puis la relecture de son
journal. Ce ticket passe à 🧑 dès que le code des trois précédents est en place,
et il ne peut pas être fait par un agent.

Ce qu'on cherche, dans l'ordre :

1. **Les allers-retours à vitesse tenue** — dix-neuf alternances relevées le
   10 septembre au soir sur 36 minutes, dont douze à charge moyenne entre 40 et
   72 km/h. Le journal des passages les compte maintenant exactement, là où ce
   relevé n'était qu'une borne basse.
2. **Le symptôme A** — la troisième tenue jusqu'à 150 km/h, rapportée le
   10 septembre au matin, jamais retrouvée dans un journal. Elle ne s'est pas
   reproduite le soir même ; si elle revient, l'inscription des passages la
   montrera cette fois.
3. **Les descentes au ralentissement**, qui doivent se faire rapport par
   rapport sans remonter.

## Critères d'acceptation

- [ ] Un trajet est roulé avec la lecture unifiée et son journal rapporté.
- [ ] Le nombre d'allers-retours est comparé à celui du 10 septembre, sur une
      durée comparable.
- [ ] Le symptôme A est cherché explicitement, et son absence ou sa présence est
      écrite — une absence constatée vaut mieux qu'une question laissée ouverte.
- [ ] Le verdict est consigné dans la spécification du lot, et le statut
      d'ensemble mis à jour.

## Ce que l'essai du 16 septembre 2026 a donné

Compté dans les journaux des trois trajets, un aller-retour étant un passage
suivi de son inverse en moins de dix secondes :

| Trajet | Passages | Allers-retours | Par minute |
|---|---|---|---|
| 08:25, 98 min | 111 | 16 | 0,16 |
| **19:00, 13 min** | **69** | **16** | **1,23** |
| 19:16, 34 min | 65 | 3 | 0,09 |

Le repère de ce ticket était dix-neuf alternances en trente-six minutes, soit
0,53 par minute. Deux trajets sur trois font nettement mieux. Le troisième fait
plus du double du pire relevé.

**Ce trajet est le cas le plus dur, pas une anomalie.** David : « c'était juste
une partie de mon retour par l'autoroute, avec des bouchons et des
ralentissements ». L'accordéon enchaîne les deux conditions que la boîte lit —
on monte dès que le rapport suivant tient, on descend dès qu'on ralentit — et
elles alternent légitimement toutes les quelques secondes.

**La cause n'est donc pas le bruit du signal.** Il est bas, trois à cinq fois
sous le seuil qui aurait pu l'expliquer. Ce qui manque est une **hystérésis de
temps** : rien n'empêche aujourd'hui de redescendre aussitôt après être monté.
La boîte porte déjà des délais avant de monter (`shiftDelaysS`,
`cruiseUpshiftAfterS` à 2,2 s) ; elle n'en a aucun dans l'autre sens.

C'est la piste à instruire, et elle se mesure sur ces mêmes journaux avant
d'écrire une ligne de code : à quelle vitesse et sous quelle accélération les
seize allers-retours se produisent-ils ?

**Réserve :** le critère des dix secondes est celui de ce relevé, pas celui qui
a produit les dix-neuf alternances du 10 septembre. La comparaison est
indicative.

