# 13 — Tenir son compte : changer, oublier, emporter, supprimer

**Statut :** ✅ fait — 13 septembre 2026, sauf « j'ai oublié », qui attend un relais de courriel

**Bloqué par :** [11 — Un vrai compte](11-un-vrai-compte.md).

## Ce qu'il faut obtenir

Ce qu'on attend de n'importe quel compte, et qui manque une fois qu'il en est un
vrai : changer son mot de passe, se le faire renvoyer quand on l'a oublié,
**emporter ses données**, et **supprimer son compte**.

## Ce à quoi il faut faire attention

- **« J'ai oublié » demande un relais de courriel**, donc une configuration. Chez
  David, celui du NAS. Sans relais, le bouton n'apparaît pas : il n'y a rien à
  oublier puisque rien ne peut être renvoyé.
- **Supprimer emporte tout** — profils, moteurs, boîtes, trajets, profil mesuré,
  droits —, en deux temps, et c'est irréversible. La cascade de la base le fait
  déjà ; ce qui manque est le geste, et ce qui l'entoure.
- **Emporter ses données passe avant de supprimer**, et l'écran le propose à ce
  moment-là. Tranché par David le 13 septembre 2026.
- **Le navigateur de la voiture refuse les téléchargements.** C'est un fait déjà
  constaté, et c'est la raison d'être de la remontée au serveur. Donc : un fichier
  à télécharger depuis un poste de travail, un envoi par courriel quand un relais
  est configuré, et **sur la voiture sans relais, l'écran le dit** au lieu
  d'afficher un bouton qui ne fait rien.
- **Le serveur sait déjà faire une archive** : `/sessions/<clé>/archive.zip`
  existe. Ce qu'il faut est la même chose pour tout ce qu'un compte porte.
- **Supprimer le dernier compte ne doit pas casser l'installation.** Le compte
  d'avant l'identité a déjà été absorbé ; un appareil qui revient s'en crée un
  neuf, vide, et c'est le comportement attendu.

## Critères d'acceptation

- [x] Le mot de passe se change depuis l'écran du compte
- [x] « J'ai oublié » n'apparaît pas, faute de relais — et l'écran dit pourquoi
- [x] Tout ce qu'un compte porte s'emporte en un fichier
- [x] Sur la voiture, l'écran dit pourquoi on ne peut pas emporter ici
- [x] Supprimer son compte emporte tout, en deux temps, et le dit avant
- [x] Après suppression, un appareil qui revient repart d'un compte neuf et vide

## Ce qui a été fait, et ce qui a été mesuré

**Changer le mot de passe** passe par la route de la bibliothèque, sans rien
autour : elle exige déjà l'ancien, ce qui est exactement ce qu'il faut. Vérifié
contre le serveur : après le changement, c'est le nouveau qui ouvre et l'ancien
qui ne fait plus rien.

**Emporter** rend une archive zip de tout ce qu'un compte porte —
`src/server/emporter.ts` —, dans l'arborescence du serveur, donc reversable telle
quelle. En flux, comme l'archive d'un trajet, et avec le même outil. Mesuré dans
le navigateur : `application/zip`, nom daté, signature `PK`.

**Supprimer** efface la ligne du compte et laisse la cascade emporter le reste.
Le mot de passe est exigé **quand le compte en a un** : sans cela, un appareil
laissé déverrouillé suffirait à tout effacer ; un compte anonyme, lui, n'a que
son témoin, et c'est déjà ce qui ouvre tout le reste. Deux temps à l'écran, comme
la réinitialisation par section. Vérifié : plus de session, identité locale
oubliée, et **les profils de l'appareil intacts** — ce que le message annonce.

**Ce que le serveur sait faire est demandé, pas supposé.** Une route
`/compte/possibilites` dit s'il y a un relais de courriel et quels comptes tiers
il accepte ; l'écran n'offre rien d'autre. Elle servira telle quelle au
[ticket 12](12-un-compte-tiers.md).

## Ce qui reste : « j'ai oublié »

**Bloqué sur une ressource que David détient**, et sur une décision qu'il doit
prendre :

1. Les paramètres du relais du NAS — serveur, port, compte d'envoi.
2. Une dépendance de production pour parler SMTP. `nodemailer` est le choix
   ordinaire ; le dépôt demande de proposer une dépendance avant de l'ajouter,
   et elle n'a pas été ajoutée.

Tant qu'aucun relais n'est configuré, l'écran dit franchement qu'un mot de passe
perdu l'est pour de bon. Le reste du ticket ne dépendait pas de ce point, et est
livré.
