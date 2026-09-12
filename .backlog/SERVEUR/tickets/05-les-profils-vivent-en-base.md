# 05 — Les profils, les moteurs et les boîtes vivent en base

**Statut :** ⬜ prêt

**Bloqué par :** 03 — La base existe · 04 — Le serveur sert l'application.

## Ce qu'il faut obtenir

La bibliothèque de profils est servie depuis la base, et le dépôt d'un profil
écrit en base. Vu du client, **rien n'a changé** : mêmes adresses, même forme de
listage, mêmes codes.

C'est la première tranche où une donnée quitte le disque, et c'est la plus sûre
pour commencer : un profil est petit, il se relit à l'œil, et il est déjà décrit
par un schéma que le cœur valide.

## Pourquoi écrire en base maintenant, et non plus tard

Décidé le 12 septembre 2026. Faire vivre le serveur sur le disque pour le
basculer ensuite reviendrait à écrire deux fois le code d'accès aux données, et
à laisser à la reprise des données un travail qui n'est pas le sien. La reprise
ne fait plus que **rapatrier ce qui existe** ; elle ne refait pas le chemin.

## Ce à quoi il faut faire attention

Le listage doit garder la forme de l'autoindex — un tableau d'entrées
`{ name, type }` — parce que quatre modules du cœur la lisent et que le service
worker distingue un listage d'un fichier à la barre oblique finale. Un profil
reste donc **désigné par un nom de fichier**, même si ce n'est plus un fichier.

## Critères d'acceptation

- [ ] Le listage des profils vient de la base, au format d'autoindex, et la
      bibliothèque s'affiche sans qu'aucun écran ait été retouché
- [ ] Lire un profil rend exactement le même contenu qu'avant
- [ ] Déposer un profil l'écrit en base, et il réapparaît au listage suivant
- [ ] Déposer deux fois le même nom remplace, sans doublon
- [ ] Les refus gardent leur sens : mauvais compte et droits manquants restent
      non rejouables
- [ ] La part « profils » du test d'accord passe contre le nouveau serveur
- [ ] Les moteurs et les boîtes suivent le même chemin
