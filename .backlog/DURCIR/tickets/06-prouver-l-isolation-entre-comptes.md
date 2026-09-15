# 06 — Prouver l'isolation entre comptes, route par route

**Statut :** ✅ fait

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

- [x] Chaque route qui touche aux données d'un compte est couverte, sans
      exception : listages, lectures, écritures, effacements, épingles, archives,
      verdict de rétention.
- [x] Une route ajoutée plus tard sans son contrôle fait rougir le test, plutôt
      que de passer inaperçue.
- [x] Ce que le test attrape est corrigé ici, ou écrit comme accepté avec sa
      raison.

## Ce que le test a trouvé : rien

**L'isolation était juste.** Onze cas, dix routes, deux comptes réels tous deux
correctement annoncés : le voisin ne voit rien dans aucun listage, reçoit 404 sur
chaque affaire désignée par son nom, n'emporte ni l'archive d'un trajet ni rien
de l'autre dans la sienne, n'efface ni n'épingle ce qui n'est pas à lui, et
déposer au même nom crée le sien sans toucher à l'autre.

Ce ticket ne corrige donc aucun défaut. Il transforme une propriété qui tenait
par la relecture en une propriété qui tient toute seule.

## Comment on sait que le test mord

Un test qui passe sur du code juste ne prouve rien tant qu'il n'a pas rougi.
Deux mutations ont été jouées, puis annulées :

| Mutation | Ce que le test a fait |
|---|---|
| Retirer le filtre de compte d'une lecture de dépôt | rouge — le voisin lisait la trace de l'autre |
| Ajouter une route non déclarée | rouge, et il la nomme |

## Ce qui reste à la charge du suivant

L'inventaire des routes vit dans le fichier de test. Une route neuve doit y être
classée : couverte, ou hors sujet avec sa raison. C'est ce qui empêche le filet
de se démailler tout seul.
