# 01 — Le serveur accepte un dépôt, et lui seul

**Statut :** ⬜ prêt

**Bloqué par :** aucun, peut démarrer tout de suite

## Ce qu'il faut obtenir

Un dossier du NAS, servi à côté de la bibliothèque de profils, accepte l'écriture
d'un fichier depuis l'application — et la refuse à qui n'est pas authentifié.

Aucun service nouveau : le serveur qui sert déjà les fichiers peut en recevoir.
C'est la contrainte du projet depuis le début, et elle tient ici.

**Le préalable, à vérifier en premier** : que le module d'écriture soit présent
dans l'image de base dont l'image du projet hérite. Cela n'a pas pu être vérifié
au poste de développement, faute de Docker. Si le module manque, deux replis
existent — changer d'image de base, ou renoncer au dépôt par le serveur pour les
grosses données — et le choix appartient à ce ticket, pas aux suivants.

**L'écriture est protégée.** Un dossier ouvert en écriture sur une adresse
joignable de l'extérieur est une invitation ; le site est déjà derrière
l'authentification du serveur et le proxy inversé, et le dépôt doit hériter des
deux. À trancher avant d'écrire la configuration, pas après l'avoir déployée.

## Critères d'acceptation

- [ ] La présence du module d'écriture dans l'image de base est établie, ou un
      repli est retenu et écrit
- [ ] Un dépôt authentifié aboutit, et le fichier est ensuite lisible
- [ ] Un dépôt non authentifié est refusé
- [ ] Le dossier de dépôt est un volume du NAS, hors de l'image
- [ ] La marche à suivre est dans le README, au même endroit que celle des
      profils
- [ ] Les deux piles — production et essai — ne se marchent pas dessus
