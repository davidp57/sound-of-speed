# 06 — La régie affiche l'heure universelle

**Statut :** ✅ fait le 17 septembre 2026

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

- [x] La fiche de compte affiche l'heure locale, comme le relecteur.
- [x] Aucun autre écran n'affiche une clé de session à la place d'une heure —
      vérifié : le relecteur affichait déjà l'instant, et c'était le seul autre
      endroit où une clé de trajet s'écrit.

## Comment

La liste des trajets rendait `trajet.cle`. Elle rend l'instant que le serveur
envoie déjà à côté — `enregistreLe`, en millisecondes —, passé par
`dateLisible()`, qui accepte maintenant une date ISO comme un instant. Le type
client ne déclarait pas ce champ, ce qui explique qu'on ait affiché la clé.
