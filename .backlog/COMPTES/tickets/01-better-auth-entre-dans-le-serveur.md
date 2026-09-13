# 01 — Better Auth entre dans le serveur, sans rien casser

**Statut :** ✅ fait — 13 septembre 2026

**Bloqué par :** aucun, peut démarrer tout de suite.

## Ce qu'il faut obtenir

La bibliothèque est montée sur le serveur, branchée sur la base qui existe, et
elle rend une session. Rien d'autre ne change : la voiture dépose comme avant, le
relecteur lit comme avant, et le jeu de requêtes passe sans qu'on y touche.

C'est la balle traçante de l'identité : une session qui existe et qu'on peut
lire, avant que quoi que ce soit en dépende.

## Ce à quoi il faut faire attention

- **Une seule table d'identité, et c'est `accounts`.** La bibliothèque apporte
  ses modèles — `user`, `session`, `account`, `verification` — mais elle sait se
  poser sur des tables existantes : `modelName` désigne la table, `fields`
  désigne les colonnes, et l'adaptateur Drizzle accepte `provider: "sqlite"`
  (vérifié dans sa documentation le 13 septembre 2026). On l'accroche donc à
  `accounts`, qui porte déjà `id`, `name`, `email` et `createdAt`, et à qui
  pendent six tables par clé étrangère.

  **Pourquoi ce sens-là.** Renommer notre table pour adopter la sienne coûterait
  six recréations de tables — SQLite ne déplace pas une clé étrangère, il refait
  la table, c'est le motif `__new_deposits` de la migration 0002. La mapper coûte
  trois colonnes à ajouter et un fichier de configuration. Si l'essai dément la
  promesse, cela se dit **ici** et pas trois tickets plus loin.

- **Deux mots « compte » qui ne veulent pas dire la même chose.** Ce que la
  bibliothèque appelle `account` n'est pas un compte d'utilisateur : c'est le
  lien vers un fournisseur d'identité. Laisser ce nom à côté de notre `accounts`
  garantit la confusion. Ses tables prennent donc des noms qui ne s'y trompent
  pas, et `CONTEXT.md` dit lequel est lequel.

- **Un compte anonyme n'a pas d'adresse**, et la bibliothèque attend souvent un
  courriel non vide sur un utilisateur. Notre colonne est facultative et le
  restera : c'est la condition pour qu'on monte dans la voiture sans rien saisir.
  Comment elle s'en accommode se vérifie ici, pas au ticket 02.
- **Les migrations sont versionnées ici.** Ce que la bibliothèque veut créer doit
  entrer par le même chemin que le reste — `drizzle-kit generate`, un fichier SQL
  numéroté, joué au démarrage. Une bibliothèque qui crée ses tables toute seule
  au premier appel contournerait la seule porte qu'on a.
- **C'est une dépendance de production**, sur une application qui doit se charger
  hors réseau. Ce qu'elle ajoute au paquet du client se **mesure** dans ce
  ticket, même si le découpage viendra plus tard : un chiffre relevé maintenant
  est le seul point de comparaison qu'on aura.
- **Hono a été choisi pour elle** : il parle en `Request` et `Response`
  standard. Si le montage demande autre chose, c'est un signal, pas un détail à
  contourner.
- **Le jeu `accord` ne doit pas bouger.** Il décrit le contrat que la voiture
  attend ; s'il faut le changer à ce ticket, c'est que quelque chose a cassé.

## Critères d'acceptation

- [x] Le serveur démarre avec la bibliothèque montée, et la base se migre par le
      chemin habituel
- [x] Une session se crée et se relit, vérifiée par un test
- [x] La bibliothèque est accrochée à `accounts` : aucune seconde table
      d'identité, et les six clés étrangères existantes sont intactes
- [x] Un compte sans adresse est accepté
- [x] Les tables de la bibliothèque portent des noms qui ne se confondent pas
      avec le nôtre, et `CONTEXT.md` le dit
- [x] Le jeu `accord` passe sans modification, dans le conteneur comme hors de lui
- [x] Le poids ajouté au paquet du client est mesuré et noté

## Ce que l'essai a donné

**La promesse tient : la bibliothèque se pose sur `accounts`.** Better Auth 1.7.4,
adaptateur Drizzle en `provider: "sqlite"`. La migration 0006 n'a recréé aucune
table — trois `CREATE TABLE` pour les siennes, trois `ALTER TABLE ADD COLUMN` sur
`accounts`. `pragma foreign_key_check` rend vide et les huit tables qui désignent
un compte sont vérifiées par un test.

**Ce qu'il a fallu ajouter à `accounts`** : `email_verified`, `image`,
`updated_at`. Les colonnes qui existaient déjà portaient les bons noms, il n'y a
donc rien eu à renommer sur cette table — seulement sur les siennes.

**Un accroc, et il est résolu dans la migration** : SQLite refuse d'ajouter à une
table peuplée une colonne obligatoire dont le défaut se calcule. `updated_at`
entre donc facultative, avec un `UPDATE` de rattrapage écrit à la main dans le
fichier de migration, et le semis du compte unique la pose désormais lui-même.

**Trois noms**, pour que les deux sens de « compte » et de « session » ne se
croisent pas : `auth_sessions`, `auth_identities`, `auth_verifications`. Le
renommage qui compte est celui du champ que la bibliothèque appelle `accountId`
— l'identifiant **chez le fournisseur**, soit l'inverse exact de ce que
`account_id` désigne partout ailleurs ici : il devient `provider_account_id`.

**Un compte sans adresse est accepté.** Le compte semé au démarrage n'en a pas ;
la bibliothèque le lit et lui ouvre une session. La colonne reste facultative, et
SQLite accepte autant de valeurs absentes qu'on veut dans un index unique.

**Le jeu `accord` passe en entier, sans modification** : 45 passés, 0 échoué,
0 sauté, contre le serveur assemblé hors conteneur.

### Le poids, mesuré

**Zéro octet ajouté au paquet du client** — la bibliothèque n'existe que côté
serveur. Trois des quatre ressources sortent du build **bit pour bit
identiques**, empreinte comprise ; la quatrième n'a changé que parce qu'elle
embarque le numéro de version, et sa taille est la même. Le relevé, qui servira
de point de comparaison le jour où un écran de connexion entrera dans
l'application :

| Ce que la voiture charge | Brut | Comprimé |
|---|---|---|
| `index.html` | 1 184 o | 0,52 ko |
| `assets/index-*.js` | 299 763 o | 99,41 ko |
| `assets/style-*.js` | 119 566 o | 43,95 ko |
| `assets/index-*.css` | 23 018 o | 4,43 ko |
| `assets/style-*.css` | 2 045 o | 0,84 ko |
| **Total** | **445 576 o** | **149,15 ko** |

Le relecteur n'y est pas : la voiture ne le charge pas. Le conteneur, lui,
grossit — la bibliothèque est une dépendance de production installée dans
l'image — et ce n'est pas ce que ce chiffre mesure.

### Ce qui reste à surveiller

**L'avertissement au démarrage** : sans `SPEED_URL`, la bibliothèque signale
qu'elle déduira son adresse de chaque requête. C'est sans conséquence tant
qu'aucun fournisseur d'identité tiers n'a de retour à faire, et la variable est
documentée. Le jour où l'on branche un tiers, ce n'est plus un avertissement.
