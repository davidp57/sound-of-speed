# 01 — Chaque profil porte ses valeurs d'origine

**Statut :** ✅ fait

**Bloqué par :** aucun, peut démarrer tout de suite

## Ce qu'il faut obtenir

Un profil sorti du guide de création porte ce qu'il était à sa création, et la
réinitialisation le lui rend — au lieu de lui rendre les réglages de Sport.

Le champ est facultatif : les deux profils livrés se retrouvent à leur
identifiant, et un profil venu d'une version antérieure garde le repli d'avant
plutôt que de se voir attribuer une origine inventée.

## Critères d'acceptation

- [x] Le guide de création attache au profil ses propres valeurs d'origine
- [x] Réinitialiser une section rend ces valeurs, et non celles de Sport
- [x] L'identifiant, le nom et le statut de favori ne sont jamais réinitialisés
- [x] L'origine survit à la réinitialisation : on peut la refaire
- [x] Un profil livré se retrouve toujours à son identifiant
- [x] Un profil sans origine retombe sur le comportement documenté d'avant
- [x] L'origine est relue et réécrite avec le profil
