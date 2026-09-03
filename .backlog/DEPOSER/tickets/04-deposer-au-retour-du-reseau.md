# 04 — Un dépôt en attente part au retour du réseau

**Statut :** ⬜ prêt

**Bloqué par :** 02 — Déposer une trace enregistrée en roulant

## Ce qu'il faut obtenir

Une trace enregistrée hors réseau — le cas normal sur une route, l'application
étant faite pour fonctionner sans lui — se met en attente de dépôt, et part
d'elle-même quand le réseau revient. On n'a pas à s'en souvenir.

Ce qui est en attente se voit : sans cela, l'utilisateur ne sait pas si sa trace
est en sûreté ou perdue, et c'est le genre de doute qui fait tout refaire.

Le stockage local conserve déjà les traces d'une session à l'autre, ce qui donne
la matière : il ne manque que la file d'attente et le déclenchement au retour.

**Le quota reste une limite réelle** : le stockage local a déjà échoué à garder
une trace longue, et cet échec est signalé — c'est un acquis à ne pas perdre.
Une file d'attente qui grossit sans fin le rendrait plus fréquent, pas moins :
ce qui est déposé quitte la file.

## Critères d'acceptation

- [ ] Une trace enregistrée sans réseau est mise en attente, pas perdue
- [ ] Ce qui est en attente est visible, et son nombre est lisible
- [ ] Le retour du réseau déclenche le dépôt sans intervention
- [ ] Une trace déposée quitte la file d'attente
- [ ] Un échec répété ne boucle pas indéfiniment et se signale
- [ ] L'échec d'écriture du stockage local reste signalé comme aujourd'hui
