# 14 — Offrir la source depuis l'application

**Statut :** ✅ fait — c'était déjà le cas

**Bloqué par :** aucun, peut démarrer tout de suite

## Ce qu'il faut obtenir

La licence du projet couvre l'usage **en service** : qui se sert de l'application
par le réseau doit pouvoir en obtenir la source. Elle doit donc être offerte dans
l'interface, avec la version servie — une offre de source qui ne dit pas de
quelle version elle parle n'en est pas vraiment une.

## Critères d'acceptation

- [x] L'application donne le lien vers sa source et la version servie, trouvables
      sans chercher.
- [x] La version affichée correspond à ce qui est construit, et se vérifie sur
      l'image publiée.
- [x] L'arbitrage sur l'obscurcissement est écrit, avec sa raison, là où on le
      reproposera.

## Rien à faire : c'était déjà en place

L'écran d'aide porte une section « Code source et licence » qui dit la licence,
donne l'adresse du dépôt en lien cliquable, et affiche à côté la version servie.
Le commentaire qui l'accompagne cite déjà la section 13 de la licence et
explique pourquoi la version accompagne le lien.

La version vient de `package.json` au moment de la construction, donc elle suit
l'image publiée sans rien à tenir à la main.

**Ce ticket n'aurait pas dû exister sous cette forme.** Il a été écrit sur un
relevé tronqué : la recherche qui a conclu « aucun écran ne propose la source »
avait été coupée à vingt lignes, et les lignes de l'écran d'aide tombaient après
la coupure. Le constat était faux, et il a été répété dans la conversation avant
d'être vérifié.

L'arbitrage sur l'obscurcissement du code servi, lui, est écrit dans la
spécification du lot, à la section « Ce qui est écarté ».
