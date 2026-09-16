# 05 — Un curseur de réglage qui n'agit plus

**Statut :** ⬜ prêt — demande un arbitrage

Trouvé en instruisant le ticket 01. Le réglage **« Déclenché au-delà de »**
(`feel.kickdown.loadThreshold`) est présenté dans l'écran Avancé, avec un curseur
de 0,3 à 1 et une valeur par défaut de 0,75 — et **la boîte ne le lit pas**. Elle
prend le seuil du mode de conduite, `kickdownLoadFor(driveMode)`.

C'est le commit `3be339e` (lot [PLANCHER](../../PLANCHER/spec.md), 11 septembre
2026) qui l'a débranché ; le curseur est resté. David lui-même a cru que le seuil
valait 0,75 en lisant son profil : le réglage affiché induit en erreur celui qui
le lit.

## L'arbitrage à rendre

- **Le rebrancher** — le seuil redevient un caractère de profil, et le mode de
  conduite ne fait que le décaler. Un réglage de plus à tenir juste, et deux
  endroits où une valeur peut être fausse.
- **Le retirer** — le seuil appartient au mode de conduite, et le profil n'a plus
  à en parler. Demande une montée de `PROFILE_FORMAT_VERSION` et la reprise des
  profils déjà enregistrés.
- **Ne rien faire** — et le dire dans le README, ce qui est fait à titre
  provisoire depuis le ticket 01.

## Critères d'acceptation

- [ ] L'arbitrage est rendu par David.
- [ ] L'écran, le schéma de profil et le README disent la même chose que le code.
