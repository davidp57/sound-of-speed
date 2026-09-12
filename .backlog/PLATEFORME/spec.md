# PLATEFORME — Speed devient un service qu'on déploie, qu'on partage et qu'on fait vivre

**Statut :** ⬜ cadre — découpé le 12 septembre 2026 en cinq lots d'exécution
**Branche :** un lot d'exécution à la fois — la bascule ne tient pas dans une branche
**Version visée :** 0.5

## Les cinq lots qui en sont dérivés

Dans l'ordre, chacun bloqué par le précédent sauf mention contraire :

| | Lot | Ce qu'il rend possible |
|---|---|---|
| 1 | [OUVRIR](../OUVRIR/spec.md) | le dépôt se forke et le conteneur sonne seul — ne dépend de rien |
| 2 | [SERVEUR](../SERVEUR/spec.md) | un service à la place de nginx et du profileur, à compte unique |
| 3 | [MIGRER](../MIGRER/spec.md) | les réglages rejoignent la base |
| 4 | [RETENTION](../RETENTION/spec.md) | effacer devient possible |
| 5 | [COMPTES](../COMPTES/spec.md) | l'identité et les droits s'ouvrent |

**Pourquoi cet ordre.** OUVRIR ne dépend de rien et se livre en une soirée : le
tenir en premier évite qu'il soit repoussé derrière le gros morceau, et tant
qu'il n'est pas fait, « open source » est une intention et pas un état. SERVEUR
est le seul lot vraiment risqué, et il reste à compte unique pour qu'on ne
démêle pas l'authentification pendant qu'on déplace les données. RETENTION vient
après MIGRER parce qu'effacer avant d'avoir tout rapatrié est le seul geste
irréversible du chantier.

## Ce qui a déclenché

David, le 12 septembre 2026, en ouvrant une question d'architecture :

