# TEST-CORE — mettre le cœur sous test

**Statut :** ✅ fait — clos le 2026-09-02
**Branche :** `feature/test-core`
**Version visée :** 0.2

Le projet n'avait aucun test : le contrôle qualité s'arrêtait aux types. Or
`core/` est du calcul, et du calcul dont la justesse s'entend. Le lot pose
Vitest et ESLint, et couvre `core/` — **211 tests, 94,6 % des lignes**
(83,8 % des branches, 91,7 % des fonctions), au-delà des 80 % visés.

Quatre défauts trouvés en écrivant les tests, aucun corrigé ici : repris par
[FIX-CORE](../FIX-CORE/spec.md).

## Tickets

| # | Titre | Statut |
|---|---|---|
| 01 | Vitest et ESLint en place | ✅ fait |
| 02 | Le conditionnement du signal sous test | ✅ fait |
| 03 | Le moteur et la boîte sous test | ✅ fait |
| 04 | Le mixage et l'analyse sous test | ✅ fait |
| 05 | Les profils sous test | ✅ fait |
| 06 | Le filet dans la CI et dans le contrôle qualité | ✅ fait |
