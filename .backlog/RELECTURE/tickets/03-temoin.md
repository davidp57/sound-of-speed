# 03 — Un témoin dit si la session sera exploitable

**Statut :** ✅ fait

**Bloqué par :** 01 — la capture démarre toute seule et remonte par tranches

## Ce qu'il faut obtenir

En roulant, David voit d'un coup d'œil si ce qu'il est en train de vivre sera
récupérable au retour. Un seul point, sur l'écran de conduite, comme le voyant
d'une caméra qui enregistre.

Trois états, et la frontière est la récupérabilité :

- **vert** — la capture tourne et les tranches partent ;
- **orange** — ça se rattrapera tout seul : dépôt en attente de réseau, GPS qui
  rejette beaucoup de positions ;
- **rouge** — c'est perdu : mot de passe refusé, GPS mort, écriture impossible.

Le témoin est **absent** quand l'envoi est coupé : un rouge permanent pour un
choix délibéré est une alarme qu'on apprend à ignorer, et le jour où elle compte
on ne la voit plus.

Il prend le pire des états de ce qu'il surveille — la capture, son dépôt, la
santé du GPS. Le détail de ce qui cloche se lit sur l'écran de télémétrie, qui
porte une ligne d'état : ce qui capture, combien d'échantillons, quand la
dernière tranche est partie, ou pourquoi rien ne part.

Le témoin ne bouge pas et ne clignote pas. Sa couleur change, c'est tout : un
écran qui se lit en conduisant ne doit rien avoir qui attire l'œil sans raison.

## Critères d'acceptation

- [ ] Capture en cours, dépôts réussis : le témoin est vert.
- [ ] Réseau coupé, tranches en attente dans la file : il passe à l'orange, et
      revient au vert quand elles partent.
- [ ] Mot de passe du dépôt refusé : il passe au rouge.
- [ ] Accord de remontée pas au dernier cran : aucun témoin.
- [ ] Deux soucis simultanés de gravités différentes : le témoin montre le pire.
- [ ] L'écran de télémétrie dit ce que le témoin résume, en toutes lettres.
- [ ] Le témoin n'a aucune animation.
