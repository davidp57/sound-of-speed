# 06 — La régie affiche l'heure universelle

**Statut :** ⬜ prêt

David : « les heures sont fausses : je suis parti à 19 h, pas à 17 h ». Le
reproche portait d'abord sur un tableau donné en conversation, qui recopiait les
clés de session telles quelles. Mais la vérification a trouvé le même travers
dans l'application : la fiche d'un compte, dans la régie, affiche les **clés
brutes** (`src/regie/FicheDuCompte.vue`), qui portent l'horodatage en temps
universel.

La donnée, elle, est juste. Le nom en temps universel est délibéré — sans quoi
une même tranche daterait de deux heures différentes selon la machine qui la
relit — et `recordedAtOf()` reconstruit l'instant correctement. Le relecteur,
lui, affiche déjà l'heure locale.

## Critères d'acceptation

- [ ] La fiche de compte affiche l'heure locale, comme le relecteur.
- [ ] Aucun autre écran n'affiche une clé de session à la place d'une heure.
