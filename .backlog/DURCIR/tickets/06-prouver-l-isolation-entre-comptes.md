# 06 — Prouver l'isolation entre comptes, route par route

**Statut :** ⬜ prêt

**Bloqué par :** aucun, peut démarrer tout de suite

## Ce qu'il faut obtenir

Toutes les requêtes filtrent sur le compte, à chaque couche — mais rien ne le
vérifie : le jeu de tests du serveur ne manipule **qu'un seul compte**. C'est le
point qui ferait perdre des données à quelqu'un, et c'est le seul sans filet.

Après ce ticket, deux comptes réels parcourent toutes les routes qui touchent aux
données d'un compte, et il est prouvé que le second ne lit pas, n'écrit pas,
n'efface pas, et ne voit pas dans un listage ce qui appartient au premier. Le
test s'écrit d'abord ; ce qu'il attrape se corrige ici.

Ce ticket pose aussi le banc à deux comptes dont les tickets 07 et 08 se servent.

## Critères d'acceptation

- [ ] Chaque route qui touche aux données d'un compte est couverte, sans
      exception : listages, lectures, écritures, effacements, épingles, archives,
      verdict de rétention.
- [ ] Une route ajoutée plus tard sans son contrôle fait rougir le test, plutôt
      que de passer inaperçue.
- [ ] Ce que le test attrape est corrigé ici, ou écrit comme accepté avec sa
      raison.
