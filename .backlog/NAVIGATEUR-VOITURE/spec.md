# NAVIGATEUR-VOITURE — ce que l'appareil réel impose

**Statut :** 🧑 attend David — le code est livré, il attend un relevé en roulant
**Branche :** `fix/navigateur-voiture`
**Version visée :** 0.2

## Ce qui a déclenché

Speed tourne dans le **navigateur embarqué d'une Tesla Model 3 Highland**,
ouvert depuis les favoris de la voiture. C'est le seul appareil d'usage — pas un
téléphone. Précisé par David le 4 septembre 2026, après plusieurs
recommandations qui supposaient l'inverse.

Une note de passation sur ce navigateur a été fournie le même jour. Elle
confortait quatre choix du projet, en apportait trois utiles, et contenait deux
affirmations qui sont fausses ici. Le document lui-même n'est pas conservé — ce
lot en garde ce qui est actionnable, et surtout ce qui est vérifié.

## Ce que la note confortait, et qui ne demande rien

Privilégier `coords.speed` plutôt que la dérivée de deux positions — sur un vrai
récepteur, la vitesse est calculée par effet Doppler, donc moins bruitée.
Découpler la réception du rendu, avec interpolation et extrapolation bornée.
Déclencher le plein écran par un geste. Prévoir un gain interne à
l'application, la voiture n'ayant qu'un seul niveau média partagé avec le
Bluetooth. Les quatre sont en place.

## Ce qu'elle affirmait de faux, et qu'il faut retenir comme tel

**« `watchPosition` livre environ un point par seconde. »** Faux ici, et mesuré :
quelques dizaines de millisecondes en roulant, plusieurs secondes à l'arrêt.
C'est mot pour mot l'hypothèse qui a coûté le lot PENTE — l'ancien code disait
« seize mesures, soit seize secondes à la cadence d'un GPS ». Toute note
extérieure la répétera : s'en méfier chaque fois.

**« Moyenne exponentielle, alpha 0,3, sur la valeur affichée. »** Ce serait une
régression. Une moyenne exponentielle appliquée par image dépend de la fréquence
d'image ; le conditionnement emploie un ressort amorti critique intégré à pas
fixe, précisément pour que le comportement soit identique à 30 comme à 120
images par seconde — c'est une promesse tenue par un test.

## Ce qu'il y a à faire

**Filtrer sur la précision de la position.** `position.coords.accuracy` est
transmis dans chaque mesure et n'est utilisé nulle part : un point à 200 mètres
de précision entre dans le calcul comme un point à 5 mètres. C'est un trou du
même genre que celui du GPS muet — un défaut qui ne se voit pas.

Le seuil ne se choisit pas sur parole. Relever d'abord les valeurs réelles dans
la voiture, puis décider : un seuil trop serré rejetterait des mesures saines et
ferait taire la source, c'est-à-dire exactement le défaut qu'on vient de
corriger.

**Dire quelle version tourne.** ✅ Livré le 4 septembre 2026.
 L'application n'affiche son numéro de version
nulle part. Dans la voiture, où le service worker sert un cache et où il n'y a
ni console ni devtools, **rien ne permet donc de savoir si l'on essaie la
version qu'on croit**. Relevé le 4 septembre 2026, en préparant une série
d'essais : la première précaution demandée était « comment repartir sur une base
propre », et la réponse ne peut pas être vérifiée faute de ce numéro.

Il se lit déjà dans `package.json` au moment de la construction. L'afficher tient
donc à peu de chose, et cela vaut pour tout essai à venir : un correctif jugé
sur la version précédente est un correctif jugé pour rien.

**Afficher ce qui ne se déduit pas.** Quatre inconnues se règlent par un
affichage en télémétrie plutôt que par du code écrit à l'aveugle : la précision
des positions, la largeur utile réelle de la page (le zoom n'est pas réglable et
sa valeur par défaut a augmenté avec le logiciel 2026.26), la réponse de l'API
de verrou d'écran, et si l'autorisation de géolocalisation est retenue d'une
session à l'autre.

## Ce qui est déjà répondu

- **Cadence de la source** : quelques dizaines de millisecondes en roulant,
  mesuré, et c'est ce qui a fondé le lot PENTE.
- **`coords.speed` est-il renseigné ?** La ligne « Origine de la vitesse » de
  l'écran de télémétrie, livrée par ESSAI-04, le dira au premier trajet. C'est
  aussi ce qui confirmera ou non le diagnostic du GPS muet.

## Ce qui est livré

**Le numéro de version s'affiche**, en tête de la section « Appareil » de
l'écran de télémétrie, lu dans `package.json` à la construction. C'est la
première chose à regarder avant de juger un essai.

Le filtre de précision existe, réglable par profil sous *Précision GPS
acceptée*, livré à **250 mètres** — large exprès, faute de valeurs mesurées.
Une position écartée n'est ni une mesure ni la référence de la suivante, et son
rejet se compte à l'écran. Sept tests couvrent le rejet, le passage, la borne,
la précision inconnue, la référence conservée et le réglage livré.

Les quatre inconnues sont affichées : la précision annoncée et les douze
dernières dans « Qualité du signal » ; la largeur et la hauteur utiles, la
taille d'écran annoncée, la densité de pixels, la réponse de l'API de verrou
d'écran et l'autorisation de géolocalisation relevée au chargement, dans une
section « Appareil ».

## Ce qui reste

Un relevé en roulant, par David :

1. la précision annoncée par la voiture, en ville et sur autoroute — c'est elle
   qui décidera du seuil définitif ;
2. la largeur utile, pour caler la mise en page — **répondu le 16 septembre
   2026 : 773 × 575 px utiles**, pour 1 254 × 784 annoncés et une densité de
   1,53. Le chiffre a ouvert le lot [CADRAGE](../CADRAGE/spec.md) ;
3. la réponse du verrou d'écran, et si l'autorisation de géolocalisation est
   retenue au démarrage suivant.

Le seuil ne sera resserré qu'après. Tant qu'il ne l'est pas, le compte
« imprécises » doit rester à zéro sur un trajet ordinaire ; s'il grimpe, c'est
le seuil qu'il faut élargir, pas les mesures qu'il faut croire.

## Hors périmètre

Le micro et la caméra de l'habitacle, une interface vocale, le cap, l'altitude,
les limitations de vitesse, l'export GPX. Ce sont des fonctionnalités, pas des
contraintes de l'appareil : elles se décideront pour elles-mêmes.
