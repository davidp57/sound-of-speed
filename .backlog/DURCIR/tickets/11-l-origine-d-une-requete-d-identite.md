# 11 — L'origine d'une requête d'identité

**Statut :** ⬜ prêt

**Bloqué par :** aucun, peut démarrer tout de suite

## Ce qu'il faut obtenir

La bibliothèque d'identité garde ses routes en comparant l'origine de la requête
à l'adresse publique du serveur. Cette adresse est **facultative** : sans elle,
elle se déduit de la requête — donc de ce que l'appelant annonce. Derrière un
proxy inversé, la garde ne garde alors plus rien, et rien ne le signale.

Après ce ticket, cette configuration est franche : le serveur refuse de démarrer
sans adresse publique, ou déclare explicitement les origines qu'il accepte. Le
cas est prouvé par un test, pas par une lecture de la documentation de la
bibliothèque.

## Critères d'acceptation

- [ ] Une requête d'identité venue d'une autre origine est refusée, et un test le
      montre.
- [ ] Un serveur mal configuré le dit au démarrage, franchement, plutôt que de
      servir une garde inopérante.
- [ ] La documentation d'installation dit quoi mettre, et pourquoi.
