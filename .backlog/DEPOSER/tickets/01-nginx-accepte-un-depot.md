# 01 — Le serveur accepte un dépôt, et lui seul

**Statut :** ⬜ prêt

**Bloqué par :** aucun, peut démarrer tout de suite

## Ce qu'il faut obtenir

Un dossier du NAS, servi à côté de la bibliothèque de profils, accepte l'écriture
d'un fichier depuis l'application — et la refuse à qui n'est pas authentifié.

Aucun service nouveau : le serveur qui sert déjà les fichiers peut en recevoir.
C'est la contrainte du projet depuis le début, et elle tient ici.

**Le préalable est levé.** Le module d'écriture est bien présent : l'image de
base installe le paquet Alpine officiel de nginx, dont la recette liste
`--with-http_dav_module` et n'exclut aucun module. Vérifié à la source du
paquet, faute de Docker sur le poste de développement.

**L'écriture est protégée, et le choix est fait** : elle exige
l'authentification **toujours**, y compris quand l'authentification générale du
site reste désactivée. Un dossier ouvert en écriture sur une adresse joignable
de l'extérieur est une invitation, et le proxy inversé du NAS ne suffit pas à
l'en protéger. Le fichier de mots de passe devient donc obligatoire pour
déposer — `npm run htpasswd` le produit sans Docker. La lecture, elle, reste
libre comme celle des profils.

Seule la méthode d'écriture d'un fichier est ouverte : ni suppression, ni
création de dossier. Une trace déposée ne s'effacera pas depuis le réseau.

**Ce qui reste à éprouver sur le NAS** : que le processus du serveur ait le
droit d'écrire dans le volume monté. Les droits d'un dossier partagé DSM ne sont
pas ceux d'un conteneur, et c'est le genre de détail qui ne se voit qu'au premier
dépôt.

## Critères d'acceptation

- [x] La présence du module d'écriture dans l'image de base est établie, ou un
      repli est retenu et écrit
- [ ] 🧑 Un dépôt authentifié aboutit, et le fichier est ensuite lisible —
      demande le NAS, la configuration n'est pas éprouvable au poste
- [ ] 🧑 Un dépôt non authentifié est refusé — même raison
- [x] Le dossier de dépôt est un volume du NAS, hors de l'image
- [x] La marche à suivre est dans le README, au même endroit que celle des
      profils
- [x] Les deux piles — production et essai — ne se marchent pas dessus
