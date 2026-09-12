# SERVEUR — un seul service TypeScript à la place de nginx et du profileur

**Statut :** ⬜ prêt
**Branche :** plusieurs, c'est le gros morceau
**Version visée :** 0.4
**Dérivé de :** [PLATEFORME](../PLATEFORME/spec.md)
**Bloqué par :** [OUVRIR](../OUVRIR/spec.md), pour la procédure d'installation
et le `.env.example` que ce lot reprend et complète.

## Ce qu'il faut obtenir

Un conteneur, un langage. Le serveur sert l'application, expose une interface, et
range dans une base ce qui vivait dans cinq dossiers.

**À compte unique.** Rien ne change pour David : pas de connexion, pas de
compte à créer. Les comptes sont le dernier lot, et les mélanger à celui-ci
reviendrait à démêler l'authentification pendant qu'on déplace les données.

## Le problème

nginx fait trois métiers qui ne sont pas les siens — le magasin (`dav_methods
PUT`), l'index (`autoindex_format json`) et l'authentification (un `htpasswd`
unique, le même mot de passe partout, tapé à la main dans la voiture). À côté, un
second conteneur Node relit le dossier des traces toutes les cinq secondes pour
savoir si quelque chose est arrivé.

Relevé le 12 septembre 2026, `docker/nginx.conf` tient **huit `location`** :
`/assets/`, `/audio/` avec son index JSON et ses FLAC servis par plages,
`/profiles/`, `/mesure-voiture/`, `/traces/`, `/journal/`, dont quatre en
écriture. C'est l'inventaire exact de ce que le serveur doit reprendre.

Ce que ce modèle ne sait pas faire est détaillé dans
[PLATEFORME](../PLATEFORME/spec.md) : pas d'identité, pas de requête, pas de
suppression.

## Ce qu'on construit

### Un manifeste, trois dossiers

Un `package.json` à la racine ; sous `src/`, le cœur partagé, l'interface, le
serveur. Un `npm install`, un `npm test`, une intégration continue. C'est déjà ce
que le dépôt fait pour le profileur, qui importe cinq modules de `core/`.

Le coût est une discipline plutôt qu'une barrière : rien n'empêche
mécaniquement d'importer une pièce serveur dans une page. **Un contrôle
automatique doit le tenir**, sur le modèle de celui qui vérifie déjà que `core/`
n'importe jamais Vue — `grep -rn "from 'vue'" src/core/` doit rester vide.

### Une base, et des migrations versionnées

SQLite d'abord, dans un volume, portable vers PostgreSQL le jour où le NAS ne
suffit plus. Les migrations sont jouées au démarrage.

**Drizzle** est retenu : son schéma est du TypeScript, donc pas de langage de
plus dans le dépôt, ce qui est la raison même du choix « TypeScript partout ».
Prisma est mieux outillé mais introduit son propre format et un client généré —
exactement le coût qu'on a refusé en écartant PocketBase. C'est une
recommandation assumée et non un arbitrage de David : elle se rejuge au premier
ticket, après essai, comme PLATEFORME le prévoyait.

Le schéma porte **dès le départ** les comptes, les moteurs, les boîtes, les
profils, les traces et les droits — même si, dans ce lot, il n'y a qu'un compte
et que tout le monde a tout. Le faire plus tard coûterait une migration.

### Les huit routes reprises

Le serveur rend ce que nginx rendait, et le reste continue de marcher sans que
rien n'ait à le savoir. Le profileur disparaît en tant que service : le serveur
sait quand une trace arrive, il n'a pas à scruter un disque.

**Un point à mesurer et non à supposer** : servir `/audio/` en Node aussi bien
que nginx. Vingt-trois mégaoctets de FLAC, des requêtes par plages, sur un NAS
Synology. C'est faisable proprement, ça ne se décrète pas.

### Un seul service dans le `docker-compose.yml`

Image tirée du registre avec construction en repli, migrations au démarrage,
`.env.example` commenté. C'est le patron relevé sur Solde.

### Déployé sur `:develop`, la production reste

Le nouveau serveur prend l'étiquette de développement, à son adresse. La
production actuelle continue de servir dans la voiture et fait repli. La bascule
se fait quand le neuf convainc.

Le coût est connu et assumé : la production reste figée pendant ce temps, et les
lots qui attendent une écoute en roulant attendent encore, sauf à être essayés
sur `:develop`.

## Ce qu'on ne construit pas

- **Les comptes.** Un compte unique, pas de connexion, pas d'écran d'identité.
- **La reprise des données existantes.** C'est [MIGRER](../MIGRER/spec.md) — le
  serveur doit d'abord exister.
- **L'effacement et la rétention.** C'est [RETENTION](../RETENTION/spec.md).
- **Héberger ailleurs que sur le NAS.** La pile doit rester déployable
  n'importe où, le déménagement n'est pas au programme.

## Critères d'acceptation

- [ ] Un seul conteneur remplace nginx et le profileur, et le
      `docker-compose.yml` ne déclare qu'un service
- [ ] Les huit emplacements de `nginx.conf` sont rendus par le serveur, et
      l'application marche sans qu'aucun écran ait été retouché
- [ ] Le débit de `/audio/` est **mesuré** sur le NAS, chiffre à l'appui, et
      comparé à celui de nginx
- [ ] Les migrations sont versionnées et jouées au démarrage
- [ ] Le schéma porte comptes, moteurs, boîtes, profils, traces et droits
- [ ] Une arrivée de trace est vue par le serveur sans qu'il scrute un dossier
- [ ] Un contrôle automatique interdit d'importer une pièce serveur depuis
      l'interface, comme celui qui garde `core/` de Vue
- [ ] La pile tourne sur `:develop` et la production `:latest` est intacte
