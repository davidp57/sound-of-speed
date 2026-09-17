# 02 — Une trace part toute seule, et repart au retour du réseau

**Statut :** 🧑 à moitié prouvé le 17 septembre 2026 — une trace part bien toute seule : les trois trajets du 16 sont sur le serveur, 81 tranches, sans geste de David. Reste « et repart au retour du réseau », qui demande une vraie coupure : le parking souterrain

**Bloqué par :** 01 — Un seul accord, qui dit tout ce qui part

## Ce qu'il faut obtenir

Une trace enregistrée en roulant part sur le NAS sans qu'on y pense, dès que
l'enregistrement s'arrête et que l'accord le permet. Enregistrée hors réseau —
le cas normal sur une route — elle attend, et part d'elle-même quand le réseau
revient.

C'est ici que naît la **file de dépôt**, parce que c'est ici qu'elle sert
d'abord : le journal la rejoindra, et les autres natures s'y poseront sans
réécrire ce mécanisme. Ce qu'on pose dans la file y reste jusqu'à ce qu'il soit
parti ; ce qui est parti la quitte.

Trois échecs se distinguent, et ils ne se traitent pas pareil : un compte absent
se corrige à l'écran de configuration, un refus veut dire que le mot de passe ne
correspond pas, et un réseau injoignable n'est **pas** une erreur — c'est le seul
cas qui justifie de garder pour plus tard.

Une trace déjà déposée ne se dépose pas deux fois, et une trace n'est jamais
effacée du stockage local au motif qu'elle est partie.

## Critères d'acceptation

- [ ] 🧑 Une trace enregistrée avec l'accord au troisième cran part sans geste
- [x] Une trace enregistrée sans réseau est mise en attente, pas perdue
- [x] Le retour du réseau déclenche le dépôt sans intervention
- [x] Ce qui est parti quitte la file ; ce qui a échoué pour cause de réseau y
      reste
- [x] Un compte absent ou refusé ne fait pas boucler la file, et se dit
- [x] Une trace déjà déposée n'est pas redéposée
- [x] La trace reste dans le stockage local après son dépôt
- [x] Rien ne part quand l'accord est en dessous du troisième cran
- [x] La file se vérifie sans réseau ni serveur, dans les tests de `core/`

## Fait, le 6 septembre 2026

La file est écrite, vérifiée par onze tests sans réseau ni serveur, et gardée
d'une session à l'autre. Vérifié dans le navigateur : un dépôt sans compte
n'appelle pas le réseau et le dit, un dépôt avec un compte part réellement, et le
serveur de développement répond 404 — il n'a pas ce dossier.

**Reste à voir en roulant** qu'une trace enregistrée part d'elle-même : cela
demande le NAS et la voiture.
