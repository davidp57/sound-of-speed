# `accord` — ce que le serveur doit rendre, en exécutable

Un jeu de requêtes qui décrit le contrat entre l'application et son serveur, et
qui se rejoue contre n'importe quelle adresse.

```bash
npm run accord -- http://localhost:8088
npm run accord -- http://localhost:8088 --verbeux
npm run accord -- http://localhost:8088 --compte essai:essai   # ancien serveur
npm run accord -- http://localhost:8088 --admin moi@exemple.fr:son-mot-de-passe
```

`--admin` ouvre les deux cas de régie qui demandent un **administrateur
déclaré** : le jeu prend d'ordinaire un compte anonyme, qui ne peut jamais
administrer — l'administration vient d'une adresse listée dans `SPEED_ADMINS`.
Sans l'option, on ne vérifie que la moitié du contrôle, celle qui refuse.

Il rend 0 quand tout passe, 1 sinon, et dit pour chaque échec ce qu'il attendait.

## À quoi ça sert

**C'est le seul contrôle qui regarde ce qu'un serveur rend.** Les 1 118 tests du
dépôt tournent sur les sources : aucun ne voit une réponse HTTP. Le 12 septembre
2026, une image qui ne se construisait plus est passée à travers une pull request
entièrement verte, pour cette seule raison.

Il existe parce que le serveur va être réécrit — nginx, son WebDAV et son
listage laissent la place à un service en TypeScript. Le même jeu passe contre
l'ancien et devra passer contre le neuf ; l'écart entre les deux est exactement
ce qu'on cherche à ne pas avoir.

## Ce qu'il enferme, et qui ne se devine pas

Tiré d'un relevé de tous les appels réseau du dépôt : vingt-deux requêtes
distinctes, dont quatre contraintes dont la rupture ne s'entend pas. S'y ajoutent
depuis les moteurs et les boîtes, qui n'ont jamais existé sur le serveur de
fichiers, puis les trajets — les lister, les emporter, les épingler, les effacer,
et lire le verdict de la rétention. Quarante-cinq cas en tout.

L'effacement y sert deux fois : il vérifie le geste, et il **rend la base
propre** — le jeu déposait jusqu'ici une tranche de plus à chaque passage, sans
rien pour l'enlever.

| Ce qui est vérifié | Ce que ça casse si on le perd |
|---|---|
| La forme du listage, un tableau d'entrées `{ name, type }` | quatre modules du cœur, et le service worker qui distingue un listage d'un échantillon à la barre oblique finale |
| `application/wasm` sur le binaire du moteur simulé | le son généré en direct ne démarre pas du tout |
| Un type JavaScript sur son module | son import échoue |
| Un vrai 404 sur un chemin de données absent | le client reçoit la page d'application là où il attend du JSON, et la classe « illisible » |
| 401 et 403 sur un dépôt refusé | tout autre code fait rejouer la voiture indéfiniment |
| Le nom d'une tranche rendu tel qu'il a été déposé | le client décide de décompresser **au nom**, jamais au type annoncé |

## Les cas construisent leur propre état

Un cas qui a besoin d'un profil le dépose, puis le relit. Rien ne dépend de ce
qui traîne sur le serveur interrogé, et le jeu se rejoue deux fois de suite sans
se contredire. Les fichiers déposés portent une marque propre à l'exécution.

**Le jeu prend son compte tout seul**, comme un navigateur qui ouvre
l'application pour la première fois : plus rien à saisir, et plus aucun cas sauté
faute d'identifiants. Un serveur qui ne sait pas en donner fait échouer le jeu au
premier cas, ce qui est exactement ce qu'on veut savoir.

`--compte` ne sert plus qu'à une chose : l'**ancien** serveur, celui qui sert
encore la production derrière nginx, ne connaît que le mot de passe partagé.
L'option force alors l'ancienne façon de s'annoncer, et elle partira avec lui.

## Six parts, et trois qu'on n'adresse pas à l'ancien serveur

`--part` en joue une ou plusieurs, séparées par des virgules : `publique` (ce qui
se sert sans compte), `profils` (la bibliothèque), `depots` (ce que la voiture
envoie en roulant), `entites` (les moteurs et les boîtes), `trajets` (les
sessions : les lister, les emporter, les épingler, les effacer, et le verdict de
la rétention), `identite` (le code qui relie un second appareil).

Sans `--part`, tout est joué — c'est ce que fait l'intégration continue contre le
serveur neuf, dans son conteneur comme hors de lui. Le serveur de fichiers, lui,
ne se voit demander ni `entites`, ni `trajets`, ni `identite` : le premier est né
avec la base, le deuxième suppose de savoir regrouper des tranches en trajets, et
le troisième n'existe que depuis que les comptes sont là. La question n'a pas de
sens pour lui, et ces trois exclusions disparaîtront avec lui.

La part `identite` est jouée **en dernier**, et l'ordre compte : demander un code
pose un mot de passe sur le compte du jeu, qui cesse alors d'être anonyme. Rien
en aval n'en dépend aujourd'hui, et c'est ce qu'on préserve en le gardant à la
fin. La **séquence complète** — un second appareil qui scanne et ouvre le même
compte — n'est pas ici : elle demande deux témoins de connexion, que ce cadre ne
sait pas tenir. Elle est vérifiée par `src/server/liaison.test.ts`, qui passe par
le serveur lui-même.

## Où il tourne

Dans l'intégration continue, à chaque pull request, contre l'image construite par
cette même pull request : une pile complète est montée — dossiers de données
vides, compte jetable produit par `htpasswd-essai.mjs` — puis le jeu est rejoué.

## Ce qu'il ne dit pas

**Il ne passe pas contre le serveur de développement**, et c'est normal : Vite
n'est pas le serveur de production. Trois cas y échouent, et ils désignent de
vrais écarts entre le développement et la production — le repli d'application y
répond à la place d'un 404, et il n'y a ni compte ni dépôt. Mesuré le
12 septembre 2026 : 13 passés, 3 échoués, 11 sautés.

**Il ne dit rien des performances.** Le débit des échantillons sur le disque d'un
NAS est une mesure à part, qui appartient au déploiement.