> je ne suis plus certain que l'architecture qu'on a mise en place (on partait
> d'une petite webapp statique donc sur nginx) soit toujours adaptée.

Puis, quand la conversation a cherché jusqu'où :

> j'ai la ferme intention, dès que le truc sera un peu joli et que l'UX sera
> bien fignolée, d'en faire profiter mon entourage — donc multi-utilisateur ; et
> j'ai aussi l'intention d'aller plus loin : ouvrir à tout le monde.

Et la contrainte qui a tout resserré :

> je veux faire de l'open source, donc je veux qu'un utilisateur avancé puisse
> déployer la pile complète chez lui si ça lui chante, forker le dépôt, me faire
> des PR.

Ce lot est le cadre de cette bascule. Ce n'est pas une unité de travail : les
lots d'exécution en sont dérivés.

## Le problème

### nginx n'est plus un serveur de fichiers depuis longtemps

Relevé le 12 septembre dans `docker/nginx.conf`, il fait trois métiers qui ne
sont pas le sien :

- **le magasin** — `dav_methods PUT` sur quatre dossiers en écriture ;
- **l'index** — `autoindex_format json`, seule façon d'interroger quoi que ce
  soit ;
- **l'authentification** — un `htpasswd` unique, le même mot de passe partout,
  tapé à la main dans la voiture.

À côté, un second conteneur Node relit le dossier des traces toutes les cinq
secondes pour savoir si quelque chose est arrivé.

### Ce que ce modèle ne sait pas faire

Aucun des trois manques ne s'ajoute :

- **pas d'identité.** Un mot de passe partagé ne porte ni compte, ni droit, ni
  quota.
- **pas de requête.** L'index est une liste de noms. Quand le journal s'est mis
  à déposer une tranche toutes les cinq minutes, la parade a été de créer un
  dossier séparé pour ne pas alourdir l'index des traces. C'est un contournement
  d'architecture, déjà payé.
- **pas de suppression.** `PUT` sans `DELETE` : rien ne s'efface, rien ne tourne.
  C'est pourquoi le bouton « tout réinitialiser » du lot
  [REMISE-A-ZERO](../REMISE-A-ZERO/spec.md) est spécifié « sans toucher au
  serveur » — pas par choix, par impossibilité.

### Et le dépôt n'est pas ouvrable en l'état

Deux constats du 12 septembre :

- **aucun fichier `LICENSE`**, et rien dans `package.json`. Un dépôt public sans
  licence est « tous droits réservés » : personne ne peut légalement le forker,
  le redéployer, ni proposer une correction.
- **les 23 Mo d'échantillons sont exclus de git** (`.gitignore`). Qui clone et
  déploie obtient une application de son qui ne fait aucun son.

## Ce qu'on construit

Un **serveur TypeScript unique** qui remplace nginx et le profileur, avec une
base de données dans un volume.

| Aujourd'hui | Demain |
|---|---|
| nginx + WebDAV + autoindex + htpasswd | un serveur Node qui sert l'application et expose une interface |
| cinq dossiers de fichiers | une base : comptes, moteurs, boîtes, profils, traces |
| un conteneur qui scrute le disque | le même serveur, qui sait quand une trace arrive |
| un mot de passe partagé | des comptes, des droits, des quotas |
| deux conteneurs, deux langages | **un conteneur, un langage** |

Le patron de déploiement est celui de **Solde**, relevé le 12 septembre : un
seul service dans le `docker-compose.yml`, image tirée du registre avec
construction en repli, migrations jouées au démarrage, `.env.example` commenté,
premier compte créé depuis des variables d'environnement, et une documentation
d'installation en quatre étapes doublée d'une procédure Portainer pour NAS.

## Les décisions

Prises le 12 septembre 2026, par entretien.

### Une seule application, dont le compte ouvre les écrans

REFONTE prévoyait trois constructions séparées — voiture, atelier, public. Elles
sont abandonnées. Un compte porte des droits, et ce qu'il ouvre décide de ce
qu'on voit : la conduite pour un invité, les réglages pour qui bricole, le banc
pour qui fabrique des moteurs.

La raison est la monétisation : un droit acheté ouvre un écran sans reconstruire
une image. Et un tiers qui déploie installe **une** pile, pas trois.

Le coût est connu : la voiture reçoit du code qu'elle n'utilisera pas. La parade
est le chargement à la demande, qui ramène ce coût près de zéro au prix d'un
découpage du code.

### Un compte anonyme d'abord, une adresse quand elle sert

Le compte se crée tout seul au premier lancement : on monte dans la voiture et
ça marche. Il reste anonyme tant que ça suffit. Une adresse — ou un compte
tiers — se rattache le jour où l'on donne, où l'on achète un droit, ou
simplement pour ne pas perdre ses réglages.

Ce choix garde l'entrée sans friction, rend la récupération possible quand il y
a de l'argent en jeu, et n'impose rien à celui qui déploie chez lui tant que
personne ne rattache d'adresse.

### Une banque de démonstration dans l'image

Une petite banque produite par engine-sim — donc de la synthèse, pas
l'enregistrement d'une vraie voiture — est embarquée dans l'image. Le dépôt reste
léger, le conteneur fait du bruit au premier lancement, et il n'y a pas de
question de droits. Les banques enregistrées restent hors de l'image, comme
aujourd'hui.

### AGPL-3.0

Qui déploie Speed pour d'autres publie ses modifications, même sans distribuer de
fichier. C'est la seule licence courante qui couvre l'usage en service, ce qu'est
devenu ce produit. Elle n'empêche ni le déploiement chez soi, ni le fork, ni les
contributions, ni les dons sur le service d'origine.

engine-sim et les dépendances du dépôt sont sous MIT, qui se combine avec.

### TypeScript partout

Relevé le 12 septembre : `core/` fait 19 473 lignes de code et 15 599 lignes de
tests. **10 900 de ces lignes sont partagées** entre le navigateur et le
serveur — le format des profils, la lecture des traces, l'étalonnage — parce que
les deux doivent calculer la même chose.

Ce partage n'est pas théorique : le profileur a été écrit en une journée le
11 septembre parce qu'il importe cinq modules de `core/`. Son propre Dockerfile
le dit — c'est la raison d'être de ce service en Node plutôt qu'ailleurs.

Le dépôt a déjà payé le prix de deux implémentations d'une même notion : deux
lectures de « est-ce qu'on ralentit ? » se contredisent depuis le 8 septembre,
c'est le lot [MOUVEMENT](../MOUVEMENT/spec.md). On ne recommence pas à l'échelle
de dix mille lignes.

Conséquence assumée : on quitte le motif de Solde, qui est en Python. La
différence entre les deux projets est structurelle — dans Solde, le client
affiche et le serveur calcule ; ici, une boucle tourne soixante fois par seconde
dans le navigateur et doit s'accorder avec le serveur.

### Analyser puis oublier, sauf ce qu'on épingle

Le stockage décide de la facture, pas le calcul. Et le profileur cumule ce que
les trajets **montrent**, pas les trajets : une fois analysée, une trace ne sert
plus qu'au relecteur.

Donc : à l'arrivée, le serveur analyse et cumule le résultat dans le profil
mesuré du compte — quelques kilo-octets qui ne grossissent pas. La trace brute
reste consultable un temps borné, puis disparaît. Deux portes de sortie :

- **épingler** une trace l'exempte de l'effacement, en nombre borné par compte ;
- **télécharger** une trace la sort en fichier, et le relecteur sait la relire
  depuis le disque. L'archive longue est chez l'utilisateur, pas sur le serveur.

### Tout migrer

Les réglages vivent à deux endroits : le stockage local du navigateur de la
voiture, et cinq dossiers du NAS. Les deux rejoignent le serveur — profils,
moteurs, boîtes, traces, journal, relevés, profil mesuré.

**Les traces reprises entrent épinglées**, sans quoi la règle de rétention les
effacerait un mois après leur migration.

### Un seul manifeste, trois dossiers

Un `package.json` à la racine ; sous `src/`, le cœur partagé, l'interface, le
serveur. Un `npm install`, un `npm test`, une intégration continue. C'est déjà ce
que le dépôt fait pour le profileur.

Le coût est une discipline plutôt qu'une barrière : rien n'empêche
mécaniquement d'importer une pièce serveur dans une page. Un contrôle
automatique doit le tenir, comme celui qui vérifie déjà que `core/` n'importe
jamais Vue.

### Refonte franche sur l'étiquette de développement

Le nouveau serveur se déploie sur la pile `:develop`, à son adresse. La
production actuelle continue de servir dans la voiture et fait repli. La bascule
se fait quand le neuf convainc.

En interne, deux temps : d'abord le serveur, la base et la migration **à compte
unique** — rien ne change pour David — puis les comptes s'ouvrent.

Le coût est que la production reste figée pendant ce temps : les lots qui
attendent une écoute en roulant attendent encore, sauf à être essayés sur
`:develop`.

### Les droits sont modélisés, rien n'est encaissé

La base porte dès le départ la notion de droit sur un compte — ce qu'il ouvre,
jusqu'à quand — et le code la lit là où il faudra. Mais tout le monde a tout,
gratuitement, et aucun encaissement n'est branché.

Le jour de l'ouverture au monde, brancher un fournisseur de paiement et changer
une valeur par défaut suffit : pas de migration, pas d'écran à refaire, et rien à
désactiver pour celui qui déploie chez lui.

Un droit payé devra fonctionner **hors réseau**, puisque c'est une exigence du
produit. Il prendra donc la forme d'une preuve datée, mise en cache, qui expire.
Elle est contournable par qui veut : le code est public et l'objectif est de ne
pas perdre d'argent, pas d'en gagner. On ne protège pas un secret, on demande une
participation à qui se sert du serveur.

## Les briques

**Vérifié** : [Better Auth](https://better-auth.com/) est sous licence MIT, donc
combinable avec l'AGPL. C'est une bibliothèque TypeScript qui vit dans le code de
l'application — sessions, comptes, rattachement d'identité — et non un service à
déployer à côté. Elle remplace la décision « PocketBase » de
[REFONTE](../REFONTE/spec.md), qui évitait d'écrire l'authentification à la main
mais en ajoutant un second moteur, en Go, avec ses règles dans son propre
langage et une extension qui n'est pas Node.

**Proposé, non vérifié** : un ORM avec migrations versionnées, sur SQLite d'abord
et portable vers PostgreSQL le jour où le NAS ne suffit plus. Drizzle décrit son
schéma en TypeScript, ce qui évite d'ajouter un langage de schéma au dépôt ;
Prisma est plus outillé mais introduit son propre format. Le choix se fait au
premier ticket, après essai.

**À vérifier avant d'écrire une ligne** : le comportement de Better Auth quand
l'appareil est hors réseau, qui est le cas normal de la voiture.

## Ce que ce lot remplace

- **[REFONTE](../REFONTE/spec.md)** — son volet « trois constructions »
  disparaît, son volet compte est repris ici en plus complet, et son choix de
  PocketBase est abandonné. Son ticket 04 reste juste et devient un ticket de ce
  lot.
- **[ATELIER](../ATELIER/spec.md)** — son canal de livraison change : déposer un
  moteur devient une écriture en base, pas un sixième dossier. Ses décisions sur
  ce qui reste réglable au volant tiennent.
- **[MENAGE-UI](../MENAGE-UI/spec.md)** — n'est plus une séparation à la
  fabrication mais une affaire de droits.
- **[REMISE-A-ZERO](../REMISE-A-ZERO/spec.md)** — sa limite « sans toucher au
  serveur » tombe : effacer devient possible.

## Hors périmètre

- **Encaisser de l'argent.** Les droits sont modélisés, le paiement ne l'est pas.
- **Le son.** Le timbre, la synthèse et les banques ne bougent pas ici.
- **La mécanique.** La boîte, le moteur et le signal de vitesse ne sont pas
  touchés par ce lot.
- **Héberger ailleurs que sur le NAS.** La pile doit rester déployable n'importe
  où — c'est la contrainte — mais le déménagement n'est pas au programme.
