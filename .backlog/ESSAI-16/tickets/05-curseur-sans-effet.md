# 05 — Un curseur de réglage qui n'agit plus

**Statut :** ✅ fait — David a tranché le 16 septembre 2026 : « retire le
curseur »

Trouvé en instruisant le ticket 01. Le réglage **« Déclenché au-delà de »**
(`feel.kickdown.loadThreshold`) était présenté dans l'écran Avancé, avec un
curseur de 0,3 à 1 et une valeur par défaut de 0,75 — et **la boîte ne le lisait
pas**. Elle prend le seuil du mode de conduite, `kickdownLoadFor(driveMode)`.

C'est le commit `3be339e` (lot [PLANCHER](../../PLANCHER/spec.md), 11 septembre
2026) qui l'a débranché ; le curseur est resté. David lui-même a cru que le seuil
valait 0,75 en lisant son profil, ce qui a d'abord fait chercher le défaut du
ticket 01 au mauvais endroit.

## Ce qui a été fait

Le seuil appartient au mode de conduite, et le profil n'en parle plus. Le curseur
est retiré de l'écran Avancé, le champ du schéma de profil aussi, et la clé est
**effacée** des profils déjà enregistrés plutôt que laissée morte — le même
idiome que le volume général, pour la même raison : sans quoi le schéma mentirait
à qui le lit.

Les deux autres options ont été écartées par David : rebrancher le curseur
aurait laissé deux endroits où une même valeur peut être fausse ; ne rien faire
aurait gardé un réglage trompeur dans l'écran.

## Critères d'acceptation

- [x] L'arbitrage est rendu par David.
- [x] L'écran, le schéma de profil et le README disent la même chose que le code.
- [x] `PROFILE_FORMAT_VERSION` passe à 11, et un test montre que la clé est
      retirée d'un profil enregistré sans toucher au reste du rétrogradage forcé.
