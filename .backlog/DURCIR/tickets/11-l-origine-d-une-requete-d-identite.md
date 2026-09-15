# 11 — L'origine d'une requête d'identité

**Statut :** ✅ fait — la prémisse du ticket était fausse

**Bloqué par :** aucun, peut démarrer tout de suite

## Ce que le ticket supposait

Que sans adresse publique, la garde qui refuse les requêtes venues d'un autre
site « ne garde plus rien », l'adresse de référence étant déduite de ce que
l'appelant annonce.

## Ce que la mesure dit

**La garde mord, avec ou sans adresse publique.** Mesuré le 15 septembre 2026,
sur deux serveurs montés côte à côte : une requête de rattachement d'adresse
portant le témoin d'un navigateur connecté et annonçant une origine étrangère est
**refusée dans les deux cas**, et la même requête annonçant la nôtre passe.

Sans adresse publique, l'origine annoncée est comparée à l'**hôte de la
requête** — pas à ce que l'appelant annonce comme origine. C'est le bon contrôle.
Ce qu'on perd est plus étroit, et réel : ce contrôle dépend alors de l'hôte que
le proxy inversé transmet. Fixer l'adresse supprime cette dépendance.

Refuser de démarrer sans elle, comme le ticket le proposait, aurait donc coupé
des installations qui marchent pour corriger un défaut qui n'existe pas.

## Ce qui a été fait

- **Le cas est figé dans le jeu de requêtes d'accord**, et pas dans la suite de
  tests. La bibliothèque désarme cette garde hors production **et fige la lecture
  de l'environnement à son import** : sous le lanceur de tests, le contrôle est
  éteint, et un test écrit là passerait au vert sans rien mesurer. C'est la même
  mécanique qui cache la limitation de débit du ticket 12, et elle est vérifiée :
  un premier jet de test passait au vert en mesurant une garde désarmée.
- Le jeu d'accord sait désormais annoncer une **origine étrangère**, et pas
  seulement la nôtre.
- Le serveur **signale l'absence d'adresse publique à chaque démarrage**, en
  disant ce que ça change — pas un refus de démarrer.
- Le README dit ce que l'adresse change pour ce refus, mesure à l'appui.

## Critères d'acceptation

- [x] Une requête d'identité venue d'une autre origine est refusée, et un test le
      montre — dans le jeu d'accord, contre un serveur qui tourne.
- [x] Un serveur mal configuré le dit au démarrage. **Franchement, et sans
      refuser de démarrer** : la mesure ne justifie pas de couper le service.
- [x] La documentation d'installation dit quoi mettre, et pourquoi.

## Ce qui a été vérifié

59 cas d'accord au vert contre un serveur qui tourne, dont le cas neuf qui reçoit
bien un 403 sur une origine étrangère.
