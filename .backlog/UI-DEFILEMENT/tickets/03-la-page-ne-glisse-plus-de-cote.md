# 03 — La page ne glisse plus de côté

**Statut :** ⬜ prêt

**Bloqué par :** aucun, peut démarrer tout de suite

## Ce qu'il faut obtenir

En portrait sur un téléphone, la page ne déborde plus horizontalement. On peut
la faire défiler vers le bas sans qu'elle parte de côté au passage.

C'est le même symptôme vécu que le reste du lot — on cherche à défiler et
l'écran fait autre chose — mais une cause différente, et antérieure : le
document est plus large que l'écran, si bien que le contenu apparaît décalé et
que le geste de défilement emporte la page latéralement.

Mesuré sur un écran de 375 px de large, une fois l'écran de configuration
corrigé par les tickets 01 et 02 : le document fait encore 606 px. Le
responsable est la **barre d'onglets**, en haut, dont les boutons ne se replient
pas — la zone de contenu, elle, tient désormais dans les 375 px.

Le remède n'est pas de rétrécir les libellés : c'est de laisser la barre se
replier, ou de faire glisser les boutons dans leur propre bande quand la place
manque.

## Critères d'acceptation

- [ ] Sur un écran de 375 px de large, le document ne dépasse pas la largeur de
      la fenêtre
- [ ] Tous les onglets et commandes de la barre restent atteignables
- [ ] En paysage et sur grand écran, la barre est inchangée
- [ ] Aucun texte de la barre n'est tronqué sans possibilité de le lire
