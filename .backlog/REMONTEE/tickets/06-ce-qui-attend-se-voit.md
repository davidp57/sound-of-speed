# 06 — Ce qui attend se voit, et la file ne mange pas le stockage

**Statut :** ⬜ prêt

**Bloqué par :** 03 — Un profil réglé en voiture se retrouve sur les autres
appareils

## Ce qu'il faut obtenir

L'application dit ce qui est parti et ce qui attend. Sans cela, on ne sait pas si
ce qu'on a enregistré est en sûreté ou perdu, et c'est le genre de doute qui fait
tout refaire.

Ce qui attend se compte et se nomme, avec la dernière raison d'échec en clair. Un
échec qui se répète ne boucle pas indéfiniment : les tentatives s'espacent, et
l'on peut relancer à la main.

**Le quota est une limite réelle.** Le stockage local a déjà échoué à garder une
trace longue, et cet échec est signalé — c'est un acquis à ne pas perdre. La file
est donc bornée : au-delà, le plus ancien cède la place, et cela se dit. Une file
qui grossit sans fin rendrait l'échec d'écriture plus fréquent, pas moins.

## Critères d'acceptation

- [ ] Ce qui attend est visible, avec son nombre et sa nature
- [ ] La dernière raison d'échec est lisible, en clair
- [ ] Un échec répété espace les tentatives au lieu de les répéter
- [ ] Une relance manuelle est possible
- [ ] La file est bornée, et l'éviction du plus ancien se dit
- [ ] L'échec d'écriture du stockage local reste signalé comme aujourd'hui
- [ ] La file survit au rechargement de la page
