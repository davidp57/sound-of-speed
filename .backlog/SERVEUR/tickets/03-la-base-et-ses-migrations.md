# 03 — La base existe, et elle se remonte toute seule au démarrage

**Statut :** ✅ fait le 12 septembre 2026

**Bloqué par :** 02 — Un manifeste, trois dossiers. La base est une pièce du
serveur, et le serveur n'a pas encore de place où vivre.

## Ce qu'il faut obtenir

Une base dans un volume, dont le schéma se décrit en TypeScript et dont les
migrations sont versionnées et jouées au démarrage. Qui installe la pile n'a
rien à préparer : le premier lancement crée ce qu'il faut.

## Ce que le schéma porte, dès maintenant

Comptes, moteurs, boîtes, profils, traces, **et droits** — même si, dans ce lot,
il n'y a qu'un compte et que tout le monde a tout. Poser ces tables plus tard
coûterait une migration de données ; les poser maintenant ne coûte rien.

Un compte unique est semé au premier démarrage. Rien ne demande de se connecter,
rien n'a changé pour qui utilise déjà l'application : l'identité est le dernier
lot.

## Le choix de l'outil

**Drizzle**, sur SQLite d'abord, portable vers PostgreSQL le jour où le NAS ne
suffit plus. Son schéma est du TypeScript, donc il n'ajoute pas un langage de
schéma au dépôt — c'est la raison même du « TypeScript partout ». Décidé le
12 septembre 2026 ; si l'essai dément la promesse, c'est ici qu'on le dit, pas
trois tickets plus loin.

## Critères d'acceptation

- [x] Le schéma couvre comptes, moteurs, boîtes, profils, traces et droits
- [x] Les migrations sont versionnées et jouées au démarrage, sans intervention
- [x] Une base absente est créée ; une base déjà à jour n'est pas touchée
- [x] Relancer le serveur deux fois de suite ne change rien à la base
- [x] Un compte unique est semé au premier démarrage
- [x] La base vit dans un volume, et survit au remplacement du conteneur —
      **vérifié en remplaçant réellement le conteneur**

## Ce que la réalisation a changé au choix de l'outil

Drizzle tient, et son schéma en TypeScript est bien ce qui a été arbitré. Mais
**la liaison visée n'existe pas encore** : la documentation décrit l'adaptateur
vers le module SQLite intégré à Node, et le paquet publié ne le livre qu'en
version candidate.

Le pilote retenu est donc **libSQL**, un dérivé de SQLite dont le fichier reste un
fichier SQLite. Il publie des binaires par plateforme, musl compris, pour les deux
architectures visées : rien à compiler dans une image Alpine. Le pilote habituel
de SQLite est un module C++ qu'il aurait fallu compiler, ou dont il aurait fallu
changer la base de l'image.

C'est réversible en deux lignes, et le code le dit comme à rejuger.

## Ce que ce ticket a mesuré en passant

**Le paquet que le navigateur télécharge ne grossit pas** — 288 kilo-octets,
inchangé — alors que Drizzle et libSQL viennent d'entrer dans les dépendances. La
frontière posée au ticket 02 empêche mécaniquement ces pièces d'entrer dans le
paquet de la voiture. C'est ce pour quoi elle existe, vérifié au ticket suivant.
