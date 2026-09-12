# IMPERFECTIONS — un moteur ne tourne pas juste

**Statut :** ✅ fait — clos le 2026-09-06, trois tickets sur trois
**Branche :** `feature/imperfections`, puis `feature/imperfections-boucle`
**Version visée :** 0.3

Relevé en roulant le 3 septembre 2026 : « je trouve le son pas assez réaliste.
On ne dirait pas un vrai moteur, mais plus GTA 5. On pourrait — mais c'est pas
suffisant — introduire quelques imperfections, ralenti un poil instable, etc. »

Le reproche était juste, et la cause n'était pas où l'on croyait : rien ne
bougeait pendant la lecture, chaque couche étant une seule boucle jouée à
l'identique. Trois remèdes : un tremblement de régime d'autant plus marqué qu'il
est bas, un léger désaccord entre les deux couches d'une même famille, et une
reprise de lecture ailleurs dans l'enregistrement toutes les six secondes en
moyenne, par un fondu croisé de vingt millisecondes.

Deux parades prévues au ticket 03 ont été essayées puis écartées sur mesure :
les deux instances permanentes en fondu croisé lent, et l'alignement de la
nouvelle position sur le cycle moteur.

Il restait une écoute en roulant, jamais faite sur une accélération juste : le
relief de charge travaillait sur zéro jusqu'au correctif du lot
[HORODATAGE](../HORODATAGE/spec.md), le 10 septembre 2026.

## Tickets

| # | Titre | Statut |
|---|---|---|
| 01 | Le régime tremble, d'autant plus qu'il est bas | ✅ fait |
| 02 | Deux couches ne jouent plus parfaitement d'accord | ✅ fait |
| 03 | La boucle ne se répète plus à l'identique | ✅ fait |
