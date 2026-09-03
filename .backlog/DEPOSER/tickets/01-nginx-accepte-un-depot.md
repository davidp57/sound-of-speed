# 01 — Le serveur accepte un dépôt, et lui seul

**Statut :** ✅ fait

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

## Éprouvé sur le NAS, le 3 septembre 2026

Le doute portait sur les droits d'écriture : ceux d'un dossier partagé DSM ne
sont pas ceux d'un conteneur. Relevé sur la pile d'essai :

| Requête | Réponse |
|---|---|
| Liste du dossier | `200`, `application/json`, liste vide au départ |
| Dépôt authentifié | accepté, sans message |
| Relecture du fichier déposé | le contenu, à l'octet près |
| Dépôt **non** authentifié | `401`, domaine `Speed — dépôt` |

Le refus non authentifié a été essayé sur un fichier **déjà présent** : il n'a
donc rien créé, et le fichier visé était intact après coup — même taille, même
horodatage. La protection refuse avant d'écrire, et non après.

Un détour instructif au passage : la première tentative a répondu `405`, la
pile de production ayant été redéployée au lieu de celle d'essai. Puis `200`
avec du HTML, parce que redéployer une pile ne retélécharge pas son image — une
étiquette comme `develop` garde son nom quand son contenu change. Les deux
pièges sont maintenant dans le README.

## Critères d'acceptation

- [x] La présence du module d'écriture dans l'image de base est établie, ou un
      repli est retenu et écrit
- [x] Un dépôt authentifié aboutit, et le fichier est ensuite lisible
- [x] Un dépôt non authentifié est refusé
- [x] Le dossier de dépôt est un volume du NAS, hors de l'image
- [x] La marche à suivre est dans le README, au même endroit que celle des
      profils
- [x] Les deux piles — production et essai — ne se marchent pas dessus
