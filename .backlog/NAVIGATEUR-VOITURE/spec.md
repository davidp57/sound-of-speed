# NAVIGATEUR-VOITURE — ce que l'appareil réel impose

**Statut :** ⬜ prêt
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

## Hors périmètre

Le micro et la caméra de l'habitacle, une interface vocale, le cap, l'altitude,
les limitations de vitesse, l'export GPX. Ce sont des fonctionnalités, pas des
contraintes de l'appareil : elles se décideront pour elles-mêmes.
