# 03 — La barre du haut tient dans un écran de téléphone

**Statut :** ✅ fait

**Bloqué par :** aucun, peut démarrer tout de suite

## Ce qu'il faut obtenir

Sur un téléphone en portrait, tous les boutons de la barre du haut sont
atteignables sans faire glisser la page, et la page ne déborde plus
horizontalement.

## Ce que la mesure a montré

La barre aligne six boutons sur une seule ligne, et elle a besoin de **603 px**
pour les tenir :

| Bouton | Largeur |
|---|---|
| Conduite | 92 px |
| Télémétrie | 99 px |
| Configuration | 121 px |
| ? | 26 px |
| Plein écran | 79 px |
| En marche / Arrêté | 128 px |
| **Boutons seuls** | **545 px** |
| Avec les espaces et les marges | **603 px** |

Elle ne se replie pas. En dessous de 603 px de large, ce qui dépasse sort donc
de l'écran :

| Largeur d'écran | Ce qui se passe |
|---|---|
| 640 px | rien, tout tient |
| 600 px | 3 px de débordement |
| 414 px | le dernier bouton est 189 px dehors |
| 375 px | **« En marche » est entièrement hors écran** (228 px dehors), « Plein écran » 94 px dehors, « ? » 9 px dehors |

**Le plus important n'est donc pas que la page glisse.** C'est que le bouton
marche/arrêt — celui qui démarre et coupe tout — est invisible sur un téléphone
standard en portrait. Il faut faire glisser la page de côté pour l'atteindre, et
rien ne dit qu'il est là.

## Qui est concerné

Les téléphones en portrait, et eux seuls. L'écran de la voiture est large : le
problème ne s'y produit pas. C'est ce qui explique qu'il ait pu passer inaperçu.

## Trois remèdes

- **Laisser la barre se replier** sur deux lignes quand la place manque. Une
  déclaration, rien de caché, tous les boutons atteignables. Coût mesuré plus
  bas : 53 pixels de hauteur en portrait.
- **Raccourcir les libellés** sous une certaine largeur. Peu de gain — le plus
  long, « Configuration », ne fait que 121 px — et le dépôt tient à ses textes
  en clair.
- **Faire glisser les onglets** dans leur propre bande, les commandes de droite
  restant fixes. La page ne déborde plus, mais un onglet caché est un onglet
  qu'on ne trouve pas.

**Retenu : le repli**, validé par David le 3 septembre 2026. C'est le seul qui
ne cache rien.

## Ce que le repli coûte, mesuré

Il remplace la compression. Sans lui, le navigateur resserrait les deux groupes
de boutons pour les faire tenir — jusqu'à 603 px, au-delà desquels il
débordait. Avec lui, les groupes gardent leur taille et passent à la ligne dès
que la barre descend sous **655 px**. Entre 603 et 655, il y a donc maintenant
deux lignes là où il y en avait une, resserrée.

| Largeur d'écran | Lignes | Hauteur de la barre | Boutons hors écran |
|---|---|---|---|
| 320 px | 3 | 155 px | aucun |
| 375 px | 2 | 111 px | aucun |
| 414 px | 2 | 111 px | aucun |
| 640 px | 2 | 111 px | aucun |
| 1280 px | 1 | 58 px | aucun |

Le prix est donc de 53 px de hauteur sur un téléphone, et rien au-delà de
655 px — ni sur l'écran de la voiture, ni au poste de travail.

## Critères d'acceptation

- [x] Sur un écran de 375 px de large, aucun bouton de la barre n'est hors écran
- [x] Sur un écran de 375 px, le document ne dépasse pas la largeur de la fenêtre
- [x] Le bouton marche/arrêt est visible sans aucun geste préalable
- [x] En paysage et sur grand écran, la barre est inchangée — une seule ligne
- [x] Aucun libellé n'est tronqué ni remplacé par un signe qu'il faut deviner
