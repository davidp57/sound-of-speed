# 03 — La base existe, et elle se remonte toute seule au démarrage

**Statut :** ⬜ prêt

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

- [ ] Le schéma couvre comptes, moteurs, boîtes, profils, traces et droits
- [ ] Les migrations sont versionnées et jouées au démarrage, sans intervention
- [ ] Une base absente est créée ; une base déjà à jour n'est pas touchée
- [ ] Relancer le serveur deux fois de suite ne change rien à la base
- [ ] Un compte unique est semé au premier démarrage
- [ ] La base vit dans un volume, et survit au remplacement du conteneur —
      **vérifié en remplaçant réellement le conteneur**
