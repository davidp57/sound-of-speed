# 08 — La télémétrie se lit d'un coup d'œil en roulant

**Statut :** ✅ fait

**Bloqué par :** aucun, peut démarrer tout de suite

## Ce qu'il faut obtenir

La télémétrie reste ouverte à tous et lisible en roulant : lire n'est pas
régler, et un écran sans champ modifiable ne présente pas le risque que la garde
couvre. C'est aussi le seul endroit où l'on voit ce que le GPS donne vraiment
pendant un trajet.

Mais ses dix sections ne se lisent pas au volant. Quatre valeurs montent en
haut, **agrandies** :

- la précision annoncée, en mètres — le défaut numéro un, les 9 999,99 m de
  l'essai du 11 septembre ;
- le temps depuis la dernière mesure — il dit si le GPS s'est tu ;
- la vitesse lissée et la vitesse brute côte à côte — leur écart dit si le
  conditionneur suit ;
- l'état du son.

Elles répondent à la seule question qu'on se pose en roulant : est-ce que ça
marche, et sinon où ça casse. Le régime et le rapport n'y sont pas — ils sont
sur les cadrans, à un onglet de là.

Tout le reste passe dessous, à sa taille actuelle, dans un repli libellé
« avancé — à lire à l'arrêt ». C'est un avertissement, pas un verrou : il
s'ouvre quand on le touche.

## Critères d'acceptation

- [x] Les quatre valeurs de santé se lisent en haut, agrandies, sans faire
      défiler
- [x] Le reste est replié derrière un libellé qui prévient
- [x] Le repli s'ouvre et se ferme sans rien verrouiller
- [x] L'écran reste ouvert en roulant, quel que soit l'appareil
- [x] Aucune valeur n'a disparu : ce qui était affiché l'est toujours, ailleurs

## Ce qui a été fait, et mesuré

Les quatre valeurs de santé occupent toute la largeur, en quatre colonnes sur un
poste et deux sur un téléphone de 375 pixels : 185 pixels de haut, sans
débordement horizontal. Le repli fermé fait 36 pixels.

Deux repères passent en couleur d'alerte : la précision au-delà du seuil **du
profil** — et non d'un chiffre écrit dans l'écran, sinon resserrer le seuil de
rejet ne changerait rien à ce qui s'allume — et le temps depuis la dernière
mesure au-delà de trois secondes.

L'état du son se lit sur `soundState`, celui-là même que porte le bouton de la
barre : deux façons de dire si le son sort finiraient par se contredire, et
c'est exactement l'écart qu'on vient regarder ici.

**Un défaut corrigé en cours de route**, trouvé en regardant plutôt qu'en
supposant : posé dans la grille de l'écran, le bloc de santé n'occupait qu'une
colonne de 21 rem au milieu de la page. La racine n'est plus la grille ; celle-ci
vit sous le repli.
