# 06 — Le filet dans la CI et dans le contrôle qualité

**Statut :** ⬜ prêt

**Bloqué par :** 02, 03, 04 et 05 — tous les tickets de couverture

## Ce qu'il faut obtenir

Le filet sert : aucune PR ne peut être fusionnée si les tests ou ESLint sont
rouges, et le contrôle qualité documenté dans `CLAUDE.md` devient celui qu'on
lance vraiment.

Ce ticket ferme le lot. Il n'ajoute pas de test : il branche ce qui existe.

## Critères d'acceptation

- [ ] Le workflow d'intégration lance `typecheck`, `lint`, `test` et `build` sur
      chaque PR vers `develop` et vers `main`
- [ ] Le contrôle qualité de `CLAUDE.md` n'a plus de version « aujourd'hui » et
      de version « cible » : il n'y en a plus qu'une, celle des quatre commandes
- [ ] La couverture de `core/` est mesurée et rapportée, avec le chiffre atteint
      inscrit dans la spécification du lot
- [ ] Le tableau « État du projet » du README porte le lot et son état
- [ ] La checklist par changement de `CLAUDE.md` ne mentionne plus les tests
      comme conditionnels
