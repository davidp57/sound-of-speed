# 01 — La porte et la liste des comptes

**Statut :** ✅ fait

**Bloqué par :** aucun, peut démarrer tout de suite

## Ce qu'il faut obtenir

J'ouvre l'adresse de la régie avec mon compte, et je vois la liste de tous les
comptes du serveur : les derniers créés en haut, avec pour chacun le nom,
l'adresse, la date de création, les rôles et le poids déposé. Une zone de
recherche filtre par nom ou par adresse.

Quelqu'un d'autre ouvre la même adresse et n'obtient rien : une page qui
n'annonce pas ce qu'elle aurait montré, et des routes qui répondent 404.

L'administrateur est désigné par une liste d'adresses dans la configuration du
serveur, déclarée dans la composition de la pile pour être modifiable sans
toucher au dépôt. Aucune route ne l'accorde ni ne le retire.

La régie est une page à part, construite comme une entrée distincte : son code
ne doit jamais partir dans ce que la voiture télécharge.

## Critères d'acceptation

- [x] Un compte dont l'adresse figure dans la configuration voit la liste ; la
      comparaison ignore la casse.
- [x] Un compte dont l'adresse n'y figure pas reçoit 404 sur chaque route de
      régie, et sa page n'annonce rien.
- [x] Un visiteur sans session reçoit le même 404, pas un 401 qui le
      renseignerait.
- [x] Un compte sans adresse enregistrée n'est jamais administrateur.
- [x] Aucune route n'écrit la liste des administrateurs — vérifié, pas
      seulement affirmé.
- [x] La liste est triée par date de création décroissante, et la recherche
      filtre par nom et par adresse.
- [x] La construction produit une troisième page ; le poids de l'application que
      la voiture télécharge n'augmente pas.
- [x] La variable des rôles offerts, jusqu'ici absente de la composition de la
      pile, y est déclarée elle aussi.
- [x] Le contrat rejoué en HTTP vérifie que la page de régie est servie, à côté
      du cas qui existe déjà pour le relecteur.
- [x] Contrôle qualité vert.
