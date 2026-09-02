# 03 — Reconnaître la boucle locale en IPv6

**Statut :** ✅ fait

**Bloqué par :** aucun, peut démarrer tout de suite

## Ce qu'il faut obtenir

Un lien de partage produit depuis une adresse en boucle locale IPv6 est signalé
comme impartageable, au même titre que `localhost` et `127.0.0.1`.

La comparaison est aujourd'hui faite sur `'::1'`, alors que le nom d'hôte rendu
par le navigateur pour une adresse IPv6 conserve ses crochets : `[::1]`. La
comparaison ne se produit donc jamais, et l'avertissement ne s'affiche pas — on
envoie un code à scanner qui ne mènera nulle part, et l'on ne le comprend
qu'une fois le téléphone en main.

## Critères d'acceptation

- [x] Une adresse en `[::1]` est déclarée non joignable
- [x] `localhost` et `127.0.0.1` le restent
- [x] Une adresse IPv6 publique reste joignable
- [x] Le test qui constatait le défaut a été réécrit
