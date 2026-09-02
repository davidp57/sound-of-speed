# 01 — Vitest et ESLint en place

**Statut :** ✅ fait

**Bloqué par :** aucun, peut démarrer tout de suite

## Ce qu'il faut obtenir

`npx vitest run` et `npx eslint src/` s'exécutent depuis un dépôt fraîchement
installé et rendent un verdict. Un premier test, court et réel, passe : il porte
sur une fonction pure du cœur, pour prouver que la chaîne fonctionne de bout en
bout sans simulation d'environnement.

ESLint accepte le code existant. S'il remonte des avertissements de fond, ils
sont corrigés dans ce ticket quand c'est mécanique ; ce qui demande une décision
part en ticket séparé plutôt que d'être fait à la va-vite ou éteint par une
exception globale.

## Critères d'acceptation

- [x] `npm run test` et `npm run lint` existent dans `package.json` et lancent
      respectivement Vitest et ESLint
- [x] `npx vitest run` passe, avec au moins un test qui vérifie un comportement
      réel de `core/`
- [x] `npx eslint src/` passe sur le code existant, sans règle désactivée
      globalement pour y arriver
- [x] Aucune dépendance nouvelle dans `dependencies` : tout va en
      `devDependencies`
- [x] Le poids du paquet de production est inchangé
