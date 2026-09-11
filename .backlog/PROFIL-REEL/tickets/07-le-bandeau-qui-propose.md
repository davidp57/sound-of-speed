# 07 — Le bandeau qui propose, et la couche qui s'applique

**Statut :** ⬜ prêt

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

## Critères d'acceptation

- [ ] Le bandeau apparaît quand le serveur a de quoi proposer, et pas avant.
- [ ] Il s'affiche aussi en roulant, sans rien bloquer, et sans animation.
- [ ] « Appliquer » compose la couche par-dessus le profil actif ; aucun réglage
      du profil n'est modifié.
- [ ] La couche se retire, et l'écran de configuration annonce les réglages
      qu'elle remplace — comme le fait déjà l'étalonnage.
- [ ] « Plus tard » le fait disparaître pour ce trajet.
- [ ] Sans réseau, rien ne change à l'écran de conduite.
- [ ] Contrôle qualité vert.
