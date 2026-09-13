# La base

Un fichier SQLite dans un volume, un schéma décrit en TypeScript, des migrations
versionnées jouées au démarrage.

```bash
npm run base:migrations    # après toute modification du schéma
```

## Ce qui est en colonnes, et ce qui ne l'est pas

Un profil porte cent cinquante-huit réglages, un moteur vingt-sept de plus. Les
étaler en colonnes créerait une **seconde description** de ces objets, à tenir
d'accord avec celle du cœur. Le dépôt a déjà payé le prix de deux
implémentations d'une même notion — c'est le lot MOUVEMENT, où deux lectures de
« est-ce qu'on ralentit ? » se contredisent depuis le 8 septembre 2026.

Le cœur reste donc la seule autorité sur la forme d'une entité. La base garde le
contenu tel quel, et n'ouvre en colonnes que ce sur quoi elle trie, filtre ou
joint : un identifiant, un compte, un nom, une date.

## Les dix tables

| Table | Ce qu'elle porte |
|---|---|
| `accounts` | les comptes ; l'adresse est facultative et le restera |
| `rights` | ce qu'un compte ouvre, et jusqu'à quand |
| `engines`, `gearboxes`, `profiles` | les trois groupes de réglages qu'un profil assemble |
| `deposits` | tout ce qui remonte de la voiture : traces, journal, relevés |
| `measured_cars` | ce que le serveur a appris de la vraie voiture, un par compte |
| `auth_sessions` | qui tient le volant en ce moment — **pas** les sessions de conduite |
| `auth_identities` | les façons de prouver qui on est : un mot de passe, un fournisseur tiers |
| `auth_verifications` | ce qui attend d'être confirmé ; rien ne s'en sert encore |

**Les trois dernières appartiennent à la bibliothèque d'identité**, et elle seule
y écrit. Le préfixe `auth_` n'est pas décoratif : ce que cette bibliothèque
appelle un *account* est un moyen de prouver qui on est, et une *session* y dit
qui est connecté — deux mots que ce dépôt emploie déjà pour tout autre chose.

**Elle se pose sur `accounts`, et non l'inverse.** Adopter la table qu'elle
apporte aurait obligé à recréer les six tables qui désignent un compte, SQLite ne
sachant pas déplacer une clé étrangère : il refait la table, c'est le motif
`__new_deposits` de la migration 0002. La mapper a coûté trois colonnes et un
fichier de configuration, et la migration 0006 n'a recréé aucune table.

**Les droits sont là avant d'être utiles.** Tout le monde a tout, rien n'est
encaissé. Les poser plus tard coûterait une migration de données ; les poser
maintenant ne coûte rien.

**Un seul dépôt pour quatre dossiers.** Le découpage actuel n'a pas été choisi :
quand le journal s'est mis à déposer une tranche toutes les cinq minutes, il a
fallu l'écarter des traces pour ne pas alourdir leur listage. Une base n'a pas ce
problème.

**Un profil peut désigner un moteur absent**, et il n'y a donc pas de clé
étrangère entre les deux. C'est ce qui fait marcher le partage : un profil reçu
désigne le moteur de celui qui l'a envoyé, et le cœur sait rendre un moteur d'ici
à sa place. Une contrainte refuserait l'enregistrement.

## Le pilote, et pourquoi celui-là

**libSQL**, un dérivé de SQLite dont le fichier reste un fichier SQLite.

L'image est construite pour deux architectures, dont celle d'un NAS, sur une base
Alpine — donc musl et non glibc. Le pilote habituel de SQLite est un module C++
qu'il faut compiler quand aucun binaire ne correspond, ce qui est le cas courant
sous musl : il faudrait une chaîne de compilation dans l'image, ou en changer la
base. libSQL publie des binaires par plateforme, **musl compris**, pour les deux
architectures visées.

Le module SQLite intégré à Node ferait aussi bien et sans aucune dépendance, mais
l'adaptateur qui le relie à Drizzle n'existe que dans une version non publiée —
la documentation le décrit, le paquet ne le livre pas encore. À rejuger quand
elle sortira.

## Les migrations

Elles sont **versionnées dans le dépôt**, et ce sont elles que le serveur joue au
démarrage — pas le schéma. Le schéma dit où l'on va ; les migrations disent
comment y aller depuis n'importe quel état déjà en service, y compris celui d'un
tiers qui a déployé la version d'avant.

Ouvrir la base est **sans effet au second appel** : les migrations déjà jouées
sont reconnues, et le compte n'est semé que s'il manque. C'est la seule façon
d'accepter qu'une base se migre toute seule au démarrage.

## Le compte unique

Un compte est semé au premier démarrage, et rien ne demande de se connecter. Mais
tout ce qui est rangé appartient à un compte **dès maintenant** : le jour où
l'identité s'ouvre — c'est le lot COMPTES — il n'y aura pas de données orphelines
à rattacher après coup.
