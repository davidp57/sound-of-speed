# MENAGE-UI — trois niveaux, et ce qui les sépare n'est pas un droit

**Statut :** ✅ fait — 8 tickets sur 8
**Branche :** `feature/menage-ui`
**Version visée :** 0.5

**Cette spécification remplace la précédente**, écrite le 8 septembre 2026 et
reprise le 12. Elle a été refaite le 14 septembre à partir de cinq cas d'usage
donnés par David, qui ont déplacé la question : le ménage ne se règle ni par un
drapeau de construction, ni par un droit, mais par **ce que la personne est en
train de faire**. L'analyse précédente est abandonnée ; ce qu'elle avait de bon
— la liste des sections, le croquis de l'écran de conduite — est repris ici.

## Ce qu'il faut obtenir

Cinq cas d'usage, et chacun doit trouver son écran.

1. **En roulant** : choisir le profil pour changer le bruit du moteur, se servir
   des commandes de boîte, régler le volume.
2. **À l'arrêt** : paramétrer ses profils simplement.
3. **Chez soi** : modifier ses profils en profondeur.
4. **En atelier, sur un poste** : manipuler tout ce qui change la sonorité d'un
   profil.
5. **En développement** : enregistrer de nouvelles banques avec engine-sim.

Aujourd'hui la voiture montre quatre onglets, dont un écran de configuration de
2 454 lignes et dix sections. Les cinq cas s'y mélangent.

## Le modèle : trois niveaux

Ce qui sépare les niveaux n'est pas un droit mais la situation. Le premier
niveau est ouvert à tous, partout. Le deuxième demande d'être à l'arrêt. Le
troisième demande un rôle et un poste de travail.

| | Écran | Contenu | Conditions |
|---|---|---|---|
| **1** | Conduite | cadrans, commandes de boîte, tempérament, volume, favoris épinglés | — |
| **1** | Paramètres | choisir et épingler un profil, les trois curseurs globaux, recevoir un profil par lien, hors réseau, pétarade et clac | — |
| **1** | Télémétrie | quatre valeurs de santé agrandies ; le reste sous un repli | — |
| **1** | Compte | inchangé | — |
| **2** | Paramètres avancés | Moteur, Transmission, Signal de vitesse, Caractère | garde |
| **2** | · simulateur et sélecteur de source | | garde, et téléphone ou poste |
| **3** | Atelier | Mixage, Couches, créer, renommer, dupliquer, supprimer, exporter et partager un profil, banc de synthèse | garde, rôle, et poste |

Le rôle demandé par l'atelier est `atelier`, et `synthese` pour le banc. Les
deux existent déjà : `atelier` n'ouvrait aucun écran, alors que le serveur
l'exige pour accepter un dépôt.

## La garde : une seule règle

**Si la source est le GPS, un écran gardé est fermé — sauf vitesse nulle depuis
trente secondes et application au repos.** Sous simulateur ou rejeu, il n'y a
pas de garde.

L'onglet gardé reste **visible et grisé** plutôt que de disparaître. Sélectionné,
il s'ouvre sur un écran vide qui dit « disponible uniquement à l'arrêt ». Un
bouton mort qui ne dit pas pourquoi est un défaut ; un onglet qui apparaît et
disparaît en déplace un autre sous le doigt.

Trois raisons à cette forme.

**La garde ne repose sur aucune devinette.** L'application sait de source sûre
d'où vient son chiffre de vitesse. Reconnaître une voiture à la chaîne d'agent
du navigateur est un pari que `core/appareil.ts` annonce lui-même comme non
vérifié sur la vraie Tesla ; une détection ratée ouvrirait en roulant l'écran
que la garde devait fermer.

**Elle ne ferme pas le simulateur sur lui-même.** Une garde qui regarderait la
vitesse de la chaîne se déclencherait dès qu'on simule 90 km/h, c'est-à-dire
exactement quand on règle.

**L'axe de l'appareil range l'écran, la garde le protège.** Les deux se
cumulent : un écran réservé au poste porte quand même la garde, parce que
l'appareil est déclaré par celui qui s'en sert et qu'une déclaration se trompe.

Il reste un trou, et il est assumé : quelqu'un installé en voiture qui déclare
un poste **et** passe au simulateur échappe à tout. Il n'entend alors plus sa
propre vitesse, donc il ne conduit plus avec.

## Décisions

