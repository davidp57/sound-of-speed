# 05 — Les profils, les moteurs et les boîtes vivent en base

**Statut :** ✅ fait le 12 septembre 2026

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

- [x] Le listage des profils vient de la base, au format d'autoindex, et la
      bibliothèque s'affiche sans qu'aucun écran ait été retouché
- [x] Lire un profil rend exactement le même contenu qu'avant
- [x] Déposer un profil l'écrit en base, et il réapparaît au listage suivant
- [x] Déposer deux fois le même nom remplace, sans doublon
- [x] Les refus gardent leur sens : mauvais compte et droits manquants restent
      non rejouables
- [x] La part « profils » du test d'accord passe contre le nouveau serveur
- [ ] 🚫 **Retiré.** Les moteurs et les boîtes n'ont aucune route : ils vivent
      dans le stockage local du navigateur, et le relevé du contrat est formel —
      seule la bibliothèque de profils existe côté serveur. Leurs tables sont
      posées depuis le ticket 03, mais rien ne peut les remplir tant que le
      client ne les envoie pas, et c'est [MIGRER](../../MIGRER/spec.md) qui
      rapatrie ce qui dort dans les navigateurs. Ce critère supposait une
      symétrie qui n'existe pas ; il est retiré plutôt que coché

## La décision qu'il a fallu prendre

**La bibliothèque s'appuie sur la table structurée, et non sur celle des
dépôts.** Les deux étaient possibles : un profil arrive comme un fichier, et le
ranger tel quel parmi les dépôts aurait suffi à faire passer le contrat.

Mais cela aurait laissé la table des profils vide et inéprouvée, et rendu à la
reprise des données le travail de rebrancher le code d'accès — exactement ce que
la décision du 12 septembre voulait éviter en faisant passer les données en base
**dans ce lot**. Et le serveur devra interroger ces profils : savoir lesquels
appartiennent à un compte, quel moteur ils désignent. Des octets opaques ne le
permettent pas.

Le coût est une migration — la première depuis le schéma initial —, et c'est
précisément ce à quoi les migrations servent.

**Deux noms pour un profil, et ce n'est pas une redondance.** Celui qui s'affiche
dans une liste, et le nom de fichier sous lequel il a été déposé. C'est le second
que la bibliothèque manipule comme identité : lui rendre un nom dérivé du premier
reviendrait à renommer son fichier dans son dos.

**Le serveur ne valide pas la forme d'un profil.** Il refuse ce qui n'est pas du
JSON — le laisser entrer rendrait la bibliothèque muette pour ce fichier, sans
rien dire — et range le reste tel quel. Le cœur est la seule autorité sur la
forme d'un profil, et il la vérifie déjà à la lecture ; un serveur qui validerait
aussi ferait une seconde description à tenir d'accord avec la première.

## Le jeu de requêtes se découpe en trois

`publique`, `profils`, `depots`. Le serveur neuf tient les deux premières — vingt
cas sur vingt — et la troisième lui revient au ticket 06. Nommer les parts évite
le seul mauvais réflexe possible à cet endroit : retirer d'une vérification les
cas qu'on ne sait pas encore passer.
