# 04 — Un agrégat qui se complète au lieu de tout relire

**Statut :** ✅ fait — livré le 11 septembre 2026

**Bloqué par :** 02 et 03 — il faut savoir quoi retenir avant de savoir le
cumuler.

## Ce qu'il faut obtenir

**Ajouter une tranche sans relire quatre cents kilomètres.** Le recalcul se fait
à chaque tranche déposée, soit une douzaine de fois par trajet. Relire tout
l'historique à chaque fois tient aujourd'hui et ne tiendra pas dans six mois.

L'agrégat garde ce qu'il faut pour répondre sans les données brutes : des
compteurs, des distributions résumées, les extrêmes. Une tranche neuve s'y
ajoute, elle ne le refait pas.

Et les deux familles ne se cumulent pas pareil :

| Famille | Portée |
|---|---|
| capacités — accélération et freinage maximum, bornes du signal | tout l'historique |
| habitudes — vitesses tenues, seuils de passage, passage en deuxième | les derniers trajets |

Un **recalcul complet reste forçable** : le jour où l'on corrige un procédé, un
agrégat construit avec l'ancien ne vaut plus rien.

## Critères d'acceptation

- [x] L'agrégat se met à jour d'une tranche sans relire les précédentes.
- [x] Ajouter les tranches une à une donne le même résultat que tout relire d'un
      coup — vérifié sur la session du 11 septembre, tranche par tranche contre
      session entière.
- [x] Les capacités portent sur tout l'historique, les habitudes sur une fenêtre
      dont la taille est un réglage, pas une constante enfouie.
- [x] Un recalcul complet se déclenche à la demande, et l'agrégat porte la
      version du procédé qui l'a produit.
- [x] Contrôle qualité vert.
