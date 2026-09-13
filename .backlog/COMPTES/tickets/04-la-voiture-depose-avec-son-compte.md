# 04 — La voiture dépose avec son compte, et le mot de passe partagé s'efface

**Statut :** ✅ fait — 13 septembre 2026, avec le ticket 03

**Bloqué par :** [02 — Un compte se crée tout seul](02-un-compte-se-cree-tout-seul.md),
[03 — Ce que porte `solo` change de mains](03-ce-que-porte-solo-change-de-mains.md).
Déposer sous un compte suppose le compte, et suppose que ce qu'il a déjà déposé
lui appartienne.

## Ce qu'il faut obtenir

Ce que la voiture envoie part sous son compte, et non plus sous un mot de passe
partagé saisi une fois à l'écran de configuration. Les deux champs d'identifiants
de dépôt disparaissent — c'était déjà écrit dans la refonte.

Le fichier `htpasswd` cesse d'être la porte des dépôts.

## Ce à quoi il faut faire attention

- **Douze fichiers passent par `DepositCredentials`** : la capture, le journal,
  l'export, la bibliothèque de profils, le rapatriement, le relecteur, l'état de
  l'application. Ce ticket change ce qui s'annonce, pas qui appelle.
- **Une page dépose hors de l'application.** `public/sonde/sonde.js` relit le
  compte dans le stockage du navigateur et compose son propre en-tête. Elle
  n'apparaît dans aucun écran, et personne ne la verra casser.
- **Le jeu `accord` s'annonce en « Basic »**, et l'intégration continue lui
  fabrique un compte jetable. Le contrat change ici : c'est le seul endroit du
  dépôt où le changement se verra tout de suite, et c'est tant mieux.
- **Le refus ne se rejoue pas.** 401 et 403 sont les deux seuls codes que la
  voiture ne réessaie pas. Une session expirée rendue par un code de panne
  ferait rejouer un dépôt toutes les minutes, indéfiniment.
- **Hors réseau, la file continue de remplir.** Un dépôt qui ne part pas parce
  qu'il n'y a pas de réseau n'est pas un dépôt refusé : la distinction existe
  déjà dans le code, elle ne doit pas se perdre.
- **`htpasswd` part s'il ne sert plus à rien — et ça se vérifie.** Six endroits
  le connaissent : `comptes.ts`, l'option du serveur, `npm run htpasswd`,
  `scripts/accord/htpasswd-essai.mjs`, la pile Docker et le README. Il faut
  passer les six en revue avant de le retirer, pas seulement le premier : un
  fichier de mots de passe à moitié retiré est une porte qu'on croit fermée.

## Critères d'acceptation

- [x] La voiture dépose sous son compte, sans mot de passe saisi
- [x] Les deux champs d'identifiants de dépôt ont disparu de l'écran de
      configuration
- [x] Une session expirée rend un refus que le client ne rejoue pas
- [x] Hors réseau, la file garde et repart au retour, comme avant
- [x] La sonde autonome dépose encore — sans rien lire ni composer
- [x] Le jeu `accord` est à jour et passe
- [x] Les endroits qui connaissent `htpasswd` sont passés en revue — *ils sont
      treize et non six, et il ne part pas partout : voir ci-dessous*

## Ce que l'essai a donné

**Il n'y a plus rien à composer.** La page et le serveur sont sur la même origine,
donc le témoin de connexion voyage tout seul. Vérifié dans un navigateur : un
dépôt de profil rend 201 et la liste le retrouve, sans un seul identifiant.

**Le jeu `accord` prend son compte au serveur** comme le ferait un navigateur qui
ouvre l'application pour la première fois : 45 passés, 0 échoué, 0 sauté, sans
aucun identifiant.

**Un défaut trouvé en vérifiant, et il aurait été silencieux.** Le stockage local
vidé alors que le témoin, lui, était resté : l'application demandait un compte
anonyme, la bibliothèque répondait que ce compte ne peut pas se reconnecter, et
l'appareil n'obtenait plus jamais d'identité — donc plus aucun dépôt ne partait,
la file attendant une identité qui ne venait pas. Le serveur est désormais
interrogé **avant** toute demande : lui seul sait ce que ce navigateur porte, le
témoin étant fermé au code de la page.

**Dix tests vérifiaient l'en-tête d'annonce et le « pas de compte saisi, on ne
demande rien ».** Ils ne sont pas supprimés mais retournés : ils vérifient
maintenant qu'aucune authentification n'est composée, et que la requête part
quand même.

### `htpasswd` : treize endroits, et il ne part pas partout

Le ticket en annonçait six. Le relevé en donne treize hors documentation, et
surtout : `docker/nginx.conf`, `docker-compose.yml` et `docker-compose.develop.yml`
sont ceux de **l'ancienne pile, qui sert encore la production**. L'y retirer
reviendrait à ouvrir la production.

Il part donc du **serveur TypeScript** : le module `comptes.ts` et son test, son
option d'environnement, sa pile Docker, et l'intégration continue qui lui
fabriquait un compte jetable. `bcryptjs` passe en dépendance de développement, ne
servant plus qu'aux scripts qui produisent le fichier pour nginx.

`--compte` reste dans le jeu `accord`, pour une seule raison écrite dans son
en-tête : l'ancien serveur ne connaît que le mot de passe partagé. L'option
partira avec lui.

### Ce qu'il faut savoir avant de publier

**L'application ne sait plus déposer sur l'ancienne pile.** Elle ne compose plus
d'en-tête d'annonce, et nginx n'attend que cela. Tant que ce lot n'est pas publié,
rien ne casse — la production sert l'application d'avant. Le jour où on publie,
**la production doit être passée au serveur TypeScript**, ce que le lot
[SERVEUR](../../SERVEUR/spec.md) prévoit déjà. C'est un ordre d'opérations, pas un
défaut, mais il ne se devine pas.

### Le poids, mesuré

**394 octets de moins qu'avant le lot** : 445 576 octets avant l'identité,
445 182 avec. L'identité complète pèse **moins** que le mot de passe partagé
qu'elle remplace — le code d'authentification retiré compense celui qui demande un
compte.
