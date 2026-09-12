# `accord` — ce que le serveur doit rendre, en exécutable

Un jeu de requêtes qui décrit le contrat entre l'application et son serveur, et
qui se rejoue contre n'importe quelle adresse.

```bash
npm run accord -- http://localhost:8088
npm run accord -- http://localhost:8088 --compte essai:essai
npm run accord -- http://localhost:8088 --compte essai:essai --verbeux
```

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
distinctes, dont quatre contraintes dont la rupture ne s'entend pas.

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

**Les cas qui demandent un compte sont sautés** quand aucun n'est donné, et le
résumé le dit. Un jeu qui se déclarerait vert en ayant tout sauté serait un jeu
qui ment.

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