Prises le 14 septembre 2026, au cours de l'entretien.

### Le simulateur appartient au niveau 2, hors voiture

C'est le seul moyen d'entendre un réglage sans rouler. Sans lui, le cas 3 règle
une inertie ou un frein moteur en silence, ce qui n'a pas de sens. Le sélecteur
de source le suit, sans quoi on ne peut pas choisir le simulateur.

Ni l'un ni l'autre n'apparaît sur l'appareil « voiture » : le croquis du
10 septembre les en bannissait, et la garde ne s'y substitue pas.

### Le conducteur ajuste, il ne crée pas

Créer, renommer, dupliquer, supprimer, exporter et partager un profil sont des
gestes d'atelier. Le conducteur choisit parmi ce qu'on lui a livré, l'épingle,
et bouge les trois curseurs globaux.

Un profil reçu par lien s'installe comme aujourd'hui : recevoir n'est pas créer.

### Les ajustements du conducteur sont une couche

Les trois curseurs globaux se rangent à côté du profil, pas dedans. Le profil
livré reste intact, et la couche se réapplique quand une version corrigée arrive
de l'atelier.

C'est le motif déjà en place pour l'étalonnage, et les curseurs s'y prêtent : le
tempérament et la réactivité ne sont pas enregistrés dans un profil, ils s'en
déduisent. La couche pèse donc trois nombres — tempérament, réactivité, nombre
de rapports — et non la trentaine de valeurs qu'un curseur recalcule.

### Le panneau d'étalonnage manuel s'en va

L'étalonnage se fait tout seul depuis les trajets ordinaires. Le panneau portait
aussi l'enregistrement et le rejeu des traces, mais la capture du trajet démarre
seule au démarrage du GPS et se dépose par tranches, et le rejeu se pilote depuis
la télémétrie. Ce qui disparaît est le déclenchement manuel d'une trace et la
liste locale des traces.

### La télémétrie reste lisible en roulant

Lire n'est pas régler : un écran sans champ modifiable ne présente pas le risque
que la garde couvre. Quatre valeurs de santé montent en haut, agrandies —
précision annoncée, temps depuis la dernière mesure, vitesse lissée et brute,
état du son. Elles répondent à la seule question qu'on se pose au volant : est-ce
que ça marche, et sinon où ça casse.

Le reste passe sous un repli libellé « avancé — à lire à l'arrêt », à sa taille
actuelle. C'est un avertissement, pas un verrou.

### Le profil se change depuis l'écran de conduite

Le cas 1 demande de changer le bruit du moteur en roulant ; le croquis du
10 septembre ne prévoyait pas de sélecteur. Les deux se concilient par les
favoris : une rangée courte des seuls profils épinglés, deux ou trois grandes
cibles. La liste complète reste dans Paramètres.

L'épinglage existe déjà et ne servait qu'à trier une liste.

### Les écrans d'atelier se rangent sous un onglet

Une barre de neuf entrées n'est plus une barre : elle se replie sur trois rangs
dès 375 pixels, et le raccord de l'onglet actif au contenu ne veut alors plus
rien dire. L'atelier porte sa propre navigation interne — c'est l'écran où l'on
passe du temps, pas celui qu'on touche en roulant.

### Le banc rend la commande de fabrication

La fabrication d'une banque lance un binaire natif compilé sur le poste. Le
serveur du NAS est en Linux ARM64 et n'a ni ce binaire ni la puissance pour un
simulateur physique pendant qu'il sert la voiture. Une compilation croisée
rouvrirait le chantier que le lot IMAGE-ARM64 a fermé — et ce qui l'avait sauvé,
c'est que npm sait installer pour une autre architecture, ce qu'un binaire C++
ne sait pas faire.

Le banc rend donc la commande exacte, avec les réglages qu'on vient d'entendre,
prête à coller. La friction réelle n'est pas de taper une commande, c'est de
retrouver les bons paramètres après avoir réglé à l'oreille.

C'est réversible : le jour où taper gêne encore, le bouton existe et il n'y aura
qu'à changer ce qu'il déclenche.

## Ce qu'on ne construit pas

- **Un quatrième rôle.** Les paramètres avancés ne demandent aucun droit : le
  conducteur des cas 2 et 3 est la même personne. La garde suffit.
- **Une fabrication de banque exécutée par un serveur.** Voir la décision
  ci-dessus.
