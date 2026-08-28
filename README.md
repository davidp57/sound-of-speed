# Speed

Une voix de moteur pour une voiture qui n'en a pas.

L'application lit la vitesse réelle au GPS, en déduit un régime moteur et un
rapport engagé, et pilote avec ça un moteur sonore à échantillons. Tout est
réglable pendant que le son tourne, et les réglages se rangent dans des profils
qu'on sauvegarde, exporte et recharge.

- [Les trois écrans](#les-trois-écrans)
- [Démarrer en développement](#démarrer-en-développement)
- [Installation sur un NAS Synology](#installation-sur-un-nas-synology)
- [En voiture](#en-voiture)
- [Hors réseau](#hors-réseau)
- [Référence des réglages](#référence-des-réglages)
- [Les échantillons](#les-échantillons)
- [Comment ça marche](#comment-ça-marche)
- [Banc de mise au point](#banc-de-mise-au-point)
- [État du projet](#état-du-projet)

---

## Les trois écrans

**Conduite** — la vitesse, le rapport, le régime. Le choix de la source
(simulateur, GPS, rejeu), l'activation du son, le volume, la boîte automatique ou
manuelle, et le verrou d'écran. Un bouton **Conduite** bascule en plein écran :
la barre disparaît, les chiffres occupent toute la hauteur, les commandes
deviennent quatre grandes cibles. On en sort par une croix discrète, placée là
pour qu'on n'en sorte pas par mégarde en roulant.

**Télémétrie** — tout ce qui alimente le son : vitesse brute et lissée, écart de
lissage, pente, accélération, qualité du signal GPS, régime, charge, état de la
transmission, régime que donnerait chaque rapport, gain et vitesse de lecture de
chaque couche sonore, niveau de sortie. C'est aussi là qu'on enregistre et rejoue
les traces.

**Configuration** — les quelque trente-cinq paramètres, en curseur et en saisie,
appliqués immédiatement. La gestion des profils et l'analyse des échantillons.

Aucune animation nulle part : les valeurs changent, rien ne bouge pour le plaisir.

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

Autres commandes :

```bash
npm run dev:mobile   # idem, en HTTPS, pour tester depuis un téléphone
npm run build        # produit dist/
npm run typecheck    # vérification TypeScript stricte
npm run transcode    # compresse les échantillons en FLAC
npm run deploy       # recopie le build vers le NAS
npm run icons        # régénère les icônes de l'application
```

---

## Installation sur un NAS Synology

C'est le déploiement pour lequel le projet est outillé. Le NAS est déjà allumé,
son proxy inversé sait obtenir un certificat, et l'hébergement reste chez soi —
ce qui règle du même coup la question des échantillons, puisque rien n'est publié
sur Internet.

Deux chemins mènent au même résultat.

| | **Volumes** | **Image** |
|---|---|---|
| Ce que fait Portainer | Lance `nginx:alpine` tel quel | Construit l'image depuis le dépôt Git |
| Mise à jour du site | `npm run build && npm run deploy` | Un `git push`, puis redéployer la pile |
| Ce qu'il faut | Un partage accessible depuis le poste | Un accès du NAS au dépôt privé |
| Quand le préférer | Pour démarrer, et pendant les réglages | Une fois les réglages figés |

La suite décrit le chemin **Volumes**, qui demande le moins de pièces mobiles.
Le chemin **Image** est décrit [plus bas](#variante-construire-limage-depuis-le-dépôt).

### 1. Préparer les dossiers sur le NAS

Dans File Station, créer l'arborescence suivante :

```
/volume1/docker/speed/
  dist/          (vide pour l'instant)
  audio/
    procar/      les fichiers d'échantillons
  nginx.conf     copié depuis docker/nginx.conf du dépôt
```

Le dossier `audio/` est volontairement séparé du build : il sera monté
par-dessus. Changer de banque sonore consistera à y déposer d'autres fichiers,
sans rien reconstruire ni redéployer.

### 2. Construire et envoyer le site

Sur le poste de développement :

```bash
npm run build
```

Déclarer une fois pour toutes où se trouve le NAS. Le plus simple sous Windows
est de monter le partage en lecteur réseau, puis :

```bash
setx SPEED_DEPLOY_TARGET "Z:\docker\speed\dist"
```

Ensuite, à chaque itération :

```bash
npm run build && npm run deploy
```

`deploy` recopie le build **sans toucher au dossier `audio`** — l'écraser
romprait le montage. Le conteneur sert les nouveaux fichiers immédiatement, sans
redémarrage.

### 3. Créer la pile dans Portainer

Portainer › **Stacks** › **Add stack** › **Web editor**, nommer la pile `speed`,
et coller le contenu de `docker/docker-compose.yml`.

Vérifier avant de déployer :

| À vérifier | Pourquoi |
|---|---|
| Le port `8088` | Il peut déjà servir sur le NAS. Le changer ici si Portainer se plaint |
| Les chemins `/volume1/docker/speed/…` | Le nom du volume peut différer selon le modèle |

Déployer. Le service répond alors sur `http://<ip-du-nas>:8088` — en clair, et
uniquement depuis le réseau local. C'est normal à ce stade : le GPS ne marchera
pas encore, faute de HTTPS.

### 4. Publier en HTTPS avec le proxy inversé

DSM › **Panneau de configuration** › **Portail des applications** › **Proxy
inversé** › **Créer** :

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

Puis DSM › **Panneau de configuration** › **Sécurité** › **Certificat** : obtenir
un certificat Let's Encrypt pour ce nom d'hôte, et l'affecter à ce service dans
**Paramètres**.

### 5. Rendre le service joignable en voiture

C'est l'étape qu'on oublie, et elle change tout : **en voiture, le téléphone est
en 4G, donc hors du réseau local.** Le proxy inversé ne suffit pas — il faut que
le NAS soit joignable depuis Internet, ce qui suppose de rediriger le port 443 de
la box vers lui.

Et dès lors, **l'adresse est publique**. Activer l'authentification prévue dans
`docker/nginx.conf` : décommenter les deux lignes `auth_basic`, créer le fichier
de mots de passe, décommenter le volume correspondant dans la pile.

```bash
docker run --rm httpd:alpine htpasswd -nbB david "motdepasse" > htpasswd
```

> Deux pièges fréquents. Depuis le wifi de la maison, le nom DDNS résout vers
> l'adresse publique : sans **NAT loopback** activé sur la box, l'accès échoue
> alors qu'il fonctionne en 4G. Et sans authentification, les échantillons sont
> publics avec le site.

### 6. Vérifier

Depuis le téléphone, en 4G :

1. La page s'affiche, le cadenas est fermé.
2. Écran Conduite › **Activer le son** → le bouton passe à « Son actif ».
3. Source **GPS** → autoriser la localisation → le statut passe à « actif ».
4. Écran Télémétrie → « Intervalles récents » se remplit, autour de 1000 ms.

Si le GPS reste muet alors que la page s'affiche, c'est presque toujours le
contexte sécurisé : vérifier que l'adresse est bien en `https://`.

### Variante : construire l'image depuis le dépôt

Le dépôt est privé et le `Dockerfile` est à la racine, donc Portainer peut
construire l'image lui-même — plus rien à recopier à la main.

Portainer › **Stacks** › **Add stack** › **Repository** :

| Champ | Valeur |
|---|---|
| Repository URL | `https://github.com/davidp57/speed.git` |
| Repository reference | `refs/heads/main` |
| Compose path | `docker/docker-compose.build.yml` |
| Authentication | activé, avec un **jeton d'accès personnel** GitHub en guise de mot de passe |

Le jeton se crée dans GitHub › Settings › Developer settings › Personal access
tokens, avec la seule portée `repo`. Un mot de passe de compte ne fonctionne pas.

Les échantillons restent hors de l'image, montés en volume : ils ne sont pas dans
le dépôt, et une image qui les contiendrait se redistribuerait avec eux.

Mettre à jour devient alors : `git push`, puis **Update the stack** dans
Portainer en cochant *Re-pull image and redeploy*.

---

## En voiture

**Mode conduite** — le bouton du même nom escamote la barre d'onglets, passe en
plein écran, porte les chiffres à toute la hauteur disponible et remplace les
commandes par quatre grandes cibles.

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

Tout est dans l'écran **Configuration**, appliqué immédiatement.

### Moteur

| Réglage | Ce qu'il fait |
|---|---|
| **Cylindres** | Fixe la fréquence d'allumage : `régime ÷ 120 × cylindres` |
| **Ralenti** | Régime au point mort, moteur non entraîné |
| **Seuil de coupure** | Régime auquel l'allumage commence à être coupé |
| **Rupteur** | Plafond absolu du régime |
| **Durée de coupure** | C'est le hachage qui produit le crépitement, pas le plafonnement |
| **Inertie** | Poids du volant moteur : temps de montée à vide |
| **Montée à vide** | Prise de tours hors prise, en tr/min par seconde |
| **Frein moteur** | Retombée pied levé |

### Transmission

| Réglage | Ce qu'il fait |
|---|---|
| **Démultiplications** | Du plus court au plus long, séparées par des virgules. Une seule valeur = prise directe |
| **Pont** | Rapport final |
| **Rupteur atteint à** | Vitesse au rupteur dans le dernier rapport. **Modifier cette valeur recalcule le pont** — c'est le chiffre parlant |
| **Rayon de roue** | En mètres. Entre dans le calcul du régime |
| **Temps de passage** | Durée de la coupure de couple |
| **Montée au rupteur** | Fraction du rupteur à laquelle la boîte monte, pied au plancher |
| **Montée à charge nulle** | La même, pied levé. C'est elle qui décide si l'on roule en rapport long à bas régime — sans elle, les derniers rapports ne sont jamais engagés |
| **Descente sous** | Seuil de rétrogradage |
| **Temporisations de montée** | Une par rapport, en secondes. Les garder **inégales** : avec une valeur unique, la boîte sonne comme un métronome |

### Signal de vitesse

| Réglage | Ce qu'il fait |
|---|---|
| **Raideur du lissage** | Haut : réactif, mais les sauts du GPS s'entendent. Bas : doux, mais en retard. Le réglage le plus sensible |
| **Fenêtre d'accélération** | Durée sur laquelle la pente est estimée |
| **Zone morte** | En deçà, la variation est traitée comme du tremblement de mesure |
| **Vitesse plausible max** | Au-delà, la mesure est rejetée comme aberrante |
| **Accélération / décélération max retenues** | Bornes de l'accélération transmise à la charge |

### Mixage

| Réglage | Ce qu'il fait |
|---|---|
| **Volume général** | |
| **Début / fin de bascule** | Régimes entre lesquels la couche haute remplace la basse. **Indépendants des régimes d'ancrage**, qui règlent la justesse |
| **Accélération pleine charge** | Accélération au-delà de laquelle la charge est maximale. Faute de pédale dans une voiture électrique, c'est elle qui arbitre le fondu entre « en charge » et « pied levé » |
| **Lissage de la charge** | Évite que le fondu papillonne sur le bruit d'accélération |
| **Effacement du ralenti** | Régime au-dessus duquel la couche de ralenti disparaît |
| **Coupe-bas**, **Saturation**, **Seuil du limiteur** | Chaîne de sortie |

### Couches

Une ligne par échantillon. Le bouton **Analyser** mesure le fichier et propose
des ancrages.

| Colonne | Ce qu'elle fait |
|---|---|
| **Rôle** | « en charge », « pied levé », « ralenti » ou « rupteur ». Détermine la famille dans laquelle la couche est fondue |
| **Ancrage** | Régime auquel l'échantillon a été enregistré. Fixe la **justesse**, pas le point de bascule |
| **Gain** | Niveau propre à la couche |
| **Lecture min / max** | Bornes d'étirement. Au-delà d'une octave environ, le son devient métallique vers le haut, pâteux vers le bas |

### Profils

Sélection, renommage, duplication, suppression, **export** et **import** en JSON.
Les profils sont conservés dans le navigateur ; l'export sert à les transporter
d'un appareil à l'autre.

---

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
    drivetrain/gearbox.ts  rapports, passages automatiques et manuels
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
scripts/                 compression FLAC, déploiement
```

Les trois sources de vitesse exposent la même interface, donc rien en aval ne
sait d'où vient le chiffre : on développe au clavier, on met au point en rejouant
un trajet capturé, on roule pour de vrai, sans branche conditionnelle nulle part.

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

Trois points ont demandé une attention particulière :

- **Le raccord des boucles.** Mesurée canal par canal après décodage, la
  discontinuité atteignait 21,6 % du niveau crête sur la montée haut régime et
  39,4 % sur le rupteur : de quoi claquer à chaque tour. Le chargement les
  détecte et applique un fondu de 30 ms.
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

### Ce qui n'est pas vérifié

- **Le verrou d'écran.** Le code est en place, mais le navigateur de
  développement refuse la permission (`NotAllowedError`), y compris sur un appel
  direct à l'API. Seul son échec propre est établi.
- **Le GPS écran éteint.** Les systèmes mobiles espacent fortement les mesures
  quand l'écran s'éteint. C'est à cela que sert le verrou, et les deux se testent
  ensemble, en roulant.
- **La configuration nginx.** Écrite avec soin mais jamais exécutée, faute de
  Docker sur le poste de développement.
- **Le rendu sonore.** Les mesures établissent que le signal sort, qu'il ne
  sature pas et que les fondus sont corrects. Pas qu'il sonne juste.
