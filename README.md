# Speed

Un son de moteur pour une voiture qui n'en fait pas.

L'application mesure la vitesse au GPS, en calcule un régime moteur et un rapport
de boîte, et joue le son correspondant à partir d'enregistrements réels. Tout se
règle sans couper le son, et les réglages se rangent dans des profils qu'on
sauvegarde, exporte et recharge.

- [Les quatre écrans](#les-quatre-écrans)
- [Démarrer en développement](#démarrer-en-développement)
- [Installation sur un NAS Synology](#installation-sur-un-nas-synology)
- [Une seconde pile, pour essayer l'intégration](#une-seconde-pile-pour-essayer-lintégration)
- [En voiture](#en-voiture)
- [Hors réseau](#hors-réseau)
- [Référence des réglages](#référence-des-réglages)
- [Les échantillons](#les-échantillons)
- [Comment ça marche](#comment-ça-marche)
- [Banc de mise au point](#banc-de-mise-au-point)
- [État du projet](#état-du-projet)

---

## Les quatre écrans

**Conduite** — la vitesse, le rapport, le régime. Le choix de la source
(simulateur, GPS, rejeu), l'activation du son, le volume, la boîte automatique ou
manuelle, et le verrou d'écran. Un bouton **Plein écran** masque la barre du haut : l'affichage
occupe toute la hauteur et les commandes deviennent quatre grandes touches. On en sort par une croix discrète, placée là
pour qu'on n'en sorte pas par mégarde en roulant.

Cet écran a **deux visages**, et deux boutons pour passer de l'un à l'autre :

- **Cadrans** — un tableau de bord. Le compteur de vitesse et le compte-tours
  sont deux cadrans à aiguille, le rapport engagé est écrit en grand entre les
  deux. La zone rouge du compte-tours commence au seuil de coupure, donc le
  plafond se voit sans lire un chiffre. Chaque cadran garde son nombre en petit,
  au centre, pour le réglage et le diagnostic. Le compteur est gradué jusqu'à
  180 km/h — la vitesse à laquelle le dernier rapport touche le rupteur dépasse
  300 km/h sur les deux profils livrés, une échelle qui laisserait l'aiguille
  dans un coin. En plein écran, sur un écran large, les deux cadrans sont côte à
  côte ; en portrait, ils s'empilent, chacun sur toute la largeur.
- **Chiffres** — la vitesse, le rapport et le régime en nombres, avec la
  réglette de régime. C'est cette vue qui sert à régler : cent tours d'écart se
  lisent sur un nombre et ne se voient pas sur une aiguille.

Le choix du visage est une préférence de **l'appareil** : il survit au
rechargement et ne fait pas partie du profil.

Un bouton **Paysage** ajoute, derrière les cadrans, un décor qui défile à la
vitesse du véhicule. C'est de l'agrément assumé : rien ne s'y lit, il se coupe,
et coupé il n'existe pas dans la page. Il s'arrête à l'arrêt, et le navigateur
l'arrête tout seul quand la page passe en arrière-plan — le son, lui, continue.
Ce que le décor coûte est mesuré, dans « Ce qui n'est pas vérifié ».

**Télémétrie** — tout ce qui alimente le son : vitesse brute et lissée, écart de
lissage, pente, accélération, qualité du signal GPS, régime, régime entendu,
charge, état de la transmission, régime que donnerait chaque rapport, gain et
vitesse de lecture de chaque couche sonore, niveau de sortie. C'est aussi là
qu'on enregistre et rejoue les traces.

**Configuration** — deux modes. En **simplifié**, la vue est courte : la
création guidée, les profils, le fonctionnement hors réseau. En **avancé**, la
cinquantaine de réglages détaillés s'ajoute dessous, en curseur et en saisie,
appliqués immédiatement, groupés par section — moteur, transmission, signal,
caractère, mixage, couches. Aucun réglage ne disparaît en simplifié : ils
attendent. Le choix du mode est une préférence de l'appareil, comme le volume :
il se retient et ne voyage pas avec un profil partagé.

C'est aussi là qu'on gère les profils et qu'on analyse les échantillons. Une
bande de défilement longe le bord gauche : le glissement n'y dérègle rien, et
les curseurs eux-mêmes rendent le glissement vertical à la page.

**Étalonnage** — un protocole guidé en six étapes : rouler en ville, sur route,
sur autoroute, puis une accélération franche, une décélération pied levé et un
freinage franc. Chacune s'enregistre à part et **juge si elle a bien été
faite** : une « accélération franche » qui n'atteint pas le critère est refusée,
et la raison est dite, plutôt que de donner une charge fausse. Un récapitulatif
met ensuite le mesuré face au réglé.

Ce que l'étalonnage mesure devient une **couche** par-dessus les profils. Un
profil décrit un son — le caractère d'un moteur, sa boîte, son mixage ;
l'étalonnage décrit une voiture — sa reprise, son freinage, son ralentissement
pied levé, les vitesses qu'on y pratique. Le moteur emploie la composition des
deux. Trois conséquences :

- les mesures valent pour **tous** les profils à la fois, ceux livrés compris —
  une capacité de la voiture n'a pas de raison de ne profiter qu'au profil ouvert
  le jour où on l'a prise ;
- le profil qu'on a réglé n'est **jamais écrasé**. L'écran de configuration
  annonce les réglages que la mesure remplace, et l'on peut refaire ou retirer
  l'étalonnage sans avoir rien perdu ;
- un profil partagé emporte un son, pas les capacités d'une autre voiture —
  la même raison qui a fait sortir le volume général du profil.

**Sans étalonnage, rien ne change** : le profil est employé tel quel.

Aucune animation nulle part : les valeurs changent, rien ne bouge pour le
plaisir. Deux réserves, et deux seulement. Le **paysage** de l'écran de conduite
est une exception assumée, levée sciemment, coupée par défaut. Et l'**aiguille**
d'un cadran n'a jamais relevé de cette règle : son mouvement est la valeur, elle
n'a aucune inertie propre, et un cadran se lit d'un coup d'œil là où un nombre se
lit en le lisant — c'est le même argument d'ergonomie qui fonde la règle.

---

## Démarrer en développement

```bash
npm install
```

```bash
npm run dev
```

Pour tester depuis un téléphone sur le même réseau :

```bash
npm run dev:mobile
```

Le serveur passe alors en HTTPS et écoute sur toutes les interfaces : ouvrir
`https://<adresse-du-poste>:5173`. Le certificat est auto-signé, le téléphone
demande donc de confirmer une fois.

> **Le chiffrement n'est pas décoratif.** La géolocalisation, le verrou d'écran,
> le service worker et l'AudioWorklet n'existent que dans un « contexte
> sécurisé ». `localhost` en est un même en clair — d'où le `npm run dev`
> ordinaire — mais **pas** une adresse de réseau local. En `http://192.168.x.x`,
> la page s'affiche normalement et le GPS refuse de démarrer, sans message.

Au clavier, source « Simulateur » :

| Touche | Effet |
|---|---|
| ↑ | Accélérateur |
| ↓ | Frein |
| ← → | Descendre / monter un rapport, en mode manuel |

Le curseur **Allure maintenue** est un régulateur : le simulateur tient la
vitesse choisie, comme on le fait sur autoroute, jusqu'à ce qu'on accélère ou
qu'on freine. C'est la façon la plus simple d'écouter un régime stabilisé.

Autres commandes :

```bash
npm run dev:mobile   # idem, en HTTPS, pour tester depuis un téléphone
npm run build        # produit dist/
npm run typecheck    # vérification TypeScript stricte
npm run lint         # style et fautes courantes
npm test             # les tests du cœur, une passe
npm run test:watch   # les tests en continu, pendant qu'on écrit
npm run coverage     # couverture de src/core/
npm run transcode    # compresse les échantillons en FLAC
npm run deploy       # recopie le build vers le NAS
npm run icons        # régénère les icônes de l'application
npm run silence      # régénère le silence qui maintient la session audio
npm run htpasswd     # produit un fichier de mots de passe pour nginx
```

Les quatre premières sont le contrôle à passer avant de pousser — c'est
exactement ce que vérifie la chaîne d'intégration. Les tests portent sur
`src/core/`, qui n'importe jamais Vue : ils tournent sous Node, sans navigateur,
en une seconde.

---

## Installation sur un NAS Synology

Une chaîne d'intégration construit l'image et la publie sur le registre de
conteneurs GitHub. **Le NAS ne construit rien et ne reçoit aucun fichier** :
Portainer tire une image prête. Tout se fait dans les interfaces de DSM et de
Portainer ; il n'y a pas de terminal à ouvrir sur le NAS.

Trois étiquettes d'image, selon l'usage : `latest` est la production, publiée
depuis `main` ; `develop` est l'intégration, à tirer dans une seconde pile sur
un autre port pour essayer un lot en voiture avant d'en faire une version ; et
`vX.Y.Z` est une version figée, publiée par son tag.

L'hébergement reste chez soi, ce qui règle du même coup la question des
échantillons, puisque rien n'est publié.

### 1. Créer les dossiers et déposer les échantillons — File Station

Trois dossiers, sous `/volume1/docker/speed/` :

| Dossier | Contenu | Accès |
|---|---|---|
| `audio/procar/` | les échantillons du moteur | lecture |
| `profiles/` | les profils partagés entre appareils. **Peut rester vide** | lecture |
| `traces/` | les trajets enregistrés en roulant, déposés depuis la voiture. **Peut rester vide** | lecture-écriture |

Les trois doivent **exister avant** de déployer la pile : Docker sous DSM ne crée
pas un point de montage absent, il refuse de démarrer le conteneur avec un
`Bind mount failed`. Des dossiers `profiles/` et `traces/` vides suffisent — et à
défaut, il faut commenter leur ligne dans la pile, au prix de la bibliothèque de
profils et du dépôt de traces.

`traces/` est le seul monté en écriture, et le dépôt y est **toujours**
authentifié, même quand l'authentification générale reste désactivée : un
dossier ouvert en écriture sur une adresse joignable de l'extérieur est une
invitation. Il faut donc le fichier de mots de passe pour déposer, voir plus
bas.

Les échantillons restent hors de l'image : ils ne sont ni dans le dépôt ni dans
le registre, et changer de banque sonore consistera à remplacer ces fichiers,
sans rien reconstruire.

### 2. Rendre l'image accessible au NAS

Un paquet publié depuis un dépôt privé est privé lui aussi. **Sa visibilité se
règle pourtant séparément de celle du dépôt** — les deux ne sont pas liées, et
c'est ce qui permet de simplifier cette étape sans ouvrir son code.

**Option recommandée : rendre le paquet public.** Portainer n'a alors plus rien à
authentifier et cette étape disparaît. L'image ne contient que l'application
compilée : ni échantillons, ni secrets — il n'y en a aucun, tout s'exécute dans
le navigateur.

Le réglage se trouve sur le **profil**, pas sur le dépôt — c'est ce qui le rend
introuvable quand on le cherche dans les paramètres du projet :

<https://github.com/users/davidp57/packages/container/speed/settings>

Puis, tout en bas, *Danger Zone* › **Change package visibility** › *Public*.
GitHub demande de retaper le nom du paquet pour confirmer.

Par la navigation : cliquer son avatar › *Your profile* › onglet **Packages** ›
`speed` › *Package settings* dans la colonne de droite. L'onglet Packages
n'apparaît que si l'on est connecté, un paquet privé n'étant pas listé autrement.

**Option conservatrice : garder le paquet privé.** Il faut alors déclarer le
registre dans Portainer › **Registries** › **Add registry** › **Custom
registry** :

| Champ | Valeur |
|---|---|
| Name | GitHub |
| Registry URL | `ghcr.io` |
| Authentication | activé |
| Username | `davidp57` |
| Password | un **jeton d'accès personnel** GitHub |

Le jeton se crée dans GitHub › Settings › Developer settings › Personal access
tokens › Tokens (classic), avec la seule portée **`read:packages`**. Le mot de
passe du compte ne fonctionne pas.

### 3. Créer la pile — Portainer

Portainer › **Stacks** › **Add stack** › **Web editor**, nommer la pile `speed`,
coller le contenu de `docker/docker-compose.yml`, puis **Deploy the stack**.

| À vérifier | Pourquoi |
|---|---|
| Le port `8088` | Il peut déjà servir sur le NAS. Le changer dans la pile si Portainer se plaint |
| Le chemin `/volume1/…` | Le nom du volume peut différer selon le modèle |

Le service répond alors sur `http://<ip-du-nas>:8088` — en clair, et seulement
depuis le réseau local. C'est normal à ce stade : le GPS ne marchera pas encore,
faute de chiffrement.

### 4. Publier en HTTPS — DSM

**Panneau de configuration** › **Portail des applications** › **Proxy inversé** ›
**Créer** :

| Champ | Valeur |
|---|---|
| Description | Speed |
| Protocole source | **HTTPS** |
| Nom d'hôte source | `speed.<votre-nom>.synology.me` |
| Port source | `443` |
| Protocole destination | **HTTP** |
| Nom d'hôte destination | `localhost` |
| Port destination | `8088` |

Le nom DDNS s'obtient dans **Accès externe** › **DDNS** s'il n'existe pas déjà.
Puis **Sécurité** › **Certificat** : obtenir un certificat Let's Encrypt pour ce
nom, et l'affecter à ce service dans **Paramètres**.

### 5. Faut-il ouvrir le NAS sur Internet ?

**Le plus souvent, non** — et c'est un changement récent. Depuis que
l'application fonctionne [hors réseau](#hors-réseau), il suffit de l'ouvrir une
fois chez soi, sur le wifi, en appuyant sur *Préparer hors réseau*. Elle tourne
ensuite sur son cache, en voiture, sans rien demander à personne. Le NAS n'a
alors besoin d'être joignable que pour installer une mise à jour, depuis la
maison.

Si l'on tient malgré tout à y accéder de l'extérieur, il faut rediriger le port
443 de la box vers le NAS — et **l'adresse devient publique**. Activer alors
l'authentification :

```bash
npm run htpasswd
```

Le mot de passe est demandé en saisie masquée, et le fichier `htpasswd` produit
se dépose dans `/volume1/docker/speed/` avec File Station. Il reste à
décommenter les deux lignes `auth_basic` de `docker/nginx.conf` et le volume
correspondant dans la pile.

### Déposer une trace : le fichier de mots de passe

Le dépôt d'une trace exige lui aussi ce fichier, **indépendamment de
l'authentification générale** : `traces/` est le seul endroit du serveur qui
accepte d'écrire, et il ne l'accepte que de quelqu'un qui s'annonce.

En quatre gestes, une fois pour toutes :

```bash
npm run htpasswd
```

1. La commande demande un **nom d'utilisateur**, puis un **mot de passe** — huit
   caractères au minimum, saisi en aveugle, à confirmer. Rien n'apparaît à
   l'écran pendant la frappe, et le mot de passe ne passe pas en argument : il
   resterait dans l'historique du terminal et dans la liste des processus.
   Relancer la commande **ajoute** une entrée au fichier, et remplace celle d'un
   nom déjà présent — il en faudra deux, la vôtre et celle du dépôt.
2. Elle écrit un fichier nommé `htpasswd` dans le dossier courant. Il tient sur
   une ligne : le nom d'utilisateur, puis l'empreinte du mot de passe. Le mot de
   passe lui-même n'y est pas — il n'est pas récupérable, et il faut refaire
   l'opération si on l'oublie.
3. Déposer ce fichier dans `/volume1/docker/speed/` avec File Station.
4. Dans la pile Portainer, **ajouter** les deux lignes suivantes sous
   `volumes:`, puis tirer l'image à jour et redéployer :

```yaml
      - /volume1/docker/speed/traces:/usr/share/nginx/html/traces
      - /volume1/docker/speed/htpasswd:/etc/nginx/htpasswd:ro
```

> **Ajouter, et non décommenter.** Une pile Portainer contient le texte qu'on y
> a collé le jour de sa création, pas le fichier du dépôt : les lignes
> commentées de `docker/docker-compose.yml` n'y sont pas, et le volume des
> traces est de toute façon nouveau. Les commentaires du dépôt indiquent quoi
> monter ; c'est dans l'éditeur de pile que le montage se déclare.

### Redéployer ne suffit pas à changer de version

Mettre une pile à jour recrée le conteneur, mais **Docker réutilise l'image
qu'il a déjà en local** : une étiquette comme `develop` ou `latest` ne change pas
de nom quand son contenu change, et rien n'oblige Docker à aller voir. On croit
donc déployer la dernière version et l'on relance l'ancienne.

Deux façons de s'en assurer :

- dans Portainer, cocher **« Re-pull image and redeploy »** avant de mettre la
  pile à jour ;
- ou nommer l'image par son empreinte de commit. Le workflow publie, à côté de
  `develop` et `latest`, une étiquette immuable `sha-<commit court>` :

```yaml
    image: ghcr.io/davidp57/speed:sha-28cc0a1
```

Docker ne l'a jamais vue, donc il la tire forcément. C'est le moyen le plus sûr
de savoir ce qui tourne, et le seul de revenir à une version précise.

Pour vérifier ce qui tourne réellement, sans Portainer : la date de
`Last-Modified` sur la page d'accueil est celle de la construction de l'image.

```bash
curl -I https://ADRESSE/index.html
```

Le dossier `/volume1/docker/speed/traces/` doit **exister** avant de
redéployer, même vide : Docker sous DSM refuse de démarrer un conteneur dont un
point de montage est absent, avec un `Bind mount failed`.

**Il n'y a rien d'autre à décommenter pour le dépôt.** Les deux lignes
`auth_basic` de `docker/nginx.conf` protègent le site *entier* et ne servent que
si l'adresse est exposée hors du réseau local ; l'emplacement `traces/`, lui,
porte sa propre exigence, déjà active.

Sans ce fichier, le dépôt est refusé — la lecture des traces, des profils et de
l'application continue de fonctionner normalement.

### Deux identifiants, et pourquoi

Le fichier en portera deux, et ce n'est pas une commodité :

| Nom | Sert à | Vit où |
|---|---|---|
| le vôtre | déposer à la main, avec `curl` ou en naviguant | sur le poste de travail |
| `depot` | à l'application, pour envoyer une trace depuis la voiture | dans le navigateur de la voiture |

La raison est que le navigateur ne fournit l'authentification qu'après l'avoir
demandée, et il ne la demande que sur une **navigation** — jamais sur une requête
lancée par l'application. Un dépôt depuis la voiture recevrait donc un refus sans
que rien ne s'affiche. L'application compose elle-même son en-tête, avec un
**jeton** qu'on lui donne une fois.

Ce jeton vit en clair dans le navigateur de la voiture, et c'est un compromis
assumé : qui a la main sur ce navigateur peut déposer un fichier dans le dossier
des traces, mais ni l'effacer — la méthode n'est pas ouverte — ni toucher au
reste du NAS. Votre mot de passe personnel, lui, ne quitte pas le poste.

Donnez au jeton une valeur **que vous pouvez taper**, sans rapport avec vos
autres mots de passe : quelques mots séparés par des tirets font l'affaire, du
genre `route-moteur-tesla-neige`. Vingt caractères prononçables valent mieux
qu'une suite aléatoire ici — il faudra peut-être le saisir sur un écran tactile,
et ce qu'il protège est l'écriture d'un fichier de trace, pas un compte.

`npm run htpasswd`, avec `depot` comme nom d'utilisateur.

### Déposer une trace depuis la voiture

Une fois le jeton créé et le fichier déposé sur le NAS :

1. écran **Configuration**, champ **Jeton de dépôt** : saisir `depot` et le
   jeton. Il n'y a pas de bouton d'enregistrement — comme tous les réglages de
   cet écran, il se retient à la frappe, et la mention à côté du champ le
   confirme. Il est rangé hors du profil : il ne voyage donc pas avec un profil
   partagé, et il n'y aurait aucun sens à envoyer à quelqu'un un son accompagné
   du droit d'écrire sur son NAS ;
2. écran **Télémétrie**, à côté de chaque trace : le bouton **Déposer**.

### Installer le jeton dans la voiture

Le jeton appartient à **l'appareil** : réglé au poste de travail, il n'est pas
dans la voiture — et c'est là qu'il sert. Le bouton **Installer dans la
voiture…** produit l'adresse qui l'y installe :

    https://ADRESSE/#depot=route-moteur-tesla-neige

**Dans une voiture, cette adresse se tape** : son navigateur n'a pas de caméra,
donc le code à scanner affiché à côté ne sert qu'à un téléphone ou une tablette.
C'est la seule raison pour laquelle l'adresse est aussi courte que possible — le
nom d'utilisateur `depot` est implicite — et la seule raison pour laquelle un
jeton prononçable vaut mieux qu'une suite aléatoire. On ne la tape qu'une fois.

Elle fonctionne aussi collée dans un onglet **déjà ouvert** sur l'application, ce
qui est le geste le plus probable : changer le fragment ne recharge pas la page,
et l'application l'écoute quand même.

Le jeton est dans la partie qui suit le `#`, laquelle **n'est jamais transmise au
serveur** ni inscrite dans ses journaux — même raison que pour le partage d'un
profil. Elle est effacée de la barre d'adresse aussitôt lue, pour qu'un
rechargement ne la réinstalle pas indéfiniment et qu'elle ne traîne pas à
l'écran.

Le fichier prend un nom qui dit la date, le nom de l'enregistrement et sa
durée — `2026-09-03-21-16-48_retour-du-boulot-90s.json` — de sorte qu'on le
retrouve sans l'ouvrir. Il se relit par la fonction d'import de cet écran, sur
n'importe quel appareil.

Ce qui peut échouer le dit, et distingue les cas, parce qu'ils ne se corrigent
pas au même endroit :

| Message | Ce qu'il faut faire |
|---|---|
| Aucun jeton de dépôt | le régler à l'écran de configuration |
| Jeton refusé | le nom ou le jeton ne correspond pas au fichier de mots de passe |
| Le serveur n'a pas le droit d'écrire | les permissions du dossier, côté DSM |
| Dépôt impossible | hors couverture : la trace reste enregistrée, réessayer plus tard |
| Déjà déposée | rien, elle est en sûreté |

Une trace n'est **jamais** perdue au profit d'un dépôt raté : elle reste dans le
stockage local, et le dépôt se refait.

> **En développement, le dépôt répond 404.** Il vise le serveur qui sert
> l'application, et celui de Vite n'a pas ce dossier. C'est en production que la
> chose se vérifie.

> Depuis le wifi de la maison, le nom DDNS résout vers l'adresse publique : sans
> **NAT loopback** activé sur la box, l'accès échoue alors qu'il fonctionne en
> 4G.

### 6. Vérifier

1. La page s'affiche, le cadenas est fermé.
2. Écran Conduite › **Activer le son** → le bouton passe à « Son actif ».
3. Source **GPS** → autoriser la localisation → le statut passe à « actif ».
4. Écran Télémétrie → « Intervalles récents » se remplit, autour de 1000 ms.

Si le GPS reste muet alors que la page s'affiche, c'est presque toujours le
contexte sécurisé : vérifier que l'adresse est bien en `https://`.

### Mettre à jour

```bash
git push
```

La chaîne d'intégration vérifie le code, construit l'image pour les deux
architectures et la publie. Ensuite, dans Portainer : ouvrir la pile `speed`,
cocher **Re-pull image and redeploy**, puis **Update the stack**. Les
échantillons ne sont pas touchés, étant montés depuis le NAS.

### Variante sans registre

`docker/docker-compose.volumes.yml` lance `nginx:alpine` tel quel et prend tout
par volumes, y compris le site. Utile pour essayer une modification sans attendre
la chaîne d'intégration, ou pour dépanner si le registre est inaccessible. Elle
suppose de recopier le build sur le NAS :

```bash
setx SPEED_DEPLOY_TARGET "Z:\docker\speed\dist"
```

```bash
npm run build && npm run deploy
```

---

## Une seconde pile, pour essayer l'intégration

L'étiquette `develop` est publiée à chaque lot fusionné, avant qu'il devienne
une version. La faire tourner **à côté** de la pile de production permet
d'essayer en voiture ce qui n'est pas encore sorti, sans toucher à
l'application qui sert au quotidien.

### 1. La pile — Portainer

**Stacks** › **Add stack** › **Web editor**, nommer la pile `speed-develop`,
coller le contenu de [`docker/docker-compose.develop.yml`](docker/docker-compose.develop.yml),
puis **Deploy the stack**.

Les dossiers `audio/` et `profiles/` doivent exister, comme pour la production —
c'est le même arrangement, et les mêmes dossiers.

Elle diffère de la production sur trois points, et les trois comptent : un autre
nom de conteneur, un autre port (`8089`), et une autre adresse dans le proxy
inversé. Les échantillons et les profils déposés sont partagés, en lecture
seule : rien à recopier.

### 2. L'adresse — DSM

**Panneau de configuration** › **Portail des applications** › **Proxy inversé** ›
**Créer** :

| Champ | Valeur |
|---|---|
| Description | Speed (intégration) |
| Protocole source | **HTTPS** |
| Nom d'hôte source | `speed-dev.<votre-nom>.synology.me` |
| Port source | `443` |
| Protocole destination | **HTTP** |
| Nom d'hôte destination | `localhost` |
| Port destination | `8089` |

Puis **Sécurité** › **Certificat** : le certificat Let's Encrypt doit couvrir ce
nom. Le plus simple est de le demander pour les deux noms à la fois, ou d'ajouter
le nouveau nom au certificat existant.

> **Le HTTPS n'est pas du confort ici.** Le GPS, le verrou d'écran et le service
> worker n'existent que dans un « contexte sécurisé ». En HTTP simple — par
> exemple `http://<ip-du-nas>:8089` — la page s'affiche normalement et la
> localisation est refusée **sans message**. Une pile d'essai sans son nom
> d'hôte ne sert donc à rien pour rouler.

### 3. Mettre à jour

Portainer ne remplace pas de lui-même une image devenue obsolète. Après une
poussée sur `develop` : la pile, **Editor**, puis **Update the stack** en cochant
**Re-pull image**. Une dizaine de secondes.

### Ce que les deux piles ne partagent pas

Les **profils enregistrés dans le navigateur**. Le stockage local appartient à
une adresse : les réglages trouvés sur l'une ne suivent pas sur l'autre. Deux
passerelles pour les transporter — le dossier `profiles/` partagé, qui apparaît
dans la bibliothèque des deux, ou le partage d'un profil par lien.

Il en va de même de l'**installation** : chaque adresse s'installe séparément sur
l'écran d'accueil, avec son propre cache hors réseau. C'est voulu — une pile
d'essai qui écraserait le cache de celle qui sert serait une mauvaise idée.

---

## En voiture

**Plein écran** — masque la barre d'onglets, porte l'affichage à toute la hauteur
et remplace les commandes par quatre grandes touches. Sur le visage à cadrans,
les deux cadrans prennent la hauteur disponible : côte à côte sur un écran large,
empilés en portrait.

**Session média** — l'application apparaît sur l'écran verrouillé et dans le
panneau de notifications, avec le nom du profil, sa configuration et une pochette
dessinée à la volée. Les commandes au volant et les boutons de casque coupent et
rétablissent le son.

**Verrou d'écran** — sans lui, l'écran s'éteint au bout de quelques dizaines de
secondes et l'on perd de vue la vitesse. Le système le relâche à chaque passage
en arrière-plan et ne le rend pas au retour : il est donc redemandé à chaque fois
que la page redevient visible. Quand il est refusé, la raison s'affiche à
l'écran — un verrou qui échoue en silence est indiscernable d'un verrou absent.

**Reprise après suspension** — le système suspend le contexte audio quand
l'application reste longtemps en arrière-plan, ou quand un appel prend la sortie
audio. Il ne le relance jamais seul.

---

## Sur un navigateur embarqué

Le navigateur d'une voiture n'est pas celui d'un téléphone, et deux écueils y ont
été rencontrés en roulant.

**L'horodatage des positions** n'y est pas dans la même base que l'heure
courante — vraisemblablement compté depuis le chargement de la page. Les écarts
entre mesures restent justes, donc le suivi de vitesse n'en souffre pas, mais
dater une mesure avec donne un nombre absurde. La réception est donc horodatée
sur notre propre horloge, et l'horodatage fourni ne sert plus qu'à des
différences.

**Le contexte audio peut être suspendu** sans prévenir et sans changement de
visibilité, ce qui coupait le son dès le passage en arrière-plan. Une
surveillance régulière relance donc le contexte et le média silencieux,
indépendamment de tout événement. Ce média est par ailleurs laissé à plein
volume : son contenu est déjà silencieux, et le baisser en plus le ferait passer
pour inactif auprès du système, qui libérerait la session — exactement ce qu'il
sert à empêcher.

---

## Hors réseau

Une voiture traverse des zones sans couverture, et une application chargée depuis
Internet n'y démarre pas. Un service worker met en cache l'application et les
échantillons : une fois cela fait, tout fonctionne sans connexion, et le serveur
n'a plus besoin d'être joignable pour rouler — seulement pour mettre à jour.

Dans l'écran **Configuration**, section *Hors réseau* :

- **Préparer hors réseau** met en cache tous les échantillons du profil sans
  attendre d'en avoir besoin, et affiche ce qui est déjà disponible. À faire
  avant de partir, plutôt que de découvrir sur la route qu'une couche manque.
- **Installer sur l'écran d'accueil** propose l'installation quand le navigateur
  l'autorise. L'application s'ouvre alors en plein écran, sans barre d'adresse.

Une bannière signale une version plus récente prête à être chargée, ou la perte
du réseau.

### Vérifié comment

Le scénario a été déroulé en conditions réelles sur le build de production :
première visite, préparation, **arrêt du serveur**, rechargement. L'application
démarre, les cinq couches se chargent et le son sort — serveur éteint.

Ce test a révélé un défaut qui serait resté invisible autrement. Les serveurs
répondent volontiers `Vary: Origin` sur les fichiers statiques ; une réponse
enregistrée depuis une requête sans en-tête `Origin` ne correspond alors plus à
la même adresse demandée avec — ce qui est le cas du script de l'application, que
Vite déclare `crossorigin`. Résultat : un cache complet, et une page blanche.
Les recherches dans le cache se font donc avec `ignoreVary`.

---

## Référence des réglages

Tout est dans l'écran **Configuration**, appliqué immédiatement. Les sections qui
suivent — moteur, transmission, signal de vitesse, mixage, caractère, couches —
sont celles du **mode avancé** : la bascule en haut de l'écran les fait
apparaître. En mode simplifié, elles sont remplacées par quelques curseurs
globaux qui les commandent.

### Mode simplifié

Le guide de création sait déduire une cinquantaine de réglages de quatre
réponses. Ce savoir ne servait qu'une fois, à la création ; les curseurs globaux
le rendent disponible en continu. Ils **écrasent** les réglages qu'ils
commandent — un curseur global recalcule, il ne peut pas faire autrement — et un
bouton **Revenir aux réglages d'avant** rend le profil tel qu'il était avant le
premier mouvement.

Aucun des deux n'est enregistré dans le profil : leur position s'en **déduit**.
Le curseur reflète donc ce qu'on a réellement sous les doigts, y compris sur un
profil réglé à la main ou reçu par lien. Mesuré : Route se lit à 22 sur cent de
tempérament, Sport à 80 ; les deux se lisent au milieu de la réactivité, le
milieu du curseur étant par construction le réglage qui a servi jusqu'ici.

| Curseur | Ce qu'il commande |
|---|---|
| **Calme ↔ sportif** | Le caractère du moteur et de la boîte : inertie, montée à vide, temps de passage, écart selon la charge, régimes de passage, plancher et délai de croisière, seuil de rétrogradage au freinage, rétrogradage forcé, pétarade, à-coup de passage. Il ne touche ni au pont, ni aux démultiplications, ni au rupteur, ni au mixage. Mesuré sur Route, pied au plancher : la pointe de régime passe de 3929 tr/min au plus calme à 6043 au plus sportif, pour un rupteur à 6500 |
| **Pépère ↔ nerveux** | La réactivité du **signal**, et non le caractère : raideur du lissage, fenêtre d'accélération, lissage de la charge, temporisations de passage. La distinction est réelle — le premier curseur dit si la voiture pousse fort, celui-ci si elle répond vite. Une voiture calme peut être vive, une sportive pâteuse |
| **Nombre de rapports** | De trois à huit, en un appui. Le premier et le dernier rapport sont **conservés**, et le pont avec eux : le régime en dernier rapport à une vitesse donnée ne bouge pas — mesuré, 2355 tr/min à 110 km/h sur Route quel que soit le nombre de rapports. Seuls les rapports intermédiaires se redistribuent, géométriquement, avec les régimes de passage et les temporisations. Pour poser les démultiplications à la main, le champ reste là en mode avancé |

Les bornes du second sont **mesurées** sur une rampe de 0 à 90 km/h en quinze
secondes, bruitée à ±1 km/h comme l'est une mesure GPS, à la cadence la plus
défavorable — une mesure par seconde :

| Position | Marche d'une image à l'autre | Retard sur la vitesse vraie |
|---|---|---|
| Pépère (raideur 6) | 0,242 km/h | 556 ms |
| Milieu (raideur 14) | 0,433 km/h | 409 ms |
| Nerveux (raideur 22) | 0,675 km/h | 369 ms |

La vitesse reste continue même au plus nerveux : le ressort est amorti critique,
il ne produit pas de marche, et 0,675 km/h par image vaut une quinzaine de tours
par minute en dernier rapport. À la cadence du GPS d'une Tesla en mouvement —
une mesure toutes les trente-trois millisecondes — la marche tombe à 0,376 km/h
et le retard à 334 ms : plus le GPS parle, plus le suivi est à la fois doux et
juste.

La fenêtre d'accélération suit la même logique, et son prix se paie sur la
charge : à une cadence de 250 ms, une fenêtre de 400 ms laisse l'accélération
lue trembler à 1,51 m/s² d'écart-type, contre 0,85 à 1600 ms.

Deux interrupteurs restent à la main : le **rétrogradage forcé** et l'**à-coup de
passage** ne se coupent jamais tout seuls — couper ce que quelqu'un a activé
exprès n'est pas un caractère. La **pétarade**, elle, s'éteint au plus calme :
c'est la règle du guide de création, et une voiture tranquille ne claque pas à
l'échappement.

### Moteur

| Réglage | Ce qu'il fait |
|---|---|
| **Cylindres enregistrés** | Décrit le moteur des **échantillons**, pas celui qu'on veut entendre : il ne modifie pas le son, celui-ci venant d'enregistrements où le moteur est figé. Il sert à convertir la raie d'allumage en régime lors de l'analyse — une valeur fausse y proposerait des ancrages faux, dans le même rapport |
| **Ralenti** | Régime au point mort, moteur non entraîné |
| **Seuil de coupure** | Régime auquel l'allumage commence à être coupé |
| **Rupteur** | Plafond absolu du régime |
| **Durée de coupure** | C'est le hachage qui produit le crépitement, pas le plafonnement |
| **Inertie** | Poids du volant moteur : temps de montée à vide |
| **Montée à vide** | Prise de tours hors prise, en tr/min par seconde |
| **Frein moteur** | Retombée pied levé |
| **Tremblement au ralenti** | Amplitude du tremblement de régime, en tr/min, prise au ralenti et pied levé. Elle décroît ensuite quand le régime monte et quand la charge monte — un moteur se stabilise en poussant. Mesuré sur Sport, réglé à 35 : 34 tr/min d'excursion au ralenti, ±18 à 3000 tr/min pied levé, ±7 pied au plancher. Zéro donne un régime parfaitement lisse, ce qu'aucun moteur thermique n'est. **Il ne va que dans le son** : la boîte, ses seuils et la télémétrie gardent le régime net |
| **Vitesse du tremblement** | Fréquence de la composante rapide. Une composante lente à un peu plus d'un dixième de cette valeur s'y ajoute — 0,70 Hz pour 6 Hz réglés : à une seule fréquence, le tremblement s'entend comme un vibrato |

### Transmission

| Réglage | Ce qu'il fait |
|---|---|
| **Démultiplications** | Du plus court au plus long, séparées par des virgules. Une seule valeur = prise directe. En **changer le nombre** redimensionne du même coup les régimes de passage et les temporisations, qui sont indexés par rapport : ils sont redistribués depuis le tempérament que porte le profil. À nombre égal, rien d'autre ne bouge |
| **Pont** | Rapport final |
| **Rupteur atteint à** | Vitesse au rupteur dans le dernier rapport. **Modifier cette valeur recalcule le pont** — c'est le chiffre parlant |
| **Rayon de roue** | En mètres. Entre dans le calcul du régime |
| **Temps de passage** | Durée de la coupure de couple |
| **Passage 1 → 2**, **2 → 3**, … | Régime auquel chaque rapport cède la place au suivant, à charge moyenne. Un curseur par passage : c'est le seul moyen d'empêcher les rapports courts de monter au rupteur sans faire passer les longs trop bas. L'aide indique la vitesse correspondante |
| **Écart selon la charge** | De combien le passage recule pied au plancher et avance pied levé, de part et d'autre des valeurs ci-dessus |
| **Dispersion aléatoire** | Tirée au sort à chaque passage. Sans elle, la boîte passe toujours au même régime exact et s'entend comme une machine |
| **Ne jamais monter sous** | Plancher appliqué aux régimes de passage ci-dessus, toutes charges confondues : il empêche l'écart de charge de faire monter un rapport à un régime où le moteur peinerait. Sans effet sur le rétrogradage — c'est **Descente sous** qui le commande |
| **Descente sous** | Seuil de rétrogradage, en fraction du rupteur, quand la vitesse n'est ni tenue ni franchement en baisse. Trop bas, la boîte reste sur le dernier rapport bien après qu'il n'a plus de sens. Mesuré sur le profil Sport, la quatrième cède la place à 46 km/h à 0,20 du rupteur, et à 114 km/h à 0,50 |
| **Croisière au-dessus de** | Quand on tient une vitesse, la boîte monte les rapports d'elle-même et s'arrête juste avant de descendre sous ce régime. C'est le réglage qui décide de l'assiette en croisière : trop bas le moteur broute, trop haut il reste inutilement haut. Sur Route, 1500 tr/min place la sixième dès 90 km/h |
| **Monter après** | Durée de vitesse stable avant de tenter un rapport de plus. Court, la boîte monte dès qu'on lève le pied ; long, elle garde ses rapports |
| **Descendre en freinant à** | Décélération à partir de laquelle la boîte descend pour aider à ralentir, sans attendre que le régime soit tombé. Proche de zéro, elle descend au moindre lever de pied |
| **Temporisations de montée** | Une par rapport, en secondes. Les garder **inégales** : avec une valeur unique, la boîte sonne comme un métronome. Courtes de préférence — elles confirment une intention, elles ne retiennent pas le passage |

### Signal de vitesse

| Réglage | Ce qu'il fait |
|---|---|
| **Raideur du lissage** | Haut : réactif, mais les sauts du GPS s'entendent. Bas : doux, mais en retard. Le réglage le plus sensible |
| **Fenêtre d'accélération** | Durée sur laquelle la pente est estimée, par ajustement sur **toutes** les mesures qu'elle contient. Elle décide aussi du temps qu'une pente met à s'oublier : à quatre secondes, le régime met encore quatre secondes à retomber après qu'on a cessé d'accélérer ; à une seconde, il suit aussitôt mais le signal est moins lisse. En deçà de l'intervalle entre deux mesures, la baisser ne gagne rien — et cet intervalle dépend de l'appareil : quelques dizaines de millisecondes dans une Tesla en mouvement, une seconde ailleurs |
| **Vitesse plausible max** | Au-delà, la mesure est écartée : on n'en tire rien du tout, et la vitesse conditionnée continue comme si elle n'était pas arrivée |
| **Accélération / décélération max retenues** | Bornes de l'accélération transmise à la charge |

### Mixage

Le **volume général** ne figure pas dans cette liste : ce n'est pas un caractère
de profil mais une **préférence de l'appareil**, rangée à côté du profil choisi.
Il dépend de l'autoradio, de la position du téléphone, du bruit de roulement, et
il n'a donc aucune raison de sauter quand on change de voix, ni de voyager vers
qui reçoit un profil partagé. Il se règle sur l'écran de conduite, seul endroit
où l'on touche un réglage en roulant, et il peut dépasser 1 — le limiteur de
sortie empêche la saturation, ce qui laisse de la marge quand le relief est
fort.

| Réglage | Ce qu'il fait |
|---|---|
| **Relief de charge** | Autant en moins pied levé, autant en plus pied au plancher, rien en croisière. **C'est le réglage qui fait entendre l'effort** : sans lui, les fondus étant à puissance constante, ralenti, croisière et pleine charge tenaient dans 1,3 dB — le son changeait de couleur et jamais de volume. À 4, il y a 8 dB entre lever le pied et écraser |
| **Relief du régime** | Gain gagné entre le ralenti et le rupteur : le rugissement qui monte avec les tours. Il **s'ajoute** aux 4 dB que la banque livrée donne déjà, sa prise haut régime étant enregistrée plus fort que la basse |
| **Niveau au ralenti** | Le ralenti n'a pas de couche dédiée dans la banque livrée : on y entend la prise « pied levé » jouée deux octaves plus bas. Sans ce réglage elle sonnait aussi fort que tout le reste |
| **Désaccord des couches** | Écart de justesse entre les couches d'une même famille, en centièmes de demi-ton. Au rapport exact elles sont parfaitement justes l'une par rapport à l'autre, ce qui n'arrive sur aucun moteur : les inégalités entre cylindres et les deux lignes d'échappement produisent un battement lent. L'écart est réparti de part et d'autre, donc la hauteur moyenne ne bouge pas, et il ne déplace aucun gain. Mesuré, 12 centièmes donnent un battement à 2,4 Hz à 5100 tr/min et 1,5 Hz à 3200 |
| **Début / fin de bascule** | Régimes entre lesquels la couche haute remplace la basse. **Indépendants des régimes d'ancrage**, qui règlent la justesse |
| **Accélération pleine charge** | Accélération au-delà de laquelle la charge est maximale. Faute de pédale dans une voiture électrique, c'est elle qui arbitre le fondu entre « en charge » et « pied levé » |
| **Lissage de la charge** | Évite que le fondu papillonne sur le bruit d'accélération |
| **Effacement du ralenti** | Régime au-dessus duquel la couche de ralenti disparaît |
| **Gain pied levé** | Curseur de goût sur toute la famille « pied levé ». La compensation des prises plus douces vit dans le gain de chaque couche, où le déficit se mesure — 9,6 dB pour la basse, 6,5 pour la haute : à laisser à 1 sauf pour forcer le trait |
| **Coupe-bas**, **Saturation**, **Seuil du limiteur** | Chaîne de sortie |

### Caractère

Trois comportements qui tiennent moins de la mécanique que du tempérament, et
qu'on remarque surtout par leur absence. Chacun s'active séparément.

| Réglage | Ce qu'il fait |
|---|---|
| **Rétrogradage forcé** | Enfoncer la pédale fait descendre chercher le couple, au lieu d'attendre le seuil de passage. Mesuré : 6<sup>e</sup> à 1927 tr/min → 4<sup>e</sup> à 2724 en une demi-seconde |
| **Déclenché au-delà de** | Charge à partir de laquelle la demande est jugée franche. Le niveau ne suffit pas : il faut aussi que la charge ait **monté** franchement dans la seconde et demie écoulée. Sans cette condition, le rétrogradage partait dès 3,6 km/h par seconde — c'est-à-dire en remettant délicatement les gaz — puisque, faute de pédale, la charge est déduite de l'accélération |
| **Régime visé** | Ce qu'on cherche à retrouver après la descente, en fraction du rupteur |
| **Rapports descendus au plus** | Deux suffisent sur un profil routier, trois donnent une réponse plus vive |
| **Pétarade** | Claquements à l'échappement au lever de pied. Synthétisés, la banque sonore n'en contenant pas |
| **À partir de** | Régime en deçà duquel rien ne se produit : il ne reste pas assez à brûler. C'est le régime **au moment où l'on coupe**, non celui constaté une demi-seconde plus tard |
| **À-coup de passage** | Le creux du couple coupé, puis la reprise. Zéro donne une boîte parfaitement lisse, ce qu'aucune n'est |

### Couches

Une ligne par échantillon. Le bouton **Analyser** mesure le fichier et propose
des ancrages.

| Colonne | Ce qu'elle fait |
|---|---|
| **Rôle** | « en charge », « pied levé », « ralenti » ou « rupteur ». Détermine la famille dans laquelle la couche est fondue |
| **Ancrage** | Régime auquel l'échantillon a été enregistré. Fixe la **justesse**, pas le point de bascule |
| **Gain** | Niveau propre à la couche |
| **Lecture min / max** | Bornes d'étirement. Au-delà d'une octave environ, le son devient métallique vers le haut, pâteux vers le bas |

Ces bornes définissent le **domaine jouable** de chaque couche : un échantillon
ancré à 8000 tr/min avec une borne basse de 0,25 ne descend pas sous 2000 tr. En
deçà, sa hauteur se fige — et une couche figée qu'on laisserait s'entendre donne
l'impression d'un second moteur tournant à régime constant derrière le premier.

Le mixage l'efface donc à mesure qu'elle s'écarte de la hauteur demandée, et la
réduit au silence au-delà d'une demi-octave. C'est ce qui explique qu'une couche
puisse afficher un gain nul alors que le fondu devrait la faire entrer : elle
n'est simplement pas jouable à ce régime. Deux remèdes, selon le cas — abaisser
sa borne basse, ou reculer le début de bascule pour ne l'appeler que dans son
domaine.

### Profils

Deux profils sont livrés avec l'application, et le bouton **Profils d'usine**
réintroduit ceux qu'on aurait supprimés.

**Route** — calibré sur les vitesses que l'on pratique vraiment. En accélération
les six rapports servent entre 0 et 100 km/h, et dès qu'on tient une vitesse la
boîte monte d'elle-même : mesuré, la quatrième à 50 km/h (1532 tr/min), la
cinquième à 70 (1790), la sixième dès 90 (1927), et 2784 tr/min à 130. Pied au
plancher, les passages reculent jusqu'aux trois quarts du rupteur : il reste de
quoi s'amuser sans que ce soit le régime ordinaire.

**Sport** — le calibrage d'origine, taillé pour une plage que l'on n'atteint
jamais sur route. Il garde ses rapports plus longtemps et croise plus haut :
la troisième à 50 km/h (2460 tr/min) là où Route est en quatrième, et 3386 tr/min
à 130. Intéressant sur une portion dégagée, fatigant au quotidien.

Le tout se règle : c'est la différence entre les deux, pas une nature.

| | Route | Sport |
|---|---|---|
| Rupteur | 6500 tr/min | 8500 |
| Pont | 3,7 | 4,5 |
| Passage 1 → 2 (charge moyenne) | 35 km/h | 40 |
| Plancher de croisière | 1500 tr/min | 2000 |
| Rapport tenu à 50 km/h | 4<sup>e</sup>, 1532 tr/min | 3<sup>e</sup>, 2460 |
| Rapport tenu à 90 km/h | 6<sup>e</sup>, 1927 tr/min | 6<sup>e</sup>, 2344 |
| Régime à 130 km/h en sixième | 2784 tr/min | 3386 |

Sélection, renommage, duplication, suppression, **export** et **import** en JSON.

Le bouton **☆ Épingler** place un profil en accès direct sur l'écran de conduite,
mode plein écran compris : changer de son en roulant n'oblige pas à passer par la
configuration.

La première section de l'écran, **Créer un profil**, ouvre une création guidée. Quatre choix décrits en langage de
conducteur — tempérament, usage, moteur, nombre de rapports — dont on déduit la
trentaine de réglages qui ne s'accordent pas indépendamment : rapports en
progression géométrique, pont calculé pour la croisière visée, régimes de
passage, écart de charge, caractère. Un aperçu chiffré se recalcule à chaque
choix, et le résultat reste entièrement modifiable.

Un menu **Réinitialiser** ramène une section — ou le profil entier — à son état
d'usine, en deux temps pour éviter la fausse manœuvre. Sept portées : tout le
profil, le moteur, la transmission, le signal de vitesse, le mixage, le
caractère, les couches. Une valeur mal saisie dans la transmission ne coûte donc
plus ce qui a été trouvé ailleurs, et l'identifiant comme le nom sont conservés
dans tous les cas — le profil est remis à neuf, pas remplacé.

**Son état d'usine, c'est ce qu'il était à sa création.** Un profil sorti du
guide, ou dupliqué, garde ses valeurs de départ et y revient. Les deux profils
livrés reviennent aux leurs. Seul un profil enregistré par une version
antérieure de l'application, qui n'a pas gardé son état de départ, retombe sur
des valeurs génériques.

Un profil créé de toutes pièces, sans équivalent d'usine, retombe sur les valeurs
par défaut génériques.
Les profils sont conservés dans le navigateur ; l'export sert à les transporter
d'un appareil à l'autre.

---

## Étalonner sur la vraie voiture

Les réglages qui décident de la charge et des seuils ont tous été choisis par le
calcul, faute de savoir ce que fait la voiture. `fullLoadAccelMs2` vaut 2 m/s²
sur le profil Route — une valeur raisonnée, jamais mesurée, sur un véhicule qui
en fait bien davantage. L'étalonnage remplace ce raisonnement par un relevé.

Il se trouve **en bas de l'écran Télémétrie**, sous les traces, dont il se sert.
Tout se passe dans la voiture : l'analyse ne demande que du calcul, et le
résultat se voit tout de suite.

### La marche à suivre

1. Démarrer l'application, source **GPS**.
2. Lire la consigne de l'étape, et son **critère**. Le critère est annoncé avant
   l'enregistrement, pas après.
3. Appuyer sur **Enregistrer l'étape**, rouler comme demandé, appuyer sur
   **Arrêter**.
4. Le verdict s'affiche : étape valide et valeur obtenue, ou étape refusée et
   raison du refus.
5. Le tableau **Mesuré face à réglé** met les deux chiffres côte à côte, avec
   leur écart. **Recopier** applique la valeur, un réglage à la fois.

Chaque étape s'enregistre séparément et vaut séparément : une session
incomplète reste utile, et ce qui n'a pas été mesuré est dit **non mesuré**,
jamais estimé. L'enregistrement d'une étape est une trace ordinaire — elle
apparaît dans la liste des traces, se rejoue, et l'analyse en tire le même
chiffre à chaque relecture.

### Les étapes

Six étapes, dans deux familles. Les trois premières donnent des
**distributions** — ce qu'on fait tous les jours ; les trois dernières donnent
des **extrêmes**, et ce sont eux qui manquaient le plus.

| Étape | Ce qu'on demande | Ce qu'elle informe |
|---|---|---|
| Conduite en ville | une minute de ville, feux compris | la vitesse de fin de première, les seuils bas, le bruit du GPS |
| Conduite sur route | une minute de route | les seuils intermédiaires, le plancher de croisière |
| Conduite sur autoroute | une minute d'autoroute | les seuils hauts, la vitesse plausible |
| Accélération franche | de l'arrêt, accélérer franchement jusqu'à 50 km/h | l'accélération à charge pleine |
| Décélération pied levé | au-dessus de 50 km/h, lever le pied sans freiner | avec le freinage, la frontière de rétrogradage ; la borne basse |
| Freinage franc | au-dessus de 40 km/h, freiner franchement | la même frontière, et la borne basse |

### Ce qu'on tire de la conduite ordinaire

Un **palier** est une portion où la vitesse est tenue : l'accélération reste
dans une bande étroite pendant au moins deux secondes. Un arrêt n'en est pas un
— un feu rouge est une accélération nulle qui dure. De la distribution des
paliers, pondérée par leur durée, viennent :

- les **seuils de passage**, placés de sorte que chaque rapport couvre une part
  égale du temps passé à vitesse tenue. Le profil Route a été décrit comme
  « calibré sur les vitesses que l'on pratique vraiment » ; c'était de mémoire ;
- le **plancher de croisière**, à la vitesse la plus basse réellement tenue ;
- le **délai de montée en croisière**, au dixième centile de la durée des
  paliers : neuf paliers sur dix durent alors assez pour que la montée se
  produise, et les plus brefs ne la déclenchent pas.

Les seuils de passage sont mesurés en **kilomètres-heure** et le réglage du
profil s'affiche dans la même unité, converti avec le pont, les
démultiplications et le rayon de roue — sans quoi les deux ne seraient pas
comparables. C'est le profil qui fournit la conversion : lui a déjà choisi une
boîte, la voiture mesurée n'en a pas.

### Le bruit du GPS, et la fenêtre qui s'en déduit

L'étalonnage chiffre le **bruit de mesure** du GPS de cette voiture-là, en
km/h, ainsi que sa **cadence**. La pente d'accélération étant ajustée aux
moindres carrés sur une fenêtre, son écart-type vaut `√(12 σ² Δ / T³)` pour un
bruit `σ`, une cadence `Δ` et une fenêtre `T`. On renverse la formule pour
trouver la fenêtre qui atteint 0,1 m/s² de précision, soit un vingtième de la
charge pleine du profil Route.

Vérifié sur traces synthétiques, à trois bruits et deux cadences : l'écart-type
obtenu tient entre 0,100 et 0,104 m/s² pour une cible de 0,100.

**La raideur du lissage, elle, n'est pas proposée.** Le ressort arrondit ce que
le bruit laisse passer, et le réglage juste est celui à partir duquel le
tremblement ne s'entend plus : c'est un jugement d'oreille, pas une mesure. Le
déduire d'une formule serait habiller une convention en résultat.

Le seuil de rétrogradage au freinage se place **au milieu** des deux
décélérations. Le milieu, parce que c'est le point qui laisse la même marge
contre les deux erreurs possibles : rétrograder sur un simple lever de pied, et
ne pas rétrograder sur un vrai freinage.

**Et il peut ne pas y avoir de milieu.** Une voiture électrique récupère au
lever de pied, ce qui rapproche les deux cas au lieu de les séparer. Si les deux
étapes rendent la même décélération à moins de 0,5 m/s² près, aucun seuil n'est
proposé, et la raison est dite : soit le frein a servi pendant le lever de pied,
soit la récupération suffit à elle seule. C'est pour la même raison que le lever
de pied n'a **pas** de plafond de décélération dans son critère : rien dans une
trace GPS ne dit si le frein a été touché, et refuser un lever de pied « trop
fort » reviendrait à refuser cette voiture-là.

### Une étape peut être refusée, et c'est le point

Une « accélération franche » qui n'atteint que 1 m/s² n'en est pas une.
L'accepter donnerait une charge pleine atteinte au premier filet de gaz — donc
un fondu faux, un volume faux, des passages faux : exactement le défaut que
l'étalonnage doit corriger. Le critère de l'accélération franche est donc :
départ à l'arrêt, 30 km/h gagnés au minimum, et **2 m/s² d'accélération
soutenue**. Deux mètres par seconde carré, c'est zéro à cinquante en sept
secondes — très en dessous de ce qu'une électrique fait sans effort.

### Le récapitulatif

Un seul tableau, sous les étapes. Chaque ligne porte le nom du réglage, la
phrase qui dit d'où vient la mesure, la valeur **mesurée**, la valeur
**réglée**, et l'**écart** entre les deux. Une ligne d'en-tête compte où en est
la session — combien d'étapes enregistrées, combien valides, combien de réglages
proposés et combien non mesurés — parce que sans ce compte on ne sait pas si un
« non mesuré » vient d'une étape oubliée ou d'une étape refusée.

Le tableau se relit tel quel après un rechargement : une session ne retient que
le lien entre une étape et sa trace, et les traces sont conservées. Le
récapitulatif se **recalcule** donc, plutôt que de rejouer des chiffres
mémorisés qui pourraient avoir divergé de l'analyse.

### Elle propose, elle n'applique pas

C'est la règle déjà retenue pour l'analyse d'échantillon : la mesure est plus
sûre que le souvenir, elle n'est pas plus sûre que le jugement. Rien n'est écrit
dans le profil sans un geste, et jamais en bloc — un réglage à la fois.

Deux retours en arrière, à deux échéances. **Annuler**, à côté du bouton qui
vient d'écrire, rend la valeur écrasée immédiatement et pour ce réglage seul.
Plus tard, **Réinitialiser** dans l'écran de configuration ramène une section
entière du profil à ce qu'elle était à sa création.

### Ce que l'étalonnage ne dira jamais

Une voiture électrique n'a pas de rapports. L'étalonnage mesure des vitesses,
des accélérations et du bruit de mesure ; il informe donc des seuils **en
vitesse**, jamais en régime. Le régime est une fiction qu'on choisit, et le
choix reste entier : l'étalonnage ne dira pas quel rupteur ni combien de
cylindres.

C'est pour cette raison que le **plancher de croisière** est rendu en km/h et ne
se recopie pas : le réglage est un régime, et le déduire de cette vitesse
demanderait de choisir dans quel rapport la boîte se trouve — ce que le réglage
sert justement à décider. La mesure s'arrête où commence le choix, et le dit.

---

## Partager un profil

Trois façons de retrouver ses réglages sur un autre appareil, sans compte ni
serveur applicatif.

**Par lien.** Le bouton **Partager…** encode le profil entier dans l'adresse,
compressé. L'application prévient lorsque cette adresse n'est joignable que
depuis le poste courant — un lien produit sur `localhost` ou sur une adresse de
réseau local ne mènerait nulle part ailleurs, alors que le code paraît valide — environ 1100 caractères pour un profil de 1,8 ko. L'ouvrir ailleurs
l'y installe. Le fragment d'adresse n'étant jamais transmis au serveur, rien
n'en est journalisé.

**Par code à scanner.** Le même lien sous forme de code, ce qui évite de recopier
une adresse entre un poste de travail et un téléphone. Il est produit sur place,
sans service extérieur.

**Par le NAS.** Les fichiers déposés dans `/volume1/docker/speed/profiles/` avec
File Station apparaissent sur tous les appareils, via le bouton **Profils du
serveur**. nginx sait rendre le contenu d'un dossier en JSON, ce qui suffit à les
découvrir : ni base, ni service à maintenir, et la protection est celle qui garde
déjà l'accès au site. Le dossier est facultatif.

Dans tous les cas, **les échantillons ne voyagent pas** — seuls leurs noms
suivent, l'autre appareil devant disposer de la même banque. Et l'identifiant est
renouvelé à l'import : un profil reçu n'écrase jamais l'un des siens.

## Les échantillons

Le dossier `public/audio/` **n'est pas versionné**, volontairement, et le code
n'y référence rien en dur : chaque profil déclare un sous-dossier et la liste de
ses couches.

Il faut, par moteur, des boucles stationnaires à régime connu : montée en charge
bas et haut régime, décélération bas et haut régime, un ralenti, un rupteur.
C'est le format standard de l'audio de jeu — voir
[Audiokinetic](https://www.audiokinetic.com/en/blog/loop-based-car-engine-design-with-wwise-part-2/)
et [Game Developer](https://www.gamedeveloper.com/audio/capturing-engine-sounds-for-games).

### Analyser un échantillon

Le bouton **Analyser** donne la durée, le format, la qualité du raccord de
boucle, le centroïde spectral, signale les prises en rampe, et propose des
régimes d'ancrage cliquables.

**Les propositions ne sont pas appliquées d'office, et c'est délibéré.** Le
régime se déduit en principe de la raie d'allumage, mais un moteur émet une raie
à chaque demi-tour de vilebrequin et pas seulement à l'allumage : le spectre est
bien plus dense qu'une série harmonique simple, et la détection confond une
fréquence avec sa moitié, son tiers ou ses trois demis.

Mesurée sur le jeu de test, la méthode place la bonne valeur en tête sur les
prises stationnaires bas régime et se trompe sur les prises haut régime. Rendre
une valeur unique reviendrait à se tromper une fois sur deux avec assurance.

Trois garde-fous entourent cette opération, car appliquer une proposition écrase
un réglage parfois trouvé à l'oreille après plusieurs essais :

- le champ **Cylindres enregistrés** annonce qu'il ne touche pas au son et qu'une
  valeur fausse décale les propositions ;
- l'analyse recoupe l'ancrage en place avec la raie mesurée et **signale
  l'incohérence** — « l'ancrage correspondrait à 8 cylindres, non 4 » — ce qui
  détecte aussi bien un champ erroné qu'un ancrage erroné ;
- chaque couche garde son ancrage précédent et propose de **revenir en arrière**.

Ce retour vaut pour la session en cours. Pour un réglage auquel on tient,
l'export en JSON reste le filet.

D'où la liste classée : comme le son tourne pendant l'édition, en essayer un se
juge à l'oreille immédiatement. L'indication **timbre** aide à recouper — d'un
même moteur, la prise haut régime a forcément le centroïde le plus aigu.

### Compression

```bash
npm run transcode
```

Convertit en FLAC : **−50 %** sur le jeu de test, 5,73 Mo → 2,84 Mo, sans aucune
perte (écart maximal mesuré après décodage : 1,5 × 10⁻⁷). Les fichiers d'origine
sont conservés ; il reste à changer l'extension des couches dans l'écran de
configuration.

FLAC plutôt qu'AAC ou Opus parce que les codecs avec perte insèrent un silence
d'amorçage en tête de fichier, qui sur une boucle revient à chaque tour.

### Ce qui manque au jeu actuel

Il n'y a **pas de couche de ralenti**. Le moteur étire donc l'enregistrement bas
régime, ancré vers 3100 tr/min, jusqu'au ralenti à 780 — un rapport de 4 pour 1,
bien au-delà de ce qu'un échantillon supporte. La vitesse de lecture est bornée,
ce que la télémétrie signale par la mention « bornée », et le son à l'arrêt sonne
une octave trop haut.

Y remédier demande de la matière, pas du code : une prise de ralenti, déclarée
comme une couche de rôle « ralenti ».

---

## Comment ça marche

```
src/
  core/
    loop.ts              cadence unique, avec repli quand la page est masquée
    session.ts           verrou d'écran et session média du système
    offline.ts           service worker, mise en cache, installation
    speed/
      source.ts          interface commune aux trois sources
      simulator.ts       vitesse au clavier, pour travailler sur un poste fixe
      geolocation.ts     GPS réel, repli haversine, rejet des aberrations
      replay.ts          rejeu d'une trace enregistrée, et son enregistreur
      conditioner.ts     fenêtre glissante, extrapolation, ressort amorti
    engine/engine.ts     régime, charge, rupteur
    drivetrain/gearbox.ts  rapports, passages automatiques et manuels, croisière
    audio/
      mix.ts             gains et vitesses de lecture des couches (fonction pure)
      engine.ts          graphe Web Audio, chargement, horloge sur le fil audio
      analyze.ts         mesure d'un échantillon : ancrage, raccord, timbre
    preset/              schéma d'un profil, valeurs par défaut, persistance
  ui/                    les trois écrans
  state.ts               assemblage et télémétrie
public/sw.js             service worker
public/icons/            icônes, produites par npm run icons
public/audio/            échantillons, non versionnés
docker/                  piles Portainer et configuration nginx
.github/workflows/       construction et publication de l'image
scripts/                 compression FLAC, déploiement
```

Chaque module de `core/` a son fichier de tests à côté de lui —
`conditioner.test.ts` auprès de `conditioner.ts`. Il n'y a pas de dossier de
tests à part : ce qui décrit un module vit avec lui.

Les trois sources de vitesse exposent la même interface, donc rien en aval ne
sait d'où vient le chiffre : on développe au clavier, on met au point en rejouant
un trajet capturé, on roule pour de vrai, sans branche conditionnelle nulle part.

### Ce que la boîte regarde

Elle ne décide pas seulement sur le régime. Trois règles se partagent le travail,
et chacune répond à une question différente :

- **le régime**, pour les passages en accélération — chaque rapport a son seuil ;
- **la stabilité de la vitesse**, pour la croisière. Un palier ne fait plus
  monter le régime, donc rien ne déclencherait de passage : sans cette règle, la
  boîte restait figée où elle était, et 50 km/h tenus laissaient la deuxième à
  3034 tr/min. Elle monte donc d'un rapport dès que la vitesse est stable depuis
  quelques secondes, et s'arrête juste avant de descendre sous le plancher de
  croisière. **Tenir une vitesse, c'est ne pas la perdre** : la bande de
  stabilité est asymétrique, bien plus serrée du côté du ralentissement — un
  lever de pied sur du plat passait autrement pour une croisière, et le dernier
  rapport se gardait jusqu'à l'arrêt ;
- **la décélération**, pour descendre. Le seuil de régime seul ne distinguait pas
  un lever de pied d'un freinage : la boîte redescendait aux mêmes vitesses dans
  les deux cas, et ne servait donc jamais à ralentir. Et **on ne monte pas
  pendant qu'on freine**, comme une vraie boîte : sans cette inhibition, la
  montée au régime défaisait la descente aussitôt et l'on entendait un
  aller-retour tous les trois km/h.

Le rétrogradage forcé, lui, répond à une **montée** de charge et non à son
niveau. Faute de pédale dans une voiture électrique, la charge est déduite de
l'accélération : son niveau ne dit pas « on demande fort » mais « on accélère ».
Le seuil se franchissait dès 3,6 km/h par seconde, et la boîte descendait pour
cela.

### La pièce importante, et ce n'est pas le son

C'est `conditioner.ts`. Le GPS ne livre qu'une mesure par seconde : piloter
directement une hauteur avec ce signal donne un escalier qui saute chaque
seconde. Trois traitements se composent — une pente calculée sur une fenêtre
glissante, une extrapolation entre deux mesures, et un ressort amorti critique
intégré à pas fixe.

Mesuré sur une trace synthétique à 1 Hz : l'écart de suivi reste **sous 1 km/h**
en accélération régulière, et la sortie est continue. Il monte à une dizaine de
km/h sur un freinage brutal, le temps que la pente bascule — c'est le compromis
inhérent au procédé, et c'est ce qu'arbitrent les réglages « raideur du lissage »
et « fenêtre d'accélération ».

### Le son

Toutes les couches jouent en permanence, en boucle, dès l'activation ; seuls
leurs gains et leurs vitesses de lecture bougent. Démarrer et arrêter des sources
au fil du régime produirait des discontinuités de phase, donc des clics.

Deux fondus se composent, tous deux à puissance constante : en régime, entre les
couches d'un même rôle ; en charge, entre « en charge » et « pied levé ».

À puissance constante, c'est-à-dire **sans creux au milieu d'une bascule** — mais
aussi sans relief : ces fondus changent la couleur du son et jamais son volume.
Mesuré, ralenti, croisière, reprise douce et reprise franche tenaient dans
1,3 dB, et lever le pied franchement était même plus fort qu'écraser. Trois
réglages de **relief** s'appliquent donc par-dessus, à toutes les couches à la
fois : l'effort, le régime, et le ralenti. Ils déplacent le niveau d'ensemble
sans toucher à l'équilibre entre les couches, donc sans rouvrir le creux que les
fondus évitent.

Un moteur ne tourne pas juste, et c'est cela qui le fait entendre comme un
moteur plutôt que comme un échantillon. Deux écarts sont donc introduits, tous
deux calculés dans `core/`, donc mesurables sans sortir un son.

**Le régime tremble.** Le conditionnement produit un signal d'une régularité
qu'aucun moteur thermique n'a. On y ajoute un tremblement lent — trois
sinusoïdes, dont deux dans un rapport irrationnel, si bien que la somme n'a pas
de période — d'amplitude décroissante avec le régime et avec la charge : un moteur
se stabilise en montant et sous couple, il tremble au ralenti et à vide. Mesuré
sur Sport : 34 tr/min d'excursion au ralenti, ±18 à 3000 tr/min pied levé, ±7 à
3000 tr/min pied au plancher.

Le moteur sort donc **deux** régimes, et c'est le point délicat. Le régime net
alimente la boîte, ses seuils et la télémétrie ; le régime **entendu** porte le
tremblement et ne sert qu'aux vitesses de lecture. Les seuils de passage
travaillent sur le régime : quelques dizaines de tours de tremblement les
feraient osciller, et trois défauts d'oscillation de la boîte venaient déjà d'un
compteur portant deux sens. Un compteur, un usage.

Le tremblement est fait de sinusoïdes et non d'un tirage au sort : il est
reproductible sans graine à gérer, une même situation donne toujours le même
son, et un test peut l'affirmer.

**Les couches ne jouent plus d'accord.** Deux couches d'une même famille jouées
au rapport exact sont parfaitement justes l'une par rapport à l'autre, ce qu'un
moteur réel n'est jamais : les inégalités entre cylindres et les deux lignes
d'échappement produisent un battement lent. Elles sont donc désaccordées de
quelques centièmes de demi-ton, l'écart étant réparti de part et d'autre pour
que la hauteur moyenne ne bouge pas. Mesuré, douze centièmes donnent un
battement à 2,4 Hz au milieu de la bascule de Sport.

Le désaccord est constant par couche — il dépend du rang de la couche dans sa
famille, jamais du temps — et il s'applique **après** la décision de domaine
jouable : régler ce curseur ne peut donc déplacer aucun gain, et ne peut pas
sortir une couche de son domaine.

Ce que ces deux écarts ne font pas : un moteur. Cinq fichiers bouclés se
répètent, et l'oreille l'apprend en quelques tours. Ce plafond-là ne se franchit
qu'avec plus de bancs moteur.

Trois points ont demandé une attention particulière :

- **Le raccord des boucles.** Mesurée canal par canal après décodage, la
  discontinuité atteignait 21,6 % du niveau crête sur la montée haut régime et
  39,4 % sur le rupteur : de quoi claquer à chaque tour.

  Un simple fondu ne suffit pourtant pas. Les deux portions raccordées sont
  décorrélées : leurs harmoniques se combinent au hasard des phases et
  s'annulent en partie, ce qui creuse le niveau à chaque tour — un saut de
  20,4 % sur la prise bas régime, trois fois les variations ordinaires du signal,
  entendu comme un gargouillis revenant toutes les quelques secondes.

  Le chargement cherche donc *où* boucler : l'endroit, vers la fin, dont le
  voisinage ressemble le plus au début, en niveau comme en forme. Mais aucun
  critère indirect ne garantit le résultat — sur une prise en rampe, l'alignement
  dégrade au lieu d'améliorer. Le saut d'énergie réel est donc mesuré sur les
  deux versions et la meilleure l'emporte, si bien que la réparation ne peut
  jamais empirer ce qu'elle corrige. Sur le jeu de test, quatre couches sur cinq
  y gagnent et retombent au niveau des variations ordinaires.
- **La cadence en arrière-plan.** Le navigateur gèle l'affichage et ralentit les
  minuteurs dès que la page n'est plus visible, mais le fil audio continue. Une
  horloge `AudioWorklet` bat donc la mesure dès qu'elle est disponible. Un média
  silencieux tourne en parallèle pour que le système ne libère pas la session.
- **La phase des couches.** Deux boucles issues du même enregistrement, démarrées
  ensemble, se renforcent en peigne. Chacune démarre à une position tirée au sort.

---

## Banc de mise au point

Le navigateur gèle `requestAnimationFrame` et ralentit les minuteurs dès que la
page passe en arrière-plan, ce qui rend toute mesure prise à la montre
inexploitable. En développement, `window.__speed` expose l'état complet et de
quoi reprendre la main sur le temps :

```js
const s = window.__speed
s.start()
s.pauseLoop()                  // coupe la cadence, garde la source et le son actifs
s.setThrottle(1)
s.advanceManually(1 / 60, 600) // dix secondes simulées, à pas fixe
s.telemetry.value
s.resumeLoop()
```

C'est ainsi que les seuils de passage ont été vérifiés : la boîte monte un
rapport 0,6 s après avoir franchi 94 % du rupteur à pleine charge, et bien plus
tôt en charge partielle.

Les traces sont **conservées d'une session à l'autre**, exportables en un fichier
et réimportables ailleurs — c'est ainsi qu'un trajet enregistré au volant se
rejoue au poste de travail.

L'autre outil est le **rejeu de traces** : un trajet réel s'enregistre une fois
depuis l'écran Télémétrie, puis se rejoue à l'identique sur un poste fixe. Régler
le lissage devient reproductible, au lieu de demander un aller-retour sur route à
chaque essai.

---

## État du projet

| Lot | Contenu | État |
|---|---|---|
| 0 | Squelette, boucle, écrans, simulateur clavier | fait |
| 1 | Conditionnement du signal, GPS, enregistrement et rejeu de traces | fait |
| 2 | Modèle moteur et boîte de vitesses | fait |
| 3 | Moteur audio à échantillons, compression, calage des boucles | fait |
| 4 | Analyse des échantillons dans l'éditeur | fait |
| 5 | Écran de la voiture, session média, verrou d'écran | fait |
| 6 | Déploiement sur NAS, HTTPS en développement | fait |
| 7 | Application installable et utilisable hors réseau | fait |
| 8 | Publication automatique de l'image, installation sans terminal | fait |
| 9 | Process de développement écrit, git flow, contrôle d'intégration | fait |
| 10 | Mise sous test du cœur : 211 tests, 94 % de `core/` couvert | fait |
| 11 | Les quatre défauts que la mise sous test a trouvés | corrigé, reste à écouter |
| 12 | Son maintenu quand le navigateur passe en arrière-plan | fait, vérifié en roulant |
| 13 | Boîte qui regarde la vitesse : montée en croisière, descente au freinage, rétrogradage sur la demande | à écouter |
| 14 | Relief du volume : l'effort, le régime et le ralenti s'entendent | à écouter |
| 15 | Trois défauts de la boîte relevés en roulant : ralentir n'est plus croiser | à écouter |
| 16 | Pente : la cadence réelle du GPS faussait la mesure d'accélération | corrigé, reste à écouter |
| 17 | Défilement de l'écran de configuration sans dérégler un curseur | corrigé, reste à essayer |
| 18 | Le volume général sort du profil : c'est une préférence d'appareil | fait |
| 19 | Mode simplifié : deux curseurs globaux, le détail derrière un mode avancé | fait, reste à écouter |
| 20 | Tableau de bord à cadrans, et paysage défilant | fait, reste à essayer |
| 21 | Imperfections : tremblement de régime, couches désaccordées | fait, reste à écouter |
| 22 | Étalonnage : mesurer la vraie voiture pour régler les virtuelles | fait, reste à rouler |
| 23 | Le serveur accepte le dépôt d'une trace | fait, éprouvé sur le NAS |
| — | Déposer une trace et un profil depuis l'application | prévu |
| — | Plusieurs banques de son, choisies par profil | prévu |
| — | La charge tient compte de la vitesse : tenir 50 et tenir 130 diffèrent | à remesurer |

Ce tableau donne l'ordre et l'avancement d'ensemble. Le détail du périmètre et
le statut de chaque ticket vivent dans [`.backlog/`](.backlog/README.md) ; les
règles de travail du dépôt dans [`CLAUDE.md`](CLAUDE.md), son vocabulaire dans
[`CONTEXT.md`](CONTEXT.md), et ce qui a été livré dans
[`CHANGELOG.md`](CHANGELOG.md).

### Ce qui n'est pas vérifié

- **Le verrou d'écran.** Le code est en place, mais le navigateur de
  développement refuse la permission (`NotAllowedError`), y compris sur un appel
  direct à l'API. Seul son échec propre est établi.
- **Le GPS écran éteint.** Les systèmes mobiles espacent fortement les mesures
  quand l'écran s'éteint. C'est à cela que sert le verrou, et les deux se testent
  ensemble, en roulant.
- ~~La configuration nginx et la chaîne d'intégration.~~ Vérifiées : le workflow
  publie une image multi-architecture, et la pile tourne sur le NAS derrière le
  proxy inversé.
- **Le rendu sonore.** Les mesures établissent que le signal sort, qu'il ne
  sature pas et que les fondus sont corrects. Pas qu'il sonne juste.
- ~~Le son en arrière-plan.~~ Vérifié en roulant le 3 septembre 2026 : il
  continue sans interruption quand le navigateur de la voiture est réduit. Le
  média qui maintient la session audio avait été refait sur le modèle d'une
  application qui y arrive — fichier servi plutôt que fabriqué en mémoire,
  élément inséré dans le document, deux minutes de silence plutôt que quatre
  secondes.
- **La mesure d'accélération dans la voiture.** Le GPS de la Tesla livre une
  position toutes les quelques dizaines de millisecondes en roulant, là où le
  conditionneur est bâti pour une par seconde. Mesuré en conséquence : une
  accélération douce y est vue à zéro, ou à trois fois sa valeur selon le bruit.
  Le volume, le timbre et la boîte travaillent donc sur un signal faux. Ce qui
  n'est pas vérifié, c'est l'ampleur réelle du bruit de mesure de cette
  voiture — la sensibilité, elle, est établie.
- **Le coût du paysage sur le navigateur de la voiture.** Ce qui est mesuré l'a
  été sur un Chrome 152 sans interface, au poste de travail, sur la même trace
  rejouée à chaque passe (montée jusqu'à 116 km/h, moyenne 86), trois passes
  décor coupé alternées avec trois passes décor actif. La **durée d'image** ne
  bouge pas : 9,3 ms de moyenne coupé, 9,5 actif, pour un écart de passe à passe
  de 1,8 ms — l'écart entre les deux états est plus petit que le bruit de la
  machine. Aucune image au-delà de 33 ms dans un cas comme dans l'autre. Le
  **travail ajouté par image** est de 0,027 ms de recalcul de style et 0,015 ms
  de script, soit 0,13 ms de temps de tâche au total : un peu plus d'un centième
  d'image. La mise en page ne bouge pas, ce qui confirme qu'il n'y a que des
  translations. Sur une machine tranquille, les deux états donnent exactement la
  même cadence, 6,06 ms, sans une seule image longue. Restent deux inconnues :
  le navigateur de la voiture, plus ancien, et la régularité du **son** — le son
  n'a jamais été activé pendant ces mesures, donc c'est la cadence de
  l'affichage qui est établie, pas celle du fil audio.