- **Le plein écran au démarrage.** Le croquis demandait « aucun bouton en
  haut » ; le rangement sous un onglet s'en approche sans laisser un premier
  lancement sans porte visible. Le reste est une question de navigation, à
  instruire à part.
- **La descente des moteurs depuis le serveur.** Les profils redescendent déjà,
  les moteurs et les boîtes remontent seulement. Ce chemin appartient au premier
  volet d'[ATELIER](../ATELIER/spec.md) et ne bloque pas celui-ci : un profil
  complet qui redescend suffit à ce que vider la voiture ne la fige pas.

## Critères d'acceptation

- [x] En roulant, on change de profil sans quitter l'écran de conduite
- [x] En roulant, l'onglet des paramètres avancés est visible, grisé, et
      s'ouvre sur « disponible uniquement à l'arrêt »
- [x] Arrêté depuis trente secondes et au repos, il s'ouvre
- [x] Sous simulateur, il est ouvert sans condition
- [x] L'appareil « voiture » ne montre jamais le simulateur ni le sélecteur de
      source, à aucun niveau
- [x] Un compte sans le rôle `atelier` ne voit pas l'onglet Atelier, et le
      serveur refuse ses dépôts
- [x] Un profil ajusté au premier niveau garde son ajustement quand une version
      corrigée du même profil arrive de l'atelier
- [x] La télémétrie se lit en roulant, ses quatre valeurs de santé en grand
- [x] Le contrôle qualité passe, et aucun écran retiré ne laisse de code mort

## Les tickets

Découpés le 14 septembre 2026. Le premier pose la garde et le second niveau ;
tout le reste en dépend ou s'en détache franchement.

| | Sujet | Bloqué par |
|---|---|---|
| [01](tickets/01-les-parametres-avances-deviennent-un-ecran-garde.md) ✅ | Les paramètres avancés deviennent un écran à part, gardé | — |
| [02](tickets/02-le-simulateur-rejoint-les-parametres-avances.md) ✅ | Le simulateur et le sélecteur de source rejoignent le second niveau, hors voiture | 01 |
| [03](tickets/03-l-atelier-rassemble-le-son-et-la-fabrication.md) ✅ | L'atelier : un onglet qui rassemble le son et la fabrication de profils | 01 |
| [04](tickets/04-le-panneau-d-etalonnage-manuel-s-en-va.md) ✅ | Le panneau d'étalonnage manuel s'en va | 02 |
| [05](tickets/05-le-banc-rend-la-commande-de-fabrication.md) ✅ | Le banc rend la commande de fabrication, prête à coller | 03 |
| [06](tickets/06-les-ajustements-du-conducteur-sont-une-couche.md) ✅ | Les ajustements du conducteur deviennent une couche | — |
| [07](tickets/07-les-favoris-changent-le-son-en-roulant.md) ✅ | Les favoris épinglés changent le son depuis l'écran de conduite | — |
| [08](tickets/08-la-telemetrie-se-lit-en-roulant.md) ✅ | La télémétrie se lit d'un coup d'œil en roulant | — |

## Ce que le lot a donné, mesuré

| | avant | après |
|---|---|---|
| Morceau principal, compressé | 107,4 ko | **97,8 ko** |
| Onglets en voiture | 4 | 5, dont un grisé en roulant |
| Hauteur de la barre en voiture | 58 px | 58 px |
| `ConfigView.vue` | 2 454 lignes | 792, plus trois écrans à côté |
| Cible des profils épinglés | 38 px | 44 px, 84 en plein écran |
| Tests | 1 585 | 1 612 |

Les 9 % gagnés sur le téléchargement viennent de l'atelier, parti dans son
propre morceau : la voiture ne le prend jamais.

## Ce qui reste dû, et qui n'est pas de ce lot

**La couche du conducteur ne suit pas le compte** d'un appareil à l'autre. Le
ticket 06 le demandait, et la question qu'il tranchait trop vite mérite d'être
posée ailleurs : un ajustement est-il une préférence d'appareil, comme le
volume, ou une donnée de compte ? Ça se décide avec le chemin de dépôt, dans
[ATELIER](../ATELIER/spec.md).

**Le croquis du 10 septembre demandait « aucun bouton en haut ».** La barre est
passée de sept onglets à cinq en voiture, ce qui s'en approche sans laisser un
premier lancement sans porte visible. Aller plus loin — démarrer en plein écran —
est une question de navigation, pas de ménage.
