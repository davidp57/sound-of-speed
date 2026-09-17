# 07 — Le bandeau qui propose, et la couche qui s'applique

**Statut :** ✅ prouvé le 17 septembre 2026 — le bandeau s'affiche (David l'a signalé lui-même, caché sous les commandes : voir [INTERFACE](../../INTERFACE/spec.md)) et la couche s'applique vraiment : son profil tourne avec `fullLoadAccelMs2` à 5,5 quand l'usine dit 2 à 2,5, et le serveur a mesuré 5,5455 sur ses six trajets

**Bloqué par :** 05 et 06 — il faut un verdict, et un résultat sur le serveur.

## Ce qu'il faut obtenir

**« Profil de la voiture généré, voulez-vous l'appliquer ? »**, sous les
cadrans, avec deux réponses : **Appliquer**, **Plus tard**.

Il s'affiche **aussi en roulant**. David : « y'a pas de raison, si je suis pas
dispo je l'ignore et je clic plus tard ». Un bandeau n'interrompt rien — c'est
une fenêtre qui prend l'écran qu'on ne veut pas, au moment précis où l'on veut
appuyer sur D et partir.

Accepté, il s'applique comme une **couche** : `withCalibration` existe, il
compose le profil choisi avec les mesures sans y toucher. Le V8 réglé à la main
reste le V8 ; il sait juste enfin ce que la voiture sait faire. Et la couche
profite à tous les profils à la fois.

Refusé, il ne revient pas tout seul — le ticket 08 donne le moyen de le
reprendre.

## Ce qui est vérifié

La chaîne entière, de la trace au son, éprouvée dans le navigateur avec le
fichier que le profileur a écrit depuis le trajet du 11 septembre :

- le bandeau s'affiche sous les cadrans — « Profil de la voiture prêt, sur
  1 trajet » ;
- « Appliquer » le fait disparaître et compose la couche ;
- l'écran de configuration annonce alors **neuf réglages** venus de la mesure,
  avec l'écart : accélération à charge pleine 3,4 au lieu de 2,0 m/s²,
  rétrogradage au freinage −1,6 au lieu de −1,0 ;
- aucun réglage du profil n'est modifié — c'est une couche.

**Pas vérifié** : le comportement en roulant, et ce que ces neuf réglages
donnent à l'oreille.

## Critères d'acceptation

- [x] Le bandeau apparaît quand le serveur a de quoi proposer, et pas avant.
- [x] Il s'affiche aussi en roulant, sans rien bloquer, et sans animation.
- [x] « Appliquer » compose la couche par-dessus le profil actif ; aucun réglage
      du profil n'est modifié.
- [x] La couche se retire, et l'écran de configuration annonce les réglages
      qu'elle remplace — comme le fait déjà l'étalonnage.
- [x] « Plus tard » le fait disparaître pour ce trajet.
- [x] Sans réseau, rien ne change à l'écran de conduite.
- [x] Contrôle qualité vert.
